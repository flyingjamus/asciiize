import isObject from 'lodash/isObject'
import randomstring from 'randomstring';

const key = randomstring.generate();

export default function messageCurrentTab(message, cb) {
  if (!isObject(message)) {
    message = { message };
  }
  chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
    const id = tabs[0].id;

    function cbWrapper(response) {
      if (cb) {
        cb(response, id);
      }
    }
    chrome.tabs.sendMessage(id, Object.assign({key}, message), cbWrapper);
  });
}
