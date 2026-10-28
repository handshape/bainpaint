// Bainpaint — select tool.
//
// Drag to make a rectangular selection (marching ants). Classic drag-move:
// with an active selection, dragging INSIDE it moves the selection's content
// (ghost on the overlay, single undo entry; the source is cleared to the
// secondary/background color). Dragging OUTSIDE starts a new rect selection.
// Esc cancels an in-progress drag / deselects.
(() => {
  const BP = (window.BP = window.BP || {});
  const C = BP.tools.common;

  function unionRect(a, b) {
    const x = Math.min(a.x, b.x), y = Math.min(a.y, b.y);
    const x2 = Math.max(a.x + a.w, b.x + b.w), y2 = Math.max(a.y + a.h, b.y + b.h);
    return { x, y, w: x2 - x, h: y2 - y };
  }

  const tool = {
    id: 'select',
    name: 'Select',
    icon: 'square-dashed',
    hotkey: 'V',
    options: [],
    _mode: null,      // 'new' | 'move'
    _start: null, _cur: null, _down: null, _delta: { x: 0, y: 0 },
    _source: null, _content: null, _remove: null,

    down(ctx, p) {
      const sel = ctx.selection;
      if (sel.has && sel.contains(p.x, p.y)) {
        this._beginMove(ctx, p);
      } else {
        this._mode = 'new';
        this._start = { x: p.x, y: p.y };
        this._cur = { x: p.x, y: p.y };
        this._beginNewPreview(ctx);
      }
    },

    move(ctx, p) {
      if (this._mode === 'new') {
        this._cur = { x: p.x, y: p.y };
        ctx.view.requestOverlay();
      } else if (this._mode === 'move') {
        this._delta = { x: p.x - this._down.x, y: p.y - this._down.y };
        ctx.view.requestOverlay();
      }
    },

    up(ctx, p) {
      if (this._mode === 'new') this._finishNew(ctx, p);
      else if (this._mode === 'move') this._finishMove(ctx, p);
    },

    cancel() {
      if (this._mode) {
        this._mode = null;
        this._remove && this._remove();
        this._remove = null;
        this._content = null;
        this._ghost = null;
      } else {
        BP.selection.clear();
      }
    },

    // ---- new rect selection ---------------------------------------------
    _beginNewPreview(ctx) {
      const self = this;
      if (this._remove) this._remove();
      this._remove = ctx.view.addDrawFn((oc, view) => {
        if (self._mode !== 'new' || !self._start) return;
        view.shapeTransform(oc);
        const x = Math.min(self._start.x, self._cur.x);
        const y = Math.min(self._start.y, self._cur.y);
        const w = Math.abs(self._cur.x - self._start.x);
        const h = Math.abs(self._cur.y - self._start.y);
        oc.save();
        oc.setLineDash([3, 3]);
        oc.lineWidth = 1;
        oc.strokeStyle = '#000';
        oc.strokeRect(x, y, w, h);
        oc.strokeStyle = '#fff';
        oc.lineDashOffset = 3;
        oc.strokeRect(x, y, w, h);
        oc.restore();
      });
    },
    _finishNew(ctx, p) {
      this._remove && this._remove();
      this._remove = null;
      this._mode = null;
      const x = Math.min(this._start.x, p.x);
      const y = Math.min(this._start.y, p.y);
      const w = Math.abs(p.x - this._start.x);
      const h = Math.abs(p.y - this._start.y);
      if (w < 1 && h < 1) { BP.selection.clear(); return; } // click = deselect
      ctx.selection.setRect(x, y, w, h);
    },

    // ---- move selection content -----------------------------------------
    _beginMove(ctx, p) {
      const doc = ctx.doc, sel = ctx.selection;
      const b = sel.bounds();
      this._mode = 'move';
      this._down = { x: p.x, y: p.y };
      this._delta = { x: 0, y: 0 };
      this._source = b;
      this._content = doc.ctx.getImageData(b.x, b.y, b.w, b.h);
      // Pre-render the content to a canvas once for the ghost.
      const gc = document.createElement('canvas');
      gc.width = b.w; gc.height = b.h;
      gc.getContext('2d').putImageData(this._content, 0, 0);
      this._ghost = gc;
      const self = this;
      if (this._remove) this._remove();
      this._remove = ctx.view.addDrawFn((oc, view) => {
        if (self._mode !== 'move' || !self._ghost) return;
        view.shapeTransform(oc);
        oc.globalAlpha = 0.7;
        oc.drawImage(self._ghost, self._source.x + self._delta.x, self._source.y + self._delta.y);
        oc.globalAlpha = 1;
      });
    },

    _finishMove(ctx, p) {
      this._remove && this._remove();
      this._remove = null;
      const mode = this._mode;
      this._mode = null;
      const content = this._content;
      this._content = null;
      if (!content) return;
      const dx = this._delta.x, dy = this._delta.y;
      if (dx === 0 && dy === 0) return; // no movement
      const doc = ctx.doc, sel = ctx.selection;
      const src = this._source;
      const dest = { x: src.x + dx, y: src.y + dy, w: src.w, h: src.h };
      const dcl = {
        x: Math.max(0, dest.x), y: Math.max(0, dest.y),
        w: Math.min(doc.w, dest.x + dest.w) - Math.max(0, dest.x),
        h: Math.min(doc.h, dest.y + dest.h) - Math.max(0, dest.y),
      };
      const ub = unionRect(src, { x: dcl.x, y: dcl.y, w: dcl.w, h: dcl.h });
      ctx.undo.snapshotRect(doc, ub.x, ub.y, ub.w, ub.h, 'move-selection');

      const mask = sel.getMask();
      const bg = C.hexToRgb(ctx.colors.secondary);
      const srcImg = doc.ctx.getImageData(src.x, src.y, src.w, src.h);
      // Collect original content for mask pixels, then clear source.
      const moves = [];
      for (let py = 0; py < src.h; py++) {
        for (let px = 0; px < src.w; px++) {
          if (!mask.data[((src.y + py) * doc.w + (src.x + px)) * 4 + 3]) continue;
          const ci = (py * src.w + px) * 4;
          moves.push({ px, py, r: srcImg.data[ci], g: srcImg.data[ci + 1], b: srcImg.data[ci + 2], a: srcImg.data[ci + 3] });
          srcImg.data[ci] = bg.r; srcImg.data[ci + 1] = bg.g; srcImg.data[ci + 2] = bg.b; srcImg.data[ci + 3] = 255;
        }
      }
      doc.ctx.putImageData(srcImg, src.x, src.y);
      // Draw the moved content at the destination (ImageData for speed).
      if (dcl.w > 0 && dcl.h > 0) {
        const destImg = doc.ctx.getImageData(dcl.x, dcl.y, dcl.w, dcl.h);
        for (const m of moves) {
          const dxx = dest.x + m.px, dyy = dest.y + m.py;
          if (dxx < dcl.x || dyy < dcl.y || dxx >= dcl.x + dcl.w || dyy >= dcl.y + dcl.h) continue;
          const dci = ((dyy - dcl.y) * dcl.w + (dxx - dcl.x)) * 4;
          destImg.data[dci] = m.r; destImg.data[dci + 1] = m.g; destImg.data[dci + 2] = m.b; destImg.data[dci + 3] = m.a;
        }
        doc.ctx.putImageData(destImg, dcl.x, dcl.y);
      }
      sel.shift(dx, dy);
      BP.document.markModified(doc);
    },
  };

  BP.tools.register(tool);
  BP.tools.select = tool;
})();
