/* Heist — user interface: map, panels, decisions, animations, rules assistant */
(function () {
'use strict';
const E = window.HeistEngine, AI = window.HeistAI, T = window.HeistI18n, R = window.HeistRules, IC = window.HeistIcons;
E.init(window.HEIST_DATA);
const $ = (s, el) => (el || document).querySelector(s);
const $$ = (s, el) => Array.from((el || document).querySelectorAll(s));
const t = T.t, nm = T.name, ic = IC.svg;
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const COLOR = { orange: '#f08a24', purple: '#9050c8', pink: '#e85d9e', yellow: '#f2c629', green: '#3eae50' };
const LAND = { I: '#3b3f47', C: '#cdbf9d', R: '#5ea54a', W: '#2f72c6' };
const COP = { county: '#3d9be0', federal: '#d23b33', swat: '#202226' };
const SPEEDS = { slow: 1.6, normal: 1, fast: 0.45 };

// ---------------- global UI state ----------------
const G = {
  S: null, VS: null, prefs: { lang: 'en', speed: 'normal' }, tab: 'me', sel: {}, busy: false, skip: false,
  logLines: [], tip: null, viewer: null, zoom: { k: 1, x: 0, y: 0 }
};
try { Object.assign(G.prefs, JSON.parse(localStorage.getItem('heist.prefs') || '{}')); } catch (e) { }
T.set(G.prefs.lang);
document.documentElement.lang = G.prefs.lang;
const savePrefs = () => { try { localStorage.setItem('heist.prefs', JSON.stringify(G.prefs)); } catch (e) { } };
const spd = () => G.skip ? 0 : SPEEDS[G.prefs.speed] || 1;
document.documentElement.style.setProperty('--speed', SPEEDS[G.prefs.speed]);
const wait = (ms) => { const k = spd(); return k ? sleep(ms * k) : Promise.resolve(); };
function saveGame() { try { if (G.S && !G.S.over) localStorage.setItem('heist.save', JSON.stringify({ S: G.S, log: G.logLines.slice(-400) })); else localStorage.removeItem('heist.save'); } catch (e) { } }
function hasSave() { try { return !!localStorage.getItem('heist.save'); } catch (e) { return false; } }

// ---------------- names / helpers ----------------
function who(id) { const S = G.VS || G.S; if (id >= 100) return E.P(S, id); return S.players[id]; }
function pname(id) { const p = who(id); if (!p) return '?'; if (p.npc) return p.npc === 'sandra' ? t('npcSandra') : t('npcCosta'); return p.name; }
function pcolor(id) { const p = who(id); if (!p) return '#888'; if (p.npc === 'sandra') return '#c9b99a'; if (p.npc === 'costa') return '#2b3f6b'; return COLOR[p.color]; }
function locName(id) {
  const S = G.VS || G.S; const k = E.locKind(S, id); if (!k) return id;
  if (k.type === 'business') return nm(k.id); if (k.type === 'safehouse') return nm(k.id);
  if (k.type === 'exit') return nm('exit' + k.n); if (k.type === 'store') return nm(id);
  return nm(k.type);
}
function cardName(card) { return E.CONTACT[card].name; }
const narrCtx = { pname, locName, card: cardName, why: T.whyText };
function humanIds() { return G.S.players.filter(p => !p.ai).map(p => p.id); }
function viewerId() { const S = G.S; const pd = S.pending; if (pd && pd.pid < 100 && !S.players[pd.pid].ai) return pd.pid; if (G.viewer != null) return G.viewer; const h = humanIds(); return h.length ? h[0] : 0; }
function money(n) { return '$' + n + 'k'; }

// ---------------- geometry ----------------
const R0 = 100, H0 = Math.sqrt(3) / 2 * R0, VANG = [240, 300, 0, 60, 120, 180];
const rad = (d) => d * Math.PI / 180;
function cellXY(i) { const { c, r } = E.CELLS[i]; return { x: 140 + c * 1.5 * R0, y: 120 + r * 2 * H0 + (c % 2 ? H0 : 0) }; }
function vtx(k, s = 1) { const a = rad(VANG[k % 6]); return { x: Math.cos(a) * R0 * s, y: Math.sin(a) * R0 * s }; }
function hexPts(cx, cy, s = 1) { return VANG.map((a, k) => { const v = vtx(k, s); return (cx + v.x).toFixed(1) + ',' + (cy + v.y).toFixed(1); }).join(' '); }
function halfEdge(e, h) { const a = vtx(e), b = vtx(e + 1); const p0 = { x: a.x + (b.x - a.x) * h * 0.5, y: a.y + (b.y - a.y) * h * 0.5 }; const p1 = { x: a.x + (b.x - a.x) * (h + 1) * 0.5, y: a.y + (b.y - a.y) * (h + 1) * 0.5 }; return [p0, p1]; }
// Tile geometry comes from the traced photos: land shapes, location positions and side segments (data/tiles.json)
function rotP(p, rot) { const a = rad(rot * 60), c = Math.cos(a), s = Math.sin(a); return { x: p[0] * c - p[1] * s, y: p[0] * s + p[1] * c }; }
function sidePt(e, f) { const a = vtx(e), b = vtx(e + 1); return { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f }; }
function polyCentroid(P) { let A = 0, x = 0, y = 0; for (let i = 0; i < P.length; i++) { const [x0, y0] = P[i], [x1, y1] = P[(i + 1) % P.length]; const k = x0 * y1 - x1 * y0; A += k; x += (x0 + x1) * k; y += (y0 + y1) * k; } if (Math.abs(A) < 1e-6) return [P[0][0], P[0][1]]; return [x / (3 * A), y / (3 * A)]; }
const geoCache = {};
function tileGeo(tile, rot) {
  const key = tile + rot; if (geoCache[key]) return geoCache[key];
  const TL = E.TILE[tile]; const zones = {}, locs = {};
  Object.entries(TL.shapes).forEach(([a, P]) => { zones[a] = rotP(polyCentroid(P), rot); });
  TL.areas.forEach(a => { if (!zones[a]) zones[a] = { x: 0, y: 0 }; });
  // hex-shaped spaces that reach the tile edge: put one facet exactly on that edge (and keep every space inside the tile)
  const LOCR = { business: 33, safehouse: 33, gang: 33 };
  TL.locs.forEach(l => {
    let p = l.pos.slice(); const r = LOCR[l.type];
    if (r) {
      const a = r * Math.sqrt(3) / 2, Ah = H0; const touch = []; TL.sides.forEach((sd, e) => { if (sd.some(([x]) => x === '@' + l.id)) touch.push(e); });
      const N = e => { const g = rad(VANG[e] + 30); return [Math.cos(g), Math.sin(g)]; };
      for (let it = 0; it < 20; it++) for (let e = 0; e < 6; e++) { const [nx, ny] = N(e); const d = p[0] * nx + p[1] * ny; const want = Ah - a; if (touch.includes(e) ? Math.abs(d - want) > 0.01 : d > want) { p[0] += (want - d) * nx; p[1] += (want - d) * ny; } }
    }
    locs[l.id] = rotP(p, rot);
  });
  // police: a row of 3 in the free part of the tile, away from the locations
  let best = null, bs = -1;
  for (let k = 0; k < 24; k++) for (const r of [0.6, 0.45]) {
    const ang = rad(k * 15), cx = Math.cos(ang) * R0 * r, cy = Math.sin(ang) * R0 * r; const tx = -Math.sin(ang), ty = Math.cos(ang);
    const pts = [-1, 0, 1].map(d => ({ x: cx + tx * d * 27, y: cy + ty * d * 27 }));
    const inside = pts.every(p => Math.hypot(p.x, p.y) < R0 * 0.74);
    if (!inside) continue;
    const sc = Math.min(...pts.map(p => Math.min(...Object.values(locs).map(q => Math.hypot(p.x - q.x, p.y - q.y)), 999))) + (k === 18 ? 4 : 0);
    if (sc > bs) { bs = sc; best = pts; }
  }
  const cops = { county: best[0], federal: best[1], swat: best[2] };
  return (geoCache[key] = { zones, locs, cops });
}
function locXY(S, locId) { const ci = E.locCell(S, locId); if (ci < 0) return null; const c = S.cells[ci]; const g = tileGeo(c.tile, c.rot); const o = cellXY(ci); const p = g.locs[locId]; return { x: o.x + p.x, y: o.y + p.y }; }
// Drawn route: locations, tile-edge crossings (on the half-edge where the land type continues) and zone centres only where the land type changes inside a tile
function routePts(S, path) {
  const isZ = n => n.indexOf(':') >= 0 && !/^[~^%]/.test(n);
  const cellOf = n => +n.split(':')[0];
  const cross = (a, b) => {
    const i = cellOf(a), j = cellOf(b), A = a.split(':')[1], B = b.split(':')[1]; const c = S.cells[i], o = S.cells[j]; if (!c || !o) return null;
    for (let e = 0; e < 6; e++) {
      if (E.nb(i, e) !== j) continue;
      const ks = E.contacts(c.tile, c.rot, e, o.tile, o.rot).filter(k => k.a === A && k.b === B); if (!ks.length) return null;
      const k = ks.reduce((m, x) => x.len > m.len ? x : m); const p = sidePt(e, (k.s0 + k.s1) / 2); const O = cellXY(i); return { x: O.x + p.x, y: O.y + p.y };
    }
    return null;
  };
  const out = [];
  path.forEach((n, k) => {
    const prev = path[k - 1], next = path[k + 1];
    if (prev && isZ(prev) && isZ(n) && cellOf(prev) !== cellOf(n)) { const c = cross(prev, n); if (c) out.push(c); }
    if (!isZ(n)) { const p = nodeXY(S, n); if (p) out.push(Object.assign({ node: n, jump: /^[~^%]/.test(n) }, p)); return; }
    const inCell = x => x && isZ(x) && cellOf(x) === cellOf(n);
    const viaEdge = x => x && isZ(x) && cellOf(x) !== cellOf(n);
    const keep = inCell(prev) || inCell(next) || !(viaEdge(prev) || viaEdge(next));
    if (keep) { const p = nodeXY(S, n); if (p) out.push(Object.assign({ node: n }, p)); }
  });
  return out;
}
function routeLen(pts) { let d = 0; for (let i = 1; i < pts.length; i++) d += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y); return d; }
function bestPath(S, path, alts) { if (!alts || !alts.length) return path; let best = path, bl = routeLen(routePts(S, path)); alts.forEach(a => { const l = routeLen(routePts(S, a)); if (l < bl - 1) { bl = l; best = a; } }); return best; }
function nodeXY(S, node) {
  if (!node) return null; const n = node.replace(/^[~^%]/, '');
  if (n.indexOf(':') >= 0) { const [ci, Tt] = n.split(':'); const c = S.cells[+ci]; if (!c) return null; const g = tileGeo(c.tile, c.rot); const o = cellXY(+ci); const z = g.zones[Tt] || { x: 0, y: 0 }; return { x: o.x + z.x, y: o.y + z.y }; }
  return locXY(S, n);
}
function posXY(S, pos) { return nodeXY(S, pos); }
const COPPOS = { county: -30, federal: 0, swat: 30 };
function copXY(ci, type) { const o = cellXY(ci); const S = G.VS || G.S; const c = S && S.cells[ci]; const p = c ? tileGeo(c.tile, c.rot).cops[type] : { x: COPPOS[type], y: -R0 * 0.7 }; return { x: o.x + p.x, y: o.y + p.y }; }

// ---------------- map rendering ----------------
function svgDefs() {
  return `<defs>
  <pattern id="pI" width="22" height="22" patternUnits="userSpaceOnUse"><rect width="22" height="22" fill="${LAND.I}"/><path d="M0 11h22M11 0v22" stroke="#545966" stroke-width="1.6"/><rect x="3" y="3" width="5" height="5" fill="#33363d"/><rect x="14" y="14" width="5" height="5" fill="#33363d"/></pattern>
  <pattern id="pC" width="26" height="26" patternUnits="userSpaceOnUse"><rect width="26" height="26" fill="${LAND.C}"/><path d="M0 13h26M13 0v26M0 0l26 26" stroke="#a9a08a" stroke-width="1.2" opacity=".8"/></pattern>
  <pattern id="pR" width="24" height="24" patternUnits="userSpaceOnUse"><rect width="24" height="24" fill="${LAND.R}"/><circle cx="6" cy="7" r="3.2" fill="#3f8a33"/><circle cx="17" cy="16" r="3.8" fill="#3f8a33"/><path d="M0 20q12-6 24 0" stroke="#a6d65f" stroke-width="1.2" fill="none" opacity=".7"/></pattern>
  <pattern id="pW" width="30" height="16" patternUnits="userSpaceOnUse"><rect width="30" height="16" fill="${LAND.W}"/><path d="M0 9q7.5-5 15 0t15 0" stroke="#5a97e0" stroke-width="1.4" fill="none"/></pattern>
  <filter id="sh" x="-30%" y="-30%" width="160%" height="160%"><feDropShadow dx="0" dy="3" stdDeviation="3" flood-opacity=".55"/></filter>
  <radialGradient id="vig"><stop offset="60%" stop-color="#000" stop-opacity="0"/><stop offset="100%" stop-color="#000" stop-opacity=".35"/></radialGradient>
  </defs>`;
}
function tileSVG(tile, rot, cx, cy, opts = {}) {
  const g = tileGeo(tile, rot); const TL = E.TILE[tile];
  let s = `<g ${opts.id ? `id="${opts.id}"` : ''} class="${opts.cls || ''}" transform="translate(${cx},${cy})">`;
  s += `<clipPath id="clip-${opts.id || tile + rot}"><polygon points="${hexPts(0, 0, 0.985)}"/></clipPath><g clip-path="url(#clip-${opts.id || tile + rot})">`;
  s += `<g transform="rotate(${rot * 60})">`;
  Object.entries(TL.shapes).forEach(([a, P]) => { const T = E.landOf(a); s += `<polygon points="${P.map(q => q.join(',')).join(' ')}" fill="url(#p${T})" stroke="${LAND[T]}" stroke-width="1.2" stroke-linejoin="round"/>`; });
  s += `</g>`;
  // soften center
  s += `<circle r="${R0 * 0.16}" fill="url(#vig)" opacity=".0"/>`;
  s += `</g><polygon points="${hexPts(0, 0)}" class="tile-edge"/>`;
  if (TL.helipad) VANG.forEach((a, k) => { const v = vtx(k, 0.8); s += `<g transform="translate(${v.x},${v.y})"><circle r="8" fill="#fff" stroke="${'#d23b33'}" stroke-width="2"/><text y="3.5" text-anchor="middle" font-size="10" font-weight="700" fill="#d23b33" font-family="Arial">H</text></g>`; });
  if (TL.ferry) {
    // F markers on the water stretches of the border, joined by a dashed ferry route
    const pts = []; for (let e = 0; e < 6; e++) E.segs(tile, rot, e).forEach(g => { if (g.a[0] === 'W' && g.s1 - g.s0 > 0.25) { const p = sidePt(e, (g.s0 + g.s1) / 2); pts.push({ x: p.x * 0.86, y: p.y * 0.86 }); } });
    const use = pts.slice(0, 3);
    for (let k = 1; k < use.length; k++) s += `<path d="M${use[k - 1].x.toFixed(1)},${use[k - 1].y.toFixed(1)} Q0,0 ${use[k].x.toFixed(1)},${use[k].y.toFixed(1)}" fill="none" stroke="#fff" stroke-width="2.5" stroke-dasharray="6 6" opacity=".6"/>`;
    use.forEach(p => { s += `<g transform="translate(${p.x.toFixed(1)},${p.y.toFixed(1)})"><circle r="10" fill="#fff" stroke="#2f72c6" stroke-width="2.5"/><text y="4.5" text-anchor="middle" font-size="12" font-weight="700" fill="#2f72c6" font-family="Arial">F</text></g>`; });
  }
  s += '</g>';
  return s;
}
// MP labels of destinations: below the location by default, otherwise wherever they don't cover another location or label
function placeLabels(labels, locs, cops = []) {
  const W = 68, Hh = 20, placed = []; let out = '';
  const hit = (a, b) => Math.abs(a.x - b.x) < (a.w + b.w) / 2 + 2 && Math.abs(a.y - b.y) < (a.h + b.h) / 2 + 2;
  labels.forEach(L => {
    const cands = [[0, L.r + 16], [0, -(L.r + 16)], [L.r + 38, 0], [-(L.r + 38), 0], [L.r + 30, L.r + 10], [-(L.r + 30), L.r + 10], [L.r + 30, -(L.r + 10)], [-(L.r + 30), -(L.r + 10)]];
    let best = null, bs = Infinity;
    cands.forEach(([dx, dy], k) => {
      const box = { x: L.x + dx, y: L.y + dy, w: W, h: Hh }; let sc = k * 0.5;
      locs.forEach(o => { if (Math.abs(o.x - L.x) < 1 && Math.abs(o.y - L.y) < 1) return; if (hit(box, { x: o.x, y: o.y, w: 58, h: 58 })) sc += 10; });
      placed.forEach(b => { if (hit(box, b)) sc += 8; }); cops.forEach(c => { if (hit(box, { x: c.x, y: c.y, w: 30, h: 30 })) sc += 6; });
      if (sc < bs) { bs = sc; best = box; }
    });
    placed.push(best);
    out += `<g class="loclabel" data-loc="${L.id}" data-h="loc:${L.id}" transform="translate(${best.x.toFixed(1)},${best.y.toFixed(1)})">${L.html}</g>`;
  });
  return out;
}
function locSVG(S, l, x, y, view) {
  const id = l.id; const k = E.locKind(S, id); let body = '', r = 27;
  const dest = view.dests && view.dests[id]; const esc = dest && dest.some(p => p.escape);
  const cls = `loc ${dest ? 'dest' : ''} ${esc ? 'esc' : ''} ${G.sel.dest === id ? 'sel' : ''}`;
  const icn = (name, col, size = 26) => `<g transform="translate(${-size / 2},${-size / 2}) scale(${size / 24})" fill="${col}" color="${col}">${IC.raw(name)}</g>`;
  if (k.type === 'business') {
    const b = k.id; const grp = ['casino', 'bar', 'restaurant'].includes(b) ? '#9050c8' : '#2f62c0'; const closed = S.closed[b];
    body = `<polygon class="ring" points="${hexPts(0, 0, 0.33)}" fill="${closed ? '#555' : '#fbf6ea'}" stroke="${grp}" stroke-width="4"/>` + icn(IC.BIZ[b] || 'info', closed ? '#ccc' : '#d23b33', 26);
    if (closed) body += `<g transform="translate(12,-20)">${icn('lock', '#f2c629', 16)}</g>`;
    const cubes = S.bizCubes[b] || []; cubes.forEach((c, i) => body += `<rect x="${-16 + i * 11}" y="22" width="9" height="9" rx="2" fill="${pcolor(c.pid)}" stroke="#000" stroke-width="1"/>`);
  } else if (k.type === 'safehouse') {
    const sh = k.id; const keys = S.shKeys[sh] || [];
    body = `<polygon class="ring" points="${hexPts(0, 0, 0.33)}" fill="#d63a33" stroke="#7c1712" stroke-width="3"/><g transform="translate(0,${keys.length ? 5 : 0})">${icn('house', '#fff', keys.length ? 18 : 22)}</g><text x="${keys.length ? 11 : 13}" y="${keys.length ? 0 : -9}" font-family="Barlow Condensed,Arial" font-weight="700" font-size="16" fill="#fff">${sh.slice(2)}</text>`;
    keys.forEach((c, i) => body += `<g transform="translate(${(i - (keys.length - 1) / 2) * 15},-14)"><circle r="7" fill="#fff"/><g transform="translate(-6,-6) scale(.5)" fill="${{ green: '#2f9e41', black: '#111', brown: '#8a4a1c' }[c]}" color="${{ green: '#2f9e41', black: '#111', brown: '#8a4a1c' }[c]}">${IC.raw('key')}</g></g>`);
    (S.shCubes[sh] || []).forEach((c, i) => body += `<rect x="${-16 + i * 11}" y="22" width="9" height="9" rx="2" fill="${pcolor(c.pid)}" stroke="#000" stroke-width="1"/>`);
  } else if (k.type === 'exit') {
    const n = k.n; const closed = S.patrolSpaces[n] >= 2;
    body = `<rect class="ring" x="-25" y="-25" width="50" height="50" rx="3" fill="${closed ? '#b8a64a' : '#f6d64a'}" stroke="#7a6a14" stroke-width="2" transform="rotate(-4)"/><text y="-4" text-anchor="middle" font-family="Special Elite,Courier New" font-size="12" fill="#2a2205">EXIT</text><text y="17" text-anchor="middle" font-family="Special Elite,Courier New" font-size="22" fill="#2a2205">${n}</text>`;
    if (closed) body += `<path d="M-20,-20L20,20M20,-20L-20,20" stroke="#d23b33" stroke-width="5" opacity=".85"/>`;
    if (S.day === 3 && !closed) body += `<circle r="32" fill="none" stroke="#fff" stroke-width="3" stroke-dasharray="5 5"/>`;
  } else if (k.type === 'store') {
    body = `<circle class="ring" r="${r}" fill="#dff1fb" stroke="#3d9be0" stroke-width="4"/>` + icn('cart', '#1f6aa5', 24) + `<text x="15" y="-12" font-family="Barlow Condensed,Arial" font-weight="700" font-size="17" fill="#1f6aa5">${id.slice(5)}</text>`;
  } else if (k.type === 'hospital') { r = 32; body = `<circle class="ring" r="${r}" fill="#fff" stroke="#d23b33" stroke-width="4"/>` + icn('cross', '#d23b33', 30); }
  else if (k.type === 'clinic') body = `<circle class="ring" r="${r}" fill="#fff" stroke="#e46a62" stroke-width="4"/>` + icn('medic', '#d23b33', 24);
  else if (k.type === 'church') body = `<circle class="ring" r="${r}" fill="#efe3d0" stroke="#7a5a3a" stroke-width="4"/>` + icn('church', '#5a3a1e', 26);
  else if (k.type === 'subway') body = `<circle class="ring" r="${r}" fill="#f28a2e" stroke="#9a4a0a" stroke-width="4"/>` + icn('train', '#fff', 24);
  else if (k.type === 'heliport') body = `<circle class="ring" r="${r}" fill="#cfe7f5" stroke="#2f72c6" stroke-width="4"/>` + icn('heli', '#1d3f6e', 26);
  else if (k.type === 'gang') {
    const gg = S.gangs[id]; const ctrl = gg && gg.ctrl != null;
    body = `<polygon class="ring" points="${hexPts(0, 0, 0.33)}" fill="#e2c98f" stroke="${ctrl ? pcolor(gg.ctrl) : '#8a6a2a'}" stroke-width="${ctrl ? 5 : 3}"/>` + `<g transform="translate(0,-5)">${icn('skull', '#3a2a12', 22)}</g>`;
    if (gg) for (let i = 0; i < gg.members; i++) body += `<g transform="translate(${-9 + i * 18},14)">${icn('biker', '#2a2a2a', 13)}</g>`;
  }
  let label = '';
  if (dest) { const best = dest[0]; label = `<g><rect x="-34" y="-11" width="68" height="20" rx="10" fill="${esc ? '#e8b546' : '#111c'}" stroke="#fff3"/><text y="4" text-anchor="middle" font-family="Barlow Condensed,Arial" font-size="13" fill="${esc ? '#221a05' : '#fff'}">${best.mp}${t('mp')}${best.police ? ' · ' + best.police + '⚑' : ''}</text></g>`; }
  if (label && view._labels) view._labels.push({ id, x, y, r, html: label });
  return `<g class="${cls}" data-loc="${id}" data-h="loc:${id}" transform="translate(${x.toFixed(1)},${y.toFixed(1)})" filter="url(#sh)">${dest ? `<circle class="halo" r="30"/>` : ''}${body}</g>`;
}
function copSVG(ci, type, cls = '', pickable = false) {
  const p = copXY(ci, type);
  return `<g id="cop-${ci}-${type}" class="cop ${cls}" data-cop="${ci}:${type}" data-h="cop:${type}" transform="translate(${p.x},${p.y})"><g class="copin ${pickable ? 'pick' : ''}"><circle r="15" fill="#0007"/><g transform="translate(-13,-14) scale(1.08)" fill="${COP[type]}" stroke="#fff" stroke-width="1.2">${IC.raw('shield')}</g></g></g>`;
}
function pawnSVG(S, q, x, y) {
  const col = pcolor(q.id); const npc = q.npc;
  const glyph = npc ? IC.raw('cop') : IC.raw('pawn');
  return `<g id="pawn-${q.id}" class="pawn" data-h="pawn:${q.id}" transform="translate(${x.toFixed(1)},${y.toFixed(1)})"><g transform="translate(-14,-30) scale(1.17)" fill="${col}" stroke="${npc === 'costa' ? '#cfd8ea' : '#000'}" stroke-width="1.1">${glyph}</g>${npc === 'sandra' ? `<circle cx="0" cy="-12" r="3" fill="#f2c629"/>` : ''}</g>`;
}
function pawnSpots(S) {
  const groups = {}; const all = S.players.concat(S.npcs || []);
  all.forEach(q => { if (q.escaped || q.arrested) return; (groups[q.loc] = groups[q.loc] || []).push(q); });
  const out = {};
  for (const loc in groups) {
    const base = posXY(S, loc); if (!base) continue; const arr = groups[loc];
    arr.forEach((q, i) => { const off = (i - (arr.length - 1) / 2) * 20; out[q.id] = { x: base.x + off, y: base.y + 34 + Math.abs(off) * 0.25 }; });
  }
  return out;
}
function renderMap(view) {
  const S = G.VS; const svg = $('#map'); if (!svg) return;
  view = view || mapView();
  let s = svgDefs() + `<g id="world" transform="translate(${G.zoom.x},${G.zoom.y}) scale(${G.zoom.k})">`;
  // empty slots
  E.CELLS.forEach((c, i) => { if (S.cells[i]) return; const o = cellXY(i); const legal = view.legalCells && view.legalCells.has(i); s += `<polygon class="cell-slot ${legal ? 'legal' : ''}" data-cell="${i}" points="${hexPts(o.x, o.y, 0.96)}"/>`; });
  // tiles
  S.cells.forEach((c, i) => { if (!c) return; const o = cellXY(i); s += tileSVG(c.tile, c.rot, o.x, o.y, { id: 'tile-' + i, cls: G.dropCell === i ? 'dropin' : '' }); });
  // ghost placement
  if (view.ghost) { const o = cellXY(view.ghost.cell); const gd = (G.S.display || []).find(x => x.tile === view.ghost.tile); s += `<g opacity=".85">${tileSVG(view.ghost.tile, view.ghost.rot, o.x, o.y, { id: 'ghost' })}${gd ? E.PTYPES.filter(ty => gd.police[ty]).map(ty => copSVG(view.ghost.cell, ty)).join('') : ''}</g><polygon points="${hexPts(o.x, o.y)}" fill="none" stroke="#e8b546" stroke-width="5"/>`; }
  // dest cells (police move)
  if (view.cellDests) view.cellDests.forEach(i => { const o = cellXY(i); s += `<polygon class="cell-dest" data-celldest="${i}" points="${hexPts(o.x, o.y, 0.92)}"/>`; });
  // path preview
  let badges = '';
  if (view.path) {
    const pts = routePts(S, view.path); if (pts.length > 1) s += `<polyline class="path-prev" points="${pts.map(p => p.x.toFixed(1) + ',' + p.y.toFixed(1)).join(' ')}"/>`;
    // MP badges: one numbered marker on every step that costs a movement point
    const isZ = n => n.indexOf(':') >= 0 && !/^[~^%]/.test(n); let mp = 0; badges = '';
    for (let i = 1; i < view.path.length; i++) {
      const a = view.path[i - 1], b = view.path[i]; let cost = 0;
      if (/^\^/.test(b)) cost = 1; else if (/^[~%]/.test(b)) cost = 0;
      else if (isZ(a) && isZ(b)) cost = a.split(':')[1][0] !== b.split(':')[1][0] ? 1 : 0;
      else cost = 1;
      if (!cost) continue; mp += cost;
      // place the badge on the drawn route: between the route point of a and the next drawn point
      const seg = routePts(S, view.path.slice(0, i + 1)); const tail = seg.slice(-2); if (tail.length < 2) continue;
      const P0 = tail[0], P1 = tail[1]; const L = Math.hypot(P1.x - P0.x, P1.y - P0.y) || 1; const ux = (P1.x - P0.x) / L, uy = (P1.y - P0.y) / L; const off = Math.min(42, L / 2);
      let x, y; if (!isZ(a) && isZ(b)) { x = P0.x + ux * off; y = P0.y + uy * off; } else if (isZ(a) && !isZ(b)) { x = P1.x - ux * off; y = P1.y - uy * off; } else { x = (P0.x + P1.x) / 2; y = (P0.y + P1.y) / 2; }
      badges += `<g class="mpb" transform="translate(${x.toFixed(1)},${y.toFixed(1)})"><circle r="11"/><text y="4.5">${mp}</text></g>`;
    }
  }
  // locations
  view._labels = []; const allLocs = [];
  // locations are clipped to their own tile: spaces that reach the edge sit flush against it, like on the real tiles
  S.cells.forEach((c, i) => { if (!c) return; const o = cellXY(i); const g = tileGeo(c.tile, c.rot); E.TILE[c.tile].locs.forEach(l => { const p = g.locs[l.id]; allLocs.push({ x: o.x + p.x, y: o.y + p.y }); s += locSVG(S, l, o.x + p.x, o.y + p.y, view); }); });
  const copsAt = []; S.cells.forEach((c, i) => { if (c) E.PTYPES.forEach(ty => { if (c.police[ty]) copsAt.push(copXY(i, ty)); }); });
  const labelsSVG = placeLabels(view._labels, allLocs, copsAt);
  // police
  S.cells.forEach((c, i) => { if (!c) return; E.PTYPES.forEach(ty => { if (c.police[ty]) s += copSVG(i, ty, '', view.pickCops && view.pickCops.has(i + ':' + ty)); }); });
  // pawns
  const spots = pawnSpots(S); S.players.concat(S.npcs || []).forEach(q => { const p = spots[q.id]; if (p) s += pawnSVG(S, q, p.x, p.y); });
  s += labelsSVG + badges + '</g>';
  svg.innerHTML = s;
  fitMap();
}
function fitMap() {
  const svg = $('#map'); if (!svg) return; const S = G.VS || G.S;
  const placing = G.S && G.S.pending && G.S.pending.type === 'place' && isHuman(G.S.pending.pid);
  const set = new Set(); S.cells.forEach((c, i) => { if (!c) return; set.add(i); if (placing) for (let e = 0; e < 6; e++) { const j = E.nb(i, e); if (j >= 0) set.add(j); } });
  if (!set.size) E.CELLS.forEach((c, i) => set.add(i));
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9; set.forEach(i => { const o = cellXY(i); x0 = Math.min(x0, o.x - R0); x1 = Math.max(x1, o.x + R0); y0 = Math.min(y0, o.y - H0); y1 = Math.max(y1, o.y + H0); });
  const pad = placing ? 14 : 40; const key = [x0, y0, x1, y1].map(Math.round).join(',');
  if (G.vbKey !== key) { svg.setAttribute('viewBox', `${x0 - pad} ${y0 - pad} ${x1 - x0 + 2 * pad} ${y1 - y0 + 2 * pad}`); G.vbKey = key; }
  G.fitted = true;
}
function mapView() {
  const S = G.S, pd = S.pending, v = {};
  if (!pd || G.busy || !isHuman(pd.pid)) return v;
  if (pd.type === 'action') { v.dests = pd.moves; if (G.sel.dest && pd.moves[G.sel.dest]) { const pl = pd.moves[G.sel.dest][G.sel.plan || 0]; v.path = bestPath(G.S, pl.path, pl.alts); } }
  if (pd.type === 'place' && G.sel.tile) { v.legalCells = new Set(E.legalPlacements(S, G.sel.tile).map(x => x.cell)); if (G.sel.cell != null) v.ghost = { tile: G.sel.tile, cell: G.sel.cell, rot: G.sel.rot }; }
  if (pd.type === 'policeMove') { if (G.sel.from == null) v.pickCops = new Set(pd.opts.map(o => o.from + ':' + o.type)); else v.cellDests = [...new Set(pd.opts.filter(o => o.from === G.sel.from && o.type === G.sel.ptype).map(o => o.to))]; }
  if (G.sel.execCop) { const x = G.sel.execCop; if (G.sel.from == null) { v.pickCops = new Set(); S.cells.forEach((c, i) => { if (c && c.police[x.type]) v.pickCops.add(i + ':' + x.type); }); } else if (x.eff === 'move_police') { const h = E.locCell(S, 'hospital'); v.cellDests = S.cells.map((c, i) => (c && !c.police[x.type] && i !== h && i !== G.sel.from) ? i : -1).filter(i => i >= 0); } }
  return v;
}
function isHuman(pid) { return pid < 100 && !G.S.players[pid].ai; }

// ---------------- top bar ----------------
function renderTop() {
  const S = G.VS; const el = $('#top'); if (!el) return;
  const parts = t('parts');
  const tl = [0, 1, 2, 3, 4].map(i => `<div class="tl ${S.part === i ? 'on' : ''} ${i < S.part ? 'past' : ''} ${i >= 3 ? 'opt' : ''}" data-h="part:${i}">${ic(i === 0 ? 'sun' : i === 3 || i === 4 ? 'moon' : i === 2 ? 'sun' : 'sun', '', i >= 3 ? '#9fb3d9' : undefined)}</div>`).join('');
  const lastOpen = S.day === 3 || (S.day === 2 && S.patrol.length <= 1);
  const exits = [1, 2, 3].map(n => { const c = S.patrolSpaces[n]; const closed = c >= 2; return `<div class="exitb ${closed ? 'closed' : ''} ${S.day === 3 && !closed ? 'last' : ''}" data-h="exit:${n}"><span class="xl">EXIT </span>${n}<span class="pc"><i class="${c >= 1 ? 'on' : ''}"></i><i class="${c >= 2 ? 'on' : ''}"></i></span></div>`; }).join('');
  el.innerHTML = `<button class="tbtn" id="sideToggle">${ic('menu')}</button><div class="daybox">${t('day')} ${S.day}</div><div class="timeline">${tl}</div><div class="daybox ph" style="font-size:15px;color:var(--mustard)">${S.uiPhase ? t('phases.' + S.uiPhase) : (parts[S.part] || '')}</div><div class="topord" data-h="ui:order">${S.order.map(id => { const q = E.P(S, id); return `<i class="${S.pending && S.pending.pid === id ? 'cur' : ''}" style="background:${pcolor(id)};${q && (q.escaped || q.arrested) ? 'opacity:.3' : ''}"></i>`; }).join('')}</div><div class="exits">${exits}</div>
  <button class="tbtn" id="bRules" data-h="ui:rules">${ic('book')}</button><button class="tbtn" id="bLang">${G.prefs.lang.toUpperCase()}</button><button class="tbtn" id="bSpeed" data-h="ui:speed">${ic("ff")}<span> ${t(G.prefs.speed)}</span></button><button class="tbtn" id="bMenu">${ic('menu')}</button>`;
  $('#bRules').onclick = () => openRules();
  $('#bLang').onclick = () => { G.prefs.lang = G.prefs.lang === 'en' ? 'pt' : 'en'; T.set(G.prefs.lang); savePrefs(); renderAll(); };
  $('#bSpeed').onclick = () => { const o = ['slow', 'normal', 'fast']; G.prefs.speed = o[(o.indexOf(G.prefs.speed) + 1) % 3]; document.documentElement.style.setProperty('--speed', SPEEDS[G.prefs.speed]); savePrefs(); renderTop(); };
  $('#bMenu').onclick = () => { if (confirm(t('confirmQuit'))) { saveGame(); showMenu(); } };
  $('#sideToggle').onclick = () => $('#side').classList.toggle('open');
}

// ---------------- side panel ----------------
function slotHTML(p, x, i, kind, viewer) {
  if (kind === 'contacts' && i >= 5 - p.cuffs && (!x || x.kind !== 'contact')) return `<div class="slot cuffed"></div>`;
  if (!x) return `<div class="slot"></div>`;
  const cuffed = kind === 'contacts' && i >= 5 - p.cuffs ? 'cuffed' : '';
  if (x.kind === 'asset') return `<div class="slot asset ${x.locked ? 'locked' : ''} ${cuffed}" data-h="asset:${x.id}">${ic(IC.ASSET[x.id], '', x.id === 'move_county' ? COP.county : x.id === 'move_federal' ? COP.federal : x.id === 'move_swat' ? '#bbb' : undefined)}<span class="lbl">${ic('lock')}</span></div>`;
  if (x.kind === 'equip') return `<div class="slot equip ${x.used ? 'used' : ''}" data-h="equip:${x.id}"><span class="cost">$${E.EQUIP[x.id].cost}</span>${ic(IC.EQUIP[x.id])}<span class="lbl">${nm(x.id)}</span></div>`;
  if (x.kind === 'fixer') return `<div class="slot fixer ${x.used ? 'used' : ''}" data-h="fixer:${x.id}">${ic(IC.FIX[x.id])}<span class="lbl">${nm(x.id)}</span></div>`;
  if (x.kind === 'locker' || x.kind === 'exit') { const show = viewer === p.id; return `<div class="slot bag" data-h="bag:${x.kind}">${ic('bag', '', '#9be08f')}<span class="lbl">${show ? '$' + x.val + 'k' : '?'}</span></div>`; }
  if (x.kind === 'contact') { const C = E.CONTACT[x.card]; return `<div class="slot contact ${x.used ? 'used' : ''} ${cuffed}" data-h="contact:${x.card}"><span class="cost">$${C.cost}</span>${C.notoriety ? ic('star', 'star') : ''}<span class="sart">${effArt(C.effect, C.type, C.types)}</span><span class="lbl">${C.name}</span><span class="sstep">${C.step.includes('travel') ? ic('pawn', '', '#2d7a2a') : ''}${C.step.includes('avoid') ? ic('shield', '', '#a33') : ''}</span></div>`; }
  return `<div class="slot"></div>`;
}
function notorBoxHTML(S, p) {
  const cube = c => `<span class="ncube ${c}"></span>`;
  const free = 4 - p.red - p.blue;
  const net = p.red - p.blue; const max = S.cfg.max;
  let after = Math.max(1, p.notor + net); const excess = Math.max(0, after - max); after = Math.min(after, max);
  const crossed = net > 0 ? S.cfg.th.filter(x => x > p.notor && x <= after).length : 0;
  let proj = `${ic('star')} ${p.notor} <span class="arr">→</span> <b class="${net > 0 ? 'up' : net < 0 ? 'dn' : ''}">${after}</b>`;
  const notes = [];
  if (!net && (p.red || p.blue)) notes.push(t('nbCancel'));
  if (crossed) notes.push(t('nbLine', crossed));
  if (excess) notes.push(t('nbWound', excess));
  if (p.notor + net < 1) notes.push(t('nbFloor'));
  if (!free) notes.push(t('nbFull'));
  return `<div class="nbox" id="nb-${p.id}" data-h="ui:nbox"><div class="nb red">${ic('starPlus', '', '#ff6b5e')}<div class="nc">${Array.from({ length: p.red }, () => cube('r')).join('')}</div></div><div class="nb pool"><div class="nc">${Array.from({ length: free }, () => cube('k')).join('')}</div></div><div class="nb blue">${ic('starMinus', '', '#6fb0ff')}<div class="nc">${Array.from({ length: p.blue }, () => cube('b')).join('')}</div></div><div class="nproj">${proj}${notes.length ? `<small>${notes.join(' · ')}</small>` : ''}</div></div>`;
}
function playerCard(S, p, full, viewer) {
  const col = pcolor(p.id); const cur = S.pending && S.pending.pid === p.id;
  const showMoney = viewer === p.id || !humanIds().length;
  const exp = viewer !== p.id && !p.npc;
  const cubes = (n, cls) => Array.from({ length: n }, () => `<span class="cube ${cls}"></span>`).join('');
  let h = `<div class="pcard ${cur ? 'cur' : ''}" style="--c:${col}" id="pc-${p.id}"><h3 ${exp ? `data-exp="${p.id}" style="cursor:pointer"` : ''}>${exp ? `<span class="expi">${full ? '▾' : '▸'}</span>` : ''}<span class="dot" style="background:${col}"></span>${pname(p.id)}${p.ai ? ` <small style="color:var(--muted);font-size:12px">${t('bot')}</small>` : ''}<span class="tagx">${p.escaped ? '🚗 ' + t('escaped') : p.arrested ? '🚨 ' + t('arrested') : locName(p.loc)}</span></h3>`;
  if (p.npc) {
    h += `<div class="stats"><span class="stat not" data-h="stat:notor">${ic('star')} ${p.notor}${p.red || p.blue ? ` <small>${p.red ? '▲' + p.red : ''}${p.blue ? '▼' + p.blue : ''}</small>` : ''}</span><span class="stat" data-h="stat:discs">${ic('disc')} ${p.discs}</span>${p.npc === 'costa' ? `<span class="stat">${ic('card')} ${p.contacts.length}</span><span class="stat">${ic('bag')} ${p.stacks.length}</span>${p.debt ? `<span class="stat money">−$${p.debt}k</span>` : ''}` : ''}</div>${p.escaped || p.arrested ? '' : `<div class="rowlbl">${t('nbTitle')}</div>` + notorBoxHTML(S, p)}</div>`;
    return h;
  }
  h += `<div class="stats"><span class="stat money" data-h="stat:money">${ic('money')} ${showMoney ? money(p.money) : '$??'}</span><span class="stat inc" data-h="stat:income">↻ ${p.income}</span><span class="stat not" data-h="stat:notor">${ic('star')} ${p.notor}${p.red || p.blue ? ` <small>${p.red ? '▲' + p.red : ''}${p.blue ? '▼' + p.blue : ''}</small>` : ''}</span><span class="stat" data-h="stat:wounds"><span class="cubes">${cubes(3 - p.wounds, '')}${cubes(p.wounds, 'r')}</span></span></div>`;
  if (!full) {
    const cc = p.contacts.filter(c => c && c.kind === 'contact').length; const eq = p.items.filter(x => x && (x.kind === 'equip' || x.kind === 'fixer')).length; const bags = p.items.filter(x => x && (x.kind === 'locker' || x.kind === 'exit')).length;
    const keyC = { green: '#3eae50', black: '#aaa', brown: '#c07a3a' };
    const keys = ['sh1', 'sh2', 'sh3'].filter(k => p.keys[k]).map(k => ic('key', '', keyC[p.keys[k].color])).join('') || '0';
    h += `<div class="chips"><span class="chip" data-h="stat:cards">${ic('card')} ${cc}</span><span class="chip" data-h="stat:equip">${ic('helmet')} ${eq}</span><span class="chip" data-h="stat:bags">${ic('bag')} ${bags}</span><span class="chip" data-h="stat:keys">${keys}</span><span class="chip" data-h="stat:gas">${ic('gas')} ${p.gas}</span><span class="chip" data-h="stat:gang">${ic('biker')} ${p.gangMembers.length}</span><span class="chip" data-h="stat:discs">${ic('disc')} ${p.discs}</span><span class="chip" data-h="stat:rest">${ic(p.rest ? 'sun' : 'moon')}</span>${p.cuffs ? `<span class="chip" data-h="stat:cuffs">⛓ ${p.cuffs}</span>` : ''}</div><div class="exphint" data-exp="${p.id}">${t('showBoard')}</div></div>`;
    return h;
  }
  if (!p.escaped && !p.arrested) h += `<div class="rowlbl">${t('nbTitle')}</div>` + notorBoxHTML(S, p);
  h += `<div class="rowlbl">${t('items')}</div><div class="slots">${p.items.map((x, i) => slotHTML(p, x, i, 'items', viewer)).join('')}</div>`;
  h += `<div class="rowlbl">${t('cards')}</div><div class="slots">${p.contacts.map((x, i) => slotHTML(p, x, i, 'contacts', viewer)).join('')}</div>`;
  h += `<div class="rowlbl">${t('assets')}</div><div class="slots six">${p.unlocked.map((u, i) => u ? `<div class="slot asset ${u.used ? 'used' : ''}" data-h="asset:${u.id}"><span class="cost">$${E.UNLOCK_COSTS[i]}</span>${ic(IC.ASSET[u.id], '', u.id === 'move_county' ? COP.county : u.id === 'move_federal' ? COP.federal : u.id === 'move_swat' ? '#bbb' : undefined)}</div>` : `<div class="slot"><span class="cost" style="color:var(--muted)">$${E.UNLOCK_COSTS[i]}</span></div>`).join('')}</div>`;
  const keyC = { green: '#3eae50', black: '#555', brown: '#9b5a2a' };
  h += `<div class="rowlbl">${t('keys')} · ${t('gas')} · ${t('gang')} · ${t('discs')}</div><div class="chips">${['sh1', 'sh2', 'sh3'].map(k => p.keys[k] ? `<span class="chip" data-h="key:${p.keys[k].color}" style="${p.keys[k].used ? 'opacity:.4' : ''}">${ic('key', '', keyC[p.keys[k].color])} ${k.slice(2)}</span>` : `<span class="chip" style="opacity:.35">${ic('key')} ${k.slice(2)}</span>`).join('')}<span class="chip" data-h="stat:gas">${ic('gas', '', '#7fc3ff')} ${p.gas}/2</span><span class="chip" data-h="stat:gang">${ic('biker')} ${p.gangMembers.length}</span><span class="chip" data-h="stat:discs">${ic('disc', '', '#e8b546')} ${p.discs}</span><span class="chip" data-h="stat:rest">${ic(p.rest ? 'sun' : 'moon', '', p.rest ? '#f2c629' : '#9fb3d9')}</span><span class="chip" data-h="stat:firstaid" style="${p.firstAid ? '' : 'opacity:.4'}">${ic('bandage', '', '#ff8f7a')}</span>${p.cuffs ? `<span class="chip">⛓ ${p.cuffs}</span>` : ''}</div>`;
  if (p.power) { const PW = window.HEIST_DATA.powers.powers.find(x => x.id === p.power); h += `<div class="rowlbl">${t('power')}</div><div class="chip" style="border-radius:8px;display:block;padding:6px 8px" data-h="power:${p.power}"><b>${PW.name}</b> — ${PW.title}<br><span style="font-size:12.5px;color:#cfd3db">${T.powerText(PW)}</span></div>`; }
  if (p.mission && (viewer === p.id || p.mission.done)) {
    const M = window.HEIST_DATA.missions.missions.find(m => m.id === p.mission.id); const MT = T.missionText(M);
    h += `<div class="rowlbl">${t('mission')} ${p.mission.done ? '✔' : ''}</div><div class="chip" style="border-radius:8px;display:block;padding:6px 8px;background:#3a3020">`;
    if (!p.mission.done) h += MT.goals.map(g => '• ' + g).join('<br>');
    else if (p.mission.ability) { const ai = 'abc'.indexOf(p.mission.ability); h += `<b>${MT.abilities[ai]}</b>`; if (/1 vez|Once per day|1x/i.test(M.abilities[ai] + MT.abilities[ai])) h += `<br><small>${p.mission.token ? '● ' + t('tokenOn') : '○ ' + t('tokenOff')}</small>`; if (p.mission.id === 3 && p.mission.ability === 'b' && viewer === p.id) h += `<br><label class="chk"><input type="checkbox" id="kfu" ${p.keepFaceUp ? 'checked' : ''}> ${t('keepFaceUp')}</label>`; }
    h += `</div>`;
  } else if (p.mission) h += `<div class="rowlbl">${t('mission')}</div><div class="chip">🔒 ${t('secret')}</div>`;
  if (viewer === p.id) {
    const plan = window.HEIST_DATA.escapePlans.cards[p.plan];
    h += `<div class="rowlbl">${t('plan')}</div><div class="plan">${E.PLAN_KEYS.map((k, i) => `<div class="${plan[i] === '$' ? 'inc' : ''} ${p.visited[k] ? 'v' : ''} g${i < 3 ? 'p' : i < 6 ? 'b' : 'r'}" data-h="plan:${k}"><span>${p.visited[k] ? '✔ ' : ''}${nm(k).replace('Safe House', 'SH').replace('Casa Segura', 'CS')}</span><b>${plan[i] === '$' ? '$' : plan[i]}</b></div>`).join('')}</div>`;
  }
  return h + '</div>';
}
function renderSide() {
  const S = G.VS; const el = $('#side'); if (!el) return;
  const viewer = viewerId();
  const tabs = ['me', 'opponents', 'market', 'log'].map(k => `<button class="${G.tab === k ? 'on' : ''}" data-tab="${k}">${t(k)}</button>`).join('');
  let body = '';
  if (G.tab === 'me') { const p = S.players[viewer]; body = playerCard(S, p, true, viewer) + `<div style="font-size:12px;color:var(--muted);margin-top:4px">${t('tapHelp')}</div>`; }
  else if (G.tab === 'opponents') { G.expanded = G.expanded || {}; body = S.order.map(id => E.P(S, id)).filter(p => p && p.id !== viewer).map(p => playerCard(S, p, !!G.expanded[p.id], viewer)).join(''); }
  else if (G.tab === 'market') body = marketHTML(S);
  else body = `<div class="log">${G.logLines.slice(-250).map(x => `<div class="${x.cls || ''}">${x.html}</div>`).join('')}</div>`;
  el.innerHTML = `<div class="tabs">${tabs}</div><div class="panel" id="sidepanel">${body}</div>`;
  $$('.tabs button', el).forEach(b => b.onclick = () => { G.tab = b.dataset.tab; renderSide(); });
  $$('[data-exp]', el).forEach(b => b.onclick = () => { const id = +b.dataset.exp; G.expanded[id] = !G.expanded[id]; const sc = $('#sidepanel').scrollTop; renderSide(); $('#sidepanel').scrollTop = sc; });
  const kfu = $('#kfu'); if (kfu) kfu.onchange = () => { G.S.players[viewer].keepFaceUp = kfu.checked; G.VS.players[viewer].keepFaceUp = kfu.checked; };
  if (G.tab === 'log') { const sp = $('#sidepanel'); sp.scrollTop = sp.scrollHeight; }
}
const TRAVEL_EFF = new Set(['sewer', 'jetski', 'chopper', 'medevac', 'plus_mp']);
const AVOID_EFF = new Set(['avoid_types', 'avoid_all_tile', 'avoid_one_any']);
function effArt(eff, type, types) {
  const sh = (col, cls = '') => `<span class="sh ${cls}">${ic('shield', '', col)}</span>`;
  switch (eff) {
    case 'move_police': return `${sh(COP[type])}<span class="ov">➜</span>`;
    case 'remove_police': return `${sh(COP[type])}<span class="ov x">✕</span>`;
    case 'avoid_types': return `<span class="pair">${(types || []).map(x => sh(COP[x], 'sm')).join('')}</span><span class="ov ok">✓</span>`;
    case 'avoid_all_tile': return `<span class="hexbg">${['county', 'federal', 'swat'].map(x => sh(COP[x], 'xs')).join('')}</span><span class="ov ok">✓</span>`;
    case 'avoid_one_any': return `${sh('#9aa3b2')}<span class="ov ok">1</span>`;
    default: return ic(IC.EFF[eff] || 'info', 'big', eff === 'lose_notoriety' ? '#ff7a6e' : eff === 'gain_income' ? '#7fe08a' : eff === 'heal' || eff === 'medevac' ? '#ff8f7a' : undefined);
  }
}
function stepBadge(step) {
  const tr = step.includes('travel'), av = step.includes('avoid');
  if (tr && av) return `<span class="stp tr">${ic('pawn')}</span><span class="stp av">${ic('shield')}</span>`;
  if (tr) return `<span class="stp tr">${ic('pawn')} ${t('stepTravel')}</span>`;
  if (av) return `<span class="stp av">${ic('shield')} ${t('stepAvoid')}</span>`;
  return `<span class="stp any">${t('stepAny')}</span>`;
}
function contactCardHTML(card, cls = '', extra = '') {
  const C = E.CONTACT[card];
  return `<div class="ccard ${cls}" data-card="${card}" data-h="contact:${card}" ${extra}><div class="nm">${C.name}</div><div class="steps">${stepBadge(C.step)}</div><div class="art">${effArt(C.effect, C.type, C.types)}</div><div class="cap">${T.cap(C.effect, C.type, C.types)}</div><div class="ft"><span>$${C.cost}</span>${C.notoriety ? `<span class="st">${ic('starPlus')}</span>` : '<span></span>'}</div></div>`;
}
function fixerStep(eff) { return TRAVEL_EFF.has(eff) ? 'travel' : eff === 'gang_ability' ? 'travel+avoid' : AVOID_EFF.has(eff) ? 'avoid' : 'any'; }
function fixerCardHTML(id, cls = '') {
  const F = E.FIXER[id];
  return `<div class="ccard fcard ${cls}" data-h="fixer:${id}"><div class="nm">${nm(id)}</div><div class="steps">${stepBadge(fixerStep(F.effect))}</div><div class="art">${ic(IC.FIX[id], 'big')}</div><div class="cap">${T.cap(F.effect)}</div><div class="ft"><span>$${F.cost}</span><span class="once">×1</span></div></div>`;
}
function equipTileHTML(id, left) {
  const Q = E.EQUIP[id]; const ty = Q.avoids || Q.avoids_one_of;
  return `<div class="etile" data-h="equip:${id}"><div class="nm">${nm(id)}</div>${ic(IC.EQUIP[id], 'big')}<div class="av">${ty.map(x => ic('shield', '', COP[x])).join(Q.avoids_one_of ? '<small>/</small>' : '')}</div><div class="ft"><span>$${Q.cost}</span><span data-h="ui:left">×${left}</span></div></div>`;
}
function lockerBackHTML(col, left) {
  const L = window.HEIST_DATA.lockers.lockers[col]; const draw = { '+1': '+1', '0': '', '-1': '−1' }[L.draw];
  const cnt = {}; L.tiles.forEach(v => cnt[v] = (cnt[v] || 0) + 1);
  const comp = Object.keys(cnt).map(Number).sort((a, b) => a - b).map(v => `<div><span>${v ? '$' + v + 'k' : '✕ $0'}</span><b>×${cnt[v]}</b></div>`).join('');
  return `<div class="ltile ${col}" data-h="locker:${col}"><div class="lh"><span class="nm">${nm(col)}</span>${ic('lock')}</div><div class="lr"><div class="req">${L.min}+</div><div class="drw">${ic('card')}${draw || '='}</div></div><div class="comp">${comp}</div><div class="ft" data-h="ui:left">${t('left', left)}</div></div>`;
}
// "complete the set of 3" reward box: the two choices, your progress and who already got it
function setBonusHTML(S, g) {
  const viewer = viewerId(); const me = S.players[viewer];
  const keys = g === 'sh' ? ['sh1', 'sh2', 'sh3'] : window.HEIST_DATA.locations.businesses.filter(b => b.group === g).map(b => b.id);
  const col = g === 'purple' ? '#9050c8' : g === 'blue' ? '#2f62c0' : '#d23b33';
  const n = me ? keys.filter(k => me.visited[k]).length : 0;
  const got = S.players.concat(S.npcs || []).filter(q => q.bonus && q.bonus[g]);
  const optB = g === 'sh' ? `${ic('unlock')} + ${ic('money', '', '#7fd67f')}` : `${ic('unlock')} + ${ic('starMinus', '', '#6fb0ff')}`;
  return `<div class="setb" style="border-color:${col}" data-h="ui:set_${g}"><div class="st"><span class="dots">${keys.map(k => `<i style="${me && me.visited[k] ? 'background:' + col : ''};border-color:${col}"></i>`).join('')}</span>${t('setTitle')}</div><div class="so"><span class="opt">${ic('disc', '', '#e8b546')} ${t('setDisc')}</span><em>${t('or')}</em><span class="opt">${optB} ${t(g === 'sh' ? 'setSh' : 'setBiz')}</span></div><div class="sp">${t('setYou', n)}${got.length ? ' · ' + t('setGot') + ' ' + got.map(q => `<span class="dot" style="background:${pcolor(q.id)}" title="${pname(q.id)}"></span>`).join('') : ''}</div></div>`;
}
function marketHTML(S) {
  let h = `<div class="rowlbl">${t('display')}</div><div class="cardrow">${S.cdisplay.map(c => contactCardHTML(c)).join('')}</div>`;
  h += `<div class="rowlbl">${t('turnOrder')}</div><div class="order">${S.order.map((id, i) => { const q = E.P(S, id); return `<span style="${q.escaped || q.arrested ? 'opacity:.4' : ''}"><b style="background:${pcolor(id)}">${i + 1}</b>${pname(id)}</span>`; }).join('')}</div>`;
  h += `<div class="rowlbl">${t('notoriety')}</div><div class="track">`;
  for (let lv = 1; lv <= S.cfg.max; lv++) {
    const here = S.players.concat(S.npcs || []).filter(q => q.notor === lv && !q.arrested);
    const ti = S.cfg.th.indexOf(lv);
    const thb = ti < 0 ? '' : `<span class="thb" data-h="th:${ti}">${ic('unlock')}<small>×${ti === 1 ? 2 : 1}</small>${ti === 2 ? ic('disc', '', '#e8b546') : ''}<span class="sep"></span>${ic('shield', '', '#ff8a7a')}<small>➜</small></span>`;
    h += `<div class="trow ${ti >= 0 ? 'th' : ''}" data-h="track:${lv}">${thb}<span class="lv">${lv}</span>${here.map(q => `<span class="dot" style="background:${pcolor(q.id)}" title="${pname(q.id)}"></span>`).join('')}<span class="pen">${S.cfg.pen[lv] ? '−$' + S.cfg.pen[lv] + 'k' : ''}</span></div>`;
  }
  h += `</div><div class="rowlbl">${t('businesses')}</div>`;
  const cubeRow = (cubes) => { const inc = cubes.filter(c => c.income), end = cubes.filter(c => !c.income); const sq = (arr) => arr.map(c => `<i style="background:${pcolor(c.pid)}" title="${pname(c.pid)}"></i>`).join('') || '<em>—</em>'; return `<div class="bc"><span class="hx inc" data-h="ui:incHex">$ ${t('incomeNow')}</span>${sq(inc)}<span class="hx end" data-h="ui:endHex">${ic('bag')} ${t('endMoney')}</span>${sq(end)}</div>`; };
  h += `<div class="legend">${t('bizLegend', S.cfg.closeAt)}</div>`;
  window.HEIST_DATA.locations.businesses.forEach(b => {
    const cubes = S.bizCubes[b.id]; const N = S.cfg.closeAt; const closed = S.closed[b.id];
    const slots = Array.from({ length: Math.max(N, cubes.length) }, (_, i) => `<b class="${i < cubes.length ? 'f' : ''} ${i >= N ? 'x' : ''}" style="${i < cubes.length ? 'background:' + pcolor(cubes[i].pid) : ''}"></b>`).join('');
    h += `<div class="bizrow ${closed ? 'cl' : ''}" data-h="biz:${b.id}"><div class="bh">${ic(IC.BIZ[b.id], '', b.group === 'purple' ? '#b07be0' : '#6aa0ff')} ${nm(b.id)}<span class="cap">${slots}${closed ? ' ' + ic('lock', '', '#f2c629') + ' ' + t('closed') : ''}</span></div>${cubes.length ? cubeRow(cubes) : ''}</div>`;
    const grp = window.HEIST_DATA.locations.businesses.filter(x => x.group === b.group); if (grp[grp.length - 1].id === b.id) h += setBonusHTML(S, b.group);
  });
  h += `<div class="rowlbl">${t('safehouses')}</div>`;
  h += `<div class="legend">${t('shLegend')}</div>`;
  ['sh1', 'sh2', 'sh3'].forEach(k => { const cubes = S.shCubes[k] || []; h += `<div class="bizrow"><div class="bh">${ic('house', '', '#ff7a6e')} ${nm(k)}<span class="cap">${(S.shKeys[k] || []).map(c => ic('key', '', { green: '#3eae50', black: '#aaa', brown: '#c07a3a' }[c])).join('') || '<em>' + t('noKeys') + '</em>'}</span></div>${cubes.length ? cubeRow(cubes) : ''}</div>`; });
  h += setBonusHTML(S, 'sh');
  h += `<div class="rowlbl">${t('fixers')}</div><div class="cardrow wrap">${S.fixers.map(f => fixerCardHTML(f)).join('')}</div>`;
  h += `<div class="rowlbl">${t('equipment')}</div><div class="cardrow wrap">${Object.keys(S.equip).map(k => equipTileHTML(k, S.equip[k])).join('')}<div class="etile gas" data-h="stat:gas"><div class="nm">${t('gas')}</div>${ic('gas', 'big', '#7fc3ff')}<div class="av">+1 ${t('mp')}</div><div class="ft"><span>${t('free')}</span><span>×${S.gasSupply}</span></div></div></div>`;
  h += `<div class="rowlbl">${t('lockers')}</div><div class="legend">${t('lockerLegend')}</div><div class="cardrow wrap">${['green', 'black', 'brown'].map(c => lockerBackHTML(c, S.lockers[c].length)).join('')}</div>`;
  h += `<div class="kv" style="margin-top:8px"><span>${ic('disc')} ${t('discs')}</span><b>${S.discs}</b></div><div class="kv"><span>${ic('shield', '', COP.county)}${ic('shield', '', COP.federal)}${ic('shield', '', '#888')} bag</span><b>${S.bag.county}/${S.bag.federal}/${S.bag.swat}</b></div>`;
  return h;
}

// ---------------- bottom bar & decisions ----------------
function setTicker() { const last = G.logLines.filter(x => !x.cls).slice(-2).map(x => x.html); $('#ticker') && ($('#ticker').innerHTML = last.join(' &nbsp;·&nbsp; ')); }
function renderBar() {
  const S = G.S; const el = $('#prompt'); if (!el) return; closeSheet(false); setTicker();
  const pd = S.pending;
  if (!pd) { el.innerHTML = ''; return; }
  if (G.busy || !isHuman(pd.pid)) { el.innerHTML = `<div class="msg"><span class="who"><span class="dot" style="background:${pcolor(pd.pid)}"></span>${pname(pd.pid)}</span> ${t('waiting')}</div><button class="ghost" id="bSkip">${ic('ff')} ${t('skip')}</button>`; $('#bSkip').onclick = () => { G.skip = true; }; return; }
  const p = S.players[pd.pid]; const head = `<span class="who"><span class="dot" style="background:${pcolor(p.id)}"></span>${pname(p.id)}</span>`;
  switch (pd.type) {
    case 'action': {
      const ex = pd.exec || []; const nMoves = Object.keys(pd.moves).length;
      el.innerHTML = `<div class="msg">${head} — ${t('yourTurn')}<small>${t('chooseDest')}</small></div>` +
        (pd.canEscapeHere ? `<button class="gold" id="bEsc">${ic('car')} ${t('escapeHere')}</button>` : '') +
        (pd.canRest ? `<button id="bRest" data-h="ui:rest">${ic('sun')} ${t('rest')}</button>` : '') +
        (ex.length ? `<button id="bAb">${ic('hand')} ${t('abilities')} (${ex.length})</button>` : '') +
        (!nMoves && !pd.canRest ? `<button id="bPass">${t('pass')}</button>` : '');
      $('#bEsc') && ($('#bEsc').onclick = () => human({ type: 'escapeHere' }));
      $('#bRest') && ($('#bRest').onclick = () => human({ type: 'rest' }));
      $('#bPass') && ($('#bPass').onclick = () => human({ type: 'pass' }));
      $('#bAb') && ($('#bAb').onclick = () => abilitiesSheet(ex, 'action'));
      break;
    }
    case 'end': {
      el.innerHTML = `<div class="msg">${head} — ${t('endTitle')}<small>${t('endHint')}</small></div><button id="bAb">${ic('hand')} ${t('abilities')} (${pd.exec.length})</button><button class="pri" id="bEnd">${t('endTurn')}</button>`;
      $('#bAb').onclick = () => abilitiesSheet(pd.exec, 'end'); $('#bEnd').onclick = () => human(null);
      break;
    }
    case 'place': placeBar(el, pd, head); break;
    case 'policeMove': {
      const tgt = pd.target === p.id ? t('policeSelf') : t('policeHint', pname(pd.target));
      el.innerHTML = `<div class="msg">${head} — ${t('policeTitle')}<small>${tgt} ${t('pickOfficer')}</small></div>` + (G.sel.from != null ? `<button id="bBack">${t('cancel')}</button>` : '');
      $('#bBack') && ($('#bBack').onclick = () => { G.sel = {}; renderMap(); renderBar(); });
      break;
    }
    default: el.innerHTML = `<div class="msg">${head}</div>`; openSheet(pd);
  }
  if (G.sel.execCop) { el.innerHTML = `<div class="msg">${head} — ${nm('move_' + G.sel.execCop.type) || ''}<small>${t('pickOfficer')}</small></div><button id="bBack">${t('cancel')}</button>`; $('#bBack').onclick = () => { G.sel = {}; renderMap(); renderBar(); }; }
}
function displayCops(tl) {
  const d = (G.S.display || []).find(x => x.tile === tl); if (!d) return '';
  return E.PTYPES.filter(ty => d.police[ty]).map(ty => { const q = tileGeo(tl, 0).cops[ty]; return `<g transform="translate(${q.x},${q.y})"><circle r="19" fill="#000a"/><g transform="translate(-17,-18) scale(1.42)" fill="${COP[ty]}" stroke="#fff" stroke-width="1.2">${IC.raw('shield')}</g></g>`; }).join('');
}
function placeBar(el, pd, head) {
  const S = G.S;
  const tiles = pd.display.map(tl => `<span class="hextile ${G.sel.tile === tl ? 'sel' : ''}" data-tile="${tl}"><svg width="78" height="68" viewBox="-104 -90 208 180">${svgDefs()}${tileSVG(tl, 0, 0, 0, { id: 'pv' + tl })}${E.TILE[tl].locs.map(l => { const g = tileGeo(tl, 0); const p = g.locs[l.id]; const nmI = { business: 'dice', safehouse: 'house', store: 'cart', exit: 'exit', clinic: 'medic', church: 'church', subway: 'train', heliport: 'heli', gang: 'skull', hospital: 'cross' }[l.type]; return `<circle cx="${p.x}" cy="${p.y}" r="24" fill="#fff" stroke="#000" stroke-width="3"/><g transform="translate(${p.x - 16},${p.y - 16}) scale(1.33)" fill="#222">${IC.raw(nmI)}</g>`; }).join('')}${displayCops(tl)}</svg></span>`).join('');
  const canConfirm = G.sel.tile && G.sel.cell != null;
  const TL = G.sel.tile ? E.TILE[G.sel.tile] : null;
  let extra = '';
  if (TL && TL.locs.some(l => l.type === 'business')) extra += `<select id="selBiz">${E.freeBiz(S).map(b => `<option value="${b}" ${G.sel.biz === b ? 'selected' : ''}>${nm(b)}</option>`).join('')}</select>`;
  if (TL && TL.locs.some(l => l.type === 'safehouse')) extra += `<select id="selSh">${E.freeSh(S).map(b => `<option value="${b}" ${G.sel.sh === b ? 'selected' : ''}>${nm(b)}</option>`).join('')}</select>`;
  el.innerHTML = `<div class="msg">${head} — ${t('placeTitle')}<small>${t('placeHint')}</small></div>${tiles}${extra}${canConfirm ? `<button id="bRot">${ic('rotate')} ${t('rotate')}</button><button class="pri" id="bPlace">${t('confirm')}</button>` : ''}`;
  $$('.hextile', el).forEach(b => b.onclick = () => { G.sel = { tile: b.dataset.tile }; renderMap(); renderBar(); });
  $('#selBiz') && ($('#selBiz').onchange = (e) => { G.sel.biz = e.target.value; });
  $('#selSh') && ($('#selSh').onchange = (e) => { G.sel.sh = e.target.value; });
  if (canConfirm) {
    $('#bRot').onclick = () => { const rots = E.legalPlacements(S, G.sel.tile).filter(x => x.cell === G.sel.cell).map(x => x.rot); const i = rots.indexOf(G.sel.rot); G.sel.rot = rots[(i + 1) % rots.length]; renderMap(); };
    $('#bPlace').onclick = () => { const a = { tile: G.sel.tile, cell: G.sel.cell, rot: G.sel.rot, biz: ($('#selBiz') || {}).value, sh: ($('#selSh') || {}).value }; human(a); };
  }
}
function sheet(html, bind) { const host = $('#mapwrap'); let el = $('#sheet'); if (!el) { el = document.createElement('div'); el.id = 'sheet'; el.className = 'paper'; host.appendChild(el); } el.innerHTML = html; bind && bind(el); makeDraggable(el, $('h3', el)); }
function closeSheet() { const el = $('#sheet'); el && el.remove(); const pp = $('.pop'); pp && pp.remove(); }
function exLabel(x) {
  const src = x.src === 'contact' ? E.CONTACT[G.S.players[G.S.pending.pid].contacts[x.i].card].name : x.src === 'fixer' ? nm(G.S.players[G.S.pending.pid].items[x.i].id) : x.src === 'asset' ? nm(G.S.players[G.S.pending.pid].unlocked[x.i].id) : x.src === 'firstAid' ? (G.prefs.lang === 'pt' ? 'Primeiros socorros' : 'First aid') : x.src === 'gang' ? (G.prefs.lang === 'pt' ? 'Motard do gang' : 'Gang biker') : x.src === 'scar' ? 'Scar ⛽' : x.src === 'mission' ? t('mission') : x.src;
  const iconN = x.src === 'contact' ? IC.EFF[x.eff] : x.src === 'fixer' ? IC.FIX[G.S.players[G.S.pending.pid].items[x.i].id] : x.src === 'asset' ? IC.ASSET[G.S.players[G.S.pending.pid].unlocked[x.i].id] : x.src === 'gang' ? 'biker' : x.src === 'scar' ? 'gas' : x.src === 'mission' ? 'check' : 'bandage';
  return { src, icon: iconN, eff: T.effect(x.eff, x.type ? [x.type] : x.types) };
}
function abilitiesSheet(ex, when) {
  sheet(`<h3>${t('abilities')}</h3><div class="sub">${t('endHint')}</div><div class="choices">${ex.map((x, i) => { const L = exLabel(x); return `<button class="choice" data-i="${i}">${ic(L.icon)}<span><b>${L.src}</b><br>${L.eff}${x.cost ? ` — $${x.cost}k` : ` — ${t('free')}`}</span></button>`; }).join('')}</div><div class="row"><button class="ghost" id="bX">${t('close')}</button></div>`, el => {
    $$('.choice', el).forEach(b => b.onclick = () => { const x = ex[+b.dataset.i]; closeSheet(); if (x.eff === 'move_police' || x.eff === 'remove_police') { G.sel = { execCop: x }; renderMap(); renderBar(); } else human({ exec: x }); });
    $('#bX').onclick = () => closeSheet();
  });
}
function openSheet(pd) {
  const S = G.S; const p = S.players[pd.pid];
  switch (pd.type) {
    case 'yesno': sheet(`<h3>${t('q.' + pd.q)}</h3>${pd.q === 'ladyRefresh' ? `<div class="sub">${ic(IC.FIX[pd.fixer])} ${nm(pd.fixer)} — $${pd.price}k</div>` : ''}${pd.q === 'swapOrder' ? `<div class="sub">${pname(pd.ahead)}</div>` : ''}<div class="row"><button class="pri" id="bY">${t('yes')}</button><button class="ghost" id="bN">${t('no')}</button></div>`, el => { $('#bY').onclick = () => human(true); $('#bN').onclick = () => human(false); }); break;
    case 'unlock': sheet(`<h3>${t('unlockTitle')}</h3><div class="sub">${t('unlockHint')}</div><div class="choices">${pd.assets.map((a, i) => `<button class="choice" data-i="${i}">${ic(IC.ASSET[a.id])}<span><b>${nm(a.id)}</b><br>${assetEff(a.id)}</span></button>`).join('')}</div>`, el => $$('.choice', el).forEach(b => b.onclick = () => { const a = pd.assets[+b.dataset.i]; human({ where: a.where, i: a.i }); })); break;
    case 'contact': contactSheet(pd, p); break;
    case 'avoid': avoidSheet(pd, p); break;
    case 'choose': chooseSheet(pd, p); break;
    case 'pickTile': sheet(`<h3>${t('q.' + pd.q)}</h3><div class="choices">${pd.tiles.map((v, i) => `<button class="choice" data-i="${i}">${ic('bag', '', '#2d7a2a')}<b>$${v}k</b></button>`).join('')}</div>`, el => $$('.choice', el).forEach(b => b.onclick = () => human(+b.dataset.i))); break;
  }
}
function assetEff(id) { const A = E.ASSET[id]; return T.effect(A.effect, A.type ? [A.type] : null); }
function contactSheet(pd, p) {
  const sel = G.sel.card;
  sheet(`<h3>${t('contactTitle')}</h3><div class="sub">${t('pickCard')}</div><div class="cardrow">${pd.display.map(c => contactCardHTML(c, 'pick ' + (sel === c ? 'sel' : ''))).join('')}</div>
   ${sel ? `<div class="sub" style="margin-top:6px"><b>${E.CONTACT[sel].name}</b>: ${T.effect(E.CONTACT[sel].effect, E.CONTACT[sel].types || (E.CONTACT[sel].type ? [E.CONTACT[sel].type] : null))}</div><div class="row">${pd.hasEmpty ? `<button class="pri" id="bB">${t('optB')}</button>` : ''}${pd.mine.length ? `<button id="bC">${t('optC')}</button>` : ''}<button class="ghost" id="bA">${t('optA')}</button></div><div id="repl" class="cardrow"></div>` : ''}`, el => {
    $$('.ccard.pick', el).forEach(c => c.onclick = () => { G.sel.card = c.dataset.card; contactSheet(pd, p); });
    $('#bB') && ($('#bB').onclick = () => human({ card: sel, opt: 'B' }));
    $('#bA') && ($('#bA').onclick = () => human({ card: sel, opt: 'A' }));
    $('#bC') && ($('#bC').onclick = () => { $('#repl').innerHTML = pd.mine.map(m => contactCardHTML(m.card, 'pick', `data-i="${m.i}"`)).join(''); $$('#repl .ccard').forEach(c => c.onclick = () => human({ card: sel, opt: 'C', replace: +c.dataset.i })); });
  });
}
function avoidSheet(pd, p) {
  const offs = pd.officers;
  const rows = offs.map(o => {
    const opts = pd.options.map((x, i) => ({ x, i })).filter(({ x }) => x.cell === o.cell && (x.scope === 'tile' || (x.scope === 'types' && (x.types.includes(o.type) || o.type === 'sandra')) || x.type === o.type));
    const lbl = (x) => { const L = exLabel(x); return `${L.src}${x.cost ? ' $' + x.cost + 'k' : ''}${x.scope === 'tile' ? ' ⬡' : ''}`; };
    return `<div class="off-row"><span class="who">${o.type === 'sandra' || o.type === 'costa' ? ic('cop', '', o.type === 'sandra' ? '#a8956a' : '#2b3f6b') : ic('shield', '', COP[o.type])} ${t('types.' + o.type)}</span>${opts.length ? opts.map(({ x, i }) => `<button class="opt-btn" data-i="${i}" title="${exLabel(x).eff}">${lbl(x)}</button>`).join('') : `<span style="color:#a33">🩸 ${o.type === 'costa' ? (p.money >= 3 ? '$3k' : '2×') : ''}</span>`}</div>`;
  }).join('');
  const nw = offs.filter(o => o.type !== 'costa').length; const costa = offs.find(o => o.type === 'costa');
  sheet(`<h3>${t('avoidTitle')}</h3><div class="sub">${t('avoidHint')}</div>${rows}<div class="row"><button class="pri" id="bDone">${nw ? t('acceptWounds', nw) : t('done')}${costa ? (p.money >= 3 ? ' + $3k' : '') : ''}</button></div>`, el => {
    $$('.opt-btn', el).forEach(b => b.onclick = () => human(pd.options[+b.dataset.i]));
    $('#bDone').onclick = () => human({ done: true });
  });
  // highlight officers on the map
  offs.forEach(o => { const e = $(`#cop-${o.cell}-${o.type} .copin`); e && e.classList.add('pick'); });
}
function chooseSheet(pd, p) {
  const q = pd.q; let opts = pd.opts.map(o => ({ v: o, html: String(o) }));
  const keyC = { green: '#3eae50', black: '#333', brown: '#9b5a2a' };
  if (q === 'bonus_biz' || q === 'bonus_sh') opts = pd.opts.map(o => ({ v: o, html: `${ic(o === 'disc' ? 'disc' : 'unlock')}<b>${o === 'disc' ? t('opt.disc') : t(q === 'bonus_sh' ? 'opt.unlockSh' : 'opt.unlockBiz')}</b>` }));
  if (q === 'hospital') opts = pd.opts.map(o => ({ v: o, html: `${ic('cross', '', '#d23b33')}<b>${t('opt.heal', o)}</b>` }));
  if (q === 'key') opts = pd.opts.map(o => ({ v: o, html: `${ic('key', '', keyC[o])}<b>${nm(o)}</b>` }));
  if (q === 'fixer') opts = pd.opts.map(o => o === 'none' ? { v: o, html: `<b>${t('none')}</b>` } : { v: o, html: `${fixerCardHTML(o)}<span style="font-size:13px">${T.effect(E.FIXER[o].effect)}</span>` });
  if (q === 'equip') opts = pd.opts.map(o => o === 'none' ? { v: o, html: `<b>${t('none')}</b>` } : { v: o, html: `${equipTileHTML(o, G.S.equip[o])}<span style="font-size:13px">${(E.EQUIP[o].avoids || E.EQUIP[o].avoids_one_of).map(x => t('types.' + x)).join(' / ')}</span>` });
  if (q === 'locker') opts = pd.opts.map(o => { if (o === 'none') return { v: o, cls: 'narrow', html: `<b>${t('none')}</b>` };
    const L = window.HEIST_DATA.lockers.lockers[o]; const cc = E.contactCount(p); const n = Math.max(0, Math.min(G.S.lockers[o].length, cc + (+L.draw || 0)));
    return { v: o, cls: 'wide', html: `${lockerBackHTML(o, G.S.lockers[o].length)}<span style="font-size:13.5px">${t('lockerDo', n, p.notor + cc, L.min)}</span>` }; });
  if (q === 'slotPick') opts = pd.opts.map(o => { const x = p.items[o]; const pt = G.prefs.lang === 'pt';
    const icn = x.kind === 'equip' ? ic(IC.EQUIP[x.id], 'big') : x.kind === 'fixer' ? ic(IC.FIX[x.id], 'big') : ic('bag', 'big', '#2d7a2a');
    const name = x.kind === 'equip' || x.kind === 'fixer' ? nm(x.id) : x.kind === 'locker' ? (pt ? 'Cacifo ' : 'Locker ') + nm(x.color) + ` ($${x.val}k)` : (pt ? 'Saída' : 'Exit') + ` ($${x.val}k)`;
    const state = x.kind === 'fixer' ? (x.used ? (pt ? 'já usado' : 'already used') : (pt ? 'ainda por usar' : 'not used yet')) : x.kind === 'equip' ? (x.used ? (pt ? 'virado (volta ao descansar)' : 'flipped (back on Rest)') : (pt ? 'pronto a usar' : 'ready')) : (pt ? 'dinheiro no fim' : 'money at the end');
    return { v: o, html: `${icn}<span><b>${name}</b><br><small>${x.kind === 'fixer' ? 'Fixer · ' : x.kind === 'equip' ? (pt ? 'Equipamento · ' : 'Equipment · ') : ''}${state}</small><br><small>→ ${t('slotReplace')}</small></span>` }; });
  if (q === 'clawsExtra') opts = pd.opts.map(o => ({ v: o, html: `${ic('bag', '', '#2d7a2a')}<b>${t('extraN', o)}</b>` }));
  if (q === 'mrv') opts = pd.opts.map(o => ({ v: o, html: `${ic(o === 'lose' ? 'starMinus' : o === 'gain' ? 'starPlus' : 'star', '', '#d23b33')}<b>${t('mrvOpt.' + o)}</b>` }));
  if (q === 'mission') { const M = window.HEIST_DATA.missions.missions.find(m => m.id === pd.mission); const MT = T.missionText(M); opts = pd.opts.map((o, i) => ({ v: o, html: `${ic('check', '', '#2d7a2a')}<span>${MT.abilities[i]}</span>` })); }
  if (q === 'exit') opts = pd.opts.map(o => ({ v: o, html: o === 'income' ? `${ic('money', '', '#2d7a2a')}<b>${t('opt.income')} (+$${p.income}k)</b>` : o === 'tile' ? `${ic('bag', '', '#2d7a2a')}<b>${t('opt.tile')}</b>` : `<b>${t('none')}</b>` }));
  sheet(`<h3>${t('q.' + q)}</h3><div class="choices">${opts.map((o, i) => `<button class="choice ${o.cls || ''}" data-i="${i}">${o.html}</button>`).join('')}</div>`, el => $$('.choice', el).forEach(b => b.onclick = () => human(opts[+b.dataset.i].v)));
}
// where to put the destination popover: inside the map area, away from the drawn route
function placePop(el, S, plan) {
  const host = $('#mapwrap').getBoundingClientRect(); const M = $('#world').getScreenCTM(); const svg = $('#map');
  const scr = q => { const pt = svg.createSVGPoint(); pt.x = q.x; pt.y = q.y; const r = pt.matrixTransform(M); return { x: r.x - host.left, y: r.y - host.top }; };
  const pts = (plan ? routePts(S, bestPath(S, plan.path, plan.alts)) : []).map(scr);
  if (!pts.length) return;
  const pad = 46; const bb = { x0: Math.min(...pts.map(q => q.x)) - pad, x1: Math.max(...pts.map(q => q.x)) + pad, y0: Math.min(...pts.map(q => q.y)) - pad, y1: Math.max(...pts.map(q => q.y)) + pad };
  const w = el.offsetWidth, h = el.offsetHeight, W = host.width, H = host.height; const m = 8;
  const cands = [[bb.x1 + 6, (bb.y0 + bb.y1) / 2 - h / 2], [bb.x0 - w - 6, (bb.y0 + bb.y1) / 2 - h / 2], [(bb.x0 + bb.x1) / 2 - w / 2, bb.y1 + 6], [(bb.x0 + bb.x1) / 2 - w / 2, bb.y0 - h - 6], [W - w - m, m], [m, m], [W - w - m, H - h - m], [m, H - h - m]];
  const clamp = ([x, y]) => [Math.max(m, Math.min(W - w - m, x)), Math.max(m, Math.min(H - h - m, y))];
  const overlap = ([x, y]) => Math.max(0, Math.min(x + w, bb.x1) - Math.max(x, bb.x0)) * Math.max(0, Math.min(y + h, bb.y1) - Math.max(y, bb.y0));
  let best = null, bo = Infinity; cands.map(clamp).forEach(c => { const o = overlap(c); if (o < bo - 1) { bo = o; best = c; } });
  el.style.left = best[0] + 'px'; el.style.top = best[1] + 'px';
}
// drag a floating window by its title
function makeDraggable(el, handle) {
  if (!handle) return; handle.classList.add('draggable'); let d = null;
  handle.addEventListener('pointerdown', e => { if (e.target.closest('button')) return; const r = el.getBoundingClientRect(), hr = el.parentElement.getBoundingClientRect(); d = { dx: e.clientX - r.left, dy: e.clientY - r.top, hr }; el.style.transform = 'none'; el.style.left = (r.left - hr.left) + 'px'; el.style.top = (r.top - hr.top) + 'px'; el.style.bottom = 'auto'; handle.setPointerCapture(e.pointerId); e.preventDefault(); e.stopPropagation(); });
  handle.addEventListener('pointermove', e => { if (!d) return; const x = Math.max(0, Math.min(d.hr.width - 60, e.clientX - d.hr.left - d.dx)), y = Math.max(0, Math.min(d.hr.height - 30, e.clientY - d.hr.top - d.dy)); el.style.left = x + 'px'; el.style.top = y + 'px'; });
  const up = () => { d = null; }; handle.addEventListener('pointerup', up); handle.addEventListener('pointercancel', up);
}
// readable list of what each movement point is spent on
function routeSteps(S, path, pl) {
  const pt = G.prefs.lang === 'pt'; const isZ = n => n.indexOf(':') >= 0 && !/^[~^%]/.test(n);
  const LN = { I: pt ? 'Industrial' : 'Industrial', C: pt ? 'Comercial' : 'Commercial', R: pt ? 'Residencial' : 'Residential', W: pt ? 'Água' : 'Water' };
  const out = []; let mp = 0; let water = false;
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1], b = path[i];
    if (isZ(b) && b.split(':')[1][0] === 'W') water = true;
    if (/^~/.test(b)) { out.push(`🚇 ${pt ? 'metro (+1)' : 'subway (+1)'}`); continue; }
    if (/^\^/.test(b)) { mp++; out.push(`<b>${mp}</b> ${ic('heli')} ${pt ? 'voo' : 'flight'}`); continue; }
    if (/^%/.test(b)) { out.push(`${ic('sewer')} ${pt ? 'esgotos' : 'sewer'}`); continue; }
    if (!isZ(a) && isZ(b)) { const B = b.split(':')[1][0]; mp++; out.push(`<b>${mp}</b> ${pt ? 'sair para' : 'leave to'} <span class="lt ${B}">${LN[B]}</span>`); }
    else if (!isZ(a) && !isZ(b)) { mp++; out.push(`<b>${mp}</b> ${pt ? 'direto para o local ao lado' : 'straight to the touching location'}`); }
    else if (isZ(a) && isZ(b)) { const A = a.split(':')[1][0], B = b.split(':')[1][0]; if (A !== B) { mp++; out.push(`<b>${mp}</b> <span class="lt ${A}">${LN[A]}</span> → <span class="lt ${B}">${LN[B]}</span>`); } }
    else if (isZ(a) && !isZ(b)) { mp++; out.push(`<b>${mp}</b> ${pt ? 'entrar' : 'enter'}`); }
  }
  if (water && pl.variant !== 'jetski') out.push(`⛴ ${pt ? 'ferry: há um F nesta massa de água' : 'ferry: this body of water has an F'}`);
  else if (water) out.push(`${ic('wave')} Jet Ski`);
  return out.join(' · ');
}
function destPopover(locId) {
  const S = G.S; const pd = S.pending; const plans = pd.moves[locId]; if (!plans) return;
  const pp = $('.pop'); pp && pp.remove();
  const el = document.createElement('div'); el.className = 'pop paper';
  el.innerHTML = `<h3 class="draggable" style="margin:0 0 6px;font-family:var(--ff-type)"><span class="grip">⠿</span> ${locName(locId)}</h3><div class="planlist">${plans.map((pl, i) => `<div class="choice" data-i="${i}" style="flex-direction:column;align-items:stretch">
    <div style="display:flex;justify-content:space-between;gap:8px"><b>${t('variant.' + pl.variant)}</b><span>${pl.mp} ${t('mp')}${pl.extraMp ? ' · ' + t('extraMp', pl.extraMp) : ''} · ${pl.police} ${ic('shield', '', '#d23b33')}</span></div><div class="rsteps">${routeSteps(S, bestPath(S, pl.path, pl.alts), pl)}</div>
    <div class="row" style="margin-top:4px">${pl.escape ? `<button class="gold" data-esc="1" data-i="${i}">${ic('car')} ${t('escape')}</button>` : ''}<button class="pri" data-i="${i}">${t('move')}</button></div></div>`).join('')}</div><div class="row" style="margin-top:8px"><button class="ghost" id="bX">${t('cancel')}</button></div>`;
  $('#mapwrap').appendChild(el);
  placePop(el, S, plans[G.sel.plan || 0]); makeDraggable(el, $('h3', el));
  $$('.planlist .choice', el).forEach(c => c.onmouseenter = () => { G.sel.plan = +c.dataset.i; renderMap(); });
  $$('button[data-i]', el).forEach(b => b.onclick = (ev) => { ev.stopPropagation(); human({ type: 'move', dest: locId, plan: +b.dataset.i, escape: !!b.dataset.esc }); });
  $('#bX').onclick = () => { el.remove(); G.sel = {}; renderMap(); };
}

// ---------------- map interaction ----------------
function onMapClick(ev) {
  const S = G.S; const pd = S.pending; if (!pd || G.busy || !isHuman(pd.pid)) return;
  if (G.panMoved) return;
  const tgt = ev.target.closest('[data-loc],[data-cell],[data-cop],[data-celldest]'); if (!tgt) { if (G.sel.dest) { G.sel = {}; $('.pop') && $('.pop').remove(); renderMap(); } return; }
  if (pd.type === 'action' && tgt.dataset.loc && pd.moves[tgt.dataset.loc] && !G.sel.execCop) { G.sel = { dest: tgt.dataset.loc, plan: 0 }; renderMap(); destPopover(tgt.dataset.loc); return; }
  if (pd.type === 'place' && tgt.dataset.cell != null && G.sel.tile) { const c = +tgt.dataset.cell; const rots = E.legalPlacements(S, G.sel.tile).filter(x => x.cell === c).map(x => x.rot); if (!rots.length) return; G.sel.cell = c; G.sel.rot = rots[0]; if (!G.sel.biz) G.sel.biz = E.freeBiz(S)[0]; if (!G.sel.sh) G.sel.sh = E.freeSh(S)[0]; renderMap(); renderBar(); return; }
  if (pd.type === 'policeMove') {
    if (tgt.dataset.cop && G.sel.from == null) { const [c, ty] = tgt.dataset.cop.split(':'); if (pd.opts.some(o => o.from === +c && o.type === ty)) { G.sel = { from: +c, ptype: ty }; renderMap(); renderBar(); } return; }
    if (tgt.dataset.celldest != null && G.sel.from != null) { human({ from: G.sel.from, to: +tgt.dataset.celldest, type: G.sel.ptype }); return; }
  }
  if (G.sel.execCop) {
    const x = G.sel.execCop;
    if (tgt.dataset.cop && G.sel.from == null) { const [c, ty] = tgt.dataset.cop.split(':'); if (ty !== x.type) return; if (x.eff === 'remove_police') { human({ exec: Object.assign({}, x, { from: +c }) }); return; } G.sel.from = +c; renderMap(); return; }
    if (tgt.dataset.celldest != null && G.sel.from != null) { human({ exec: Object.assign({}, x, { from: G.sel.from, to: +tgt.dataset.celldest }) }); return; }
  }
}
function bindPanZoom() {
  const svg = $('#map'); let drag = null, pinch = null;
  const apply = () => { const w = $('#world'); w && w.setAttribute('transform', `translate(${G.zoom.x},${G.zoom.y}) scale(${G.zoom.k})`); };
  svg.addEventListener('wheel', (e) => { e.preventDefault(); const k = Math.max(0.6, Math.min(3, G.zoom.k * (e.deltaY < 0 ? 1.12 : 0.89))); const pt = toSvg(e.clientX, e.clientY); G.zoom.x = pt.x - (pt.x - G.zoom.x) * k / G.zoom.k; G.zoom.y = pt.y - (pt.y - G.zoom.y) * k / G.zoom.k; G.zoom.k = k; apply(); }, { passive: false });
  svg.addEventListener('pointerdown', (e) => { drag = { x: e.clientX, y: e.clientY, zx: G.zoom.x, zy: G.zoom.y }; G.panMoved = false; });
  window.addEventListener('pointermove', (e) => { if (!drag || pinch) return; const dx = e.clientX - drag.x, dy = e.clientY - drag.y; if (Math.abs(dx) + Math.abs(dy) > 8) G.panMoved = true; if (!G.panMoved) return; const sc = svgScale(); G.zoom.x = drag.zx + dx / sc; G.zoom.y = drag.zy + dy / sc; apply(); });
  window.addEventListener('pointerup', () => { drag = null; setTimeout(() => G.panMoved = false, 0); });
  svg.addEventListener('touchstart', (e) => { if (e.touches.length === 2) { const d = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY); pinch = { d, k: G.zoom.k }; } }, { passive: true });
  svg.addEventListener('touchmove', (e) => { if (pinch && e.touches.length === 2) { const d = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY); G.zoom.k = Math.max(0.6, Math.min(3, pinch.k * d / pinch.d)); G.panMoved = true; apply(); } }, { passive: true });
  svg.addEventListener('touchend', () => { if (pinch) setTimeout(() => pinch = null, 50); });
  svg.addEventListener('dblclick', () => { G.zoom = { k: 1, x: 0, y: 0 }; apply(); });
  svg.addEventListener('click', onMapClick);
}
function svgScale() { const svg = $('#map'); const m = svg.getScreenCTM(); return m ? m.a : 1; }
function toSvg(cx, cy) { const svg = $('#map'); const pt = svg.createSVGPoint(); pt.x = cx; pt.y = cy; return pt.matrixTransform(svg.getScreenCTM().inverse()); }
function screenOf(p) { const w = $('#world'); if (!w || !p) return null; const svg = $('#map'); const pt = svg.createSVGPoint(); pt.x = p.x; pt.y = p.y; return pt.matrixTransform(w.getScreenCTM()); }

// ---------------- tooltips / help ----------------
function helpHTML(key) {
  const [kind, id] = key.split(/:(.+)/); const S = G.S; const pt = G.prefs.lang === 'pt';
  const topic = (tid) => { const tp = R.topics.find(x => x.id === tid); return tp ? tp.body[G.prefs.lang].replace(/<[^>]+>/g, ' ').slice(0, 260) + '…' : ''; };
  switch (kind) {
    case 'loc': {
      const k = E.locKind(S, id); if (!k) return '';
      const c = E.locCell(S, id); const cl = S.cells[c]; const cops = E.PTYPES.filter(x => cl.police[x]).map(x => t('types.' + x));
      const others = pt ? '+1 de notoriedade por cada outro jogador lá' : '+1 notoriety per other player there';
      const contact = pt ? 'tiras uma carta de Contacto' : 'take a Contact card';
      const li = a => '<ol class="tsteps">' + a.map(x => `<li>${x}</li>`).join('') + '</ol>';
      let st = '', body = '';
      switch (k.type) {
        case 'business': {
          const cubes = S.bizCubes[k.id] || []; const N = S.cfg.closeAt; const grp = window.HEIST_DATA.locations.businesses.find(b => b.id === k.id).group;
          const mates = window.HEIST_DATA.locations.businesses.filter(b => b.group === grp).map(b => nm(b.id)).join(', ');
          st = S.closed[k.id] ? (pt ? '🔒 Fechado — precisas de uma chave (qualquer cor) ou da Chave Mestra.' : '🔒 Closed — you need a key (any colour) or the Master Key.') : (pt ? `Visitas: ${cubes.length}/${N} (fecha às ${N}).` : `Visits: ${cubes.length}/${N} (closes at ${N}).`);
          body = li([others, pt ? 'tiras o cubo de cima do rendimento; no Plano de Fuga: valor = dinheiro no fim, <b>$</b> = recebes rendimento já' : 'take your top income cube; on your Escape Plan: a value = money at the end, <b>$</b> = receive income now', contact]) + (pt ? `<small>Só 1 visita tua. Grupo: ${mates} — visitar os 3 dá uma Ação Extra, ou desbloquear um ativo e −1 de notoriedade.</small>` : `<small>You may visit it once. Group: ${mates} — visiting all 3 gives an Extra Action, or unlock an asset and −1 notoriety.</small>`);
          break; }
        case 'safehouse': {
          const keys = S.shKeys[k.id] || []; const kn = { green: pt ? 'verde' : 'green', black: pt ? 'preta' : 'black', brown: pt ? 'castanha' : 'brown' };
          st = keys.length ? (pt ? 'Chaves aqui: ' : 'Keys here: ') + keys.map(x => kn[x]).join(', ') + '.' : (pt ? 'Já não há chaves.' : 'No keys left.');
          body = li([others, pt ? 'tiras o cubo de cima do rendimento (Plano de Fuga: dinheiro no fim ou rendimento já)' : 'take your top income cube (Escape Plan: money at the end or income now)', pt ? '−1 de notoriedade' : '−1 notoriety', pt ? 'levas uma das chaves' : 'take one of the keys', pt ? 'podes comprar um Fixer (ajudante de uso único)' : 'you may buy a Fixer (one-use helper)']) + (pt ? '<small>Só 1 visita tua. Visitar as 3 dá uma Ação Extra, ou desbloquear um ativo e receber rendimento.</small>' : '<small>You may visit it once. Visiting all 3 gives an Extra Action, or unlock an asset and receive income.</small>');
          break; }
        case 'store':
          body = li([others, pt ? 'levas uma lata de gasolina (máx. 2)' : 'take a Gas Can (max 2)', pt ? 'compras até 2 equipamentos diferentes' : 'buy up to 2 different pieces of equipment', pt ? 'abres 1 cacifo se tiveres a chave da cor e notoriedade + cartas ≥ verde 1 / preto 5 / castanho 8' : 'open 1 locker if you have that colour key and notoriety + cards ≥ green 1 / black 5 / brown 8']);
          break;
        case 'exit': {
          const open = S.patrolSpaces[k.n] < 2;
          st = open ? (pt ? '🟢 Saída aberta.' : '🟢 Exit open.') : (pt ? '🔴 Saída fechada (2 cartas de patrulha).' : '🔴 Exit closed (2 patrol cards).');
          body = li([others, open ? (pt ? 'podes receber rendimento' : 'you may receive income') : (pt ? 'recebes rendimento <i>ou</i> tiras peças de saída (1 por carta de Contacto) e guardas uma' : 'receive income <i>or</i> draw Exit tiles (1 per Contact card) and keep one'), contact]) + (open && S.day === 3 ? (pt ? '<small>No Dia 3 podes fugir por aqui: evitas a polícia (incluindo a desta peça) e pagas o custo de saída.</small>' : '<small>On Day 3 you can escape here: avoid the police (including this tile\'s) and pay the exit cost.</small>') : '');
          break; }
        case 'hospital':
          body = li([pt ? 'podes pagar $1k / $3k / $6k para curar 1 / 2 / 3 ferimentos' : 'you may pay $1k / $3k / $6k to heal 1 / 2 / 3 wounds', pt ? 'depois +1 de notoriedade (os médicos reportam ferimentos de bala)' : 'then +1 notoriety (doctors report bullet wounds)']) + (pt ? '<small>Não ganhas notoriedade pelos outros jogadores aqui. Esta peça nunca tem polícia.</small>' : '<small>No notoriety for other players here. This tile never has police.</small>');
          break;
        case 'clinic':
          body = li([others, pt ? 'podes desbloquear um ativo' : 'you may unlock an asset', pt ? 'podes curar 1 ferimento' : 'you may heal 1 wound', contact]);
          break;
        case 'church':
          body = li([others, pt ? 'podes pagar $1k para perder 1 de notoriedade' : 'you may pay $1k to lose 1 notoriety', pt ? 'podes desbloquear um ativo' : 'you may unlock an asset', contact]);
          break;
        case 'gang': {
          const g = S.gangs[id];
          st = g && g.ctrl != null ? (pt ? `Controlado por ${pname(g.ctrl)}.` : `Controlled by ${pname(g.ctrl)}.`) : g && g.members >= 2 ? (pt ? 'Livre — os 2 motards estão cá.' : 'Free — both bikers are here.') : (pt ? 'Ainda não está livre.' : 'Not free yet.');
          body = li([pt ? 'só se não estiver cá ninguém e ninguém o controlar' : 'only if nobody is here and nobody controls it', pt ? 'pagas $5k, levas os 2 motards e pões cá o teu marcador' : 'pay $5k, take both bikers and place your control marker']) + (pt ? '<small>Cada motard, ao ser devolvido: −1 de notoriedade, voar de uma peça com helipad até 2 peças, ou ignorar toda a polícia de uma peça.</small>' : '<small>Each biker, when returned: −1 notoriety, fly from a helipad tile up to 2 tiles, or ignore all police on one tile.</small>');
          break; }
        case 'subway':
          body = pt ? 'Ao entrar, saltas para qualquer outro metro de graça e ganhas +1 de movimento. Não é um destino: continuas a viagem. As peças pelo meio não contam para evitar polícia.' : 'When you enter, jump to any other subway for free and gain +1 MP. Not a destination: you keep travelling. Tiles in between don\'t count for avoiding police.';
          break;
        case 'heliport':
          body = pt ? 'Gasta 1 de movimento para voar para qualquer sítio numa peça a 1–2 de distância. As peças pelo meio não contam para evitar polícia.' : 'Spend 1 MP to fly anywhere on a tile 1–2 tiles away. Tiles in between don\'t count for avoiding police.';
          break;
        default: body = topic('movement');
      }
      const TLc = E.TILE[S.cells[c].tile]; const LNm = { I: 'Industrial', C: pt ? 'Comercial' : 'Commercial', R: pt ? 'Residencial' : 'Residential', W: pt ? 'Água' : 'Water' };
      const lands = [...new Set(TLc.locs.find(l => l.id === id).adj.map(a => a[0]))].map(T => `<span class="lt ${T}">${LNm[T]}</span>`).join(' ');
      const onEdge = TLc.sides.some(sd => sd.some(([a]) => a === '@' + id));
      st = (st ? st + '<br>' : '') + (pt ? 'Liga a: ' : 'Touches: ') + lands + (onEdge ? (pt ? '<br>📐 Toca na margem da peça: liga diretamente ao terreno (ou local) da peça vizinha desse lado.' : '<br>📐 Reaches the tile edge: connects straight to the land (or location) of the neighbouring tile on that side.') : '');
      return `<b>${locName(id)}</b>${st ? st + '<br>' : ''}${cops.length ? '👮 ' + cops.join(', ') + '<br>' : ''}${body}`;
    }
    case 'cop': return `<b>${t('types.' + id)}</b>${pt ? 'Ao sair desta peça tens de o evitar ou levas um ferimento.' : 'When you leave this tile you must avoid it or take a wound.'}`;
    case 'contact': { const C = E.CONTACT[id]; return `<b>${C.name} — $${C.cost}k ${C.notoriety ? '★' : ''}</b>${T.effect(C.effect, C.types || (C.type ? [C.type] : null))}${C.notoriety ? (pt ? '<br>★ Usar dá +1 de notoriedade.' : '<br>★ Using it gives +1 notoriety.') : ''}<br>${C.step === 'avoid' ? (pt ? 'Usa-se ao evitar a polícia.' : 'Used while avoiding police.') : (pt ? 'Usa-se a viajar / no teu turno.' : 'Used while travelling / on your turn.')}`; }
    case 'equip': { const Q = E.EQUIP[id]; return `<b>${nm(id)} — $${Q.cost}k</b>${pt ? 'Evita 1 polícia ' : 'Avoids 1 '}${(Q.avoids || Q.avoids_one_of).map(x => t('types.' + x)).join(pt ? ' ou ' : ' or ')}${pt ? '. Recupera-se ao descansar.' : ' officer. Refreshed when you rest.'}`; }
    case 'fixer': { const F = E.FIXER[id]; return `<b>Fixer: ${nm(id)} — $${F.cost}k</b>${T.effect(F.effect)}. ${pt ? 'Uso único.' : 'One use.'}`; }
    case 'asset': return `<b>${nm(id)}</b>${assetEff(id)}. ${pt ? 'Depois de desbloqueado, usa-se uma vez pagando o custo do espaço; vale $10k no fim.' : 'Once unlocked, use it once paying its space cost; worth $10k at the end.'}`;
    case 'bag': return `<b>${pt ? 'Saco de dinheiro' : 'Money bag'}</b>${pt ? 'Valor secreto, soma-se no fim.' : 'Secret value, added at the end.'}`;
    case 'part': return `<b>${t('parts')[+id]}</b>${+id >= 3 ? (pt ? 'Só joga quem gastar uma Ação Extra.' : 'Only players spending an Extra Action play.') : (pt ? 'Todos fazem uma ação.' : 'Everyone takes one action.')}`;
    case 'exit': { const c = S.patrolSpaces[+id]; return `<b>${nm('exit' + id)}</b>${c >= 2 ? (pt ? 'Fechada (2 patrulhas).' : 'Closed (2 patrols).') : (pt ? `Aberta — ${c} patrulha(s).` : `Open — ${c} patrol card(s).`)}`; }
    case 'stat': if (['cards', 'equip', 'bags', 'keys', 'cuffs'].includes(id)) return `<b>${t('chip.' + id)}</b>${t('chipHelp.' + id)}`; { const m = { money: ['money', 'exits'], income: ['income', 'business'], notor: ['notoriety', 'notoriety'], wounds: ['wounds', 'police'], gas: ['gas', 'movement'], gang: ['gang', 'others'], discs: ['discs', 'assets'], rest: ['rest', 'actions'], firstaid: ['wounds', 'police'] }[id] || ['help', 'goal']; return `<b>${t(m[0])}</b>${topic(m[1])}`; }
    case 'plan': return `<b>${t('plan')}: ${nm(id)}</b>${pt ? 'Valor no fim do jogo, ou $ = rendimento imediato quando visitas.' : 'Value at the end of the game, or $ = instant income when you visit.'}`;
    case 'key': return `<b>${t('keys')}</b>${pt ? 'Abre um cacifo desta cor ou um Business fechado.' : 'Opens a locker of this colour or a closed Business.'}`;
    case 'locker': { const L = window.HEIST_DATA.lockers.lockers[id]; return `<b>${t('lockers')}: ${nm(id)}</b>${t('lockerHelp', L.min, L.draw)}`; }
    case 'th': return `<b>${t('thTitle', +id + 1)}</b>${t('thGain')[+id]}`;
    case 'track': return `<b>${t('notoriety')} ${id}</b>${topic('notoriety')}`;
    case 'biz': { const L = Object.keys(S.bizSlots || {}).find(x => S.bizSlots[x] === id); return L ? helpHTML('loc:' + L) : `<b>${nm(id)}</b>${topic('business')}`; }
    case 'pawn': return `<b>${pname(+id)}</b>`;
    case 'power': { const PW = window.HEIST_DATA.powers.powers.find(x => x.id === id); return `<b>${PW.name} — ${PW.title}</b>${T.powerText(PW)}`; }
    case 'ui': if (id.startsWith('set_')) return `<b>${t('setTitle')}</b>${t(id === 'set_sh' ? 'setHelpSh' : 'setHelpBiz')}`; if (id === 'nbox') return `<b>${t('nbTitle')}</b>${t('nbHelp')}`; if (id === 'left') return `<b>${t('leftT')}</b>${t('leftHelp')}`; if (id === 'incHex') return `<b>$ ${t('incomeNow')}</b>${t('incHelp')}`; if (id === 'endHex') return `<b>${t('endMoney')}</b>${t('endHelp')}`; if (id === 'order') return `<b>${t('turnOrder')}</b>${G.S.order.map((x, i) => (i + 1) + '. ' + pname(x)).join('<br>')}`; return id === 'rules' ? `<b>${t('rules')}</b>${pt ? 'Manual completo com pesquisa.' : 'Full manual with search.'}` : id === 'rest' ? `<b>${t('rest')}</b>${t('restHint')}` : `<b>${t('speed')}</b>`;
  }
  return '';
}
function bindTips() {
  const showTip = (el, x, y) => { const h = helpHTML(el.dataset.h); if (!h) return; let tip = $('.tip'); if (!tip) { tip = document.createElement('div'); tip.className = 'tip'; document.body.appendChild(tip); } tip.innerHTML = h; const w = 280; tip.style.left = Math.min(window.innerWidth - w - 8, x + 14) + 'px'; tip.style.top = Math.min(window.innerHeight - tip.offsetHeight - 8, y + 14) + 'px'; };
  const hideTip = () => { const tip = $('.tip'); tip && tip.remove(); };
  let timer = null, lp = null;
  let lastTouch = 0; document.addEventListener('touchstart', () => { lastTouch = Date.now(); }, { passive: true, capture: true });
  document.addEventListener('mouseover', (e) => { if (Date.now() - lastTouch < 1200) return; const el = e.target.closest && e.target.closest('[data-h]'); clearTimeout(timer); if (!el) { hideTip(); return; } timer = setTimeout(() => showTip(el, e.clientX, e.clientY), 380); });
  document.addEventListener('mouseout', (e) => { if (!e.relatedTarget || !(e.relatedTarget.closest && e.relatedTarget.closest('[data-h]'))) { clearTimeout(timer); hideTip(); } });
  document.addEventListener('touchstart', (e) => { const el = e.target.closest && e.target.closest('[data-h]'); if (!el) return; const tch = e.touches[0]; lp = setTimeout(() => { showTip(el, tch.clientX, tch.clientY); }, 450); }, { passive: true });
  document.addEventListener('touchend', () => { clearTimeout(lp); setTimeout(hideTip, 1600); });
  document.addEventListener('touchmove', () => clearTimeout(lp), { passive: true });
}

// ---------------- rules assistant ----------------
function openRules(topicId) {
  const lang = G.prefs.lang; let cur = topicId || 'goal'; let q = '';
  const host = document.createElement('div'); host.id = 'rules';
  const draw = () => {
    const res = q ? R.search(q, lang) : null;
    const list = (res || R.topics).map(tp => `<button class="${tp.id === cur ? 'on' : ''}" data-t="${tp.id}">${tp.icon} ${tp.title[lang]}</button>`).join('') || `<div style="padding:8px;color:var(--ink2)">${t('noResults')}</div>`;
    const tp = R.topics.find(x => x.id === cur);
    host.innerHTML = `<div class="box paper" style="position:relative"><nav><input id="rq" placeholder="${t('search')}" value="${q.replace(/"/g, '&quot;')}">${list}</nav><article><h2>${tp.icon} ${tp.title[lang]}</h2>${tp.body[lang]}${refHTML(cur)}</article><button class="close ghost" id="rX" style="color:var(--ink)">✕</button></div>`;
    $$('nav button', host).forEach(b => b.onclick = () => { cur = b.dataset.t; draw(); });
    const inp = $('#rq', host); inp.oninput = () => { q = inp.value; const r = q ? R.search(q, lang) : null; if (r && r.length) cur = r[0].id; draw(); const i2 = $('#rq', host); i2.focus(); i2.setSelectionRange(q.length, q.length); };
    $('#rX', host).onclick = () => host.remove();
    host.onclick = (e) => { if (e.target === host) host.remove(); };
  };
  document.body.appendChild(host); draw();
}
function refHTML(id) {
  const pt = G.prefs.lang === 'pt';
  if (id === 'contacts') { const seen = {}; return `<h3 style="font-family:var(--ff-type)">${pt ? 'Todas as cartas' : 'All cards'}</h3><div style="display:flex;flex-wrap:wrap;gap:8px">${window.HEIST_DATA.contacts.cards.filter(c => { const k = c.name + c.cost + c.effect + (c.type || '') + (c.types || []).join(); if (seen[k]) return false; seen[k] = 1; return true; }).map(c => `<div style="display:flex;gap:8px;align-items:center;width:270px">${contactCardHTML(c.id)}<span style="font-size:13px">${T.effect(c.effect, c.types || (c.type ? [c.type] : null))}</span></div>`).join('')}</div>`; }
  if (id === 'safehouse') return `<h3 style="font-family:var(--ff-type)">Fixers</h3>${window.HEIST_DATA.fixers.fixers.map(f => `<div class="kv"><span>${ic(IC.FIX[f.id])} ${nm(f.id)} — $${f.cost}k</span><span style="font-size:13px">${T.effect(f.effect)}</span></div>`).join('')}`;
  if (id === 'assets') return `<h3 style="font-family:var(--ff-type)">${pt ? 'Ativos' : 'Assets'}</h3>${window.HEIST_DATA.assets.assets.map(a => `<div class="kv"><span>${ic(IC.ASSET[a.id])} ${nm(a.id)}</span><span style="font-size:13px">${assetEff(a.id)}</span></div>`).join('')}`;
  if (id === 'police') return `<h3 style="font-family:var(--ff-type)">${pt ? 'Equipamento' : 'Equipment'}</h3>${window.HEIST_DATA.equipment.equipment.map(q => `<div class="kv"><span>${ic(IC.EQUIP[q.id])} ${nm(q.id)} — $${q.cost}k</span><span>${(q.avoids || q.avoids_one_of).map(x => t('types.' + x)).join(' / ')}</span></div>`).join('')}`;
  return '';
}

// ---------------- effects ----------------
function fx() { return $('#fx'); }
function floatAt(x, y, html, color) { if (!spd()) return; const d = document.createElement('div'); d.className = 'float'; d.style.left = x + 'px'; d.style.top = y + 'px'; d.style.color = color || '#fff'; d.innerHTML = html; fx().appendChild(d); setTimeout(() => d.remove(), 1500 * spd() + 100); }
function playerAnchor(pid) {
  const S = G.VS; const q = E.P(S, pid); if (q && !q.escaped && !q.arrested) { const spots = pawnSpots(S); const p = spots[pid]; const sc = p && screenOf(p); if (sc) return { x: sc.x, y: sc.y - 40 }; }
  const pc = $('#pc-' + pid); if (pc) { const r = pc.getBoundingClientRect(); if (r.width) return { x: r.left + r.width / 2, y: r.top + 20 }; }
  return { x: window.innerWidth / 2, y: window.innerHeight / 2 };
}
function banner(text, small) { if (!spd()) return; const d = document.createElement('div'); d.className = 'banner'; d.innerHTML = (small ? `<small>${small}</small>` : '') + text; fx().appendChild(d); setTimeout(() => d.remove(), 1500 * spd()); }
function stamp(text) { if (!spd()) return; const d = document.createElement('div'); d.className = 'stamp'; d.textContent = text; d.style.left = '50%'; d.style.top = '40%'; d.style.marginLeft = '-140px'; fx().appendChild(d); setTimeout(() => d.remove(), 1400 * spd()); }
function flyCard(card, pid) {
  if (!spd()) return; const d = document.createElement('div'); d.className = 'flycard'; d.innerHTML = contactCardHTML(card);
  const r = $('#mapwrap').getBoundingClientRect(); d.style.left = (r.left + r.width / 2 - 37) + 'px'; d.style.top = (r.top + 20) + 'px'; d.style.transform = 'scale(1.3)'; fx().appendChild(d);
  const a = playerAnchor(pid); requestAnimationFrame(() => requestAnimationFrame(() => { d.style.left = (a.x - 37) + 'px'; d.style.top = (a.y - 50) + 'px'; d.style.transform = 'scale(.5)'; d.style.opacity = '0.2'; }));
  setTimeout(() => d.remove(), 900 * spd() + 50);
}
function animate(dur, fn) { if (!spd() || dur <= 0) { fn(1); return Promise.resolve(); } return new Promise(res => { const t0 = performance.now(); const D = dur * spd(); const step = (now) => { const k = Math.min(1, (now - t0) / D); fn(k); if (k < 1) requestAnimationFrame(step); else res(); }; requestAnimationFrame(step); }); }
const ease = (k) => k < .5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
async function animPawn(pid, pts) {
  const el = $('#pawn-' + pid); if (!el || pts.length < 2) return;
  el.parentNode.appendChild(el);
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i]; const jump = b.jump; const dist = Math.hypot(b.x - a.x, b.y - a.y);
    await animate(jump ? 520 : Math.max(140, dist * 1.6), (k) => { const e = ease(k); const x = a.x + (b.x - a.x) * e; let y = a.y + (b.y - a.y) * e; if (jump) y -= Math.sin(Math.PI * e) * 80; el.setAttribute('transform', `translate(${x},${y})`); });
  }
}
async function animCop(from, to, type) {
  const el = $(`#cop-${from}-${type}`); if (!el) return; const a = copXY(from, type), b = to >= 0 ? copXY(to, type) : { x: a.x, y: a.y - 200 };
  el.parentNode.appendChild(el);
  await animate(650, (k) => { const e = ease(k); el.setAttribute('transform', `translate(${a.x + (b.x - a.x) * e},${a.y + (b.y - a.y) * e - Math.sin(Math.PI * e) * 70}) scale(${1 + Math.sin(Math.PI * e) * .4})`); if (to < 0) el.setAttribute('opacity', 1 - e); });
}
function flashPanel(pid, cls) { const el = $('#pc-' + pid); if (!el) return; el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls); }

// ---------------- event playback (visual state replay) ----------------
function addLog(e) {
  const txt = T.narrate(e, narrCtx); if (!txt) return;
  const cls = e.t === 'turn' ? 'turnline' : (e.t === 'phase' || e.t === 'day' || e.t === 'part') ? 'phase' : '';
  G.logLines.push({ html: txt, cls, e }); if (G.logLines.length > 600) G.logLines.splice(0, 100);
}
function refreshLogLang() { const evs = G.logLines.map(x => x.e); G.logLines = []; evs.forEach(e => e && addLog(e)); }
function patchVS(VS, S, e) {
  const q = e.p != null ? E.P(VS, e.p) : null; const qS = e.p != null ? E.P(S, e.p) : null;
  const copyBoard = () => { if (!q || !qS || q.npc) return; ['items', 'contacts', 'unlocked', 'keys', 'gas', 'gangMembers', 'ctrlFree', 'discs', 'rest', 'firstAid', 'cuffs', 'visited', 'bonus'].forEach(k => q[k] = JSON.parse(JSON.stringify(qS[k]))); };
  switch (e.t) {
    case 'day': VS.day = e.day; VS.part = 0; break;
    case 'part': VS.part = e.part; break;
    case 'patrol': VS.patrolSpaces[e.exit] = e.count; VS.patrol = S.patrol.slice(); break;
    case 'exitClosed': VS.exitOn = E.clone(S.exitOn); break;
    case 'place': VS.cells[e.cell] = E.clone(S.cells[e.cell]); VS.display = VS.display.filter(d => d.tile !== e.tile); VS.bizSlots = E.clone(S.bizSlots); VS.shSlots = E.clone(S.shSlots); VS.gangs = E.clone(S.gangs); break;
    case 'display': VS.display = E.clone(S.display); break;
    case 'order': VS.order = e.order.slice(); break;
    case 'move': if (q) q.loc = e.to; break;
    case 'npcMoved': { const n = E.P(VS, e.npc); if (n) n.loc = e.to; break; }
    case 'money': if (q) { if (q.npc) q.debt = (q.debt || 0) - e.d; else q.money += e.d; } break;
    case 'notor': if (q) { if (e.red != null) { q.red = e.red; q.blue = e.blue; } else if (e.d > 0) q.red += e.d; else q.blue -= e.d; } break;
    case 'level': if (q) { q.notor = e.to; q.red = 0; q.blue = 0; } break;
    case 'wound': if (q && !q.npc) q.wounds = Math.min(3, q.wounds + 1); break;
    case 'heal': if (q) q.wounds = Math.max(0, q.wounds - e.n); break;
    case 'cuffs': if (q) { q.cuffs++; q.wounds = 2; copyBoard(); } break;
    case 'police': if (VS.cells[e.from]) VS.cells[e.from].police[e.type] = false; if (e.to >= 0 && VS.cells[e.to]) VS.cells[e.to].police[e.type] = true; break;
    case 'policeRemove': if (VS.cells[e.from]) VS.cells[e.from].police[e.type] = false; break;
    case 'cube': (VS.bizCubes[e.at] || VS.shCubes[e.at] || []).push({ pid: e.p, income: !!e.income }); if (q && !q.npc) q.income = Math.max(0, q.income - 1); if (q) q.visited[e.at] = true; break;
    case 'closed': VS.closed[e.biz] = true; break;
    case 'contact': case 'contactDiscard': case 'npcContact': VS.cdisplay = VS.cdisplay.filter(c => c !== e.card); if (e.t === 'contact') copyBoard(); if (e.t === 'npcContact' && q) q.contacts.push(e.card); break;
    case 'cdraw': if (!VS.cdisplay.includes(e.card)) { if ((VS.npcs || []).length) VS.cdisplay.unshift(e.card); else VS.cdisplay.push(e.card); } break;
    case 'key': case 'keyDiscard': VS.shKeys = E.clone(S.shKeys); copyBoard(); break;
    case 'gangHire': case 'useGang': case 'gangFree': VS.gangs = E.clone(S.gangs); copyBoard(); break;
    case 'item': case 'itemLost': case 'locker': VS.fixers = S.fixers.slice(); VS.equip = E.clone(S.equip); VS.lockers = E.clone(S.lockers); copyBoard(); break;
    case 'fixerDiscard': VS.fixers = S.fixers.slice(); break;
    case 'lockerDiscard': VS.lockers = E.clone(S.lockers); break;
    case 'gas': case 'gasUse': VS.gasSupply = S.gasSupply; copyBoard(); break;
    case 'escape': if (q) { q.escaped = true; q.escapeOrder = e.order; } VS.escapes = e.order; break;
    case 'arrest': if (q) q.arrested = true; break;
    case 'unlock': case 'unlockLost': case 'useContact': case 'useFixer': case 'useEquip': case 'useAsset': case 'firstAid': case 'rest': case 'refresh': case 'disc': case 'discGain': case 'restBack': case 'keyUse': copyBoard(); if (q && q.npc && (e.t === 'disc' || e.t === 'discGain')) q.discs = qS.discs; if (e.t === 'discGain' || e.t === 'disc') VS.discs = S.discs; break;
    case 'npcStack': if (q && qS) q.stacks = E.clone(qS.stacks); break;
  }
}
async function playEvent(e) {
  const S = G.S, VS = G.VS; const k = spd();
  addLog(e);
  const redraw = () => { renderMap(); renderTop(); renderSide(); setTicker(); };
  switch (e.t) {
    case 'day': patchVS(VS, S, e); redraw(); banner(`${t('day')} ${e.day}`, G.prefs.lang === 'pt' ? 'novo dia' : 'a new day'); await wait(1300); return;
    case 'phase': VS.uiPhase = e.ph; redraw(); if (e.ph !== 'order') { banner(t('phases.' + e.ph)); await wait(900); } return;
    case 'part': VS.uiPhase = null; patchVS(VS, S, e); redraw(); banner(t('parts')[e.part], `${t('day')} ${VS.day}`); await wait(900); return;
    case 'patrol': patchVS(VS, S, e); redraw(); { const b = $$('.exitb')[e.exit - 1]; b && b.classList.add('flash'); } if (e.count === 2) stamp(`EXIT ${e.exit}`); await wait(e.count === 2 ? 1200 : 600); return;
    case 'place': G.dropCell = e.cell; patchVS(VS, S, e); redraw(); { const el = $('#tile-' + e.cell); if (el && k) { el.style.transformBox = 'fill-box'; el.style.transformOrigin = 'center'; el.animate([{ transform: el.getAttribute('transform') + ' scale(1.5)', opacity: 0 }, { transform: el.getAttribute('transform') + ' scale(1)', opacity: 1 }], { duration: 600 * k, easing: 'cubic-bezier(.3,1.4,.6,1)' }); } } G.dropCell = null; await wait(650); return;
    case 'display': patchVS(VS, S, e); redraw(); return;
    case 'order': patchVS(VS, S, e); redraw(); await wait(300); return;
    case 'turn': redraw(); if (isHuman(e.p)) { banner(t('yourTurn'), pname(e.p)); await wait(900); } else await wait(350); return;
    case 'move': {
      const q = E.P(VS, e.p); const spots = pawnSpots(VS); const start = spots[e.p];
      const pts = [start || nodeXY(VS, e.from)]; const path = bestPath(VS, e.path, e.alts);
      const rp = routePts(VS, path); rp.slice(1, -1).forEach(p => pts.push(p));
      const last = nodeXY(VS, e.to); const lastNode = path[path.length - 1]; if (last) pts.push(Object.assign({ jump: /^[~^%]/.test(lastNode) }, { x: last.x, y: last.y + 34 }));
      redraw(); await animPawn(e.p, pts.filter(Boolean)); patchVS(VS, S, e); redraw(); await wait(150); return;
    }
    case 'police': { redraw(); await animCop(e.from, e.to, e.type); patchVS(VS, S, e); redraw(); return; }
    case 'policeRemove': { redraw(); await animCop(e.from, -1, e.type); patchVS(VS, S, e); redraw(); return; }
    case 'money': { patchVS(VS, S, e); redraw(); const a = playerAnchor(e.p); floatAt(a.x, a.y, `${e.d > 0 ? '+' : '−'}$${Math.abs(e.d)}k`, e.d > 0 ? '#7fe08a' : '#ff8a7a'); await wait(380); return; }
    case 'notor': { patchVS(VS, S, e); redraw(); const a = playerAnchor(e.p); floatAt(a.x + 30, a.y + 10, `${e.d > 0 ? '+' : '−'}${Math.abs(e.d)}★`, e.d > 0 ? '#ff7a6e' : '#8fc7ff'); const nb = document.getElementById('nb-' + e.p); if (nb) { nb.classList.remove('pulse'); void nb.offsetWidth; nb.classList.add('pulse'); } await wait(320); return; }
    case 'level': { patchVS(VS, S, e); redraw(); flashPanel(e.p, 'flash'); await wait(280); return; }
    case 'threshold': { redraw(); banner(`⚠ ${pname(e.p)}`, G.prefs.lang === 'pt' ? `linha ${e.n} de notoriedade` : `notoriety line ${e.n}`); await wait(1000); return; }
    case 'wound': { patchVS(VS, S, e); redraw(); const a = playerAnchor(e.p); floatAt(a.x, a.y, '🩸', '#ff4a3a'); flashPanel(e.p, 'flashred'); await wait(450); return; }
    case 'cuffs': { patchVS(VS, S, e); redraw(); banner('⛓', pname(e.p)); await wait(900); return; }
    case 'heal': { patchVS(VS, S, e); redraw(); const a = playerAnchor(e.p); floatAt(a.x, a.y, '✚' + e.n, '#7fe08a'); await wait(380); return; }
    case 'contact': case 'npcContact': { patchVS(VS, S, e); redraw(); flyCard(e.card, e.p); await wait(700); return; }
    case 'contactDiscard': { patchVS(VS, S, e); redraw(); const a = playerAnchor(e.p); floatAt(a.x, a.y - 10, '🃏✕ ' + cardName(e.card), '#ccc'); await wait(450); return; }
    case 'useContact': case 'useFixer': case 'useEquip': case 'useAsset': case 'firstAid': case 'useGang': { patchVS(VS, S, e); redraw(); const a = playerAnchor(e.p); const label = e.t === 'useContact' ? cardName(e.card) : e.t === 'useFixer' || e.t === 'useEquip' || e.t === 'useAsset' ? nm(e.id) : e.t === 'useGang' ? '🏍' : '✚'; floatAt(a.x, a.y - 24, '⚡ ' + label, '#e8b546'); await wait(500); return; }
    case 'avoided': { redraw(); const p = copXY(e.cell, e.type || 'federal'); const sc = screenOf(p); sc && floatAt(sc.x, sc.y - 10, '🛡', '#8fe0ff'); await wait(380); return; }
    case 'visit': { redraw(); const p = locXY(VS, e.loc); const sc = p && screenOf(p); sc && floatAt(sc.x, sc.y - 30, locName(e.loc), '#fff'); await wait(450); return; }
    case 'cube': case 'closed': { patchVS(VS, S, e); redraw(); if (e.t === 'closed') { const sl = Object.keys(VS.bizSlots).find(k2 => VS.bizSlots[k2] === e.biz); const p = sl && locXY(VS, sl); const sc = p && screenOf(p); sc && floatAt(sc.x, sc.y, '🔒', '#f2c629'); } await wait(400); return; }
    case 'unlock': { patchVS(VS, S, e); redraw(); const a = playerAnchor(e.p); floatAt(a.x, a.y - 20, '🔓 ' + nm(e.id), '#c8a8ff'); await wait(550); return; }
    case 'rest': { patchVS(VS, S, e); redraw(); const a = playerAnchor(e.p); floatAt(a.x, a.y - 20, '☾ ' + t('rest'), '#9fb3d9'); await wait(650); return; }
    case 'escape': { patchVS(VS, S, e); redraw(); banner('🚗💨 ' + pname(e.p), G.prefs.lang === 'pt' ? `fugiu (${e.order}.º)` : `escaped (#${e.order})`); await wait(1400); return; }
    case 'arrest': { patchVS(VS, S, e); redraw(); banner('🚨 ' + pname(e.p), t('arrested')); await wait(1300); return; }
    case 'gangHire': { patchVS(VS, S, e); redraw(); const a = playerAnchor(e.p); floatAt(a.x, a.y - 20, '🏍🏍', '#e8b546'); await wait(600); return; }
    case 'key': case 'gas': case 'item': case 'locker': case 'discGain': case 'refresh': { patchVS(VS, S, e); redraw(); const a = playerAnchor(e.p); const lab = { key: '🔑', gas: '⛽', item: e.item && (e.item.kind === 'locker' || e.item.kind === 'exit') ? '💰' : '🛠', locker: '🗄', discGain: '⊕', refresh: '↻' }[e.t]; floatAt(a.x, a.y - 20, lab, '#fff'); await wait(450); return; }
    case 'gameOver': return;
    default: patchVS(VS, S, e); if (T.narrate(e, narrCtx)) { redraw(); await wait(180); } return;
  }
}
async function playAll() {
  const S = G.S; const evs = S.events.splice(0);
  for (const e of evs) { await playEvent(e); }
  const ph = G.VS.uiPhase; G.VS = E.clone(S); G.VS.uiPhase = S.pending && S.pending.type === 'place' ? 'city' : (S.pending && (S.pending.type === 'yesno' && S.pending.q === 'incomeUnlock') ? 'income' : (S.pending && ['action', 'avoid', 'end', 'contact', 'choose', 'unlock', 'policeMove', 'pickTile'].includes(S.pending.type) ? null : ph)); G.skip = G.skip && !(S.pending && isHuman(S.pending.pid));
}

// ---------------- game loop ----------------
async function loop() {
  if (G.looping) return; G.looping = true;
  try {
    while (true) {
      const S = G.S; if (!S || G.screen !== 'game') break;
      if (S.events.length) { G.busy = true; renderBar(); await playAll(); }
      if (S.over) { G.busy = false; renderAll(); saveGame(); showEnd(); break; }
      const pd = S.pending; if (!pd) break;
      if (isHuman(pd.pid)) { G.busy = false; G.skip = false; G.viewer = pd.pid; renderAll(); saveGame(); break; }
      G.busy = true; renderBar();
      await wait(pd.type === 'action' ? 450 : 200);
      const a = AI.decide(E, S); E.act(S, a);
    }
  } catch (err) { console.error(err); showError(err); }
  G.looping = false;
}
function human(a) {
  const S = G.S; G.sel = {}; closeSheet(); $('.pop') && $('.pop').remove();
  try { E.act(S, a); } catch (err) { console.error(err); showError(err); return; }
  loop();
}
function showError(err) { const d = document.createElement('div'); d.className = 'tip'; d.style.cssText = 'left:10px;top:60px;max-width:90vw;pointer-events:auto;background:#5a1212'; d.innerHTML = `<b>Oops</b>${String(err && err.message || err)}<br><button onclick="this.parentNode.remove()">OK</button>`; document.body.appendChild(d); }

// ---------------- screens ----------------
function renderAll() { if (G.screen !== 'game') { if (G.screen === 'menu') showMenu(); if (G.screen === 'setup') showSetup(); return; } refreshLogLang(); renderTop(); renderMap(); renderSide(); renderBar(); }
function showMenu() {
  G.screen = 'menu'; const app = $('#app');
  app.innerHTML = `<div class="screen"><div class="tape" style="top:8%;left:-40px;transform:rotate(-8deg)">POLICE LINE · DO NOT CROSS · POLICE LINE · DO NOT CROSS</div><div class="tape" style="bottom:10%;right:-40px;transform:rotate(6deg)">POLICE LINE · DO NOT CROSS · POLICE LINE</div>
  <div class="logo">H<span>E</span>IST</div><div class="tag">${t('subtitle')}</div>
  <div class="menu-btns">${hasSave() ? `<button class="pri" id="mCont">${ic('play')} ${t('continue')}</button>` : ''}<button class="${hasSave() ? '' : 'pri'}" id="mNew">${t('newGame')}</button><button id="mRules">${ic('book')} ${t('rules')}</button></div>
  <div class="lang-switch"><button class="${G.prefs.lang === 'en' ? 'on' : ''}" data-l="en">English</button><button class="${G.prefs.lang === 'pt' ? 'on' : ''}" data-l="pt">Português</button></div></div>`;
  $('#mNew').onclick = showSetup; $('#mRules').onclick = () => openRules();
  $('#mCont') && ($('#mCont').onclick = () => { try { const sv = JSON.parse(localStorage.getItem('heist.save')); G.S = sv.S; G.logLines = (sv.log || []); startScreen(); } catch (e) { showSetup(); } });
  $$('.lang-switch button').forEach(b => b.onclick = () => { G.prefs.lang = b.dataset.l; T.set(b.dataset.l); savePrefs(); showMenu(); });
}
const SEATS = ['orange', 'purple', 'pink', 'yellow', 'green'];
function showSetup() {
  G.screen = 'setup';
  if (!G.setup) G.setup = { seats: { orange: 'human', purple: 'ai', pink: 'ai', yellow: 'ai', green: 'off' }, gas: true, fix: true, easy: false, speed: G.prefs.speed, mode: 'base', assign: 'random', powers: {} };
  const st = G.setup; const app = $('#app');
  const n = SEATS.filter(c => st.seats[c] !== 'off').length; const nh = SEATS.filter(c => st.seats[c] === 'human').length;
  const POW = window.HEIST_DATA.powers.powers;
  const usePow = st.mode === 'powers' || st.mode === 'both';
  const powSel = (c) => usePow && st.assign === 'free' && st.seats[c] !== 'off' ? `<select data-pw="${c}" style="max-width:150px"><option value="">${t('randomPower')}</option>${POW.map(x => `<option value="${x.id}" ${st.powers[c] === x.id ? 'selected' : ''}>${x.name} (${x.title})</option>`).join('')}</select>` : '';
  const seat = (c) => `<div class="seat"><span class="sw" style="background:${COLOR[c]}"></span><span class="nm">${t('colors.' + c)}</span>${powSel(c)}<div class="seg" data-c="${c}">${['human', 'ai', 'off'].map(v => `<button class="${st.seats[c] === v ? 'on' : ''}" data-v="${v}">${t(v === 'ai' ? 'computer' : v)}</button>`).join('')}</div></div>`;
  const modeNote = n === 1 ? `🕵️ ${t('npcSandra')} + 👮 ${t('npcCosta')}` : n === 2 ? `🕵️ ${t('npcSandra')}` : '';
  app.innerHTML = `<div class="screen"><div class="setup paper"><h2>${t('setupTitle')}</h2><div class="hint">${t('seatHint')}</div>${SEATS.map(seat).join('')}
   <div class="hint" style="margin-top:8px">${t('players')}: <b>${n}</b> ${modeNote ? ' · ' + modeNote : ''}</div>
   <div class="opts"><div class="opt"><label>${t('mode')}</label><div class="seg" id="oMode">${[['base', 'modeBase'], ['powers', 'modePowers'], ['missions', 'modeMissions'], ['both', 'modeBoth']].map(([v, k]) => `<button class="${st.mode === v ? 'on' : ''}" data-v="${v}">${t(k)}</button>`).join('')}</div>${st.mode === 'both' ? `<div class="hint" style="margin:4px 0 0">⚠ ${t('both')}</div>` : ''}</div>
   <div class="opt">${usePow ? `<label>${t('powerPick')}</label><div class="seg" id="oAssign">${[['free', 'pickFree'], ['random', 'pickRandom'], ['color', 'pickColor']].map(([v, k]) => `<button class="${st.assign === v ? 'on' : ''}" data-v="${v}">${t(k)}</button>`).join('')}</div>` : ''}</div>
   <div class="opt"><label>Upgrade Pack</label><div class="chk"><input type="checkbox" id="oGas" ${st.gas ? 'checked' : ''}><span>${t('upgradeGas')}</span></div><div class="chk"><input type="checkbox" id="oFix" ${st.fix ? 'checked' : ''}><span>${t('upgradeFix')}</span></div></div>
   <div class="opt">${n === 1 ? `<label>Solo</label><div class="chk"><input type="checkbox" id="oEasy" ${st.easy ? 'checked' : ''}><span>${t('easyCosta')}</span></div>` : ''}<label>${t('speed')}</label><div class="seg" id="oSpeed">${['slow', 'normal', 'fast'].map(v => `<button class="${G.prefs.speed === v ? 'on' : ''}" data-v="${v}">${t(v)}</button>`).join('')}</div></div></div>
   <div class="row" style="display:flex;gap:10px;justify-content:space-between"><button class="ghost" id="sBack" style="color:var(--ink);border-color:#0003">←</button><button class="pri" id="sGo" ${n < 1 || nh < 1 && n < 1 ? 'disabled' : ''}>${t('start')}</button></div></div></div>`;
  $$('.seg[data-c]').forEach(sg => $$('button', sg).forEach(b => b.onclick = () => { st.seats[sg.dataset.c] = b.dataset.v; showSetup(); }));
  $('#oGas').onchange = (e) => st.gas = e.target.checked; $('#oFix').onchange = (e) => st.fix = e.target.checked; $('#oEasy') && ($('#oEasy').onchange = (e) => st.easy = e.target.checked);
  $$('#oSpeed button').forEach(b => b.onclick = () => { G.prefs.speed = b.dataset.v; document.documentElement.style.setProperty('--speed', SPEEDS[G.prefs.speed]); savePrefs(); showSetup(); });
  $('#sBack').onclick = showMenu;
  $$('#oMode button').forEach(b => b.onclick = () => { st.mode = b.dataset.v; showSetup(); });
  $$('#oAssign button').forEach(b => b.onclick = () => { st.assign = b.dataset.v; showSetup(); });
  $$('select[data-pw]').forEach(sl => sl.onchange = () => { st.powers[sl.dataset.pw] = sl.value; });
  $('#sGo').onclick = () => {
    const players = SEATS.filter(c => st.seats[c] !== 'off').map(c => ({ color: c, name: t('colors.' + c) + (st.seats[c] === 'ai' ? ' 🤖' : ''), ai: st.seats[c] === 'ai' }));
    if (!players.length) return;
    if (usePow) {
      const COLORPOW = { purple: 'bones', orange: 'ruby', pink: 'vinnie', yellow: 'claws', green: 'scar' };
      const pool = POW.map(x => x.id).sort(() => Math.random() - .5);
      if (st.assign === 'color') players.forEach(p => p.power = COLORPOW[p.color]);
      else { if (st.assign === 'free') players.forEach(p => { const w = st.powers[p.color]; if (w && pool.includes(w)) { p.power = w; pool.splice(pool.indexOf(w), 1); } }); players.forEach(p => { if (!p.power) p.power = pool.shift(); }); }
    }
    G.S = E.newGame({ seed: (Math.random() * 2 ** 31) | 0, players, gasCan: st.gas, upgradeFixers: st.fix, easyCosta: st.easy, missions: st.mode === 'missions' || st.mode === 'both' });
    G.logLines = []; startScreen(true);
  };
}
function startScreen(fresh) {
  G.screen = 'game'; G.fitted = false; G.zoom = { k: 1, x: 0, y: 0 }; G.sel = {}; G.tab = 'me';
  const app = $('#app');
  app.innerHTML = `<div id="game"><div id="top"></div><div id="mapwrap"><svg id="map" xmlns="http://www.w3.org/2000/svg"></svg></div><div id="side"></div><div id="bar"><div id="ticker"></div><div id="prompt"></div></div></div>`;
  if (fresh) { G.VS = E.clone(G.S); G.VS.events = []; G.VS.cells = G.VS.cells.map(() => null); G.VS.display = []; G.VS.day = 1; G.VS.part = 0; }
  else { G.VS = E.clone(G.S); G.S.events = []; }
  // fresh: start tiles appear first
  if (fresh) { G.S.cells.forEach((c, i) => { if (c && (c.tile === 'S1' || c.tile === 'S2')) G.VS.cells[i] = E.clone(c); }); }
  bindPanZoom(); renderAll();
  window.onresize = () => { G.fitted = false; renderMap(); };
  loop();
}
function showEnd() {
  const S = G.S; const sc = S.score || E.score(S); const win = E.winners(S);
  const cats = ['g1', 'g2', 'sh', 'cash', 'assets', 'contacts', 'bags', 'notor', 'wounds'];
  const cols = sc.map(x => ({ x, name: x.npc ? t('costaScore') : pname(x.pid), col: x.npc ? '#2b3f6b' : pcolor(x.pid) }));
  const costa = sc.find(x => x.npc); const hum = sc.filter(x => !x.npc);
  let verdict = win.length ? `${t(win.length > 1 ? 'winners' : 'winner')}: ${win.map(id => id >= 100 ? t('costaScore') : pname(id)).join(', ')}` : t('arrested');
  if (costa && hum.length === 1) verdict = win.includes(hum[0].pid) ? t('beatCosta') : t('lostCosta');
  const d = document.createElement('div'); d.id = 'rules';
  d.innerHTML = `<div class="box paper" style="display:block;height:auto;max-height:95%;overflow:auto;padding:20px 22px;position:relative"><h2 style="font-family:var(--ff-type);margin:0">${t('gameOver')}</h2><div style="font-size:20px;margin:6px 0 10px;font-family:var(--ff-ui)">🏆 ${verdict}</div>
   <table class="scoretbl"><tr><th></th>${cols.map(c => `<th class="${win.includes(c.x.pid) ? 'win' : ''}"><span class="dot" style="background:${c.col}"></span> ${c.name}<br><small>${c.x.escaped ? '🚗 ' + t('escaped') : '🚨 ' + t('arrested')}</small></th>`).join('')}</tr>
   ${cats.map(k => `<tr><td>${t('score.' + k)}</td>${cols.map(c => `<td class="${win.includes(c.x.pid) ? 'win' : ''}">${c.x[k] ? (c.x[k] > 0 ? '' : '−') + '$' + Math.abs(c.x[k]) + 'k' : '—'}</td>`).join('')}</tr>`).join('')}
   <tr class="tot"><td>${t('total')}</td>${cols.map(c => `<td class="${win.includes(c.x.pid) ? 'win' : ''}">${c.x.escaped ? '$' + c.x.total + 'k' : '0'}</td>`).join('')}</tr></table>
   <div class="row" style="display:flex;gap:10px;margin-top:14px"><button class="pri" id="eAgain">${t('playAgain')}</button><button class="ghost" id="eMenu" style="color:var(--ink)">${t('menu')}</button><button class="ghost" id="eClose" style="color:var(--ink)">${t('close')}</button></div></div>`;
  document.body.appendChild(d);
  $('#eAgain').onclick = () => { d.remove(); showSetup(); }; $('#eMenu').onclick = () => { d.remove(); showMenu(); }; $('#eClose').onclick = () => d.remove();
}

// ---------------- boot ----------------
bindTips();
window.HeistUI = { G, E, T, startScreen, showMenu, human, loop, AI, helpHTML };
showMenu();
})();
