// Bainpaint — BMP encode (page-side wrapper over the pure lib).
(() => {
  const BP = (window.BP = window.BP || {});
  BP.formats = BP.formats || {};

  // Encode a canvas as a 24-bit BMP (pure lib). Returns a Uint8Array.
  BP.formats.encodeBMP = (canvas) => {
    const data = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
    return window.BPLib.encodeBMP(data, canvas.width, canvas.height);
  };
})();
