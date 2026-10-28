// Bainpaint — eraser tool.
//
// Paints the SECONDARY (background) color, matching classic Paint — not
// transparency. Right-drag still uses the secondary, so a right-drag erase and
// a left-drag erase coincide when secondary is the background.
(() => {
  const BP = (window.BP = window.BP || {});
  const C = BP.tools.common;

  const tool = {
    id: 'eraser',
    name: 'Eraser',
    icon: 'eraser',
    hotkey: 'E',
    options: [
      { key: 'width', label: 'Width', type: 'slider', min: 1, max: 100, step: 1, default: 12 },
    ],
    _last: null,

    _radius(ctx) {
      const w = (this._state && this._state.width) || 12;
      return Math.max(0.5, w / 2);
    },
    // Eraser always uses the secondary color (the background).
    _color(ctx) { return ctx.colors.secondary; },

    down(ctx, p) {
      const color = this._color(ctx);
      const r = this._radius(ctx);
      ctx.undo.beginStroke(ctx.doc);
      ctx.undo.cover(ctx.doc, p.x, p.y, r + 1);
      C.dot(ctx.doc.ctx, p.x, p.y, r, color);
      this._last = { x: p.x, y: p.y };
    },

    move(ctx, p) {
      const color = this._color(ctx);
      const r = this._radius(ctx);
      ctx.undo.cover(ctx.doc, p.x, p.y, r + 1);
      if (this._last) C.segment(ctx.doc.ctx, this._last.x, this._last.y, p.x, p.y, color, r * 2, 'round');
      this._last = { x: p.x, y: p.y };
    },

    up(ctx, p) {
      ctx.undo.commit(ctx.doc, 'eraser');
      this._last = null;
    },
  };

  BP.tools.register(tool);
  BP.tools.eraser = tool;
})();
