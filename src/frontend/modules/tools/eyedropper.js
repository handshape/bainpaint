// Bainpaint — eyedropper tool.
//
// Reads the pixel under the cursor and sets the primary color (right-click
// sets secondary). Then returns to the previous tool, matching classic Paint.
(() => {
  const BP = (window.BP = window.BP || {});

  const tool = {
    id: 'eyedropper',
    name: 'Eyedropper',
    icon: 'pipette',
    hotkey: 'I',
    options: [],

    down(ctx, p) {
      const doc = ctx.doc;
      const x = Math.floor(p.x), y = Math.floor(p.y);
      if (x < 0 || y < 0 || x >= doc.w || y >= doc.h) return;
      const d = doc.ctx.getImageData(x, y, 1, 1).data;
      const hex = BP.colors.rgbToHex(d[0], d[1], d[2]);
      if (p.secondary) ctx.colors.setSecondary(hex);
      else ctx.colors.setPrimary(hex);
      // Return to the tool that was active before the eyedropper.
      const back = BP.tools._beforeEyedropper || 'brush';
      BP.tools.set(back);
    },

    move() {},
    up() {},
  };

  BP.tools.register(tool);
  BP.tools.eyedropper = tool;
})();
