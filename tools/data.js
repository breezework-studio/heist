// Loads data/*.json into one DATA object (used by tests and build)
const fs = require('fs'), path = require('path');
const dir = path.join(__dirname, '..', 'data');
const map = { tiles: 'tiles', contacts: 'contacts', fixers: 'fixers', equipment: 'equipment', assets: 'assets', escapePlans: 'escape-plans', exitCost: 'exit-cost', exits: 'exits', patrol: 'patrol', lockers: 'lockers', locations: 'locations', inspector: 'inspector', lieutenant: 'lieutenant', powers: 'powers', missions: 'missions' };
const DATA = {};
for (const k in map) DATA[k] = JSON.parse(fs.readFileSync(path.join(dir, map[k] + '.json'), 'utf8'));
module.exports = DATA;
