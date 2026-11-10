/* Heist — original SVG icon set (24x24 viewBox) */
(function (root) {
'use strict';
const P = {
  star: '<path d="M12 2.5l2.9 6 6.6.8-4.9 4.6 1.3 6.6L12 17.3l-5.9 3.2 1.3-6.6L2.5 9.3l6.6-.8z"/>',
  starPlus: '<path d="M12 2.5l2.9 6 6.6.8-4.9 4.6 1.3 6.6L12 17.3l-5.9 3.2 1.3-6.6L2.5 9.3l6.6-.8z"/><path d="M12 8.5v6M9 11.5h6" stroke="#fff" stroke-width="2"/>',
  starMinus: '<path d="M12 2.5l2.9 6 6.6.8-4.9 4.6 1.3 6.6L12 17.3l-5.9 3.2 1.3-6.6L2.5 9.3l6.6-.8z"/><path d="M9 11.5h6" stroke="#fff" stroke-width="2"/>',
  shield: '<path d="M12 2l8 3v6c0 5-3.4 9-8 11-4.6-2-8-6-8-11V5z"/><path d="M12 7.2l1.5 3 3.3.4-2.4 2.3.6 3.3L12 14.6l-3 1.6.6-3.3-2.4-2.3 3.3-.4z" fill="#fff"/>',
  pawn: '<circle cx="12" cy="6" r="4"/><path d="M5 22c0-6 2.5-10 7-10s7 4 7 10z"/>',
  cop: '<path d="M7 6.5h10l-1-3H8z"/><circle cx="12" cy="9.5" r="3.4"/><path d="M5 22c0-5.5 2.6-8.6 7-8.6s7 3.1 7 8.6z"/><path d="M10.6 16.5h2.8l-1.4 2.6z" fill="#fff"/>',
  money: '<rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="3.2" fill="#fff" opacity=".85"/><path d="M12 10v4M11 10.8h1.7a.9.9 0 010 1.6h-1.4a.9.9 0 000 1.6H13" stroke="currentColor" stroke-width=".9" fill="none"/>',
  bag: '<path d="M8 4l2 2.5h4L16 4l-1.5-1.5h-5z"/><path d="M9.5 7.5C5 10 4 14 4 16.5 4 20 7 21.5 12 21.5s8-1.5 8-5c0-2.5-1-6.5-5.5-9z"/><text x="12" y="17.5" text-anchor="middle" font-size="7" font-weight="700" fill="#fff">$</text>',
  key: '<circle cx="7.5" cy="12" r="4.5" fill="none" stroke="currentColor" stroke-width="2.6"/><path d="M12 12h10v3h-2v-2h-2v2h-2v-2h-4z"/>',
  gas: '<path d="M6 6h9l4 4v11H6z"/><path d="M8 3h5v3H8z"/><path d="M9 11l6 6M15 11l-6 6" stroke="#fff" stroke-width="1.6"/>',
  wrench: '<path d="M21 6.5a5 5 0 01-6.7 4.7L7 18.5a2 2 0 01-2.8-2.8l7.3-7.3A5 5 0 0118 2.6l-3 3 .5 2.4 2.4.5z"/>',
  helmet: '<path d="M3 15a9 9 0 0118 0v2H3z"/><path d="M12 6v9" stroke="#fff" stroke-width="1.4"/><rect x="2" y="17" width="20" height="3" rx="1"/>',
  vest: '<path d="M8 3h3l1 3 1-3h3l4 4-2 3v11H6V10L4 7z"/><path d="M12 7v14" stroke="#fff" stroke-width="1.2"/>',
  hat: '<path d="M4 15c0-5 3.6-9 8-9s8 4 8 9z"/><path d="M2 15h13c3 0 6 1 7 3H2z"/><circle cx="12" cy="10" r="1.6" fill="#fff"/>',
  gasmask: '<path d="M12 3c-5 0-8 3-8 7 0 3 1.5 5.5 4 7l1 3h6l1-3c2.5-1.5 4-4 4-7 0-4-3-7-8-7z"/><circle cx="8.6" cy="10" r="2.2" fill="#fff"/><circle cx="15.4" cy="10" r="2.2" fill="#fff"/><rect x="9.5" y="15" width="5" height="3.5" rx="1" fill="#fff" opacity=".6"/>',
  dice: '<rect x="3" y="3" width="18" height="18" rx="4"/><circle cx="8" cy="8" r="1.8" fill="#fff"/><circle cx="12" cy="12" r="1.8" fill="#fff"/><circle cx="16" cy="16" r="1.8" fill="#fff"/>',
  cocktail: '<path d="M3 4h18l-8 9v6h4v2H7v-2h4v-6z"/>',
  cutlery: '<path d="M6 2v7a2 2 0 002 2v11h2V11a2 2 0 002-2V2h-1.5v6h-1V2h-1v6h-1V2z"/><path d="M15 2c3 0 4 3 4 7h-2v13h-2z"/>',
  dumbbell: '<rect x="1.5" y="8" width="3" height="8" rx="1"/><rect x="4.5" y="6" width="3" height="12" rx="1"/><rect x="16.5" y="6" width="3" height="12" rx="1"/><rect x="19.5" y="8" width="3" height="8" rx="1"/><rect x="7.5" y="11" width="9" height="2"/>',
  vinyl: '<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6.5" fill="none" stroke="#fff" stroke-width=".6" opacity=".5"/><circle cx="12" cy="12" r="3" fill="#fff"/><circle cx="12" cy="12" r="1" />',
  easel: '<path d="M11 2h2v2h7v11H4V4h7z"/><rect x="6" y="6" width="12" height="7" fill="#fff" opacity=".5"/><path d="M7 15l-3 7h2l2.6-7zM17 15l3 7h-2l-2.6-7zM11 15h2v5h-2z"/>',
  house: '<path d="M12 3l10 8h-3v10H5V11H2z"/><rect x="10" y="14" width="4" height="7" fill="#fff" opacity=".8"/>',
  cart: '<path d="M2 3h3l2.5 11h11l2.5-8H7" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round"/><circle cx="9" cy="19" r="2"/><circle cx="17" cy="19" r="2"/>',
  cross: '<path d="M9 3h6v6h6v6h-6v6H9v-6H3V9h6z"/>',
  church: '<path d="M11 1h2v3h2v2h-2v2l6 5v9H5v-9l6-5V6H9V4h2z"/><rect x="10.5" y="15" width="3" height="7" fill="#fff" opacity=".8"/>',
  train: '<rect x="5" y="2" width="14" height="16" rx="4"/><rect x="7.5" y="5" width="9" height="5" rx="1" fill="#fff"/><circle cx="8.5" cy="14" r="1.4" fill="#fff"/><circle cx="15.5" cy="14" r="1.4" fill="#fff"/><path d="M8 18l-3 4h2.5l2-3h5l2 3H19l-3-4z"/>',
  heli: '<path d="M3 4h18v1.6H13V8h1c4 0 6 2 6 5v2h-6l-2 3H6v-1.5h5l1-1.5H7a4 4 0 01-4-4h6V8h2.4V5.6H3z"/><path d="M5 20h12" stroke="currentColor" stroke-width="1.6"/>',
  exit: '<path d="M4 2h11v5h-2V4H6v16h7v-3h2v5H4z"/><path d="M12 11h7l-2.5-2.5L18 7l5 5-5 5-1.5-1.5L19 13h-7z"/>',
  skull: '<path d="M12 2C7 2 4 5.5 4 10c0 3 1.4 5 3 6v4h10v-4c1.6-1 3-3 3-6 0-4.5-3-8-8-8z"/><circle cx="9" cy="10.5" r="2.4" fill="#fff"/><circle cx="15" cy="10.5" r="2.4" fill="#fff"/><path d="M4 7h16" stroke="#fff" stroke-width="1.3"/><path d="M10 17v3M14 17v3" stroke="#fff" stroke-width="1.2"/>',
  lock: '<rect x="4" y="10" width="16" height="12" rx="2"/><path d="M8 10V7a4 4 0 018 0v3" fill="none" stroke="currentColor" stroke-width="2.4"/>',
  unlock: '<rect x="4" y="10" width="16" height="12" rx="2"/><path d="M8 10V7a4 4 0 017.8-1.3" fill="none" stroke="currentColor" stroke-width="2.4"/>',
  sun: '<circle cx="12" cy="12" r="5"/><path d="M12 1v4M12 19v4M1 12h4M19 12h4M4.2 4.2l2.8 2.8M17 17l2.8 2.8M4.2 19.8L7 17M17 7l2.8-2.8" stroke="currentColor" stroke-width="2"/>',
  moon: '<path d="M20 15A9 9 0 019 4a9 9 0 1011 11z"/>',
  bandage: '<rect x="2" y="8" width="20" height="8" rx="4" transform="rotate(-30 12 12)"/><path d="M10.2 9.5h3.6v1.6h1.6v3.6h-1.6v1.6h-3.6v-1.6H8.6v-3.6h1.6z" fill="#fff" transform="rotate(-30 12 12)"/>',
  disc: '<circle cx="12" cy="12" r="9"/><path d="M12 7v10M7 12h10" stroke="#fff" stroke-width="2.4"/>',
  card: '<rect x="5" y="2" width="14" height="20" rx="2"/><rect x="7.5" y="5" width="9" height="7" rx="1" fill="#fff" opacity=".6"/>',
  siren: '<path d="M6 20v-7a6 6 0 0112 0v7z"/><rect x="3" y="20" width="18" height="2.5" rx="1"/><path d="M12 2v3M3.5 6l2 2M20.5 6l-2 2" stroke="currentColor" stroke-width="2"/>',
  car: '<path d="M3 13l2-5h14l2 5v6h-3v-2H6v2H3z"/><circle cx="7" cy="15" r="1.5" fill="#fff"/><circle cx="17" cy="15" r="1.5" fill="#fff"/><path d="M6.5 9.5h11l1 3H5.5z" fill="#fff" opacity=".7"/>',
  biker: '<circle cx="6" cy="17" r="4" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="18" cy="17" r="4" fill="none" stroke="currentColor" stroke-width="2"/><path d="M6 17l4-6h5l3 6M10 11l-1-3h3"  fill="none" stroke="currentColor" stroke-width="2"/><circle cx="13" cy="4.5" r="2.5"/>',
  book: '<path d="M3 4h7a3 3 0 013 3v14a2 2 0 00-2-2H3zM21 4h-7a3 3 0 00-3 3v14a2 2 0 012-2h8z"/>',
  globe: '<circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" stroke-width="2"/><path d="M2 12h20M12 2c3 3 4 6.5 4 10s-1 7-4 10M12 2c-3 3-4 6.5-4 10s1 7 4 10" fill="none" stroke="currentColor" stroke-width="1.6"/>',
  menu: '<path d="M3 5h18v2.5H3zM3 10.75h18v2.5H3zM3 16.5h18V19H3z"/>',
  ff: '<path d="M3 5l9 7-9 7zM12 5l9 7-9 7z"/>',
  play: '<path d="M6 4l14 8-14 8z"/>',
  replay: '<path d="M12 4V1L7 5.5 12 10V7a5 5 0 11-5 5H4a8 8 0 108-8z"/>',
  hand: '<path d="M7 11V5a1.5 1.5 0 013 0v5V3.5a1.5 1.5 0 013 0V10V4.5a1.5 1.5 0 013 0V11V7.5a1.5 1.5 0 013 0V15c0 4-3 7-7 7h-1c-3 0-5-2-6.5-4L3 13.5a1.6 1.6 0 012.5-2z"/>',
  rotate: '<path d="M12 4V1L7 5.5 12 10V7a5 5 0 11-5 5H4a8 8 0 108-8z"/>',
  ferry: '<path d="M3 14h18l-3 5H6z"/><path d="M7 14V9h8l2 5" /><rect x="11" y="5" width="2" height="4"/><path d="M2 21c2 0 2-1 4-1s2 1 4 1 2-1 4-1 2 1 4 1 2-1 4-1" fill="none" stroke="currentColor" stroke-width="1.4"/>',
  info: '<circle cx="12" cy="12" r="10"/><path d="M11 10h2v8h-2zM11 6h2v2h-2z" fill="#fff"/>',
  check: '<path d="M4 12.5l5 5L20 6.5l-2-2-9 9-3-3z"/>',
  x: '<path d="M5 7l2-2 5 5 5-5 2 2-5 5 5 5-2 2-5-5-5 5-2-2 5-5z"/>',
  sewer: '<circle cx="12" cy="12" r="9"/><path d="M5 9h14M4 12h16M5 15h14" stroke="#fff" stroke-width="1.2"/>',
  wave: '<path d="M2 9c2 0 2-2 4-2s2 2 4 2 2-2 4-2 2 2 4 2 2-2 4-2v4c-2 0-2 2-4 2s-2-2-4-2-2 2-4 2-2-2-4-2-2 2-4 2z"/><path d="M2 17c2 0 2-2 4-2s2 2 4 2 2-2 4-2 2 2 4 2 2-2 4-2v3c-2 0-2 2-4 2s-2-2-4-2-2 2-4 2-2-2-4-2-2 2-4 2z" opacity=".6"/>',
  phone: '<path d="M6 2h4l1.5 5-2.5 2a12 12 0 006 6l2-2.5 5 1.5v4a2 2 0 01-2 2C10 20 4 14 4 4a2 2 0 012-2z"/>',
  safe: '<rect x="3" y="3" width="18" height="17" rx="2"/><circle cx="12" cy="11.5" r="4" fill="#fff"/><circle cx="12" cy="11.5" r="1.4"/><path d="M6 20v2M18 20v2" stroke="currentColor" stroke-width="2"/>',
  idcard: '<rect x="2" y="5" width="20" height="14" rx="2"/><circle cx="8" cy="11" r="2.5" fill="#fff"/><path d="M4.5 17c.5-2 2-3 3.5-3s3 1 3.5 3M13 9h6M13 12h6M13 15h4" stroke="#fff" stroke-width="1.4"/>',
  bolt: '<path d="M13 2L4 14h7l-2 8 9-12h-7z"/>',
  skate: '<path d="M3 14h18v2.5a1.5 1.5 0 01-1.5 1.5h-15A1.5 1.5 0 013 16.5z"/><circle cx="7" cy="20" r="2"/><circle cx="17" cy="20" r="2"/>',
  gold: '<path d="M2 20l3-6h7l3 6zM9 13l3-6h7l3 6zM12 20l3-6h7l3 6z" transform="translate(-1.5 0)"/>',
  medic: '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M9 4h6v3H9z"/><path d="M10.5 10h3v2.5H16v3h-2.5V18h-3v-2.5H8v-3h2.5z" fill="#fff"/>',
  eye: '<path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z"/><circle cx="12" cy="12" r="3.5" fill="#fff"/><circle cx="12" cy="12" r="1.6"/>',
  fist: '<path d="M6 9a2 2 0 014 0V8a2 2 0 014 0v1a2 2 0 014 0v1.5a2 2 0 013 1.7V15a7 7 0 01-7 7h-2a6 6 0 01-6-6V9z"/>',
  ninja: '<circle cx="12" cy="11" r="9"/><rect x="3" y="9" width="18" height="4" fill="#fff" opacity=".85"/><circle cx="9" cy="11" r="1.2"/><circle cx="15" cy="11" r="1.2"/>',
  info2: '<circle cx="12" cy="12" r="10"/>',
};
const I = {};
I.svg = (name, cls, color) => `<svg class="ic ${cls || ''}" viewBox="0 0 24 24" ${color ? `style="color:${color}"` : ''} fill="currentColor" aria-hidden="true">${P[name] || P.info2}</svg>`;
I.raw = (name) => P[name] || P.info2;
I.BIZ = { casino: 'dice', bar: 'cocktail', restaurant: 'cutlery', gym: 'dumbbell', nightclub: 'vinyl', gallery: 'easel' };
I.EQUIP = { helmet: 'helmet', vest: 'vest', hat: 'hat', gasmask: 'gasmask' };
I.FIX = { telephone: 'phone', safe: 'safe', disguise: 'hat', idcard: 'idcard', firstaid: 'medic', motorcycle: 'biker', energy: 'bolt', helicopter: 'heli', scuba: 'wave', skater: 'skate', gold: 'gold' };
I.ASSET = { move_county: 'shield', move_federal: 'shield', move_swat: 'shield', avoid_tile: 'eye', master_key: 'key', heal: 'bandage', extra_action: 'disc' };
I.EFF = { sewer: 'sewer', jetski: 'wave', lose_notoriety: 'starMinus', heal: 'medic', move_police: 'shield', refresh: 'replay', chopper: 'heli', gang_ability: 'biker', avoid_types: 'fist', take_contact: 'card', unlock_asset: 'unlock', extra_action: 'disc', remove_police: 'shield', avoid_one_any: 'skate', medevac: 'cross', gain_income: 'money', avoid_all_tile: 'car', plus_mp: 'gas' };
if (typeof module !== 'undefined' && module.exports) module.exports = I; else root.HeistIcons = I;
})(this);
