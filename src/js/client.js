import queue from 'minimal-queue';
import mutationSummary from 'mutation-summary';
import map from 'lodash/map';

import messages from './common/messages';
import {revokeObjectUrls, processImg, resetImg} from './client/image-processor';
import {setKey} from './client/image-data';

function processAll() {
  //return sequencePromises(document.getElementsByTagName('img'), processImg);
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


const q = queue.up((img) => requestAnimationFrame(() => processImg(img).then(q.done).catch(q.done)));
q.concurrency = 10;

let isOn = false;

function doStart() {
  isOn = !isOn;
  if (isOn) {
    observe();
    processAll()
  } else {
    stopObserver();
    resetAll();
  }
}

chrome.runtime.onMessage.addListener(
  function(request, sender, response) {
    if (request.key) {
      setKey(request.key);
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
window.addEventListener('unload', revokeObjectUrls);