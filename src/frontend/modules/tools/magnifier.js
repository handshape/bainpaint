// Bainpaint — magnifier tool (left = zoom in, right = zoom out, at cursor).
(() => {
  const BP = (window.BP = window.BP || {});

  const tool = {
    id: 'magnifier',
    name: 'Magnifier',
    icon: 'zoom-in',
    hotkey: 'M',
    options: [],

    down(ctx, p) {
      const s = ctx.view.clientToStage(p.e.clientX, p.e.clientY);
      const factor = p.secondary ? 1 / 1.5 : 1.5;
      ctx.view.zoomBy(factor, s.x, s.y);
    },

    move() {},
    up() {},
  };

  BP.tools.register(tool);
  BP.tools.magnifier = tool;
})();
