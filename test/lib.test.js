// Unit tests for pure BPLib algorithms (no DOM, no tjs).
// Run with: node --test test/lib.test.js

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

const require = createRequire(import.meta.url);
const LIB = (f) => require(new URL(`../src/frontend/lib/${f}`, import.meta.url).pathname);

function freshLib(files) {
  for (const f of files) LIB(f);
  return globalThis.BPLib;
}

// ---- budget ----------------------------------------------------------------

test('budget: rectBytes', () => {
  const B = freshLib(['budget.js']).budget;
  assert.equal(B.rectBytes(1, 1), 4);
  assert.equal(B.rectBytes(10, 10), 400);
  assert.equal(B.rectBytes(4096, 4096), 4096 * 4096 * 4);
});

test('budget: total', () => {
  const B = freshLib(['budget.js']).budget;
  assert.equal(B.total([]), 0);
  assert.equal(B.total([100, 200, 300]), 600);
});

test('budget: withinBudget', () => {
  const B = freshLib(['budget.js']).budget;
  assert.ok(B.withinBudget([100, 200]));
  assert.ok(!B.withinBudget([B.MAX_BYTES + 1]));
  assert.ok(B.withinBudget([B.MAX_BYTES]));
});

test('budget: evictCount — no eviction when small', () => {
  const B = freshLib(['budget.js']).budget;
  assert.equal(B.evictCount([100, 200, 300], 400), 0);
});

test('budget: evictCount — evicts oldest until under MAX', () => {
  const B = freshLib(['budget.js']).budget;
  const big = Math.floor(B.MAX_BYTES / 3);
  // Three big entries + new big one = 4 * (MAX/3) = 1.33*MAX > MAX
  const evict = B.evictCount([big, big, big], big);
  // total = 4*big ≈ 1.33*MAX. count = 4.
  // count(4) > MIN(4)? No. Loop doesn't run. evict = 0.
  assert.equal(evict, 0);

  // Now with 4 existing entries: total = 5*big ≈ 1.67*MAX, count = 5.
  // Iter 1: total > MAX, count(5) > MIN(4): evict 1 → 4*big, count=4.
  // Iter 2: total(4*big) > MAX, but count(4) > MIN(4)? No. Stop. evict = 1.
  const evict2 = B.evictCount([big, big, big, big], big);
  assert.equal(evict2, 1);
});

test('budget: evictCount — never drops below MIN', () => {
  const B = freshLib(['budget.js']).budget;
  // 4 entries of MAX each + new MAX = 5*MAX. Must evict but keep MIN=4.
  const evict = B.evictCount(
    [B.MAX_BYTES, B.MAX_BYTES, B.MAX_BYTES, B.MAX_BYTES],
    B.MAX_BYTES
  );
  // 5 entries, count starts at 5. Evict until count <= MIN(4): evict 1.
  // total after evict 1 = 4*MAX > MAX, but count = 4 = MIN, stop.
  assert.equal(evict, 1);
});

test('budget: evictCount — empty stack', () => {
  const B = freshLib(['budget.js']).budget;
  assert.equal(B.evictCount([], 100), 0);
});

test('budget: evictCount — single huge entry', () => {
  const B = freshLib(['budget.js']).budget;
  // One entry bigger than MAX. Can't evict (count would go to 1 < MIN... wait MIN=4).
  // count = 2 (1 existing + 1 new). Evict 1: count = 1. 1 < MIN(4)? No, the loop
  // condition is count > MIN, so count must be > 4 to evict. count=2, no eviction.
  assert.equal(B.evictCount([B.MAX_BYTES + 1], B.MAX_BYTES + 1), 0);
});

// ---- palette ---------------------------------------------------------------

test('palette: 28 unique colors', () => {
  const P = freshLib(['palette.js']).palette;
  assert.equal(P.COLORS.length, 28);
  assert.equal(P.unique(), 28);
  assert.equal(P.ROWS, 2);
  assert.equal(P.COLS, 14);
});

test('palette: all valid hex', () => {
  const P = freshLib(['palette.js']).palette;
  for (const c of P.COLORS) {
    assert.match(c, /^#[0-9a-f]{6}$/i);
  }
});

// ---- flood fill ------------------------------------------------------------

function makeCanvas(w, h, fill) {
  const px = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    px[i * 4] = fill.r;
    px[i * 4 + 1] = fill.g;
    px[i * 4 + 2] = fill.b;
    px[i * 4 + 3] = fill.a;
  }
  return px;
}

test('floodFill: fills uniform canvas', () => {
  const { floodFill } = freshLib(['floodfill.js']);
  const w = 10, h = 10;
  const px = makeCanvas(w, h, { r: 255, g: 255, b: 255, a: 255 });
  const result = floodFill(px, w, h, 0, 0,
    { r: 255, g: 255, b: 255, a: 255 },
    { r: 0, g: 0, b: 0, a: 255 }, 0);
  assert.ok(result);
  assert.equal(result.count, w * h);
  assert.equal(result.minX, 0);
  assert.equal(result.minY, 0);
  assert.equal(result.maxX, w - 1);
  assert.equal(result.maxY, h - 1);
  // All pixels should be black now.
  for (let i = 0; i < px.length; i += 4) {
    assert.equal(px[i], 0);
  }
});

test('floodFill: does not cross different color', () => {
  const { floodFill } = freshLib(['floodfill.js']);
  const w = 10, h = 10;
  const px = makeCanvas(w, h, { r: 255, g: 255, b: 255, a: 255 });
  // Draw a vertical black line at x=5.
  for (let y = 0; y < h; y++) {
    const i = (y * w + 5) * 4;
    px[i] = 0; px[i + 1] = 0; px[i + 2] = 0;
  }
  const result = floodFill(px, w, h, 0, 0,
    { r: 255, g: 255, b: 255, a: 255 },
    { r: 0, g: 0, b: 0, a: 255 }, 0);
  assert.ok(result);
  // Should fill left side only (x=0..4), 5 cols * 10 rows = 50 pixels.
  assert.equal(result.count, 5 * h);
  assert.equal(result.maxX, 4);
  // Right side should still be white.
  const rightPx = px[(0 * w + 9) * 4];
  assert.equal(rightPx, 255);
});

test('floodFill: tolerance fills gradient', () => {
  const { floodFill } = freshLib(['floodfill.js']);
  const w = 10, h = 1;
  const px = new Uint8ClampedArray(w * h * 4);
  for (let x = 0; x < w; x++) {
    px[x * 4] = x * 25; // 0, 25, 50, ... 225
    px[x * 4 + 1] = 255;
    px[x * 4 + 2] = 255;
    px[x * 4 + 3] = 255;
  }
  // Target = first pixel (r=0). Tolerance 0.5 = 127.5 per channel.
  // Pixels with r in [0, 127] match: x=0..5 (0,25,50,75,100,125).
  const result = floodFill(px, w, h, 0, 0,
    { r: 0, g: 255, b: 255, a: 255 },
    { r: 0, g: 0, b: 0, a: 255 }, 0.5);
  assert.ok(result);
  assert.equal(result.count, 6);
  assert.equal(result.maxX, 5);
});

test('floodFill: out-of-bounds seed returns null', () => {
  const { floodFill } = freshLib(['floodfill.js']);
  const w = 5, h = 5;
  const px = makeCanvas(w, h, { r: 255, g: 255, b: 255, a: 255 });
  assert.equal(floodFill(px, w, h, -1, 0,
    { r: 255, g: 255, b: 255, a: 255 },
    { r: 0, g: 0, b: 0, a: 255 }, 0), null);
  assert.equal(floodFill(px, w, h, w, 0,
    { r: 255, g: 255, b: 255, a: 255 },
    { r: 0, g: 0, b: 0, a: 255 }, 0), null);
  assert.equal(floodFill(px, w, h, 0, h,
    { r: 255, g: 255, b: 255, a: 255 },
    { r: 0, g: 0, b: 0, a: 255 }, 0), null);
});

test('floodFill: fill same as target uses visited bit', () => {
  const { floodFill } = freshLib(['floodfill.js']);
  const w = 5, h = 5;
  const px = makeCanvas(w, h, { r: 128, g: 128, b: 128, a: 255 });
  // Fill with the same color — should still fill everything (visited bit).
  const result = floodFill(px, w, h, 0, 0,
    { r: 128, g: 128, b: 128, a: 255 },
    { r: 128, g: 128, b: 128, a: 255 }, 0);
  assert.ok(result);
  assert.equal(result.count, w * h);
});

// ---- BMP encoder -----------------------------------------------------------

test('bmp: header fields', () => {
  const { encodeBMP } = freshLib(['bmp-enc.js']);
  const w = 2, h = 2;
  const rgba = new Uint8ClampedArray(w * h * 4);
  const bmp = encodeBMP(rgba, w, h);

  const rowSize = (w * 3 + 3) & ~3; // 8
  const imageSize = rowSize * h;    // 16
  const fileSize = 54 + imageSize;  // 70

  assert.equal(bmp[0], 0x42); // 'B'
  assert.equal(bmp[1], 0x4d); // 'M'

  const dv = new DataView(bmp.buffer);
  assert.equal(dv.getUint32(2, true), fileSize);
  assert.equal(dv.getUint32(10, true), 54);
  assert.equal(dv.getUint32(14, true), 40);
  assert.equal(dv.getInt32(18, true), w);
  assert.equal(dv.getInt32(22, true), h);
  assert.equal(dv.getUint16(28, true), 24);
  assert.equal(dv.getUint32(30, true), 0);
  assert.equal(dv.getUint32(34, true), imageSize);
});

test('bmp: BGR row order (bottom-up)', () => {
  const { encodeBMP } = freshLib(['bmp-enc.js']);
  const w = 2, h = 2;
  const rgba = new Uint8ClampedArray(16);
  // (0,0)=red (1,0)=green (0,1)=blue (1,1)=white
  rgba[0] = 255;   // R
  rgba[4 + 1] = 255; // G
  rgba[8 + 2] = 255; // B
  rgba[12] = 255; rgba[13] = 255; rgba[14] = 255; // white RGB

  const bmp = encodeBMP(rgba, w, h);
  const rowSize = (w * 3 + 3) & ~3; // 8

  // BMP row 0 = image bottom row (y=1): blue, white
  // BMP row 1 = image top row (y=0): red, green
  // Bottom row (BMP row 0): B=blue(0,1) BGR=(255,0,0), R=white BGR=(255,255,255)
  assert.equal(bmp[54 + 0], 255); // B of (0,1)
  assert.equal(bmp[54 + 1], 0);   // G of (0,1)
  assert.equal(bmp[54 + 2], 0);   // R of (0,1)
  assert.equal(bmp[54 + 3], 255); // B of (1,1) white
  assert.equal(bmp[54 + 4], 255); // G of (1,1) white
  assert.equal(bmp[54 + 5], 255); // R of (1,1) white

  // Top row (BMP row 1): red, green
  const r1 = 54 + rowSize;
  assert.equal(bmp[r1 + 0], 0);   // B of red
  assert.equal(bmp[r1 + 1], 0);   // G of red
  assert.equal(bmp[r1 + 2], 255); // R of red
  assert.equal(bmp[r1 + 3], 0);   // B of green
  assert.equal(bmp[r1 + 4], 255); // G of green
  assert.equal(bmp[r1 + 5], 0);   // R of green
});

test('bmp: padding bytes are zero', () => {
  const { encodeBMP } = freshLib(['bmp-enc.js']);
  const w = 1, h = 1; // rowSize = (3+3)&~3 = 4, 1 pad byte
  const rgba = new Uint8ClampedArray(4);
  rgba[0] = 255; // red
  const bmp = encodeBMP(rgba, w, h);
  // Row: B=0, G=0, R=255, pad=0
  assert.equal(bmp[54], 0);
  assert.equal(bmp[55], 0);
  assert.equal(bmp[56], 255);
  assert.equal(bmp[57], 0);
});

test('bmp: output length', () => {
  const { encodeBMP } = freshLib(['bmp-enc.js']);
  const w = 3, h = 2;
  const rgba = new Uint8ClampedArray(w * h * 4);
  const bmp = encodeBMP(rgba, w, h);
  const rowSize = (w * 3 + 3) & ~3; // 12 (no padding for w=3)
  assert.equal(bmp.length, 54 + rowSize * h);
});

// ---- resample ---------------------------------------------------------------

test('resample: nearest downscale white', () => {
  const { resizeNearest } = freshLib(['resample.js']);
  const w = 4, h = 4;
  const src = new Uint8ClampedArray(w * h * 4);
  src.fill(255);
  const dst = resizeNearest(src, w, h, 2, 2);
  assert.equal(dst.length, 2 * 2 * 4);
  for (let i = 0; i < dst.length; i++) assert.equal(dst[i], 255);
});

test('resample: nearest upscale red', () => {
  const { resizeNearest } = freshLib(['resample.js']);
  const src = new Uint8ClampedArray(4);
  src[0] = 255; // red
  const dst = resizeNearest(src, 1, 1, 3, 3);
  assert.equal(dst.length, 3 * 3 * 4);
  for (let i = 0; i < dst.length; i += 4) {
    assert.equal(dst[i], 255);
    assert.equal(dst[i + 1], 0);
    assert.equal(dst[i + 2], 0);
  }
});

test('resample: bilinear blends red+green', () => {
  const { resizeBilinear } = freshLib(['resample.js']);
  // 2x1: [red, green]
  const src = new Uint8ClampedArray(8);
  src[0] = 255;   // red R
  src[4 + 1] = 255; // green G
  // Downscale to 1x1: should blend to (127 or 128, 127 or 128, 0)
  const dst = resizeBilinear(src, 2, 1, 1, 1);
  assert.ok(dst[0] >= 127 && dst[0] <= 128);
  assert.ok(dst[1] >= 127 && dst[1] <= 128);
  assert.equal(dst[2], 0);
});

test('resample: bilinear downscale white stays white', () => {
  const { resizeBilinear } = freshLib(['resample.js']);
  const w = 8, h = 8;
  const src = new Uint8ClampedArray(w * h * 4);
  src.fill(255);
  const dst = resizeBilinear(src, w, h, 4, 4);
  for (let i = 0; i < dst.length; i++) assert.equal(dst[i], 255);
});

// ---- effects ----------------------------------------------------------------

test('effects: brightness +255 clamps to white', () => {
  const { effects } = freshLib(['effects.js']);
  const data = new Uint8ClampedArray(4);
  effects.brightness(data, 255);
  assert.equal(data[0], 255);
  assert.equal(data[1], 255);
  assert.equal(data[2], 255);
});

test('effects: brightness -255 clamps to black', () => {
  const { effects } = freshLib(['effects.js']);
  const data = new Uint8ClampedArray(4).fill(255);
  effects.brightness(data, -255);
  assert.equal(data[0], 0);
  assert.equal(data[1], 0);
  assert.equal(data[2], 0);
});

test('effects: brightness adds offset', () => {
  const { effects } = freshLib(['effects.js']);
  const data = new Uint8ClampedArray([100, 100, 100, 255]);
  effects.brightness(data, 50);
  assert.equal(data[0], 150);
  assert.equal(data[1], 150);
  assert.equal(data[2], 150);
});

test('effects: negative inverts', () => {
  const { effects } = freshLib(['effects.js']);
  const data = new Uint8ClampedArray([10, 20, 30, 255]);
  effects.negative(data);
  assert.equal(data[0], 245);
  assert.equal(data[1], 235);
  assert.equal(data[2], 225);
});

test('effects: blur spreads color', () => {
  const { effects } = freshLib(['effects.js']);
  // 3x3 white with center black
  const w = 3, h = 3;
  const data = new Uint8ClampedArray(w * h * 4).fill(255);
  const ci = (1 * w + 1) * 4;
  data[ci] = 0; data[ci + 1] = 0; data[ci + 2] = 0;
  effects.blur(data, w, h, 1);
  // Center should be lighter than 0 (blurred in white neighbors)
  assert.ok(data[ci] > 0);
  // Neighbor should be slightly less than 255 (blurred in black center)
  const ni = (1 * w + 0) * 4;
  assert.ok(data[ni] < 255);
});

test('effects: sharpen flat image stays flat', () => {
  const { effects } = freshLib(['effects.js']);
  const w = 3, h = 3;
  const data = new Uint8ClampedArray(w * h * 4).fill(128);
  effects.sharpen(data, w, h);
  for (let i = 0; i < data.length; i += 4) {
    assert.ok(Math.abs(data[i] - 128) <= 1);
  }
});

test('effects: sharpen boosts edge', () => {
  const { effects } = freshLib(['effects.js']);
  const w = 3, h = 1;
  const data = new Uint8ClampedArray(w * h * 4);
  // [0, 128, 255] R channel
  data[0] = 0; data[4] = 128; data[8] = 255;
  const before = data[4];
  effects.sharpen(data, w, h);
  // Center should be boosted (5*128 - 0 - 255 = 385, clamped to 255)
  assert.ok(data[4] > before || data[4] === 255);
});

test('effects: clamp255', () => {
  const { effects } = freshLib(['effects.js']);
  assert.equal(effects.clamp255(-10), 0);
  assert.equal(effects.clamp255(255), 255);
  assert.equal(effects.clamp255(300), 255);
  assert.equal(effects.clamp255(128), 128);
});
