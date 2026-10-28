// Bainpaint — status bar (cursor position, zoom, canvas size, doc name).
(() => {
  const BP = (window.BP = window.BP || {});

  const statusbar = {
    el: null,
    _pos: null, _zoom: null, _size: null, _name: null,

    init(container) {
      this.el = container;
      this.el.innerHTML = `
        <span class="bp-sb-pos opacity-70 tabular-nums"></span>
        <span class="bp-sb-zoom opacity-70 tabular-nums"></span>
        <span class="bp-sb-size opacity-70 tabular-nums"></span>
        <span class="bp-sb-name opacity-70 truncate"></span>`;
      this._pos = this.el.querySelector('.bp-sb-pos');
      this._zoom = this.el.querySelector('.bp-sb-zoom');
      this._size = this.el.querySelector('.bp-sb-size');
      this._name = this.el.querySelector('.bp-sb-name');

      BP.on('pointer:move', ({ x, y }) => {
        this._pos.textContent = `${Math.round(x)}, ${Math.round(y)}`;
      });
      BP.on('view:changed', ({ zoom }) => {
        this._zoom.textContent = Math.round(zoom * 100) + '%';
      });
      BP.on('doc:set', (doc) => this._updateDoc(doc));
      BP.on('doc:changed', (doc) => this._updateDoc(doc));
      this._updateDoc(BP.doc);
      if (BP.view) this._zoom.textContent = Math.round(BP.view.zoom * 100) + '%';
    },

    _updateDoc(doc) {
      if (!this._size) return;
      this._size.textContent = doc ? `${doc.w} × ${doc.h}` : '';
      this._name.textContent = doc ? `${doc.name}${doc.modified ? ' •' : ''}` : '';
    },
  };

  BP.ui = BP.ui || {};
  BP.ui.statusbar = statusbar;
})();
