(() => {
  const UPSTREAM_DATA_PATH = 'https://cdn.jsdelivr.net/gh/joethun/EmulatorJS@c691884/data/';

  // The current EmulatorJS stable CDN still contains the save-state timing/audio
  // behavior addressed by upstream PR #1264. Force this test deployment to use
  // that PR's exact source tree instead of changing the cloud-save code.
  Object.defineProperty(window, 'EJS_pathtodata', {
    configurable: true,
    get: () => UPSTREAM_DATA_PATH,
    set: () => {}
  });

  const originalAppendChild = Node.prototype.appendChild;
  Node.prototype.appendChild = function (node) {
    if (node instanceof HTMLScriptElement && node.src.includes('cdn.emulatorjs.org/stable/data/loader.js')) {
      node.src = `${UPSTREAM_DATA_PATH}loader.js`;
      console.log('[EmulatorJS Test] Using upstream PR #1264 build:', UPSTREAM_DATA_PATH);
    }
    return originalAppendChild.call(this, node);
  };
})();
