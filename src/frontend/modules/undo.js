// Bainpaint — undo/redo (region-snapshot stack).
//
// Entries are region snapshots: lists of {x, y, img: ImageData} covering
// exactly the pixels an action changed. Freehand strokes capture
// *incrementally* so a long stroke costs only its footprint, not the frame.
//
// Invariant: no pixel is ever drawn outside the covered region of an in-
// progress stroke, so every captured pixel holds true pre-stroke data and
// undo (restore all rects) is exact.
//
// Canvas-changing ops (resize/rotate/flip/new/effects) call snapshotFull,
// which also records the pre-op size so undo can restore dimensions.
(() => {
  const BP = (window.BP = window.BP || {});
  const budget = window.BPLib.budget;

  function union(a, b) {
    if (!a) return { x: b.x, y: b.y, w: b.w, h: b.h };
    if (!b) return a;
    const x = Math.min(a.x, b.x), y = Math.min(a.y, b.y);
    const x2 = Math.max(a.x + a.w, b.x + b.w), y2 = Math.max(a.y + a.h, b.y + b.h);
    return { x, y, w: x2 - x, h: y2 - y };
  }

  // A \ B for rects with B contained in A -> up to 4 rects (top/bottom full
  // width, left/right middle band).
  function diffOuter(A, B) {
    if (!B) return [A];
    if (A.x === B.x && A.y === B.y && A.w === B.w && A.h === B.h) return [];
    const out = [];
    // top
    if (B.y > A.y) out.push({ x: A.x, y: A.y, w: A.w, h: B.y - A.y });
    // bottom
    const bBot = B.y + B.h;
    if (bBot < A.y + A.h) out.push({ x: A.x, y: bBot, w: A.w, h: A.y + A.h - bBot });
    // left (middle band only)
    if (B.x > A.x) out.push({ x: A.x, y: B.y, w: B.x - A.x, h: B.h });
    // right (middle band only)
    const bRight = B.x + B.w;
    if (bRight < A.x + A.w) out.push({ x: bRight, y: B.y, w: A.x + A.w - bRight, h: B.h });
    return out;
  }

  function clampRect(doc, r) {
    const x = Math.max(0, Math.floor(r.x));
    const y = Math.max(0, Math.floor(r.y));
    const x2 = Math.min(doc.w, Math.ceil(r.x + r.w));
    const y2 = Math.min(doc.h, Math.ceil(r.y + r.h));
    if (x2 <= x || y2 <= y) return null;
    return { x, y, w: x2 - x, h: y2 - y };
  }

  function entryBytes(e) {
    let b = 0;
    for (const r of e.rects) b += r.img.width * r.img.height * 4;
    return b;
  }

  const undo = {
    _stack: [],   // oldest -> newest
    _redo: [],
    _progress: null, // in-progress stroke entry
    _sizes: [],   // parallel to _stack: byte size of each entry

    resetForDoc() {
      this._stack = [];
      this._sizes = [];
      this._redo = [];
      this._progress = null;
      this._notify();
    },

    // ---- freehand strokes ------------------------------------------------
    beginStroke(doc) {
      this._progress = { doc, rects: [], covered: null, label: null, restoreSize: null };
    },

    // Expand coverage to include the footprint square at (x,y) radius r;
    // snapshot only the newly-uncovered part of the growing union bbox.
    cover(doc, x, y, r) {
      const e = this._progress;
      if (!e) return;
      const rad = Math.max(1, Math.ceil(r));
      const foot = clampRect(doc, { x: x - rad, y: y - rad, w: rad * 2 + 1, h: rad * 2 + 1 });
      if (!foot) return;
      const newCovered = union(e.covered, foot);
      const parts = diffOuter(newCovered, e.covered);
      for (const p of parts) {
        const c = clampRect(doc, p);
        if (!c) continue;
        const img = doc.ctx.getImageData(c.x, c.y, c.w, c.h);
        e.rects.push({ x: c.x, y: c.y, img });
      }
      e.covered = newCovered;
    },

    commit(doc, label) {
      const e = this._progress;
      this._progress = null;
      if (!e || e.rects.length === 0) return;
      e.label = label || 'stroke';
      this._push(e);
    },

    // ---- one-shot ops ----------------------------------------------------
    // Capture the whole current frame + pre-op size. Call BEFORE mutating.
    snapshotFull(doc, label) {
      const img = doc.ctx.getImageData(0, 0, doc.w, doc.h);
      const e = { doc, rects: [{ x: 0, y: 0, img }], restoreSize: { w: doc.w, h: doc.h }, label: label || 'op' };
      this._push(e);
    },

    // Capture a full frame from an already-read RGBA buffer (avoids a second
    // getImageData). `data` is a Uint8ClampedArray of length w*h*4 at the
    // doc's current size. Call BEFORE mutating the canvas.
    snapshotData(doc, data, label) {
      const img = new ImageData(data, doc.w, doc.h);
      const e = { doc, rects: [{ x: 0, y: 0, img }], restoreSize: { w: doc.w, h: doc.h }, label: label || 'op' };
      this._push(e);
    },

    // Capture a single region. Call BEFORE mutating. For local ops (shapes,
    // moves) where the op's bbox is known.
    snapshotRect(doc, x, y, w, h, label) {
      const c = clampRect(doc, { x, y, w, h });
      if (!c) return;
      const img = doc.ctx.getImageData(c.x, c.y, c.w, c.h);
      const e = { doc, rects: [{ x: c.x, y: c.y, img }], restoreSize: null, label: label || 'op' };
      this._push(e);
    },

    _push(e) {
      const bytes = entryBytes(e);
      // Evict oldest-first while over budget, never below MIN levels.
      const evict = budget.evictCount(this._sizes, bytes);
      if (evict > 0) {
        this._stack.splice(0, evict);
        this._sizes.splice(0, evict);
      }
      this._stack.push(e);
      this._sizes.push(bytes);
      this._redo = [];
      this._notify();
    },

    _applyEntry(doc, e, forward) {
      // Restore size first if the op changed it.
      if (e.restoreSize && (e.restoreSize.w !== doc.w || e.restoreSize.h !== doc.h)) {
        const { w, h } = e.restoreSize;
        const nc = document.createElement('canvas');
        nc.width = w; nc.height = h;
        const nctx = nc.getContext('2d');
        doc.canvas = nc; doc.ctx = nctx; doc.w = w; doc.h = h;
      }
      const rects = forward ? e.rects : e.rects.slice().reverse();
      for (const r of rects) doc.ctx.putImageData(r.img, r.x, r.y);
      doc.version++;
    },

    undo(doc) {
      const e = this._stack.pop();
      if (!e) return false;
      this._sizes.pop();
      this._applyEntry(doc, e, false);
      this._redo.push(e);
      BP.document.markModified(doc);
      this._notify();
      return true;
    },

    redo(doc) {
      const e = this._redo.pop();
      if (!e) return false;
      this._applyEntry(doc, e, true);
      this._stack.push(e);
      this._sizes.push(entryBytes(e));
      BP.document.markModified(doc);
      this._notify();
      return true;
    },

    canUndo() { return this._stack.length > 0; },
    canRedo() { return this._redo.length > 0; },
    levels() { return this._stack.length; },

    _notify() { BP.emit('undo:changed', { canUndo: this.canUndo(), canRedo: this.canRedo() }); },
  };

  BP.undo = undo;
})();
