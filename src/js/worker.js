import asciiize from './common/asciiize';
import messages from './common/messages';

self.onmessage = function(e) {
  var data = e.data;
  if (data && data.message === messages.workerStart) {
    const blob = new Uint8ClampedArray(data.blob);
    const result = asciiize(blob, data.options);
    self.postMessage({ id: data.id, message: messages.workerDone, result, blob: data.blob }, [data.blob]);
  }

  //postMessage(workerResult);
};