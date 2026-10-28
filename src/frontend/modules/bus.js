// Bainpaint — module bus + namespace bootstrap.
//
// First script loaded (after lib/). Creates the shared `window.BP` namespace
// with a tiny event emitter that glues the modules together. Every later
// module attaches its state/handlers onto `window.BP`.
(() => {
  const BP = (window.BP = window.BP || {});

  const listeners = {};
  BP.on = (event, fn) => {
    (listeners[event] = listeners[event] || []).push(fn);
    return () => BP.off(event, fn);
  };
  BP.off = (event, fn) => {
    const arr = listeners[event];
    if (!arr) return;
    const i = arr.indexOf(fn);
    if (i >= 0) arr.splice(i, 1);
  };
  BP.emit = (event, payload) => {
    const arr = listeners[event];
    if (!arr) return;
    // Copy so handlers may unsubscribe during dispatch.
    for (const fn of arr.slice()) fn(payload);
  };

  // Hard canvas limit (plan §1).
  BP.MAX_DIM = 4096;
  BP.DEFAULT_W = 800;
  BP.DEFAULT_H = 600;

  // HTML escaping for anything interpolated into innerHTML.
  BP.esc = (s) => String(s).replace(/[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
})();
