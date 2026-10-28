// Bainpaint — polygon tool (click vertices; double-click or click-start closes).
(() => {
  const BP = (window.BP = window.BP || {});
  const C = BP.tools.common;

  const tool = C.shapeTool({
    id: 'polygon',
    name: 'Polygon',
    icon: 'hexagon',
    hotkey: 'G',
    multiClick: true,
    options: [
      { key: 'fill', label: 'Fill', type: 'toggle', default: false },
      { key: 'outline', label: 'Outline', type: 'toggle', default: true },
      { key: 'lineWidth', label: 'Width', type: 'slider', min: 1, max: 20, step: 1, default: 1 },
    ],
    tryClose(tool, ctx, p) {
      const pts = tool._points;
      if (p.e && p.e.detail >= 2) { tool._points.push({ x: p.x, y: p.y }); return true; }
      const s = pts[0];
      const th = 8 / ctx.view.zoom;
      return Math.hypot(p.x - s.x, p.y - s.y) < th;
    },
    makeShape({ points, cur, active }) {
      if (!points || points.length === 0) return null;
      const all = points.slice();
      if (active && cur) all.push({ x: cur.x, y: cur.y });
      return { points: all };
    },
    draw(c, s, opts) {
      C.tracePath(c, s.points, true);
      C.fillStroke(c, s, opts);
    },
    bbox(s, opts) {
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (const p of s.points) {
        minX = Math.min(minX, p.x); minY = Math.min(minY, p.y);
        maxX = Math.max(maxX, p.x); maxY = Math.max(maxY, p.y);
      }
      const m = opts.lineWidth / 2 + 1;
      return { x: minX - m, y: minY - m, w: maxX - minX + m * 2, h: maxY - minY + m * 2 };
    },
  });

  BP.tools.register(tool);
  BP.tools.polygon = tool;
})();
