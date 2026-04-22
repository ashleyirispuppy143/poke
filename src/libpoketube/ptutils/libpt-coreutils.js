/*

    PokeTube is a Free/Libre youtube front-end !
    
    Copyright (C) 2021-2024 POKETUBE
 
    This file is Licensed under LGPL-3.0-or-later. Poketube itself is GPL, Only this file is LGPL.
    
    see a copy here:https://www.gnu.org/licenses/lgpl-3.0.txt
    
    please dont remove this comment while sharing this code 
    
  */

/**
 * Escapes special characters in the given string of text and replaces newline characters with <br>.
 *
 * @param {string} string The string to escape.
 * @returns {string} The escaped string.
 */
function escapeHtml(string) {
  /**
   * Regular expression to match HTML special characters: ["'&<>]
   * @type {RegExp}
   */
  var matchHtmlRegExp = /["'&<>]/

  /**
   * Escapes special characters in the given string.
   * @param {string} str The string to escape.
   * @returns {string} The escaped string.
   */
  function escapeString(str) {
    var escape
    var html = ''
    var index = 0
    var lastIndex = 0

    for (index = matchHtmlRegExp.exec(str).index; index < str.length; index++) {
      switch (str.charCodeAt(index)) {
        case 34: // "
          escape = '&quot;'
          break
        case 38: // &
          escape = '&amp;'
          break
        case 39: // '
          escape = '&#39;'
          break
        case 60: // <
          escape = '&lt;'
          break
        case 62: // >
          escape = '&gt;'
          break
        case 10: // Newline
          escape = '<br>'
          break
        default:
          continue
      }

      if (lastIndex !== index) {
        html += str.substring(lastIndex, index)
      }

      lastIndex = index + 1
      html += escape
    }

    return lastIndex !== index
      ? html + str.substring(lastIndex, index)
      : html
  }

  var str = '' + string
  var match = matchHtmlRegExp.exec(str)

  if (!match) {
    return str
  }

  return escapeString(str)
}


/**
 * Checks if a string is a valid JSON.
 * @param {string} str - The string to be checked.
 * @returns {boolean} - Returns true if the string is a valid JSON, otherwise false.
 */
function IsJsonString(str) {
  try {
    JSON.parse(str);
  } catch (e) {
    return false;
  }
  return true;
}

/**
 * Converts a number into a compact string representation with decimals.
 * @param {number} value - The number to be converted.
 * @returns {string} - The compact string representation (e.g., 14.3M).
 */
function convert(value) {
  return new Intl.NumberFormat("en-GB", {
    notation: "compact",
    compactDisplay: "short", // Standard short form (K, M, B)
    maximumFractionDigits: 1, // Ensures 14.3M instead of 14M
  }).format(value);
}

function convertLegacy(value) {
  return new Intl.NumberFormat("en-GB", {
    notation: "compact",
  }).format(value);
}

/**
 * Extracts the first line of text before the first occurrence of "<br>".
 * @param {string} text - The input text.
 * @returns {string} - The first line of text before "<br>", or the entire text if no "<br>" is found.
 */
function getFirstLine(text) {
  var index = text?.indexOf("<br> ");
  if (index === -1) index = undefined;
  return text?.substring(0, index);
}

/**
 * Capitalizes the first letter of a string.
 * @param {string} string - The input string.
 * @returns {string} - The string with the first letter capitalized.
 */
function capitalizeFirstLetter(string) {
  return string.charAt(0).toUpperCase() + string.slice(1);
}

/**
 * Converts time in seconds to a formatted time string (hh:mm:ss or mm:ss).
 * If time is 00:00, returns "LIVE".
 * @param {number} time - The time in seconds.
 * @returns {string} - The formatted time string.
 */
function turntomins(time) {
  var hours = Math.floor(time / 3600);
  var remainingSeconds = time - hours * 3600;
  var minutes = Math.floor(remainingSeconds / 60);
  var seconds = remainingSeconds - minutes * 60;

  function str_pad_left(string, pad, length) {
    return (new Array(length + 1).join(pad) + string).slice(-length);
  }

  if (hours > 0) {
    var finalTime =
      str_pad_left(hours, "0", 2) +
      ":" +
      str_pad_left(minutes, "0", 2) +
      ":" +
      str_pad_left(seconds, "0", 2);
  } else {
    if (minutes === 0 && seconds === 0) {
      return "LIVE";
    } else {
      var finalTime =
        str_pad_left(minutes, "0", 2) + ":" + str_pad_left(seconds, "0", 2);
    }
  }

  return finalTime;
}

/**
 * Returns a random floating point number within the specified range.
 * @param {number} min - The minimum value of the range (inclusive).
 * @param {number} max - The maximum value of the range (exclusive).
 * @returns {number} - A random floating point number within the specified range.
 */
function getRandomArbitrary(min, max) {
    return Math.random() * (max - min) + min;
}

/**
 * Returns a random integer within the specified range.
 * @param {number} min - The minimum value of the range (inclusive).
 * @param {number} max - The maximum value of the range (inclusive).
 * @returns {number} - A random integer within the specified range.
 */
function getRandomInt(min, max) {
    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Increases or decreases the brightness of a hexadecimal color code.
 * @param {string} hex - The hexadecimal color code.
 * @param {number} percent - The percentage by which to adjust the brightness (positive for increase, negative for decrease).
 * @returns {string} - The modified hexadecimal color code.
 */
function increase_brightness(hex, percent){
    // strip the leading # if it's there
    hex = hex.replace(/^\s*#|\s*$/g, '');

    // convert 3 char codes --> 6, e.g. `E0F` --> `EE00FF`
    if(hex.length == 3){
        hex = hex.replace(/(.)/g, '$1$1');
    }

    var r = parseInt(hex.substr(0, 2), 16),
        g = parseInt(hex.substr(2, 2), 16),
        b = parseInt(hex.substr(4, 2), 16);

    return '#' +
       ((0|(1<<8) + r + (256 - r) * percent / 100).toString(16)).substr(1) +
       ((0|(1<<8) + g + (256 - g) * percent / 100).toString(16)).substr(1) +
       ((0|(1<<8) + b + (256 - b) * percent / 100).toString(16)).substr(1);
}

/**
 * Converts an array to an object with numeric keys.
 * @param {Array} arr - The input array.
 * @returns {Object} - The resulting object with numeric keys.
 */
function toObject(arr) {
  var rv = {};
  for (var i = 0; i < arr.length; ++i) if (arr[i] !== undefined) rv[i] = arr[i];
  return rv;
}

/**
 * Determines if a color is light or dark.
 * @param {string} color - The color code in hexadecimal or RGB format.
 * @returns {string} - Returns "light" if the color is light, otherwise "dark".
 */
function lightOrDark(color) {
  // Variables for red, green, blue values
  var r, g, b, hsp;

  // Check the format of the color, HEX or RGB?
  if (color.match(/^rgb/)) {
    // If RGB --> store the red, green, blue values in separate variables
    color = color.match(
      /^rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*(\d+(?:\.\d+)?))?\)$/
    );

    r = color[1];
    g = color[2];
    b = color[3];
  } else {
    // If hex --> Convert it to RGB: http://gist.github.com/983661
    color = +("0x" + color.slice(1).replace(color.length < 5 && /./g, "$&$&"));

    r = color >> 16;
    g = (color >> 8) & 255;
    b = color & 255;
  }

  // HSP (Highly Sensitive Poo) equation from http://alienryderflex.com/hsp.html
  hsp = Math.sqrt(0.299 * (r * r) + 0.587 * (g * g) + 0.114 * (b * b));

  // Using the HSP value, determine whether the color is light or dark
  if (hsp > 127.5) {
    return "light";
  } else {
    return "dark";
  }
}

/**
 * Checks if an element with a specific ID exists in an array of objects.
 * @param {Array} array - The array of objects to be searched.
 * @param {string} id - The ID to search for.
 * @returns {boolean} - Returns true if the ID exists in the array, otherwise false.
 */
function IsInArray(array, id) {
  for (var i = 0; i < array.length; i++) {
    if (array[i].id === id) return true;
  }
  return false;
}

/**
 * Parses a JSON string into a JavaScript object.
 * @param {string} str - The JSON string to be parsed.
 * @returns {(Object|boolean)} - Returns the parsed JavaScript object if successful, otherwise false.
 */
function getJson(str) {
  try {
    return JSON.parse(str);
  } catch {
    return false;
  }
}

module.exports = {
  IsJsonString,
  convert,
  getFirstLine,
  getRandomArbitrary,
  getJson,
  lightOrDark,
  toObject,
  IsInArray,
  convertLegacy,
  getRandomInt,
  capitalizeFirstLetter,
  escapeHtml,
  turntomins
};
