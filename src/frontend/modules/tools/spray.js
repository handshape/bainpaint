// Bainpaint — spray (airbrush) tool.
//
// While held, scatters 1-px particles around the cursor on a rAF clock.
// `size` = radius, `density` = particles per tick. A per-stroke LCG seeds the
// jitter so a stroke is deterministic for a given seed.
(() => {
  const BP = (window.BP = window.BP || {});
  const C = BP.tools.common;

  function makeRng(seed) {
    let s = (seed >>> 0) || 1;
    return () => {
      s ^= s << 13; s >>>= 0;
      s ^= s >> 17;
      s ^= s << 5; s >>>= 0;
      return s / 0xffffffff;
    };
  }

  const tool = {
    id: 'spray',
    name: 'Spray',
    icon: 'spray-can',
    hotkey: 'A',
    options: [
      { key: 'size', label: 'Radius', type: 'slider', min: 1, max: 50, step: 1, default: 18 },
      { key: 'density', label: 'Density', type: 'slider', min: 1, max: 100, step: 1, default: 30 },
    ],
    _active: false,
    _pos: null,
    _color: null,
    _doc: null,
    _undo: null,
    _rng: null,
    _raf: 0,

    down(ctx, p) {
      this._doc = ctx.doc;
      this._undo = ctx.undo;
      this._color = C.colorFor(ctx, p);
      this._pos = { x: p.x, y: p.y };
      this._rng = makeRng((Date.now() & 0xffff) ^ 0x9e37);
      this._active = true;
      ctx.undo.beginStroke(ctx.doc);
      this._tick();
    },

    move(ctx, p) {
      if (!this._active) return;
      this._pos = { x: p.x, y: p.y };
    },

    up(ctx, p) {
      this._stop();
      ctx.undo.commit(ctx.doc, 'spray');
    },

    cancel() { this._stop(); },

    _stop() {
      this._active = false;
      if (this._raf) { cancelAnimationFrame(this._raf); this._raf = 0; }
    },

    _tick() {
      if (!this._active) return;
      const size = (this._state && this._state.size) || 18;
      const density = (this._state && this._state.density) || 30;
      const c = this._doc.ctx;
      const { x, y } = this._pos;
      this._undo.cover(this._doc, x, y, size + 1);
      c.fillStyle = this._color;
      const rng = this._rng;
      for (let i = 0; i < density; i++) {
        const a = rng() * Math.PI * 2;
        const d = Math.sqrt(rng()) * size; // uniform in disk
        const px = Math.round(x + Math.cos(a) * d);
        const py = Math.round(y + Math.sin(a) * d);
        c.fillRect(px, py, 1, 1);
      }
      this._raf = requestAnimationFrame(() => this._tick());
    },
  };

  BP.tools.register(tool);
  BP.tools.spray = tool;
})();
