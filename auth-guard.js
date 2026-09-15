(() => {
  // Supabase can emit SIGNED_IN again when an existing session is
  // re-established. While an EmulatorJS game is already open, that event must
  // not be allowed to run the app's game-opening callback again.
  const originalCreateClient = supabase.createClient;

  supabase.createClient = (...args) => {
    const client = originalCreateClient(...args);
    const originalOnAuthStateChange = client.auth.onAuthStateChange.bind(client.auth);

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

    return client;
  };
})();
