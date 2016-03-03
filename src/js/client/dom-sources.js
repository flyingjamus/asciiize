import randomstring from 'randomstring';

const sources = {};
const propName = 'asciiize' + randomstring.generate();
let uniqId = 1;

function getOrSetId(el) {
  let id = el[propName];
  if (!id) {
    id = uniqId++;
    el[propName] = id;
  }
  return id;
}

function get(el) {
  return sources[getOrSetId(el)];
}

function set(el, data) {
  return sources[getOrSetId(el)] = data;
}

export {get, set};
export default { get, set };