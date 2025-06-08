
///////////////////////
// Key-Value Storage //
///////////////////////

export const canUseLocalStorage = (() => {
  // from modernizr v3.3.1 (modernizr.com)
  const mod = 'modernizr';
  try {
    localStorage.setItem(mod, mod);
    localStorage.removeItem(mod);
    return true;
  } catch {
    return false;
  }
})();

// RAM-only fallback
const RAMStorage = (() => {
  let obj = {};
  return Object.freeze({
    get length() { return Object.keys(obj).length; },
    key(n) { return Object.keys(obj)[n] ?? null; },
    getItem(key) { return Object.prototype.hasOwnProperty.call(obj, key) ? obj[key] : null; },
    setItem(key, val) { obj[key] = String(val); },
    removeItem(key) { delete obj[key]; },
    clear() { obj = {}; }
  });
})();

export const KeyValueStorage = (() => {
  const s = canUseLocalStorage ? localStorage : RAMStorage;

  return {
    read: s.getItem.bind(s),
    write: s.setItem.bind(s),
    remove: s.removeItem.bind(s),
    // Registers a listener for StorageEvents from other tabs/windows.
    addStorageListener: canUseLocalStorage
      ? (listener) => {
        window.addEventListener('storage', (e) => {
          if (e.storageArea === localStorage) {
            listener(e);
          }
        });
      }
      : () => {},
    removeStorageListener: canUseLocalStorage
      ? window.removeEventListener.bind(window, 'storage')
      : () => {}
  };
})();
