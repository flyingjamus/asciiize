import sum from 'lodash/sum';
import memoize from 'lodash/memoize';
import clamp from 'lodash/clamp';
import {waitForImage} from './image-utils';

//const CHARS = ['@','#','$','=','*','!',';',':','~','-',',','.'];
//const CHARS = '.,:;i1tfLCG08@'.split('').reverse().concat(['&nbsp;']);
const CHARS = ['&nbsp;', '&nbsp;'].concat('.,:;clodxkO0KXN@'.split(''));
const FIRST_CHAR = CHARS[0];
const NUM_CHARS = CHARS.length - 1;
//const getChar = memoize(function getChar(val) {
//  return CHARS[parseInt(val * NUM_CHARS, 10)];
//});

function createContrastor(contrast) {
  const contrastFactor = (259 * (contrast + 255)) / (255 * (259 - contrast));
  return memoize(function(v) {
    return clamp(contrastFactor * (v - 128) + 128, 0, 255);
  });
}

function buildCharInner(options, [r, g, b, a]) {
  const {color, fontWidth, bottomCutoff = 0} = options;
  const maxValue = (Math.max(r, g, b) - bottomCutoff) / (255 - bottomCutoff);
  const intensity = clamp(maxValue, 0, 1);
  let char = CHARS[parseInt(intensity * NUM_CHARS)];
  if (char === FIRST_CHAR) {
    return `<span style="width: ${fontWidth}px; display: inline-block;"></span>`;
  } else {
    if (color === true) {
      const alpha = Math.floor(a / 255);
      return `<span style="color: rgba(${r}, ${g}, ${b}, ${alpha})">${char}</span>`
    } else {
      return char;
    }
  }
}

const buildChar = memoize(buildCharInner, ({color, fontWidth, bottomCutoff}, pixel) => {
  return [color === true, fontWidth, bottomCutoff].concat(pixel).join(',');
});
//const buildChar = buildCharInner;

function analyzeImage(imageData) {
  //const skip = 10;
  //const length = imageData.length;
  //const sample = [];
  //for (let i = 0; i < length; i += skip * 4) {
  //  sample.push([imageData[i], imageData[i + 1], imageData[i + 2]])
  //}
  //const sortedSample = sample.map(sum).sort();
  //const bottomCutoff = sortedSample[parseInt(sortedSample.length / 10)] / 3;
  ////const topCutoff = 255 - sortedSample[parseInt(sortedSample.length - sortedSample.length / 100)] / 3;

  return {
    bottomCutoff: 30
    //topCutoff: topCutoff
  }
}

function buildDomString(imageData, options) {
  const {newHeight, newWidth, contrast} = options;
  const contrastor = createContrastor(contrast);
  const out = [];
  for (let i = 0; i < newHeight; i++) {
    const rowPos = i * newWidth * 4;
    //const rowDiv = document.createElement('div');
    out.push('<div>');
    for (let j = 0; j < newWidth; j++) {
      const pos = rowPos + j * 4;
      const pixel = imageData.slice(pos, pos + 4).map(contrastor);
      //rowDiv.appendChild(buildChar(options, ...pixel));
      out.push(buildChar(options, pixel));
    }
    //container.appendChild(rowDiv);
    out.push('</div>');
  }
  return out.join('');
}

function asciiize(imageData, options) {
  const newOptions = Object.assign({}, options, analyzeImage(imageData));
  return buildDomString(imageData, newOptions);
}

export {buildChar, asciiize as default};
