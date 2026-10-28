// Bainpaint — palette (2×14 classic grid + recent-colors row).
//
// Left-click a swatch -> primary; right-click -> secondary.
(() => {
  const BP = (window.BP = window.BP || {});

  const palette = {
    el: null,
    _recents: null,

    init(container) {
      this.el = container;
      this.el.innerHTML = '';
      const grid = document.createElement('div');
      grid.className = 'bp-palette-grid grid gap-px p-px bg-base-300 rounded';
      grid.style.gridTemplateColumns = 'repeat(14, 1fr)';
      for (const hex of window.BPLib.palette.COLORS) {
        grid.appendChild(this._swatch(hex));
      }
      this.el.appendChild(grid);

      this._recents = document.createElement('div');
      this._recents.className = 'bp-recents flex gap-px mt-1 h-4';
      this.el.appendChild(this._recents);
      this._updateRecents();
      BP.on('colors:changed', () => this._updateRecents());
    },

    _swatch(hex) {
      const s = document.createElement('button');
      s.className = 'bp-swatch aspect-square w-4 rounded-sm';
      s.style.background = hex;
      s.title = hex;
      s.setAttribute('aria-label', 'color ' + hex);
      s.addEventListener('click', () => BP.colors.setPrimary(hex));
      s.addEventListener('contextmenu', (e) => { e.preventDefault(); BP.colors.setSecondary(hex); });
      return s;
    },

    _updateRecents() {
      if (!this._recents) return;
      this._recents.innerHTML = '';
      for (const hex of BP.colors.recents) {
        this._recents.appendChild(this._swatch(hex));
      }
    },
  };

  BP.ui = BP.ui || {};
  BP.ui.palette = palette;
})();
