import findIndex from 'lodash/findIndex';
import messages from './common/messages';
import messageCurrentTab from './common/message-current-tab'

const requestsToCapture = {};

function attachRequestListener(src) {
  let listener = function(details) {
    const headerIndex = findIndex(details, { name: 'asciiize' });
    if (headerIndex > -1) {
      requestsToCapture[details.requestId] = true;
      chrome.webRequest.onBeforeSendHeaders.removeListener(listener, { urls: [src] });
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

const DEFAULT_OPTIONS = {
  background: 'black',
  fontFamily: 'monospace',
  fontSize: [5, 15],
  fontCoefficient: 80,
  //color: 'white',
  //color: true,
  colorType: 'full',
  colorValue: 'white',
  //contrast: 70,
  minWidth: 10,
  minHeight: 10,
  widthMinRatio: 0.7
};

function getOptions() {
  return new Promise(resolve => chrome.storage.local.get(DEFAULT_OPTIONS, resolve));
}

function setOptions(options) {
  return new Promise(resolve => chrome.storage.local.set(options, resolve));
}

function resetOptions() {
  return new Promise(resolve => chrome.storage.local.set(DEFAULT_OPTIONS, resolve));
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  switch (request.message) {
    case messages.beforeSend:
      attachRequestListener(request.src);
      attachResponseListener(request.src);
      break;
    case messages.getOptions:
      console.log('getOptions')
      getOptions().then(sendResponse);
      return true;
      break;
    case messages.setOptions:
      setOptions(request.options);
      break;
    case messages.resetOptions:
      resetOptions(request.options);
      break;
  }
});

