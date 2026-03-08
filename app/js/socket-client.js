/*jslint indent: 2, browser: true */
/*global io */

'use strict';

/* Socket client — framework-agnostic wrapper around socket.io */

function createSocketClient() {
  var socket = io(location.protocol + '//' + location.hostname + ':' + location.port);

  return {
    raw: socket,
    get connected() { return socket.connected; },
    on: function (event, cb) { socket.on(event, cb); },
    emit: function (event, data, cb) { socket.emit(event, data, cb); },
    onStatusChange: function (cb) {
      socket.on('error', function (reason) {
        cb({ message: 'Error: ' + reason });
      });
      socket.on('connect_error', function () {
        cb({ message: 'Connection error' });
      });
      socket.on('disconnect', function () {
        cb({ message: 'Disconnected' });
      });
      socket.on('reconnect', function () {
        cb({ message: null });
      });
      socket.on('reconnect_failed', function () {
        cb({ message: 'Reconnect failed' });
      });
      socket.on('connect', function () {
        cb({ message: null, sessionId: socket.id });
      });
    }
  };
}
