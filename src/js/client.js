import asciiize from './asciiize';
import messages from './messages';

function loadImage(img, src) {
  return new Promise(function(resolve, reject) {
    img.onload = ()=> resolve(img);
    img.onerror = reject;
    img.src = src;
    return img;
  });
}

function urlSrcToBlob(image, key) {
  const src = image.src;
  chrome.runtime.sendMessage({ message: messages.beforeSend, src });
  let objectURL;
  return fetch(src, { mode: 'cors', credentials: 'include', headers: { asciiize: key } })
    .then(function(response) {
      return response.blob();
    })
    .then(function(imgBlob) {

      objectURL = URL.createObjectURL(imgBlob);
      return loadImage(image, objectURL)
    })
    .then(function(img) {
      URL.revokeObjectURL(objectURL);
      return img;
    });
}

const DATA_REGEX = /^blob:|^data:/;
function noop() {
}

function processImg(img, key) {
  Promise.resolve()
    .then(() => {
      if (DATA_REGEX.test(img.src)) {
        console.log(img.src, 'data');
        return img;
      } else {
        console.log(img.src, 'cors');
        return urlSrcToBlob(img, key);
      }
    })
    .then(asciiize)
    .catch(noop);
}

chrome.runtime.onMessage.addListener(
  function(request, sender, response) {
    if (request.message === messages.start) {
      _.forEach(document.getElementsByTagName('img'), img => processImg(img, request.key));
    } else if (request.message === messages.single && selected) {
      processImg(selected, request.key);
    }
  });

let selected;

window.addEventListener('contextmenu', function(e) {
  selected = e.target;
});