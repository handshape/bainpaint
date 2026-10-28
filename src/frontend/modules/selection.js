// Bainpaint — selection state + marching ants + mask pipeline.
//
// active = {mode:'rect', x,y,w,h} | {mode:'color', tolerance} | null. Both
// modes materialize to a full-doc alpha mask (ImageData, alpha=255 where
// selected) so cut/copy/paste and rendering share one pipeline. Marching ants
// render on the overlay (animated dash offset for rect; a translucent tint of
// the mask for color mode).
(() => {
  const BP = (window.BP = window.BP || {});

  const selection = {
    active: null,
    _mask: null,       // ImageData doc.w x doc.h
    _tintCanvas: null, // color-mode highlight (doc resolution), built once
    _removeAnts: null,
    _antsRaf: 0,
    _dashOffset: 0,

    get has() { return !!this.active; },

    setRect(x, y, w, h) {
      const doc = BP.doc;
      if (!doc) return;
      x = Math.max(0, Math.floor(x));
      y = Math.max(0, Math.floor(y));
      const x2 = Math.min(doc.w, Math.ceil(x + w));
      const y2 = Math.min(doc.h, Math.ceil(y + h));
      if (x2 <= x || y2 <= y) { this.clear(); return; }
      this._stop();
      this.active = { mode: 'rect', x, y, w: x2 - x, h: y2 - y };
      this._mask = this._materializeRect(x, y, x2 - x, y2 - y);
      this._tintCanvas = null;
      this._start(true);
      BP.emit('selection:changed', this.active);
    },

    // Select all pixels matching (x,y)'s color within tolerance (0..1).
    selectByColor(x, y, tolerance) {
      const doc = BP.doc;
      if (!doc) return;
      x = Math.floor(x); y = Math.floor(y);
      if (x < 0 || y < 0 || x >= doc.w || y >= doc.h) return;
      const img = doc.ctx.getImageData(0, 0, doc.w, doc.h);
      const t = (y * doc.w + x) * 4;
      const tr = img.data[t], tg = img.data[t + 1], tb = img.data[t + 2], ta = img.data[t + 3];
      const tol = (tolerance || 0) * 255;
      const mask = new ImageData(doc.w, doc.h);
      const md = mask.data;
      let minX = doc.w, minY = doc.h, maxX = -1, maxY = -1;
      for (let py = 0; py < doc.h; py++) {
        for (let px = 0; px < doc.w; px++) {
          const i4 = (py * doc.w + px) * 4;
          if (
            Math.abs(img.data[i4] - tr) <= tol &&
            Math.abs(img.data[i4 + 1] - tg) <= tol &&
            Math.abs(img.data[i4 + 2] - tb) <= tol &&
            Math.abs(img.data[i4 + 3] - ta) <= tol
          ) {
            md[i4 + 3] = 255;
            if (px < minX) minX = px;
            if (px > maxX) maxX = px;
            if (py < minY) minY = py;
            if (py > maxY) maxY = py;
          }
        }
      }
      if (maxX < 0) { this.clear(); return; }
      this._stop();
      this.active = { mode: 'color', tolerance, bounds: { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 } };
      this._mask = mask;
      this._buildTint();
      this._start(false);
      BP.emit('selection:changed', this.active);
    },

    clear() {
      if (!this.active && !this._mask) return;
      this.active = null;
      this._mask = null;
      this._tintCanvas = null;
      this._stop();
      BP.emit('selection:changed', null);
    },

    // Bounding box of the selection (for clipboard / region ops).
    bounds() {
      if (!this.active) return null;
      if (this.active.mode === 'rect') {
        const a = this.active;
        return { x: a.x, y: a.y, w: a.w, h: a.h };
      }
      return this.active.bounds;
    },

    // The mask as a full-doc ImageData (alpha channel).
    getMask() { return this._mask; },

    // Point-in-selection test (for the select tool's drag-move logic).
    contains(x, y) {
      if (!this.active || !this._mask) return false;
      x = Math.floor(x); y = Math.floor(y);
      if (x < 0 || y < 0) return false;
      const doc = BP.doc;
      if (x >= doc.w || y >= doc.h) return false;
      return this._mask.data[(y * doc.w + x) * 4 + 3] !== 0;
    },

    // Shift the active selection (and mask) by (dx,dy) — used after moving a
    // selection's content. Re-derives bounds from the (clipped) mask.
    shift(dx, dy) {
      if (!this.active || !this._mask) return;
      const doc = BP.doc;
      const newMask = new ImageData(doc.w, doc.h);
      const md = this._mask.data, nd = newMask.data;
      let minX = doc.w, minY = doc.h, maxX = -1, maxY = -1;
      for (let py = 0; py < doc.h; py++) {
        for (let px = 0; px < doc.w; px++) {
          if (!md[(py * doc.w + px) * 4 + 3]) continue;
          const nx = px + dx, ny = py + dy;
          if (nx < 0 || ny < 0 || nx >= doc.w || ny >= doc.h) continue; // clipped
          nd[(ny * doc.w + nx) * 4 + 3] = 255;
          if (nx < minX) minX = nx;
          if (nx > maxX) maxX = nx;
          if (ny < minY) minY = ny;
          if (ny > maxY) maxY = ny;
        }
      }
      if (maxX < 0) { this.clear(); return; }
      this._mask = newMask;
      const mode = this.active.mode;
      const b = { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 };
      this.active = mode === 'color'
        ? { mode, tolerance: this.active.tolerance, bounds: b, x: b.x, y: b.y, w: b.w, h: b.h }
        : { mode, x: b.x, y: b.y, w: b.w, h: b.h };
      if (mode === 'color') this._buildTint();
      this._start(mode === 'rect');
      BP.emit('selection:changed', this.active);
    },

    // ---- mask materialization -------------------------------------------
    _materializeRect(x, y, w, h) {
      const doc = BP.doc;
      const mask = new ImageData(doc.w, doc.h);
      const md = mask.data;
      for (let py = y; py < y + h; py++) {
        const row = py * doc.w;
        for (let px = x; px < x + w; px++) md[(row + px) * 4 + 3] = 255;
      }
      return mask;
    },
    _buildTint() {
      const doc = BP.doc;
      const tc = document.createElement('canvas');
      tc.width = doc.w; tc.height = doc.h;
      const tint = new ImageData(doc.w, doc.h);
      const md = this._mask.data, td = tint.data;
      for (let i = 0; i < doc.w * doc.h; i++) {
        if (md[i * 4 + 3]) { td[i * 4] = 30; td[i * 4 + 1] = 120; td[i * 4 + 2] = 255; td[i * 4 + 3] = 90; }
      }
      tc.getContext('2d').putImageData(tint, 0, 0);
      this._tintCanvas = tc;
    },

    // ---- marching ants rendering ----------------------------------------
    _start(animate) {
      const self = this;
      this._dashOffset = 0;
      this._removeAnts = BP.view.addDrawFn((oc, view) => self._draw(oc, view));
      if (animate) {
        const loop = () => {
          if (!this.active) return;
          this._dashOffset = (this._dashOffset + 0.6) % 12;
          BP.view.requestOverlay();
          this._antsRaf = requestAnimationFrame(loop);
        };
        this._antsRaf = requestAnimationFrame(loop);
      }
    },
    _stop() {
      if (this._removeAnts) { this._removeAnts(); this._removeAnts = null; }
      if (this._antsRaf) { cancelAnimationFrame(this._antsRaf); this._antsRaf = 0; }
    },
    _draw(oc, view) {
      if (!this.active) return;
      if (this.active.mode === 'rect') {
        view.shapeTransform(oc);
        const { x, y, w, h } = this.active;
        oc.save();
        oc.setLineDash([3, 3]);
        oc.lineWidth = 1;
        // Two-tone (black + white offset) ants are visible on any background.
        oc.strokeStyle = '#000';
        oc.lineDashOffset = this._dashOffset;
        oc.strokeRect(x, y, w, h);
        oc.strokeStyle = '#fff';
        oc.lineDashOffset = this._dashOffset + 3;
        oc.strokeRect(x, y, w, h);
        oc.restore();
      } else if (this._tintCanvas) {
        view.shapeTransform(oc);
        oc.drawImage(this._tintCanvas, 0, 0);
      }
    },
  };

  BP.selection = selection;
})();
