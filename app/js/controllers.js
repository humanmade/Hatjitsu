/*jslint indent: 2, browser: true */
/*global angular, _, DECKS, chooseCardPack, computeVoteResults, getCookie, setCookie */

'use strict';

/* Controllers */
function MainCtrl($scope, $timeout) {
  $scope.logoState = '';
  $scope.toasts = [];
  $scope.decks = DECKS;

  $scope.$on('$routeChangeSuccess', function () {
    $scope.logoState = '';
    $scope.bodyState = '';
  });

  $scope.$on('unanimous vote', function () {
    $scope.logoState = ' header__logo--unanimous';
    $scope.bodyState = ' body--unanimous';
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

  var toastId = 0;

  function addToast(type, msg) {
    var toast = { id: toastId++, type: type, message: msg, visible: false, dismissing: false };
    $scope.toasts.push(toast);
    $timeout(function () { toast.visible = true; }, 0);
    toast._timer = $timeout(function () {
      dismissToast(toast);
    }, 4000);
  }

  function dismissToast(toast) {
    toast.dismissing = true;
    toast.visible = false;
    $timeout.cancel(toast._timer);
    $timeout(function () {
      var idx = $scope.toasts.indexOf(toast);
      if (idx > -1) {
        $scope.toasts.splice(idx, 1);
      }
    }, 200);
  }

  $scope.$on('show message', function (evnt, msg) {
    addToast('message', msg);
  });

  $scope.dismissToast = function (toast) {
    dismissToast(toast);
  };

  $scope.$on('show error', function (evnt, msg) {
    addToast('error', msg);
  });

  // Animate activity and socketMessage visibility (set via $rootScope in services.js)
  $scope.$watch('activity', function (val) {
    if (val) {
      $timeout(function () { $scope.activityVisible = true; }, 0);
    } else {
      $scope.activityVisible = false;
    }
  });

  $scope.$watch('socketMessage', function (val) {
    if (val) {
      $timeout(function () { $scope.socketMessageVisible = true; }, 0);
    } else {
      $scope.socketMessageVisible = false;
    }
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

function RoomCtrl($scope, $routeParams, $timeout, socket) {

  var processMessage = function (response, process) {
    // console.log("processMessage: response:", response)
    if (response.error) {
      $scope.$emit('show error', response.error);
    } else {
      (process || angular.noop)(response);
    }
  };

  var processVotes = function () {
    var voteCount = $scope.votes.length;
    _.each($scope.votes, function (v) {
      v.visibleVote = v.visibleVote === undefined && (!$scope.forcedReveal && voteCount < $scope.voterCount) ? 'X' : v.vote;
    });

    var results = computeVoteResults($scope.votes, $scope.voterCount, $scope.forcedReveal);

    var voteArr = [];
    voteArr.length = results.placeholderCount;
    $scope.placeholderVotes = voteArr;
    $scope.showAverage = results.showAverage;
    $scope.votingAverage = results.average;
    $scope.votingTotal = results.total;
    $scope.votingStandardDeviation = results.stddev;
    $scope.forceRevealDisable = results.forceRevealDisable;

    if (results.voteStatus === 'unfinished') {
      $scope.$emit('unfinished vote');
      return;
    }

    var voteEventMap = {
      'unanimous': 'unanimous vote',
      'problem': 'problem vote',
      'not_unanimous': 'not unanimous vote'
    };
    $scope.$emit(voteEventMap[results.voteStatus]);

    if (!document.hidden) {
      return;
    }
    if (Notification.permission === "granted") {
      const notification = new Notification("Voting Complete", {
        body: "All users have voted. Check the tab to view the results.",
        icon: "https://planningpoker.hmn.md/img/hmpoker_card_icon.png"
      });
      notification.onclick = function () {
        window.focus();
      };
    } else if (Notification.permission === "default") {
      Notification.requestPermission().then(function (permission) {
        if (permission !== "granted") {
          return;
        }
        const notification = new Notification("Voting Complete", {
          body: "All users have voted. Check the tab to view the results.",
          icon: "https://planningpoker.hmn.md/img/hmpoker_card_icon.png"
        });
        notification.onclick = function () {
          window.focus();
        };
      });
    }
  };

  var myConnectionHash = function () {
    return _.find($scope.connections, function (c) { return c.sessionId === $scope.sessionId; });
  };

  var myVoteHash = function () {
    return _.find($scope.votes, function (c) { return c.sessionId === $scope.sessionId; });
  };

  var haveIVoted = function () {
    if ($scope.myVote === undefined || $scope.myVote === null) {
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

  var refreshRoomInfo = function (roomObj) {
    console.log("refreshRoomInfo: roomObj:", roomObj);

    $scope.showAdmin = (roomObj.adminSessionId === $scope.sessionId);

    $scope.connections = roomObj.connections;
    $scope.humanCount = $scope.connections.length;
    $scope.cardPack = roomObj.cardPack;
    $scope.forcedReveal = roomObj.forcedReveal;
    $scope.history = roomObj.history || [];
    var defaultLabel = 'Round ' + (($scope.history.length || 0) + 1);
    $scope.roundLabel = roomObj.roundLabel || defaultLabel;
    $scope.cards = chooseCardPack($scope.cardPack);

    $scope.votes = _.chain($scope.connections).filter(function (c) {
      return c.vote;
    }).values().value();

    $scope.voterCount = _.filter($scope.connections, function (c) {
      return c.voter;
    }).length;

    var connection = myConnectionHash();

    if (connection) {
      if ($scope.voter && !connection.voter) {
        $scope.$emit('show message', 'The room admin moved you to spectator.');
      }
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

  $scope.joinAsVoter = function () {
    $scope.initialVoterChoice = true;
    $scope.showRolePrompt = false;
    setCookie('joined-' + $scope.roomId, true, 0.5);
    $scope.configureRoom();
  };

  $scope.joinAsSpectator = function () {
    $scope.initialVoterChoice = false;
    $scope.voter = false;
    $scope.showRolePrompt = false;
    setCookie('joined-' + $scope.roomId, true, 0.5);
    $scope.configureRoom();
  };

  $scope.configureRoom = function () {
    if ($scope.showRolePrompt) {
      return;
    }

    // Only register socket listeners once
    if ($scope._listenersRegistered) {
      socket.emit('join room', { id: $scope.roomId, sessionId: $scope.sessionId, voter: $scope.initialVoterChoice, name: $scope.customName }, function (response) {
        processMessage(response, refreshRoomInfo);
      });
      return;
    }
    $scope._listenersRegistered = true;

    socket.on('room joined', function (roomState) {
      refreshRoomInfo(roomState);
    });

    socket.on('room left', function (roomState) {
      refreshRoomInfo(roomState);
    });

    socket.on('card pack set', function (roomState) {
      var oldPack = $scope.cardPack;
      var newPack = roomState.cardPack;
      if (oldPack && oldPack !== newPack) {
        $scope.$emit('show message', 'Card pack changed from ' + oldPack + ' to ' + newPack);
      } else {
        $scope.$emit('show message', 'Card pack set to ' + newPack);
      }
      refreshRoomInfo(roomState);
    });

    socket.on('voter status changed', function (roomState) {
      refreshRoomInfo(roomState);
    });

    socket.on('voted', function (roomState) {
      refreshRoomInfo(roomState);
    });

    socket.on('unvoted', function (roomState) {
      refreshRoomInfo(roomState);
    });

    socket.on('vote reset', function (roomState) {
      refreshRoomInfo(roomState);
    });

    socket.on('reveal', function (roomState) {
      refreshRoomInfo(roomState);
    });

    socket.on('name changed', function (roomState) {
      refreshRoomInfo(roomState);
    });

    socket.on('round label set', function (roomState) {
      refreshRoomInfo(roomState);
    });

    socket.on('connect', function () {
      // console.log("on connect");
      var sessionId = this.id;
      // console.log("new socket id = " + sessionId);
      if (!getCookie("sessionId")) {
        setCookie("sessionId", sessionId, 0.5);
      }
      $scope.sessionId = getCookie("sessionId");

      // console.log("session id = " + $scope.sessionId);
      // console.log("emit join room", { id: $scope.roomId, sessionId: $scope.sessionId });
      socket.emit('join room', { id: $scope.roomId, sessionId: $scope.sessionId, voter: $scope.initialVoterChoice, name: $scope.customName }, function (response) {
        processMessage(response, refreshRoomInfo);
      });
    });
    socket.on('disconnect', function () {
      // console.log("on disconnect");
    } );

    // Only emit join if already connected (the connect handler emits it otherwise)
    if (socket.connected) {
      socket.emit('join room', { id: $scope.roomId, sessionId: $scope.sessionId, voter: $scope.initialVoterChoice, name: $scope.customName }, function (response) {
        processMessage(response, refreshRoomInfo);
      });
    }
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

  $scope.startEditName = function () {
    $scope.nameEdit.active = true;
    $scope.nameEdit.value = $scope.myName;
  };

  $scope.saveName = function () {
    $scope.nameEdit.active = false;
    var name = ($scope.nameEdit.value || '').trim();
    if (name && name !== $scope.myName) {
      $scope.myName = name;
      $scope.customName = name;
      setCookie('userName', name, 365);
      socket.emit('set name', { id: $scope.roomId, name: name }, function (response) {
        processMessage(response);
      });
    }
  };

  $scope.nameEditKeydown = function (event) {
    if (event.keyCode === 13) {
      event.preventDefault();
      $scope.saveName();
    }
  };

  $scope.toggleVoter = function () {
    // console.log("emit toggle voter", { id: $scope.roomId, voter: $scope.voter, sessionId: $scope.sessionId });
    socket.emit('toggle voter', { id: $scope.roomId, voter: $scope.voter, sessionId: $scope.sessionId }, function (response) {
      processMessage(response);
    });
  };

  $scope.makeSpectator = function (sessionId) {
    socket.emit('toggle voter', {
      id: $scope.roomId,
      voter: false,
      sessionId: sessionId
    }, function (response) {
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
  $scope.showRolePrompt = !getCookie('joined-' + $routeParams.roomId);
  $scope.initialVoterChoice = true;
  $scope.customName = getCookie('userName') || '';
  $scope.nameEdit = { active: false, value: '' };
  $scope.history = [];
  $scope.roundLabel = '';
  $scope.showHistory = false;

  var roundLabelTimer = null;
  $scope.updateRoundLabel = function () {
    if (roundLabelTimer) {
      $timeout.cancel(roundLabelTimer);
    }
    roundLabelTimer = $timeout(function () {
      socket.emit('set round label', { id: $scope.roomId, label: $scope.roundLabel }, function () {});
    }, 300);
  };

  var downloadFile = function (content, filename, mimeType) {
    var blob = new Blob([content], { type: mimeType });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  $scope.exportHistoryCSV = function () {
    var lines = ['Round,Card Pack,Votes'];
    _.each($scope.history, function (round) {
      var votes = _.pluck(round.votes, 'vote').join(' ');
      lines.push('"' + (round.label || '').replace(/"/g, '""') + '","' + (round.cardPack || '').replace(/"/g, '""') + '","' + votes + '"');
    });
    downloadFile(lines.join('\n'), 'voting-history.csv', 'text/csv');
  };

  $scope.exportHistoryMarkdown = function () {
    var lines = [];
    _.each($scope.history, function (round) {
      lines.push('## ' + (round.label || 'Round'));
      lines.push('**Card pack:** ' + (round.cardPack || ''));
      lines.push('**Votes:** ' + _.pluck(round.votes, 'vote').join(', '));
      lines.push('');
    });
    downloadFile(lines.join('\n'), 'voting-history.md', 'text/markdown');
  };
}

RoomCtrl.$inject = ['$scope', '$routeParams', '$timeout', 'socket'];
