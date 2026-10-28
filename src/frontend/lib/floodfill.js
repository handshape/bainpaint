// Bainpaint — scanline flood fill (pure, no DOM).
//
// Probeable: attaches to globalThis.BPLib; a tjs probe imports this file by
// absolute path (side effect) and reads globalThis.BPLib.floodFill.
//
// Operates on a flat RGBA buffer (Uint8ClampedArray, the natural layout of
// ImageData.data) so it can be tested in the real backend runtime without a
// canvas.
(() => {
  const BPLib = (globalThis.BPLib = Object.assign({}, globalThis.BPLib));

  /**
   * Scanline flood fill.
   *
   * @param {Uint8ClampedArray} pixels flat RGBA buffer, length w*h*4
   * @param {number} width
   * @param {number} height
   * @param {number} x seed x (doc px)
   * @param {number} y seed y (doc px)
   * @param {{r:number,g:number,b:number,a:number}} target color to replace
   * @param {{r:number,g:number,b:number,a:number}} fill color to write
   * @param {number} tolerance 0..1 fraction; per-channel abs threshold = tol*255
   * @returns {{count:number,minX:number,minY:number,maxX:number,maxY:number}|null}
   *   the filled-pixel bounding box (for the undo region) or null if the seed
   *   did not match.
   */
  function floodFill(pixels, width, height, x, y, target, fill, tolerance) {
    if (x < 0 || y < 0 || x >= width || y >= height) return null;
    const P = pixels;
    const tol = (tolerance || 0) * 255;
    const tr = target.r, tg = target.g, tb = target.b, ta = target.a;
    const fr = fill.r, fg = fill.g, fb = fill.b, fa = fill.a;

    // If the fill color matches the target, the "already filled" test must use
    // a visited bit (pixels can no longer be told apart). Only allocate it in
    // that case.
    const sameAsFill =
      Math.abs(tr - fr) <= tol && Math.abs(tg - fg) <= tol &&
      Math.abs(tb - fb) <= tol && Math.abs(ta - fa) <= tol;
    const visited = sameAsFill ? new Uint8Array(width * height) : null;

    function match(i4) {
      if (
        Math.abs(P[i4] - tr) > tol ||
        Math.abs(P[i4 + 1] - tg) > tol ||
        Math.abs(P[i4 + 2] - tb) > tol ||
        Math.abs(P[i4 + 3] - ta) > tol
      ) return false;
      if (visited && visited[i4 >> 2]) return false;
      return true;
    }

    function paint(i4) {
      P[i4] = fr; P[i4 + 1] = fg; P[i4 + 2] = fb; P[i4 + 3] = fa;
      if (visited) visited[i4 >> 2] = 1;
    }

    const stack = []; // pairs [x, y, x, y, ...]
    stack.push(x, y);
    let count = 0, minX = x, minY = y, maxX = x, maxY = y;

    while (stack.length) {
      const py = stack.pop();
      const px = stack.pop();
      if (!match((py * width + px) * 4)) continue;

      // Expand the contiguous matching span on row py.
      let x1 = px;
      while (x1 > 0 && match((py * width + (x1 - 1)) * 4)) x1--;
      let x2 = px;
      while (x2 < width - 1 && match((py * width + (x2 + 1)) * 4)) x2++;

      // Paint the span.
      let s4 = (py * width + x1) * 4;
      for (let xx = x1; xx <= x2; xx++, s4 += 4) paint(s4);

      count += x2 - x1 + 1;
      if (x1 < minX) minX = x1;
      if (x2 > maxX) maxX = x2;
      if (py < minY) minY = py;
      if (py > maxY) maxY = py;

      // Seed the rows above and below: one seed per contiguous matching run
      // within [x1..x2] (keeps the stack small).
      for (let dy = -1; dy <= 1; dy += 2) {
        const ny = py + dy;
        if (ny < 0 || ny >= height) continue;
        let xx = x1;
        let base = (ny * width + x1) * 4;
        while (xx <= x2) {
          if (match(base)) {
            stack.push(xx, ny); // one seed at the run start
            while (xx <= x2 && match(base)) { xx++; base += 4; }
          } else {
            xx++; base += 4;
          }
        }
      }
    }

    return { count, minX, minY, maxX, maxY };
  }

  BPLib.floodFill = floodFill;
})();
