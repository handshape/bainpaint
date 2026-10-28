// Bainpaint — clipboard: internal (region with alpha) + native OS clipboard.
//
// copy/cut capture the current selection into an offscreen canvas whose alpha
// is the selection mask (preserves transparency). paste places at the active
// selection rect, else the canvas center, preserving alpha. cut/delete clear
// the region to the secondary (background) color. The native clipboard is
// written on copy/cut and read on paste (image or file paths).
(() => {
  const BP = (window.BP = window.BP || {});
  const C = (BP.tools && BP.tools.common) || { hexToRgb: (h) => ({ r: 255, g: 255, b: 255, a: 255 }) };
  const MAX = BP.MAX_DIM || 4096;

  function loadImageCanvas(path) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const c = document.createElement('canvas');
        c.width = img.naturalWidth;
        c.height = img.naturalHeight;
        c.getContext('2d').drawImage(img, 0, 0);
        resolve(c);
      };
      img.onerror = reject;
      img.src = tiny.fileURL(path);
    });
  }

  const clipboard = {
    _canvas: null,

    get has() { return !!this._canvas; },

    // Capture the current selection (mask -> alpha) into an offscreen canvas.
    _capture() {
      const doc = BP.doc, sel = BP.selection;
      if (!sel.has) return null;
      const b = sel.bounds();
      if (!b || b.w <= 0 || b.h <= 0) return null;
      const mask = sel.getMask();
      const src = doc.ctx.getImageData(b.x, b.y, b.w, b.h);
      const out = new ImageData(b.w, b.h);
      const sd = src.data, od = out.data;
      for (let py = 0; py < b.h; py++) {
        for (let px = 0; px < b.w; px++) {
          const mi = ((b.y + py) * doc.w + (b.x + px)) * 4;
          const sa = mask ? mask.data[mi + 3] : 255;
          const si = (py * b.w + px) * 4;
          od[si] = sd[si]; od[si + 1] = sd[si + 1]; od[si + 2] = sd[si + 2];
          od[si + 3] = Math.round(sd[si + 3] * sa / 255);
        }
      }
      const c = document.createElement('canvas');
      c.width = b.w; c.height = b.h;
      c.getContext('2d').putImageData(out, 0, 0);
      return c;
    },

    copy() {
      const c = this._capture();
      if (!c) return;
      this._canvas = c;
      this._writeNative(c);
      BP.emit('clipboard:changed', true);
    },

    cut() {
      const doc = BP.doc, sel = BP.selection;
      if (!sel.has) return;
      const c = this._capture();
      if (!c) return;
      const b = sel.bounds();
      const mask = sel.getMask();
      BP.undo.snapshotRect(doc, b.x, b.y, b.w, b.h, 'cut');
      const img = doc.ctx.getImageData(b.x, b.y, b.w, b.h);
      const bg = C.hexToRgb(BP.colors.secondary);
      for (let py = 0; py < b.h; py++) {
        for (let px = 0; px < b.w; px++) {
          if (!mask.data[((b.y + py) * doc.w + (b.x + px)) * 4 + 3]) continue;
          const i4 = (py * b.w + px) * 4;
          img.data[i4] = bg.r; img.data[i4 + 1] = bg.g; img.data[i4 + 2] = bg.b; img.data[i4 + 3] = 255;
        }
      }
      doc.ctx.putImageData(img, b.x, b.y);
      this._canvas = c;
      this._writeNative(c);
      BP.document.markModified(doc);
      BP.emit('clipboard:changed', true);
    },

    // Clear the selection region to the background (no clipboard write).
    deleteSelection() {
      const doc = BP.doc, sel = BP.selection;
      if (!sel.has) return;
      const b = sel.bounds();
      const mask = sel.getMask();
      BP.undo.snapshotRect(doc, b.x, b.y, b.w, b.h, 'delete');
      const img = doc.ctx.getImageData(b.x, b.y, b.w, b.h);
      const bg = C.hexToRgb(BP.colors.secondary);
      for (let py = 0; py < b.h; py++) {
        for (let px = 0; px < b.w; px++) {
          if (!mask.data[((b.y + py) * doc.w + (b.x + px)) * 4 + 3]) continue;
          const i4 = (py * b.w + px) * 4;
          img.data[i4] = bg.r; img.data[i4 + 1] = bg.g; img.data[i4 + 2] = bg.b; img.data[i4 + 3] = 255;
        }
      }
      doc.ctx.putImageData(img, b.x, b.y);
      BP.document.markModified(doc);
    },

    async paste() {
      const doc = BP.doc;
      if (!doc) return;
      let c = this._canvas;
      if (!c) c = await this._readNative();
      if (!c) return; // empty clipboard
      // Downscale oversized external pastes (confirm first).
      if (c.width > MAX || c.height > MAX) {
        const ok = await tiny.dialog.confirm(
          `Image is ${c.width}×${c.height}, larger than the ${MAX}×${MAX} limit.`,
          { detail: 'Paste it scaled down to fit?', ok: 'Scale & Paste', cancel: 'Cancel' });
        if (!ok) return;
        const scale = Math.min(MAX / c.width, MAX / c.height);
        const nc = document.createElement('canvas');
        nc.width = Math.max(1, Math.round(c.width * scale));
        nc.height = Math.max(1, Math.round(c.height * scale));
        nc.getContext('2d').drawImage(c, 0, 0, nc.width, nc.height);
        c = nc;
      }
      // Placement: active selection rect, else canvas center.
      const sel = BP.selection;
      let px, py;
      if (sel.has && sel.bounds()) {
        const b = sel.bounds();
        px = b.x; py = b.y;
      } else {
        px = Math.round((doc.w - c.width) / 2);
        py = Math.round((doc.h - c.height) / 2);
      }
      // Snapshot the destination region (clamped to the doc) for undo.
      const rx = Math.max(0, px), ry = Math.max(0, py);
      const rw = Math.min(doc.w, px + c.width) - rx;
      const rh = Math.min(doc.h, py + c.height) - ry;
      if (rw > 0 && rh > 0) BP.undo.snapshotRect(doc, rx, ry, rw, rh, 'paste');
      doc.ctx.drawImage(c, px, py);
      BP.document.markModified(doc);
    },

    _writeNative(c) {
      if (!window.tiny || !tiny.clipboard) return;
      try {
        tiny.clipboard.write({ image: c.toDataURL('image/png') });
      } catch (e) { console.warn('native clipboard write failed', e); }
    },

    async _readNative() {
      if (!window.tiny || !tiny.clipboard) return null;
      let info;
      try { info = await tiny.clipboard.read(); } catch { return null; }
      if (!info) return null;
      if (info.kind === 'image' && info.image) {
        try { return await loadImageCanvas(info.image); } catch { return null; }
      }
      if (info.kind === 'files' && info.paths && info.paths.length) {
        const imgExt = /\.(png|jpe?g|gif|bmp|webp)$/i;
        const p = info.paths.find((pp) => imgExt.test(pp));
        if (p) { try { return await loadImageCanvas(p); } catch { return null; } }
      }
      return null;
    },
  };

  BP.clipboard = clipboard;
})();
