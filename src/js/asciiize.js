import lodash from 'lodash';
//const CHARS = ['@','#','$','=','*','!',';',':','~','-',',','.'];
//const CHARS = '.,:;i1tfLCG08@'.split('').reverse().concat(['&nbsp;']);
const CHARS = ['&nbsp;', '&nbsp;'].concat('.,:;clodxkO0KXN@'.split(''));
const NUM_CHARS = CHARS.length - 1;
const getChar = _.memoize(function getChar(val) {
  return CHARS[parseInt(val * NUM_CHARS, 10)];
});

let key = '';

function contrastor(contrast) {
  const contrastFactor = (259 * (contrast + 255)) / (255 * (259 - contrast));
  return _.memoize(function(v) {
    return _.clamp(contrastFactor * (v - 128) + 128, 0, 255);
  });
}

function buildChar(options, r, g, b, a) {
  const {color, fontWidth, bottomCutoff = 0} = options;
  const maxValue = (Math.max(r, g, b) - bottomCutoff) / (255 - bottomCutoff);
  const intensity = _.clamp(maxValue, 0, 1);
  const span = document.createElement('span');

  if (color === true) {
    const alpha = Math.floor(a / 255);
    span.style.color = `rgba(${r}, ${g}, ${b}, ${alpha})`;
  } else {
    span.style.color = 'white';
  }

  let char = getChar(intensity);
  if (char === CHARS[0]) {
    span.style.width = fontWidth + 'px';
    span.style.display = 'inline-block'
  } else {
    span.innerHTML = char;
  }
  return span;
}

function measureFont(container) {
  let hasParent = container.parentElement;
  if (!hasParent) {
    document.body.appendChild(container);
  }
  const tester = buildChar({}, 255, 255, 255, 1);
  container.appendChild(tester);
  const res = tester.getBoundingClientRect();
  container.removeChild(tester);
  if (!hasParent) {
    document.body.removeChild(container);
  }
  return res;
}

function domToImg(domString, image) {
  return new Promise(function(resolve, reject) {
    let width = image.offsetWidth;
    let height = image.offsetHeight;
    const data = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
              <foreignObject width="100%" height="100%">
              <div xmlns="http://www.w3.org/1999/xhtml">
              ${domString}
              </div>
              </foreignObject>
              </svg>`;
    const DOMURL = window.URL || window.webkitURL || window;
    if (!DOMURL) {
      reject();
    }

    const svg = new Blob([data], { type: 'image/svg+xml;charset=utf-8' });
    const url = DOMURL.createObjectURL(svg);

    image.addEventListener('load', function() {
      DOMURL.revokeObjectURL(url);
      resolve(image);
    });

    image.src = url;
  });
}

function getImageData(image, {width, height, newWidth, newHeight, key}) {
  return new Promise(function(resolve) {
    const hiddenImage = document.createElement('img');
    hiddenImage.style.width = width;
    hiddenImage.style.height = height;
    hiddenImage.crossOrigin = 'anonymous';
    hiddenImage.addEventListener('load', function() {
      const hiddenCanvas = document.createElement('canvas');
      hiddenCanvas.getContext('2d').drawImage(hiddenImage, 0, 0, width, height, 0, 0, newWidth, newHeight);
      const imageData = hiddenCanvas.getContext('2d').getImageData(0, 0, newWidth, newHeight);
      resolve(imageData);
    });
    const src = image.src;
    const keyStr = 'asciiize=' + key;
    hiddenImage.src = (src.indexOf('&') > -1) ? src + '&' + keyStr : src + '?' + keyStr;
  });
}

const DEFAULT_OPTIONS = {
  background: 'black',
  fontFamily: 'monospace',
  fontSize: [3, 30],
  fontCoefficient: 50 * 50,
  //color: 'white',
  color: true,
  contrast: 70,
};

function createContainer(options) {
  const container = document.createElement('div');
  container.style.whiteSpace = 'nowrap';
  container.style.marginLeft = '-1px';
  container.style.background = options.background;
  container.style.fontFamily = options.fontFamily;
  container.style.fontSize = options.fontSize + 'px';
  return container;
}

function analyzeImage(imageData) {
  const skip = 10;
  const length = imageData.length;
  const sample = [];
  for (let i = 0; i < length; i += skip * 4) {
    sample.push([imageData[i], imageData[i + 1], imageData[i + 2]])
  }
  const sortedSample = sample.map(_.sum).sort();
  const bottomCutoff = sortedSample[parseInt(sortedSample.length / 10)] / 3;
  //const topCutoff = 255 - sortedSample[parseInt(sortedSample.length - sortedSample.length / 100)] / 3;

  return {
    bottomCutoff: bottomCutoff
    //topCutoff: topCutoff
  }
}

function asciiize(image, inputOptions = {}) {
  let options = Object.assign({}, DEFAULT_OPTIONS, inputOptions);

  const width = image.offsetWidth;
  const height = image.offsetHeight;

  if (!width || !height) {
    return;
  }
  if (Array.isArray(options.fontSize)) {
    let [minFont, maxFont] = options.fontSize;
    options.fontSize = parseInt(_.clamp(Math.sqrt(width * height / options.fontCoefficient), minFont, maxFont));
  }
  const container = createContainer(options);

  const {width: fontWidth, height: fontHeight} = measureFont(container);
  const newWidth = Math.ceil(width / fontWidth);
  const newHeight = Math.ceil(height / fontHeight);
  Object.assign(options, { width, height, newWidth, newHeight });
  return getImageData(image, options)
    .then(function(imageData) {
      const data = imageData.data;
      const contrast = contrastor(options.contrast);
      const {bottomCutoff, topCutoff} = analyzeImage(data);
      options.bottomCutoff = bottomCutoff;
      options.topCutoff = topCutoff;
      options.fontWidth = fontWidth;

      for (let i = 0; i < newHeight; i++) {
        const rowPos = i * newWidth * 4;
        const rowDiv = document.createElement('div');
        for (let j = 0; j < newWidth; j++) {
          const pos = rowPos + j * 4;
          const pixel = data.slice(pos, pos + 4).map(contrast);
          rowDiv.appendChild(buildChar(options, ...pixel));
        }
        container.appendChild(rowDiv);
      }
      //document.body.appendChild(container);
      return domToImg(container.outerHTML, image)
    });
}

export default asciiize;