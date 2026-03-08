
/**
 * Module dependencies.
 */
var _ = require('underscore')._;

var env = process.env.NODE_ENV || 'development';

const express = require('express');
const app = module.exports = express();
const port = process.env.app_port || 5099;

var lobbyClass = require('./lobby.js');
var path = require('path');

var statsConnectionCount = 0;
var statsDisconnectCount = 0;
var statsSocketCount = 0;
var statsSocketMessagesReceived = 0;

app.use('/lib/angular', express.static('node_modules/angular'));
app.use('/lib/angular-route', express.static('node_modules/angular-route'));
app.use('/lib/underscore', express.static('node_modules/underscore'));

app.use(express.static('app', {
  maxAge: env === 'production' ? '1d' : 0
}));
app.set('views', path.join(__dirname, '../app'));

app.get('/', function(req, res) {
  res.render('index.ejs');
});

if (env === 'development') {
  app.get('/debug_state', function(req, res) {
    res.json({
      "stats": {
        "connectionCount": statsConnectionCount,
        "disconnectCount": statsDisconnectCount,
        "currentSocketCount": statsSocketCount,
        "socketMessagesReceived": statsSocketMessagesReceived
      },
      "rooms": _.map(lobby.rooms, function(room, key) { return room.json() } )
    });
  });
}

app.get('/room/:id', function(req, res) {
  if ( !(req.params.id in lobby.rooms) ) {
    lobby.createRoom( req.params.id );
  }
  res.render('index.ejs');
});

app.use(function (req, res, next) {
  res.redirect('/');
});

 // Use the port that Heroku provides or default to 5099
const server = app.listen(port, function() {
  console.log("Express server listening on port %d in %s mode", port, app.settings.env);
});

const io = require('socket.io')(server);
var lobby = new lobbyClass.Lobby(io);

/* EVENT LISTENERS */

io.sockets.on('connection', function (socket) {

  statsConnectionCount++;
  statsSocketCount++;

  // console.log("On connect", socket.id);

  socket.on('disconnecting', function () {
    statsDisconnectCount++;
    statsSocketCount--;
    console.log("On disconnect", socket.id);
    lobby.broadcastDisconnect(socket);
  });

  socket.on('create room', function (data, callback) {
    statsSocketMessagesReceived++;
    // console.log("on create room", socket.id, data);
    callback(lobby.createRoom());
  });

  socket.on('join room', function (data, callback) {
    statsSocketMessagesReceived++;
    console.log("on join room " + data.id, socket.id, data);
    var room = lobby.joinRoom(socket, data);
    if(room.error) {
      callback( { error: room.error } );
    } else {
      callback(room.info(data.sessionId));
    }
  } );

  socket.on('room info', function (data, callback) {
    statsSocketMessagesReceived++;
    // console.log("on room info for " + data.id, socket.id, data);
    var room = lobby.getRoom(data.id);
    // room = { error: "there was an error" };
    if (room.error) {
      callback( { error: room.error } );
    } else {
      callback(room.info());
    }
  });

  socket.on('set card pack', function (data, cardPack) {
    statsSocketMessagesReceived++;
    // console.log("on set card pack " + data.cardPack + " for " + data.id, socket.id, data);
    var room = lobby.getRoom(data.id);
    // console.log("error=" + room.error);
    if (!room.error) {
      room.setCardPack(data);
    }
  });

  socket.on('vote', function (data, callback) {
    statsSocketMessagesReceived++;
    // console.log("on vote " + data.vote + " received for " + data.id, socket.id, data);
    var room = lobby.getRoom(data.id);
    if (room.error) {
      callback( { error: room.error });
    } else {
      room.recordVote(socket, data);
      callback( {} );
    }
  });

  socket.on('unvote', function (data, callback) {
    statsSocketMessagesReceived++;
    // console.log("omn unvote received for " + data.id, socket.id, data);
    var room = lobby.getRoom(data.id);
    if (room.error) {
      callback( { error: room.error });
    } else {
      room.destroyVote(socket, data);
      callback( {} );
    }
  });

  socket.on('reset vote', function (data, callback) {
    statsSocketMessagesReceived++;
    var room = lobby.getRoom(data.id);
    if (room.error) {
      callback( { error: room.error });
    } else if (!room.isAdmin(socket.id) && !room.votingFinished()) {
      callback( { error: 'Only the room admin can reset votes' });
    } else {
      room.resetVote();
      callback( {} );
    }
  });

  socket.on('force reveal', function (data, callback) {
    statsSocketMessagesReceived++;
    var room = lobby.getRoom(data.id);
    if (room.error) {
      callback( { error: room.error });
    } else if (!room.isAdmin(socket.id)) {
      callback( { error: 'Only the room admin can force reveal' });
    } else {
      room.forceReveal();
      callback( {} );
    }
  });

  socket.on('set name', function (data, callback) {
    statsSocketMessagesReceived++;
    var room = lobby.getRoom(data.id);
    if (room.error) {
      callback({ error: room.error });
    } else {
      var result = room.setName(socket, data.name);
      callback(result);
    }
  });

  socket.on('set round label', function (data, callback) {
    statsSocketMessagesReceived++;
    var room = lobby.getRoom(data.id);
    if (!room.error) {
      room.setRoundLabel(data.label);
    }
    callback({});
  });

  socket.on('toggle voter', function (data, callback) {
    statsSocketMessagesReceived++;
    var room = lobby.getRoom(data.id);
    if (room.error) {
      callback( { error: room.error });
    } else {
      var connection = room.findSessionBySocket(socket.id);
      var isSelf = connection && connection.sessionId === data.sessionId;
      if (!isSelf && !room.isAdmin(socket.id)) {
        callback( { error: 'Only the room admin can toggle voter status' });
      } else {
        room.toggleVoter(data);
        callback( {} );
      }
    }
  });

} );
