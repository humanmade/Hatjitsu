/*jslint indent: 2, browser: true */
/*global angular, LobbyCtrl, RoomCtrl, getCookie, setCookie */

'use strict';

// Declare app level module which depends on filters, and services
angular.module('pokerApp', ['pokerApp.filters', 'pokerApp.services', 'pokerApp.directives', 'ngRoute']).
  config(['$routeProvider', '$locationProvider', function ($routeProvider, $locationProvider) {
    $locationProvider.html5Mode({
      enabled: true,
      requireBase: false
    }).hashPrefix('!');

    $routeProvider.when('/', { templateUrl: '/partials/lobby.html', controller: LobbyCtrl});
    $routeProvider.when('/room/:roomId', { templateUrl: '/partials/room.html', controller: RoomCtrl});
    $routeProvider.otherwise({redirectTo: '/'});
  }]).controller('MainCtrl', MainCtrl);
