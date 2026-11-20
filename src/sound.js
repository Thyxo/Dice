// Syntetisk terningelyd (ingen lydfiler): kort "klak" af filtreret støj + en hård klik-tone.

let ctx = null;
let noise = null;

export function unlockAudio() {
  try {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      ctx = new AC();
      const len = Math.floor(ctx.sampleRate * 0.12);
      noise = ctx.createBuffer(1, len, ctx.sampleRate);
      const d = noise.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
    }
    if (ctx.state === 'suspended') ctx.resume();
  } catch { /* ingen lyd */ }
}

export function clack(strength = 1, delayMs = 0) {
  if (!ctx || !noise) return;
  const t = ctx.currentTime + delayMs / 1000;
  const vol = 0.35 * strength;

  const src = ctx.createBufferSource();
  src.buffer = noise;
  src.playbackRate.value = 0.8 + Math.random() * 0.5;
  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = 1800 + Math.random() * 1600;
  bp.Q.value = 1.4;
  const g = ctx.createGain();
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.09);
  src.connect(bp).connect(g).connect(ctx.destination);
  src.start(t);

  const o = ctx.createOscillator();
  o.type = 'triangle';
  o.frequency.setValueAtTime(900 + Math.random() * 500, t);
  o.frequency.exponentialRampToValueAtTime(300, t + 0.04);
  const og = ctx.createGain();
  og.gain.setValueAtTime(vol * 0.5, t);
  og.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
  o.connect(og).connect(ctx.destination);
  o.start(t);
  o.stop(t + 0.06);
}
