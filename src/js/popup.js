import material from '../vendor/material.min';
import messageCurrentTab from './common/message-current-tab';
import messages from './common/messages';
import isObject from 'lodash/isObject';
import formSerialize from 'form-serialize';
import throttle from 'lodash/throttle';

function sendMessage(message, cb) {
  if (!isObject(message)) {
    message = { message };
  }
  return chrome.runtime.sendMessage(message, cb);
}

function getOptions() {
  return new Promise(resolve => sendMessage(messages.getOptions, resolve));
}

function ensureContentScript(retry = false) {
  return new Promise((resolve, reject) => {
    messageCurrentTab(messages.status, (status) => {
      if (status === 1) {
        resolve();
      } else {
        if (retry) {
          reject()
        } else {
          chrome.tabs.executeScript(null, { file: "client.js" });
          ensureContentScript(true).then(resolve);
        }
      }
    });
  });
}

let isOn = false;

function toggleOn(turnOn) {
  ensureContentScript()
    .then(() => {
      if (turnOn === undefined) {
        turnOn = !isOn;
      }
      isOn = turnOn;
      if (isOn) {
        getOptions()
          .then(options => {
            messageCurrentTab({ message: messages.start, options })
          });
      } else {
        messageCurrentTab(messages.stop);
      }
      render();
    })
}

const setOptions = throttle(() => {
  const options = formSerialize(els.optionsForm, { hash: true });
  sendMessage({ message: messages.setOptions, options });
  refresh();
}, 100);

function refresh() {
  toggleOn(isOn);
}

let els;

function bindClicks() {
  els = {
    onOff: document.getElementById('switch-on-off'),
    optionsForm: document.getElementById('options-form'),
    colorTypeFull: document.getElementById('color-type-full'),
    colorTypeSingle: document.getElementById('color-type-single'),
    colorValue: document.getElementById('color-value'),
    colorBackground: document.getElementById('color-background')
  };

  els.onOff.addEventListener('change', e => toggleOn(e.target.checked));
  els.optionsForm.addEventListener('change', setOptions);
  els.optionsForm.addEventListener('input', setOptions);
}

function setBadge(isOn) {
  chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
    var tabId = tabs[0].id;
    const path = isOn ? '../assets/icon_active.png' : '../assets/icon.png';
    chrome.browserAction.setIcon({ path, tabId })
  });
}


function render() {
  getOptions()
    .then(options => {
      setBadge(isOn);

      els.onOff.checked = isOn;
      els.colorValue.value = options.colorValue;
      if (options.colorType === 'single') {
        els.colorTypeSingle.parentElement.MaterialRadio.check();
        els.colorTypeFull.parentElement.MaterialRadio.uncheck();
      } else {
        els.colorTypeSingle.parentElement.MaterialRadio.uncheck();
        els.colorTypeFull.parentElement.MaterialRadio.check();
      }
      els.colorBackground.value = options.background;
    });
}

document.addEventListener('DOMContentLoaded', ()=> {
  bindClicks();
  toggleOn();
  render();
});
