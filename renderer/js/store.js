/* Sirius IDE — store.js
   Minimal centralized store for shared renderer state. */
'use strict';

(function initStore(global) {
  const listeners = new Set();
  const state = {
    projectRoot: null,
    openFiles: {},
    openFilesOrder: [],
    activeFile: null,
    currentTheme: localStorage.getItem('nb_theme') || 'dark',
    currentLang: localStorage.getItem('nb_lang') || 'ru',
  };

  function notify(changedKey, value) {
    listeners.forEach((fn) => {
      try { fn(changedKey, value, state); } catch (_) {}
    });
  }

  const store = {
    get(key) { return state[key]; },
    set(key, value) {
      state[key] = value;
      notify(key, value);
      return value;
    },
    patch(obj) {
      if (!obj || typeof obj !== 'object') return;
      Object.keys(obj).forEach((k) => {
        state[k] = obj[k];
        notify(k, obj[k]);
      });
    },
    snapshot() { return { ...state }; },
    subscribe(fn) {
      listeners.add(fn);
      return function unsubscribe() { listeners.delete(fn); };
    },
  };

  global.appStore = store;
})(window);
