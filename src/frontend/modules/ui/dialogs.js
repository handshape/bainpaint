// Bainpaint — dialogs (daisyUI modals).
//
// New Document, Custom Color, Resize Image, Resize Canvas, Brightness (live
// preview), Blur, Select by Color, About. Each builds a modal on demand.
(() => {
  const BP = (window.BP = window.BP || {});
  const MAX = BP.MAX_DIM || 4096;
  const esc = BP.esc;

  // Build a daisyUI modal; returns { dlg, body, action, addButton, close }.
  function makeModal(title, innerHTML) {
    const dlg = document.createElement('dialog');
    dlg.className = 'modal';
    dlg.innerHTML = `
      <div class="modal-box">
        <h3 class="font-bold text-lg">${esc(title)}</h3>
        <div class="py-4 dialog-body"></div>
        <div class="modal-action"></div>
      </div>
      <form method="dialog" class="modal-backdrop"><button aria-label="close"></button></form>`;
    document.body.appendChild(dlg);
    const body = dlg.querySelector('.dialog-body');
    body.innerHTML = innerHTML;
    const action = dlg.querySelector('.modal-action');
    dlg.showModal();
    return {
      dlg, body, action,
      addButton(label, cls, fn) {
        const b = document.createElement('button');
        b.className = cls;
        b.textContent = label;
        b.addEventListener('click', () => { if (fn) fn(); });
        action.appendChild(b);
        return b;
      },
      close() { dlg.close(); setTimeout(() => dlg.remove(), 250); },
    };
  }

  const num = (el, fallback) => {
    const v = parseInt(el.value, 10);
    return Number.isFinite(v) ? v : fallback;
  };

  const dialogs = {
    // ---- New Document ---------------------------------------------------
    newDoc() {
      const presets = [
        { label: '800 × 600', w: 800, h: 600 },
        { label: '1024 × 768', w: 1024, h: 768 },
        { label: '1280 × 720', w: 1280, h: 720 },
        { label: '1920 × 1080', w: 1920, h: 1080 },
      ];
      const m = makeModal('New Document', `
        <div class="grid grid-cols-2 gap-2 mb-4" id="bp-presets"></div>
        <div class="flex items-center gap-3">
          <label class="label justify-start w-16"><span class="label-text">Width</span></label>
          <input id="bp-nw" type="number" class="input input-bordered input-sm w-24" min="1" max="${MAX}" value="800">
          <label class="label justify-start w-16 ml-2"><span class="label-text">Height</span></label>
          <input id="bp-nh" type="number" class="input input-bordered input-sm w-24" min="1" max="${MAX}" value="600">
        </div>`);
      const grid = m.body.querySelector('#bp-presets');
      const nw = m.body.querySelector('#bp-nw');
      const nh = m.body.querySelector('#bp-nh');
      for (const p of presets) {
        const b = document.createElement('button');
        b.className = 'btn btn-sm';
        b.textContent = p.label;
        b.addEventListener('click', () => { nw.value = p.w; nh.value = p.h; });
        grid.appendChild(b);
      }
      m.addButton('Cancel', 'btn', () => m.close());
      m.addButton('Create', 'btn btn-primary', () => {
        const w = Math.min(MAX, Math.max(1, num(nw, 800)));
        const h = Math.min(MAX, Math.max(1, num(nh, 600)));
        m.close();
        BP.files.newDoc(w, h);
      });
    },

    // ---- Custom Color ---------------------------------------------------
    customColor(target) {
      target = target || 'primary';
      const start = target === 'secondary' ? BP.colors.secondary : BP.colors.primary;
      const m = makeModal('Custom Color', `
        <div class="flex gap-4">
          <div id="bp-cc-preview" class="w-24 h-24 rounded border border-base-300 shrink-0"></div>
          <div class="flex-1 space-y-3">
            ${['H', 'S', 'L'].map((c) => `
              <label class="label"><span class="label-text">${c}</span></label>
              <input id="bp-cc-${c.toLowerCase()}" type="range" class="range range-primary w-full"
                min="0" max="${c === 'H' ? 360 : 100}" value="0">`).join('')}
            <label class="label"><span class="label-text">Hex</span></label>
            <input id="bp-cc-hex" type="text" class="input input-bordered input-sm w-full" maxlength="7">
          </div>
        </div>`);
      const preview = m.body.querySelector('#bp-cc-preview');
      const H = m.body.querySelector('#bp-cc-h'), S = m.body.querySelector('#bp-cc-s'), L = m.body.querySelector('#bp-cc-l');
      const hex = m.body.querySelector('#bp-cc-hex');

      const hslToHex = (h, s, l) => {
        s /= 100; l /= 100;
        const k = (n) => (n + h / 30) % 12;
        const a = s * Math.min(l, 1 - l);
        const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
        const to = (x) => Math.round(255 * x).toString(16).padStart(2, '0');
        return '#' + to(f(0)) + to(f(8)) + to(f(4));
      };
      const hexToHsl = (hexStr) => {
        const h = hexStr.replace(/^#/, '');
        const r = parseInt(h.slice(0, 2), 16) / 255, g = parseInt(h.slice(2, 4), 16) / 255, b = parseInt(h.slice(4, 6), 16) / 255;
        const max = Math.max(r, g, b), min = Math.min(r, g, b);
        let hh = 0, ss = 0; const ll = (max + min) / 2;
        if (max !== min) {
          const d = max - min;
          ss = ll > 0.5 ? d / (2 - max - min) : d / (max + min);
          if (max === r) hh = ((g - b) / d + (g < b ? 6 : 0));
          else if (max === g) hh = (b - r) / d + 2;
          else hh = (r - g) / d + 4;
          hh *= 60;
        }
        return { h: Math.round(hh), s: Math.round(ss * 100), l: Math.round(ll * 100) };
      };
      const sync = (fromHex) => {
        let color;
        if (fromHex) {
          color = /^#[0-9a-f]{6}$/i.test(hex.value) ? hex.value : hslToHex(+H.value, +S.value, +L.value);
        } else {
          color = hslToHex(+H.value, +S.value, +L.value);
        }
        preview.style.background = color;
        const hsl = hexToHsl(color);
        if (!fromHex) { H.value = hsl.h; S.value = hsl.s; L.value = hsl.l; }
        hex.value = color;
      };
      const initHsl = hexToHsl(start);
      H.value = initHsl.h; S.value = initHsl.s; L.value = initHsl.l;
      H.addEventListener('input', () => sync(false));
      S.addEventListener('input', () => sync(false));
      L.addEventListener('input', () => sync(false));
      hex.addEventListener('input', () => sync(true));
      sync(false);

      m.addButton('Cancel', 'btn', () => m.close());
      m.addButton('OK', 'btn btn-primary', () => {
        if (/^#[0-9a-f]{6}$/i.test(hex.value)) {
          if (target === 'secondary') BP.colors.setSecondary(hex.value);
          else BP.colors.setPrimary(hex.value);
        }
        m.close();
      });
    },

    // ---- Resize Image ---------------------------------------------------
    resizeImage() {
      const doc = BP.doc;
      if (!doc) return;
      const m = makeModal('Resize Image', `
        <div class="flex items-center gap-3 mb-3">
          <label class="label justify-start w-16"><span class="label-text">Width</span></label>
          <input id="bp-ri-w" type="number" class="input input-bordered input-sm w-24" min="1" max="${MAX}" value="${doc.w}">
          <label class="label justify-start w-16 ml-2"><span class="label-text">Height</span></label>
          <input id="bp-ri-h" type="number" class="input input-bordered input-sm w-24" min="1" max="${MAX}" value="${doc.h}">
          <label class="flex items-center gap-2 ml-2"><input id="bp-ri-lock" type="checkbox" class="toggle toggle-primary toggle-sm" checked><span class="text-sm">Lock aspect</span></label>
        </div>
        <label class="label"><span class="label-text">Resampling</span></label>
        <select id="bp-ri-sample" class="select select-bordered select-sm w-40">
          <option value="bilinear">Bilinear</option>
          <option value="nearest">Nearest</option>
        </select>`);
      const w = m.body.querySelector('#bp-ri-w'), h = m.body.querySelector('#bp-ri-h');
      const lock = m.body.querySelector('#bp-ri-lock'), sample = m.body.querySelector('#bp-ri-sample');
      const ratio = doc.w / doc.h;
      w.addEventListener('input', () => { if (lock.checked) h.value = Math.max(1, Math.round(+w.value / ratio)); });
      h.addEventListener('input', () => { if (lock.checked) w.value = Math.max(1, Math.round(+h.value * ratio)); });
      m.addButton('Cancel', 'btn', () => m.close());
      m.addButton('Resize', 'btn btn-primary', () => {
        const nw = Math.min(MAX, Math.max(1, num(w, doc.w)));
        const nh = Math.min(MAX, Math.max(1, num(h, doc.h)));
        m.close();
        BP.undo.snapshotFull(doc, 'resize image');
        BP.document.resizeImage(doc, nw, nh, { sample: sample.value });
        BP.document.clearSelection();
        BP.document.markModified(doc);
      });
    },

    // ---- Resize Canvas --------------------------------------------------
    resizeCanvas() {
      const doc = BP.doc;
      if (!doc) return;
      const m = makeModal('Resize Canvas', `
        <div class="flex items-center gap-3 mb-3">
          <label class="label justify-start w-16"><span class="label-text">Width</span></label>
          <input id="bp-rc-w" type="number" class="input input-bordered input-sm w-24" min="1" max="${MAX}" value="${doc.w}">
          <label class="label justify-start w-16 ml-2"><span class="label-text">Height</span></label>
          <input id="bp-rc-h" type="number" class="input input-bordered input-sm w-24" min="1" max="${MAX}" value="${doc.h}">
        </div>
        <label class="label"><span class="label-text">Anchor (where old content lands)</span></label>
        <select id="bp-rc-anchor" class="select select-bordered select-sm w-48 mb-3">
          <option value="nw">Top-left</option><option value="n">Top-center</option><option value="ne">Top-right</option>
          <option value="w">Middle-left</option><option value="c" selected>Center</option><option value="e">Middle-right</option>
          <option value="sw">Bottom-left</option><option value="s">Bottom-center</option><option value="se">Bottom-right</option>
        </select>
        <label class="label"><span class="label-text">Fill color</span></label>
        <input id="bp-rc-fill" type="color" class="input input-bordered input-sm w-24" value="${BP.colors.secondary}">`);
      const w = m.body.querySelector('#bp-rc-w'), h = m.body.querySelector('#bp-rc-h');
      const anchor = m.body.querySelector('#bp-rc-anchor'), fill = m.body.querySelector('#bp-rc-fill');
      m.addButton('Cancel', 'btn', () => m.close());
      m.addButton('Resize', 'btn btn-primary', () => {
        const nw = Math.min(MAX, Math.max(1, num(w, doc.w)));
        const nh = Math.min(MAX, Math.max(1, num(h, doc.h)));
        const a = anchor.value;
        const ox = a.includes('w') ? 0 : a.includes('e') ? nw - doc.w : Math.round((nw - doc.w) / 2);
        const oy = a.startsWith('n') ? 0 : a.startsWith('s') ? nh - doc.h : Math.round((nh - doc.h) / 2);
        m.close();
        BP.undo.snapshotFull(doc, 'resize canvas');
        BP.document.setCanvasSize(doc, nw, nh, { fill: fill.value, offsetX: ox, offsetY: oy });
        BP.document.clearSelection();
        BP.document.markModified(doc);
      });
    },

    // ---- Brightness (live preview) -------------------------------------
    brightness() {
      const doc = BP.doc;
      if (!doc) return;
      const m = makeModal('Adjust Brightness', `
        <input id="bp-br" type="range" class="range range-primary w-full" min="-100" max="100" step="1" value="0">
        <div id="bp-br-val" class="text-center opacity-70 mt-1">0</div>`);
      const input = m.body.querySelector('#bp-br'), val = m.body.querySelector('#bp-br-val');
      const original = doc.ctx.getImageData(0, 0, doc.w, doc.h);
      input.addEventListener('input', () => {
        val.textContent = input.value;
        doc.ctx.putImageData(original, 0, 0);
        BP.effects.brightness(doc, +input.value, false);
      });
      m.addButton('Cancel', 'btn', () => { doc.ctx.putImageData(original, 0, 0); m.close(); });
      m.addButton('OK', 'btn btn-primary', () => {
        BP.undo.snapshotData(doc, new Uint8ClampedArray(original.data), 'brightness');
        BP.document.markModified(doc);
        m.close();
      });
    },

    // ---- Blur -----------------------------------------------------------
    blur() {
      const doc = BP.doc;
      if (!doc) return;
      const m = makeModal('Blur', `
        <label class="label"><span class="label-text">Radius</span></label>
        <input id="bp-bl" type="range" class="range range-primary w-full" min="1" max="20" step="1" value="3">
        <div id="bp-bl-val" class="text-center opacity-70 mt-1">3</div>`);
      const input = m.body.querySelector('#bp-bl'), val = m.body.querySelector('#bp-bl-val');
      input.addEventListener('input', () => { val.textContent = input.value; });
      m.addButton('Cancel', 'btn', () => m.close());
      m.addButton('Apply', 'btn btn-primary', () => {
        m.close();
        BP.effects.blur(doc, +input.value, true);
        BP.document.clearSelection();
      });
    },

    // ---- Select by Color ------------------------------------------------
    selectByColor() {
      const m = makeModal('Select by Color', `
        <label class="label"><span class="label-text">Tolerance</span></label>
        <input id="bp-sbc" type="range" class="range range-primary w-full" min="0" max="100" step="1" value="10">
        <div id="bp-sbc-val" class="text-center opacity-70 mt-1">10</div>
        <p class="text-xs opacity-60 mt-3">After OK, click a pixel on the canvas to select all matching pixels.</p>`);
      const input = m.body.querySelector('#bp-sbc'), val = m.body.querySelector('#bp-sbc-val');
      input.addEventListener('input', () => { val.textContent = input.value; });
      m.addButton('Cancel', 'btn', () => m.close());
      m.addButton('OK', 'btn btn-primary', () => {
        BP._pendingSelectColor = (+input.value) / 100;
        m.close();
      });
    },

    // ---- About ----------------------------------------------------------
    async about() {
      let info = {};
      try { info = await tiny.app.info(); } catch { /* ignore */ }
      const m = makeModal('About Bainpaint', `
        <p class="text-sm">Bainpaint — an MS-Paint-class paint app on tinyjs.</p>
        <p class="text-xs opacity-70 mt-2">
          Version ${esc(info.version || '0.1.0')} · ${esc(info.runtime || '')}
        </p>
        <p class="text-xs opacity-60 mt-2">GIF import loads the first frame only.</p>`);
      m.addButton('OK', 'btn btn-primary', () => m.close());
    },
  };

  BP.ui = BP.ui || {};
  BP.ui.dialogs = dialogs;
})();
