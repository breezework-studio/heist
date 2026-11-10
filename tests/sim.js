// Bot-only full games: node tests/sim.js [games] [players]
const E = require('../src/engine.js'), AI = require('../src/ai.js'), DATA = require('../tools/data.js');
E.init(DATA);
const N = +process.argv[2] || 10; const fixedN = +process.argv[3] || 0; const MODE = process.argv[4] || 'base';
const POWERS = DATA.powers.powers.map(x => x.id);
let stats = { games: 0, escaped: 0, arrested: 0, decisions: 0, totals: [], wounds: 0 };
function check(s) {
  s.players.forEach(p => { if (p.money < 0) throw new Error('negative money p' + p.id + ' ' + p.money); if (p.wounds < 0 || p.wounds > 3) throw new Error('wounds'); if (p.notor < 1 || p.notor > s.cfg.max) throw new Error('notor'); });
  const cnt = { county: 0, federal: 0, swat: 0 };
  s.cells.forEach(c => { if (c) E.PTYPES.forEach(t => { if (c.police[t]) cnt[t]++; }); });
  s.display.forEach(d => E.PTYPES.forEach(t => { if (d.police[t]) cnt[t]++; }));
  E.PTYPES.forEach(t => { if (cnt[t] + s.bag[t] > 10) throw new Error('police count ' + t); });
  const h = E.locCell(s, 'hospital'); if (h >= 0 && E.PTYPES.some(t => s.cells[h].police[t])) throw new Error('police on hospital');
}
for (let g = 0; g < N; g++) {
  const n = fixedN || (1 + (g % 5));
  const s = E.newGame({ seed: 1000 + g, missions: MODE === 'missions' || MODE === 'both', players: Array.from({ length: n }, (_, i) => ({ ai: true, power: (MODE === 'powers' || MODE === 'both') ? POWERS[(g * 3 + i) % POWERS.length] : null })) });
  let steps = 0;
  try {
    while (!s.over) {
      if (!s.pending) throw new Error('stalled');
      const a = AI.decide(E, s); E.act(s, a); steps++; s.events.length = 0;
      check(s);
      if (steps > 20000) throw new Error('too many steps');
    }
  } catch (e) { console.error('GAME', g, 'seed', 1000 + g, 'day', s.day, 'part', s.part, 'pending', s.pending && s.pending.type, e.stack); process.exit(1); }
  stats.games++; stats.decisions += steps;
  s.score.forEach(x => { if (x.escaped) { stats.escaped++; stats.totals.push(x.total); } else stats.arrested++; });
  s.players.forEach(p => stats.wounds += p.wounds);
}
const avg = stats.totals.reduce((a, b) => a + b, 0) / Math.max(1, stats.totals.length);
console.log(`games ${stats.games}  decisions/game ${(stats.decisions / stats.games).toFixed(0)}  escaped ${stats.escaped}  arrested ${stats.arrested}  avg score ${avg.toFixed(0)}k  max ${Math.max(...stats.totals)}k`);
