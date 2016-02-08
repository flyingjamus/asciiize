import sum from 'lodash/sum';
import memoize from 'lodash/memoize';
import clamp from 'lodash/clamp';
import matches from 'lodash/matches';
import findIndex from 'lodash/findIndex';
import quantize from 'quantize';

//const CHARS = ['@','#','$','=','*','!',';',':','~','-',',','.'];
//const CHARS = '.,:;i1tfLCG08@'.split('').reverse().concat(['&nbsp;']);
const CHARS = ['&nbsp;', '&nbsp;'].concat('.,:;clodxkO0KXN@'.split(''));
const FIRST_CHAR = CHARS[0];
const NUM_CHARS = CHARS.length - 1;

function createContrastor(contrast) {
  const contrastFactor = (259 * (contrast + 255)) / (255 * (259 - contrast));
  return memoize(function(v, i) {
    return clamp(contrastFactor * (v - 128) + 128, 0, 255);
  });
}

function getCharGetter(colorMap) {
  const palette = colorMap.palette().sort((a, b) => a[0] + a[1] + a[2] - b[0] - b[1] - b[2]);
  return memoize(pixel => {
    return CHARS[findIndex(palette, matches(pixel))];
  });
}

function buildCharInner(options, pixel) {
  const {color, fontWidth, getChar, colorMap} = options;

  const char = getChar(colorMap.nearest(pixel));
  if (char === FIRST_CHAR) {
    return `<span style="width: ${fontWidth}px; display: inline-block;"></span>`;
  } else {
    if (color === true) {
      return `<span style="color: rgb(${pixel[0]}, ${pixel[1]}, ${pixel[2]})">${char}</span>`
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
  const length = imageData.length;
  const pixels = [];
  for (let i = 0; i < length; i += 4) {
    pixels.push(imageData.slice(i, i + 3));
  }
  const colorMap = quantize(pixels, NUM_CHARS);
  return {
    colorMap,
    pixels,
    getChar: getCharGetter(colorMap)
  }
}

function buildDomString(imageData, options) {
  const {newHeight, newWidth, contrast} = options;
  const out = [];

  options.pixels.forEach((pixel, i) => {
    if (i % newWidth === 0) {
      out.push('<div>');
    }
    out.push(buildChar(options, pixel));
    if (i % newWidth === newWidth - 1) {
      out.push('</div>');
    }
  });
  return out.join('');
}

function asciiize(imageData, options) {
  const newOptions = Object.assign({}, options, analyzeImage(imageData));
  return buildDomString(imageData, newOptions);
}

export default asciiize;
