// Bainpaint — command registry: the single dispatch path.
//
// Toolbar buttons, native menu items, and the keyboard shortcut registry all
// resolve to a command id and call run(). One code path for every action.
//
// A command = { id, run(arg), enabled()?, label?, key? }. `enabled()` is
// polled to drive menu/toolbar graying (BP.commands.refresh() pushes the
// states to the native menu).
(() => {
  const BP = (window.BP = window.BP || {});

  const commands = {
    _reg: {},

    register(id, cmd) {
      cmd.id = id;
      this._reg[id] = cmd;
      return cmd;
    },
    get(id) { return this._reg[id]; },
    all() { return this._reg; },

    isEnabled(id) {
      const c = this._reg[id];
      if (!c) return false;
      return c.enabled ? !!c.enabled() : true;
    },

    run(id, arg) {
      const c = this._reg[id];
      if (!c) return;
      if (c.enabled && !c.enabled()) return;
      try {
        c.run(arg);
      } catch (e) {
        console.error(`command ${id} failed`, e);
        BP.emit('error', e);
      }
    },

    // Push enabled/checked states for a set of ids to the native menu.
    async refresh(ids) {
      if (!window.tiny || !tiny.menu) return;
      for (const id of ids) {
        const c = this._reg[id];
        if (!c || c.menu === false) continue;
        const patch = { enabled: this.isEnabled(id) };
        if (typeof c.checked === 'function') patch.checked = !!c.checked();
        try { await tiny.menu.update(id, patch); } catch { /* menu may not have it */ }
      }
    },
  };

  BP.commands = commands;
})();
