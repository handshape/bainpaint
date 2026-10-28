// Bainpaint — dev-only: synthesize the SFX clips committed to resources/sfx/.
// Run once with: node tools/makesfx.js
// Produces 16-bit PCM mono WAVs (22050 Hz), a few dozen KB each.
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, '..', 'resources', 'sfx');
const SR = 22050;

function wav(samples) {
  const n = samples.length;
  const buf = Buffer.alloc(44 + n * 2);
  buf.write('RIFF', 0);
  buf.writeUInt32LE(36 + n * 2, 4);
  buf.write('WAVE', 8);
  buf.write('fmt ', 12);
  buf.writeUInt32LE(16, 16);       // fmt chunk size
  buf.writeUInt16LE(1, 20);        // PCM
  buf.writeUInt16LE(1, 22);        // mono
  buf.writeUInt32LE(SR, 24);       // sample rate
  buf.writeUInt32LE(SR * 2, 28);   // byte rate
  buf.writeUInt16LE(2, 32);        // block align
  buf.writeUInt16LE(16, 34);       // bits per sample
  buf.write('data', 36);
  buf.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) {
    let s = Math.max(-1, Math.min(1, samples[i]));
    buf.writeInt16LE(Math.round(s * 32767), 44 + i * 2);
  }
  return buf;
}

function env(t, dur, attack = 0.005, release = 0.02) {
  if (t < attack) return t / attack;
  if (t > dur - release) return Math.max(0, (dur - t) / release);
  return 1;
}
function tone(freq, dur, { vol = 0.6, type = 'sine' } = {}) {
  const n = Math.floor(SR * dur);
  const out = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const phase = 2 * Math.PI * freq * t;
    let s = type === 'square' ? Math.sign(Math.sin(phase)) : Math.sin(phase);
    out[i] = s * vol * env(t, dur);
  }
  return out;
}
function seq(parts) {
  const total = Math.floor(SR * parts.reduce((a, [, d]) => a + d, 0));
  const out = new Float64Array(total);
  let off = 0;
  for (const [sample, dur] of parts) {
    const n = Math.floor(SR * dur);
    for (let i = 0; i < n && off + i < total; i++) out[off + i] += sample[i];
    off += n;
  }
  return out;
}

const clips = {
  click: tone(1800, 0.03, { vol: 0.5 }),
  open: tone(500, 0.09, { vol: 0.5 }),
  save: seq([[tone(660, 0.07, { vol: 0.5 }), 0.07], [tone(990, 0.09, { vol: 0.5 }), 0.09]]),
  success: seq([
    [tone(523, 0.08, { vol: 0.45 }), 0.08],
    [tone(659, 0.08, { vol: 0.45 }), 0.08],
    [tone(784, 0.14, { vol: 0.45 }), 0.14],
  ]),
  error: tone(160, 0.22, { vol: 0.55, type: 'square' }),
};

mkdirSync(OUT, { recursive: true });
for (const [name, samples] of Object.entries(clips)) {
  writeFileSync(join(OUT, `${name}.wav`), wav(samples));
  console.log(`wrote ${name}.wav (${Math.round(samples.length / SR * 1000)} ms)`);
}
console.log(`done -> ${OUT}`);
