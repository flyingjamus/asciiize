# Asciiize

Chrome extension to convert images to ASCII art.

## Installation

* ```npm install -g gulp webpack```
* ```npm install```

## Running

* Run ```gulp```.
* In the Chrome extensions page, click ```Load unpacked extension...``` and select the ```build``` directory.

The extension will automatically reload on code changes.

## Creating a build

* Add your pem as `config/extension.pem`.
* ```gulp build``` will generate a build in ```./dist```.

## TODO

* Add version bumping.
* Add SASS.
* Remove live reloading code from distribution build.