import clamp from 'lodash/clamp';
import once from 'lodash/once';
import memoize from 'lodash/memoize';
import isEqual from 'lodash/isEqual'

import messages from '../common/messages';
import {waitForImage, loadImage, setSrc} from '../common/image-utils';
import WorkerQueue from '../client/worker-queue';
import {getImageData, revokeObjectUrls as imageDataRevoke} from '../client/image-data';
import sources from '../client/dom-sources'

function domToDataUrl(domString, {naturalWidth: width, naturalHeight: height}) {
  return `data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}">
              <foreignObject width="100%" height="100%">
              <div xmlns="http://www.w3.org/1999/xhtml">
              ${domString}
              </div>
              </foreignObject>
              </svg>`.replace(/\r?\n|\r/g, '');
}

function processDomString(domString, options) {
  return domToDataUrl(getContainerString(domString, options), options)
}


function getAndSetBlob(img, options) {
  let source = sources.get(img);
  if (source && source.data) {
    return Promise.resolve(source.data);
  } else {
    source = {
      src: img.currentSrc,
      srcset: img.srcset,
      options: options,
      el: img
    };
    sources.set(img, source);
    return getImageData(img, options)
      .then(blob => {
        source.data = blob;
        return blob;
      })
      .catch(() => {
        source.failed = true;
        return Promise.reject();
      });
  }
}


function returnBlobToSources(img, data) {
  let source = sources.get(img);
  if (source) {
    source.data = new Uint8ClampedArray(data.blob);
  }
  return data;
}

function measureFont(fontFamily, fontSize) {
  const iframe = getIframe();
  const container = iframe.contentDocument.body;
  const el = iframe.contentDocument.createElement('div');
  el.style.position = 'absolute';
  el.innerHTML = getContainerString('X', { fontFamily, fontSize, background: 'none' });
  container.appendChild(el);
  const res = el.children[0].getBoundingClientRect();
  container.removeChild(el);
  return res;
}

const getFontDimensions = memoize(measureFont, (fontFamily, fontSize) => fontFamily + fontSize);

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

function createOptions(inOptions, img) {
  const options = Object.assign({}, inOptions, {
    naturalWidth: img.naturalWidth,
    naturalHeight: img.naturalHeight,
    offsetWidth: img.offsetWidth,
    offsetHeight: img.offsetHeight,
    color: inOptions.colorType !== 'single' ? true : inOptions.colorValue
  });
  if (img.naturalWidth < 5 || img.naturalHeight < 5) {
    return Promise.reject();
  }

  if (Array.isArray(options.fontSize)) {
    const [minFont, maxFont] = options.fontSize;
    const ratio = options.offsetWidth ? options.naturalWidth / options.offsetWidth : 1;
    options.fontSize = parseInt(clamp(options.naturalWidth / options.fontCoefficient, minFont * ratio, maxFont * ratio));
  }

  const {width: fontWidth, height: fontHeight} = getFontDimensions(options.fontFamily, options.fontSize);
  const newWidth = Math.ceil(options.naturalWidth / fontWidth);
  const newHeight = Math.ceil(options.naturalHeight / fontHeight);
  Object.assign(options, { newWidth, newHeight, fontWidth, fontHeight });

  return Promise.resolve(options);
}

function isAsciiized(img, options) {
  const source = sources.get(img);
  return source && (source.failed || (img.src === source.objectUrl && isEqual(options, source.options)));
}

const workerQueue = WorkerQueue.create({ numWorkers: 4, workerUrl: chrome.extension.getURL('worker.js') });

function asciiizeInWorker(blob, options) {
  return workerQueue.enqueue({ message: messages.workerStart, blob: blob.buffer, options }, [blob.buffer])
}

function validateProcessingNeeded(img, options) {
  return isAsciiized(img, options) ? Promise.reject() : Promise.resolve(img);
}

function setImageObjectUrl(img, url) {
  const source = sources.get(img);
  source.objectUrl = url;
  return url;
}

function getAsciiizedObjectUrl(img, options) {
  const source = sources.get(img);
  if (source) {
    var sameSrc = source.src === img.currentSrc || source.objectUrl === img.currentSrc;
    if (sameSrc) {
      if (isEqual(options, source.options)) {
        return Promise.resolve(source.objectUrl);
      }
    } else {
      source.data = null;
    }
    source.options = options;
  }

  return getAndSetBlob(img, options)
    .then(blob => asciiizeInWorker(blob, options))
    .then(data => returnBlobToSources(img, data))
    .then(data => data.result)
    .then(domString => processDomString(domString, options))
    .then(blob => setImageObjectUrl(img, blob))
}

function loadAsciiizedImage(img, objectUrl) {
  if (document.querySelector('body[style]') && document.getElementsByTagName('img').length === 1) {
    window.open(objectUrl);
  } else {
    setSrc(img, objectUrl)
  }
}

function processImg(img, options) {
  return validateProcessingNeeded(img, options)
    .then(loadImage)
    .then(createOptions.bind(null, options))
    .then(options => getAsciiizedObjectUrl(img, options))
    .then(objectUrl => loadAsciiizedImage(img, objectUrl))
    .catch(e => e ? console.log(e) : null);
}

function resetImg(img) {
  const source = sources.get(img);
  if (source) {
    source.options = false;
    return loadImage(img, source.src, source.srcset);
  }
}

function revokeObjectUrls() {
  imageDataRevoke();
}

export {processImg, resetImg, revokeObjectUrls}