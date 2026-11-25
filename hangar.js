/* Coins and permanent equipment are shared by all six routes on this device. */
(() => {
  "use strict";
  const key = "skimmer.hangar.v1";
  const prices = {weapon: [15, 36, 66], shield: [21, 48]};
  const empty = {coins: 0, weapon: 0, shield: 0, revision: 0};
  const number = (value, max) => Number.isSafeInteger(value) ? Math.max(0, Math.min(value, max)) : 0;
  function account(value) {
    return {
      coins: number(value?.coins, Number.MAX_SAFE_INTEGER),
      weapon: number(value?.weapon, prices.weapon.length),
      shield: number(value?.shield, prices.shield.length),
      revision: number(value?.revision, Number.MAX_SAFE_INTEGER)
    };
  }
  function cached() {
    try { return account(JSON.parse(localStorage.getItem(key))); }
    catch { return {...empty}; }
  }
  let current = cached();
  function notify(value, cache) {
    if (value.revision < current.revision) return;
    current = value;
    if (cache && cached().revision < value.revision) {
      try { localStorage.setItem(key, JSON.stringify(current)); }
      catch { /* The database can still be available with storage cookies blocked. */ }
    }
    window.dispatchEvent(new CustomEvent("hangarchange", {detail: {...current}}));
  }
  window.addEventListener("storage", event => {
    if (event.key === key && event.newValue) notify(cached(), false);
  });

  const database = new Promise(resolve => {
    try {
      const open = indexedDB.open(key, 1);
      open.onupgradeneeded = () => open.result.createObjectStore("account");
      open.onsuccess = () => resolve(open.result);
      open.onerror = () => resolve(null);
    } catch { resolve(null); }
  });

  function changeLocally(edit) {
    const localEdit = () => {
      const saved = cached();
      const before = saved.revision >= current.revision ? saved : current;
      const next = edit?.(before);
      notify(next ?? before, Boolean(next));
      return Boolean(next);
    };
    return navigator.locks ? navigator.locks.request(key, localEdit) : localEdit();
  }
  // Read the latest balance and save the new level in the same transaction.
  // Another tab may be collecting coins while this tab is in the hangar.
  async function change(edit) {
    const db = await database;
    if (!db) return changeLocally(edit);
    return new Promise((resolve, reject) => {
      const tx = db.transaction("account", edit ? "readwrite" : "readonly");
      const store = tx.objectStore("account");
      const read = store.get("pilot");
      let before, next;
      read.onsuccess = () => {
        const stored = account(read.result);
        before = stored.revision >= current.revision ? stored : current;
        next = edit?.(before);
        if (next) store.put(next, "pilot");
      };
      tx.oncomplete = () => { notify(next ?? before, Boolean(next)); resolve(Boolean(next)); };
      tx.onabort = () => reject(tx.error ?? new Error("Storage transaction failed"));
    }).catch(() => changeLocally(edit));
  }
  function cost(kind, level) { return prices[kind]?.[level] ?? null; }
  function buy(kind) {
    return change(stored => {
      if (!Object.hasOwn(prices, kind) || ["play", "paused"].includes(window.Flight?.state().mode)) return;
      const price = cost(kind, stored[kind]);
      if (price === null || stored.coins < price) return;
      return {...stored, coins: stored.coins - price, [kind]: stored[kind] + 1, revision: stored.revision + 1};
    });
  }
  function earn(amount) {
    if (!Number.isSafeInteger(amount) || amount <= 0) return Promise.resolve(false);
    return change(stored => ({...stored, coins: Math.min(Number.MAX_SAFE_INTEGER, stored.coins + amount),
      revision: stored.revision + 1}));
  }
  window.Hangar = {state: () => ({...current}), cost, buy, earn, refresh: () => change()};
  change().catch(() => {});
})();
