// Bainpaint — image resampling (pure, no DOM).
//
// Probeable: attaches to globalThis.BPLib; a tjs probe imports this file by
// absolute path (side effect) and reads globalThis.BPLib.resizeNearest /
// globalThis.BPLib.resizeBilinear.
//
// Operates on flat RGBA buffers (Uint8ClampedArray) so it can be unit-tested
// in the real backend runtime without a canvas.
(() => {
  const BPLib = (globalThis.BPLib = Object.assign({}, globalThis.BPLib));

  /**
   * Nearest-neighbor resample.
   * @param {Uint8ClampedArray} src flat RGBA, sw*sh*4
   * @param {number} sw @param {number} sh
   * @param {number} dw @param {number} dh
   * @returns {Uint8ClampedArray} dw*dh*4
   */
  function resizeNearest(src, sw, sh, dw, dh) {
    const dst = new Uint8ClampedArray(dw * dh * 4);
    const rsw = sw / dw, rsh = sh / dh;
    for (let y = 0; y < dh; y++) {
      const sy = Math.min(sh - 1, Math.floor(y * rsh));
      const srow = sy * sw * 4;
      const drow = y * dw * 4;
      for (let x = 0; x < dw; x++) {
        const sx = Math.min(sw - 1, Math.floor(x * rsw));
        const s = srow + sx * 4;
        const d = drow + x * 4;
        dst[d] = src[s];
        dst[d + 1] = src[s + 1];
        dst[d + 2] = src[s + 2];
        dst[d + 3] = src[s + 3];
      }
    }
    return dst;
  }

  /**
   * Bilinear resample (straight alpha, center-pixel sampling).
   * @param {Uint8ClampedArray} src flat RGBA, sw*sh*4
   * @param {number} sw @param {number} sh
   * @param {number} dw @param {number} dh
   * @returns {Uint8ClampedArray} dw*dh*4
   */
  function resizeBilinear(src, sw, sh, dw, dh) {
    const dst = new Uint8ClampedArray(dw * dh * 4);
    const rsw = sw / dw, rsh = sh / dh;
    for (let y = 0; y < dh; y++) {
      const fy = (y + 0.5) * rsh - 0.5;
      const y0 = fy < 0 ? 0 : Math.floor(fy);
      const y1 = Math.min(sh - 1, y0 + 1);
      const wy = fy - y0;
      const y0w = 1 - wy;
      for (let x = 0; x < dw; x++) {
        const fx = (x + 0.5) * rsw - 0.5;
        const x0 = fx < 0 ? 0 : Math.floor(fx);
        const x1 = Math.min(sw - 1, x0 + 1);
        const wx = fx - x0;
        const x0w = 1 - wx;
        const i00 = (y0 * sw + x0) * 4;
        const i10 = (y0 * sw + x1) * 4;
        const i01 = (y1 * sw + x0) * 4;
        const i11 = (y1 * sw + x1) * 4;
        const d = (y * dw + x) * 4;
        for (let c = 0; c < 4; c++) {
          const top = src[i00 + c] * x0w + src[i10 + c] * wx;
          const bot = src[i01 + c] * x0w + src[i11 + c] * wx;
          dst[d + c] = top * y0w + bot * wy;
        }
      }
    }
    return dst;
  }

  BPLib.resizeNearest = resizeNearest;
  BPLib.resizeBilinear = resizeBilinear;
})();
