(() => {
  // Supabase can emit SIGNED_IN again when an existing session is
  // re-established. While an EmulatorJS game is already open, that event must
  // not be allowed to run the app's game-opening callback again.
  const originalCreateClient = supabase.createClient;

  supabase.createClient = (...args) => {
    const client = originalCreateClient(...args);
    const originalOnAuthStateChange = client.auth.onAuthStateChange.bind(client.auth);
    const originalStorageFrom = client.storage.from.bind(client.storage);

    client.auth.onAuthStateChange = (callback) => {
      return originalOnAuthStateChange((event, session) => {
        const playerView = document.getElementById('playerView');
        const gameRoute = new URLSearchParams(location.search).has('game');

        if (
          event === 'SIGNED_IN' &&
          gameRoute &&
          playerView &&
          !playerView.classList.contains('hidden')
        ) {
          console.log('[AuthGuard] Ignored SIGNED_IN while EmulatorJS is already open.');
          return;
        }

        callback(event, session);
      });
    };

    // Save states are overwritten at the same Storage path. Supabase Storage
    // can serve a cached copy of that path immediately after an upsert, which
    // can make a fresh save appear to be an old save. Force fresh reads for
    // the two frequently-replaced save buckets only.
    client.storage.from = (bucket) => {
      const storage = originalStorageFrom(bucket);

      if (bucket !== 'states' && bucket !== 'saves') return storage;
      if (storage.__freshSaveDownloadPatched) return storage;

      storage.download = async (path) => {
        const { data, error } = await originalStorageFrom(bucket).createSignedUrl(path, 60);
        if (error) {
          if (error.message?.toLowerCase().includes('not found')) {
            // app.js expects download() to return a Blob when error is null.
            // Use an empty Blob for a missing optional save so initial restore
            // can treat it as an empty save instead of calling arrayBuffer()
            // on null.
            return { data: new Blob(), error: null };
          }
          return { data: null, error };
        }

        if (!data?.signedUrl) {
          return { data: new Blob(), error: null };
        }

        const cacheNonce = `${Date.now()}-${crypto.randomUUID()}`;
        const response = await fetch(`${data.signedUrl}&cacheNonce=${cacheNonce}`, {
          cache: 'no-store'
        });

        if (response.status === 404) return { data: new Blob(), error: null };
        if (!response.ok) {
          return {
            data: null,
            error: new Error(`Cloud download failed (${response.status}).`)
          };
        }

        return { data: await response.blob(), error: null };
      };

      storage.__freshSaveDownloadPatched = true;
      return storage;
    };

    return client;
  };
})();
