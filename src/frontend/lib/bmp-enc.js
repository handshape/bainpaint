// Bainpaint — 24-bit BMP encoder (pure, no DOM).
//
// Probeable: attaches to globalThis.BPLib; a tjs probe imports this file by
// absolute path (side effect) and reads globalThis.BPLib.encodeBMP.
//
// Produces a minimal uncompressed 24-bit bottom-up BMP: 54-byte header
// (14-byte BITMAPFILEHEADER + 40-byte BITMAPINFOHEADER) followed by BGR rows
// with each row padded to a multiple of 4 bytes.
(() => {
  const BPLib = (globalThis.BPLib = Object.assign({}, globalThis.BPLib));

  /**
   * Encode a flat RGBA buffer as a 24-bit BMP.
   *
   * @param {Uint8ClampedArray|Uint8Array} rgba flat RGBA, length w*h*4
   * @param {number} width
   * @param {number} height
   * @returns {Uint8Array} the BMP file bytes
   */
  function encodeBMP(rgba, width, height) {
    const rowSize = (width * 3 + 3) & ~3; // pad to 4-byte boundary
    const imageSize = rowSize * height;
    const fileSize = 54 + imageSize;
    const out = new Uint8Array(fileSize);
    const dv = new DataView(out.buffer);

    // BITMAPFILEHEADER (14 bytes)
    out[0] = 0x42; // 'B'
    out[1] = 0x4d; // 'M'
    dv.setUint32(2, fileSize, true);  // file size
    dv.setUint32(6, 0, true);         // reserved
    dv.setUint32(10, 54, true);       // pixel data offset

    // BITMAPINFOHEADER (40 bytes)
    dv.setUint32(14, 40, true);       // header size
    dv.setInt32(18, width, true);     // width (positive = bottom-up)
    dv.setInt32(22, height, true);    // height
    dv.setUint16(26, 1, true);        // planes
    dv.setUint16(28, 24, true);       // bits per pixel
    dv.setUint32(30, 0, true);        // compression (BI_RGB)
    dv.setUint32(34, imageSize, true); // image size
    dv.setUint32(38, 0, true);        // x pixels/meter
    dv.setUint32(42, 0, true);        // y pixels/meter
    dv.setUint32(46, 0, true);        // colors used
    dv.setUint32(50, 0, true);        // important colors

    // Pixel data: bottom-up, BGR, row-padded (padding bytes stay 0).
    for (let y = 0; y < height; y++) {
      const srcY = height - 1 - y;
      const dst = 54 + y * rowSize;
      for (let x = 0; x < width; x++) {
        const s = (srcY * width + x) * 4;
        out[dst + x * 3 + 0] = rgba[s + 2]; // B
        out[dst + x * 3 + 1] = rgba[s + 1]; // G
        out[dst + x * 3 + 2] = rgba[s];     // R
      }
    }

    return out;
  }

  BPLib.encodeBMP = encodeBMP;
})();
