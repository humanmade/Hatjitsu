/*jslint indent: 2, browser: true */
/*global angular, _ */

'use strict';

/* Controllers */
function MainCtrl($scope, $timeout) {
  $scope.logoState = '';
  $scope.errorMessage = null;
  $scope.message = null;
  $scope.decks = {
    '135 set': [ '1', '3', '5', '8', '13', '21', '?'],
    'Fibonacci': ['0', '1', '2', '3', '5', '8', '13', '21', '34', '55', '89', '?'],
    'Fibonacci Goat': [ '1', '2', '3', '5', '8', '13', '?', '\u2615' ],
    'Mountain Goat': ['0', '\u00BD', '1', '2', '3', '5', '8', '13', '20', '40', '100', '?', '\u2615'],
    'Sequential': ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '?'],
    'Playing Cards': ['A\u2660', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J\u2654', 'Q\u2654', 'K\u2654'],
    'T-Shirt': ['XL', 'L', 'M', 'S', 'XS', '?'],
    'Fruit': ['🍎', '🍊', '🍌', '🍉', '🍑', '🍇'],
    '1-5': [1, 2, 3, 4, 5],
    '1-10': [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
  };

  $scope.$on('$routeChangeSuccess', function () {
    $scope.logoState = '';
    $scope.bodyState = '';
  });

  $scope.$on('unanimous vote', function () {
    $scope.logoState = ' header__logo--green';
    $scope.bodyState = ' body--green';
  });

  $scope.$on('not unanimous vote', function () {
    $scope.logoState = ' header__logo--yellow';
    $scope.bodyState = ' body--yellow';
  });

  $scope.$on('problem vote', function () {
    $scope.logoState = ' header__logo--red';
    $scope.bodyState = ' body--red';
  });

  $scope.$on('unfinished vote', function () {
    $scope.logoState = '';
    $scope.bodyState = '';
  });

  $scope.$on('show message', function (evnt, msg) {
    $scope.message = msg;
    $timeout(function () {
      $scope.message = null;
    }, 4000);
  });

  $scope.$on('show error', function (evnt, msg) {
    $scope.errorMessage = msg;
    $timeout(function () {
      $scope.errorMessage = null;
    }, 3000);
  });
}

MainCtrl.$inject = ['$scope', '$timeout'];

function LobbyCtrl($scope, $location, socket) {
  $scope.disableButtons = false;
  $scope.createRoom = function () {
    $scope.disableButtons = true;
    socket.emit('create room', {}, function (id) {
      $location.path('/room/'+id);
    });
  };

  $scope.enterRoom = function (id) {
    // console.log('enterRoom: room info');
    $scope.disableButtons = true;
    socket.emit('room info', { id: id }, function (response) {
      if (response.error) {
        $scope.disableButtons = false;
        $scope.$emit('show error', response.error);
      } else {
        // console.log("going to enter room " + response.id);
        $location.path('/room/' + response.id );
      }
    });
  };
}

LobbyCtrl.$inject = ['$scope', '$location', 'socket'];

function standardDeviation(values){
  var avg = average(values);

  var squareDiffs = values.map(function(value){
    var diff = value - avg;
    var sqrDiff = diff * diff;
    return sqrDiff;
  });

  var avgSquareDiff = average(squareDiffs);

  var stdDev = Math.sqrt(avgSquareDiff);
  return stdDev;
}

function average(data){
  var sum = data.reduce(function(sum, value){
    return sum + parseInt(value);
  }, 0);

  var avg = sum / data.length;
  return avg;
}

function RoomCtrl($scope, $routeParams, $timeout, socket) {

  var processMessage = function (response, process) {
    // console.log("processMessage: response:", response)
    if (response.error) {
      $scope.$emit('show error', response.error);
    } else {
      (process || angular.noop)(response);
    }
  };

  var sumOfTwo = function (a, b) {
    return a + b;
  };

  // wipe out vote if voting state is not yet finished to prevent cheating.
  // if it has already been set - use the actual vote. This works for unvoting - so that
  // before the flip occurs - we don't display 'oi'
  var processVotes = function () {

    var voteCount = $scope.votes.length;
    _.each($scope.votes, function (v) {
      v.visibleVote = v.visibleVote === undefined && (!$scope.forcedReveal && voteCount < $scope.voterCount) ? 'X' : v.vote;
    });

    var voteArr = [];
    voteArr.length = $scope.voterCount - voteCount;
    $scope.placeholderVotes = voteArr;
    $scope.showAverage = voteArr.length === 0;


    var total =  _.reduce(_.map(_.pluck($scope.votes, 'vote'), parseFloat), sumOfTwo, 0);
    $scope.votingAverage = Math.round(total / $scope.votes.length);
    $scope.votingTotal = total;
    $scope.votingStandardDeviation = standardDeviation(_.pluck($scope.votes, 'vote'), parseFloat);

    $scope.forceRevealDisable = (!$scope.forcedReveal && ($scope.votes.length < $scope.voterCount || $scope.voterCount === 0)) ? false : true;

    if ($scope.votes.length === $scope.voterCount || $scope.forcedReveal) {
      var uniqVotes = _.chain($scope.votes).pluck('vote').uniq().value().length;
      if (uniqVotes === 1) {
        $scope.$emit('unanimous vote');
      } else if (uniqVotes === $scope.voterCount) {
        $scope.$emit('problem vote');
      } else if ($scope.voterCount > 3 && uniqVotes === ($scope.voterCount - 1)) {
        $scope.$emit('problem vote');
      } else {
        $scope.$emit('not unanimous vote');
      }
    } else {
      $scope.$emit('unfinished vote');
    }
  };

  var myConnectionHash = function () {
    return _.find($scope.connections, function (c) { return c.sessionId === $scope.sessionId; });
  };

  var myVoteHash = function () {
    return _.find($scope.votes, function (c) { return c.sessionId === $scope.sessionId; });
  };

  var haveIVoted = function () {
    if ($scope.myVote === 'undefined' || $scope.myVote === null) {
      return false;
    }
    return true;
  };

  var votingFinished = function () {
    return $scope.forcedReveal || $scope.votes.length === $scope.voterCount;
  };

  var setVotingState = function () {
    $scope.cardsState = votingFinished() || !$scope.voter ? ' card--disabled' : '';
    $scope.votingState = votingFinished() ? ' flipped-stagger' : '';
  };

  var setLocalVote = function (vote) {
    var voteHash = myVoteHash();
    $scope.myVote = vote;
    $scope.voted = haveIVoted();
    if (!voteHash) {
      // initialize connections array with my first vote. (just to speed up UI)
      $scope.votes.push({ sessionId: $scope.sessionId, vote: vote });
    } else {
      if (vote) {
        voteHash.vote = vote;
      } else {
        // we're unvoting - lets remove it from the votes.
        $scope.votes = _.filter($scope.votes, function (v) {
          return v.sessionId !== $scope.sessionId;
        });
        // the above works - but causes an error in the UI.
      }
    }
    processVotes();
    setVotingState();
  };

  var chooseCardPack = function (val) {
    if ( val in $scope.decks ) {
      return $scope.decks[val];
    }

    return val.split( ',' );
  };

  var refreshRoomInfo = function (roomObj) {
    console.log("refreshRoomInfo: roomObj:", roomObj);

    if (roomObj.createAdmin) {
      setCookie('admin-' + roomObj.id, true, 0.5 );
    }

    if (getCookie('admin-' + roomObj.id ) ) {
      $scope.showAdmin = true;
    }

    $scope.connections = roomObj.connections;
    $scope.humanCount = $scope.connections.length;
    $scope.cardPack = roomObj.cardPack;
    $scope.forcedReveal = roomObj.forcedReveal;
    $scope.cards = chooseCardPack($scope.cardPack);

    $scope.votes = _.chain($scope.connections).filter(function (c) {
      return c.vote;
    }).values().value();

    $scope.voterCount = _.filter($scope.connections, function (c) {
      return c.voter;
    }).length;

    var connection = myConnectionHash();

    if (connection) {
      $scope.voter = connection.voter;
      $scope.myVote = connection.vote;
      $scope.myColor = connection.color;
      $scope.myName = connection.name;
      $scope.voted = haveIVoted();
    }

    processVotes();

    // we first want the cards to be displayed as hidden, and then apply the finished state
    // if voting has finished - which then actions the transition.
    $timeout(function () {
      setVotingState();
    }, 100);

  };

  $scope.configureRoom = function () {

    socket.on('room joined', function () {
      // console.log("on room joined");
      // console.log("emit room info", { id: $scope.roomId });
      this.emit('room info', { id: $scope.roomId }, function (response) {
        processMessage(response, refreshRoomInfo);
      });
    });

    socket.on('room left', function () {
      // console.log("on room left");
      // console.log("emit room info", { id: $scope.roomId });
      this.emit('room info', { id: $scope.roomId }, function (response) {
        processMessage(response, refreshRoomInfo);
      });
    });

    socket.on('card pack set', function () {
      $scope.$emit('show message', 'Card pack changed...');
      // console.log("on card pack set");
      // console.log("emit room info", { id: $scope.roomId });
      this.emit('room info', { id: $scope.roomId }, function (response) {
        processMessage(response, refreshRoomInfo);
      });
    });

    socket.on('voter status changed', function () {
      // console.log("on voter status changed");
      // console.log("emit room info", { id: $scope.roomId });
      this.emit('room info', { id: $scope.roomId }, function (response) {
        processMessage(response, refreshRoomInfo);
      });
    });

    socket.on('voted', function () {
      console.log("on voted");
      // console.log("emit room info", { id: $scope.roomId });
      this.emit('room info', { id: $scope.roomId }, function (response) {
        processMessage(response, refreshRoomInfo);
      });
    });

    socket.on('unvoted', function () {
      // console.log("on unvoted");
      // console.log("emit room info", { id: $scope.roomId });
      this.emit('room info', { id: $scope.roomId }, function (response) {
        processMessage(response, refreshRoomInfo);
      });
    });

    socket.on('vote reset', function () {
      // console.log("on vote reset");
      // console.log("emit room info", { id: $scope.roomId });
      this.emit('room info', { id: $scope.roomId }, function (response) {
        processMessage(response, refreshRoomInfo);
      });
    });

    socket.on('reveal', function () {
      // console.log("reveal event received");
      // setLocalVote(null);
      this.emit('room info', { id: $scope.roomId }, function (response) {
        processMessage(response, refreshRoomInfo);
      });
    });

    socket.on('connect', () => {
      // console.log("on connect");
      var sessionId = this.id;
      // console.log("new socket id = " + sessionId);
      if (!getCookie("sessionId")) {
        setCookie("sessionId", sessionId, 0.5);
      }
      $scope.sessionId = getCookie("sessionId");

      // console.log("session id = " + $scope.sessionId);
      // console.log("emit join room", { id: $scope.roomId, sessionId: $scope.sessionId });
      socket.emit('join room', { id: $scope.roomId, sessionId: $scope.sessionId }, function (response) {
        processMessage(response, refreshRoomInfo);
      });
    });
    socket.on('disconnect', () => {
      // console.log("on disconnect");
    } );

    // console.log("emit join room", { id: $scope.roomId, sessionId: $scope.sessionId });
    socket.emit('join room', { id: $scope.roomId, sessionId: $scope.sessionId }, function (response) {
      processMessage(response, refreshRoomInfo);
    });
  };

  $scope.openDropdown = function (event) {
    $scope.dropdownClass = 'dropdown-open';
  }

  $scope.setCardPack = function (cardPack) {
    $scope.showCustom = false;
    $scope.cardPack = cardPack;
    $scope.resetVote();

    // console.log("set card pack", { id: $scope.roomId, cardPack: cardPack });
    socket.emit('set card pack', { id: $scope.roomId, cardPack: cardPack });
    $timeout(function () {
      $scope.dropdownClass = 'dropdown-closed';
    }, 100);
  };

  $scope.setCustomPack = function () {
    $scope.showCustom = true;
    $timeout(function () {
      $scope.dropdownClass = 'dropdown-closed';
    }, 100);
  }

  $scope.vote = function (vote) {
    if ($scope.myVote === vote) {
      return;
    }

    if (votingFinished()) {
      return;
    }

    if ($scope.voter) {
      setLocalVote(vote);

      // console.log("emit vote", { id: $scope.roomId, vote: vote, sessionId: $scope.sessionId });
      socket.emit('vote', { id: $scope.roomId, vote: vote, sessionId: $scope.sessionId }, function (response) {
        processMessage(response);
      });
    }
  };

  $scope.unvote = function (sessionId) {
    if (sessionId !== $scope.sessionId) {
      return;
    }

    if (votingFinished()) {
      return;
    }

    setLocalVote(undefined);

    // console.log("emit unvote", { id: $scope.roomId, sessionId: $scope.sessionId });
    socket.emit('unvote', { id: $scope.roomId, sessionId: $scope.sessionId }, function (response) {
      processMessage(response);
    });
  };

  $scope.resetVote = function () {
    // console.log("emit reset vote", { id: $scope.roomId });
    socket.emit('reset vote', { id: $scope.roomId }, function (response) {
      processMessage(response);
    });
  };

  $scope.forceReveal = function () {
    // console.log("emit force reveal", { id: $scope.roomId });
    $scope.forceRevealDisable = true;
    socket.emit('force reveal', { id: $scope.roomId }, function (response) {
      processMessage(response);
    });
  };

  $scope.toggleVoter = function () {
    // console.log("emit toggle voter", { id: $scope.roomId, voter: $scope.voter, sessionId: $scope.sessionId });
    socket.emit('toggle voter', { id: $scope.roomId, voter: $scope.voter, sessionId: $scope.sessionId }, function (response) {
      processMessage(response);
    });
  };

  document.addEventListener( "click", (evt) => {
    const element = document.getElementById( 'dd' );
    let targetElement = evt.target; // clicked element

    do {
      if (targetElement == element) {
        return;
      }
      targetElement = targetElement.parentNode;
    } while (targetElement);

    $timeout(function () {
      $scope.dropdownClass = 'dropdown-closed';
    }, 100);
  });

  $scope.roomId = $routeParams.roomId;
  $scope.humanCount = 0;
  $scope.voterCount = 0;
  $scope.showAdmin = false;
  $scope.showCustom = false;
  $scope.voter = true;
  $scope.connections = {};
  $scope.votes = [];
  $scope.cardPack = '135 set';
  $scope.myVote = undefined;
  $scope.voted = haveIVoted();
  $scope.votingState = "";
  $scope.dropdownClass = "dropdown-closed";
  $scope.forcedReveal = false;
  $scope.forceRevealDisable = true;
  $scope.votingAverage = 0;
  $scope.votingTotal = 0;
}

RoomCtrl.$inject = ['$scope', '$routeParams', '$timeout', 'socket'];
