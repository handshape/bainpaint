const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"']/g,
  (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  $('icon-sun').classList.toggle('hidden', theme !== 'dark');
  $('icon-moon').classList.toggle('hidden', theme === 'dark');
}

async function init() {
  const saved = await tiny.store.get('theme').catch(() => null);
  applyTheme(saved === 'light' ? 'light' : 'dark');

  const hello = await tiny.api.call('hello', { name: 'Bainpaint' });
  const info = await tiny.api.call('sysinfo');
  $('backend-status').classList.remove('opacity-70');
  $('backend-status').querySelector('.loading').outerHTML =
    '<span class="size-2 rounded-full bg-success"></span>';
  $('backend-status-text').textContent =
    `${tiny.system.os()} · ${esc(info.user)} · backend up`;

  $('theme-toggle').addEventListener('click', () => {
    const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    applyTheme(next);
    tiny.store.set('theme', next).catch(() => {});
  });

  $('hello').addEventListener('click', async () => {
    const r = await tiny.api.call('hello', { name: 'Bainpaint' });
    const out = $('hello-out');
    out.classList.remove('hidden');
    out.textContent = r;
  });

  $('quit').addEventListener('click', () => tiny.quit());

  lucide.createIcons();
}

init().catch((e) => {
  $('backend-status-text').textContent = 'backend error: ' + e;
});
