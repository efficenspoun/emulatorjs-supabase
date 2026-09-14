(() => {
  const params = new URLSearchParams(location.search);
  if (params.get('debugLifecycle') !== '1') return;

  const prefix = '[LifecycleDebug]';
  const log = (...args) => console.log(prefix, new Date().toISOString(), ...args);

  log('diagnostics enabled', { href: location.href });

  const snapshot = () => ({
    hidden: document.hidden,
    visibility: document.visibilityState,
    focused: document.hasFocus(),
    playerVisible: !document.getElementById('playerView')?.classList.contains('hidden'),
    currentGame: window.currentGame?.id ?? null,
    emulator: window.EJS_emulator ?? null,
    gameManager: window.EJS_emulator?.gameManager ?? null,
    canvas: document.querySelector('#game canvas'),
    gameHtmlLength: document.getElementById('game')?.innerHTML.length ?? null
  });

  let lastEmulator = null;
  let lastGameManager = null;
  let lastCanvas = null;
  let lastGameHtmlLength = null;

  const inspect = (reason) => {
    const s = snapshot();
    if (s.emulator !== lastEmulator) {
      log('EJS_emulator identity changed', reason, { old: lastEmulator, new: s.emulator });
      lastEmulator = s.emulator;
    }
    if (s.gameManager !== lastGameManager) {
      log('gameManager identity changed', reason, { old: lastGameManager, new: s.gameManager });
      lastGameManager = s.gameManager;
    }
    if (s.canvas !== lastCanvas) {
      log('canvas identity changed', reason, { old: lastCanvas, new: s.canvas });
      lastCanvas = s.canvas;
      if (s.canvas) {
        s.canvas.addEventListener('webglcontextlost', (event) => {
          log('WEBGL CONTEXT LOST', event);
        });
        s.canvas.addEventListener('webglcontextrestored', (event) => {
          log('WEBGL CONTEXT RESTORED', event);
        });
      }
    }
    if (s.gameHtmlLength !== lastGameHtmlLength) {
      log('#game innerHTML length changed', reason, {
        old: lastGameHtmlLength,
        new: s.gameHtmlLength
      });
      lastGameHtmlLength = s.gameHtmlLength;
    }
  };

  ['visibilitychange', 'blur', 'focus', 'pagehide', 'pageshow', 'resize'].forEach((eventName) => {
    window.addEventListener(eventName, () => {
      log('browser lifecycle event', eventName, snapshot());
      inspect(eventName);
    }, true);
  });

  const game = document.getElementById('game');
  if (game) {
    new MutationObserver((mutations) => {
      log('#game DOM mutation', mutations.map((m) => ({
        type: m.type,
        added: m.addedNodes.length,
        removed: m.removedNodes.length
      })));
      inspect('MutationObserver');
    }).observe(game, { childList: true, subtree: true });
  }

  const originalStartEmulator = window.startEmulator;
  if (typeof originalStartEmulator === 'function') {
    window.startEmulator = async (...args) => {
      log('APP startEmulator() CALLED', {
        gameId: args[0]?.id ?? null,
        stack: new Error().stack
      });
      return originalStartEmulator.apply(this, args);
    };
  } else {
    log('startEmulator not globally accessible; using DOM/runtime diagnostics only');
  }

  let previousLoaderCount = 0;
  const checkScripts = () => {
    const loaders = [...document.scripts].filter((s) => s.src.includes('emulatorjs.org') || s.src.includes('loader.js'));
    if (loaders.length !== previousLoaderCount) {
      previousLoaderCount = loaders.length;
      log('EmulatorJS loader script count changed', loaders.map((s) => s.src));
    }
  };

  setInterval(() => {
    inspect('poll');
    checkScripts();
  }, 500);

  inspect('initial');
})();
