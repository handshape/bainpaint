// Bainpaint — text tool.
//
// Click opens a multiline DOM editing box (a <textarea>) positioned over the
// canvas and scaled with zoom. Enter = newline; Esc = cancel; clicking away
// commits. Commits via ctx.fillText as a single undo entry. Color = active
// (primary) color; right-click opens the box in the secondary color.
(() => {
  const BP = (window.BP = window.BP || {});
  const C = BP.tools.common;

  const FAMILIES = [
    'Arial', 'Calibri', 'Comic Sans MS', 'Courier New',
    'Georgia', 'Impact', 'Times New Roman', 'Verdana',
  ];

  const tool = {
    id: 'text',
    name: 'Text',
    icon: 'type',
    hotkey: 'T',
    options: [
      { key: 'family', label: 'Font', type: 'select', values: FAMILIES, default: 'Arial' },
      { key: 'size', label: 'Size', type: 'slider', min: 8, max: 200, step: 1, default: 24 },
    ],
    _editing: false,
    _ta: null,
    _justCommitted: false,
    _doc: null, _undo: null, _color: null, _start: null, _family: 'Arial', _size: 24,
    _onDocMouseDown: null,

    _sizeOf() { return (this._state && this._state.size) || 24; },
    _familyOf() { return (this._state && this._state.family) || 'Arial'; },

    down(ctx, p) {
      if (this._editing) return; // already editing; click-away handled in onBeforeDown
      this._doc = ctx.doc;
      this._undo = ctx.undo;
      this._color = C.colorFor(ctx, p);
      this._start = { x: p.x, y: p.y };
      this._family = this._familyOf();
      this._size = this._sizeOf();
      this._openBox(ctx);
    },

    onBeforeDown(ctx, p) {
      if (this._justCommitted) { this._justCommitted = false; return true; }
      return false;
    },

    move() { /* text edit is DOM-driven */ },
    up() { /* text edit is DOM-driven */ },
    cancel() { if (this._editing) this._cancel(); },

    _openBox(ctx) {
      const view = ctx.view;
      const s = view.toScreen(this._start.x, this._start.y);
      const ta = document.createElement('textarea');
      ta.value = '';
      ta.spellcheck = false;
      Object.assign(ta.style, {
        position: 'absolute',
        left: (s.x - 1) + 'px',
        top: (s.y - 1) + 'px',
        fontSize: (this._size * view.zoom) + 'px',
        fontFamily: this._family,
        lineHeight: '1.2',
        color: this._color,
        background: 'transparent',
        border: '1px dashed ' + this._color,
        outline: 'none',
        resize: 'none',
        overflow: 'hidden',
        padding: '0',
        margin: '0',
        whiteSpace: 'pre',
        minWidth: '32px',
        minHeight: (this._size * view.zoom * 1.5) + 'px',
        zIndex: '6',
      });
      view.stage.appendChild(ta);
      this._ta = ta;
      this._editing = true;

      ta.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') { e.preventDefault(); this._cancel(); }
        e.stopPropagation(); // don't trigger app shortcuts
      });

      this._onDocMouseDown = (e) => {
        if (this._ta && this._ta.contains(e.target)) return; // keep editing
        this._commit();
      };
      document.addEventListener('mousedown', this._onDocMouseDown, true);
      requestAnimationFrame(() => ta.focus());
    },

    _removeBox() {
      if (this._onDocMouseDown) {
        document.removeEventListener('mousedown', this._onDocMouseDown, true);
        this._onDocMouseDown = null;
      }
      if (this._ta) { this._ta.remove(); this._ta = null; }
      this._editing = false;
    },

    _cancel() {
      if (!this._editing) return;
      this._removeBox();
    },

    _commit() {
      if (!this._editing) return;
      const text = this._ta ? this._ta.value : '';
      this._justCommitted = true;
      setTimeout(() => { this._justCommitted = false; }, 0);
      this._removeBox();
      if (!text || text.trim() === '') return;
      this._drawText(text);
    },

    _drawText(text) {
      const doc = this._doc, undo = this._undo;
      const c = doc.ctx;
      const size = this._size, family = this._family;
      const lines = text.split('\n');
      c.font = size + 'px ' + family;
      c.textBaseline = 'top';
      let maxW = 0;
      for (const line of lines) maxW = Math.max(maxW, c.measureText(line).width);
      const lineHeight = size * 1.2;
      const totalH = lines.length * lineHeight;
      const x = this._start.x, y = this._start.y;
      const b = { x: x - 1, y: y - 1, w: Math.ceil(maxW) + 2, h: Math.ceil(totalH) + 2 };
      undo.snapshotRect(doc, b.x, b.y, b.w, b.h, 'text');
      c.font = size + 'px ' + family;
      c.fillStyle = this._color;
      c.textBaseline = 'top';
      lines.forEach((line, i) => c.fillText(line, x, y + i * lineHeight));
      BP.document.markModified(doc);
    },
  };

  BP.tools.register(tool);
  BP.tools.text = tool;
})();
