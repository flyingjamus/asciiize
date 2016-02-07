import messages from './common/messages';
import randomstring from 'randomstring';
import findIndex from 'lodash/findIndex';

const key = randomstring.generate();

function messageCurrentTab(message, cb) {

  chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
    var id = tabs[0].id;

    function cbWrapper(response) {
      if (cb) {
        cb(response, id);
      }
    }

    chrome.tabs.sendMessage(id, message, cbWrapper);
  });
}

function setBadge(response = {}, tabId) {
  const path = response.isOn ? 'assets/icon_active.png' : 'assets/icon.png';
  chrome.browserAction.setIcon({tabId, path})
}

chrome.browserAction.onClicked.addListener(() => {
  messageCurrentTab({ message: messages.start, key: key }, setBadge);
});

chrome.contextMenus.create({
  title: 'Asciiize',
  contexts: ['image'],
  onclick: messageCurrentTab.bind(null, { message: messages.single, key: key })
});

const requestsToCapture = {};

function attachRequestListener(src) {
  let listener = function(details) {
    const headerIndex = findIndex(details, { name: 'asciiize' });
    if (headerIndex > -1) {
      requestsToCapture[details.requestId] = true;
      chrome.webRequest.onBeforeSendHeaders.removeListener(listener, { urls: [src] });
      console.log(details.requestHeaders[headerIndex]);
      details.requestHeaders.splice(headerIndex, 1);
      return { requestHeaders: details.requestHeaders };
    }
  };
  chrome.webRequest.onBeforeSendHeaders.addListener(listener, { urls: [src] }, ['blocking', 'requestHeaders']);
}

const CORS_RULE = {
  name: 'Access-Control-Allow-Origin',
  value: '*'
};

function attachResponseListener(src) {
  let listener = function(details) {
    if (requestsToCapture[details.requestId]) {
      chrome.webRequest.onHeadersReceived.removeListener(listener, { urls: [src] });
      delete requestsToCapture[details.requestId];
      details.responseHeaders.push(CORS_RULE);
      return { responseHeaders: details.responseHeaders };
    }
  };
  chrome.webRequest.onHeadersReceived.addListener(listener, { urls: [src] }, ['blocking', 'responseHeaders']);
}

chrome.runtime.onMessage.addListener(request => {
  if (request.message === messages.beforeSend) {
    attachRequestListener(request.src);
    attachResponseListener(request.src);
  }
});

