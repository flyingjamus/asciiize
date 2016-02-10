import {loadImage} from '../common/image-utils';
import messages from '../common/messages';

const originalObjectUrlsCache = {};
const allObjectUrls = [];

let key;
function setKey(_key) {
  key = _key;
}
function revokeObjectUrls() {
  allObjectUrls.forEach(allObjectUrls.forEach(URL.revokeObjectURL.bind(URL)));
}

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
    })
}

function createCORSImage(image) {
  const src = image.currentSrc || image.src;
  if (!originalObjectUrlsCache[src]) {
    originalObjectUrlsCache[src] = urlToObjectUrl(src);
  }
  return originalObjectUrlsCache[src].then(objectUrl => loadImage(document.createElement('img'), objectUrl));
}

const FILE_REGEX = /^file:/;
const DATA_REGEX = /^blob:|^data:/;

function getImageDataInner(img, options) {
  return Promise.resolve()
    .then(() => {
      const hiddenCanvas = document.createElement('canvas');
      const {naturalWidth, naturalHeight, newWidth, newHeight} = options;
      hiddenCanvas.getContext('2d').drawImage(img, 0, 0, naturalWidth, naturalHeight, 0, 0, newWidth, newHeight);
      return hiddenCanvas.getContext('2d').getImageData(0, 0, newWidth, newHeight).data;
    })
}

function getImageData(img, options) {
  return getImageDataInner(img, options)
    .catch(() => {
      return createCORSImage(img)
        .then(newImg => getImageDataInner(newImg, options));
    });
}


export { getImageData, revokeObjectUrls, setKey };
