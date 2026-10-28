// Bainpaint — toolbar (left vertical rail of tool buttons).
(() => {
  const BP = (window.BP = window.BP || {});
  const ORDER = ['select', 'pencil', 'brush', 'eraser', 'fill', 'spray',
    'line', 'curve', 'rect', 'ellipse', 'polygon', 'text', 'eyedropper', 'magnifier'];

  const toolbar = {
    el: null,

    init(container) {
      this.el = container;
      this.el.innerHTML = '';
      for (const id of ORDER) {
        const tool = BP.tools.registry[id];
        if (!tool) continue;
        const btn = document.createElement('button');
        btn.className = 'bp-tool-btn btn btn-sm btn-square';
        btn.dataset.tool = id;
        btn.title = `${tool.name}${tool.hotkey ? ' (' + tool.hotkey + ')' : ''}`;
        btn.setAttribute('aria-label', tool.name);
        const icon = document.createElement('i');
        icon.setAttribute('data-lucide', tool.icon);
        icon.className = 'size-4';
        btn.appendChild(icon);
        btn.addEventListener('click', () => BP.commands.run('tool:' + id));
        this.el.appendChild(btn);
      }
      lucide.createIcons();
      this.setActive(BP.tools.active);
      BP.on('tool:changed', ({ id }) => this.setActive(id));
    },

    setActive(id) {
      if (!this.el) return;
      for (const btn of this.el.querySelectorAll('.bp-tool-btn')) {
        btn.classList.toggle('active', btn.dataset.tool === id);
      }
    },
  };

  BP.ui = BP.ui || {};
  BP.ui.toolbar = toolbar;
})();
