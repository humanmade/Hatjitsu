var _ = require('underscore')._;
const { uniqueNamesGenerator, adjectives, animals } = require('unique-names-generator');

var RoomClass = require('./room.js');

var Lobby = function(io) {
  this.io = io;
  this.rooms = {};
};


Lobby.prototype.createRoom = function(id) {
  id = id === undefined ? this.createUniqueURL() : id;
  if (this.rooms[id]) {
    return this.createRoom();
  }

  // remove any existing empty rooms first
  var thatRooms = this.rooms;
  _.each(this.rooms, function(room, key, rooms) {
    if (room.getClientCount() == 0) {
      delete thatRooms[key];
      // console.log("removed room " + key);
    }
  });

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

Lobby.prototype.joinRoom = function(socket, data) {
  if ( ! data.id ) {
    return  { error: 'Invalid or missing Room ID' };
  }

  if( ! ( data.id in this.rooms ) ) {
    console.log( 'Creating new room from URL with: ' + data.id );
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
      console.log( 'leaving room ' + r.id, socket.id, r );
      r.leave(socket);
      this.io.to( room ).emit('room left', r.json());
    } else {
      console.log( 'cant find room with ID ' + room );
    }
  } );
};

exports.Lobby = Lobby;
