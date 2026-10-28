// Bainpaint — tool registry + active-tool state.
//
// A tool = { id, name, icon, hotkey?, options[], down, move, up, preview?,
// cancel? }. Options drive the options bar. Tools draw to doc.ctx (doc coords);
// shape/text tools render ghosts via view.setDrawFn (screen coords).
(() => {
  const BP = (window.BP = window.BP || {});

  const tools = {
    registry: {},
    order: [],
    active: null,

    register(tool) {
      // Initialize option state from defaults.
      tool._state = tool._state || {};
      for (const opt of (tool.options || [])) {
        if (tool._state[opt.key] === undefined) tool._state[opt.key] = opt.default;
      }
      this.registry[tool.id] = tool;
      if (!this.order.includes(tool.id)) this.order.push(tool.id);
      BP.emit('tools:registered', tool);
      return tool;
    },
    get(id) { return this.registry[id]; },
    get activeTool() { return this.registry[this.active] || null; },

    set(id) {
      if (!this.registry[id]) return;
      // Remember the tool to return to after the eyedropper (classic behavior).
      if (id === 'eyedropper' && this.active && this.active !== 'eyedropper') {
        this._beforeEyedropper = this.active;
      }
      const prev = this.active;
      // Cancel any in-flight tool (e.g. an open curve/polygon).
      if (prev && this.registry[prev] && this.registry[prev].cancel) {
        try { this.registry[prev].cancel(); } catch (e) { console.error(e); }
      }
      this.active = id;
      BP.emit('tool:changed', { id, prev });
      // Persist the last-used tool.
      if (window.tiny && tiny.store) tiny.store.set('bp.tool', id).catch(() => {});
    },

    // The ctx handed to a tool's down/move/up/preview.
    makeCtx() {
      return {
        doc: BP.doc,
        view: BP.view,
        colors: BP.colors,
        selection: BP.selection,
        undo: BP.undo,
        runCommand: (id, arg) => BP.commands.run(id, arg),
      };
    },
  };

  BP.tools = tools;
})();
