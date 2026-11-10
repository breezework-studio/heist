/* Heist — rules engine (base game). Pure state machine.
   state.pending describes the decision needed; E.act(state, action) applies it.
   state.events collects animation/narration events (UI drains them). */
(function (root) {
'use strict';
let D = null;
const E = {};
E.init = (data) => { D = data; E._D = data; prep(); };

// ---------- RNG ----------
function rnd(s) { // mulberry32 on state.rng
  s.rng = (s.rng + 0x6D2B79F5) | 0; let t = s.rng;
  t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
function shuffle(s, a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd(s) * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
const clone = (o) => JSON.parse(JSON.stringify(o));

// ---------- static data ----------
const COLORS = ['orange', 'purple', 'pink', 'yellow', 'green'];
const PTYPES = ['county', 'federal', 'swat'];
const PLAN_KEYS = ['casino', 'bar', 'restaurant', 'gym', 'nightclub', 'gallery', 'sh1', 'sh2', 'sh3'];
const GROUPS = { purple: ['casino', 'bar', 'restaurant'], blue: ['gym', 'nightclub', 'gallery'] };
const CONTACT_SCORE = [0, 0, 10, 30, 60, 100];
const UNLOCK_COSTS = [5, 4, 3, 2, 1, 1];
// 18-cell board, flat-top, odd-q (odd columns shifted down)
const CELLS = []; (() => { for (let c = 0; c < 5; c++) { const rows = c % 2 ? 3 : 4; for (let r = 0; r < rows; r++) CELLS.push({ c, r }); } })();
const START_CELLS = [CELLS.findIndex(x => x.c === 2 && x.r === 1), CELLS.findIndex(x => x.c === 2 && x.r === 2)];
const DIRS = [[0, -1], [1, -1], [1, 0], [0, 1], [-1, 1], [-1, 0]]; // axial dq,dr for edges N,NE,SE,S,SW,NW
function axial(i) { const { c, r } = CELLS[i]; return { q: c, r: r - (c - (c & 1)) / 2 }; }
function cellAt(q, r) { const c = q; if (c < 0 || c > 4) return -1; const row = r + (c - (c & 1)) / 2; return CELLS.findIndex(x => x.c === c && x.r === row); }
function nb(i, e) { const a = axial(i); return cellAt(a.q + DIRS[e][0], a.r + DIRS[e][1]); }
function hexDist(i, j) { const a = axial(i), b = axial(j); return (Math.abs(a.q - b.q) + Math.abs(a.r - b.r) + Math.abs(a.q + a.r - b.q - b.r)) / 2; }
E.CELLS = CELLS; E.axial = axial; E.hexDist = hexDist; E.nb = nb; E.COLORS = COLORS; E.PTYPES = PTYPES;
E.PLAN_KEYS = PLAN_KEYS; E.GROUPS = GROUPS; E.CONTACT_SCORE = CONTACT_SCORE; E.UNLOCK_COSTS = UNLOCK_COSTS;

let TILE = {}, CONTACT = {}, FIXER = {}, EQUIP = {}, ASSET = {};
function prep() {
  TILE = {}; D.tiles.tiles.forEach(t => TILE[t.id] = t);
  CONTACT = {}; D.contacts.cards.forEach(c => CONTACT[c.id] = c);
  FIXER = {}; D.fixers.fixers.forEach(f => FIXER[f.id] = f);
  EQUIP = {}; D.equipment.equipment.forEach(f => EQUIP[f.id] = f);
  ASSET = {}; D.assets.assets.forEach(a => ASSET[a.id] = a);
  E.TILE = TILE; E.CONTACT = CONTACT; E.FIXER = FIXER; E.EQUIP = EQUIP; E.ASSET = ASSET;
}
// half-edge land of placed tile at absolute edge e, half h (0 = first clockwise)
function land(tileId, rot, e, h) { const t = TILE[tileId]; const oe = ((e - rot) % 6 + 6) % 6; return t.edges[oe * 2 + h]; }
E.land = land;

// ---------- config by player count ----------
function trackCfg(n) {
  return n >= 4 ? { max: 7, th: [3, 6, 7], pen: [0, 0, 10, 30, 40, 60, 80, 100], closeAt: 3 }
                : { max: 6, th: [3, 5, 6], pen: [0, 0, 10, 30, 50, 80, 100], closeAt: 2 };
}
E.trackCfg = trackCfg;

// ---------- setup ----------
E.newGame = function (opts) {
  const s = { v: 1, rng: (opts.seed >>> 0) || ((Math.random() * 2 ** 31) | 0), events: [], log: [] };
  const n = opts.players.length; s.n = n; s.cfg = trackCfg(n);
  s.opts = { gasCan: opts.gasCan !== false, upgradeFixers: opts.upgradeFixers !== false };
  // city
  s.cells = CELLS.map(() => null); // {tile, rot, police:{county,federal,swat}}
  const starts = shuffle(s, ['S1', 'S2']); const srot = rnd(s) < 0.5 ? 0 : 3;
  starts.forEach((t, k) => { s.cells[START_CELLS[k]] = { tile: t, rot: srot, police: {} }; });
  s.stacks = {}; ['A', 'B', 'C', 'D'].forEach(L => { s.stacks[L] = shuffle(s, D.tiles.tiles.filter(t => t.stack === L).map(t => t.id)); });
  s.display = []; // {tile, police}
  // police bag
  s.bag = { county: 10, federal: 10, swat: 10 };
  s.patrol = shuffle(s, D.patrol.patrol.slice()); s.patrol.pop(); // one removed
  s.patrolSpaces = { 1: 0, 2: 0, 3: 0 };
  s.exitStacks = [shuffle(s, D.exits.stacks.black.slice()), shuffle(s, D.exits.stacks.grey.slice())];
  s.exitOn = {}; // exitNumber -> stack index (closed exits)
  s.pendingExitStack = {}; // exitNumber -> stack idx waiting for tile
  ['A', 'B', 'C', 'D'].forEach(L => { const d = revealStack(s, L); if (d) drawPolice(s, d.police, 2); });
  const s1cell = s.cells.findIndex(c => c && c.tile === 'S1');
  drawPolice(s, s.cells[s1cell].police, 2);
  // places
  s.bizSlots = {}; s.shSlots = {}; // slot loc id -> business/safehouse id
  s.bizCubes = {}; D.locations.businesses.forEach(b => s.bizCubes[b.id] = []);
  s.closed = {};
  s.shCubes = { sh1: [], sh2: [], sh3: [] };
  const keys = shuffle(s, ['green', 'green', 'green', 'black', 'black', 'black', 'brown', 'brown', 'brown']);
  s.shKeys = { sh1: keys.slice(0, 3), sh2: keys.slice(3, 6), sh3: keys.slice(6, 9) };
  s.fixers = D.fixers.fixers.filter(f => s.opts.upgradeFixers || !f.upgrade).map(f => f.id);
  s.equip = {}; D.equipment.equipment.forEach(e => s.equip[e.id] = e.count);
  s.gasSupply = 6;
  s.lockers = { green: shuffle(s, D.lockers.lockers.green.tiles.slice()), black: shuffle(s, D.lockers.lockers.black.tiles.slice()), brown: shuffle(s, D.lockers.lockers.brown.tiles.slice()) };
  s.deck = shuffle(s, D.contacts.cards.filter(c => s.opts.gasCan || !c.upgrade).map(c => c.id));
  s.cdisplay = s.deck.splice(0, 7);
  s.discs = 8;
  s.gangs = {}; // gang loc id -> {members, ctrl: pid|null}
  const s1 = TILE.S1; const g1 = s1.locs.find(l => l.type === 'gang').id; s.gangs[g1] = { members: 2, ctrl: null };
  s.gangPool = 6;
  // players
  const plans = shuffle(s, D.escapePlans.cards.map((c, i) => i));
  const order = opts.players.map((p, i) => i);
  s.players = opts.players.map((p, i) => ({
    id: i, color: p.color || COLORS[i], name: p.name || ('P' + (i + 1)), ai: !!p.ai, level: p.level || 'normal',
    money: 9, income: 9, notor: 1, red: 0, blue: 0, loc: 'hospital', plan: plans[i],
    items: [null, null, { kind: 'asset', id: 'move_county', locked: true }, { kind: 'asset', id: 'move_federal', locked: true }, { kind: 'asset', id: 'move_swat', locked: true }],
    contacts: [null, null, { kind: 'asset', id: 'avoid_tile', locked: true }, { kind: 'asset', id: 'master_key', locked: true }, { kind: 'asset', id: 'heal', locked: true }],
    cuffs: 0, unlocked: [{ id: 'extra_action', used: false }, null, null, null, null, null],
    gas: 0, gangMembers: [], ctrlFree: 2, firstAid: true, rest: true, wounds: 0, discs: 0,
    keys: {}, visited: {}, bonus: {}, escaped: false, arrested: false, escapeOrder: 0, stash: [],
    power: p.power || null, mission: null, discDay: {}, keepFaceUp: true
  }));
  if (opts.missions) { const ms = shuffle(s, D.missions.missions.map(m => m.id)); s.players.forEach((p, i) => { p.mission = { id: ms[i % ms.length], done: false, ability: null, token: true }; }); }
  s.players.forEach(p => {
    if (p.power === 'bones' && s.gasSupply > 0) { p.gas = 1; s.gasSupply--; }
    if (p.power === 'kitty') { p.money -= 3; const g1k = TILE.S1.locs.find(l => l.type === 'gang').id; s.gangs[g1k] = { members: 0, ctrl: p.id }; p.gangMembers = [g1k, g1k]; p.ctrlFree = 1; }
  });
  s.npcs = [];
  const used = new Set(s.players.map(p => p.color)); const freeCol = () => { const c = COLORS.find(x => !used.has(x)); used.add(c); return c; };
  const mkNpc = (id, kind, name) => ({ id, npc: kind, name, color: freeCol(), loc: 'hospital', notor: 1, red: 0, blue: 0, discs: 0, visited: {}, bonus: {}, escaped: false, arrested: false, wounds: 0, contacts: [], stacks: [], debt: 0, escapeOrder: 0 });
  if (n <= 2) { const sd = mkNpc(100, 'sandra', 'Sandra'); sd.deck = shuffle(s, D.inspector.cards.map((c, i) => i)); s.npcs.push(sd); }
  if (n === 1) { const co = mkNpc(101, 'costa', 'Lt. Costa'); co.deck = shuffle(s, D.lieutenant.cards.map((c, i) => i)); co.plan = plans[1]; co.easy = !!opts.easyCosta; s.npcs.push(co); }
  if (n === 2) order.push(100);
  if (n === 1) order.push(101, 100);
  s.order = order; // turn order (pids)
  s.day = 1; s.part = 0; s.escapes = 0;
  s.queue = [{ k: 'dayStart' }];
  s.pending = null;
  ev(s, { t: 'setup' });
  run(s);
  return s;
};

// ---------- helpers ----------
function ev(s, e) { s.events.push(e); s.log.push(e); if (s.log.length > 4000) s.log.splice(0, 500); }
function P(s, i) { return i >= 100 ? s.npcs.find(x => x.id === i) : s.players[i]; }
E.P = P;
function everyone(s) { return s.players.concat(s.npcs); }
function posCell(s, pos) { if (pos == null) return -1; return pos.indexOf(':') >= 0 ? +pos.split(':')[0] : locCell(s, pos); }
E.posCell = posCell;
function active(s) { return s.players.filter(p => !p.escaped && !p.arrested); }
function drawPolice(s, pol, k) {
  for (let i = 0; i < k; i++) {
    const tot = s.bag.county + s.bag.federal + s.bag.swat; if (!tot) return;
    let x = rnd(s) * tot, t = 'county'; for (const ty of PTYPES) { if (x < s.bag[ty]) { t = ty; break; } x -= s.bag[ty]; }
    s.bag[t]--; if (pol[t]) s.bag[t]++; else pol[t] = true;
  }
}
function revealStack(s, L) {
  if (!s.stacks[L].length) return;
  const t = s.stacks[L].shift(); const d = { tile: t, police: {}, stack: L }; s.display.push(d);
  // pending exit stacks on newly visible exits
  TILE[t].locs.forEach(l => { if (l.type === 'exit') { const n = +l.id.slice(4); if (s.pendingExitStack[n] != null) { s.exitOn[n] = s.pendingExitStack[n]; delete s.pendingExitStack[n]; } } });
  return d;
}
E.locsOnMap = function (s) { const out = []; s.cells.forEach((c, i) => { if (c) TILE[c.tile].locs.forEach(l => out.push({ ...l, cell: i })); }); return out; };
function locCell(s, locId) { for (let i = 0; i < s.cells.length; i++) { const c = s.cells[i]; if (c && TILE[c.tile].locs.some(l => l.id === locId)) return i; } return -1; }
E.locCell = locCell;
function locInfo(s, locId) { for (const c of s.cells) if (c) { const l = TILE[c.tile].locs.find(l => l.id === locId); if (l) return l; } return null; }
E.locInfo = locInfo;
// what a location "is" for visiting: business id, sh id, etc.
function locKind(s, locId) {
  const l = locInfo(s, locId); if (!l) return null;
  if (l.type === 'business') return { type: 'business', id: s.bizSlots[locId] };
  if (l.type === 'safehouse') return { type: 'safehouse', id: s.shSlots[locId] };
  if (l.type === 'exit') return { type: 'exit', n: +locId.slice(4) };
  return { type: l.type, id: locId };
}
E.locKind = locKind;
function contactCount(p) { let n = 0; p.contacts.forEach((c, i) => { if (c && c.kind === 'contact' && i < 5 - p.cuffs) n++; }); return n; }
E.contactCount = contactCount;
function othersAt(s, pid, loc) { return everyone(s).filter(q => q.id !== pid && !q.escaped && !q.arrested && q.loc === loc).length; }
function gain(s, p, k, why) { // notoriety cubes
  if (k > 0 && tokenOK(p, 'm6b')) { useToken(s, p); k--; ev(s, { t: 'notorIgnored', p: p.id }); }
  for (let i = 0; i < k; i++) { if (p.red + p.blue < 4) p.red++; else if (p.blue > 0) p.blue--; }
  if (k) ev(s, { t: 'notor', p: p.id, d: +k, why });
}
function lose(s, p, k, why) {
  for (let i = 0; i < k; i++) { if (p.red + p.blue < 4) p.blue++; else if (p.red > 0) p.red--; }
  if (k) ev(s, { t: 'notor', p: p.id, d: -k, why });
}
function cst(p, base) { return base > 0 && p.power === 'dasilva' ? base + 1 : base; }
function gangCost(p) { return hasAb(p, 'm5b') ? 0 : 5; }
function hasAb(p, ab) { return !!(p.mission && p.mission.ability && ('m' + p.mission.id + p.mission.ability) === ab); }
function tokenOK(p, ab) { return hasAb(p, ab) && p.mission.token; }
function useToken(s, p) { p.mission.token = false; ev(s, { t: 'token', p: p.id }); }
E.cst = cst; E.hasAb = hasAb;
function pay(s, p, amt, why) { if (amt > 0 && p.power === 'dasilva' && !['lateFee', 'exitCost', 'bribe'].includes(why)) amt += 1; p.money -= amt; if (amt) ev(s, { t: 'money', p: p.id, d: -amt, why }); }
function earn(s, p, amt, why) { p.money += amt; if (amt) ev(s, { t: 'money', p: p.id, d: amt, why }); }
function income(s, p, why) { earn(s, p, p.income + (p.power === 'dasilva' ? 3 : 0), why || 'income'); }
function wound(s, p, why) {
  if (p.wounds < 3) { p.wounds++; ev(s, { t: 'wound', p: p.id, why }); return; }
  // handcuffs
  const idx = 4 - p.cuffs; if (idx < 0) { ev(s, { t: 'wound', p: p.id, why }); return; }
  const c = p.contacts[idx];
  if (c && c.kind === 'asset') p.contacts[idx] = null; // asset lost
  p.cuffs++; p.wounds = 2; // one cube back to green, then (already counted) — cuff absorbs this wound
  ev(s, { t: 'cuffs', p: p.id, slot: idx, lost: c ? (c.kind === 'asset' ? 'asset:' + c.id : 'contact:' + c.card) : null });
}
function heal(s, p, k, why) { const h = Math.min(k, p.wounds); p.wounds -= h; if (h) ev(s, { t: 'heal', p: p.id, n: h, why }); return h; }
function lockedAssets(p) {
  const out = []; p.items.forEach((x, i) => { if (x && x.kind === 'asset' && x.locked) out.push({ where: 'items', i, id: x.id }); });
  p.contacts.forEach((x, i) => { if (x && x.kind === 'asset' && x.locked && i < 5 - p.cuffs) out.push({ where: 'contacts', i, id: x.id }); });
  return out;
}
E.lockedAssets = lockedAssets;
function doUnlock(s, p, choice) {
  const la = lockedAssets(p); const c = la.find(x => x.where === choice.where && x.i === choice.i) || la[0]; if (!c) return;
  p[c.where][c.i] = null;
  const slot = p.unlocked.findIndex(u => u === null);
  if (slot >= 0) { p.unlocked[slot] = { id: c.id, used: false }; ev(s, { t: 'unlock', p: p.id, id: c.id, slot }); }
  else ev(s, { t: 'unlockLost', p: p.id, id: c.id });
}
function emptyItem(p) { return p.items.findIndex(x => x === null); }
function nonAssetItems(p) { const o = []; p.items.forEach((x, i) => { if (x && x.kind !== 'asset') o.push(i); }); return o; }

// ---------- city geometry & movement graph ----------
function placedNeighbors(s, i) { const o = []; for (let e = 0; e < 6; e++) { const j = nb(i, e); if (j >= 0 && s.cells[j]) o.push(j); } return o; }
E.legalPlacements = function (s, tileId) {
  const res = [];
  s.cells.forEach((c, i) => {
    if (c) return; const nbs = placedNeighbors(s, i); if (nbs.length < 2) return;
    for (let rot = 0; rot < 6; rot++) {
      let ok = false;
      for (let e = 0; e < 6 && !ok; e++) {
        const j = nb(i, e); if (j < 0 || !s.cells[j]) continue; const o = s.cells[j]; const oe = (e + 3) % 6;
        for (let h = 0; h < 2; h++) if (land(tileId, rot, e, h) === land(o.tile, o.rot, oe, 1 - h)) ok = true;
      }
      if (ok) res.push({ cell: i, rot });
    }
  });
  if (!res.length) s.cells.forEach((c, i) => { if (!c && placedNeighbors(s, i).length >= 1) for (let rot = 0; rot < 6; rot++) res.push({ cell: i, rot }); });
  return res;
};
function buildGraph(s, opt) {
  // nodes: zones "cell:T" and locations; edges with cost
  opt = opt || {};
  const G = { adj: {}, cellOf: {}, isLoc: {}, type: {} };
  const add = (a, b, w, kind) => { (G.adj[a] = G.adj[a] || []).push({ to: b, w, kind }); };
  const zones = [];
  s.cells.forEach((c, i) => {
    if (!c) return; const t = TILE[c.tile];
    const types = new Set(t.edges); t.locs.forEach(l => l.adj.split('').forEach(x => types.add(x)));
    types.forEach(T => { const z = i + ':' + T; G.cellOf[z] = i; G.type[z] = T; zones.push(z); G.adj[z] = G.adj[z] || []; });
    t.borders.forEach(b => { const A = i + ':' + b[0], B = i + ':' + b[1]; add(A, B, 1); add(B, A, 1); });
    t.locs.forEach(l => { G.cellOf[l.id] = i; G.isLoc[l.id] = l.type; G.adj[l.id] = G.adj[l.id] || []; l.adj.split('').forEach(T => { add(l.id, i + ':' + T, 1); add(i + ':' + T, l.id, 1); }); });
  });
  // cross-tile
  s.cells.forEach((c, i) => {
    if (!c) return;
    for (let e = 0; e < 3; e++) {
      const j = nb(i, e); if (j < 0 || !s.cells[j]) continue; const o = s.cells[j]; const oe = (e + 3) % 6;
      for (let h = 0; h < 2; h++) {
        const A = land(c.tile, c.rot, e, h), B = land(o.tile, o.rot, oe, 1 - h);
        const za = i + ':' + A, zb = j + ':' + B; const w = A === B ? 0 : 1;
        if (!(G.adj[za] || []).some(x => x.to === zb && x.w === w)) { add(za, zb, w); add(zb, za, w); }
      }
    }
  });
  // water bodies & ferries
  const body = {}; let bid = 0;
  zones.filter(z => G.type[z] === 'W').forEach(z => {
    if (body[z] != null) return; const st = [z]; body[z] = bid; const mem = [z];
    while (st.length) { const x = st.pop(); for (const e of G.adj[x]) if (e.w === 0 && G.type[e.to] === 'W' && body[e.to] == null) { body[e.to] = bid; st.push(e.to); mem.push(e.to); } }
    bid++;
  });
  const ferry = {}; zones.forEach(z => { if (G.type[z] === 'W' && TILE[s.cells[G.cellOf[z]].tile].ferry) ferry[body[z]] = true; });
  G.waterOK = (z) => opt.jetski || !!ferry[body[z]];
  G.body = body; G.ferry = ferry;
  return G;
}
E.buildGraph = buildGraph;
function canEnd(s, p, locId, cash) {
  if (cash == null) cash = p.money;
  const k = locKind(s, locId); if (!k) return false;
  if (k.type === 'business') { if (!k.id) return false; if (p.visited[k.id]) return false; if (s.closed[k.id] && p.power !== 'ruby' && !hasAnyKey(p, cash)) return false; }
  if (k.type === 'safehouse') { if (!k.id || p.visited[k.id]) return false; }
  if (k.type === 'gang') { const g = s.gangs[locId]; if (!g || g.ctrl != null || g.members < 2) return false; if (othersAt(s, p.id, locId)) return false; if (cash < cst(p, gangCost(p)) || p.ctrlFree < 1 || p.power === 'kitty') return false; }
  return true;
}
E.canEnd = canEnd;
function hasAnyKey(p, cash) { if (cash == null) cash = p.money; return Object.values(p.keys).some(k => !k.used) || p.unlocked.some((u, i) => u && u.id === 'master_key' && !u.used && cash >= cst(p, UNLOCK_COSTS[i])); }
function policeOnCells(s, cells) { let n = 0; cells.forEach(i => { const c = s.cells[i]; if (c) PTYPES.forEach(t => { if (c.police[t]) n++; }); }); return n; }

// travel resources available for planning
function travelResources(s, p) {
  const r = { gasTok: p.gas, gasCard: null, chopper: [], jetski: [], sewer: [], medevac: [], heliFixer: null, gangHeli: p.gangMembers.length > 0, gangCard: [], motorcycle: null };
  p.contacts.forEach((c, i) => {
    if (!c || c.kind !== 'contact' || c.used || i >= 5 - p.cuffs) return; const C = CONTACT[c.card]; if (p.money < cst(p, C.cost)) return;
    if (C.effect === 'plus_mp' && !r.gasCard) r.gasCard = i;
    if (C.effect === 'chopper') r.chopper.push(i); if (C.effect === 'jetski') r.jetski.push(i); if (C.effect === 'sewer') r.sewer.push(i);
    if (C.effect === 'medevac') r.medevac.push(i); if (C.effect === 'gang_ability') r.gangCard.push(i);
  });
  p.items.forEach((x, i) => { if (x && x.kind === 'fixer' && !x.used) { const F = FIXER[x.id]; if (p.money < cst(p, F.cost)) return; if (F.effect === 'chopper') r.heliFixer = i; if (F.effect === 'jetski') r.jetski.push('f' + i); if (F.effect === 'gang_ability') r.motorcycle = i; } });
  return r;
}
// plan moves: returns { [destLoc]: [plans...] }, plan = {mp, path:[nodes], cells:[visited cells], avoidCells, police, uses:[...], escape?}
E.planMoves = function (s, pid) {
  const p = P(s, pid); const res = travelResources(s, p);
  const variants = [{ key: 'walk', uses: [] }];
  if (res.jetski.length) variants.push({ key: 'jetski', uses: [{ r: 'jetski', ref: res.jetski[0] }], jetski: true });
  if (res.sewer.length) variants.push({ key: 'sewer', uses: [{ r: 'sewer', ref: res.sewer[0] }], sewer: true });
  const heliSrc = [];
  if (res.chopper.length) heliSrc.push({ r: 'chopper', ref: res.chopper[0] });
  if (res.heliFixer != null) heliSrc.push({ r: 'heliFixer', ref: res.heliFixer });
  if (res.gangHeli) heliSrc.push({ r: 'gangHeli', ref: 0 });
  if (res.gangCard.length) heliSrc.push({ r: 'gangCardHeli', ref: res.gangCard[0] });
  if (res.motorcycle != null) heliSrc.push({ r: 'motorcycleHeli', ref: res.motorcycle });
  if (tokenOK(p, 'm1b')) heliSrc.unshift({ r: 'm1b', ref: 0 });
  heliSrc.slice(0, 2).forEach(h => variants.push({ key: h.r, uses: [h], heli: true }));
  const extra = res.gasTok + (res.gasCard != null ? 1 : 0);
  const out = {};
  const startCell = locCell(s, p.loc);
  const addPlan = (dest, plan) => {
    const arr = out[dest] = out[dest] || [];
    const same = arr.find(x => x.police <= plan.police && x.uses.length <= plan.uses.length && x.mp <= plan.mp);
    if (same) return;
    for (let k = arr.length - 1; k >= 0; k--) { const x = arr[k]; if (plan.police <= x.police && plan.uses.length <= x.uses.length && plan.mp <= x.mp) arr.splice(k, 1); }
    arr.push(plan);
  };
  const resCost = (u) => { if (u.r === 'gangHeli' || u.r === 'm1b') return 0; if (typeof u.ref === 'string') return cst(p, FIXER[p.items[+u.ref.slice(1)].id].cost); if (u.r === 'heliFixer' || u.r === 'motorcycleHeli') return cst(p, FIXER[p.items[u.ref].id].cost); return cst(p, CONTACT[p.contacts[u.ref].card].cost); };
  for (const v of variants) {
    v.cost = v.uses.reduce((a, u) => a + resCost(u), 0);
    const G = buildGraph(s, { jetski: v.jetski || hasAb(p, 'm1a') });
    const base = p.power === 'bones' ? 2 : 3; const budget = base + extra;
    // DFS over states
    const seen = new Map();
    const st = [{ node: p.loc, mp: 0, cells: [startCell], path: [p.loc], sub: false, heli: false, sewer: false, bonus: 0 }];
    while (st.length) {
      const x = st.pop();
      const key = x.node + '|' + x.mp + '|' + x.sub + x.heli + x.sewer;
      const pc = policeOnCells(s, x.cells.filter(c => c !== G.cellOf[x.node])) * 10 + x.cells.length;
      if (seen.has(key) && seen.get(key) <= pc) continue; seen.set(key, pc);
      // record destination
      if (G.isLoc[x.node] && x.node !== p.loc && x.path.length > 1) {
        if (canEnd(s, p, x.node, p.money - v.cost) || (s.day === 3 && isOpenExit(s, x.node))) {
          const endCell = G.cellOf[x.node]; const av = [...new Set(x.cells)].filter(c => c !== endCell);
          if (v.heli && !x.heli) { /* variant requires using its ability */ } else if (v.sewer && !x.sewer) { } else {
            const mpOver = Math.max(0, x.mp - base - x.bonus);
            addPlan(x.node, { mp: x.mp, extraMp: mpOver, path: x.path.slice(), avoidCells: av, police: policeOnCells(s, av), uses: v.uses.slice(), sub: x.sub, variant: v.key });
          }
        }
      }
      const cap = budget + x.bonus;
      // normal edges
      for (const e of (G.adj[x.node] || [])) {
        const nmp = x.mp + e.w; if (nmp > cap) continue;
        if (G.type[e.to] === 'W' && !G.waterOK(e.to)) continue;
        if (G.isLoc[e.to] && e.to !== p.loc && !canPass(s, p, e.to)) continue;
        if (G.isLoc[x.node] && x.node !== p.loc && x.path.length > 1 && G.isLoc[x.node] !== 'subway' && G.isLoc[x.node] !== 'heliport') continue; // can't move through locations
        const c = G.cellOf[e.to];
        st.push({ ...x, node: e.to, mp: nmp, cells: x.cells.includes(c) ? x.cells : x.cells.concat([c]), path: x.path.concat([e.to]) });
      }
      // subway teleport
      if (G.isLoc[x.node] === 'subway' && !x.sub && (x.node !== p.loc || true)) {
        for (const id in G.isLoc) if (G.isLoc[id] === 'subway' && id !== x.node) {
          const c = G.cellOf[id];
          st.push({ ...x, node: id, sub: true, bonus: x.bonus + 1, cells: x.cells.includes(c) ? x.cells : x.cells.concat([c]), path: x.path.concat(['~' + id]) });
        }
      }
      // heliport location / heli ability
      const onHeliport = G.isLoc[x.node] === 'heliport';
      const onHelipad = TILE[s.cells[G.cellOf[x.node]].tile].helipad || p.power === 'bones' || hasAb(p, 'm5a');
      if ((onHeliport || (v.heli && !x.heli && onHelipad)) && x.mp + 1 <= cap) {
        const from = G.cellOf[x.node];
        for (const id in G.cellOf) {
          const c = G.cellOf[id]; const d = hexDist(from, c); if (d < 1 || d > 2) continue;
          if (G.type[id] === 'W' && !G.waterOK(id)) continue;
          if (G.isLoc[id] && id !== p.loc && !canPass(s, p, id)) continue;
          const usedAbility = !onHeliport;
          st.push({ ...x, node: id, mp: x.mp + 1, heli: x.heli || usedAbility, cells: x.cells.includes(c) ? x.cells : x.cells.concat([c]), path: x.path.concat(['^' + id]) });
        }
      }
      // sewer: land zone -> land zone on tile at distance 2
      if (v.sewer && !x.sewer && G.type[x.node] && G.type[x.node] !== 'W') {
        const from = G.cellOf[x.node];
        for (const id in G.type) {
          const c = G.cellOf[id]; if (hexDist(from, c) !== 2 || G.type[id] === 'W') continue;
          const w = G.type[id] === G.type[x.node] ? 0 : 1; if (x.mp + w > cap) continue;
          st.push({ ...x, node: id, mp: x.mp + w, sewer: true, cells: x.cells.includes(c) ? x.cells : x.cells.concat([c]), path: x.path.concat(['%' + id]) });
        }
      }
    }
  }
  // medevac
  if (res.medevac.length && p.loc !== 'hospital') addPlan('hospital', { mp: 0, extraMp: 0, path: [p.loc, '^hospital'], avoidCells: startCell >= 0 && locCell(s, 'hospital') !== startCell ? [startCell] : [], police: 0, uses: [{ r: 'medevac', ref: res.medevac[0] }], variant: 'medevac' });
  for (const d in out) out[d].forEach(pl => { pl.police = policeOnCells(s, pl.avoidCells); pl.escape = s.day === 3 && isOpenExit(s, d); });
  return out;
};
function canPass(s, p, locId) { return true; }
function isOpenExit(s, locId) { const k = locKind(s, locId); return k && k.type === 'exit' && s.patrolSpaces[k.n] < 2; }
E.isOpenExit = isOpenExit;

// ---------- the main loop ----------
function run(s) {
  let guard = 0;
  while (!s.pending && s.queue.length && guard++ < 100000) {
    const t = s.queue.shift(); task(s, t);
  }
  if (!s.pending && !s.queue.length && !s.over) { s.over = true; }
}
function push(s, ...ts) { s.queue.unshift(...ts); }
function ask(s, pid, type, data, cont) { s.pending = Object.assign({ pid, type }, data); s.cont = cont || null; }

E.act = function (s, a) {
  const pd = s.pending; if (!pd) throw new Error('no pending');
  s.pending = null; const cont = s.cont; s.cont = null;
  resolve(s, pd, a, cont);
  run(s);
  return s;
};

function task(s, t) {
  switch (t.k) {
    case 'dayStart': {
      ev(s, { t: 'day', day: s.day });
      s.players.forEach(p => { if (p.mission) p.mission.token = true; });
      const ts = [];
      if (s.day > 1) ts.push({ k: 'income' });
      ts.push({ k: 'patrol' }, { k: 'city', placed: 0, idx: 0 }, { k: 'turnOrder' });
      for (let part = 0; part < 5; part++) ts.push({ k: 'part', part });
      ts.push({ k: 'dayEnd' });
      push(s, ...ts); break;
    }
    case 'income': {
      ev(s, { t: 'phase', ph: 'income' });
      s.order.forEach(pid => { const p = P(s, pid); if (p.npc || p.escaped || p.arrested) return; income(s, p, 'income'); if (hasAb(p, 'm2a')) earn(s, p, 5, 'mission'); });
      push(s, ...s.order.filter(pid => { const p = P(s, pid); return !p.escaped && !p.arrested && p.notor <= 2 && p.money >= cst(p, 3) && lockedAssets(p).length; }).map(pid => ({ k: 'incomeUnlock', pid })));
      break;
    }
    case 'incomeUnlock': {
      const p = P(s, t.pid); if (p.notor > 2 || p.money < cst(p, 3)) break;
      ask(s, t.pid, 'yesno', { q: 'incomeUnlock' }, { k: 'incomeUnlock' }); break;
    }
    case 'patrol': {
      ev(s, { t: 'phase', ph: 'patrol' });
      const k = s.day === 3 ? 1 : 2;
      for (let i = 0; i < k && s.patrol.length; i++) {
        const n = s.patrol.shift(); s.patrolSpaces[n]++;
        ev(s, { t: 'patrol', exit: n, count: s.patrolSpaces[n] });
        if (s.patrolSpaces[n] === 2) {
          const si = Object.keys(s.exitOn).length + Object.keys(s.pendingExitStack).length; // 0 or 1
          const visible = mapHasLoc(s, 'exit' + n) || s.display.some(d => TILE[d.tile].locs.some(l => l.id === 'exit' + n));
          if (visible) s.exitOn[n] = si; else s.pendingExitStack[n] = si;
          ev(s, { t: 'exitClosed', exit: n });
        }
      }
      break;
    }
    case 'city': {
      if (t.placed === 0) ev(s, { t: 'phase', ph: 'city' });
      if (!s.display.length) { if (s.day < 3 || true) refillDisplay(s); break; }
      const alive = s.order.filter(pid => pid < 100 && !P(s, pid).escaped && !P(s, pid).arrested);
      const pid = alive[t.idx % alive.length];
      if (s.n === 5 && t.idx % alive.length === 4 && false) { }
      ask(s, pid, 'place', { display: s.display.map(d => d.tile) }, { k: 'city', placed: t.placed, idx: t.idx });
      break;
    }
    case 'turnOrder': {
      ev(s, { t: 'phase', ph: 'order' });
      const prev = s.order.slice();
      const ord = prev.slice().sort((a, b) => (P(s, b).notor - P(s, a).notor) || (prev.indexOf(b) - prev.indexOf(a)));
      s.order = ord; ev(s, { t: 'order', order: ord.slice() });
      push(s, ...ord.filter(id => id < 100 && tokenOK(P(s, id), 'm4b')).map(id => ({ k: 'swapOrder', pid: id })));
      break;
    }
    case 'part': {
      s.part = t.part; ev(s, { t: 'part', part: t.part });
      const ts = [];
      s.order.forEach(pid => ts.push({ k: 'turn', pid, part: t.part }));
      ts.push({ k: 'adjust', i: 0 });
      push(s, ...ts); break;
    }
    case 'turn': {
      const p = P(s, t.pid); if (p.escaped || p.arrested) break;
      if (p.npc) { npcTurn(s, p, t.part); break; }
      if (s.day === 3 && s.part === 4 && false) { }
      if (t.part >= 3) { // night / dawn: optional with disc
        if (p.discs < 1) break;
        ask(s, p.id, 'yesno', { q: 'useDisc', part: t.part }, { k: 'useDisc', pid: p.id }); break;
      }
      push(s, { k: 'turnStart', pid: p.id });
      break;
    }
    case 'turnStart': {
      const p = P(s, t.pid);
      if (s.escapes > 0) {
        if (p.money < 1) { arrest(s, p, 'cantPayTurn'); break; }
        pay(s, p, 1, 'lateFee');
      }
      s.cur = { pid: p.id, moved: false, mpBonus: 0 };
      ev(s, { t: 'turn', p: p.id });
      push(s, { k: 'actionChoice', pid: p.id });
      break;
    }
    case 'actionChoice': {
      const p = P(s, t.pid);
      const moves = E.planMoves(s, p.id);
      const canEscapeHere = s.day === 3 && isOpenExit(s, p.loc);
      ask(s, p.id, 'action', { moves, canRest: p.rest, canEscapeHere, exec: execOptions(s, p, 'travel') }, { k: 'action', pid: p.id });
      break;
    }
    case 'avoid': {
      const p = P(s, t.pid);
      const list = [];
      t.cells.forEach(c => { const cl = s.cells[c]; if (cl) PTYPES.forEach(ty => { if (cl.police[ty] && !t.done.some(d => d.cell === c && d.type === ty)) list.push({ cell: c, type: ty }); }); });
      s.npcs.forEach(n => { if (n.escaped) return; const c = posCell(s, n.loc); if (t.cells.includes(c) && !t.done.some(d => d.cell === c && d.type === n.npc)) list.push({ cell: c, type: n.npc }); });
      if (!list.length) { ev(s, { t: 'avoidDone', p: p.id, wounds: 0 }); if (t.after) push(s, t.after); break; }
      const opts = avoidOptions(s, p, list, t);
      ask(s, p.id, 'avoid', { officers: list, options: opts }, { k: 'avoid', pid: p.id, cells: t.cells, done: t.done, after: t.after });
      break;
    }
    case 'visit': visit(s, P(s, t.pid), t); break;
    case '_escapePay': escapePay(s, t); break;
    case 'ladyRefresh': { const p = P(s, t.pid); const x = p.items[t.i]; if (!x || !x.used) break; const price = 1 + FIXER[x.id].cost; if (p.money < cst(p, price)) break; ask(s, p.id, 'yesno', { q: 'ladyRefresh', fixer: x.id, price: cst(p, price) }, { k: 'ladyRefresh', pid: p.id, i: t.i }); break; }
    case 'missionCheck': missionCheck(s, P(s, t.pid)); break;
    case 'swapOrder': { const p = P(s, t.pid); const idx = s.order.indexOf(p.id); if (idx <= 0 || !tokenOK(p, 'm4b')) break; ask(s, p.id, 'yesno', { q: 'swapOrder', ahead: s.order[idx - 1] }, { k: 'swapOrder', pid: p.id }); break; }
    case 'takeContact': {
      const p = P(s, t.pid); if (!s.cdisplay.length) break;
      ask(s, p.id, 'contact', { display: s.cdisplay.slice(), hasEmpty: emptyContact(p) >= 0, mine: myContacts(p) }, { k: 'takeContact', pid: p.id });
      break;
    }
    case 'unlock': {
      const p = P(s, t.pid); const la = lockedAssets(p); if (!la.length) break;
      if (la.length === 1) { doUnlock(s, p, la[0]); break; }
      ask(s, p.id, 'unlock', { assets: la }, { k: 'unlock', pid: p.id }); break;
    }
    case 'turnEnd': {
      const p = P(s, t.pid);
      // group bonuses
      for (const g in GROUPS) if (!p.bonus[g] && GROUPS[g].every(b => p.visited[b])) { p.bonus[g] = true; push(s, { k: 'bonus', pid: p.id, g }); return; }
      if (!p.bonus.sh && ['sh1', 'sh2', 'sh3'].every(x => p.visited[x])) { p.bonus.sh = true; push(s, { k: 'bonus', pid: p.id, g: 'sh' }); return; }
      if (p.mission && !p.mission.done && !p.escaped && !p.arrested && missionMet(s, p)) { push(s, { k: 'missionCheck', pid: p.id }, { k: 'turnEnd', pid: p.id, skipExec: t.skipExec }); return; }
      if (p.escaped || p.arrested) break;
      const ex = execOptions(s, p, 'end');
      if (ex.length && !t.skipExec) { ask(s, p.id, 'end', { exec: ex }, { k: 'end', pid: p.id }); break; }
      ev(s, { t: 'turnEnd', p: p.id }); s.cur = null;
      break;
    }
    case 'bonus': {
      const p = P(s, t.pid);
      ask(s, p.id, 'choose', { q: 'bonus_' + (t.g === 'sh' ? 'sh' : 'biz'), opts: ['disc', 'unlock'], g: t.g }, { k: 'bonus', pid: p.id, g: t.g });
      break;
    }
    case 'adjust': {
      const pid = s.order[t.i]; if (pid == null) { ev(s, { t: 'adjustDone' }); break; }
      push(s, { k: 'adjust', i: t.i + 1 });
      const p = P(s, pid); if (p.arrested) break;
      adjustNotoriety(s, p);
      if (p.mission && !p.mission.done && missionMet(s, p)) push(s, { k: 'missionCheck', pid: p.id });
      break;
    }
    case 'policeMove': {
      const mover = P(s, t.mover); const target = P(s, t.target);
      const opts = policeMoveOptions(s, target);
      if (!opts.length) break;
      ask(s, mover.id, 'policeMove', { target: target.id, opts, onBehalf: t.onBehalf }, { k: 'policeMove', mover: mover.id, target: target.id });
      break;
    }
    case 'dayEnd': {
      if (s.day === 3) { push(s, { k: 'gameEnd' }); break; }
      s.players.forEach(p => { if (!p.rest) { p.rest = true; ev(s, { t: 'restBack', p: p.id }); } });
      s.day++; s.part = 0; push(s, { k: 'dayStart' }); break;
    }
    case 'gameEnd': {
      s.players.forEach(p => { if (!p.escaped && !p.arrested) arrest(s, p, 'endOfDay3'); });
      s.score = E.score(s); s.over = true; ev(s, { t: 'gameOver', score: s.score });
      s.queue = []; break;
    }
    default: throw new Error('task ' + t.k);
  }
}
function mapHasLoc(s, id) { return locCell(s, id) >= 0; }
function refillDisplay(s) {
  if (s.day >= 3) return;
  ['A', 'B', 'C', 'D'].forEach(L => { const d = revealStack(s, L); if (d) drawPolice(s, d.police, 2); });
  ev(s, { t: 'display', tiles: s.display.map(d => d.tile) });
}
function arrest(s, p, why) { p.arrested = true; ev(s, { t: 'arrest', p: p.id, why }); }
function emptyContact(p) { for (let i = 0; i < 5 - p.cuffs; i++) if (!p.contacts[i]) return i; return -1; }
function myContacts(p) { const o = []; p.contacts.forEach((c, i) => { if (c && c.kind === 'contact') o.push({ i, card: c.card }); }); return o; }

// ---------- resolve decisions ----------
function resolve(s, pd, a, c) {
  const p = P(s, pd.pid);
  switch (c.k) {
    case 'incomeUnlock': if (a) { pay(s, p, 3, 'buyUnlock'); push(s, { k: 'unlock', pid: p.id }); } break;
    case 'city': {
      const di = s.display.findIndex(d => d.tile === a.tile); const d = s.display[di];
      const legal = E.legalPlacements(s, a.tile).some(x => x.cell === a.cell && x.rot === a.rot);
      if (!d || !legal || s.cells[a.cell]) throw new Error('illegal placement');
      s.display.splice(di, 1);
      s.cells[a.cell] = { tile: a.tile, rot: a.rot, police: d.police };
      TILE[a.tile].locs.forEach(l => {
        if (l.type === 'business') s.bizSlots[l.id] = a.biz || freeBiz(s)[0];
        if (l.type === 'safehouse') s.shSlots[l.id] = a.sh || freeSh(s)[0];
        if (l.type === 'gang') { s.gangs[l.id] = { members: 2, ctrl: null }; s.gangPool -= 2; }
        if (l.type === 'exit') { const n = +l.id.slice(4); if (s.pendingExitStack[n] != null) { s.exitOn[n] = s.pendingExitStack[n]; delete s.pendingExitStack[n]; } }
      });
      ev(s, { t: 'place', p: p.id, tile: a.tile, cell: a.cell, rot: a.rot, biz: Object.entries(s.bizSlots).filter(([k]) => TILE[a.tile].locs.some(l => l.id === k)).map(x => x[1]), sh: Object.entries(s.shSlots).filter(([k]) => TILE[a.tile].locs.some(l => l.id === k)).map(x => x[1]) });
      push(s, { k: 'city', placed: c.placed + 1, idx: c.idx + 1 });
      break;
    }
    case 'action': doAction(s, p, a); break;
    case 'avoid': {
      if (a.done) {
        const left = []; c.cells.forEach(ci => { const cl = s.cells[ci]; if (cl) PTYPES.forEach(ty => { if (cl.police[ty] && !c.done.some(d => d.cell === ci && d.type === ty)) left.push({ cell: ci, type: ty }); }); });
        s.npcs.forEach(n => { if (n.escaped) return; const ci = posCell(s, n.loc); if (c.cells.includes(ci) && !c.done.some(d => d.cell === ci && d.type === n.npc)) left.push({ cell: ci, type: n.npc }); });
        let wn = 0;
        left.forEach(o => {
          if (o.type === 'costa') { if (p.money >= 3) { pay(s, p, 3, 'bribe'); ev(s, { t: 'bribe', p: p.id }); } else { wound(s, p, 'costa'); wound(s, p, 'costa'); wn += 2; } }
          else { wound(s, p, 'police:' + o.type); wn++; }
        });
        ev(s, { t: 'avoidDone', p: p.id, wounds: wn });
        if (c.after) push(s, c.after);
        break;
      }
      const done = c.done.slice();
      applyAvoid(s, p, Object.assign({}, a, { exclude: c.cells.concat([locCell(s, p.loc)]) }), done);
      push(s, { k: 'avoid', pid: p.id, cells: c.cells, done, after: c.after });
      break;
    }
    case 'takeContact': {
      const card = a.card; const i = s.cdisplay.indexOf(card); if (i < 0) throw new Error('no card');
      s.cdisplay.splice(i, 1);
      if (a.opt === 'B') { const e = emptyContact(p); if (e < 0) throw new Error('no space'); p.contacts[e] = { kind: 'contact', card, used: false }; ev(s, { t: 'contact', p: p.id, card, slot: e }); }
      else if (a.opt === 'C') { const old = p.contacts[a.replace]; if (!old || old.kind !== 'contact') throw new Error('bad replace'); p.contacts[a.replace] = { kind: 'contact', card, used: false }; ev(s, { t: 'contact', p: p.id, card, slot: a.replace, replaced: old.card }); gain(s, p, 1, 'replace'); }
      else ev(s, { t: 'contactDiscard', p: p.id, card });
      if (s.deck.length) { const nc = s.deck.shift(); if (s.npcs.length) s.cdisplay.unshift(nc); else s.cdisplay.push(nc); ev(s, { t: 'cdraw', card: nc }); }
      break;
    }
    case 'unlock': doUnlock(s, p, a); break;
    case 'ladyRefresh': if (a) { const x = p.items[c.i]; pay(s, p, 1 + FIXER[x.id].cost, 'power'); x.used = false; ev(s, { t: 'refreshFixer', p: p.id, id: x.id }); } break;
    case 'swapOrder': if (a) { const idx = s.order.indexOf(p.id); const o = s.order; [o[idx - 1], o[idx]] = [o[idx], o[idx - 1]]; useToken(s, p); ev(s, { t: 'order', order: o.slice() }); } break;
    case 'mission': p.mission.ability = a; ev(s, { t: 'missionAbility', p: p.id, id: p.mission.id, ab: a }); break;
    case 'useDisc': if (a) { p.discs--; p.discDay[s.day] = (p.discDay[s.day] || 0) + 1; ev(s, { t: 'disc', p: p.id }); push(s, { k: 'turnStart', pid: p.id }); } break;
    case 'end': {
      if (a && a.exec) { doExec(s, p, a.exec); push(s, { k: 'turnEnd', pid: p.id }); }
      else push(s, { k: 'turnEnd', pid: p.id, skipExec: true });
      break;
    }
    case 'bonus': {
      if (a === 'disc') { if (s.discs > 0) { s.discs--; p.discs++; ev(s, { t: 'discGain', p: p.id, why: 'bonus' }); } }
      else { push(s, { k: 'unlock', pid: p.id }); if (c.g === 'sh') income(s, p, 'bonus'); else lose(s, p, 1, 'bonus'); }
      push(s, { k: 'turnEnd', pid: p.id });
      break;
    }
    case 'policeMove': {
      const o = pd.opts.find(x => x.from === a.from && x.type === a.type && x.to === a.to) || pd.opts[0];
      s.cells[o.from].police[o.type] = false; s.cells[o.to].police[o.type] = true;
      ev(s, { t: 'police', p: p.id, from: o.from, to: o.to, type: o.type, target: c.target });
      break;
    }
    case 'visitStep': visitResolve(s, p, pd, a, c); break;
    default: throw new Error('resolve ' + c.k);
  }
}
function freeBiz(s) { const used = new Set(Object.values(s.bizSlots)); return D.locations.businesses.map(b => b.id).filter(b => !used.has(b)); }
function freeSh(s) { const used = new Set(Object.values(s.shSlots)); return ['sh1', 'sh2', 'sh3'].filter(b => !used.has(b)); }
E.freeBiz = freeBiz; E.freeSh = freeSh;

function doAction(s, p, a) {
  if (a.exec) { doExec(s, p, a.exec); push(s, { k: 'actionChoice', pid: p.id }); return; }
  if (a.type === 'rest') {
    if (!p.rest) throw new Error('rested');
    p.rest = false; ev(s, { t: 'rest', p: p.id });
    p.contacts.forEach(c => { if (c && c.kind === 'contact') c.used = false; });
    p.items.forEach(x => { if (x && x.kind === 'equip') x.used = false; });
    p.firstAid = true;
    const lt = ladyTasks(p);
    push(s, ...lt, { k: 'unlock', pid: p.id }, { k: 'turnEnd', pid: p.id });
    return;
  }
  if (a.type === 'pass') { ev(s, { t: 'pass', p: p.id }); push(s, { k: 'turnEnd', pid: p.id }); return; }
  if (a.type === 'escapeHere') { doEscape(s, p, [locCell(s, p.loc)]); return; }
  if (a.type === 'move') {
    const plans = E.planMoves(s, p.id)[a.dest]; if (!plans) throw new Error('unreachable ' + a.dest);
    const pl = plans[a.plan || 0] || plans[0];
    // pay resources
    let extra = pl.extraMp; const res = travelResources(s, p);
    if (extra > 0 && res.gasCard != null) { useContact(s, p, res.gasCard, 'move'); extra--; }
    while (extra > 0 && p.gas > 0) { p.gas--; s.gasSupply++; extra--; ev(s, { t: 'gasUse', p: p.id }); }
    pl.uses.forEach(u => useTravelRes(s, p, u));
    const from = p.loc; p.loc = a.dest;
    ev(s, { t: 'move', p: p.id, from, to: a.dest, path: pl.path, mp: pl.mp });
    if (s.cur) s.cur.moved = true;
    const k = locKind(s, a.dest);
    if (a.escape && pl.escape) { doEscape(s, p, pl.avoidCells.concat([locCell(s, a.dest)])); return; }
    const skipVisit = k.type === 'subway' || k.type === 'heliport';
    const vis = skipVisit ? null : { k: 'visit', pid: p.id, loc: a.dest, step: 0 };
    const first = pl.avoidCells.length ? { k: 'avoid', pid: p.id, cells: pl.avoidCells, done: [], after: vis } : vis;
    push(s, ...[first, { k: 'turnEnd', pid: p.id }].filter(Boolean));
    return;
  }
  throw new Error('bad action');
}
function ladyTasks(p) { if (p.power !== 'ladyt') return []; const o = []; p.items.forEach((x, i) => { if (x && x.kind === 'fixer' && x.used) o.push({ k: 'ladyRefresh', pid: p.id, i }); }); return o; }
function doEscape(s, p, cells) {
  const after = { k: 'escapePay', pid: p.id };
  // avoid then pay
  const realCells = [...new Set(cells.filter(c => c >= 0))];
  s.queue.unshift({ k: 'avoid', pid: p.id, cells: realCells, done: [], after: { k: '_escapePay', pid: p.id } });
}
function escapePay(s, t) {
  {
    const p = P(s, t.pid); const costs = D.exitCost[String(Math.max(2, s.n))] || [0, 5, 5, 10, 10];
    const cost = costs[s.escapes] ?? 10;
    if (p.money < cost) { arrest(s, p, 'cantPayExit'); s.queue.unshift({ k: 'turnEnd', pid: p.id }); return; }
    pay(s, p, cost, 'exitCost'); s.escapes++; p.escaped = true; p.escapeOrder = s.escapes; p.escapeCell = locCell(s, p.loc);
    ev(s, { t: 'escape', p: p.id, order: s.escapes, cost });
    s.queue.unshift({ k: 'turnEnd', pid: p.id });
    return;
  }
}
function useContact(s, p, i, why) {
  const c = p.contacts[i]; const C = CONTACT[c.card]; c.used = true;
  if (C.cost > 0 && tokenOK(p, 'm3a')) { useToken(s, p); } else pay(s, p, C.cost, 'contact');
  if (hasAb(p, 'm3b') && p.keepFaceUp && p.money >= cst(p, 2)) { pay(s, p, 2, 'mission'); c.used = false; }
  if (C.notoriety) gain(s, p, 1, 'contactStar');
  ev(s, { t: 'useContact', p: p.id, card: c.card, slot: i });
}
function useFixer(s, p, i) { const x = p.items[i]; const F = FIXER[x.id]; x.used = true; pay(s, p, F.cost, 'fixer'); ev(s, { t: 'useFixer', p: p.id, id: x.id, slot: i }); }
function useGangMember(s, p) { const g = p.gangMembers.shift(); const gang = s.gangs[g]; gang.members++; ev(s, { t: 'useGang', p: p.id, gang: g }); if (gang.members >= 2) { gang.ctrl = null; p.ctrlFree++; ev(s, { t: 'gangFree', p: p.id, gang: g }); } }
function useTravelRes(s, p, u) {
  if (u.r === 'jetski' || u.r === 'sewer' || u.r === 'chopper' || u.r === 'medevac' || u.r === 'gangCardHeli') { if (typeof u.ref === 'string' && u.ref[0] === 'f') useFixer(s, p, +u.ref.slice(1)); else useContact(s, p, u.ref, 'move'); }
  else if (u.r === 'heliFixer' || u.r === 'motorcycleHeli') useFixer(s, p, u.ref);
  else if (u.r === 'gangHeli') useGangMember(s, p);
  else if (u.r === 'm1b') useToken(s, p);
}

// ---------- executive actions (non-movement, non-avoid) ----------
function execOptions(s, p, when) {
  const o = [];
  const effOK = (eff) => {
    switch (eff) {
      case 'lose_notoriety': return true;
      case 'heal': return p.wounds > 0;
      case 'take_contact': return s.cdisplay.length > 0;
      case 'refresh': return p.contacts.some(c => c && c.kind === 'contact' && c.used) || p.items.some(x => x && x.kind === 'equip' && x.used);
      case 'unlock_asset': return lockedAssets(p).length > 0;
      case 'extra_action': return s.discs > 0;
      case 'gain_income': return true;
      case 'move_police': case 'remove_police': return true;
      default: return false;
    }
  };
  p.contacts.forEach((c, i) => {
    if (!c || c.kind !== 'contact' || c.used || i >= 5 - p.cuffs) return; const C = CONTACT[c.card];
    if (p.money < cst(p, C.cost)) return; if (!effOK(C.effect)) return;
    if ((C.effect === 'move_police' || C.effect === 'remove_police') && !s.cells.some(cl => cl && cl.police[C.type])) return;
    if (C.effect === 'lose_notoriety' && when !== 'travel') return; // informer: travel step
    o.push({ src: 'contact', i, eff: C.effect, type: C.type, cost: cst(p, C.cost) });
  });
  p.items.forEach((x, i) => {
    if (!x || x.kind !== 'fixer' || x.used) return; const F = FIXER[x.id]; if (p.money < cst(p, F.cost)) return;
    if (!effOK(F.effect)) return; o.push({ src: 'fixer', i, eff: F.effect, cost: cst(p, F.cost) });
  });
  p.unlocked.forEach((u, i) => {
    if (!u || u.used) return; const A = ASSET[u.id]; const cost = cst(p, UNLOCK_COSTS[i]); if (p.money < cost) return;
    if (A.effect === 'heal' && p.wounds > 0) o.push({ src: 'asset', i, eff: 'heal', cost });
    if (A.effect === 'extra_action' && s.discs > 0) o.push({ src: 'asset', i, eff: 'extra_action', cost });
    if (A.effect === 'move_police' && s.cells.some(cl => cl && cl.police[A.type])) o.push({ src: 'asset', i, eff: 'move_police', type: A.type, cost });
  });
  if (p.firstAid && p.wounds > 0) o.push({ src: 'firstAid', eff: 'heal', cost: 0 });
  if (p.gangMembers.length && p.notor > 1) o.push({ src: 'gang', eff: 'lose_notoriety', cost: 0 });
  if (tokenOK(p, 'm2b') && s.cdisplay.length) o.push({ src: 'mission', eff: 'take_contact', cost: 0 });
  const mMv = { m3c: 'swat', m5c: 'federal', m6c: 'county' };
  for (const ab in mMv) if (tokenOK(p, ab) && s.cells.some(cl => cl && cl.police[mMv[ab]])) o.push({ src: 'mission', eff: 'move_police', type: mMv[ab], cost: 0 });
  return o;
}
E.execOptions = execOptions;
function doExec(s, p, x) {
  // pay / flip source
  if (x.src === 'contact') useContact(s, p, x.i);
  else if (x.src === 'fixer') useFixer(s, p, x.i);
  else if (x.src === 'asset') { const u = p.unlocked[x.i]; u.used = true; pay(s, p, UNLOCK_COSTS[x.i], 'asset'); ev(s, { t: 'useAsset', p: p.id, id: u.id, slot: x.i }); }
  else if (x.src === 'firstAid') { p.firstAid = false; ev(s, { t: 'firstAid', p: p.id }); }
  else if (x.src === 'gang') useGangMember(s, p);
  else if (x.src === 'mission') useToken(s, p);
  switch (x.eff) {
    case 'lose_notoriety': lose(s, p, 1, x.src); break;
    case 'heal': heal(s, p, 1, x.src); break;
    case 'take_contact': s.queue.unshift({ k: 'takeContact', pid: p.id }); break;
    case 'refresh': p.contacts.forEach(c => { if (c && c.kind === 'contact') c.used = false; }); p.items.forEach(it => { if (it && it.kind === 'equip') it.used = false; }); ev(s, { t: 'refresh', p: p.id }); s.queue.unshift(...ladyTasks(p)); break;
    case 'unlock_asset': s.queue.unshift({ k: 'unlock', pid: p.id }); break;
    case 'extra_action': if (s.discs > 0) { s.discs--; p.discs++; ev(s, { t: 'discGain', p: p.id, why: x.src }); } break;
    case 'gain_income': income(s, p, x.src); break;
    case 'move_police': case 'remove_police': {
      const from = x.from != null ? x.from : s.cells.findIndex(cl => cl && cl.police[x.type]);
      if (from < 0 || !s.cells[from].police[x.type]) break;
      s.cells[from].police[x.type] = false;
      if (x.eff === 'remove_police') { ev(s, { t: 'policeRemove', p: p.id, from, type: x.type }); break; }
      const to = x.to != null ? x.to : bestPoliceDump(s, p, x.type, from);
      if (to >= 0) s.cells[to].police[x.type] = true;
      ev(s, { t: 'police', p: p.id, from, to, type: x.type, by: x.src });
      break;
    }
  }
}
E.doExecPreview = null;
function hospitalCell(s) { return locCell(s, 'hospital'); }
function bestPoliceDump(s, p, type, from, exclude) {
  // put officer on a tile far from me, near the leader among others
  const me = locCell(s, p.loc); let best = -1, bv = -1e9;
  s.cells.forEach((cl, i) => {
    if (!cl || (type && cl.police[type]) || i === hospitalCell(s) || i === from || (exclude && exclude.includes(i))) return;
    let v = hexDist(i, me) * 2;
    s.players.forEach(q => { if (q.id !== p.id && !q.escaped && !q.arrested) { const d = hexDist(i, locCell(s, q.loc)); if (d <= 1) v += 1.5; } });
    if (v > bv) { bv = v; best = i; }
  });
  return best;
}
E.bestPoliceDump = bestPoliceDump;

// ---------- avoid ----------
function avoidOptions(s, p, list, t) {
  const o = [];
  const cellsWith = (types) => [...new Set(list.filter(x => types.includes(x.type) || (x.type === 'sandra')).map(x => x.cell))];
  const tileCells = [...new Set(list.map(x => x.cell))];
  const matchT = (off, types) => types.includes(off.type) || off.type === 'sandra';
  p.items.forEach((x, i) => {
    if (!x || x.kind !== 'equip' || x.used) return; const Q = EQUIP[x.id];
    const types = Q.avoids || Q.avoids_one_of;
    list.forEach(off => { if (matchT(off, types)) o.push({ src: 'equip', i, scope: 'one', cell: off.cell, type: off.type, cost: 0 }); });
  });
  p.contacts.forEach((c, i) => {
    if (!c || c.kind !== 'contact' || c.used || i >= 5 - p.cuffs) return; const C = CONTACT[c.card]; if (p.money < cst(p, C.cost)) return;
    if (C.effect === 'avoid_types') cellsWith(C.types).forEach(cell => o.push({ src: 'contact', i, scope: 'types', types: C.types, cell, cost: cst(p, C.cost) }));
    if (C.effect === 'avoid_all_tile') tileCells.forEach(cell => o.push({ src: 'contact', i, scope: 'tile', cell, cost: cst(p, C.cost) }));
    if (C.effect === 'avoid_one_any') list.filter(off => off.type !== 'costa').forEach(off => o.push({ src: 'contact', i, scope: 'one', cell: off.cell, type: off.type, cost: cst(p, C.cost) }));
    if (C.effect === 'move_police') list.filter(off => off.type === C.type || off.type === 'sandra' || off.type === 'costa').forEach(off => o.push({ src: 'contact', i, scope: 'move', cell: off.cell, type: off.type, cost: cst(p, C.cost) }));
    if (C.effect === 'remove_police') list.filter(off => off.type === C.type).forEach(off => o.push({ src: 'contact', i, scope: 'remove', cell: off.cell, type: off.type, cost: cst(p, C.cost) }));
    if (C.effect === 'gang_ability') tileCells.forEach(cell => o.push({ src: 'contact', i, scope: 'tile', cell, cost: cst(p, C.cost) }));
  });
  p.items.forEach((x, i) => {
    if (!x || x.kind !== 'fixer' || x.used) return; const F = FIXER[x.id]; if (p.money < cst(p, F.cost)) return;
    if (F.effect === 'avoid_one_any') list.filter(off => off.type !== 'costa').forEach(off => o.push({ src: 'fixer', i, scope: 'one', cell: off.cell, type: off.type, cost: cst(p, F.cost) }));
    if (F.effect === 'gang_ability') tileCells.forEach(cell => o.push({ src: 'fixer', i, scope: 'tile', cell, cost: cst(p, F.cost) }));
  });
  p.unlocked.forEach((u, i) => {
    if (!u || u.used) return; const A = ASSET[u.id]; const cost = cst(p, UNLOCK_COSTS[i]); if (p.money < cost) return;
    if (A.effect === 'avoid_all_tile') tileCells.forEach(cell => o.push({ src: 'asset', i, scope: 'tile', cell, cost }));
    if (A.effect === 'move_police') list.filter(off => off.type === A.type || off.type === 'sandra' || off.type === 'costa').forEach(off => o.push({ src: 'asset', i, scope: 'move', cell: off.cell, type: off.type, cost }));
  });
  if (p.gangMembers.length) tileCells.forEach(cell => o.push({ src: 'gang', scope: 'tile', cell, cost: 0 }));
  if (p.power === 'scar' && p.gas > 0 && p.money >= cst(p, 2)) list.filter(off => off.type !== 'costa').forEach(off => o.push({ src: 'scar', scope: 'one', cell: off.cell, type: off.type, cost: cst(p, 2) }));
  const mAv = { m1c: 'federal', m2c: 'swat', m4c: 'county' };
  for (const ab in mAv) if (tokenOK(p, ab)) list.filter(off => off.type === mAv[ab] || off.type === 'sandra').forEach(off => o.push({ src: 'mission', scope: 'one', cell: off.cell, type: off.type, cost: 0 }));
  if (hasAb(p, 'm6a')) p.unlocked.forEach((u, i) => { if (!u || u.used || !/^move_/.test(u.id)) return; const cost = cst(p, UNLOCK_COSTS[i]); if (p.money < cost) return; list.filter(off => off.type !== 'costa').forEach(off => o.push({ src: 'asset', i, scope: 'one', cell: off.cell, type: off.type, cost })); });
  return o;
}
function applyAvoid(s, p, a, done) {
  const o = a; // option object
  const mark = (cell, type) => { if (!done.some(d => d.cell === cell && d.type === type)) done.push({ cell, type }); };
  if (o.src === 'equip') { p.items[o.i].used = true; ev(s, { t: 'useEquip', p: p.id, id: p.items[o.i].id, slot: o.i }); }
  else if (o.src === 'contact') useContact(s, p, o.i);
  else if (o.src === 'fixer') useFixer(s, p, o.i);
  else if (o.src === 'asset') { const u = p.unlocked[o.i]; u.used = true; pay(s, p, UNLOCK_COSTS[o.i], 'asset'); ev(s, { t: 'useAsset', p: p.id, id: u.id, slot: o.i }); }
  else if (o.src === 'gang') useGangMember(s, p);
  else if (o.src === 'scar') { p.gas--; s.gasSupply++; pay(s, p, 2, 'power'); ev(s, { t: 'gasUse', p: p.id }); }
  else if (o.src === 'mission') useToken(s, p);
  const cl = s.cells[o.cell];
  const npcHere = s.npcs.filter(n => !n.escaped && posCell(s, n.loc) === o.cell);
  if (o.scope === 'one') mark(o.cell, o.type);
  else if (o.scope === 'types') { o.types.forEach(t => { if (cl.police[t]) mark(o.cell, t); }); npcHere.filter(n => n.npc === 'sandra').forEach(n => mark(o.cell, 'sandra')); }
  else if (o.scope === 'tile') { PTYPES.forEach(t => { if (cl.police[t]) mark(o.cell, t); }); npcHere.forEach(n => mark(o.cell, n.npc)); }
  else if (o.scope === 'move' && (o.type === 'sandra' || o.type === 'costa')) {
    const n = npcHere.find(x => x.npc === o.type); const to = bestPoliceDump(s, p, null, o.cell, a.exclude);
    if (n && to >= 0) { const T = TILE[s.cells[to].tile]; const z = to + ':' + T.edges[0]; const from = n.loc; n.loc = z; ev(s, { t: 'npcMoved', p: p.id, npc: n.id, from, to: z }); mark(o.cell, o.type); }
  }
  else if (o.scope === 'move' || o.scope === 'remove') {
    cl.police[o.type] = false;
    if (o.scope === 'remove') ev(s, { t: 'policeRemove', p: p.id, from: o.cell, type: o.type });
    else { const to = bestPoliceDump(s, p, o.type, o.cell, a.exclude); if (to >= 0) s.cells[to].police[o.type] = true; ev(s, { t: 'police', p: p.id, from: o.cell, to, type: o.type, by: o.src }); }
  }
  ev(s, { t: 'avoided', p: p.id, src: o.src, cell: o.cell, scope: o.scope, type: o.type, types: o.types });
}
E.avoidOptions = avoidOptions;

// ---------- visiting ----------
function visit(s, p, t) {
  const k = locKind(s, t.loc); if (!k) return;
  const others = othersAt(s, p.id, t.loc);
  const steps = [];
  if (t.step === 0) ev(s, { t: 'visit', p: p.id, loc: t.loc, kind: k.type, id: k.id || k.n });
  const nextT = (extra) => Object.assign({}, t, { step: t.step + 1 }, extra || {});
  if (t.resumeSH && k.type === 'safehouse' && t.step === 0) { push(s, Object.assign({}, t, { step: 0.5, resumeSH: false })); return; }
  switch (k.type) {
    case 'hospital':
      if (t.step === 0) { if (p.wounds > 0 && p.money >= cst(p, 1)) { ask(s, p.id, 'choose', { q: 'hospital', opts: [0, 1, 2, 3].filter(n => n <= p.wounds && p.money >= cst(p, [0, 1, 3, 6][n])) }, { k: 'visitStep', t }); return; } push(s, nextT()); return; }
      gain(s, p, 1, 'hospital'); return;
    case 'business': {
      if (t.step === 0) {
        if (others) gain(s, p, others, 'crowd');
        if (s.closed[k.id] && p.power === 'ruby') gain(s, p, 2, 'power');
        else if (s.closed[k.id] && !useKeyAny(s, p)) { ev(s, { t: 'cantVisit', p: p.id, loc: t.loc, why: 'noKey' }); return; }
        p.visited[k.id] = true; p.income = Math.max(0, p.income - 1);
        const val = D.escapePlans.cards[p.plan][PLAN_KEYS.indexOf(k.id)];
        s.bizCubes[k.id].push({ pid: p.id, income: val === '$' });
        ev(s, { t: 'cube', p: p.id, at: k.id, income: val === '$' });
        if (val === '$') income(s, p, 'business');
        if (s.bizCubes[k.id].length >= s.cfg.closeAt && !s.closed[k.id]) { s.closed[k.id] = true; ev(s, { t: 'closed', biz: k.id }); }
        push(s, { k: 'takeContact', pid: p.id });
      }
      return;
    }
    case 'safehouse': {
      if (t.step === 0) {
        if (others && !hasAb(p, 'm4a')) gain(s, p, others, 'crowd');
        p.visited[k.id] = true; p.income = Math.max(0, p.income - 1);
        const val = D.escapePlans.cards[p.plan][PLAN_KEYS.indexOf(k.id)];
        s.shCubes[k.id].push({ pid: p.id, income: val === '$' });
        ev(s, { t: 'cube', p: p.id, at: k.id, income: val === '$' });
        if (val === '$') income(s, p, 'safehouse');
        if (p.power === 'mrv' && !t.mrvDone) { ask(s, p.id, 'choose', { q: 'mrv', opts: ['lose', 'none', 'gain'] }, { k: 'visitStep', t: Object.assign({}, t, { mrvDone: true, step: 0, resumeSH: true }) }); return; }
        lose(s, p, 1, 'safehouse');
        const keys = s.shKeys[k.id];
        if (keys.length) {
          const colors = [...new Set(keys)];
          if (colors.length === 1) { takeKey(s, p, k.id, colors[0]); push(s, nextT()); }
          else ask(s, p.id, 'choose', { q: 'key', opts: colors, sh: k.id }, { k: 'visitStep', t });
          return;
        }
        push(s, nextT()); return;
      }
      if (t.step === 0.5) {
        const keys = s.shKeys[k.id];
        if (keys.length) { const colors = [...new Set(keys)]; if (colors.length === 1) { takeKey(s, p, k.id, colors[0]); push(s, Object.assign({}, t, { step: 1 })); } else ask(s, p.id, 'choose', { q: 'key', opts: colors, sh: k.id }, { k: 'visitStep', t: Object.assign({}, t, { step: 0 }) }); return; }
        push(s, Object.assign({}, t, { step: 1 })); return;
      }
      if (t.step === 1) { // fixer
        const af = s.fixers.filter(f => cst(p, FIXER[f].cost) <= p.money);
        if (af.length && (emptyItem(p) >= 0 || (nonAssetItems(p).length && p.power !== 'shadow'))) { ask(s, p.id, 'choose', { q: 'fixer', opts: ['none'].concat(af) }, { k: 'visitStep', t }); return; }
      }
      return;
    }
    case 'gang': {
      if (t.step === 0) {
        const g = s.gangs[t.loc]; if (p.money < cst(p, gangCost(p)) || p.ctrlFree < 1 || !g || g.members < 2) { ev(s, { t: 'cantVisit', p: p.id, loc: t.loc, why: 'gang' }); return; }
        pay(s, p, gangCost(p), 'gang');
        for (let i = 0; i < g.members; i++) p.gangMembers.push(t.loc);
        g.members = 0; g.ctrl = p.id; p.ctrlFree--;
        ev(s, { t: 'gangHire', p: p.id, gang: t.loc });
      }
      return;
    }
    case 'store': {
      if (t.step === 0) { if (others) gain(s, p, others, 'crowd'); if (p.gas < 2 && s.gasSupply > 0) { ask(s, p.id, 'yesno', { q: 'gas' }, { k: 'visitStep', t }); return; } push(s, nextT()); return; }
      if (t.step === 1 || t.step === 2) { // buy equipment (up to 2 different)
        const bought = t.bought || [];
        const opts = Object.keys(s.equip).filter(id => s.equip[id] > 0 && !bought.includes(id) && cst(p, EQUIP[id].cost) <= p.money);
        if (opts.length && (emptyItem(p) >= 0 || (nonAssetItems(p).length && p.power !== 'shadow'))) { ask(s, p.id, 'choose', { q: 'equip', opts: ['none'].concat(opts), n: bought.length }, { k: 'visitStep', t }); return; }
        push(s, nextT({ step: 3 })); return;
      }
      if (t.step === 3) {
        const lk = lockerOptions(s, p);
        if (lk.length) { ask(s, p.id, 'choose', { q: 'locker', opts: ['none'].concat(lk) }, { k: 'visitStep', t }); return; }
      }
      return;
    }
    case 'exit': {
      if (t.step === 0) {
        if (others) gain(s, p, others, 'crowd');
        const closed = s.patrolSpaces[k.n] >= 2;
        const opts = ['income']; if (closed && s.exitOn[k.n] != null && contactCount(p) > 0 && s.exitStacks[s.exitOn[k.n]].length) opts.push('tile');
        opts.push('none');
        ask(s, p.id, 'choose', { q: 'exit', opts, closed }, { k: 'visitStep', t }); return;
      }
      if (t.step === 1) push(s, { k: 'takeContact', pid: p.id });
      return;
    }
    case 'clinic': {
      if (t.step === 0) { if (others) gain(s, p, others, 'crowd'); if (lockedAssets(p).length) { ask(s, p.id, 'yesno', { q: 'unlock' }, { k: 'visitStep', t }); return; } push(s, nextT()); return; }
      if (t.step === 1) { if (p.wounds > 0) heal(s, p, 1, 'clinic'); push(s, { k: 'takeContact', pid: p.id }); }
      return;
    }
    case 'church': {
      if (t.step === 0) { if (others) gain(s, p, others, 'crowd'); if (p.money >= cst(p, 1)) { ask(s, p.id, 'yesno', { q: 'church' }, { k: 'visitStep', t }); return; } push(s, nextT()); return; }
      if (t.step === 1) { if (lockedAssets(p).length) { ask(s, p.id, 'yesno', { q: 'unlock' }, { k: 'visitStep', t }); return; } push(s, nextT()); return; }
      if (t.step === 2) push(s, { k: 'takeContact', pid: p.id });
      return;
    }
    default: return;
  }
}
function takeKey(s, p, sh, color) { const keys = s.shKeys[sh]; const i = keys.indexOf(color); if (i < 0) return; keys.splice(i, 1); p.keys[sh] = { color, used: false }; ev(s, { t: 'key', p: p.id, sh, color }); }
function useKeyAny(s, p) {
  const k = Object.entries(p.keys).find(([, v]) => !v.used);
  if (k) { k[1].used = true; ev(s, { t: 'keyUse', p: p.id, sh: k[0], color: k[1].color }); return true; }
  const u = p.unlocked.findIndex((x, i) => x && x.id === 'master_key' && !x.used && p.money >= cst(p, UNLOCK_COSTS[i]));
  if (u >= 0) { p.unlocked[u].used = true; pay(s, p, UNLOCK_COSTS[u], 'asset'); ev(s, { t: 'useAsset', p: p.id, id: 'master_key', slot: u }); return true; }
  return false;
}
function lockerOptions(s, p) {
  const tot = p.notor + contactCount(p); const cc = contactCount(p); const o = [];
  for (const col of ['green', 'black', 'brown']) {
    const L = D.lockers.lockers[col]; if (!s.lockers[col].length) continue;
    if (tot < L.min) continue;
    const draw = col === 'green' ? cc + 1 : col === 'black' ? cc : cc - 1; if (draw < 1) continue;
    const key = Object.entries(p.keys).find(([, v]) => !v.used && v.color === col);
    const mk = p.unlocked.findIndex(x => x && x.id === 'master_key' && !x.used);
    if (!key && !(mk >= 0 && p.money >= cst(p, UNLOCK_COSTS[mk])) && p.power !== 'vinnie') continue;
    if (emptyItem(p) < 0 && !nonAssetItems(p).length) continue;
    o.push(col);
  }
  return o;
}
E.lockerOptions = lockerOptions;
function placeItem(s, p, item, slot) {
  if (p.power === 'shadow') {
    let i = emptyItem(p);
    if (i < 0 && (item.kind === 'locker' || item.kind === 'exit')) { i = p.items.findIndex(x => x && (x.kind === 'locker' || x.kind === 'exit') && !x.val2 && x.val2 !== 0); if (i >= 0) { p.items[i].val2 = item.val; ev(s, { t: 'item', p: p.id, item, slot: i, stacked: true }); return true; } }
    if (i < 0) { ev(s, { t: 'itemLost', p: p.id, item, slot: -1 }); return false; }
    p.items[i] = item; ev(s, { t: 'item', p: p.id, item, slot: i }); return true;
  }
  let i = slot != null ? slot : emptyItem(p);
  if (i < 0 || (p.items[i] && p.items[i].kind === 'asset')) { const na = nonAssetItems(p); i = na.length ? na[0] : -1; }
  if (i < 0) return false;
  if (p.items[i]) { ev(s, { t: 'itemLost', p: p.id, item: p.items[i], slot: i }); gain(s, p, 1, 'replace'); }
  p.items[i] = item; ev(s, { t: 'item', p: p.id, item, slot: i }); return true;
}
function visitResolve(s, p, pd, a, c) {
  const t = c.t; const nextT = (extra) => Object.assign({}, t, { step: t.step + 1 }, extra || {});
  switch (pd.q) {
    case 'hospital': { const n = a || 0; if (n) { pay(s, p, [0, 1, 3, 6][n], 'hospital'); heal(s, p, n, 'hospital'); } push(s, nextT()); return; }
    case 'key': takeKey(s, p, pd.sh, a); push(s, nextT()); return;
    case 'fixer': if (a && a !== 'none') { const F = FIXER[a]; pay(s, p, F.cost, 'buyFixer'); s.fixers.splice(s.fixers.indexOf(a), 1); placeItem(s, p, { kind: 'fixer', id: a, used: false }, pd.slot); } return;
    case 'gas': if (a) { p.gas++; s.gasSupply--; ev(s, { t: 'gas', p: p.id }); } push(s, nextT()); return;
    case 'equip': {
      if (!a || a === 'none') { push(s, nextT({ step: 3 })); return; }
      const Q = EQUIP[a]; pay(s, p, Q.cost, 'buyEquip'); s.equip[a]--; placeItem(s, p, { kind: 'equip', id: a, used: false });
      const bought = (t.bought || []).concat([a]);
      push(s, Object.assign({}, t, { step: bought.length >= 2 ? 3 : 2, bought })); return;
    }
    case 'locker': {
      if (!a || a === 'none') return;
      if (p.power === 'claws' && t.extra == null) { const cc0 = contactCount(p); const d0 = a === 'green' ? cc0 + 1 : a === 'black' ? cc0 : cc0 - 1; const mx = Math.min(2, Math.floor(p.money / 2), s.lockers[a].length - d0); if (mx > 0) { ask(s, p.id, 'choose', { q: 'clawsExtra', opts: Array.from({ length: mx + 1 }, (_, i) => i) }, { k: 'visitStep', t: Object.assign({}, t, { pendingLocker: a }) }); return; } }
      const col = a; const cc = contactCount(p); const draw = col === 'green' ? cc + 1 : col === 'black' ? cc : cc - 1;
      const key = Object.entries(p.keys).find(([, v]) => !v.used && v.color === col);
      if (p.power === 'vinnie') { }
      else if (key) { key[1].used = true; ev(s, { t: 'keyUse', p: p.id, sh: key[0], color: col }); }
      else { const mk = p.unlocked.findIndex(x => x && x.id === 'master_key' && !x.used); p.unlocked[mk].used = true; pay(s, p, UNLOCK_COSTS[mk], 'asset'); ev(s, { t: 'useAsset', p: p.id, id: 'master_key', slot: mk }); }
      const extraN = t.extra || 0;
      const drawn = s.lockers[col].splice(0, Math.min(draw + extraN, s.lockers[col].length));
      ask(s, p.id, 'pickTile', { q: 'lockerPick', color: col, tiles: drawn }, { k: 'visitStep', t: Object.assign({}, t, { drawn, col }) });
      return;
    }
    case 'clawsExtra': {
      const n = a | 0; if (n) pay(s, p, 2 * n, 'power');
      if (t.pendingLocker) { visitResolve(s, p, { q: 'locker' }, t.pendingLocker, { t: Object.assign({}, t, { extra: n, pendingLocker: null }) }); return; }
      if (t.pendingExit) { visitResolve(s, p, { q: 'exit', closed: true }, 'tile', { t: Object.assign({}, t, { extra: n, pendingExit: null }) }); return; }
      return;
    }
    case 'lockerPick': {
      const i = Math.max(0, Math.min(t.drawn.length - 1, a | 0)); const val = t.drawn[i];
      const rest = t.drawn.filter((_, j) => j !== i); s.lockers[t.col].push(...rest); shuffle(s, s.lockers[t.col]);
      placeItem(s, p, { kind: 'locker', color: t.col, val });
      if (p.power === 'vinnie') gain(s, p, 1, 'power');
      ev(s, { t: 'locker', p: p.id, color: t.col, n: t.drawn.length }); return;
    }
    case 'exit': {
      if (a === 'income') income(s, p, 'exit');
      else if (a === 'tile') {
        const si = s.exitOn[pd.closed ? +t.loc.slice(4) : 0]; const st = s.exitStacks[si];
        if (p.power === 'claws' && t.extra == null) { const mx = Math.min(2, Math.floor(p.money / 2), st.length - contactCount(p)); if (mx > 0) { ask(s, p.id, 'choose', { q: 'clawsExtra', opts: Array.from({ length: mx + 1 }, (_, i) => i) }, { k: 'visitStep', t: Object.assign({}, t, { pendingExit: true }) }); return; } }
        const drawn = st.splice(0, Math.min(contactCount(p) + (t.extra || 0), st.length));
        ask(s, p.id, 'pickTile', { q: 'exitPick', stack: si, tiles: drawn }, { k: 'visitStep', t: Object.assign({}, t, { drawn, si }) });
        return;
      }
      push(s, nextT()); return;
    }
    case 'exitPick': {
      const i = Math.max(0, Math.min(t.drawn.length - 1, a | 0)); const val = t.drawn[i];
      const rest = t.drawn.filter((_, j) => j !== i); s.exitStacks[t.si].push(...rest); shuffle(s, s.exitStacks[t.si]);
      placeItem(s, p, { kind: 'exit', stack: t.si, val }); ev(s, { t: 'exitTile', p: p.id });
      push(s, nextT()); return;
    }
    case 'unlock': if (a) push(s, { k: 'unlock', pid: p.id }, nextT()); else push(s, nextT()); return;
    case 'church': if (a) { pay(s, p, 1, 'church'); lose(s, p, 1, 'church'); } push(s, nextT()); return;
    case 'mrv': if (a === 'lose') lose(s, p, 1, 'safehouse'); else { if (a === 'gain') gain(s, p, 1, 'power'); wound(s, p, 'power'); } push(s, Object.assign({}, t, { step: 0.5, resumeSH: false })); return;
  }
}

// ---------- missions ----------
function missionMet(s, p) {
  const m = p.mission; if (!m || m.done) return false;
  const cards = p.contacts.filter(c => c && c.kind === 'contact').map(c => CONTACT[c.card]);
  const g = {
    1: () => (2 - p.ctrlFree) >= 2 || (cards.length >= 3 && !cards.some(C => C.name === 'Bribe' || C.name === 'Snitch')),
    2: () => Object.values(s.bizCubes).flat().filter(c => c.pid === p.id && c.income).length >= 2 || (p.items.some(x => x && x.kind === 'locker') && p.items.some(x => x && x.kind === 'exit')),
    3: () => GROUPS.purple.every(b => p.visited[b]) || GROUPS.blue.every(b => p.visited[b]) || cards.filter(C => !C.notoriety).length >= 3,
    4: () => Object.values(p.discDay).some(n => n >= 2) || cards.filter(C => C.notoriety).length >= 3,
    5: () => ['sh1', 'sh2', 'sh3'].filter(x => p.visited[x]).length >= 2 || p.notor >= Math.min(7, s.cfg.max),
    6: () => p.unlocked.filter(Boolean).length >= 5 || p.items.filter(x => x && x.kind === 'equip' && !x.used).length >= 3
  }[m.id];
  return g ? g() : false;
}
E.missionMet = missionMet;
function missionCheck(s, p) {
  if (!p.mission || p.mission.done || !missionMet(s, p)) return;
  p.mission.done = true; ev(s, { t: 'missionDone', p: p.id, id: p.mission.id });
  ask(s, p.id, 'choose', { q: 'mission', opts: ['a', 'b', 'c'], mission: p.mission.id }, { k: 'mission', pid: p.id });
}

// ---------- notoriety ----------
function adjustNotoriety(s, p) {
  const net = p.red - p.blue; p.red = 0; p.blue = 0;
  if (!net) return;
  const before = p.notor; let after = before + net; let excess = 0;
  if (after < 1) after = 1; if (after > s.cfg.max) { excess = after - s.cfg.max; after = s.cfg.max; }
  p.notor = after; ev(s, { t: 'level', p: p.id, from: before, to: after });
  if (!p.npc) for (let i = 0; i < excess; i++) wound(s, p, 'notorietyMax');
  if (after > before) {
    const crossed = s.cfg.th.filter(x => x > before && x <= after);
    const tasks = [];
    const humans = s.players.filter(q => !q.arrested && !q.escaped);
    crossed.forEach(th => {
      const idx = s.cfg.th.indexOf(th);
      ev(s, { t: 'threshold', p: p.id, n: idx + 1 });
      s.order.forEach(qid => {
        const q = P(s, qid); if (q.id === p.id || q.arrested || q.escaped || q.notor >= p.notor) return;
        let mover = q.id;
        if (q.npc) { const other = humans.find(h => h.id !== p.id); mover = other ? other.id : (p.npc ? null : p.id); }
        if (mover != null) tasks.push({ k: 'policeMove', mover, target: p.id, onBehalf: q.npc ? q.id : null });
      });
      if (!p.npc) {
        const un = idx === 1 ? 2 : 1; for (let u = 0; u < un; u++) tasks.push({ k: 'unlock', pid: p.id });
        if (idx === 2) { if (s.discs > 0) { s.discs--; p.discs++; ev(s, { t: 'discGain', p: p.id, why: 'threshold' }); } }
      }
    });
    push(s, ...tasks);
  }
}
function policeMoveOptions(s, target) {
  const tc = target.escaped ? target.escapeCell : posCell(s, target.loc); const hosp = hospitalCell(s); const o = [];
  s.cells.forEach((cl, i) => {
    if (!cl) return; PTYPES.forEach(ty => {
      if (!cl.police[ty]) return; const d0 = hexDist(i, tc);
      s.cells.forEach((c2, j) => { if (!c2 || j === i || j === hosp || c2.police[ty]) return; if (hexDist(j, tc) <= d0 - 1) o.push({ from: i, to: j, type: ty }); });
    });
  });
  return o;
}
E.policeMoveOptions = policeMoveOptions;


// ---------- NPCs: Inspector Sandra (2p & solo) and Lt. Costa (solo) ----------
function cardLoc(s, key) {
  if (/^exit\d$/.test(key) || /^store[A-D]$/.test(key)) return mapHasLoc(s, key) ? key : null;
  for (const [slot, id] of Object.entries(s.bizSlots)) if (id === key) return mapHasLoc(s, slot) ? slot : null;
  for (const [slot, id] of Object.entries(s.shSlots)) if (id === key) return mapHasLoc(s, slot) ? slot : null;
  return null;
}
function npcLastTurn(s, n, part) { return s.day === 3 && (part === 4 || (part === 2 && n.discs < 1) || (part === 3 && n.discs < 2)); }
function npcTurn(s, n, part) {
  if (part >= 3) { if (n.discs < 1) return; n.discs--; ev(s, { t: 'disc', p: n.id }); }
  ev(s, { t: 'turn', p: n.id });
  if (n.npc === 'costa' && s.escapes > 0) { n.debt += 1; ev(s, { t: 'money', p: n.id, d: -1, why: 'lateFee' }); }
  const cards = n.npc === 'sandra' ? D.inspector.cards : D.lieutenant.cards;
  const human = s.players.find(q => !q.escaped && !q.arrested);
  const hc = human ? locCell(s, human.loc) : -1;
  const tried = []; let pick = null, locId = null;
  while (n.deck.length) {
    const ci = n.deck.shift(); const card = cards[ci]; const lid = cardLoc(s, card.loc);
    const isExit = /^exit/.test(card.loc); const open = lid && isOpenExit(s, lid);
    if (n.npc === 'costa' && /^(casino|bar|restaurant|gym|nightclub|gallery)$/.test(card.loc) && s.closed[card.loc]) { ev(s, { t: 'npcDiscard', p: n.id, loc: card.loc }); continue; }
    let ok = !!lid;
    if (ok && isExit && open && s.day < 3) ok = false;
    if (ok && isExit && !open && n.npc === 'costa' && false) ok = false;
    if (ok && n.npc === 'costa' && hc >= 0 && hexDist(locCell(s, lid), hc) > 1) ok = false;
    if (ok && lid === n.loc) ok = false;
    if (!ok) { tried.push(ci); continue; }
    pick = card; locId = lid; break;
  }
  n.deck.push(...tried); shuffle(s, n.deck);
  if (!pick) {
    ev(s, { t: 'npcStay', p: n.id });
    if (n.npc === 'costa' && npcLastTurn(s, n, part)) npcEscape(s, n);
    return;
  }
  const from = n.loc; n.loc = locId;
  ev(s, { t: 'move', p: n.id, from, to: locId, path: [from, '^' + locId], mp: 0, npc: true, card: pick.loc });
  const isExit = /^exit/.test(pick.loc);
  if (isExit && s.day === 3 && isOpenExit(s, locId)) { if (n.npc === 'costa') npcEscape(s, n); else ev(s, { t: 'npcWait', p: n.id }); return; }
  // visit
  const crowd = everyone(s).filter(q => q.id !== n.id && !q.escaped && !q.arrested && q.loc === locId).length;
  if (crowd) gain(s, n, crowd, 'crowd');
  if (pick.notoriety > 0) gain(s, n, 1, 'card'); else lose(s, n, 1, 'card');
  const k = locKind(s, locId);
  const gotDisc = (why) => { if (s.discs > 0) { s.discs--; n.discs++; ev(s, { t: 'discGain', p: n.id, why }); } };
  const npcContacts = (cnt) => {
    for (let i = 0; i < cnt && s.cdisplay.length; i++) {
      const card = s.cdisplay.pop();
      if (n.npc === 'costa') { n.contacts.push(card); ev(s, { t: 'npcContact', p: n.id, card }); }
      else { ev(s, { t: 'contactDiscard', p: n.id, card }); if (CONTACT[card].effect === 'extra_action') gotDisc('contact'); }
    }
    while (s.cdisplay.length < 7 && s.deck.length) { const nc = s.deck.shift(); s.cdisplay.unshift(nc); ev(s, { t: 'cdraw', card: nc }); }
  };
  if (k.type === 'business') {
    n.visited[k.id] = true; s.bizCubes[k.id].push({ pid: n.id, income: false }); ev(s, { t: 'cube', p: n.id, at: k.id });
    if (s.bizCubes[k.id].length >= s.cfg.closeAt && !s.closed[k.id]) { s.closed[k.id] = true; ev(s, { t: 'closed', biz: k.id }); }
    npcContacts(n.npc === 'costa' ? 1 : 2);
    for (const g in GROUPS) if (!n.bonus[g] && GROUPS[g].every(b => n.visited[b])) { n.bonus[g] = true; gotDisc('group'); }
  } else if (k.type === 'safehouse') {
    n.visited[k.id] = true; s.shCubes[k.id].push({ pid: n.id, income: false }); ev(s, { t: 'cube', p: n.id, at: k.id });
    if (s.fixers.length) { const f = s.fixers.splice(Math.floor(rnd(s) * s.fixers.length), 1)[0]; ev(s, { t: 'fixerDiscard', p: n.id, id: f }); }
    const keys = s.shKeys[k.id]; if (keys.length) { const kc = keys.splice(Math.floor(rnd(s) * keys.length), 1)[0]; ev(s, { t: 'keyDiscard', p: n.id, sh: k.id, color: kc }); }
    if (!n.bonus.sh && ['sh1', 'sh2', 'sh3'].every(x => n.visited[x])) { n.bonus.sh = true; gotDisc('sh'); }
  } else if (k.type === 'store') {
    const col = { storeA: 'brown', storeB: 'black', storeC: 'green', storeD: 'all' }[locId];
    if (n.npc === 'sandra') {
      npcContacts(2);
      (col === 'all' ? ['green', 'black', 'brown'] : [col]).forEach(c => { if (s.lockers[c].length) { s.lockers[c].splice(Math.floor(rnd(s) * s.lockers[c].length), 1); ev(s, { t: 'lockerDiscard', p: n.id, color: c }); } });
    } else {
      const st = col === 'all' ? { d: true, tiles: ['green', 'black', 'brown'].filter(c => s.lockers[c].length).map(c => ({ kind: 'locker', color: c, val: s.lockers[c].shift() })) }
        : { tiles: s.lockers[col].splice(0, n.easy ? 1 : 2).map(v => ({ kind: 'locker', color: col, val: v })) };
      costaStack(s, n, st);
    }
  } else if (k.type === 'exit') {
    const si = s.exitOn[k.n];
    if (si != null) {
      if (n.npc === 'sandra') { const stck = s.exitStacks[si]; if (stck.length) { stck.splice(Math.floor(rnd(s) * stck.length), 1); ev(s, { t: 'exitDiscard', p: n.id }); } npcContacts(2); }
      else costaStack(s, n, { tiles: s.exitStacks[si].splice(0, n.easy ? 1 : 2).map(v => ({ kind: 'exit', val: v })) });
    }
  }
  if (n.npc === 'costa' && npcLastTurn(s, n, part) && !n.escaped) npcEscape(s, n);
}
function costaStack(s, n, st) {
  if (!st.tiles.length) return;
  if (n.stacks.length >= 5) { const r = Math.floor(rnd(s) * 5); n.stacks.splice(r, 1); gain(s, n, 1, 'replace'); }
  n.stacks.push(st); ev(s, { t: 'npcStack', p: n.id, n: st.tiles.length });
}
function npcEscape(s, n) {
  const ex = E.locsOnMap(s).find(l => l.type === 'exit' && isOpenExit(s, l.id));
  if (ex) { const from = n.loc; n.loc = ex.id; ev(s, { t: 'move', p: n.id, from, to: ex.id, path: [from, '^' + ex.id], mp: 0, npc: true }); }
  const costs = D.exitCost['2']; const cost = costs[s.escapes] ?? 10;
  n.debt += cost; s.escapes++; n.escaped = true; n.escapeOrder = s.escapes; n.escapeCell = ex ? ex.cell : -1;
  ev(s, { t: 'escape', p: n.id, order: s.escapes, cost });
}
const TOP_LOCKER = { green: 90, black: 100, brown: 110 };
function costaScore(s, n) {
  const plan = D.escapePlans.cards[n.plan];
  const val = (k) => { const v = plan[PLAN_KEYS.indexOf(k)]; return v === '$' ? 0 : v; };
  const g1 = GROUPS.purple.filter(b => n.visited[b]).reduce((a, b) => a + val(b), 0);
  const g2 = GROUPS.blue.filter(b => n.visited[b]).reduce((a, b) => a + val(b), 0);
  const sh = ['sh1', 'sh2', 'sh3'].filter(b => n.visited[b]).reduce((a, b) => a + val(b), 0);
  const tv = (t) => t.val || (t.kind === 'exit' ? 70 : TOP_LOCKER[t.color]);
  const bags = n.stacks.reduce((a, st) => a + (st.d ? Math.max(0, ...st.tiles.map(tv)) : st.tiles.reduce((x, t) => x + tv(t), 0)), 0);
  const contacts = CONTACT_SCORE[Math.min(5, n.contacts.length)];
  const notor = -s.cfg.pen[n.notor];
  const total = g1 + g2 + sh + contacts + bags + notor - n.debt;
  return { pid: n.id, npc: 'costa', escaped: true, g1, g2, sh, cash: -n.debt, assets: 0, contacts, bags, notor, wounds: 0, total };
}

// ---------- scoring ----------
E.score = function (s) {
  return s.players.map(p => {
    const plan = D.escapePlans.cards[p.plan];
    const val = (k) => { const v = plan[PLAN_KEYS.indexOf(k)]; return v === '$' ? 0 : v; };
    const g1 = GROUPS.purple.filter(b => p.visited[b]).reduce((a, b) => a + val(b), 0);
    const g2 = GROUPS.blue.filter(b => p.visited[b]).reduce((a, b) => a + val(b), 0);
    const sh = ['sh1', 'sh2', 'sh3'].filter(b => p.visited[b]).reduce((a, b) => a + val(b), 0);
    const assets = p.unlocked.filter(u => u && u.used).length * 10;
    const cc = Math.max(0, p.contacts.filter(c => c && c.kind === 'contact').length - p.cuffs);
    const contacts = CONTACT_SCORE[Math.min(5, cc)];
    const bags = p.items.filter(x => x && (x.kind === 'locker' || x.kind === 'exit')).reduce((a, x) => a + x.val + (x.val2 || 0), 0);
    const notor = -s.cfg.pen[p.notor];
    const wounds = -20 * p.wounds;
    const total = g1 + g2 + sh + p.money + assets + contacts + bags + notor + wounds;
    return { pid: p.id, escaped: p.escaped, g1, g2, sh, cash: p.money, assets, contacts, bags, notor, wounds, total: p.escaped ? total : 0 };
  }).concat(s.npcs.filter(n => n.npc === 'costa').map(n => costaScore(s, n)));
};
E.winners = function (s) {
  const sc = s.score || E.score(s); const el = sc.filter(x => x.escaped); if (!el.length) return [];
  el.sort((a, b) => b.total - a.total || b.cash - a.cash || P(s, a.pid).notor - P(s, b.pid).notor || (P(s, a.pid).wounds || 0) - (P(s, b.pid).wounds || 0));
  const top = el[0]; return el.filter(x => x.total === top.total && x.cash === top.cash && P(s, x.pid).notor === P(s, top.pid).notor && P(s, x.pid).wounds === P(s, top.pid).wounds).map(x => x.pid);
};

E.clone = clone;
if (typeof module !== 'undefined' && module.exports) module.exports = E; else root.HeistEngine = E;
})(this);
