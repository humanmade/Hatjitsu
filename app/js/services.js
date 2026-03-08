/*jslint indent: 2, browser: true */
/*global angular, createSocketClient, getCookie, setCookie */

'use strict';

/* Services */

var pokerAppServices = angular.module('pokerApp.services', []);

pokerAppServices.value('version', '0.1');

pokerAppServices.factory('socket', ['$rootScope', function ($rootScope) {
  var client = createSocketClient();

  $rootScope.socketMessage = null;
  $rootScope.activity = false;
  $rootScope.sessionId = null;

  client.onStatusChange(function (status) {
    $rootScope.$apply(function () {
      if (status.message) {
        $rootScope.socketMessage = "\uD83D\uDEA8 " + status.message;
      } else {
        $rootScope.socketMessage = null;
      }
      if (status.sessionId !== undefined) {
        if (!getCookie("sessionId")) {
          setCookie("sessionId", status.sessionId, 0.5);
        }
        $rootScope.sessionId = getCookie("sessionId");
      }
    });
  });

  return {
    get connected() {
      return client.connected;
    },
    on: function (eventName, callback) {
      $rootScope.socketMessage = null;
      client.on(eventName, function () {
        var args = arguments;
        $rootScope.$apply(function () {
          callback.apply(client.raw, args);
        });
      });
    },
    emit: function (eventName, data, callback) {
      $rootScope.activity = true;
      client.emit(eventName, data, function () {
        var args = arguments;
        $rootScope.$apply(function () {
          $rootScope.activity = false;
          if (callback) {
            callback.apply(client.raw, args);
          }
        });
      });
    }
  };
}]);
