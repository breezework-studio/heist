# Heist

Digital, offline version of a city-escape heist board game for 1–5 players (humans or computer), in English and Portuguese.
Personal, non-commercial adaptation; original art and code.

**Play:** https://breezework-studio.github.io/heist/

## Features
- Base game for 3–5 players, 2-player mode (Inspector Sandra) and solo (Lt. Costa, with easy variant)
- Upgrade Pack: Gas Can card, 3 extra Fixers, Player Powers (free / random / by colour) and Missions
- Every seat can be human or computer; hot-seat for several humans
- Animated actions with narration, log, speed control and skip
- Offline rules assistant (topics + search) and tooltips on every piece
- PT/EN switch at any time; autosave

## Structure
- `data/` — all game components transcribed from the physical game (tiles, cards, plans…)
- `src/engine.js` — rules engine (state machine)
- `src/ai.js` — computer opponent
- `src/ui.js`, `src/template.html`, `src/icons.js` — interface
- `src/i18n.js`, `src/rules.js` — translations and rules assistant
- `tools/build.py` — builds `index.html` (single offline file)
- `tests/sim.js` — bot-only games (`node tests/sim.js 50 0 base|powers|missions|both`)
- `tests/uitest.js` — full browser playthrough with Playwright (`node tests/uitest.js humans shotsDir|- mode seats`)
- `notes/` — transcription notes, photos and open questions

After changing `src/` or `data/`: `python3 tools/build.py`, then run the tests.
