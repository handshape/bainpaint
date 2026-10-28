// Bainpaint — pencil tool (crisp 1-px Bresenham lines).
(() => {
  const BP = (window.BP = window.BP || {});
  const C = BP.tools.common;

  const tool = {
    id: 'pencil',
    name: 'Pencil',
    icon: 'pencil',
    hotkey: 'P',
    options: [
      { key: 'width', label: 'Width', type: 'slider', min: 1, max: 8, step: 1, default: 1 },
    ],
    _last: null,

    down(ctx, p) {
      const color = C.colorFor(ctx, p);
      const w = this._state ? this._state.width : 1;
      ctx.undo.beginStroke(ctx.doc);
      ctx.undo.cover(ctx.doc, p.x, p.y, 1);
      ctx.doc.ctx.fillStyle = color;
      const r = Math.max(1, Math.round(w / 2));
      ctx.doc.ctx.fillRect(Math.round(p.x) - r + 1, Math.round(p.y) - r + 1, r * 2 - 1, r * 2 - 1);
      this._last = { x: p.x, y: p.y };
    },

    move(ctx, p) {
      const color = C.colorFor(ctx, p);
      ctx.undo.cover(ctx.doc, p.x, p.y, 1);
      if (this._last) C.pixelLine(ctx.doc.ctx, this._last.x, this._last.y, p.x, p.y, color);
      this._last = { x: p.x, y: p.y };
    },

    up(ctx, p) {
      ctx.undo.commit(ctx.doc, 'pencil');
      this._last = null;
    },
  };

  BP.tools.register(tool);
  BP.tools.pencil = tool;
})();
