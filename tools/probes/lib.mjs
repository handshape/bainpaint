// Bainpaint — pure-logic probe (run with: ~/.tinyjs/bin/tjs run tools/probes/lib.mjs)
//
// Side-effect-imports the page lib files by absolute path (they attach to
// globalThis.BPLib) and unit-tests them in the real backend runtime.

for (const f of ['budget.js', 'palette.js', 'floodfill.js', 'bmp-enc.js', 'resample.js', 'effects.js']) {
  await import(`../../src/frontend/lib/${f}`);
}

const L = globalThis.BPLib;
let passed = 0, failed = 0;
function check(name, cond) {
  if (cond) { passed++; console.log(`  ok  ${name}`); }
  else { failed++; console.log(`FAIL  ${name}`); }
}
function eq(a, b) { return JSON.stringify(a) === JSON.stringify(b); }

console.log('== budget ==');
{
  const b = L.budget;
  check('MAX_BYTES = 128 MiB', b.MAX_BYTES === 128 * 1024 * 1024);
  check('rectBytes 1x1 = 4', b.rectBytes(1, 1) === 4);
  check('rectBytes 4096x4096', b.rectBytes(4096, 4096) === 4096 * 4096 * 4);
  check('no evict small', b.evictCount([1000, 2000, 3000], 4000) === 0);
  const big = 64 * 1024 * 1024; // 64 MiB full-frame entry
  check('floor holds at MIN', b.evictCount([big, big, big], big) === 0);
  check('evict one past floor', b.evictCount([big, big, big, big], big) === 1);
  check('withinBudget true', b.withinBudget([1, 2, 3]) === true);
  check('withinBudget false', b.withinBudget([b.MAX_BYTES + 1]) === false);
}

console.log('== palette ==');
{
  const p = L.palette;
  check('28 colors', p.COLORS.length === 28);
  check('2x14 layout', p.ROWS === 2 && p.COLS === 14);
  check('28 unique', p.unique() === 28);
  check('all #rrggbb', p.COLORS.every((c) => /^#[0-9a-fA-F]{6}$/.test(c)));
}

console.log('== floodFill ==');
{
  const W = 8, H = 8;
  let px = new Uint8ClampedArray(W * H * 4).fill(0xff); // white + alpha
  const white = { r: 255, g: 255, b: 255, a: 255 };
  const black = { r: 0, g: 0, b: 0, a: 255 };
  let r = L.floodFill(px, W, H, 0, 0, white, black, 0);
  check('solid fill count', r.count === 64);
  check('solid fill bbox', eq([r.minX, r.minY, r.maxX, r.maxY], [0, 0, 7, 7]));
  check('all black now (R=0)', px[0] === 0);

  // Two regions: left white, right red. Fill left with black.
  px = new Uint8ClampedArray(W * H * 4);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = (y * W + x) * 4;
    if (x < W / 2) { px[i] = 255; px[i+1] = 255; px[i+2] = 255; }
    else { px[i] = 255; px[i+1] = 0; px[i+2] = 0; }
    px[i+3] = 255;
  }
  r = L.floodFill(px, W, H, 0, 0, white, black, 0);
  check('region fill count (left half)', r.count === 32);
  check('region fill bbox', eq([r.minX, r.minY, r.maxX, r.maxY], [0, 0, 3, 7]));
  const ri = (0 * W + 7) * 4;
  check('right half untouched', px[ri] === 255 && px[ri+1] === 0 && px[ri+2] === 0);

  // Tolerance: near-white target, white fill, small tolerance.
  px = new Uint8ClampedArray(W * H * 4);
  for (let i = 0; i < W * H; i++) { px[i*4] = 250; px[i*4+1] = 250; px[i*4+2] = 250; px[i*4+3] = 255; }
  const off = { r: 250, g: 250, b: 250, a: 255 };
  const near = { r: 255, g: 255, b: 255, a: 255 };
  r = L.floodFill(px, W, H, 0, 0, off, near, 0.05);
  check('tolerance fill', r.count === 64);

  r = L.floodFill(px, W, H, -1, 0, off, near, 0);
  check('oob seed -> null', r === null);

  // fill == target (visited path): must not hang, fills all.
  px = new Uint8ClampedArray(4 * 4 * 4).fill(0xff);
  r = L.floodFill(px, 4, 4, 0, 0, white, white, 0);
  check('fill==target no hang', r !== null && r.count === 16);
}

console.log('== encodeBMP ==');
{
  const rgba = new Uint8ClampedArray([255, 0, 0, 255, 0, 255, 0, 255]); // R, G
  const bmp = L.encodeBMP(rgba, 2, 1);
  check('bmp length (row pad 8)', bmp.length === 54 + 8);
  check('bmp magic', bmp[0] === 0x42 && bmp[1] === 0x4d);
  const dv = new DataView(bmp.buffer);
  check('bmp filesize hdr', dv.getUint32(2, true) === bmp.length);
  check('bmp offset 54', dv.getUint32(10, true) === 54);
  check('bmp hdr size 40', dv.getUint32(14, true) === 40);
  check('bmp width 2', dv.getInt32(18, true) === 2);
  check('bmp height 1', dv.getInt32(22, true) === 1);
  check('bmp bpp 24', dv.getUint16(28, true) === 24);
  check('bmp no compression', dv.getUint32(30, true) === 0);
  check('bmp row red BGR', bmp[54] === 0 && bmp[55] === 0 && bmp[56] === 255);
  check('bmp row green BGR', bmp[57] === 0 && bmp[58] === 255 && bmp[59] === 0);
  check('bmp padding zero', bmp[60] === 0 && bmp[61] === 0);

  // 3x2 to exercise bottom-up ordering.
  const rgba2 = new Uint8ClampedArray(3 * 2 * 4);
  for (let y = 0; y < 2; y++) for (let x = 0; x < 3; x++) {
    const i = (y * 3 + x) * 4;
    rgba2[i] = x * 80; rgba2[i+1] = y * 100; rgba2[i+2] = 10; rgba2[i+3] = 255;
  }
  // width 3 -> each row = 3*3 = 9 bytes, padded to 12 (multiple of 4).
  const bmp2 = L.encodeBMP(rgba2, 3, 2);
  const rowSize = 12;
  check('bmp2 length', bmp2.length === 54 + rowSize * 2);
  const d0 = 54; // bottom row (y=1)
  check('bmp2 bottom row p0', bmp2[d0] === 10 && bmp2[d0+1] === 100 && bmp2[d0+2] === 0);
  check('bmp2 bottom row p2', bmp2[d0+6] === 10 && bmp2[d0+7] === 100 && bmp2[d0+8] === 160);
  check('bmp2 bottom row pad', bmp2[d0+9] === 0 && bmp2[d0+10] === 0 && bmp2[d0+11] === 0);
  const d1 = 54 + rowSize; // top row (y=0)
  check('bmp2 top row p0', bmp2[d1] === 10 && bmp2[d1+1] === 0 && bmp2[d1+2] === 0);
  check('bmp2 top row p2', bmp2[d1+6] === 10 && bmp2[d1+7] === 0 && bmp2[d1+8] === 160);
}

console.log('== resample ==');
{
  const src = new Uint8ClampedArray([255,255,255,255, 255,255,255,255, 255,255,255,255, 255,255,255,255]);
  const n1 = L.resizeNearest(src, 2, 2, 1, 1);
  check('nearest downscale white', eq([...n1], [255,255,255,255]));
  const b1 = L.resizeBilinear(src, 2, 2, 1, 1);
  check('bilinear downscale white', eq([...b1], [255,255,255,255]));

  const red = new Uint8ClampedArray([255, 0, 0, 255]);
  const n2 = L.resizeNearest(red, 1, 1, 2, 2);
  check('nearest upscale red', eq([...n2], [255,0,0,255, 255,0,0,255, 255,0,0,255, 255,0,0,255]));
  const b2 = L.resizeBilinear(red, 1, 1, 2, 2);
  check('bilinear upscale red', eq([...b2], [255,0,0,255, 255,0,0,255, 255,0,0,255, 255,0,0,255]));

  const rg = new Uint8ClampedArray([255,0,0,255, 0,255,0,255]);
  const b3 = L.resizeBilinear(rg, 2, 1, 4, 1);
  check('bilinear blends (len 16)', b3.length === 16);
  check('bilinear mid has R+G', b3[4] > 0 && b3[5] > 0);
}

console.log('== effects ==');
{
  const E = L.effects;
  // brightness: +255 -> all white (rgb), -255 -> all black.
  let d = new Uint8ClampedArray([100, 150, 200, 255]);
  E.brightness(d, 255);
  check('brightness +255 white', d[0] === 255 && d[1] === 255 && d[2] === 255 && d[3] === 255);
  d = new Uint8ClampedArray([100, 150, 200, 255]);
  E.brightness(d, -255);
  check('brightness -255 black', d[0] === 0 && d[1] === 0 && d[2] === 0 && d[3] === 255);
  d = new Uint8ClampedArray([100, 150, 200, 255]);
  E.brightness(d, 50);
  check('brightness +50 adds', d[0] === 150 && d[1] === 200 && d[2] === 250);

  // negative: invert rgb, keep alpha.
  d = new Uint8ClampedArray([10, 20, 30, 128]);
  E.negative(d);
  check('negative inverts', d[0] === 245 && d[1] === 235 && d[2] === 225 && d[3] === 128);

  // blur: a single bright pixel on white spreads (center drops, neighbors rise).
  const W = 5, H = 5;
  d = new Uint8ClampedArray(W * H * 4).fill(0); // start black
  for (let i = 0; i < W * H; i++) d[i * 4 + 3] = 255;
  const ci = (2 * W + 2) * 4; d[ci] = 255; d[ci + 1] = 255; d[ci + 2] = 255; // center white
  E.blur(d, W, H, 1);
  check('blur spreads (center < 255)', d[ci] < 255);
  check('blur neighbor > 0', d[(2 * W + 1) * 4] > 0);

  // sharpen: a flat region stays flat (no change).
  d = new Uint8ClampedArray(4 * 4 * 4).fill(128);
  for (let i = 0; i < 4 * 4; i++) d[i * 4 + 3] = 255;
  E.sharpen(d, 4, 4);
  check('sharpen flat stays flat', d[0] === 128 && d[1] === 128 && d[2] === 128);
  // sharpen: an isolated bright pixel gets brighter.
  d = new Uint8ClampedArray(4 * 4 * 4).fill(100);
  for (let i = 0; i < 4 * 4; i++) d[i * 4 + 3] = 255;
  d[(1 * 4 + 1) * 4] = 200; // brighter pixel
  E.sharpen(d, 4, 4);
  check('sharpen boosts edge', d[(1 * 4 + 1) * 4] > 200);
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) tjs.exit(1);
