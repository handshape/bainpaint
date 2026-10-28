// Bainpaint — color system: primary/secondary + recent colors.
//
// Colors are #rrggbb hex only. Left-click a swatch -> primary, right-click ->
// secondary. `X` swaps. Eyedropper sets primary (right-click sets secondary).
// Recent colors (10) persist via tiny.store.
(() => {
  const BP = (window.BP = window.BP || {});
  const STORE_KEY = 'bp.recents';
  const MAX_RECENTS = 10;

  function norm(hex) {
    if (typeof hex !== 'string') return null;
    let h = hex.trim().replace(/^#/, '').toLowerCase();
    if (/^[0-9a-f]{3}$/.test(h)) h = h.split('').map((c) => c + c).join('');
    if (!/^[0-9a-f]{6}$/.test(h)) return null;
    return '#' + h;
  }

  const colors = {
    primary: '#000000',
    secondary: '#ffffff',

    setPrimary(hex) {
      const n = norm(hex);
      if (!n) return;
      this.primary = n;
      this._pushRecent(n);
      BP.emit('colors:changed', { primary: this.primary, secondary: this.secondary });
    },
    setSecondary(hex) {
      const n = norm(hex);
      if (!n) return;
      this.secondary = n;
      this._pushRecent(n);
      BP.emit('colors:changed', { primary: this.primary, secondary: this.secondary });
    },
    setBoth(primary, secondary) {
      this.primary = norm(primary) || this.primary;
      this.secondary = norm(secondary) || this.secondary;
      this._pushRecent(this.primary);
      this._pushRecent(this.secondary);
      BP.emit('colors:changed', { primary: this.primary, secondary: this.secondary });
    },
    swap() {
      const t = this.primary; this.primary = this.secondary; this.secondary = t;
      BP.emit('colors:changed', { primary: this.primary, secondary: this.secondary });
    },

    // ---- recents ---------------------------------------------------------
    recents: [],
    _pushRecent(hex) {
      const n = norm(hex);
      if (!n) return;
      const r = this.recents.filter((c) => c !== n);
      r.unshift(n);
      this.recents = r.slice(0, MAX_RECENTS);
      this._persist();
      BP.emit('colors:changed', { primary: this.primary, secondary: this.secondary });
    },
    _persist() {
      if (window.tiny && tiny.store) tiny.store.set(STORE_KEY, this.recents).catch(() => {});
    },
    async loadRecents() {
      try {
        const r = await tiny.store.get(STORE_KEY);
        if (Array.isArray(r)) this.recents = r.filter((c) => norm(c)).slice(0, MAX_RECENTS);
      } catch { /* ignore */ }
      BP.emit('colors:changed', { primary: this.primary, secondary: this.secondary });
    },
  };

  BP.colors = colors;
  BP.colors.norm = norm;
  BP.colors.rgbToHex = (r, g, b) =>
    '#' + [r, g, b].map((v) => (v & 255).toString(16).padStart(2, '0')).join('');
})();
