export function waitForImage(img) {
  return new Promise((resolve, reject) => {
    if (img.complete) {
      return resolve(img);
    }

    function loadListener() {
      removeListeners();
      resolve(img);
    }

    function errorListener(e) {
      removeListeners();
      reject(e);
    }

    function removeListeners() {
      img.removeEventListener('load', loadListener);
      img.removeEventListener('error', errorListener);
    }

    img.addEventListener('load', loadListener);
    img.addEventListener('error', errorListener);
  });
}

export function loadImage(img, src, srcset) {
  if (src && img.src !== src || srcset && img.srcset !== srcset) {
    img.srcset = srcset || '';
    img.src = src;
  }
  return waitForImage(img);
}