// Bainpaint — boot, native menu, command registry, keyboard shortcuts.
//
// Loads last. Wires the modules together: theme, view/pointer, UI, commands,
// native menu (tiny.menu.set), the page-side shortcut registry (uniform across
// platforms), autosave, and the recovery/fresh-doc boot sequence.
(async () => {
  const BP = window.BP;
  const esc = BP.esc;

  // ---- DOM refs ---------------------------------------------------------
  const $ = (id) => document.getElementById(id);
  const stage = $('stage');
  const docCanvas = $('doc-canvas');
  const overlay = $('overlay');

  // ---- theme ------------------------------------------------------------
  function applyTheme(theme) {
    document.documentElement.dataset.theme = theme;
  }
  async function toggleTheme() {
    const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    applyTheme(next);
    tiny.store.set('theme', next).catch(() => {});
  }

  // ---- view / pointer / UI ---------------------------------------------
  BP.view.init(stage, docCanvas, overlay);
  BP.pointer.init(stage);
  BP.ui.toolbar.init($('toolbar'));
  BP.ui.optionsbar.init($('optionsbar'));
  BP.ui.palette.init($('palette'));
  BP.ui.statusbar.init($('statusbar'));

  // Keep the window title in sync with the doc.
  function updateTitle() {
    const d = BP.doc;
    tiny.win.setTitle(d ? `${d.name}${d.modified ? ' •' : ''} — Bainpaint` : 'Bainpaint');
  }

  // ---- commands ---------------------------------------------------------
  function stageCenter() {
    return { x: stage.clientWidth / 2, y: stage.clientHeight / 2 };
  }
  function registerCommands() {
    const C = BP.commands;
    const doc = () => BP.doc;

    // File
    C.register('file:new', { run: () => BP.ui.dialogs.newDoc(), enabled: () => true });
    C.register('file:open', { run: () => BP.files.openDialog(), enabled: () => true });
    C.register('file:save', { run: () => BP.files.save(), enabled: () => !!doc() });
    C.register('file:saveAs', { run: () => BP.files.saveAs(), enabled: () => !!doc() });
    C.register('file:print', { run: () => doPrint('print'), enabled: () => !!doc() });
    C.register('file:pdf', { run: () => doPrint('pdf'), enabled: () => !!doc() });
    C.register('file:screenshot', { run: () => screenshotAsNew(), enabled: () => true });

    // Edit
    C.register('edit:undo', { run: () => { if (doc()) BP.undo.undo(doc()); }, enabled: () => BP.undo.canUndo() });
    C.register('edit:redo', { run: () => { if (doc()) BP.undo.redo(doc()); }, enabled: () => BP.undo.canRedo() });
    C.register('edit:cut', { run: () => BP.clipboard.cut(), enabled: () => BP.selection.has });
    C.register('edit:copy', { run: () => BP.clipboard.copy(), enabled: () => BP.selection.has });
    C.register('edit:paste', { run: () => BP.clipboard.paste(), enabled: () => !!doc() });
    C.register('edit:delete', { run: () => BP.clipboard.deleteSelection(), enabled: () => BP.selection.has });
    C.register('edit:selectAll', { run: () => { const d = doc(); if (d) BP.selection.setRect(0, 0, d.w, d.h); }, enabled: () => !!doc() });
    C.register('edit:deselect', { run: () => BP.selection.clear(), enabled: () => BP.selection.has });
    C.register('edit:selectByColor', { run: () => BP.ui.dialogs.selectByColor(), enabled: () => !!doc() });

    // Image
    C.register('image:resizeImage', { run: () => BP.ui.dialogs.resizeImage(), enabled: () => !!doc() });
    C.register('image:resizeCanvas', { run: () => BP.ui.dialogs.resizeCanvas(), enabled: () => !!doc() });
    C.register('image:rotateCW', { run: () => { if (doc()) BP.imageops.rotateCW(doc()); }, enabled: () => !!doc() });
    C.register('image:rotateCCW', { run: () => { if (doc()) BP.imageops.rotateCCW(doc()); }, enabled: () => !!doc() });
    C.register('image:rotate180', { run: () => { if (doc()) BP.imageops.rotate180(doc()); }, enabled: () => !!doc() });
    C.register('image:flipH', { run: () => { if (doc()) BP.imageops.flipH(doc()); }, enabled: () => !!doc() });
    C.register('image:flipV', { run: () => { if (doc()) BP.imageops.flipV(doc()); }, enabled: () => !!doc() });
    C.register('image:brightness', { run: () => BP.ui.dialogs.brightness(), enabled: () => !!doc() });
    C.register('image:negative', { run: () => { if (doc()) { BP.effects.negative(doc, true); BP.document.clearSelection(); } }, enabled: () => !!doc() });
    C.register('image:blur', { run: () => BP.ui.dialogs.blur(), enabled: () => !!doc() });
    C.register('image:sharpen', { run: () => { if (doc()) { BP.effects.sharpen(doc, true); BP.document.clearSelection(); } }, enabled: () => !!doc() });

    // View
    C.register('view:zoomIn', { run: () => { const c = stageCenter(); BP.view.zoomBy(1.25, c.x, c.y); }, enabled: () => !!doc() });
    C.register('view:zoomOut', { run: () => { const c = stageCenter(); BP.view.zoomBy(1 / 1.25, c.x, c.y); }, enabled: () => !!doc() });
    C.register('view:zoom100', { run: () => BP.view.zoom100(), enabled: () => !!doc() });
    C.register('view:zoomFit', { run: () => BP.view.fit(), enabled: () => !!doc() });
    C.register('view:theme', { run: () => toggleTheme() });
    C.register('view:sfx', { run: () => BP.sfx.toggle(), checked: () => BP.sfx.enabled });

    // Help
    C.register('help:about', { run: () => BP.ui.dialogs.about() });

    // Colors (options bar)
    C.register('colors:swap', { run: () => BP.colors.swap() });
    C.register('colors:custom', { run: (arg) => BP.ui.dialogs.customColor(arg) });

    // Tools
    for (const id of BP.tools.order) {
      C.register('tool:' + id, { run: () => BP.tools.set(id) });
    }
  }

  // ---- native menu ------------------------------------------------------
  let MENU_IDS = [];
  function recentItems() {
    const items = [];
    const recents = BP.files.recents;
    if (recents.length === 0) {
      items.push({ id: 'file:recent:empty', label: '(none)', enabled: false });
    }
    recents.forEach((p, i) => {
      const name = p.split(/[\\/]/).pop() || p;
      items.push({ id: 'file:recent:' + i, label: name, enabled: true });
    });
    return items;
  }
  async function buildMenu() {
    const recents = recentItems();
    const menus = [
      { title: 'File', items: [
        { id: 'file:new', label: 'New', key: 'n' },
        { id: 'file:open', label: 'Open…', key: 'o' },
        { id: 'file:save', label: 'Save', key: 's' },
        { id: 'file:saveAs', label: 'Save As…', key: 'S' },
        { id: 'file:recent', label: 'Recent', submenu: recents },
        { separator: true },
        { id: 'file:print', label: 'Print…' },
        { id: 'file:pdf', label: 'Export PDF…' },
        { id: 'file:screenshot', label: 'Screenshot as New…' },
      ] },
      { title: 'Edit', items: [
        { id: 'edit:undo', label: 'Undo', key: 'z' },
        { id: 'edit:redo', label: 'Redo', key: 'Z' },
        { separator: true },
        { id: 'edit:cut', label: 'Cut', key: 'x' },
        { id: 'edit:copy', label: 'Copy', key: 'c' },
        { id: 'edit:paste', label: 'Paste', key: 'v' },
        { id: 'edit:delete', label: 'Delete', key: 'Delete' },
        { id: 'edit:selectAll', label: 'Select All', key: 'a' },
        { id: 'edit:deselect', label: 'Deselect' },
        { id: 'edit:selectByColor', label: 'Select by Color…' },
      ] },
      { title: 'Image', items: [
        { id: 'image:resizeImage', label: 'Resize Image…' },
        { id: 'image:resizeCanvas', label: 'Resize Canvas…' },
        { separator: true },
        { id: 'image:rotateCW', label: 'Rotate 90° CW' },
        { id: 'image:rotateCCW', label: 'Rotate 90° CCW' },
        { id: 'image:rotate180', label: 'Rotate 180°' },
        { id: 'image:flipH', label: 'Flip Horizontal' },
        { id: 'image:flipV', label: 'Flip Vertical' },
        { separator: true },
        { id: 'image:brightness', label: 'Adjust Brightness…' },
        { id: 'image:negative', label: 'Negative' },
        { id: 'image:blur', label: 'Blur…' },
        { id: 'image:sharpen', label: 'Sharpen' },
      ] },
      { title: 'View', items: [
        { id: 'view:zoomIn', label: 'Zoom In', key: '=' },
        { id: 'view:zoomOut', label: 'Zoom Out', key: '-' },
        { id: 'view:zoom100', label: '100%', key: '0' },
        { id: 'view:zoomFit', label: 'Fit to Window', key: '1' },
        { separator: true },
        { id: 'view:theme', label: 'Toggle Theme' },
        { id: 'view:sfx', label: 'Sound Effects', checked: BP.sfx.enabled },
      ] },
      { title: 'Help', items: [
        { id: 'help:about', label: 'About Bainpaint' },
      ] },
    ];
    await tiny.menu.set(menus);
    // Collect every refreshable item id. Recent items are excluded — they are
    // rebuilt (with their own enabled state) when the recent list changes.
    MENU_IDS = [];
    const collect = (items) => {
      for (const it of items) {
        if (it.id && !it.id.startsWith('file:recent:')) MENU_IDS.push(it.id);
        if (it.submenu) collect(it.submenu);
      }
    };
    menus.forEach((m) => collect(m.items || []));
  }
  function refreshMenuStates() { BP.commands.refresh(MENU_IDS); }

  // Menu clicks (app menu). Recent items carry their path in `run`.
  function wireMenuEvents() {
    tiny.menu.on((id) => {
      if (id.startsWith('file:recent:')) {
        const i = +id.split(':').pop();
        const p = BP.files.recents[i];
        if (p) BP.files.openFile(p);
        return;
      }
      if (id === 'file:recent' || id === 'file:recent:empty') return;
      BP.commands.run(id);
    });
  }

  // ---- keyboard shortcuts (page-side, uniform) --------------------------
  const MOD = {
    n: 'file:new', o: 'file:open', s: 'file:save',
    z: 'edit:undo', x: 'edit:cut', c: 'edit:copy', v: 'edit:paste', a: 'edit:selectAll',
    '0': 'view:zoom100', '1': 'view:zoomFit', '=': 'view:zoomIn', '-': 'view:zoomOut',
  };
  const MOD_SHIFT = { s: 'file:saveAs', z: 'edit:redo' };
  const TOOL_KEYS = {};
  for (const id of BP.tools.order) {
    const t = BP.tools.registry[id];
    if (t && t.hotkey) TOOL_KEYS[t.hotkey.toLowerCase()] = id;
  }
  function wireShortcuts() {
    document.addEventListener('keydown', (e) => {
      if (e.target.closest && e.target.closest('input, textarea, select, [contenteditable="true"]')) return;
      const mod = e.ctrlKey || e.metaKey;
      if (mod) {
        // On macOS the native menu owns mod accelerators (and intercepts them),
        // so the page handler defers to avoid double-firing.
        if (tiny.system.isMacOS()) return;
        const k = e.key.toLowerCase();
        const cmd = (e.shiftKey ? MOD_SHIFT[k] : null) || MOD[k];
        if (cmd) { e.preventDefault(); BP.commands.run(cmd); }
        return;
      }
      const k = e.key.toLowerCase();
      if (k === 'escape') {
        const tool = BP.tools.activeTool;
        if (tool && tool.cancel) tool.cancel();
        if (BP.selection.has) BP.selection.clear();
      } else if (k === 'x') {
        BP.commands.run('colors:swap');
      } else if (e.key === 'Delete') {
        BP.commands.run('edit:delete');
      } else if (TOOL_KEYS[k]) {
        BP.commands.run('tool:' + TOOL_KEYS[k]);
      }
    });
  }

  // ---- print / PDF (T7.2) ----------------------------------------------
  async function doPrint(mode) {
    const doc = BP.doc;
    if (!doc) return;
    try {
      const paths = await tiny.app.paths();
      const tempPath = `${paths.data}/bp-print-${Date.now()}.png`;
      await BP.files.saveToPath(tempPath);
      let pdfPath = null;
      if (mode === 'pdf') {
        pdfPath = await tiny.dialog.saveFile({ types: ['pdf'], name: (doc.name || 'image') + '.pdf' });
        if (!pdfPath) return;
      }
      await tiny.api.call('setPrintJob', { path: tempPath, mode, pdfPath });
      await tiny.win.open('print', { page: 'print.html', size: '900x700', title: 'Print' });
    } catch (e) {
      tiny.dialog.alert('Print failed', { detail: String((e && e.message) || e) });
    }
  }

  // ---- screenshot to canvas (T7.3) -------------------------------------
  async function screenshotAsNew() {
    try {
      const cap = await tiny.app.captureScreen();
      const img = await BP.formats.loadImage(cap.path);
      let w = img.naturalWidth, h = img.naturalHeight;
      if (w > BP.MAX_DIM || h > BP.MAX_DIM) {
        const scale = Math.min(BP.MAX_DIM / w, BP.MAX_DIM / h);
        w = Math.max(1, Math.round(w * scale));
        h = Math.max(1, Math.round(h * scale));
      }
      const doc = BP.document.createDoc(w, h);
      doc.ctx.imageSmoothingEnabled = w !== cap.width;
      doc.ctx.drawImage(img, 0, 0, w, h);
      doc.name = 'Screenshot';
      BP.document.setDoc(doc);
      BP.view.fit();
      updateTitle();
    } catch (e) {
      tiny.dialog.alert('Screenshot unavailable', {
        detail: `The OS declined the capture (${String((e && e.message) || e)}). On Linux this can mean Wayland; on macOS grant Screen Recording.`,
      });
    }
  }

  // ---- state -> menu/title refresh -------------------------------------
  function wireStateRefresh() {
    const refresh = () => refreshMenuStates();
    BP.on('doc:changed', () => { refresh(); updateTitle(); });
    BP.on('doc:set', () => { refresh(); updateTitle(); });
    BP.on('undo:changed', refresh);
    BP.on('selection:changed', refresh);
    BP.on('sfx:changed', refresh);
    BP.on('recents:changed', () => { buildMenu().then(refresh); });
  }

  // ---- boot -------------------------------------------------------------
  async function boot() {
    const savedTheme = await tiny.store.get('theme').catch(() => null);
    applyTheme(savedTheme === 'light' ? 'light' : 'dark');

    registerCommands();
    await BP.sfx.init();
    await BP.colors.loadRecents();
    BP.files.init(); // registers drop + open-files listeners early
    await BP.files.loadRecents();

    await buildMenu();
    wireMenuEvents();
    wireShortcuts();
    wireStateRefresh();
    refreshMenuStates();

    tiny.win.setMinSize(900, 600);

    // Recovery or fresh doc.
    const autosave = await BP.files.checkAutosave();
    if (autosave) {
      const recover = await tiny.dialog.confirm('Recover unsaved document?', {
        detail: 'An autosave from a previous session was found.', ok: 'Recover', cancel: 'Discard',
      });
      if (recover) {
        await BP.files.openFile(autosave.path);
      } else {
        await BP.files._clearAutosave();
        await BP.files.newDoc(BP.DEFAULT_W, BP.DEFAULT_H);
      }
    } else {
      await BP.files.newDoc(BP.DEFAULT_W, BP.DEFAULT_H);
    }

    // Restore the last-used tool.
    const savedTool = await tiny.store.get('bp.tool').catch(() => null);
    BP.tools.set(savedTool && BP.tools.registry[savedTool] ? savedTool : 'pencil');

    updateTitle();
  }

  boot().catch((e) => {
    console.error('boot failed', e);
    tiny.dialog.alert('Bainpaint failed to start', { detail: String((e && e.message) || e) });
  });
})();
