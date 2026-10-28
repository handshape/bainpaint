// Bainpaint — viewport (zoom/pan) + overlay management.
//
// The doc canvas element IS the visible canvas: zoom/pan are a pure CSS
// transform (translate + scale), transform-origin 0 0. The canvas buffer stays
// at document resolution (w x h), so 100% zoom = 1 doc px per CSS px and the
// browser's devicePixelRatio handles HiDPI. `image-rendering: pixelated` is
// applied only while the doc is being upscaled on screen (zoom*dpr > 1).
//
// A viewport-sized overlay canvas (stage client size x dpr) is redrawn on a
// rAF loop while active and hosts shape ghosts, marching ants, and the text
// editing box, all drawn in stage CSS px via toScreen().
(() => {
  const BP = (window.BP = window.BP || {});
  const MIN_ZOOM = 0.25, MAX_ZOOM = 8;

  const view = {
    zoom: 1,
    panX: 0,
    panY: 0,
    stage: null,       // set by app.js boot
    canvas: null,      // the doc canvas element
    overlay: null,     // overlay canvas element
    overlayCtx: null,
    _dpr: 1,
    _raf: 0,
    _overlayDirty: false,
    _drawFns: [],

    get dpr() { return this._dpr; },

    init(stage, canvas, overlay) {
      this.stage = stage;
      this.canvas = canvas;
      this.overlay = overlay;
      this._dpr = window.devicePixelRatio || 1;
      this.overlayCtx = overlay.getContext('2d');
      this.resizeOverlay();
      this.apply();
      // Keep the overlay sized to the stage.
      const ro = new ResizeObserver(() => { this.resizeOverlay(); this.apply(); });
      ro.observe(stage);
      window.addEventListener('resize', () => { this._dpr = window.devicePixelRatio || 1; this.resizeOverlay(); this.apply(); });
    },

    // Match overlay buffer to the stage's device-pixel size; draw in CSS px.
    resizeOverlay() {
      if (!this.stage || !this.overlay) return;
      const dpr = this._dpr;
      const w = this.stage.clientWidth;
      const h = this.stage.clientHeight;
      this.overlay.width = Math.max(1, Math.round(w * dpr));
      this.overlay.height = Math.max(1, Math.round(h * dpr));
      this.overlay.style.width = w + 'px';
      this.overlay.style.height = h + 'px';
      this.overlayCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (this._overlayDirty) this._paintOverlay();
    },

    // Doc px -> stage-local CSS px.
    toScreen(dx, dy) { return { x: dx * this.zoom + this.panX, y: dy * this.zoom + this.panY }; },
    // Stage-local CSS px -> doc px.
    toDoc(sx, sy) { return { x: (sx - this.panX) / this.zoom, y: (sy - this.panY) / this.zoom }; },
    // Client (viewport) px -> stage-local CSS px.
    clientToStage(cx, cy) {
      const r = this.stage.getBoundingClientRect();
      return { x: cx - r.left, y: cy - r.top };
    },

    clampZoom(z) { return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z)); },

    // Zoom about a stage-local CSS px point (keeps that doc point fixed).
    setZoom(z, cx, cy) {
      z = this.clampZoom(z);
      const before = this.toDoc(cx, cy);
      this.zoom = z;
      const afterX = before.x * z + this.panX;
      const afterY = before.y * z + this.panY;
      this.panX += (cx - afterX);
      this.panY += (cy - afterY);
      this.apply();
    },
    zoomBy(factor, cx, cy) { this.setZoom(this.zoom * factor, cx, cy); },

    panBy(dx, dy) { this.panX += dx; this.panY += dy; this.apply(); },

    // Fit the whole doc into the stage (with padding); used by "Fit to Window".
    fit() {
      const doc = BP.doc;
      if (!doc) return;
      const pad = 24;
      const availW = this.stage.clientWidth - pad * 2;
      const availH = this.stage.clientHeight - pad * 2;
      if (availW <= 0 || availH <= 0) return;
      const z = this.clampZoom(Math.min(availW / doc.w, availH / doc.h));
      this.zoom = z;
      this.panX = (this.stage.clientWidth - doc.w * z) / 2;
      this.panY = (this.stage.clientHeight - doc.h * z) / 2;
      this.apply();
    },
    zoom100() {
      const doc = BP.doc;
      const cx = this.stage.clientWidth / 2, cy = this.stage.clientHeight / 2;
      const c = doc ? this.toDoc(cx, cy) : { x: 0, y: 0 };
      this.zoom = 1;
      this.panX = cx - c.x;
      this.panY = cy - c.y;
      this.apply();
    },

    apply() {
      if (this.canvas) {
        const upscaling = this.zoom * this._dpr > 1;
        this.canvas.style.transform =
          `translate(${this.panX}px, ${this.panY}px) scale(${this.zoom})`;
        this.canvas.style.imageRendering = upscaling ? 'pixelated' : 'auto';
      }
      BP.emit('view:changed', { zoom: this.zoom, panX: this.panX, panY: this.panY });
      if (this._overlayDirty) this._paintOverlay();
    },

    // Set the overlay ctx so we can draw in DOC coordinates (line widths in
    // doc units). Composes the device-pixel scale with zoom/pan. Call before a
    // shape/text preview; the base dpr transform is restored by the next
    // resizeOverlay() or clearOverlay().
    shapeTransform(oc) {
      const dpr = this._dpr;
      oc.setTransform(dpr * this.zoom, 0, 0, dpr * this.zoom, dpr * this.panX, dpr * this.panY);
    },

    // ---- overlay rAF loop -------------------------------------------------
    // Multiple draw fns can coexist (e.g. marching ants + a shape ghost).
    // addDrawFn returns an unsubscribe; the loop repaints only while dirty.
    addDrawFn(fn) {
      this._drawFns.push(fn);
      this.requestOverlay();
      return () => {
        const i = this._drawFns.indexOf(fn);
        if (i >= 0) this._drawFns.splice(i, 1);
        this.requestOverlay();
      };
    },
    clearDrawFns() { this._drawFns = []; this.requestOverlay(); },
    requestOverlay() {
      this._overlayDirty = true;
      if (this._raf) return;
      this._raf = requestAnimationFrame(() => { this._raf = 0; this._paintOverlay(); });
    },
    _paintOverlay() {
      if (!this.overlayCtx) return;
      this._overlayDirty = false;
      const ctx = this.overlayCtx;
      const dpr = this._dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0); // base: stage CSS px
      ctx.clearRect(0, 0, this.stage.clientWidth, this.stage.clientHeight);
      for (const fn of this._drawFns.slice()) fn(ctx, this);
    },
    clearOverlay() {
      if (!this.overlayCtx) return;
      const dpr = this._dpr;
      this.overlayCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
      this.overlayCtx.clearRect(0, 0, this.stage.clientWidth, this.stage.clientHeight);
    },
  };

  BP.view = view;
})();
