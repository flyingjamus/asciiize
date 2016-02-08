import asciiize from './common/asciiize';
import messages from './common/messages';
import isEqual from 'lodash/isEqual';
import map from 'lodash/map';
import clamp from 'lodash/clamp';
import once from 'lodash/once';
import memoize from 'lodash/memoize';
import mutationSummary from 'mutation-summary';
import {waitForImage, loadImage} from './common/image-utils';
import WorkerQueue from './client/worker-queue';

let isOn = false;
let key;


const originalObjectUrlsCache = {};
const allObjectUrls = [];

function urlToObjectUrl(src) {
  chrome.runtime.sendMessage({ message: messages.beforeSend, src });
  return fetch(src, { mode: 'cors', credentials: 'include', headers: { asciiize: key } })
    .then(function(response) {
      return response.blob();
    })
    .then(function(imgBlob) {
      const objectURL = URL.createObjectURL(imgBlob, { autoRevoke: true });
      allObjectUrls.push(objectURL);
      return objectURL;
    });
}

function domToBlob(domString, {naturalWidth: width, naturalHeight: height}) {
  const data = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}">
              <foreignObject width="100%" height="100%">
              <div xmlns="http://www.w3.org/1999/xhtml">
              ${domString}
              </div>
              </foreignObject>
              </svg>`;

  return new Blob([data], { type: 'image/svg+xml;charset=utf-8' });
}

function processDomString(domString, options) {
  return domToBlob(getContainerString(domString, options), options)
}

function imageToCleanObjectUrl(image) {
  const src = image.src;
  if (!originalObjectUrlsCache[src]) {
    originalObjectUrlsCache[src] = urlToObjectUrl(src);
  }
  return originalObjectUrlsCache[src];
  //.then((objectURL) => loadImage(image, objectURL));
}

const DATA_REGEX = /^blob:|^data:/;
const FILE_REGEX = /^file:/;

const sources = new WeakMap();

function getImageDataInner(img, options) {
  return Promise.resolve()
    .then(() => {
      if (DATA_REGEX.test(img.src)) {
        //console.log(img.src, 'data');
        return img.src;
      } else if (FILE_REGEX.test(img.src)) {
        throw('We dont really deal with file urls');
      } else {
        //console.log(img.src, 'cors');
        return imageToCleanObjectUrl(img);
      }
    })
    .then(src => loadImage(document.createElement('img'), src))
    .then(image => {
      const hiddenCanvas = document.createElement('canvas');
      const {naturalWidth, naturalHeight, newWidth, newHeight} = options;
      hiddenCanvas.getContext('2d').drawImage(image, 0, 0, naturalWidth, naturalHeight, 0, 0, newWidth, newHeight);
      return hiddenCanvas.getContext('2d').getImageData(0, 0, newWidth, newHeight).data;
    })
}

function getImageData(img, options) {
  let source = sources.get(img);

  if (source && source.src === img.src) {
    return Promise.resolve(source.data);
  }

  source = {
    src: img.src,
    srcset: img.srcset,
    options: options
  };
  return getImageDataInner(img, options)
    .then((blob) => {
      source.data = blob;
      sources.set(img, source);
      return source.data;
    });
}

function returnBlobToSources(img, data) {
  let source = sources.get(img);
  if (source) {
    source.data = new Uint8ClampedArray(data.blob);
  }
  sources.set(img, source);
  return data;
}

function resetImg(img) {
  const source = sources.get(img);
  if (source) {
    source.options = false;
    sources.set(img, source);
    return loadImage(img, source.src, source.srcset);
  }
}

function measureFont(fontFamily, fontSize) {
  const iframe = getIframe();
  const container = iframe.contentDocument.body;
  const el = iframe.contentDocument.createElement('div');
  el.style.position = 'absolute';
  el.innerHTML = getContainerString('X', { fontFamily, fontSize, background: 'none', color: true });
  container.appendChild(el);
  const res = el.children[0].getBoundingClientRect();
  container.removeChild(el);
  return res;
}

const getFontDimensions = memoize(measureFont, (fontFamily, fontSize) => fontFamily + fontSize);

const DEFAULT_OPTIONS = {
  background: 'black',
  fontFamily: 'monospace',
  fontSize: [5, 15],
  fontCoefficient: 80,
  color: 'white',
  //color: true,
  //color: 'lightgreen',
  //contrast: 70,
  minWidth: 10,
  minHeight: 10,
  widthMinRatio: 0.7
};

const IFRAME_SRCDOC = `<!doctype html>
                        <html lang=en>
                        <meta charset=utf-8>
                        <title>Asciiize</title>
                        <body>
                        </body>
                        </html>`;

const getIframe = once(() => {
  const iframe = document.createElement('iframe');
  iframe.srcdoc = IFRAME_SRCDOC;
  iframe.style.width = 0;
  iframe.style.height = 0;
  iframe.style.border = 'none';
  document.body.appendChild(iframe);

  return iframe;
});

function getContainerString(content, options) {
  const color = options.color === true ? 'initial' : options.color;
  return `<div style="
            white-space: nowrap;
            margin-left: -1px;
            background: ${options.background};
            font: ${options.fontSize}px ${options.fontFamily};
            color: ${color};
            ">
              ${content}
          </div>`;
}

function createOptions(img) {
  const options = Object.assign({}, DEFAULT_OPTIONS, {
    naturalWidth: img.naturalWidth,
    naturalHeight: img.naturalHeight,
    offsetWidth: img.offsetWidth,
    offsetHeight: img.offsetHeight
  });

  if (Array.isArray(options.fontSize)) {
    const [minFont, maxFont] = options.fontSize;
    const ratio = options.naturalWidth / options.offsetWidth;
    options.fontSize = parseInt(clamp(options.naturalWidth / options.fontCoefficient, minFont * ratio, maxFont * ratio));
  }

  const {width: fontWidth, height: fontHeight} = getFontDimensions(options.fontFamily, options.fontSize);
  const newWidth = Math.ceil(options.naturalWidth / fontWidth);
  const newHeight = Math.ceil(options.naturalHeight / fontHeight);
  Object.assign(options, { newWidth, newHeight, fontWidth, fontHeight });

  return options;
}

function isAsciiized(img) {
  const source = sources.get(img);
  return source && img.src === source.objectUrl;
}

const workerQueue = WorkerQueue.create({ numWorkers: 8, workerUrl: chrome.extension.getURL('worker.js') });

function asciiizeInWorker(blob, options) {
  return workerQueue.enqueue({ message: messages.workerStart, blob: blob.buffer, options }, [blob.buffer])
}

function validateProcessingNeeded(img) {
  if (isAsciiized(img)) {
    return Promise.reject();
  }
  return Promise.resolve(img);
}

function setImageObjectUrl(img, blob) {
  const source = sources.get(img);
  const objectUrl = URL.createObjectURL(blob, { autoRevoke: true });
  allObjectUrls.push(objectUrl);
  if (source.objectUrl) {
    URL.revokeObjectURL(source.objectUrl);
  }
  source.objectUrl = objectUrl;
  return objectUrl;
}

function onAnimationFrame() {
  return new Promise(resolve => requestAnimationFrame(resolve));
  //return new Promise(resolve => setTimeout(resolve, 0));
}

function processImg(img) {
  let options;
  return onAnimationFrame()
    .then(() => validateProcessingNeeded(img))
    .then(loadImage)
    .then(createOptions)
    .then(_options => options = _options)
    .then(options => getImageData(img, options))
    .then(blob => asciiizeInWorker(blob, options))
    .then(data => returnBlobToSources(img, data))
    .then(data => data.result)
    .then(domString => processDomString(domString, options))
    .then(blob => setImageObjectUrl(img, blob))
    .then(objectUrl => loadImage(img, objectUrl))
    .catch(e => e ? console.log(e) : null);
}

function sequencePromises(arr, cb) {
  let promise = Promise.resolve();
  const res = map(arr, (v, i) => {
    promise = promise
      .then(()=> cb(v, i))
      .catch(()=> cb(v, i));
    return promise
  });
  promise.then(() => res);
  return promise;
}

function processAll() {
  //return sequencePromises(document.getElementsByTagName('img'), processImg);
  return Promise.resolve(map(document.getElementsByTagName('img'), processImg));
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
  stopObserver();
  observer = new mutationSummary({
    callback: (summaries) => {
      stopObserver()
      sequencePromises(summaries, summary => {
        const elements = summary.added.concat(summary.attributeChanged.src);
        return map(elements, processImg);
      }).then(observe)
    },
    queries: [{ element: 'img', elementAttributes: 'src' }]
  });
}

function doStart() {
  isOn = !isOn;
  if (isOn) {
    processAll().then(observe);
  } else {
    stopObserver();
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
      processImg(selected);
    }
  });

let selected;

window.addEventListener('contextmenu', e => selected = e.target);
window.addEventListener('unload', () => allObjectUrls.forEach(URL.revokeObjectURL.bind(URL)));