// Bainpaint — options bar (context-dependent per active tool + color controls).
(() => {
  const BP = (window.BP = window.BP || {});

  const optionsbar = {
    el: null,
    _swatches: null,

    init(container) {
      this.el = container;
      this._render();
      BP.on('tool:changed', () => this._render());
      BP.on('colors:changed', () => this._updateColors());
    },

    _render() {
      this.el.innerHTML = '';
      const tool = BP.tools.activeTool;

      // Per-tool options.
      if (tool && tool.options && tool.options.length) {
        for (const opt of tool.options) this._addOption(tool, opt);
        const sep = document.createElement('div');
        sep.className = 'divider divider-horizontal divider-sm mx-2';
        this.el.appendChild(sep);
      }

      // Primary/secondary swatches + swap + custom color.
      const colors = document.createElement('div');
      colors.className = 'flex items-center gap-1';

      const swap = document.createElement('button');
      swap.className = 'bp-swatch bp-swap btn btn-ghost btn-sm btn-circle';
      swap.title = 'Swap colors (X)';
      swap.textContent = '⇄';
      swap.addEventListener('click', () => BP.commands.run('colors:swap'));
      colors.appendChild(swap);

      this._sec = document.createElement('button');
      this._sec.className = 'bp-swatch btn btn-sm btn-circle';
      this._sec.title = 'Secondary (background) color';
      this._sec.addEventListener('click', () => BP.commands.run('colors:custom', 'secondary'));
      colors.appendChild(this._sec);

      this._pri = document.createElement('button');
      this._pri.className = 'bp-swatch btn btn-sm btn-circle';
      this._pri.title = 'Primary (foreground) color';
      this._pri.addEventListener('click', () => BP.commands.run('colors:custom', 'primary'));
      colors.appendChild(this._pri);

      this.el.appendChild(colors);
      this._updateColors();
      lucide.createIcons();
    },

    _updateColors() {
      if (!this._pri) return;
      this._pri.style.background = BP.colors.primary;
      this._sec.style.background = BP.colors.secondary;
      this._pri.classList.add('ring-2', 'ring-offset-1', 'ring-base-content');
      this._sec.classList.remove('ring-2', 'ring-offset-1', 'ring-base-content');
    },

    _addOption(tool, opt) {
      const val = tool._state[opt.key];
      const wrap = document.createElement('label');
      wrap.className = 'bp-opt flex items-center gap-2 text-sm';
      const label = document.createElement('span');
      label.textContent = opt.label;
      label.className = 'opacity-70 whitespace-nowrap';
      wrap.appendChild(label);

      if (opt.type === 'slider') {
        const input = document.createElement('input');
        input.type = 'range';
        input.className = 'range range-xs range-primary w-24';
        input.min = opt.min; input.max = opt.max; input.step = opt.step; input.value = val;
        const out = document.createElement('span');
        out.className = 'opt-val w-8 text-right tabular-nums';
        out.textContent = val;
        input.addEventListener('input', () => {
          tool._state[opt.key] = +input.value;
          out.textContent = input.value;
        });
        wrap.appendChild(input);
        wrap.appendChild(out);
      } else if (opt.type === 'select') {
        const sel = document.createElement('select');
        sel.className = 'select select-xs select-bordered w-40';
        for (const v of opt.values) {
          const o = document.createElement('option');
          o.value = v; o.textContent = v;
          if (v === val) o.selected = true;
          sel.appendChild(o);
        }
        sel.addEventListener('change', () => { tool._state[opt.key] = sel.value; });
        wrap.appendChild(sel);
      } else if (opt.type === 'toggle') {
        const input = document.createElement('input');
        input.type = 'checkbox';
        input.className = 'toggle toggle-primary toggle-sm';
        input.checked = !!val;
        input.addEventListener('change', () => { tool._state[opt.key] = input.checked; });
        wrap.appendChild(input);
      }
      this.el.appendChild(wrap);
    },
  };

  BP.ui = BP.ui || {};
  BP.ui.optionsbar = optionsbar;
})();
