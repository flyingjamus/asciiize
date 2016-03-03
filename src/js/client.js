import queue from 'minimal-queue';
import mutationSummary from 'mutation-summary';
import map from 'lodash/map';

import messages from './common/messages';
import {revokeObjectUrls, processImg, resetImg} from './client/image-processor';
import {setKey} from './client/image-data';

function processAll() {
  map(document.getElementsByTagName('img'), q.enqueue);
}

function resetAll() {
  return map(document.getElementsByTagName('img'), img => requestAnimationFrame(() => resetImg(img)));
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
      summaries.forEach(summary => {
        const elements = summary.added.concat(summary.attributeChanged.src);
        return map(elements, q.enqueue);
      });
    },
    queries: [{ element: 'img', elementAttributes: 'src' }]
  });
}

let options = {};
const q = queue.up((img) => requestAnimationFrame(() => processImg(img, options).then(q.done).catch(q.done)));
q.concurrency = 10;

function doStart(_options) {
  Object.assign(options, _options);
  observe();
  processAll();
}

function doStop() {
  stopObserver();
  resetAll();
}

chrome.runtime.onMessage.addListener(
  function(request) {
    if (request.key) {
      setKey(request.key);
    }
    switch (request.message) {
      case messages.start:
        doStart(request.options);
        break;
      case messages.stop:
        doStop();
        break;
      case messages.single:
        if (selected) {
          processImg(selected, request.options);
        }
        break;
    }
  })
;

let selected;

window.addEventListener('contextmenu', e => selected = e.target);
window.addEventListener('unload', revokeObjectUrls);