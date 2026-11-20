// Kastelogik + skjult force. Ingen DOM her, så det kan testes med node --test.
//
// Et kast er altid to terninger [a, b] med værdier 1-6.
// Force kan være en sum (fx 7 → 1+6, 2+5 eller 3+4 tilfældigt), et bestemt par (5+6)
// eller en række (11, 3, 8, 7 – én pr. kast).

export const PAIRS_FOR_SUM = (() => {
  const m = {};
  for (let s = 2; s <= 12; s++) {
    m[s] = [];
    for (let a = 1; a <= 6; a++) {
      const b = s - a;
      if (b >= 1 && b <= 6) m[s].push([a, b]);
    }
  }
  return m;
})();

const die = (rng) => 1 + Math.floor(rng() * 6);
const samePair = (p, q) => !!p && !!q && ((p[0] === q[0] && p[1] === q[1]) || (p[0] === q[1] && p[1] === q[0]));

export function randomPair(rng = Math.random) {
  return [die(rng), die(rng)];
}

// Et tilfældigt par med summen s. Undgår helst præcis samme par som sidst (ser mere naturligt ud).
export function pairForSum(s, rng = Math.random, last = null) {
  const opts = PAIRS_FOR_SUM[s];
  if (!opts || !opts.length) return null;
  let pool = opts.filter((p) => !(last && p[0] === last[0] && p[1] === last[1]));
  if (!pool.length) pool = opts;
  const p = pool[Math.floor(rng() * pool.length)];
  return [p[0], p[1]];
}

// "11, 3, 8, 7" eller "5+6 1-2 3/4" → [{sum:11}, {sum:3}, {pair:[5,6]}, ...]
export function parseList(text) {
  const items = [];
  const bad = [];
  for (const tok of String(text || '').split(/[\s,;]+/).filter(Boolean)) {
    const pm = tok.match(/^([1-6])[+\-/x*·&]([1-6])$/i);
    if (pm) { items.push({ pair: [Number(pm[1]), Number(pm[2])] }); continue; }
    if (/^\d{1,2}$/.test(tok) && Number(tok) >= 2 && Number(tok) <= 12) { items.push({ sum: Number(tok) }); continue; }
    bad.push(tok);
  }
  return { items, bad };
}

export const sumOf = (p) => (p ? p[0] + p[1] : 0);

// Det mål, der gælder for næste force-kast (uden at bruge det)
export function currentTarget(cfg, state) {
  if (state.quick) return state.quick;
  if (cfg.mode === 'pair') {
    const [a, b] = cfg.pair || [];
    if (a >= 1 && a <= 6 && b >= 1 && b <= 6) return { pair: [a, b] };
    return null;
  }
  if (cfg.mode === 'list') {
    const { items } = parseList(cfg.list);
    return items[state.listIndex] || null;
  }
  const s = Number(cfg.sum);
  return s >= 2 && s <= 12 ? { sum: s } : null;
}

export function newState(cfg) {
  return {
    honestLeft: cfg && cfg.when === 'after' ? Math.max(0, Number(cfg.honest) || 0) : 0,
    listIndex: 0,
    spent: false, // engangs-force er brugt
    quick: null, // hurtig-force fra hjørnet (gælder kun næste kast)
    last: null,
    throws: 0,
  };
}

// Kan næste kast blive forced?
export function status(cfg, state) {
  if (state.quick) return { key: 'quick', text: `HURTIG-FORCE: ${label(state.quick)}` };
  if (!cfg.active) return { key: 'off', text: 'FORCE FRA – almindelige terninger' };
  const t = currentTarget(cfg, state);
  if (!t) {
    if (cfg.mode === 'list' && state.listIndex > 0) return { key: 'spent', text: 'RÆKKEN ER BRUGT – ærlige kast' };
    return { key: 'empty', text: 'INTET MÅL' };
  }
  if (state.spent) return { key: 'spent', text: 'FORCE BRUGT – ærlige kast' };
  if (cfg.when === 'after' && state.honestLeft > 0) {
    return { key: 'waiting', text: `VENTER – ${state.honestLeft} ærlig${state.honestLeft === 1 ? 't' : 'e'} kast først` };
  }
  return { key: 'ready', text: `FORCE KLAR: ${label(t)}` };
}

export function label(t) {
  if (!t) return '–';
  if (t.pair) return `${t.pair[0]}+${t.pair[1]} (${sumOf(t.pair)})`;
  return `sum ${t.sum}`;
}

function realise(t, rng, last) {
  if (t.pair) return rng() < 0.5 ? [t.pair[0], t.pair[1]] : [t.pair[1], t.pair[0]];
  return pairForSum(t.sum, rng, last);
}

function honest(cfg, state, rng, avoid) {
  let p = randomPair(rng);
  if (avoid) {
    for (let i = 0; i < 30; i++) {
      const hit = avoid.pair ? samePair(p, avoid.pair) : sumOf(p) === avoid.sum;
      if (!hit) break;
      p = randomPair(rng);
    }
  }
  return p;
}

// Næste kast. Returnerer { dice:[a,b], forced, target } og opdaterer state.
export function nextThrow(cfg, state, rng = Math.random) {
  state.throws++;

  // 1) Hurtig-force fra hjørnet vinder altid, og kun én gang
  if (state.quick) {
    const t = state.quick;
    state.quick = null;
    const dice = realise(t, rng, state.last);
    state.last = dice;
    return { dice, forced: true, target: t };
  }

  const t = cfg.active ? currentTarget(cfg, state) : null;
  const avoid = cfg.avoid && t && !state.spent ? t : null;

  // 2) Ingen force (slået fra, intet mål eller allerede brugt)
  if (!t || state.spent) {
    const dice = honest(cfg, state, rng, null);
    state.last = dice;
    return { dice, forced: false, target: null };
  }

  // 3) Ærlige kast først
  if (cfg.when === 'after' && state.honestLeft > 0) {
    state.honestLeft--;
    const dice = honest(cfg, state, rng, avoid);
    state.last = dice;
    return { dice, forced: false, target: null };
  }

  // 4) Force
  const dice = realise(t, rng, state.last);
  state.last = dice;
  if (cfg.mode === 'list') state.listIndex++;
  else if (cfg.when !== 'all') state.spent = true;
  return { dice, forced: true, target: t };
}

// Antal tryk i hjørnet → hurtig-force. 1 tryk = ryd, 2-12 = den sum.
export function quickFromTaps(n) {
  if (n >= 2 && n <= 12) return { sum: n };
  return null;
}
