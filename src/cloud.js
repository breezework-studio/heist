/* Heist — Google Drive autosave.
   The game always saves in the browser; when signed in and online it also keeps a copy in the app's hidden
   Drive folder (appDataFolder). Offline, the upload waits and is sent when the connection returns. */
(function (root) {
'use strict';
const CLIENT_ID = '586922713786-h6vbu6h1sib6ifto790rhr5v8pe9imm1.apps.googleusercontent.com'; // Google OAuth client ID (Web application, origin https://breezework-studio.github.io)
const SCOPE = 'https://www.googleapis.com/auth/drive.appdata';
const NAME = 'heist-save.json';
const API = 'https://www.googleapis.com/drive/v3/files', UP = 'https://www.googleapis.com/upload/drive/v3/files';
const C = { id: (root.HEIST_CLIENT_ID || CLIENT_ID), token: null, exp: 0, gis: null, tc: null, wait: null, pending: null, busy: false, state: 'off', err: '', last: 0, listeners: [] };
const cfg = () => { try { return JSON.parse(localStorage.getItem('heist.cloud') || '{}'); } catch (e) { return {}; } };
const setCfg = o => { try { localStorage.setItem('heist.cloud', JSON.stringify(Object.assign(cfg(), o))); } catch (e) { } };
const online = () => navigator.onLine !== false;
function set(state, err) { C.state = state; C.err = err || ''; C.listeners.forEach(f => { try { f(state); } catch (e) { } }); }
const H = {
  // the Drive option only shows on devices where it was turned on with the private link (…/heist/?drive)
  enabled: () => !!C.id && (location.protocol === 'https:' || location.hostname === 'localhost') && (!!cfg().allowed || /[?&#]drive\b/.test(location.href)),
  isOn: () => H.enabled() && !!cfg().on,
  state: () => (!H.isOn() ? 'off' : C.pending ? (online() ? 'pending' : 'offline') : C.state),
  lastSync: () => cfg().last || 0,
  onChange: f => C.listeners.push(f),
  _dbg: () => ({ tok: !!C.token, ok: Date.now() < C.exp, st: C.state, err: C.err, busy: C.busy, np: C.np, pending: !!C.pending }),
};
// Google Identity Services script (loaded once, only when online)
function loadGis() {
  if (C.gis) return C.gis;
  C.gis = new Promise((res, rej) => {
    if (root.google && google.accounts && google.accounts.oauth2) return res();
    const s = document.createElement('script'); s.src = 'https://accounts.google.com/gsi/client'; s.async = true;
    s.onload = () => res(); s.onerror = () => { C.gis = null; rej(new Error('gis')); }; document.head.appendChild(s);
  });
  return C.gis;
}
function tokenClient() {
  if (C.tc || !(root.google && google.accounts && google.accounts.oauth2)) return C.tc;
  C.tc = google.accounts.oauth2.initTokenClient({
    client_id: C.id, scope: SCOPE,
    callback: r => { const w = C.wait; C.wait = null; if (r && r.access_token) { C.token = r.access_token; C.exp = Date.now() + (r.expires_in - 60) * 1000; w && w.res(C.token); } else w && w.rej(new Error((r && r.error) || 'auth')); },
    error_callback: e => { const w = C.wait; C.wait = null; w && w.rej(new Error((e && e.type) || 'auth')); },
  });
  return C.tc;
}
const tokenOK = () => C.token && Date.now() < C.exp;
// must be called from a click/tap (browsers block the sign-in popup otherwise)
function getToken(first) {
  if (tokenOK()) return Promise.resolve(C.token);
  const tc = tokenClient(); if (!tc) return Promise.reject(new Error('gis'));
  return new Promise((res, rej) => { C.wait = { res, rej }; tc.requestAccessToken({ prompt: first ? 'consent' : '' }); });
}
async function api(url, opt = {}) {
  const r = await fetch(url, Object.assign({}, opt, { headers: Object.assign({ Authorization: 'Bearer ' + C.token }, opt.headers || {}) }));
  if (r.status === 401) { C.token = null; throw new Error('401'); }
  if (!r.ok) throw new Error('http ' + r.status);
  return r;
}
async function fileId() {
  const c = cfg(); if (c.fileId) return c.fileId;
  const r = await api(`${API}?spaces=appDataFolder&q=${encodeURIComponent(`name='${NAME}'`)}&fields=files(id,modifiedTime)&orderBy=modifiedTime desc`);
  const j = await r.json(); const id = j.files && j.files[0] ? j.files[0].id : null; if (id) setCfg({ fileId: id }); return id;
}
async function upload(body) {
  let id = await fileId();
  if (id) {
    try { await api(`${UP}/${id}?uploadType=media`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body }); return; }
    catch (e) { if (!/404/.test(e.message)) throw e; setCfg({ fileId: null }); id = null; }
  }
  const b = 'heist' + Math.random().toString(36).slice(2);
  const multipart = `--${b}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify({ name: NAME, parents: ['appDataFolder'] })}\r\n--${b}\r\nContent-Type: application/json\r\n\r\n${body}\r\n--${b}--`;
  const r = await api(`${UP}?uploadType=multipart&fields=id`, { method: 'POST', headers: { 'Content-Type': 'multipart/related; boundary=' + b }, body: multipart });
  const j = await r.json(); setCfg({ fileId: j.id });
}
// send the latest pending save (only the newest one matters)
async function flush() {
  if (C.busy || !C.pending || !H.isOn()) return;
  if (!online()) { set('offline'); return; }
  if (!tokenOK()) { set('pending'); return; } // waits for the next tap to refresh sign-in
  C.busy = true; const body = C.pending;
  try {
    if (body === '__delete__') { const id = await fileId(); if (id) await api(`${API}/${id}`, { method: 'DELETE' }).catch(() => {}); setCfg({ fileId: null }); }
    else await upload(body);
    if (C.pending === body) C.pending = null; setCfg({ last: Date.now() }); set('ok');
  } catch (e) { set(online() ? 'error' : 'offline', e.message); }
  C.busy = false; if (C.pending && C.pending !== body) setTimeout(flush, 500);
}
H.push = (json) => { if (!H.isOn()) return; C.np = (C.np || 0) + 1; C.pending = json; clearTimeout(C.t); C.t = setTimeout(flush, 1500); set(H.state()); };
H.remove = () => { if (!H.isOn()) return; C.pending = '__delete__'; flush(); };
// newest save on Drive (call from a tap): returns the text or null
H.pull = async () => {
  if (!H.isOn() || !online()) return null;
  try { await loadGis(); await getToken(false); const id = await fileId(); if (!id) return null; const r = await api(`${API}/${id}?alt=media`); set('ok'); return await r.text(); }
  catch (e) { set(online() ? 'error' : 'offline', e.message); return null; }
};
H.connect = async () => {
  await loadGis(); await getToken(true); setCfg({ on: true }); set('ok'); return true;
};
H.disconnect = () => { try { if (C.token && google.accounts.oauth2.revoke) google.accounts.oauth2.revoke(C.token, () => {}); } catch (e) { } C.token = null; C.pending = null; setCfg({ on: false, fileId: null }); set('off'); };
// any tap while a save is waiting refreshes the sign-in (silently when already granted) and sends it
H.tap = () => { if (!H.isOn() || !C.pending || !online() || tokenOK() || C.wait) return; if (!tokenClient()) { loadGis().catch(() => {}); return; } getToken(false).then(flush).catch(e => set('error', e.message)); };
root.addEventListener && root.addEventListener('online', () => { if (H.isOn()) { loadGis().catch(() => {}); flush(); } });
root.addEventListener && root.addEventListener('offline', () => set(H.state()));
if (typeof document !== 'undefined') document.addEventListener('pointerdown', H.tap, true);
if (/[?&#]drive\b/.test(location.href)) setCfg({ allowed: true });
if (H.isOn() && online()) loadGis().catch(() => {});
root.HeistCloud = H;
})(typeof window !== 'undefined' ? window : globalThis);
