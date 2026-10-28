// Bainpaint — curve tool (click points; smooth quadratic spline through them;
// double-click or click-start closes).
(() => {
  const BP = (window.BP = window.BP || {});
  const C = BP.tools.common;

  // Smooth open path: on-curve at the endpoints, quadratic through the rest.
  function smoothPath(c, pts) {
    if (!pts || pts.length < 2) return;
    c.beginPath();
    c.moveTo(pts[0].x, pts[0].y);
    if (pts.length === 2) { c.lineTo(pts[1].x, pts[1].y); return; }
    for (let i = 1; i < pts.length - 1; i++) {
      const mx = (pts[i].x + pts[i + 1].x) / 2;
      const my = (pts[i].y + pts[i + 1].y) / 2;
      c.quadraticCurveTo(pts[i].x, pts[i].y, mx, my);
    }
    const last = pts[pts.length - 1];
    c.lineTo(last.x, last.y);
  }

  const tool = C.shapeTool({
    id: 'curve',
    name: 'Curve',
    icon: 'spline',
    hotkey: 'C',
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
      if (opts.fill) {
        smoothPath(c, s.points);
        c.closePath();
        c.fillStyle = opts.color;
        c.fill();
      }
      if (opts.outline) {
        smoothPath(c, s.points);
        c.strokeStyle = opts.color;
        c.lineWidth = opts.lineWidth;
        c.lineJoin = 'round';
        c.lineCap = 'round';
        c.stroke();
      }
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
  BP.tools.curve = tool;
})();
