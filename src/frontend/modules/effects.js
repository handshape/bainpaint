// Bainpaint — image effects (module): brightness/negative/blur/sharpen.
//
// Wraps the pure BPLib.effects pixel math with the canvas + a single undo
// entry per committed op. `commit=false` applies in place without an undo
// entry (used for the brightness dialog's live preview).
(() => {
  const BP = (window.BP = window.BP || {});

  function apply(doc, label, mutate, commit) {
    const img = doc.ctx.getImageData(0, 0, doc.w, doc.h);
    if (commit) BP.undo.snapshotData(doc, new Uint8ClampedArray(img.data), label);
    mutate(img.data, doc.w, doc.h);
    doc.ctx.putImageData(img, 0, 0);
    if (commit) BP.document.markModified(doc);
  }

  BP.effects = {
    // amount: -100..100
    brightness(doc, amount, commit) {
      apply(doc, 'brightness', (data, w, h) =>
        window.BPLib.effects.brightness(data, (amount / 100) * 255), commit);
    },
    negative(doc, commit) {
      apply(doc, 'negative', (data) => window.BPLib.effects.negative(data), commit);
    },
    // radius: 1..20
    blur(doc, radius, commit) {
      apply(doc, 'blur', (data, w, h) =>
        window.BPLib.effects.blur(data, w, h, radius), commit);
    },
    sharpen(doc, commit) {
      apply(doc, 'sharpen', (data, w, h) =>
        window.BPLib.effects.sharpen(data, w, h), commit);
    },
  };
})();
