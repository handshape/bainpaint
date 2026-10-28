// Bainpaint — document model.
//
// Doc = { w, h, canvas, ctx, path, name, modified, version }. The canvas
// buffer is at document resolution (1 buffer px per doc px); all pixel work
// happens here. Zoom/pan are pure CSS on the element (see view.js).
(() => {
  const BP = (window.BP = window.BP || {});
  const MAX = BP.MAX_DIM || 4096;

  function createDoc(w, h, { fill = '#ffffff', path = null, name = 'Untitled' } = {}) {
    w = Math.max(1, Math.min(MAX, w | 0));
    h = Math.max(1, Math.min(MAX, h | 0));
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = fill;
    ctx.fillRect(0, 0, w, h);
    return { w, h, canvas, ctx, path, name, modified: false, version: 0 };
  }

  // New canvas of (w,h); old content drawn at (offsetX,offsetY); rest filled.
  // Used by "resize canvas" (crop/expand).
  function setCanvasSize(doc, w, h, { fill = '#ffffff', offsetX = 0, offsetY = 0 } = {}) {
    w = Math.max(1, Math.min(MAX, w | 0));
    h = Math.max(1, Math.min(MAX, h | 0));
    const old = doc.canvas;
    const nc = document.createElement('canvas');
    nc.width = w;
    nc.height = h;
    const nctx = nc.getContext('2d');
    nctx.fillStyle = fill;
    nctx.fillRect(0, 0, w, h);
    nctx.drawImage(old, offsetX, offsetY);
    doc.canvas = nc;
    doc.ctx = nctx;
    doc.w = w;
    doc.h = h;
    doc.version++;
    return doc;
  }

  // Resample the whole image to (w,h) using the pure lib (nearest|bilinear).
  function resizeImage(doc, w, h, { sample = 'nearest' } = {}) {
    w = Math.max(1, Math.min(MAX, w | 0));
    h = Math.max(1, Math.min(MAX, h | 0));
    const src = doc.ctx.getImageData(0, 0, doc.w, doc.h).data;
    const out = sample === 'bilinear'
      ? window.BPLib.resizeBilinear(src, doc.w, doc.h, w, h)
      : window.BPLib.resizeNearest(src, doc.w, doc.h, w, h);
    const nc = document.createElement('canvas');
    nc.width = w;
    nc.height = h;
    const nctx = nc.getContext('2d');
    nctx.putImageData(new ImageData(out, w, h), 0, 0);
    doc.canvas = nc;
    doc.ctx = nctx;
    doc.w = w;
    doc.h = h;
    doc.version++;
    return doc;
  }

  // Mark the doc dirty and notify listeners (status bar, menu, autosave).
  function markModified(doc) {
    if (!doc) return;
    doc.modified = true;
    BP.emit('doc:changed', doc);
  }

  // Canvas-changing ops (new/open/resize/rotate/flip/effects) clear the
  // active selection (plan §3.2).
  function clearSelection() {
    if (BP.selection) BP.selection.clear();
  }

  // Swap in a freshly decoded/created doc as the active document. The doc's
  // canvas buffer is adopted by the visible #doc-canvas element (same element,
  // resized), so view transforms keep applying to it.
  function setDoc(doc) {
    BP.doc = doc;
    if (BP.undo) BP.undo.resetForDoc(doc);
    const el = typeof document !== 'undefined' && document.getElementById('doc-canvas');
    if (el) {
      el.width = doc.w;
      el.height = doc.h;
      if (el !== doc.canvas) {
        el.getContext('2d').drawImage(doc.canvas, 0, 0);
        doc.canvas = el;
        doc.ctx = el.getContext('2d');
      }
    }
    BP.emit('doc:set', doc);
    BP.emit('doc:changed', doc);
  }

  BP.document = { createDoc, setCanvasSize, resizeImage, markModified, clearSelection, setDoc, MAX };
})();
