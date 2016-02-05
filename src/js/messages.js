const namespace = 'asciiize.';
const messages = {
  start: 'start',
  single: 'single'
};
const messagesWithNamespace = Object.keys(messages).reduce(function(result, key) {
  result[key] = namespace + messages[key];
  return result;
}, {});

export default messagesWithNamespace;