const logger = require('./logger');

function validate(data, rules) {
  if (!data || typeof data !== 'object') {
    return 'Invalid data';
  }
  for (const [field, rule] of Object.entries(rules)) {
    const value = data[field];
    if (rule.required && (value === undefined || value === null || value === '')) {
      return `Missing required field: ${field}`;
    }
    if (value === undefined || value === null) continue;
    if (rule.type === 'string' && typeof value !== 'string') {
      return `${field} must be a string`;
    }
    if (rule.type === 'boolean' && typeof value !== 'boolean') {
      return `${field} must be a boolean`;
    }
    if (rule.type === 'string-or-number' && typeof value !== 'string' && typeof value !== 'number') {
      return `${field} must be a string or number`;
    }
    if (rule.maxLength && typeof value === 'string' && value.length > rule.maxLength) {
      return `${field} exceeds maximum length of ${rule.maxLength}`;
    }
    if (rule.trim && typeof value === 'string') {
      data[field] = value.trim();
    }
  }
  return null;
}

function registerHandlers(io, lobby, stats) {
  io.sockets.on('connection', function (socket) {

    stats.connectionCount++;
    stats.socketCount++;

    socket.on('disconnecting', function () {
      stats.disconnectCount++;
      stats.socketCount--;
      logger.debug("On disconnect", socket.id);
      lobby.broadcastDisconnect(socket);
    });

    socket.on('create room', function (data, callback) {
      stats.messagesReceived++;
      callback(lobby.createRoom());
    });

    socket.on('join room', function (data, callback) {
      stats.messagesReceived++;
      var err = validate(data, {
        id: { required: true, type: 'string', maxLength: 100 },
        sessionId: { required: true, type: 'string' },
        name: { type: 'string', maxLength: 50, trim: true },
        voter: { type: 'boolean' }
      });
      if (err) return callback({ error: err });

      logger.info("on join room " + data.id, socket.id);
      var room = lobby.joinRoom(socket, data);
      if(room.error) {
        callback( { error: room.error } );
      } else {
        callback(room.info(data.sessionId));
      }
    });

    socket.on('room info', function (data, callback) {
      stats.messagesReceived++;
      var err = validate(data, {
        id: { required: true, type: 'string', maxLength: 100 }
      });
      if (err) return callback({ error: err });

      var room = lobby.getRoom(data.id);
      if (room.error) {
        callback( { error: room.error } );
      } else {
        callback(room.info());
      }
    });

    socket.on('set card pack', function (data, cardPack) {
      stats.messagesReceived++;
      var err = validate(data, {
        id: { required: true, type: 'string', maxLength: 100 },
        cardPack: { required: true, type: 'string' }
      });
      if (err) return;

      var room = lobby.getRoom(data.id);
      if (!room.error) {
        room.setCardPack(data);
      }
    });

    socket.on('vote', function (data, callback) {
      stats.messagesReceived++;
      var err = validate(data, {
        id: { required: true, type: 'string', maxLength: 100 },
        vote: { required: true, type: 'string-or-number' }
      });
      if (err) return callback({ error: err });

      var room = lobby.getRoom(data.id);
      if (room.error) {
        callback( { error: room.error });
      } else {
        room.recordVote(socket, data);
        callback( {} );
      }
    });

    socket.on('unvote', function (data, callback) {
      stats.messagesReceived++;
      var err = validate(data, {
        id: { required: true, type: 'string', maxLength: 100 }
      });
      if (err) return callback({ error: err });

      var room = lobby.getRoom(data.id);
      if (room.error) {
        callback( { error: room.error });
      } else {
        room.destroyVote(socket, data);
        callback( {} );
      }
    });

    socket.on('reset vote', function (data, callback) {
      stats.messagesReceived++;
      var err = validate(data, {
        id: { required: true, type: 'string', maxLength: 100 }
      });
      if (err) return callback({ error: err });

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
      stats.messagesReceived++;
      var err = validate(data, {
        id: { required: true, type: 'string', maxLength: 100 }
      });
      if (err) return callback({ error: err });

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
      stats.messagesReceived++;
      var err = validate(data, {
        id: { required: true, type: 'string', maxLength: 100 },
        name: { required: true, type: 'string', maxLength: 50, trim: true }
      });
      if (err) return callback({ error: err });

      var room = lobby.getRoom(data.id);
      if (room.error) {
        callback({ error: room.error });
      } else {
        var result = room.setName(socket, data.name);
        callback(result);
      }
    });

    socket.on('set round label', function (data, callback) {
      stats.messagesReceived++;
      var err = validate(data, {
        id: { required: true, type: 'string', maxLength: 100 },
        label: { type: 'string', maxLength: 200 }
      });
      if (err) return callback({ error: err });

      var room = lobby.getRoom(data.id);
      if (!room.error) {
        room.setRoundLabel(data.label);
      }
      callback({});
    });

    socket.on('toggle voter', function (data, callback) {
      stats.messagesReceived++;
      var err = validate(data, {
        id: { required: true, type: 'string', maxLength: 100 },
        sessionId: { required: true, type: 'string' },
        voter: { required: true, type: 'boolean' }
      });
      if (err) return callback({ error: err });

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

  });
}

module.exports = { registerHandlers };
