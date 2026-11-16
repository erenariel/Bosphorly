// Guest profile and request history kept on this device only (localStorage).
// Real accounts that work across devices need a server; until then nothing here leaves the browser.
(() => {
  const KEY = 'bosphorly.account';
  const empty = () => ({ version: 1, profile: null, requests: [] });
  function read() {
    try { const v = JSON.parse(localStorage.getItem(KEY) || 'null'); return v && Array.isArray(v.requests) ? v : empty(); } catch { return empty(); }
  }
  function write(v) {
    try { localStorage.setItem(KEY, JSON.stringify(v)); return true; } catch { return false; }
  }
  window.BosphorlyAccount = Object.freeze({
    profile: () => read().profile,
    saveProfile(p) {
      const v = read();
      const clean = {};
      for (const k of ['name', 'phone', 'email', 'hotel', 'room']) clean[k] = String(p?.[k] || '').trim().slice(0, 140);
      v.profile = clean;
      return write(v);
    },
    requests: () => read().requests.slice().sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt))),
    addRequest(r) {
      const v = read();
      v.requests = v.requests.filter(x => x.ref !== r.ref);
      v.requests.push(Object.assign({ status: 'sent_to_whatsapp', createdAt: new Date().toISOString() }, r));
      v.requests = v.requests.slice(-50);
      return write(v);
    },
    removeRequest(ref) { const v = read(); v.requests = v.requests.filter(x => x.ref !== ref); return write(v); },
    clear() { try { localStorage.removeItem(KEY); } catch {} }
  });
})();
