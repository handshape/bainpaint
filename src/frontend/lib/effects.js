// Bainpaint — image effect pixel math (pure, no DOM).
//
// Probeable: attaches to globalThis.BPLib; a tjs probe imports this file by
// absolute path (side effect) and reads globalThis.BPLib.effects.
//
// All functions operate in place on a flat RGBA buffer (Uint8ClampedArray).
// Alpha is preserved. The manual convolve/box paths are the baseline (WKWebView
// lacks ctx.filter); a page may use ctx.filter as an optimization where present.
(() => {
  const BPLib = (globalThis.BPLib = Object.assign({}, globalThis.BPLib));

  const clamp255 = (v) => (v < 0 ? 0 : v > 255 ? 255 : v);
  const clampI = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

  // Additive brightness. `offset` in [-255, 255].
  function brightness(data, offset) {
    const o = Math.round(offset);
    for (let i = 0; i < data.length; i += 4) {
      data[i] = clamp255(data[i] + o);
      data[i + 1] = clamp255(data[i + 1] + o);
      data[i + 2] = clamp255(data[i + 2] + o);
    }
  }

  function negative(data) {
    for (let i = 0; i < data.length; i += 4) {
      data[i] = 255 - data[i];
      data[i + 1] = 255 - data[i + 1];
      data[i + 2] = 255 - data[i + 2];
    }
  }

  function _boxBlurH(src, dst, w, h, r) {
    const count = 2 * r + 1;
    for (let y = 0; y < h; y++) {
      const row = y * w * 4;
      let sr = 0, sg = 0, sb = 0;
      for (let x = -r; x <= r; x++) {
        const xx = clampI(x, 0, w - 1), i4 = row + xx * 4;
        sr += src[i4]; sg += src[i4 + 1]; sb += src[i4 + 2];
      }
      for (let x = 0; x < w; x++) {
        const o = row + x * 4;
        dst[o] = Math.round(sr / count);
        dst[o + 1] = Math.round(sg / count);
        dst[o + 2] = Math.round(sb / count);
        dst[o + 3] = src[o + 3];
        const ai = row + clampI(x + r + 1, 0, w - 1) * 4;
        const ri = row + clampI(x - r, 0, w - 1) * 4;
        sr += src[ai] - src[ri];
        sg += src[ai + 1] - src[ri + 1];
        sb += src[ai + 2] - src[ri + 2];
      }
    }
  }
  function _boxBlurV(src, dst, w, h, r) {
    const count = 2 * r + 1;
    for (let x = 0; x < w; x++) {
      let sr = 0, sg = 0, sb = 0;
      for (let y = -r; y <= r; y++) {
        const yy = clampI(y, 0, h - 1), i4 = (yy * w + x) * 4;
        sr += src[i4]; sg += src[i4 + 1]; sb += src[i4 + 2];
      }
      for (let y = 0; y < h; y++) {
        const o = (y * w + x) * 4;
        dst[o] = Math.round(sr / count);
        dst[o + 1] = Math.round(sg / count);
        dst[o + 2] = Math.round(sb / count);
        dst[o + 3] = src[o + 3];
        const ai = (clampI(y + r + 1, 0, h - 1) * w + x) * 4;
        const ri = (clampI(y - r, 0, h - 1) * w + x) * 4;
        sr += src[ai] - src[ri];
        sg += src[ai + 1] - src[ri + 1];
        sb += src[ai + 2] - src[ri + 2];
      }
    }
  }
  // Separable box blur (radius = half-width). In place via one temp buffer.
  function blur(data, w, h, radius) {
    const r = Math.max(1, Math.round(radius));
    const tmp = new Uint8ClampedArray(data.length);
    _boxBlurH(data, tmp, w, h, r);
    _boxBlurV(tmp, data, w, h, r);
  }

  // 3x3 unsharp mask: [0 -1 0; -1 5 -1; 0 -1 0].
  function sharpen(data, w, h) {
    const tmp = new Uint8ClampedArray(data.length);
    const K = [0, -1, 0, -1, 5, -1, 0, -1, 0];
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const o = (y * w + x) * 4;
        for (let c = 0; c < 3; c++) {
          let sum = 0;
          for (let ky = -1; ky <= 1; ky++) {
            const yy = clampI(y + ky, 0, h - 1);
            for (let kx = -1; kx <= 1; kx++) {
              const xx = clampI(x + kx, 0, w - 1);
              sum += data[(yy * w + xx) * 4 + c] * K[(ky + 1) * 3 + (kx + 1)];
            }
          }
          tmp[o + c] = clamp255(sum);
        }
        tmp[o + 3] = data[o + 3];
      }
    }
    data.set(tmp);
  }

  BPLib.effects = { brightness, negative, blur, sharpen, clamp255 };
})();
