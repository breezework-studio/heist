// Browser playthrough: node tests/uitest.js [humans] [screenshotsDir]
// Drives the real UI in Chromium; human decisions are taken by the AI through the UI entry point.
const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const humans = +process.argv[2] || 1; const shots = process.argv[3] && process.argv[3] !== '-' ? process.argv[3] : null; const mode = process.argv[4] || 'base'; const seats = +process.argv[5] || 4;
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const errors = [];
  page.on('pageerror', e => errors.push(String(e.stack || e)));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto('file://' + path.join(__dirname, '..', 'index.html'));
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.click('#mNew');
  // seats: configure humans
  await page.evaluate((nh) => { const st = window.HeistUI.G; }, humans);
  const cols = ['orange', 'purple', 'pink', 'yellow', 'green'];
  for (let i = 0; i < 5; i++) { const v = i >= seats ? 'off' : i < humans ? 'human' : 'ai'; await page.click(`.seg[data-c="${cols[i]}"] button[data-v="${v}"]`); }
  await page.click(`#oMode button[data-v="${mode}"]`);
  if (shots) await page.screenshot({ path: `${shots}/setup.png` });
  await page.click('#oSpeed button[data-v="fast"]');
  await page.click('#sGo');
  let shot = 0; const start = Date.now(); let decisions = 0;
  while (Date.now() - start < 600000) {
    const st = await page.evaluate(() => { const { G } = window.HeistUI; const S = G.S; return { over: S.over, looping: G.looping, pd: S.pending && { type: S.pending.type, pid: S.pending.pid, human: S.pending.pid < 100 && !S.players[S.pending.pid].ai }, day: S.day, part: S.part }; });
    if (st.over) break;
    if (!st.looping && st.pd && st.pd.human) {
      if (shots && shot < 40 && decisions % 6 === 0) await page.screenshot({ path: `${shots}/d${String(shot++).padStart(2, '0')}-${st.pd.type}.png` });
      await page.evaluate(() => { const { G, E, AI, human } = window.HeistUI; G.skip = true; human(AI.decide(E, G.S)); });
      decisions++;
    } else { await page.evaluate(() => { window.HeistUI.G.skip = true; }); await page.waitForTimeout(60); }
    if (errors.length) break;
  }
  await page.waitForTimeout(500);
  if (shots) await page.screenshot({ path: `${shots}/end.png` });
  const res = await page.evaluate(() => { const S = window.HeistUI.G.S; return { over: S.over, day: S.day, score: S.score }; });
  console.log('decisions', decisions, 'over', res.over, 'day', res.day, JSON.stringify(res.score && res.score.map(x => x.total)));
  if (errors.length) { console.log('ERRORS:\n' + errors.slice(0, 5).join('\n')); process.exitCode = 1; }
  await browser.close();
})();
