import messages from './messages';
import randomstring from 'randomstring';
import {findIndex} from 'lodash';

const key = randomstring.generate();

function messageCurrentTab(message) {
  chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
    chrome.tabs.sendMessage(tabs[0].id, message);
  });
}

chrome.browserAction.onClicked.addListener(() => {
  messageCurrentTab({ message: messages.start, key: key });
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
    console.log(request.src)
    attachRequestListener(request.src);
    attachResponseListener(request.src);
  }
});

