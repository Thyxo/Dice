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
  constructor(table) {
    this.el = document.createElement('div');
    this.el.className = 'die';
    // Indre kerne fylder hullerne ved de afrundede hjørner
    for (const c of ['cx', 'cy', 'cz']) {
      const k = document.createElement('b');
      k.className = `core ${c}`;
      this.el.appendChild(k);
    }
    for (const f of FACES) this.el.appendChild(makeFace(f.n, f.t));
    this.shadow = document.createElement('div');
    this.shadow.className = 'die-shadow';
    table.appendChild(this.shadow);
    table.appendChild(this.el);
    this.pose = { x: 0, y: 0, z: 0, rz: 0, rx: 0, ry: 0 };
    this.value = 1;
    this.anims = [];
  }

  static tf(p, half) {
    return `translate3d(${p.x}px,${p.y}px,${half + p.z}px) rotateZ(${p.rz}deg) rotateX(${p.rx}deg) rotateY(${p.ry}deg)`;
  }

  static shadowTf(p, size) {
    const lift = Math.max(0, p.z) / size;
    const s = 1 + lift * 0.5;
    return `translate3d(${p.x + p.z * 0.18}px,${p.y + p.z * 0.25}px,0.5px) scale(${s})`;
  }

  stop() {
    for (const a of this.anims) a.cancel();
    this.anims = [];
  }

  // Læg terningen stille med side n op
  place(n, x, y, rz, size) {
    this.stop();
    const [rx, ry] = ROT[n];
    this.value = n;
    this.pose = { x, y, z: 0, rz, rx, ry };
    this.el.style.transform = Die.tf(this.pose, size / 2);
    this.shadow.style.transform = Die.shadowTf(this.pose, size);
    this.shadow.style.opacity = '1';
  }

  // Kast terningen, så den lander på side n i (x, y).
  // from = startpunkt (uden for skærmen), dur = ms. Returnerer { done, hits:[ms...] }
  roll(n, x, y, size, { from, dur, delay = 0 }) {
    this.stop();
    const half = size / 2;
    const [fx, fy] = ROT[n];
    const sign = () => (Math.random() < 0.5 ? -1 : 1);
    const finalRz = this.pose.rz + rnd(-60, 60);
    const end = { x, y, z: 0, rz: finalRz, rx: fx, ry: fy };
    // Ekstra omgange, der "tumles af" undervejs (hele omgange ændrer ikke slutsiden)
    const ex = 360 * pick([2, 3]) * sign();
    const ey = 360 * pick([1, 2, 3]) * sign();
    const ez = rnd(140, 420) * sign();

    const start = { ...this.pose };
    const launch = { x: from.x, y: from.y, z: size * 2.6, rz: finalRz + ez * 1.15, rx: fx + ex * 1.1, ry: fy + ey * 1.1 };
    // Hop: første nedslag, to mindre hop, glid på plads
    const h1 = size * rnd(0.75, 1.0);
    const h2 = size * rnd(0.22, 0.34);
    const lerp = (a, b, t) => a + (b - a) * t;
    const at = (t, z, spin) => ({
      x: lerp(launch.x, end.x, t),
      y: lerp(launch.y, end.y, t),
      z,
      rz: end.rz + ez * spin,
      rx: end.rx + ex * spin,
      ry: end.ry + ey * spin,
    });
    // Små "rest"-rotationer på hoppene, så terningen vipper over en kant til sidst
    const wob = rnd(14, 26) * sign();
    const frames = [
      { o: 0, p: start, e: 'cubic-bezier(.4,0,.8,.6)' },
      { o: 0.14, p: launch, e: 'cubic-bezier(.45,0,.9,.55)' },
      { o: 0.42, p: at(0.72, 0, 0.30), e: 'cubic-bezier(.1,.55,.4,1)' },
      { o: 0.56, p: at(0.86, h1, 0.12), e: 'cubic-bezier(.6,0,.9,.4)' },
      { o: 0.69, p: at(0.94, 0, 0.04), e: 'cubic-bezier(.1,.6,.4,1)' },
      { o: 0.77, p: { ...at(0.975, h2, 0), rx: end.rx + wob }, e: 'cubic-bezier(.6,0,.9,.4)' },
      { o: 0.85, p: { ...at(0.99, 0, 0), rx: end.rx }, e: 'cubic-bezier(.2,.7,.3,1)' },
      { o: 1, p: end },
    ];
    const opts = { duration: dur, delay, fill: 'forwards' };
    const a1 = this.el.animate(frames.map((f) => ({ offset: f.o, transform: Die.tf(f.p, half), easing: f.e || 'linear' })), opts);
    const a2 = this.shadow.animate(frames.map((f) => ({
      offset: f.o,
      transform: Die.shadowTf(f.p, size),
      opacity: f.o > 0 && f.o < 0.2 ? 0 : Math.max(0.25, 1 - f.p.z / (size * 2)),
      easing: f.e || 'linear',
    })), opts);
    this.anims = [a1, a2];
    this.pose = end;
    this.value = n;
    const done = a1.finished.then(() => {
      // Lås slutstillingen i style, så næste kast starter herfra
      this.el.style.transform = Die.tf(end, half);
      this.shadow.style.transform = Die.shadowTf(end, size);
      this.shadow.style.opacity = '1';
      this.stop();
    }).catch(() => {});
    // Nedslag (til lyd/vibration): styrke 0-1
    const hits = [[0.42, 1], [0.69, 0.55], [0.85, 0.25]].map(([o, s]) => ({ ms: delay + o * dur, s }));
    return { done, hits };
  }
}
