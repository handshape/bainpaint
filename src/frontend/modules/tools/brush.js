// Bainpaint — brush tool (smooth round strokes, width 1–100).
(() => {
  const BP = (window.BP = window.BP || {});
  const C = BP.tools.common;

  const tool = {
    id: 'brush',
    name: 'Brush',
    icon: 'brush',
    hotkey: 'B',
    options: [
      { key: 'width', label: 'Width', type: 'slider', min: 1, max: 100, step: 1, default: 6 },
    ],
    _last: null,

    _radius(ctx) {
      const w = (this._state && this._state.width) || 6;
      return Math.max(0.5, w / 2);
    },

    down(ctx, p) {
      const color = C.colorFor(ctx, p);
      const r = this._radius(ctx);
      ctx.undo.beginStroke(ctx.doc);
      ctx.undo.cover(ctx.doc, p.x, p.y, r + 1);
      C.dot(ctx.doc.ctx, p.x, p.y, r, color);
      this._last = { x: p.x, y: p.y };
    },

    move(ctx, p) {
      const color = C.colorFor(ctx, p);
      const r = this._radius(ctx);
      ctx.undo.cover(ctx.doc, p.x, p.y, r + 1);
      if (this._last) C.segment(ctx.doc.ctx, this._last.x, this._last.y, p.x, p.y, color, r * 2, 'round');
      this._last = { x: p.x, y: p.y };
    },

    up(ctx, p) {
      ctx.undo.commit(ctx.doc, 'brush');
      this._last = null;
    },
  };

  BP.tools.register(tool);
  BP.tools.brush = tool;
})();
