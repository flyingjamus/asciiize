import asciiize from './asciiize';
import messages from './messages';

chrome.runtime.onMessage.addListener(
  function(request, sender, response) {
    if (request.message === messages.start) {
      _.forEach(document.getElementsByTagName('img'), v => asciiize(v, { key: request.key }));
    } else if (request.message === messages.single && selected) {
      asciiize(selected, { key: request.key });
    }
  });

let selected;

window.addEventListener('contextmenu', function(e) {
  selected = e.target;
});