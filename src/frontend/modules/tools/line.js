// Bainpaint — line tool.
(() => {
  const BP = (window.BP = window.BP || {});
  const C = BP.tools.common;

  const tool = C.shapeTool({
    id: 'line',
    name: 'Line',
    icon: 'minus',
    hotkey: 'L',
    options: [
      { key: 'lineWidth', label: 'Width', type: 'slider', min: 1, max: 50, step: 1, default: 1 },
    ],
    makeShape({ start, cur }) {
      if (!start || !cur) return null;
      return { x0: start.x, y0: start.y, x1: cur.x, y1: cur.y };
    },
    draw(c, s, opts) {
      c.strokeStyle = opts.color;
      c.lineWidth = opts.lineWidth;
      c.lineCap = 'round';
      c.beginPath();
      c.moveTo(s.x0, s.y0);
      c.lineTo(s.x1, s.y1);
      c.stroke();
      if (s.x0 === s.x1 && s.y0 === s.y1) {
        c.fillStyle = opts.color;
        c.beginPath();
        c.arc(s.x0, s.y0, Math.max(0.5, opts.lineWidth / 2), 0, Math.PI * 2);
        c.fill();
      }
    },
    bbox(s, opts) {
      const m = opts.lineWidth / 2 + 1;
      const x = Math.min(s.x0, s.x1), y = Math.min(s.y0, s.y1);
      return { x: x - m, y: y - m, w: Math.abs(s.x1 - s.x0) + m * 2, h: Math.abs(s.y1 - s.y0) + m * 2 };
    },
  });

  BP.tools.register(tool);
  BP.tools.line = tool;
})();
