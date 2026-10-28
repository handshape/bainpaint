// Bainpaint — undo budget math (pure, no DOM).
//
// Probeable: attaches to globalThis.BPLib; a tjs probe imports this file by
// absolute path (side effect) and reads globalThis.BPLib.budget.
//
// The undo stack holds region-snapshot entries. Each entry's memory cost is
// the sum of its rects' w*h*4 bytes. `commit` evicts oldest-first while the
// total exceeds MAX_BYTES, but never drops below MIN levels (the hard floor)
// when that is achievable.
(() => {
  const BPLib = (globalThis.BPLib = Object.assign({}, globalThis.BPLib));

  const budget = {
    // 128 MB total across all undo entries.
    MAX_BYTES: 128 * 1024 * 1024,
    // Target levels a normal stroke history should hold.
    TARGET: 10,
    // Hard floor: never evict below this many levels (if we can help it).
    MIN: 4,

    // Sum of entry sizes (bytes) for an array of sizes.
    total(sizes) {
      let t = 0;
      for (let i = 0; i < sizes.length; i++) t += sizes[i];
      return t;
    },

    // Given existing entry sizes (oldest first) and the byte size of a NEW
    // entry about to be pushed, return how many of the OLDEST entries must be
    // evicted so that the resulting stack (after eviction + push) stays within
    // MAX_BYTES, without dropping below MIN entries.
    //
    // The caller applies the returned count by splicing that many off the front.
    evictCount(sizes, newSize) {
      let total = this.total(sizes) + newSize;
      let count = sizes.length + 1;
      let evict = 0;
      while (total > this.MAX_BYTES && count > this.MIN) {
        total -= sizes[evict];
        evict++;
        count--;
      }
      return evict;
    },

    // True if a stack of these sizes fits the budget.
    withinBudget(sizes) {
      return this.total(sizes) <= this.MAX_BYTES;
    },

    // Byte size of a single rect snapshot.
    rectBytes(w, h) {
      return w * h * 4;
    },
  };

  BPLib.budget = budget;
})();
