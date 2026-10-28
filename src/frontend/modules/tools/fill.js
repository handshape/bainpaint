// Bainpaint — fill bucket tool.
//
// Flood-fills the connected region under the cursor (exact match, or with a
// tolerance) to the active color. Uses the pure BPLib.floodFill (scanline,
// Uint8 view). Captures a full-frame undo snapshot before mutating.
(() => {
  const BP = (window.BP = window.BP || {});
  const C = BP.tools.common;

  const tool = {
    id: 'fill',
    name: 'Fill',
    icon: 'paint-bucket',
    hotkey: 'F',
    options: [
      { key: 'tolerance', label: 'Tolerance', type: 'slider', min: 0, max: 100, step: 1, default: 0 },
    ],

    down(ctx, p) {
      const doc = ctx.doc;
      const x = Math.floor(p.x), y = Math.floor(p.y);
      if (x < 0 || y < 0 || x >= doc.w || y >= doc.h) return;
      const color = C.colorFor(ctx, p);
      const tol = ((this._state && this._state.tolerance) || 0) / 100;

      const work = doc.ctx.getImageData(0, 0, doc.w, doc.h);
      const i4 = (y * doc.w + x) * 4;
      const target = { r: work.data[i4], g: work.data[i4 + 1], b: work.data[i4 + 2], a: work.data[i4 + 3] };
      const fill = C.hexToRgb(color);

      // Keep the pre-fill frame for undo, then fill the working copy in place.
      const preData = new Uint8ClampedArray(work.data);
      ctx.undo.snapshotData(doc, preData, 'fill');

      window.BPLib.floodFill(work.data, doc.w, doc.h, x, y, target, fill, tol);
      doc.ctx.putImageData(work, 0, 0);
      BP.document.markModified(doc);
    },

    move() { /* fill is click-only */ },
    up() { /* fill is click-only */ },
  };

  BP.tools.register(tool);
  BP.tools.fill = tool;
})();
