// Bainpaint — rectangle tool.
(() => {
  const BP = (window.BP = window.BP || {});
  const C = BP.tools.common;

  const tool = C.shapeTool({
    id: 'rect',
    name: 'Rectangle',
    icon: 'square',
    hotkey: 'R',
    options: [
      { key: 'fill', label: 'Fill', type: 'toggle', default: false },
      { key: 'outline', label: 'Outline', type: 'toggle', default: true },
      { key: 'lineWidth', label: 'Width', type: 'slider', min: 1, max: 20, step: 1, default: 1 },
    ],
    makeShape({ start, cur }) {
      if (!start || !cur) return null;
      let w = Math.abs(cur.x - start.x), h = Math.abs(cur.y - start.y);
      if (w === 0 && h === 0) { w = 1; h = 1; }
      return { x: Math.min(start.x, cur.x), y: Math.min(start.y, cur.y), w, h };
    },
    draw(c, s, opts) {
      if (opts.fill) { c.fillStyle = opts.color; c.fillRect(s.x, s.y, s.w, s.h); }
      if (opts.outline) { c.strokeStyle = opts.color; c.lineWidth = opts.lineWidth; c.strokeRect(s.x, s.y, s.w, s.h); }
    },
    bbox(s, opts) {
      const m = opts.lineWidth / 2 + 1;
      return { x: s.x - m, y: s.y - m, w: s.w + m * 2, h: s.h + m * 2 };
    },
  });

  BP.tools.register(tool);
  BP.tools.rect = tool;
})();
