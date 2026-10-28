// Bainpaint — shared tool helpers (loaded before the individual tools).
(() => {
  const BP = (window.BP = window.BP || {});
  const common = {};

  // The active color for a pointer sample (right-drag = secondary).
  common.colorFor = (ctx, p) => (p.secondary ? ctx.colors.secondary : ctx.colors.primary);

  // '#rrggbb' -> {r,g,b,a:255}.
  common.hexToRgb = (hex) => {
    const h = String(hex || '').replace(/^#/, '');
    const n = parseInt(h, 16);
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255, a: 255 };
  };

  // Bresenham 1-px line (crisp pencil). Sets individual pixels.
  common.pixelLine = (c, x0, y0, x1, y1, color) => {
    c.fillStyle = color;
    x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
    const dx = Math.abs(x1 - x0), dy = Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let err = dx - dy;
    for (;;) {
      c.fillRect(x0, y0, 1, 1);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 > -dy) { err -= dy; x0 += sx; }
      if (e2 < dx) { err += dx; y0 += sy; }
    }
  };

  // A smooth canvas line segment (brush / eraser / shape strokes).
  common.segment = (c, x0, y0, x1, y1, color, width, cap) => {
    c.strokeStyle = color;
    c.lineWidth = width;
    c.lineCap = cap || 'round';
    c.lineJoin = 'round';
    c.beginPath();
    c.moveTo(x0, y0);
    c.lineTo(x1, y1);
    c.stroke();
  };

  // Draw a filled circle (spray uses rects; brush dot uses this).
  common.dot = (c, x, y, radius, color) => {
    c.fillStyle = color;
    c.beginPath();
    c.arc(x, y, radius, 0, Math.PI * 2);
    c.fill();
  };

  // Rubber-band shape tool factory. Handles the down/move/up lifecycle, the
  // overlay ghost, and the single commit (snapshot bbox -> draw).
  //
  // config = { id, name, icon, hotkey, options,
  //            makeShape({start, cur, points}) -> shape,
  //            draw(c, shape, opts),
  //            bbox(shape, opts) -> {x,y,w,h},
  //            multiClick? }  // curve/polygon: click-to-add-point tools
  common.shapeTool = (config) => {
    const tool = {
      id: config.id, name: config.name, icon: config.icon, hotkey: config.hotkey,
      options: config.options || [],
      _start: null, _cur: null, _points: null, _active: false,

      _opts(ctx) {
        const s = this._state || {};
        const color = (this._secondary ? ctx.colors.secondary : ctx.colors.primary);
        return {
          fill: !!s.fill,
          outline: s.outline !== false,
          lineWidth: s.lineWidth || 1,
          color,
        };
      },

      down(ctx, p) {
        if (config.multiClick) {
          // curve/polygon: click to add points.
          if (!this._active) {
            this._active = true;
            this._points = [{ x: p.x, y: p.y }];
            this._cur = { x: p.x, y: p.y };
            this._secondary = p.secondary;
            this._previewStart(ctx);
          } else {
            // Double-click or clicking the start point closes the shape.
            if (config.tryClose && config.tryClose(this, ctx, p)) {
              this.close(ctx);
              return;
            }
            this._points.push({ x: p.x, y: p.y });
            this._cur = { x: p.x, y: p.y };
            ctx.view.requestOverlay();
          }
          return;
        }
        this._active = true;
        this._secondary = p.secondary;
        this._start = { x: p.x, y: p.y };
        this._cur = { x: p.x, y: p.y };
        this._previewStart(ctx);
      },

      _previewStart(ctx) {
        const self = this;
        if (this._removeOverlay) this._removeOverlay();
        this._removeOverlay = ctx.view.addDrawFn((oc, view) => {
          if (!self._active) return;
          view.shapeTransform(oc);
          const shape = self._makeShape();
          if (shape) config.draw(oc, shape, self._opts(ctx));
        });
      },
      _stopOverlay() {
        if (this._removeOverlay) { this._removeOverlay(); this._removeOverlay = null; }
      },

      move(ctx, p) {
        if (!this._active) return;
        this._cur = { x: p.x, y: p.y };
        ctx.view.requestOverlay();
      },

      up(ctx, p) {
        if (!this._active) return;
        if (config.multiClick) {
          // A click in multiClick mode adds a point (handled in down). up just
          // reports position; commit happens on close (see close()).
          return;
        }
        this._cur = { x: p.x, y: p.y };
        this._finish(ctx);
      },

      // curve/polygon: finalize (called on close / double-click / Esc-commit).
      close(ctx) {
        if (!this._active) return;
        this._finish(ctx);
      },

      cancel() {
        if (!this._active) return;
        this._active = false;
        this._points = null;
        this._stopOverlay();
      },

      _makeShape() {
        return config.makeShape({
          start: this._start, cur: this._cur, points: this._points, active: this._active,
        });
      },

      _finish(ctx) {
        this._active = false; // makeShape() then excludes the live cursor
        const shape = this._makeShape();
        this._points = null;
        this._stopOverlay();
        if (!shape) return;
        const opts = this._opts(ctx);
        const b = config.bbox(shape, opts);
        ctx.undo.snapshotRect(ctx.doc, b.x, b.y, b.w, b.h, this.id);
        config.draw(ctx.doc.ctx, shape, opts);
        BP.document.markModified(ctx.doc);
      },
    };
    return tool;
  };

  // Draw a filled/stroked polygon path (used by polygon & curve tools).
  common.tracePath = (c, points, closed) => {
    if (!points || points.length < 2) return;
    c.beginPath();
    c.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) c.lineTo(points[i].x, points[i].y);
    if (closed) c.closePath();
  };
  common.fillStroke = (c, shape, opts) => {
    if (opts.fill) { c.fillStyle = opts.color; c.fill(); }
    if (opts.outline) { c.strokeStyle = opts.color; c.lineWidth = opts.lineWidth; c.lineJoin = 'round'; c.lineCap = 'round'; c.stroke(); }
  };

  BP.tools.common = common;
})();
