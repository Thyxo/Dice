// Indstillinger fra det hemmelige panel. Gemmes i localStorage på telefonen.

export const SETTINGS_KEY = 'magix-dices-v1';

export const DEFAULTS = {
  active: false, // force slået til
  mode: 'sum', // sum | pair | list
  sum: 7,
  pair: [5, 6],
  list: '11, 3, 8, 7',
  when: 'next', // next = næste kast · after = efter N ærlige · all = alle kast
  honest: 2,
  avoid: true, // ærlige kast før force viser aldrig målet
  showSum: true, // vis summen under terningerne
  sound: true,
  vibrate: true,
  indicator: false, // diskret prik på måtten når force er klar
  quietOff: true, // rolig tilstand slår force fra
  quickTaps: true, // hurtig-force med tryk nederst til venstre
};

const clone = (o) => JSON.parse(JSON.stringify(o));

function merge(base, extra) {
  const out = clone(base);
  if (!extra || typeof extra !== 'object') return out;
  for (const k of Object.keys(base)) {
    if (!(k in extra)) continue;
    const b = base[k];
    const e = extra[k];
    if (Array.isArray(b)) { if (Array.isArray(e) && e.length === b.length) out[k] = e.map(Number); }
    else if (typeof e === typeof b) out[k] = e;
  }
  return out;
}

export function loadSettings(storage = globalThis.localStorage) {
  try {
    const raw = storage && storage.getItem(SETTINGS_KEY);
    return merge(DEFAULTS, raw ? JSON.parse(raw) : null);
  } catch {
    return clone(DEFAULTS);
  }
}

export function saveSettings(s, storage = globalThis.localStorage) {
  try { storage && storage.setItem(SETTINGS_KEY, JSON.stringify(s)); } catch { /* privat tilstand */ }
}

export { merge as mergeSettings };
