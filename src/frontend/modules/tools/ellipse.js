// Bainpaint — ellipse tool.
(() => {
  const BP = (window.BP = window.BP || {});
  const C = BP.tools.common;

  const tool = C.shapeTool({
    id: 'ellipse',
    name: 'Ellipse',
    icon: 'circle',
    hotkey: 'O',
    options: [
      { key: 'fill', label: 'Fill', type: 'toggle', default: false },
      { key: 'outline', label: 'Outline', type: 'toggle', default: true },
      { key: 'lineWidth', label: 'Width', type: 'slider', min: 1, max: 20, step: 1, default: 1 },
    ],
    makeShape({ start, cur }) {
      if (!start || !cur) return null;
      let w = Math.abs(cur.x - start.x), h = Math.abs(cur.y - start.y);
      if (w === 0 && h === 0) { w = 2; h = 2; }
      return {
        x: Math.min(start.x, cur.x), y: Math.min(start.y, cur.y), w, h,
        cx: (start.x + cur.x) / 2, cy: (start.y + cur.y) / 2,
        rx: w / 2, ry: h / 2,
      };
    },
    draw(c, s, opts) {
      c.beginPath();
      c.ellipse(s.cx, s.cy, Math.max(0.5, s.rx), Math.max(0.5, s.ry), 0, 0, Math.PI * 2);
      if (opts.fill) { c.fillStyle = opts.color; c.fill(); }
      if (opts.outline) { c.strokeStyle = opts.color; c.lineWidth = opts.lineWidth; c.stroke(); }
    },
    bbox(s, opts) {
      const m = opts.lineWidth / 2 + 1;
      return { x: s.x - m, y: s.y - m, w: s.w + m * 2, h: s.h + m * 2 };
    },
  });

  BP.tools.register(tool);
  BP.tools.ellipse = tool;
})();
