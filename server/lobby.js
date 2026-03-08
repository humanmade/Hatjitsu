const { uniqueNamesGenerator, adjectives, animals } = require('unique-names-generator');
const logger = require('./logger');

var RoomClass = require('./room.js');

var Lobby = function(io) {
  this.io = io;
  this.rooms = {};

  // Periodic cleanup of empty rooms as a safety net
  this._cleanupInterval = setInterval(() => {
    this.cleanEmptyRooms();
  }, 5 * 60 * 1000);
};


Lobby.prototype.createRoom = function(id) {
  id = id === undefined ? this.createUniqueURL() : id;
  if (this.rooms[id]) {
    return this.createRoom();
  }

  // remove any existing empty rooms first
  this.cleanEmptyRooms();

  this.rooms[id] = new RoomClass.Room(this.io, id);
  return id;
};

Lobby.prototype.createUniqueURL = function() {
  for (var i = 0; i < 10; i++) {
    var name = uniqueNamesGenerator({
      dictionaries: [adjectives, animals],
      separator: '-',
      length: 2
    });
    if (!this.rooms[name]) {
      return name;
    }
  }
  // Fallback to random string on collision
  var text = '',
    possible = 'abcdefghijkmnopqrstuvwxyz23456789';
  for (var j = 0; j < 8; j++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
};

Lobby.prototype.cleanEmptyRooms = function() {
  Object.entries(this.rooms).forEach(([key, room]) => {
    if (room.getClientCount() === 0) {
      delete this.rooms[key];
    }
  });
};

Lobby.prototype.joinRoom = function(socket, data) {
  if ( ! data.id ) {
    return  { error: 'Invalid or missing Room ID' };
  }

  if( ! ( data.id in this.rooms ) ) {
    logger.info( 'Creating new room from URL with: ' + data.id );
    this.createRoom( data.id );
  }

  var room = this.getRoom(data.id);
  if (socket != null && data && data.sessionId != null) {
    room.enter(socket, data);
    socket.join(data.id);
    socket.broadcast.to(data.id).emit('room joined', room.json());
  }
  return room;
};

Lobby.prototype.getRoom = function(id) {
  var room = this.rooms[id];
  if (room) {
    return room;
  } else {
    return { error: 'Sorry, this room no longer exists ...' };
  }
};

Lobby.prototype.broadcastDisconnect = function(socket) {

  const rooms = Array.from( socket.rooms );
  rooms.forEach( room => {
    if ( room === socket.id ) {
      return;
    }

    var r = this.getRoom( room );
    if ( r.id ) {
      logger.debug( 'leaving room ' + r.id, socket.id );
      r.leave(socket);
      this.io.to( room ).emit('room left', r.json());

      // Clean up the room if it's now empty
      if ( r.getClientCount() === 0 ) {
        delete this.rooms[room];
      }
    } else {
      logger.warn( 'cant find room with ID ' + room );
    }
  } );
};

exports.Lobby = Lobby;
