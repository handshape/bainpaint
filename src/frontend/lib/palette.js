// Bainpaint — classic 28-swatch palette (pure, no DOM).
//
// The classic Windows-Paint 28-color palette, laid out as 2 rows x 14.
// Single array — trivial to adjust if the reference table is corrected.
(() => {
  const BPLib = (globalThis.BPLib = Object.assign({}, globalThis.BPLib));

  const palette = {
    // 28 colors, row-major (row 0 = top 14, row 1 = bottom 14).
    COLORS: [
      // Row 1
      '#000000', '#800000', '#808000', '#008000',
      '#800080', '#000080', '#008080', '#C0C0C0',
      '#808080', '#FF0000', '#FF8000', '#FFFF00',
      '#00FF00', '#00FFFF',
      // Row 2
      '#0000FF', '#FF00FF', '#804000', '#004000',
      '#400040', '#004040', '#808040', '#00FF80',
      '#8000FF', '#80FFFF', '#0080FF', '#80FF80',
      '#80FF00', '#FFFF80',
    ],
    ROWS: 2,
    COLS: 14,

    // All 28 unique (defensive invariant used by the probe).
    unique() {
      const seen = new Set(this.COLORS);
      return seen.size;
    },
  };

  BPLib.palette = palette;
})();
