// Magix Dices – UI, skjulte gestusser og panel.
import { Die } from './dice.js';
import { nextThrow, newState, status, parseList, quickFromTaps, sumOf } from './engine.js';
import { loadSettings, saveSettings } from './settings.js';
import { unlockAudio, clack } from './sound.js';

const APP_VERSION = 'v2';
const $ = (s) => document.querySelector(s);
const now = () => performance.now();
const rnd = (a, b) => a + Math.random() * (b - a);

const stage = $('#stage');
const table = $('#table');
const sumEl = $('#sum');
const hintEl = $('#hint');
const peekEl = $('#peek');
const speck = $('#speck');
const secret = $('#secret');

let settings = loadSettings();
let state = newState(settings);
const history = []; // nyeste først: { dice, forced }
let rolling = false;
let quiet = false;
let size = 120;

// ---------- størrelse ----------
function measure() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  size = Math.round(Math.max(78, Math.min(170, w * 0.27, h * 0.17)));
  document.documentElement.style.setProperty('--s', `${size}px`);
  document.documentElement.style.setProperty('--h', `${size / 2}px`);
}
measure();

const mat = document.createElement('div');
mat.className = 'mat';
table.appendChild(mat);
const dice = [new Die(table), new Die(table)];

// To hvilepladser ved siden af hinanden, med lidt tilfældighed (aldrig overlap)
function restSpots() {
  for (let i = 0; i < 40; i++) {
    const a = { x: -size * rnd(0.55, 0.9), y: size * rnd(-0.35, 0.35) };
    const b = { x: size * rnd(0.55, 0.9), y: size * rnd(-0.35, 0.35) };
    if (Math.hypot(a.x - b.x, a.y - b.y) > size * 1.45) return Math.random() < 0.5 ? [a, b] : [b, a];
  }
  return [{ x: -size * 0.75, y: 0 }, { x: size * 0.75, y: 0 }];
}

function placeInitial() {
  const [a, b] = restSpots();
  dice[0].place(1 + Math.floor(Math.random() * 6), a.x, a.y, rnd(-25, 25), size);
  dice[1].place(1 + Math.floor(Math.random() * 6), b.x, b.y, rnd(-25, 25), size);
}
placeInitial();

window.addEventListener('resize', () => {
  const old = size;
  measure();
  if (old === size || rolling) return;
  const k = size / old;
  dice.forEach((d) => d.place(d.value, d.pose.x * k, d.pose.y * k, d.pose.rz, size));
});

// ---------- kast ----------
function vib(p) {
  if (settings.vibrate && navigator.vibrate) { try { navigator.vibrate(p); } catch { /* */ } }
}

async function roll() {
  if (rolling) return;
  rolling = true;
  unlockAudio();
  hintEl.classList.add('off');
  sumEl.classList.remove('on');

  const res = nextThrow(settings, state);
  let spots = restSpots();
  // Sørg for at begge terninger flytter sig synligt
  for (let i = 0; i < 12 && dice.some((d, k) => Math.hypot(d.pose.x - spots[k].x, d.pose.y - spots[k].y) < size * 0.45
    && Math.hypot(d.pose.x - spots[1 - k].x, d.pose.y - spots[1 - k].y) < size * 0.45); i++) spots = restSpots();
  // Venstre terning bliver til venstre (de flyver ikke gennem hinanden)
  if ((dice[0].pose.x < dice[1].pose.x) !== (spots[0].x < spots[1].x)) spots = [spots[1], spots[0]];
  const dur = rnd(780, 920);
  const runs = dice.map((d, i) => d.roll(res.dice[i], spots[i].x, spots[i].y, size, {
    dur: dur + rnd(-50, 50),
    delay: i ? rnd(0, 60) : 0,
    lift: rnd(0.85, 1.1),
  }));

  if (settings.sound) runs.forEach((r) => r.hits.forEach((h) => clack(h.s * rnd(0.75, 1), h.ms)));
  if (settings.vibrate) setTimeout(() => vib([18, 60, 10]), runs[0].hits[0].ms);

  await Promise.all(runs.map((r) => r.done));
  history.unshift({ dice: res.dice, forced: res.forced });
  if (history.length > 14) history.pop();
  if (settings.showSum && !quiet) {
    sumEl.textContent = String(sumOf(res.dice));
    sumEl.classList.add('on');
  }
  rolling = false;
  syncIndicator();
}

// ---------- rolig tilstand ----------
let wakeLock = null;
async function keepAwake(on) {
  try {
    if (on && 'wakeLock' in navigator && !wakeLock) {
      wakeLock = await navigator.wakeLock.request('screen');
      wakeLock.addEventListener('release', () => { wakeLock = null; });
    } else if (!on && wakeLock) { await wakeLock.release(); wakeLock = null; }
  } catch { /* ikke understøttet */ }
}
document.addEventListener('visibilitychange', () => { if (!document.hidden && !quiet) keepAwake(true); });

function enterQuiet() {
  if (quiet) return;
  quiet = true;
  stage.classList.add('is-quiet');
  sumEl.classList.remove('on');
  state.quick = null;
  if (settings.quietOff && settings.active) { settings.active = false; saveSettings(settings); }
  keepAwake(false);
  syncIndicator();
}
function leaveQuiet() {
  quiet = false;
  stage.classList.remove('is-quiet');
  keepAwake(true);
}

// ---------- gestusser på måtten ----------
let safeTop = 20;
function measureSafeTop() {
  const p = document.createElement('div');
  p.style.cssText = 'position:fixed;top:0;height:var(--safe-top);width:1px;visibility:hidden';
  document.body.appendChild(p);
  safeTop = p.getBoundingClientRect().height || 20;
  p.remove();
}
measureSafeTop();

let g = null; // aktuel gestus
let panelTaps = [];
let quickCount = 0;
let quickTimer = 0;

function zoneOf(x, y) {
  const W = window.innerWidth;
  const H = window.innerHeight;
  const top = y < safeTop + 80;
  if (top && x > W - 90) return 'panel';
  if (top && x < 90) return 'panic';
  if (settings.quickTaps && x < 90 && y > H - 110) return 'quick';
  return 'mat';
}

stage.addEventListener('pointerdown', (e) => {
  if (g) return; // kun én finger ad gangen
  unlockAudio();
  const zone = zoneOf(e.clientX, e.clientY);
  g = { id: e.pointerId, x: e.clientX, y: e.clientY, t: now(), zone, timer: 0, peek: false };

  if (zone === 'panel') {
    const t = now();
    panelTaps = panelTaps.filter((v) => t - v < 2500);
    panelTaps.push(t);
    if (panelTaps.length >= 5) { panelTaps = []; openSecret(); }
  } else if (zone === 'panic') {
    g.timer = setTimeout(() => { if (g) g.done = true; panic(); }, 900);
  } else if (zone === 'quick') {
    quickCount++;
    clearTimeout(quickTimer);
    quickTimer = setTimeout(commitQuick, 1100);
  } else {
    g.timer = setTimeout(() => {
      if (!g || !history.length) return;
      g.peek = true;
      const h = history[0];
      peekEl.textContent = `${h.dice[0]} + ${h.dice[1]} = ${sumOf(h.dice)}`;
      peekEl.classList.add('on');
    }, 550);
  }
});

stage.addEventListener('pointermove', (e) => {
  if (!g || e.pointerId !== g.id) return;
  if (Math.hypot(e.clientX - g.x, e.clientY - g.y) > 12) { clearTimeout(g.timer); g.moved = true; }
});

function endGesture(e, cancelled) {
  if (!g || e.pointerId !== g.id) return;
  const cur = g;
  g = null;
  clearTimeout(cur.timer);
  if (cur.peek) { peekEl.classList.remove('on'); return; }
  if (cancelled || cur.zone !== 'mat') return;
  const dx = e.clientX - cur.x;
  const dy = e.clientY - cur.y;
  if (dy > 70 && Math.abs(dy) > Math.abs(dx) * 1.3) { enterQuiet(); return; }
  if (Math.hypot(dx, dy) > 24) return; // andre swipes gør ingenting
  if (quiet) { leaveQuiet(); return; }
  roll();
}
stage.addEventListener('pointerup', (e) => endGesture(e, false));
stage.addEventListener('pointercancel', (e) => endGesture(e, true));
document.addEventListener('contextmenu', (e) => e.preventDefault());
document.addEventListener('keydown', (e) => {
  if (!secret.hidden) return;
  if (e.code === 'Space' || e.code === 'Enter') { e.preventDefault(); if (quiet) leaveQuiet(); else roll(); }
});

function commitQuick() {
  const n = quickCount;
  quickCount = 0;
  state.quick = quickFromTaps(n);
  // Kvittering: kort vibration (Android) og prikken blinker svagt
  vib(state.quick ? [12, 50, 12] : 25);
  speck.classList.add('on');
  setTimeout(syncIndicator, 700);
}

function panic() {
  settings.active = false;
  state.quick = null;
  saveSettings(settings);
  history.unshift({ dice: null, forced: false, panic: true });
  vib(40);
  syncIndicator();
  if (!secret.hidden) syncPanel();
}

function syncIndicator() {
  const st = status(settings, state);
  speck.classList.toggle('on', !!settings.indicator && !quiet && (st.key === 'ready' || st.key === 'quick'));
}

// ---------- panel ----------
let openedAt = 0;
function openSecret() {
  clearTimeout(g && g.timer);
  g = null;
  peekEl.classList.remove('on');
  secret.classList.remove('out');
  secret.hidden = false;
  openedAt = now();
  syncPanel();
}

function closeSecret() {
  if (now() - openedAt < 1000) return; // et ekstra tryk lukker ikke panelet
  saveSettings(settings);
  // Gen-arm: tællere og engangs-force starter forfra, når panelet lukkes
  const quick = state.quick;
  const last = state.last;
  state = newState(settings);
  state.quick = quick;
  state.last = last;
  secret.classList.add('out');
  setTimeout(() => { secret.hidden = true; secret.classList.remove('out'); }, 220);
  if (quiet) leaveQuiet();
  syncIndicator();
}
$('#done').addEventListener('click', closeSecret);

const toggles = ['active', 'avoid', 'showSum', 'sound', 'vibrate', 'indicator', 'quickTaps', 'quietOff'];
for (const k of toggles) {
  $(`#${k}`).addEventListener('change', (e) => {
    settings[k] = e.target.checked;
    if (k === 'active' && settings.active) state = { ...newState(settings), last: state.last };
    if (k === 'showSum' && !settings.showSum) sumEl.classList.remove('on');
    saveSettings(settings);
    syncPanel();
  });
}

document.querySelectorAll('.seg').forEach((seg) => {
  seg.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    settings[seg.dataset.key] = b.dataset.v;
    settings.active = true;
    state = { ...newState(settings), last: state.last, quick: state.quick };
    saveSettings(settings);
    syncPanel();
  });
});

function buildGrid(el, from, to, onPick) {
  for (let v = from; v <= to; v++) {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = String(v);
    b.dataset.v = String(v);
    b.addEventListener('click', () => { onPick(v); settings.active = true; state = { ...newState(settings), last: state.last }; saveSettings(settings); syncPanel(); });
    el.appendChild(b);
  }
}
buildGrid($('#sums'), 2, 12, (v) => { settings.sum = v; });
buildGrid($('#pairA'), 1, 6, (v) => { settings.pair = [v, settings.pair[1]]; });
buildGrid($('#pairB'), 1, 6, (v) => { settings.pair = [settings.pair[0], v]; });

$('#list').addEventListener('input', (e) => {
  settings.list = e.target.value;
  state = { ...newState(settings), last: state.last };
  saveSettings(settings);
  syncPanel(true);
});

function stepHonest(d) {
  settings.honest = Math.max(1, Math.min(9, (Number(settings.honest) || 0) + d));
  state = { ...newState(settings), last: state.last };
  saveSettings(settings);
  syncPanel();
}
$('#honMinus').addEventListener('click', () => stepHonest(-1));
$('#honPlus').addEventListener('click', () => stepHonest(1));

$('#panicBtn').addEventListener('click', () => { panic(); openedAt = 0; closeSecret(); });
$('#quietBtn').addEventListener('click', () => { openedAt = 0; closeSecret(); enterQuiet(); });

const WHEN_NOTE = {
  next: 'Kun næste kast rammer. Derefter ærlige kast, indtil du åbner og lukker panelet igen.',
  after: 'De første kast er ærlige, så rammer det næste. "Prøv lige et par gange først."',
  all: 'Hvert kast rammer målet (ved sum med skiftende kombinationer). Til "kast så tit du vil, og stop når du vil".',
};

function syncPanel(fromInput) {
  const st = status(settings, state);
  const badge = $('#badge');
  badge.textContent = st.text;
  badge.className = `badge ${st.key}`;
  for (const k of toggles) $(`#${k}`).checked = !!settings[k];
  document.querySelectorAll('.seg').forEach((seg) => {
    seg.querySelectorAll('button').forEach((b) => b.classList.toggle('on', b.dataset.v === settings[seg.dataset.key]));
  });
  document.querySelectorAll('.mode-pane').forEach((p) => { p.hidden = p.dataset.pane !== settings.mode; });
  $('#sums').querySelectorAll('button').forEach((b) => b.classList.toggle('on', Number(b.dataset.v) === settings.sum));
  $('#pairA').querySelectorAll('button').forEach((b) => b.classList.toggle('on', Number(b.dataset.v) === settings.pair[0]));
  $('#pairB').querySelectorAll('button').forEach((b) => b.classList.toggle('on', Number(b.dataset.v) === settings.pair[1]));
  if (!fromInput) $('#list').value = settings.list;
  const pl = parseList(settings.list);
  const ln = $('#listNote');
  if (pl.bad.length) { ln.textContent = `Forstår ikke: ${pl.bad.join(' ')} – brug 2-12 eller fx 5+6.`; ln.classList.add('warn'); }
  else { ln.textContent = `${pl.items.length} mål, ét pr. kast. Derefter ærlige kast.`; ln.classList.remove('warn'); }
  $('#honestRow').hidden = settings.when !== 'after';
  $('#honVal').textContent = String(settings.honest);
  $('#whenNote').textContent = settings.mode === 'list' ? 'Rækken bruges ét mål pr. kast, uanset valget her.' : WHEN_NOTE[settings.when];

  const log = $('#log');
  log.innerHTML = '';
  if (!history.length) log.innerHTML = '<span class="muted">Ingen kast endnu</span>';
  for (const h of history) {
    const s = document.createElement('span');
    if (h.panic) { s.textContent = 'PANIK'; s.className = 'muted'; }
    else { s.textContent = `${h.dice[0]}+${h.dice[1]}=${sumOf(h.dice)}`; if (h.forced) s.className = 'f'; }
    log.appendChild(s);
  }
  $('#ver').textContent = APP_VERSION;
  syncIndicator();
}

syncIndicator();
keepAwake(true);

if ('serviceWorker' in navigator && location.protocol === 'https:') {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
