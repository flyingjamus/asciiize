import messages from './messages';
import randomstring from 'randomstring';

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
  contexts:['image'],
  onclick: function() {
    messageCurrentTab({ message: messages.single, key: key });
  }
});
const requestsToCapture = {};

function markRequestIfNeeded(details) {
  if (details.url.match(key)) {
    requestsToCapture[details.requestId] = true;
    let url = details.url.replace('asciiize=' + key, '');
    if (url.slice(-1) === '?') {
      url = url.slice(0, -1);
    }
    return { redirectUrl: url };
  }
}
const rule = {
  name: 'Access-Control-Allow-Origin',
  value: '*'
};

function addHeadersIfMarked(details) {
  if (requestsToCapture[details.requestId]) {
    delete requestsToCapture[details.requestId];
    details.responseHeaders.push(rule);
    return { responseHeaders: details.responseHeaders };
  }
}

chrome.webRequest.onBeforeRequest.addListener(markRequestIfNeeded, { urls: ["<all_urls>"] }, ['blocking', 'requestBody']);

chrome.webRequest.onHeadersReceived.addListener(addHeadersIfMarked, { urls: ['<all_urls>'] }, ['blocking', 'responseHeaders']);