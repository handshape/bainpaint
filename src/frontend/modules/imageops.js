// Bainpaint — image ops: rotate 90° CW/CCW/180°, flip H/V.
//
// Each op captures a full-frame undo snapshot (pre-op frame + size), redraws
// the canvas with the transform, clears the selection (canvas-changing), and
// marks the doc modified.
(() => {
  const BP = (window.BP = window.BP || {});

  function redraw(doc, w, h, transform) {
    const nc = document.createElement('canvas');
    nc.width = w; nc.height = h;
    const c = nc.getContext('2d');
    transform(c);
    c.drawImage(doc.canvas, 0, 0);
    doc.canvas = nc;
    doc.ctx = c;
    doc.w = w;
    doc.h = h;
    doc.version++;
    BP.document.clearSelection();
    BP.document.markModified(doc);
  }

  BP.imageops = {
    rotateCW(doc) {
      BP.undo.snapshotFull(doc, 'rotate 90 CW');
      const { w, h } = doc;
      redraw(doc, h, w, (c) => { c.translate(h, 0); c.rotate(Math.PI / 2); });
    },
    rotateCCW(doc) {
      BP.undo.snapshotFull(doc, 'rotate 90 CCW');
      const { w, h } = doc;
      redraw(doc, h, w, (c) => { c.translate(0, w); c.rotate(-Math.PI / 2); });
    },
    rotate180(doc) {
      BP.undo.snapshotFull(doc, 'rotate 180');
      const { w, h } = doc;
      redraw(doc, w, h, (c) => { c.translate(w, h); c.rotate(Math.PI); });
    },
    flipH(doc) {
      BP.undo.snapshotFull(doc, 'flip horizontal');
      const { w, h } = doc;
      redraw(doc, w, h, (c) => { c.translate(w, 0); c.scale(-1, 1); });
    },
    flipV(doc) {
      BP.undo.snapshotFull(doc, 'flip vertical');
      const { w, h } = doc;
      redraw(doc, w, h, (c) => { c.translate(0, h); c.scale(1, -1); });
    },
  };
})();
