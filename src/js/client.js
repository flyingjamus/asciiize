import asciiize from './asciiize';
import messages from './messages';
import isEqual from 'lodash/isEqual';
import reduce from 'lodash/reduce';
import mutationSummary from 'mutation-summary';

let isOn = false;
let key;

function waitForImage(img) {
  return new Promise((resolve, reject) => {
    function loadListener() {
      removeListeners();
      resolve();
    }

    function errorListener(e) {
      removeListeners();
      reject();
    }

    function removeListeners() {
      img.removeEventListener('load', loadListener);
      img.removeEventListener('error', errorListener);
    }

    img.addEventListener('load', loadListener);
    img.addEventListener('error', errorListener);
  });
}

function loadImage(img, src, srcset) {
  return Promise.resolve()
    .then(() => {
      if (src && img.src !== src || srcset && img.srcset !== srcset) {
        setTimeout(() => {
          img.srcset = srcset || '';
          img.src = src;
        }, 0);
        return waitForImage(img);
      } else if (!img.complete) {
        return waitForImage(img);
      }
    })
    .then(() => img);
}

const objectURLCache = {};

function urlToObjectUrl(src) {
  chrome.runtime.sendMessage({ message: messages.beforeSend, src });
  return fetch(src, { mode: 'cors', credentials: 'include', headers: { asciiize: key } })
    .then(function(response) {
      return response.blob();
    })
    .then(function(imgBlob) {
      return URL.createObjectURL(imgBlob);
    });
}

function urlSrcToBlobWithCache(image) {
  const src = image.src;
  return Promise.resolve()
    .then(() => {
      if (!objectURLCache[src]) {
        objectURLCache[src] = urlToObjectUrl(src);
      }
      return objectURLCache[src];
    })
    .then((objectURL) => loadImage(image, objectURL));
}

const DATA_REGEX = /^blob:|^data:/;
const FILE_REGEX = /^file:/;
function noop() {
}

const sources = new WeakMap();

function normalizeImage(img) {
  return Promise.resolve()
    .then(() => {
      if (DATA_REGEX.test(img.src)) {
        //console.log(img.src, 'data');
        return img;
      } else if (FILE_REGEX.test(img.src)) {
        throw('We dont really deal with file urls');
      } else {
        //console.log(img.src, 'cors');
        return urlSrcToBlobWithCache(img);
      }
    });
}

const options = {
  minWidth: 10,
  minHeight: 10
};

function resetImg(img) {
  const source = sources.get(img);
  if (source) {
    source.options = false;
    sources.set(img, source);
    return loadImage(img, source.src, source.srcset);
  }
}

function processImg(img) {
  let source = sources.get(img);

  var newOptions = Object.assign({ width: img.offsetWidth, height: img.offsetHeight }, options);
  if (source && isEqual(newOptions, source.options) && img.src && img.src[0] === 'data') {
    return Promise.resolve();
  }

  return loadImage(img)
    .then(() => {
      if (source) {
        return loadImage(img, source.data)
      }

      source = {
        src: img.src,
        srcset: img.srcset,
        options: newOptions
      };
      return normalizeImage(img)
        .then(() => {
          source.data = img.src;
          sources.set(img, source);
        });
    })
    .then(() => asciiize(img, options))
    .catch(e => {
      console.log(e)
    });
}

function sequencePromises(arr, cb) {
  return reduce(arr, (promise, item, i) => {
    return promise
      .then(() => cb(item, i))
      .catch((e) => {
        return cb(item, i)
      });
  }, Promise.resolve());
}

function processAll() {
  return sequencePromises(document.getElementsByTagName('img'), processImg);
}

function resetAll() {
  return sequencePromises(document.getElementsByTagName('img'), resetImg);
}

let observer;

function stopObserver() {
  if (observer) {
    observer.disconnect();
    observer = null;
  }
}

function observe() {
  stopObserver()
  observer = new mutationSummary({
    callback: (summaries) => {
      stopObserver()
      sequencePromises(summaries, summary => {
        const elements = summary.added.concat(summary.attributeChanged.src)
        return sequencePromises(elements, processImg);
      })
        .then(observe)
    },
    queries: [{ element: 'img', elementAttributes: 'src' }]
  });
}

function doStart() {
  isOn = !isOn;
  stopObserver();
  if (isOn) {
    processAll().then(observe);
  } else {
    resetAll();
  }
}

chrome.runtime.onMessage.addListener(
  function(request, sender, response) {
    if (request.key) {
      key = request.key;
    }
    if (request.message === messages.start) {
      doStart();
      if (response) {
        response({ isOn });
      }
    } else if (request.message === messages.single && selected) {
      processImg(selected, request.key);
    }
  });

let selected;

window.addEventListener('contextmenu', function(e) {
  selected = e.target;
});