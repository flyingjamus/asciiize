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

function imageToCleanObjectUrl(image) {
  const src = image.src;
  if (!originalObjectUrlsCache[src]) {
    originalObjectUrlsCache[src] = urlToObjectUrl(src);
  }
  return originalObjectUrlsCache[src];
}

const FILE_REGEX = /^file:/;
const DATA_REGEX = /^blob:|^data:/;

function getImageData(img, options) {
  return Promise.resolve()
    .then(() => {
      if (DATA_REGEX.test(img.src)) {
        return img.src;
      } else if (FILE_REGEX.test(img.src)) {
        throw('We dont really deal with file urls');
      } else {
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


export { getImageData, revokeObjectUrls, setKey };
