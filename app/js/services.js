/*jslint indent: 2, browser: true */
/*global angular, Sock, io */

'use strict';

/* Services */

// Demonstrate how to register services
// In this case it is a simple value service.
var pokerAppServices = angular.module('pokerApp.services', []);

pokerAppServices.value('version', '0.1');

pokerAppServices.service('socket', ['$rootScope',  '$timeout', function ($rootScope) {
  var sock = new Sock($rootScope);
  return sock;
}]);

pokerAppServices.factory('socket', ['$rootScope', function ($rootScope) {
  console.log( location.protocol + '//' + location.hostname + ':' + location.port );
  var socket = io(location.protocol + '//' + location.hostname + ':' + location.port, {
/*    'reconnect': true,
    'reconnection delay': 500,
    'max reconnection attempts': 10,
    'try multiple transports': true,
    'transports': ['websocket', 'htmlfile', 'xhr-polling', 'jsonp-polling']*/
  });

  $rootScope.socketMessage = null;
  $rootScope.activity = false;
  $rootScope.sessionId = null;

  socket.on('error', function (reason) {
    // console.log('service: on error', reason);
    $rootScope.$apply(function () {
      $rootScope.socketMessage = "🚨 Error: " + reason;
    });
    // console.log(reason);
  });
  socket.on('connect_failed', function (reason) {
    // console.log('service: on connect failed', reason);
    $rootScope.$apply(function () {
      $rootScope.socketMessage = "🚨 Connection failed";
    });
    // console.log(reason);
  });
  socket.on('disconnect', function () {
    // console.log('service: on disconnect');
    $rootScope.$apply(function () {
      $rootScope.socketMessage = "🚨 Disconnected";
    });
    // console.log('disconnected');
  });
  socket.on('connecting', function () {
    // console.log('service: on connecting');
    $rootScope.$apply(function () {
      $rootScope.socketMessage = "Connecting...";
    });
    // console.log('disconnected');
  });
  socket.on('reconnecting', function () {
    // console.log('service: on reconnecting');
    $rootScope.$apply(function () {
      $rootScope.socketMessage = "Reconnecting...";
    });
    // console.log('disconnected');
  });
  socket.on('reconnect', function () {
    // console.log('service: on reconnect');
    $rootScope.$apply(function () {
      $rootScope.socketMessage = null;
    });
    // console.log('disconnected');
  });
  socket.on('reconnect_failed', function () {
    $rootScope.$apply(function () {
      $rootScope.socketMessage = "🚨 Reconnect failed";
    });
  });

  socket.on('connect', function () {
    var sessionId = socket.id;
    $rootScope.$apply(function () {
      $rootScope.socketMessage = null;
      if (!getCookie("sessionId")) {
        setCookie( "sessionId", sessionId,  0.5 );
      }
      $rootScope.sessionId = getCookie("sessionId");
    });
  });

  return {
    on: function (eventName, callback) {
      $rootScope.socketMessage = null;
      socket.on(eventName, function () {
        var args = arguments;
        $rootScope.$apply(function () {
          callback.apply(socket, args);
        });
      });
    },
    emit: function (eventName, data, callback) {
      $rootScope.activity = true;
      socket.emit(eventName, data, function () {
        var args = arguments;
        $rootScope.$apply(function () {
          $rootScope.activity = false;
          if (callback) {
            callback.apply(socket, args);
          }
        });
      });
    }
  };
}]);
