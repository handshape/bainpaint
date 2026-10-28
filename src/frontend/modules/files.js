// Bainpaint — file I/O orchestration (page side).
//
// new/open/save/save-as, recent files, drag-drop, and autosave. Save encodes
// the canvas (PNG/JPEG via toBlob, BMP via the pure lib) to base64 and streams
// it to the backend in <=512 KB binary chunks (the bridge has no documented max
// message size, so we bound it). Open never sends bytes over the bridge — the
// page loads the image itself via tiny.fileURL.
(() => {
  const BP = (window.BP = window.BP || {});
  const MAX = BP.MAX_DIM || 4096;
  const MAX_CHUNK = 512 * 1024;
  const RECENT_KEY = 'bp.recents';
  const MAX_RECENTS = 8;

  // ---- base64 / blob helpers --------------------------------------------
  const CH = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  function b64Encode(bytes) {
    let out = '';
    for (let i = 0; i < bytes.length; i += 3) {
      const b0 = bytes[i], b1 = i + 1 < bytes.length ? bytes[i + 1] : 0, b2 = i + 2 < bytes.length ? bytes[i + 2] : 0;
      out += CH[b0 >> 2] + CH[((b0 & 3) << 4) | (b1 >> 4)];
      out += i + 1 < bytes.length ? CH[((b1 & 15) << 2) | (b2 >> 6)] : '=';
      out += i + 2 < bytes.length ? CH[b2 & 63] : '=';
    }
    return out;
  }
  function chunkB64(b64, maxBinary) {
    const chars = Math.max(4, 4 * Math.floor(maxBinary / 3));
    const out = [];
    for (let i = 0; i < b64.length; i += chars) out.push(b64.slice(i, i + chars));
    return out;
  }
  function canvasToBlob(canvas, type, quality) {
    return new Promise((resolve, reject) => {
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('canvas.toBlob failed'))), type, quality);
    });
  }
  function blobToB64(blob) {
    return new Promise((resolve, reject) => {
      const fr = new FileReader();
      fr.onload = () => resolve(String(fr.result).split(',')[1]);
      fr.onerror = () => reject(new Error('FileReader failed'));
      fr.readAsDataURL(blob);
    });
  }
  const baseName = (name) => String(name).replace(/\.[^.]+$/, '');
  const fileName = (path) => String(path).split(/[\\/]/).pop() || 'file';

  // Encode the active doc to base64 by extension.
  async function encodeDoc(doc, ext) {
    if (ext === 'bmp') return b64Encode(BP.formats.encodeBMP(doc.canvas));
    const type = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : 'image/png';
    const quality = ext === 'jpg' || ext === 'jpeg' ? 0.92 : undefined;
    return blobToB64(await canvasToBlob(doc.canvas, type, quality));
  }
  const extOf = (path) => { const m = String(path).match(/\.([a-z0-9]+)$/i); return m ? m[1].toLowerCase() : ''; };

  // ---- module -----------------------------------------------------------
  const files = {
    _autosaveTimer: null,
    _recents: [],

    init() {
      // Debounced autosave after each change.
      BP.on('doc:changed', (doc) => {
        if (doc && doc.modified) this._scheduleAutosave();
      });
      // Drag-drop open.
      tiny.win.onDrop((paths) => {
        if (paths && paths.length) this.openFile(paths[0]);
      });
      // Cold-start / OS "open with" files.
      tiny.app.onOpenFiles((paths) => {
        if (paths && paths.length) this.openFile(paths[0]);
      });
      // Note: recents are loaded explicitly (awaited) by app.js boot.
    },

    // ---- new / open -----------------------------------------------------
    async newDoc(w, h, { fill = '#ffffff' } = {}) {
      if (!(await this._confirmDiscard())) return;
      const doc = BP.document.createDoc(w, h, { fill });
      BP.document.setDoc(doc);
      BP.view.fit();
      this._clearAutosave();
      BP.emit('doc:title', doc);
    },

    async openDialog() {
      const path = await tiny.dialog.openFile({ types: ['png', 'jpg', 'jpeg', 'bmp', 'gif'] });
      if (path) this.openFile(path);
    },

    async openFile(path) {
      if (!(await this._confirmDiscard())) return;
      try {
        const img = await BP.formats.loadImage(path);
        let w = img.naturalWidth, h = img.naturalHeight;
        let scaled = false;
        if (w > MAX || h > MAX) {
          const ok = await tiny.dialog.confirm(
            `Image is ${w}×${h}, larger than the ${MAX}×${MAX} limit.`,
            { ok: 'Open scaled down', cancel: 'Cancel' });
          if (!ok) return;
          const scale = Math.min(MAX / w, MAX / h);
          w = Math.max(1, Math.round(w * scale));
          h = Math.max(1, Math.round(h * scale));
          scaled = true;
        }
        const doc = BP.document.createDoc(w, h);
        doc.ctx.imageSmoothingEnabled = scaled;
        doc.ctx.drawImage(img, 0, 0, w, h);
        doc.path = path;
        doc.name = fileName(path);
        BP.document.setDoc(doc);
        BP.view.fit();
        this._addRecent(path);
        this._clearAutosave();
        BP.emit('doc:title', doc);
      } catch (e) {
        tiny.dialog.alert('Could not open file', { detail: String((e && e.message) || e) });
      }
    },

    // ---- save -----------------------------------------------------------
    async save() {
      const doc = BP.doc;
      if (!doc) return;
      if (!doc.path) return this.saveAs();
      return this._saveTo(doc.path);
    },
    async saveAs() {
      const doc = BP.doc;
      if (!doc) return;
      const path = await tiny.dialog.saveFile({ types: ['png', 'jpg', 'jpeg', 'bmp'], name: baseName(doc.name || 'untitled') });
      if (!path) return false;
      const ok = await this._saveTo(path);
      if (ok) {
        doc.path = path;
        doc.name = fileName(path);
        this._addRecent(path);
        this._clearAutosave();
        BP.emit('doc:title', doc);
      }
      return ok;
    },
    async _saveTo(path) {
      const doc = BP.doc;
      const ext = extOf(path);
      try {
        const b64 = await encodeDoc(doc, ext);
        const chunks = chunkB64(b64, MAX_CHUNK);
        for (let i = 0; i < chunks.length; i++) {
          await tiny.api.call('saveImage', { path, b64: chunks[i], i, n: chunks.length });
        }
        doc.modified = false;
        BP.emit('doc:changed', doc);
        return true;
      } catch (e) {
        tiny.dialog.alert('Save failed', { detail: String((e && e.message) || e) });
        return false;
      }
    },

    // Encode + chunked-save the active doc to an explicit path (no dialog).
    // Used by the print/PDF flow to stage a temp PNG.
    async saveToPath(path) {
      const doc = BP.doc;
      const ext = extOf(path);
      const b64 = await encodeDoc(doc, ext);
      const chunks = chunkB64(b64, MAX_CHUNK);
      for (let i = 0; i < chunks.length; i++) {
        await tiny.api.call('saveImage', { path, b64: chunks[i], i, n: chunks.length });
      }
    },

    // ---- recent files ---------------------------------------------------
    async loadRecents() {
      try {
        const r = await tiny.store.get(RECENT_KEY);
        if (Array.isArray(r)) this._recents = r.filter((p) => typeof p === 'string').slice(0, MAX_RECENTS);
      } catch { /* ignore */ }
      this._emitRecents();
    },
    _addRecent(path) {
      this._recents = [path, ...this._recents.filter((p) => p !== path)].slice(0, MAX_RECENTS);
      tiny.store.set(RECENT_KEY, this._recents).catch(() => {});
      this._emitRecents();
    },
    get recents() { return this._recents.slice(); },
    _emitRecents() { BP.emit('recents:changed', this._recents.slice()); },

    // ---- autosave -------------------------------------------------------
    _scheduleAutosave() {
      if (this._autosaveTimer) clearTimeout(this._autosaveTimer);
      this._autosaveTimer = setTimeout(() => { this._autosaveTimer = null; this._doAutosave(); }, 2000);
    },
    async _doAutosave() {
      const doc = BP.doc;
      if (!doc || !doc.modified) return;
      if (doc.w > 2048 && doc.h > 2048) return; // skip large docs (plan note)
      try {
        const b64 = await encodeDoc(doc, 'png');
        const chunks = chunkB64(b64, MAX_CHUNK);
        for (let i = 0; i < chunks.length; i++) {
          await tiny.api.call('autosaveSave', { b64: chunks[i], i, n: chunks.length });
        }
      } catch { /* autosave is best-effort */ }
    },
    async _clearAutosave() { try { await tiny.api.call('autosaveClear'); } catch { /* ignore */ } },
    async checkAutosave() {
      try { return await tiny.api.call('autosaveLoad'); } catch { return null; }
    },

    // ---- guard ----------------------------------------------------------
    async _confirmDiscard() {
      const doc = BP.doc;
      if (doc && doc.modified) {
        return tiny.dialog.confirm('Save changes before continuing?', {
          detail: `“${doc.name}” has unsaved changes.`, ok: 'Save', cancel: "Don't Save"
        }).then(async (save) => {
          if (save) { const ok = await this.save(); return ok; }
          return true;
        });
      }
      return true;
    },
  };

  BP.files = files;
})();
