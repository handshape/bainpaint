// Bainpaint — image format decode (fileURL -> Image) + BMP encode wrapper.
//
// Opening never sends bytes over the bridge: the page loads the image itself
// via tiny.fileURL(path) + <img>. The 4096 cap check lives in files.js.
(() => {
  const BP = (window.BP = window.BP || {});

  BP.formats = {
    // Load a disk path into an HTMLImageElement.
    loadImage(path) {
      return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error('Could not decode image: ' + path));
        img.src = tiny.fileURL(path);
      });
    },

  };
})();
