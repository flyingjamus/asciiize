import randomstring from 'randomstring';
const key = randomstring.generate();

export default function messageCurrentTab(message, cb) {
  chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
    var id = tabs[0].id;

    function cbWrapper(response) {
      if (cb) {
        cb(response, id);
      }
    }
    chrome.tabs.sendMessage(id, Object.assign({key}, message), cbWrapper);
  });
}
