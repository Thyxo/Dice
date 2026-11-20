// 3D-terning i ren CSS (preserve-3d) + kasteanimation med Web Animations API.
//
// Bordet (måtten) er vippet bagover, så man ser terningerne skråt oppefra.
// "Op" for en terning er +Z i bordets plan. Side n vender op, når terningen har
// rotationen ROT[n]. Modsatte sider giver 7 (1-6, 2-5, 3-4) som på en rigtig terning.

const ROT = { 1: [0, 0], 2: [-90, 0], 3: [0, -90], 4: [0, 90], 5: [90, 0], 6: [0, 180] };
// Hvilken side ligger hvor på kuben (før rotation)
const FACES = [
  { n: 1, t: 'translateZ(var(--h))' },
  { n: 6, t: 'rotateY(180deg) translateZ(var(--h))' },
  { n: 3, t: 'rotateY(90deg) translateZ(var(--h))' },
  { n: 4, t: 'rotateY(-90deg) translateZ(var(--h))' },
  { n: 2, t: 'rotateX(90deg) translateZ(var(--h))' },
  { n: 5, t: 'rotateX(-90deg) translateZ(var(--h))' },
];
// Prikkernes pladser i et 3×3-gitter (1-9, læst som tekst)
const PIPS = { 1: [5], 2: [3, 7], 3: [3, 5, 7], 4: [1, 3, 7, 9], 5: [1, 3, 5, 7, 9], 6: [1, 3, 4, 6, 7, 9] };

const rnd = (a, b) => a + Math.random() * (b - a);
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

function makeFace(n, t) {
  const f = document.createElement('div');
  f.className = `face f${n}`;
  f.style.transform = t;
  for (let i = 1; i <= 9; i++) {
    const c = document.createElement('i');
    if (PIPS[n].includes(i)) c.className = 'pip';
    f.appendChild(c);
  }
  return f;
}

export class Die {
  // Tre lag, så bevægelserne ikke forstyrrer hinanden (det gav hak før):
  //   .die-pos  → glider hen over måtten (x, y)
  //   .die-hop  → hopper op og ned (z) med fysisk easing
  //   .die      → roterer og bremser blødt op
  constructor(table) {
    this.pos = document.createElement('div');
    this.pos.className = 'die-pos';
    this.shadow = document.createElement('div');
    this.shadow.className = 'die-shadow';
    this.hop = document.createElement('div');
    this.hop.className = 'die-hop';
    this.el = document.createElement('div');
    this.el.className = 'die';
    // Indre kerne fylder hullerne ved de afrundede hjørner
    for (const c of ['cx', 'cy', 'cz']) {
      const k = document.createElement('b');
      k.className = `core ${c}`;
      this.el.appendChild(k);
    }
    for (const f of FACES) this.el.appendChild(makeFace(f.n, f.t));
    this.hop.appendChild(this.el);
    this.pos.append(this.shadow, this.hop);
    table.appendChild(this.pos);
    this.pose = { x: 0, y: 0, rz: 0, rx: 0, ry: 0 };
    this.value = 1;
    this.anims = [];
  }

  static posTf(p) { return `translate3d(${p.x}px,${p.y}px,0)`; }
  static hopTf(z, half) { return `translateZ(${half + z}px)`; }
  static rotTf(p) { return `rotateZ(${p.rz}deg) rotateX(${p.rx}deg) rotateY(${p.ry}deg)`; }
  static shadowFx(z, size) {
    const k = Math.max(0, z) / size;
    return { transform: `translate3d(${z * 0.15}px,${z * 0.22}px,1px) scale(${1 + k * 0.45})`, opacity: Math.max(0.3, 1 - k * 0.6) };
  }

  stop() {
    for (const a of this.anims) a.cancel();
    this.anims = [];
  }

  apply(size) {
    const half = size / 2;
    this.pos.style.transform = Die.posTf(this.pose);
    this.hop.style.transform = Die.hopTf(0, half);
    this.el.style.transform = Die.rotTf(this.pose);
    const sh = Die.shadowFx(0, size);
    this.shadow.style.transform = sh.transform;
    this.shadow.style.opacity = String(sh.opacity);
  }

  // Læg terningen stille med side n op
  place(n, x, y, rz, size) {
    this.stop();
    const [rx, ry] = ROT[n];
    this.value = n;
    this.pose = { x, y, rz, rx, ry };
    this.apply(size);
  }

  // Kast terningen fra hvor den ligger, så den lander på side n i (x, y). Returnerer { done, hits }
  roll(n, x, y, size, { dur, delay = 0, lift = 1 }) {
    this.stop();
    const half = size / 2;
    const [fx, fy] = ROT[n];
    const sign = () => (Math.random() < 0.5 ? -1 : 1);
    const start = { ...this.pose };
    const end = { x, y };
    // Ekstra hele omgange: slutvinklen er den rigtige side + n·360°, regnet fra hvor terningen står nu
    const wind = (from, to, k) => to + 360 * (Math.round((from - to) / 360) + k * sign());
    const fin = { rz: start.rz + rnd(90, 240) * sign(), rx: wind(start.rx, fx, pick([1, 2])), ry: wind(start.ry, fy, pick([1, 1, 2])) };
    const opts = { duration: dur, delay, fill: 'forwards' };
    const H = size * rnd(1.1, 1.4) * lift;
    const h1 = size * rnd(0.32, 0.45) * lift;
    const h2 = size * rnd(0.08, 0.14) * lift;
    // Højde: op, ned (nedslag), to mindre hop. ease-out op, ease-in ned = tyngdekraft.
    const UP = 'cubic-bezier(.25,.6,.5,1)';
    const DOWN = 'cubic-bezier(.5,0,.75,.4)';
    const zs = [[0, 0, UP], [0.24, H, DOWN], [0.5, 0, UP], [0.64, h1, DOWN], [0.77, 0, UP], [0.84, h2, DOWN], [0.9, 0, 'linear'], [1, 0]];
    const aHop = this.hop.animate(zs.map(([o, z, e]) => ({ offset: o, transform: Die.hopTf(z, half), easing: e || 'linear' })), opts);
    const aSh = this.shadow.animate(zs.map(([o, z, e]) => ({ offset: o, ...Die.shadowFx(z, size), easing: e || 'linear' })), opts);
    // Glid: hurtigt i starten, bremser blødt op (ingen hak ved hoppene)
    const aPos = this.pos.animate([
      { transform: Die.posTf(start) },
      { transform: Die.posTf(end) },
    ], { ...opts, duration: dur * 0.95, easing: 'cubic-bezier(.2,.65,.3,1)' });
    // Rotation: tumler, bremser blødt op, vipper en anelse forbi og falder på plads
    const tip = rnd(5, 9) * sign();
    const aRot = this.el.animate([
      { offset: 0, transform: Die.rotTf(start), easing: 'cubic-bezier(.3,.55,.4,1)' },
      { offset: 0.8, transform: Die.rotTf({ ...fin, rx: fin.rx + tip }), easing: 'cubic-bezier(.4,0,.4,1)' },
      { offset: 1, transform: Die.rotTf(fin) },
    ], { ...opts, duration: dur * 0.92 });
    this.anims = [aHop, aSh, aPos, aRot];
    const norm = (v) => ((v % 360) + 360) % 360;
    this.pose = { x, y, rz: norm(fin.rz), rx: norm(fin.rx), ry: norm(fin.ry) };
    this.value = n;
    const done = Promise.all(this.anims.map((a) => a.finished)).then(() => {
      this.apply(size); // lås slutstillingen, så næste kast starter herfra
      this.stop();
    }).catch(() => {});
    const hits = [[0.5, 1], [0.77, 0.5], [0.9, 0.22]].map(([o, s]) => ({ ms: delay + o * dur, s }));
    return { done, hits };
  }
}
