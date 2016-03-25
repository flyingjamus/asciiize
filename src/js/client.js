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
  return map(document.getElementsByTagName('img'), resetImg);
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
const q = queue.up((img) => processImg(img, options).then(q.done).catch(q.done));

q.stop = function() {
  return new Promise((resolve, reject) => {
    if (this._running || this._pending.length) {
      this._pending.length = 0;
      this.allDone = () => {
        this.allDone = null;
        resolve();
      }
    } else {
      resolve();
    }
  });
};
q.concurrency = 4;

function doStart(_options) {
  stopObserver();
  q.stop()
    .then(() => {
      Object.assign(options, _options);
      processAll();
      observe();
    });
}

function doStop() {
  stopObserver();
  q.stop().then(resetAll);
}

let selected;

function unload() {
  stopObserver();
  revokeObjectUrls();
}

window.addEventListener('unload', unload);

chrome.runtime.onMessage.addListener((request, sender, cb) => {
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
    case messages.status:
      cb(1);
      break;
  }
});
