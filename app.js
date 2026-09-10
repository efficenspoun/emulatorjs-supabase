const SUPABASE_URL = 'https://qrfzjaqijykfzwfhbhfg.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_3Sk7E4etB2xnconNXNUwgg_ejXvGI8q';

const { createClient } = supabase;
const db = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

const CORES = {
  nes: 'nes',
  snes: 'snes9x',
  gb: 'gambatte',
  gbc: 'gambatte',
  gba: 'mgba',
  genesis: 'genesis_plus_gx',
  mastersystem: 'smsplus',
  gamegear: 'smsplus',
  atari2600: 'stella2014',
  psx: 'mednafen_psx_hw'
};

let currentUser = null;
let currentGame = null;
let selectedSlot = 0;
let emulatorScript = null;
let emulatorStarting = false;

const $ = (id) => document.getElementById(id);
const authView = $('authView');
const libraryView = $('libraryView');
const playerView = $('playerView');

function message(element, text, error = false) {
  element.textContent = text || '';
  element.style.color = error ? '#ff7272' : '#aeb5c3';
}

function slugify(value) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 70) || 'game';
}

function setLoggedInUI(loggedIn) {
  authView.classList.toggle('hidden', loggedIn);
  libraryView.classList.toggle('hidden', !loggedIn);
  $('logoutBtn').classList.toggle('hidden', !loggedIn);
  if (!loggedIn) playerView.classList.add('hidden');
}

async function refreshSession() {
  const { data, error } = await db.auth.getSession();
  if (error) console.error(error);
  currentUser = data.session?.user ?? null;
  setLoggedInUI(Boolean(currentUser));
  $('userEmail').textContent = currentUser?.email || '';
  if (currentUser) await loadGames();
}

$('authForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  const email = $('email').value.trim();
  const password = $('password').value;
  message($('authMessage'), 'Signing in...');

  const { error } = await db.auth.signInWithPassword({ email, password });
  if (error) {
    message($('authMessage'), error.message, true);
    return;
  }

  message($('authMessage'), 'Signed in.');
  await refreshSession();
});

$('signupBtn').addEventListener('click', async () => {
  const email = $('email').value.trim();
  const password = $('password').value;
  if (!email || password.length < 6) {
    message($('authMessage'), 'Enter an email and a password with at least 6 characters.', true);
    return;
  }

  message($('authMessage'), 'Creating account...');
  const { data, error } = await db.auth.signUp({ email, password });
  if (error) {
    message($('authMessage'), error.message, true);
    return;
  }

  if (data.session) {
    message($('authMessage'), 'Account created.');
    await refreshSession();
  } else {
    message($('authMessage'), 'Account created. Check your email to confirm the account, then sign in.');
  }
});

$('logoutBtn').addEventListener('click', async () => {
  await db.auth.signOut();
  location.reload();
});

db.auth.onAuthStateChange(async (_event, session) => {
  currentUser = session?.user ?? null;
  $('userEmail').textContent = currentUser?.email || '';
  setLoggedInUI(Boolean(currentUser));
  if (currentUser) await loadGames();
});

async function loadGames() {
  const { data, error } = await db
    .from('games')
    .select('*')
    .order('title', { ascending: true });

  if (error) {
    console.error(error);
    message($('uploadMessage'), `Could not load games: ${error.message}`, true);
    return;
  }

  const container = $('games');
  container.innerHTML = '';
  $('emptyLibrary').classList.toggle('hidden', data.length !== 0);

  for (const game of data) {
    const card = document.createElement('article');
    card.className = 'game-card';
    card.innerHTML = `
      <div>
        <div class="system">${escapeHtml(game.system)}</div>
        <h3>${escapeHtml(game.title)}</h3>
      </div>
      <button data-game-id="${game.id}">Play</button>
    `;
    card.querySelector('button').addEventListener('click', () => openGame(game));
    container.appendChild(card);
  }
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

$('uploadForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!currentUser) return;

  const title = $('gameTitle').value.trim();
  const system = $('system').value;
  const file = $('romFile').files[0];
  if (!title || !file) return;

  const gameId = crypto.randomUUID();
  const filename = `${slugify(title)}-${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
  const romPath = `${currentUser.id}/${gameId}/${filename}`;
  message($('uploadMessage'), 'Uploading ROM...');

  const { error: uploadError } = await db.storage
    .from('roms')
    .upload(romPath, file, {
      upsert: false,
      contentType: file.type || 'application/octet-stream'
    });

  if (uploadError) {
    message($('uploadMessage'), uploadError.message, true);
    return;
  }

  const { error: insertError } = await db.from('games').insert({
    id: gameId,
    user_id: currentUser.id,
    title,
    system,
    rom_path: romPath
  });

  if (insertError) {
    await db.storage.from('roms').remove([romPath]);
    message($('uploadMessage'), insertError.message, true);
    return;
  }

  $('uploadForm').reset();
  message($('uploadMessage'), 'ROM uploaded.');
  await loadGames();
});

async function signedUrl(bucket, path) {
  const { data, error } = await db.storage.from(bucket).createSignedUrl(path, 3600);
  if (error) throw error;
  return data.signedUrl;
}

async function downloadBytes(bucket, path) {
  const { data, error } = await db.storage.from(bucket).download(path);
  if (error) {
    if (error.message?.toLowerCase().includes('not found')) return null;
    throw error;
  }
  return new Uint8Array(await data.arrayBuffer());
}

function statePath(slot) {
  return `${currentUser.id}/${currentGame.id}/slot-${slot}.state`;
}

function savePath() {
  return `${currentUser.id}/${currentGame.id}/battery.save`;
}

async function saveStateToCloud(slot = selectedSlot, state = null) {
  if (!window.EJS_emulator || !currentGame) throw new Error('Emulator is not ready.');
  const bytes = state || window.EJS_emulator.gameManager.getState();
  if (!bytes || !bytes.length) throw new Error('Emulator did not return a save state.');

  const { error } = await db.storage.from('states').upload(statePath(slot), bytes, {
    upsert: true,
    contentType: 'application/octet-stream',
    cacheControl: '0'
  });
  if (error) throw error;
}

async function loadStateFromCloud(slot = selectedSlot) {
  const bytes = await downloadBytes('states', statePath(slot));
  if (!bytes) return false;
  window.EJS_emulator.gameManager.loadState(bytes);
  return true;
}

async function restoreBatterySave() {
  const bytes = await downloadBytes('saves', savePath());
  if (!bytes || !window.EJS_emulator?.gameManager) return false;

  const manager = window.EJS_emulator.gameManager;
  const savePathOnDisk = manager.getSaveFilePath();
  if (!savePathOnDisk) return false;

  manager.FS.writeFile(savePathOnDisk, bytes);
  manager.loadSaveFiles();
  return true;
}

async function syncBatterySave(saveBuffer) {
  if (!saveBuffer?.length || !currentGame) return;
  const { error } = await db.storage.from('saves').upload(savePath(), saveBuffer, {
    upsert: true,
    contentType: 'application/octet-stream',
    cacheControl: '0'
  });
  if (error) console.error('Battery save sync failed:', error);
}

async function openGame(game) {
  if (emulatorStarting) return;
  emulatorStarting = true;
  currentGame = game;
  selectedSlot = 0;

  libraryView.classList.add('hidden');
  playerView.classList.remove('hidden');
  $('playerTitle').textContent = game.title;
  $('cloudStatus').textContent = 'Preparing ROM...';

  try {
    const romUrl = await signedUrl('roms', game.rom_path);
    await startEmulator(game, romUrl);
  } catch (error) {
    console.error(error);
    $('cloudStatus').textContent = error.message || 'Could not start emulator.';
    emulatorStarting = false;
  }
}

async function startEmulator(game, romUrl) {
  if (window.EJS_terminate) {
    try { window.EJS_terminate(); } catch (_) {}
  }
  $('game').innerHTML = '';

  window.EJS_player = '#game';
  window.EJS_core = CORES[game.system];
  window.EJS_gameUrl = romUrl;
  window.EJS_gameName = game.title;
  window.EJS_gameID = game.id;
  window.EJS_pathtodata = 'https://cdn.emulatorjs.org/stable/data/';
  window.EJS_startOnLoaded = true;
  window.EJS_threads = false;
  window.EJS_fixedSaveInterval = 30;
  window.EJS_disableLocalStorage = true;

  async function waitForGameManager(timeoutMs = 10000) {
    const deadline = Date.now() + timeoutMs;

    while (Date.now() < deadline) {
      const manager = window.EJS_emulator?.gameManager;
      if (manager?.FS && manager.getSaveFilePath && manager.loadState) return true;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    return false;
  }

  window.EJS_onGameStart = async () => {
    $('cloudStatus').textContent = 'Emulator ready — restoring cloud data...';

    try {
      const ready = await waitForGameManager();
      if (!ready) throw new Error('Emulator save system was not ready in time.');

      await new Promise((resolve) => setTimeout(resolve, 500));

      const restoredSave = await restoreBatterySave();
      const restoredState = await loadStateFromCloud(selectedSlot);
      $('cloudStatus').textContent = restoredState
        ? 'Cloud state restored'
        : restoredSave
          ? 'Cloud battery save restored'
          : 'Cloud sync ready';
    } catch (error) {
      console.error('Cloud restore failed:', error);
      $('cloudStatus').textContent = `Emulator ready — cloud restore failed: ${error.message}`;
    }
  };

  window.EJS_onSaveSave = async ({ save }) => {
    try {
      await syncBatterySave(save);
      $('cloudStatus').textContent = 'Battery save synced';
    } catch (error) {
      console.error(error);
      $('cloudStatus').textContent = 'Battery save sync failed';
    }
  };

  window.EJS_onSaveState = async ({ state }) => {
    try {
      await saveStateToCloud(selectedSlot, state);
      $('cloudStatus').textContent = `State synced to slot ${selectedSlot + 1}`;
    } catch (error) {
      console.error(error);
      $('cloudStatus').textContent = 'State sync failed';
    }
  };

  window.EJS_onLoadState = () => {
    $('cloudStatus').textContent = 'EmulatorJS loaded state.';
  };

  emulatorScript = document.createElement('script');
  emulatorScript.src = 'https://cdn.emulatorjs.org/stable/data/loader.js';
  emulatorScript.onload = () => {
    emulatorStarting = false;
  };
  emulatorScript.onerror = () => {
    emulatorStarting = false;
    $('cloudStatus').textContent = 'Could not load EmulatorJS.';
  };
  document.body.appendChild(emulatorScript);
}

$('backBtn').addEventListener('click', () => {
  if (window.EJS_terminate) {
    try { window.EJS_terminate(); } catch (_) {}
  }
  location.reload();
});

window.addEventListener('beforeunload', () => {
  if (window.EJS_emulator?.gameManager) {
    try {
      window.EJS_emulator.gameManager.functions.saveSaveFiles();
    } catch (_) {}
  }
});

refreshSession();
