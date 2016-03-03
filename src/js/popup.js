import messageCurrentTab from './common/message-current-tab'
import messages from './common/messages';

chrome.runtime.sendMessage({ message: messages.getOptions }, (options => {
  messageCurrentTab({ message: messages.start, options});
}));