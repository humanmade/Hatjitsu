/*jslint indent: 2, browser: true */

'use strict';

/* Cookie utilities — framework-agnostic */

function getCookie(name) {
  var cookieArr = document.cookie.split(";");
  for (var i = 0; i < cookieArr.length; i++) {
    var cookiePair = cookieArr[i].split("=");
    if (name == cookiePair[0].trim()) {
      return decodeURIComponent(cookiePair[1]);
    }
  }
  return null;
}

function setCookie(name, value, daysToLive) {
  // Encode value in order to escape semicolons, commas, and whitespace
  var cookie = name + "=" + encodeURIComponent(value);

  if (typeof daysToLive !== "number") {
    return;
  }
  /* Sets the max-age attribute so that the cookie expires
  after the specified number of days */
  cookie += "; max-age=" + (daysToLive * 24 * 60 * 60);
  document.cookie = cookie;
}
