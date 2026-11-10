/* Heist — computer opponent (heuristic). AI.decide(state, E) -> action for state.pending */
(function (root) {
'use strict';
const AI = {};
const AVOID_EFF = { avoid_types: 1, avoid_all_tile: 1, avoid_one_any: 1 };

function reserve(E, s, p) {
  if (s.day === 3) return escCost(E, s) + (s.escapes ? 3 - Math.min(2, s.part) : 1);
  if (s.day === 2) return 8 + s.part * 1.5;
  return 3 + s.part;
}
function spendable(E, s, p) { return p.money - reserve(E, s, p); }
function avoidCapacity(E, p) {
  let n = 0;
  p.items.forEach(x => { if (x && x.kind === 'equip' && !x.used) n++; if (x && x.kind === 'fixer' && !x.used && E.FIXER[x.id].effect === 'avoid_one_any') n++; });
  p.contacts.forEach((c, i) => { if (c && c.kind === 'contact' && !c.used && i < 5 - p.cuffs) { const C = E.CONTACT[c.card]; if (AVOID_EFF[C.effect]) n += C.effect === 'avoid_one_any' ? 1 : 2; if (C.effect === 'move_police' || C.effect === 'remove_police') n += 0.5; } });
  p.unlocked.forEach(u => { if (u && !u.used && (u.id === 'avoid_tile')) n += 2; });
  n += p.gangMembers.length * 2;
  return n;
}
function planVal(E, s, p, key) { const D = E._D; const v = D.escapePlans.cards[p.plan][E.PLAN_KEYS.indexOf(key)]; return v; }

function destValue(E, s, p, dest) {
  const k = E.locKind(s, dest); if (!k) return -99;
  const others = s.players.filter(q => q.id !== p.id && !q.escaped && !q.arrested && q.loc === dest).length;
  const day = s.day; const late = day === 3;
  let v = 0;
  const short = Math.max(0, reserve(E, s, p) - p.money); const incW = 1.5 + (short ? 3 + (late ? 6 : 0) : 0);
  switch (k.type) {
    case 'business': { const pv = planVal(E, s, p, k.id); v = (pv === '$' ? Math.max(0, p.income - 1) * incW + 6 : pv * 0.8) + 8; if (s.closed[k.id]) v -= 6; break; }
    case 'safehouse': { const pv = planVal(E, s, p, k.id); v = (pv === '$' ? Math.max(0, p.income - 1) * incW + 6 : pv * 0.8) + 10; break; }
    case 'store': {
      const emptyI = p.items.filter(x => x === null).length;
      v = 4 + (p.gas < 2 ? 2 : 0) + (emptyI && p.money >= 4 ? 6 : 0);
      if (E.lockerOptions(s, p).length) v += 45;
      break;
    }
    case 'gang': v = spendable(E, s, p) >= 6 && p.gangMembers.length === 0 && s.day < 3 ? 14 : -20; break;
    case 'hospital': v = p.wounds > 0 && spendable(E, s, p) >= 1 ? 16 * Math.min(p.wounds, spendable(E, s, p) >= 3 ? 2 : 1) - 6 : -10; break;
    case 'clinic': v = 8 + (p.wounds ? 16 : 0) + (E.lockedAssets(p).length ? 4 : 0); break;
    case 'church': v = 8 + (E.lockedAssets(p).length ? 4 : 0) + (p.notor > 2 ? 4 : 0); break;
    case 'exit': {
      const closed = s.patrolSpaces[k.n] >= 2; const cc = E.contactCount(p);
      v = 5 + p.income * (short ? incW : 0.6); if (closed && cc >= 1 && s.exitOn[k.n] != null) v = Math.max(v, 25 + cc * 6);
      break;
    }
    case 'subway': case 'heliport': v = -2; break;
  }
  if (k.type !== 'hospital') v -= others * 4;
  if (late) { // prefer staying near open exit
    const ex = E.locsOnMap(s).find(l => l.type === 'exit' && E.isOpenExit(s, l.id));
    if (ex) { const d = E.hexDist(E.locCell(s, dest), ex.cell); v -= d * (s.part >= 1 ? 8 : 3); }
  }
  return v;
}

function chooseAction(E, s, p, pd) {
  // executive pre-actions (informer when notoriety high)
  const ex = pd.exec || [];
  const inf = ex.find(x => x.eff === 'lose_notoriety' && p.notor + p.red - p.blue >= 4 && x.cost <= p.money - 3);
  if (inf && !p._infUsed) { p._infUsed = true; return { exec: inf }; }
  p._infUsed = false;
  const healX = ex.find(x => x.eff === 'heal' && p.wounds > 0 && x.cost <= Math.min(2, spendable(E, s, p)));
  if (healX) return { exec: healX };
  if (s.day === 3 && pd.canEscapeHere) {
    const needs = escCost(E, s); if (p.money >= needs) return { type: 'escapeHere' };
  }
  const cap = avoidCapacity(E, p);
  let best = null, bv = -1e9;
  for (const dest in pd.moves) {
    pd.moves[dest].forEach((pl, i) => {
      let v = destValue(E, s, p, dest);
      let esc = false;
      if (pl.escape) {
        const needs = escCost(E, s);
        if (p.money >= needs) { esc = true; v = (s.part >= 1 || needs === 0 || p.money < needs + 6) ? 400 : 60; }
        else v = 80 + p.income; // go there, take income, escape next turn
      }
      const costMoney = pl.uses.length ? 2 : 0; if (costMoney > spendable(E, s, p) && !esc) v -= 15;
      const unav = Math.max(0, pl.police - cap); v -= unav * 18 + pl.police * 2.5;
      v -= pl.extraMp * 3 + pl.uses.length * 4;
      if (v > bv) { bv = v; best = { type: 'move', dest, plan: i, escape: esc }; }
    });
  }
  let restV = -1e9;
  if (pd.canRest) {
    const used = p.contacts.filter(c => c && c.kind === 'contact' && c.used).length + p.items.filter(x => x && x.kind === 'equip' && x.used).length;
    restV = used * 6 + (E.lockedAssets(p).length ? 9 : 0) + (p.firstAid ? 0 : 3);
    if (s.day === 3 && s.part >= 2) restV -= 40;
  }
  if (best && bv >= restV) return best;
  if (pd.canRest) return { type: 'rest' };
  if (best) return best;
  return { type: 'pass' };
}
function escIfDay3(E, s) { return s.day === 3 ? escCost(E, s) : 0; }
function escCost(E, s) { const t = E._D.exitCost[String(Math.max(2, s.n))] || [0, 5, 5, 10, 10]; return t[s.escapes] ?? 10; }

function chooseAvoid(E, s, p, pd) {
  const opts = pd.options; if (!opts.length) return { done: true };
  // value of option = officers covered; cost money
  let best = null, bv = 0;
  opts.forEach(o => {
    const cl = s.cells[o.cell]; let cover = 1;
    if (o.scope === 'tile') cover = pd.officers.filter(x => x.cell === o.cell).length;
    if (o.scope === 'types') cover = pd.officers.filter(x => x.cell === o.cell && o.types.includes(x.type)).length;
    if (o.cost > spendable(E, s, p) && !(cover >= 2 && o.cost <= p.money - escIfDay3(E, s))) return;
    let v = cover * 20 - o.cost * 2 - (o.src === 'equip' ? 0 : o.src === 'gang' ? 2 : o.src === 'asset' ? 3 : 1);
    if (o.scope === 'tile' && cover === 1 && o.src !== 'equip') v -= 6;
    if (v > bv) { bv = v; best = o; }
  });
  if (best) return best;
  return { done: true };
}

function contactPref(E, card) {
  const C = E.CONTACT[card]; const m = { avoid_all_tile: 10, avoid_types: 9, avoid_one_any: 8, gang_ability: 8, extra_action: 7, unlock_asset: 7, heal: 6, chopper: 6, remove_police: 6, move_police: 5, take_contact: 6, refresh: 5, lose_notoriety: 5, gain_income: 6, sewer: 4, jetski: 3, medevac: 3, plus_mp: 4 };
  return (m[C.effect] || 3) - C.cost * 0.5;
}

AI.decide = function (E, s) {
  const pd = s.pending; const p = s.players[pd.pid];
  switch (pd.type) {
    case 'place': {
      let best = null, bv = -1e9;
      pd.display.forEach(tile => {
        E.legalPlacements(s, tile).forEach(pl => {
          let v = ((pl.cell * 7 + pl.rot * 13 + tile.charCodeAt(1) + s.day) % 10) / 20;
          for (let e = 0; e < 6; e++) { const j = E.nb(pl.cell, e); if (j < 0 || !s.cells[j]) continue; const o = s.cells[j]; E.contacts(tile, pl.rot, e, o.tile, o.rot).forEach(k => { if (k.a[0] !== '@' && k.b[0] !== '@' && E.landOf(k.a) === E.landOf(k.b)) v += k.len * 2; }); }
          const me = E.locCell(s, p.loc); if (me >= 0) v -= E.hexDist(me, pl.cell) * 0.3;
          if (v > bv) { bv = v; best = { tile, cell: pl.cell, rot: pl.rot }; }
        });
      });
      // business / safehouse choice: prefer my valuable ones near me
      const fb = E.freeBiz(s); const fs = E.freeSh(s);
      const val = k => { const v = planVal(E, s, p, k); return v === '$' ? 40 : v; };
      best.biz = fb.sort((a, b) => val(b) - val(a))[0]; best.sh = fs.sort((a, b) => val(b) - val(a))[0];
      return best;
    }
    case 'action': return chooseAction(E, s, p, pd);
    case 'avoid': return chooseAvoid(E, s, p, pd);
    case 'contact': {
      const cards = pd.display.slice().sort((a, b) => contactPref(E, b) - contactPref(E, a));
      const c = cards[0];
      if (pd.hasEmpty) return { card: c, opt: 'B' };
      const mine = pd.mine.slice().sort((a, b) => contactPref(E, a.card) - contactPref(E, b.card));
      if (mine.length && contactPref(E, c) > contactPref(E, mine[0].card) + 3) return { card: c, opt: 'C', replace: mine[0].i };
      return { card: c, opt: 'A' };
    }
    case 'unlock': {
      const pref = ['avoid_tile', 'master_key', 'heal', 'move_swat', 'move_federal', 'move_county'];
      const a = pd.assets.slice().sort((x, y) => pref.indexOf(x.id) - pref.indexOf(y.id))[0];
      return { where: a.where, i: a.i };
    }
    case 'yesno': {
      switch (pd.q) {
        case 'incomeUnlock': return spendable(E, s, p) >= 3;
        case 'useDisc': return true;
        case 'gas': return true;
        case 'unlock': return true;
        case 'church': return p.notor + p.red - p.blue > 1 && spendable(E, s, p) >= 1;
        case 'ladyRefresh': return spendable(E, s, p) >= pd.price;
        case 'swapOrder': return true;
      }
      return true;
    }
    case 'choose': {
      const o = pd.opts;
      switch (pd.q) {
        case 'bonus_sh': case 'bonus_biz': return E.lockedAssets(p).length ? 'unlock' : 'disc';
        case 'hospital': { let n = 0; o.forEach(x => { if ([0, 1, 3, 6][x] <= spendable(E, s, p)) n = Math.max(n, x); }); return n; }
        case 'key': { const pr = ['brown', 'black', 'green']; return o.slice().sort((a, b) => pr.indexOf(a) - pr.indexOf(b))[0]; }
        case 'fixer': {
          const empty = p.items.some(x => x === null); if (!empty || spendable(E, s, p) < 3 || s.day === 3) return 'none';
          const pr = ['idcard', 'motorcycle', 'skater', 'firstaid', 'telephone', 'gold', 'safe', 'energy', 'disguise', 'helicopter', 'scuba'];
          const c = o.filter(x => x !== 'none').sort((a, b) => pr.indexOf(a) - pr.indexOf(b))[0];
          return c && E.FIXER[c].cost <= spendable(E, s, p) ? c : 'none';
        }
        case 'equip': {
          const empty = p.items.some(x => x === null); if (!empty || spendable(E, s, p) < 2 || (s.day === 3 && s.part >= 2)) return 'none';
          const cnt = { county: 0, federal: 0, swat: 0 }; s.cells.forEach(cl => { if (cl) E.PTYPES.forEach(t => { if (cl.police[t]) cnt[t]++; }); });
          const have = new Set(p.items.filter(x => x && x.kind === 'equip').map(x => x.id));
          const score = id => { const Q = E.EQUIP[id]; const ty = Q.avoids || Q.avoids_one_of; return ty.reduce((a, t) => a + cnt[t], 0) - (have.has(id) ? 3 : 0) - Q.cost * 0.3; };
          const c = o.filter(x => x !== 'none' && E.EQUIP[x].cost <= spendable(E, s, p)).sort((a, b) => score(b) - score(a))[0];
          return c || 'none';
        }
        case 'locker': { const pr = ['brown', 'black', 'green']; const c = o.filter(x => x !== 'none').sort((a, b) => pr.indexOf(a) - pr.indexOf(b))[0]; return c || 'none'; }
        case 'exit': return o.includes('tile') && p.money >= reserve(E, s, p) ? 'tile' : 'income';
        case 'clawsExtra': return spendable(E, s, p) >= 4 ? Math.min(1, o[o.length - 1]) : 0;
        case 'mrv': return 'lose';
        case 'mission': return { 1: 'c', 2: 'a', 3: 'a', 4: 'c', 5: 'b', 6: 'b' }[pd.mission] || 'a';
      }
      return o[0];
    }
    case 'pickTile': { let bi = 0; pd.tiles.forEach((v, i) => { if (v > pd.tiles[bi]) bi = i; }); return bi; }
    case 'end': {
      const ex = pd.exec;
      const sp = spendable(E, s, p);
      const pick = ex.find(x => x.eff === 'gain_income' && x.cost < p.income - 1)
        || ex.find(x => x.eff === 'heal' && p.wounds > 0 && x.cost <= sp)
        || ex.find(x => x.eff === 'extra_action' && x.cost <= sp - 1 && s.day < 3)
        || ex.find(x => x.eff === 'unlock_asset' && x.cost <= sp - 1)
        || ex.find(x => x.eff === 'take_contact' && x.cost <= sp - 1 && p.contacts.some((c, i) => c === null && i < 5 - p.cuffs))
        || ex.find(x => x.eff === 'refresh' && x.cost <= sp - 1 && (p.contacts.filter(c => c && c.used).length + p.items.filter(i => i && i.kind === 'equip' && i.used).length) >= 3);
      return pick ? { exec: pick } : null;
    }
    case 'policeMove': {
      const T = E.P(s, pd.target); const tc = T.escaped ? T.escapeCell : E.posCell(s, T.loc); const me = E.locCell(s, p.loc);
      const self = pd.target === p.id;
      let best = pd.opts[0], bv = -1e9;
      pd.opts.forEach(o => { let v = self ? E.hexDist(o.to, tc) * 10 + (o.from === me ? 5 : 0) : -E.hexDist(o.to, tc) * 10; if (!self && o.to === me) v -= 30; if (!self && o.from === me) v += 8; if (v > bv) { bv = v; best = o; } });
      return best;
    }
  }
  throw new Error('AI cannot handle ' + pd.type);
};

if (typeof module !== 'undefined' && module.exports) module.exports = AI; else root.HeistAI = AI;
})(this);
