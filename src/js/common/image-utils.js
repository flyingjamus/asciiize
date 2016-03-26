export function waitForImage(img) {
  return new Promise((resolve, reject) => {
    if (img.complete) {
      return img.naturalWidth ? resolve(img) : reject();
    }


    function loadListener() {
      removeListeners();
      resolve(img);
    }

    function errorListener(e) {
      removeListeners();
      reject(e);
    }

    const tOut = setTimeout(errorListener, 5000);

    function removeListeners() {
      clearTimeout(tOut);
      img.removeEventListener('load', loadListener);
      img.removeEventListener('error', errorListener);
    }

    img.addEventListener('load', loadListener);
    img.addEventListener('error', errorListener);


  });
}

export function setSrc(img, src, srcset) {
  if (srcset) {
    img.srcset = srcset;
  } else {
    img.removeAttribute('srcset');
  }
  img.src = src;
}

export function loadImage(img, src, srcset) {
  if (src && img.src !== src || srcset && img.srcset !== srcset) {
    setSrc(img, src, srcset)
  }
  return waitForImage(img);
}