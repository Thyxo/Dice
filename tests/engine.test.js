import test from 'node:test';
import assert from 'node:assert/strict';
import { nextThrow, newState, status, parseList, pairForSum, PAIRS_FOR_SUM, quickFromTaps, sumOf } from '../src/engine.js';
import { DEFAULTS, loadSettings, saveSettings } from '../src/settings.js';

const cfg = (o = {}) => ({ ...JSON.parse(JSON.stringify(DEFAULTS)), active: true, ...o });
const valid = (p) => p.length === 2 && p.every((v) => Number.isInteger(v) && v >= 1 && v <= 6);

test('alle summer 2-12 har par', () => {
  for (let s = 2; s <= 12; s++) {
    assert.ok(PAIRS_FOR_SUM[s].length > 0);
    for (const p of PAIRS_FOR_SUM[s]) assert.equal(sumOf(p), s);
  }
  assert.equal(pairForSum(13), null);
});

test('force fra → altid gyldige tilfældige kast, aldrig forced', () => {
  const c = cfg({ active: false });
  const st = newState(c);
  const seen = new Set();
  for (let i = 0; i < 5000; i++) {
    const r = nextThrow(c, st);
    assert.ok(valid(r.dice));
    assert.equal(r.forced, false);
    seen.add(r.dice.join());
  }
  assert.equal(seen.size, 36);
});

test('næste kast: rammer én gang, derefter ærligt', () => {
  for (let s = 2; s <= 12; s++) {
    const c = cfg({ mode: 'sum', sum: s, when: 'next' });
    const st = newState(c);
    const r = nextThrow(c, st);
    assert.equal(sumOf(r.dice), s);
    assert.equal(r.forced, true);
    assert.equal(status(c, st).key, 'spent');
    for (let i = 0; i < 50; i++) assert.equal(nextThrow(c, st).forced, false);
  }
});

test('efter ærlige: N ærlige kast uden målet, så rammer det', () => {
  for (let n = 1; n <= 5; n++) {
    for (let k = 0; k < 300; k++) {
      const c = cfg({ mode: 'sum', sum: 7, when: 'after', honest: n, avoid: true });
      const st = newState(c);
      for (let i = 0; i < n; i++) {
        assert.equal(status(c, st).key, 'waiting');
        const r = nextThrow(c, st);
        assert.equal(r.forced, false);
        assert.notEqual(sumOf(r.dice), 7);
      }
      assert.equal(status(c, st).key, 'ready');
      assert.equal(sumOf(nextThrow(c, st).dice), 7);
    }
  }
});

test('alle kast: summen altid ens, kombinationerne skifter', () => {
  const c = cfg({ mode: 'sum', sum: 7, when: 'all' });
  const st = newState(c);
  const combos = new Set();
  let prev = null;
  for (let i = 0; i < 500; i++) {
    const r = nextThrow(c, st);
    assert.equal(sumOf(r.dice), 7);
    assert.ok(r.forced);
    if (prev) assert.notDeepEqual(r.dice, prev); // aldrig præcis samme kast to gange i træk
    prev = r.dice;
    combos.add(r.dice.join());
  }
  assert.equal(combos.size, 6);
});

test('par: rigtigt par, begge rækkefølger', () => {
  const c = cfg({ mode: 'pair', pair: [5, 6], when: 'all' });
  const st = newState(c);
  const seen = new Set();
  for (let i = 0; i < 200; i++) {
    const r = nextThrow(c, st);
    assert.deepEqual([...r.dice].sort(), [5, 6]);
    seen.add(r.dice.join());
  }
  assert.equal(seen.size, 2);
});

test('række: ét mål pr. kast, derefter ærligt', () => {
  const c = cfg({ mode: 'list', list: '11, 3 5+6 8;7' });
  const st = newState(c);
  const want = [11, 3, 11, 8, 7];
  for (const w of want) {
    const r = nextThrow(c, st);
    assert.equal(sumOf(r.dice), w);
    assert.ok(r.forced);
  }
  assert.equal(nextThrow(c, st).forced, false);
  assert.equal(status(c, st).key, 'spent');
});

test('parseList finder fejl', () => {
  const r = parseList('11, 1, 13, 7+1, 4/4, x');
  assert.deepEqual(r.items, [{ sum: 11 }, { pair: [4, 4] }]);
  assert.deepEqual(r.bad, ['1', '13', '7+1', 'x']);
});

test('hurtig-force vinder én gang, også når force er fra', () => {
  const c = cfg({ active: false });
  const st = newState(c);
  st.quick = quickFromTaps(11);
  assert.equal(status(c, st).key, 'quick');
  const r = nextThrow(c, st);
  assert.equal(sumOf(r.dice), 11);
  assert.ok(r.forced);
  assert.equal(st.quick, null);
  assert.equal(nextThrow(c, st).forced, false);
  assert.equal(quickFromTaps(1), null);
  assert.equal(quickFromTaps(13), null);
});

test('indstillinger: ukendte/forkerte værdier ignoreres', () => {
  const mem = { d: {}, getItem(k) { return this.d[k] ?? null; }, setItem(k, v) { this.d[k] = v; } };
  mem.setItem('magix-dices-v1', JSON.stringify({ sum: 9, pair: [1], active: 'ja', evil: 1 }));
  const s = loadSettings(mem);
  assert.equal(s.sum, 9);
  assert.deepEqual(s.pair, DEFAULTS.pair);
  assert.equal(s.active, DEFAULTS.active);
  assert.ok(!('evil' in s));
  saveSettings({ ...s, sum: 4 }, mem);
  assert.equal(loadSettings(mem).sum, 4);
});
