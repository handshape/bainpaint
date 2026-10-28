// Bainpaint — pointer input on the stage.
//
// Owns all pointer input (Pointer Events + setPointerCapture). Delivers
// {x, y (doc coords), secondary, e} to the active tool. Coalesces fast move
// events for accuracy. Space-drag and middle-drag pan; ctrl+wheel zooms at the
// cursor; right-drag paints with the secondary color; right-click is consumed.
(() => {
  const BP = (window.BP = window.BP || {});

  const pointer = {
    stage: null,
    spaceDown: false,
    _drawing: false,
    _panning: false,
    _secondary: false,
    _last: null,      // last stage-local point (for pan deltas)
    _pointerId: null,

    inInputTarget(e) {
      const t = e.target;
      if (!t) return false;
      return t.closest && t.closest('input, textarea, select, [contenteditable="true"]');
    },

    init(stage) {
      this.stage = stage;
      stage.addEventListener('pointerdown', (e) => this.onDown(e));
      stage.addEventListener('pointermove', (e) => this.onMove(e));
      stage.addEventListener('pointerup', (e) => this.onUp(e));
      stage.addEventListener('pointercancel', (e) => this.onUp(e));
      stage.addEventListener('contextmenu', (e) => e.preventDefault());
      stage.addEventListener('wheel', (e) => this.onWheel(e), { passive: false });

      window.addEventListener('keydown', (e) => {
        if (e.code === 'Space' && !this.inInputTarget(e) && !e.repeat) {
          this.spaceDown = true;
          stage.style.cursor = 'grab';
        }
      });
      window.addEventListener('keyup', (e) => {
        if (e.code === 'Space') {
          this.spaceDown = false;
          stage.style.cursor = '';
        }
      });
    },

    // Client (viewport) px -> { x, y doc px, secondary, e }.
    point(e, useStoredSecondary) {
      const s = BP.view.clientToStage(e.clientX, e.clientY);
      const d = BP.view.toDoc(s.x, s.y);
      return { x: d.x, y: d.y, secondary: useStoredSecondary ? this._secondary : (e.button === 2), e };
    },

    onDown(e) {
      if (this.inInputTarget(e)) return;
      // Pan on middle button or space-hold (any button).
      if (e.button === 1 || this.spaceDown) {
        this._panning = true;
        this._last = { x: e.clientX, y: e.clientY };
        this.stage.setPointerCapture(e.pointerId);
        this._pointerId = e.pointerId;
        this.stage.style.cursor = 'grabbing';
        e.preventDefault();
        return;
      }
      if (e.button !== 0 && e.button !== 2) return; // ignore others

      const tool = BP.tools.activeTool;
      if (!tool || !BP.doc) return;
      this._secondary = e.button === 2;
      this._drawing = true;
      this._pointerId = e.pointerId;
      this.stage.setPointerCapture(e.pointerId);

      const p = this.point(e, false);
      const ctx = BP.tools.makeCtx();
      // Report position to the status bar immediately.
      BP.emit('pointer:move', { x: p.x, y: p.y });
      // Pending "select by color" (set by the Edit menu dialog).
      if (BP._pendingSelectColor != null) {
        const tol = BP._pendingSelectColor;
        BP._pendingSelectColor = null;
        BP.selection.selectByColor(p.x, p.y, tol);
        e.preventDefault();
        return;
      }
      // Let the active tool veto the down (e.g. text commit on click-away).
      if (tool.onBeforeDown && tool.onBeforeDown(ctx, p)) return;
      tool.down(ctx, p);
      e.preventDefault();
    },

    onMove(e) {
      // Always report cursor position for the status bar.
      const p = this.point(e, true);
      BP.emit('pointer:move', { x: p.x, y: p.y });

      if (this._panning) {
        const dx = e.clientX - this._last.x;
        const dy = e.clientY - this._last.y;
        this._last = { x: e.clientX, y: e.clientY };
        BP.view.panBy(dx, dy);
        return;
      }
      if (!this._drawing) return;
      const tool = BP.tools.activeTool;
      if (!tool) return;
      const ctx = BP.tools.makeCtx();
      // Coalesce fast moves so no sample is skipped.
      const events = (e.getCoalescedEvents && e.getCoalescedEvents().length)
        ? e.getCoalescedEvents() : [e];
      for (const ce of events) {
        const mp = this.point(ce, true);
        tool.move(ctx, mp);
      }
    },

    onUp(e) {
      if (this._panning) {
        this._panning = false;
        this.stage.style.cursor = this.spaceDown ? 'grab' : '';
        if (this._pointerId != null) { try { this.stage.releasePointerCapture(this._pointerId); } catch {} }
        this._pointerId = null;
        return;
      }
      if (!this._drawing) return;
      this._drawing = false;
      if (this._pointerId != null) { try { this.stage.releasePointerCapture(this._pointerId); } catch {} }
      this._pointerId = null;
      const tool = BP.tools.activeTool;
      if (!tool) return;
      const p = this.point(e, true);
      const ctx = BP.tools.makeCtx();
      tool.up(ctx, p);
    },

    onWheel(e) {
      if (this.inInputTarget(e)) return;
      e.preventDefault();
      const s = BP.view.clientToStage(e.clientX, e.clientY);
      if (e.ctrlKey || e.metaKey) {
        const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1;
        BP.view.zoomBy(factor, s.x, s.y);
      } else {
        // Plain wheel pans the view.
        BP.view.panBy(-e.deltaX, -e.deltaY);
      }
    },
  };

  BP.pointer = pointer;
})();
