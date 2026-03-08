const { uniqueNamesGenerator, adjectives, animals } = require('unique-names-generator');
const logger = require('./logger');

const colours = [
  '#144272',
  '#232D3F',
  '#2D3250',
  '#30475E',
  '#46C2CB',
  '#A2678A',
  '#BE3144',
  'black',
  'blueviolet',
  'brown',
  'cadetblue',
  'chocolate',
  'coral',
  'crimson',
  'darkblue',
  'darkcyan',
  'darkgoldenrod',
  'darkgreen',
  'darkkhaki',
  'darkmagenta',
  'darkolivegreen',
  'darkorange',
  'darkorchid',
  'darkseagreen',
  'darkslateblue',
  'darkslategrey',
  'darkviolet',
  'deeppink',
  'dodgerblue',
  'firebrick',
  'forestgreen',
  'goldenrod',
  'green',
  'hotpink',
  'indianred',
  'indigo',
  'lightsalmon',
  'lightseagreen',
  'magenta',
  'maroon',
  'mediumblue',
  'mediumpurple',
  'mediumseagreen',
  'mediumslateblue',
  'mediumvioletred',
  'midnightblue',
  'navy',
  'olive',
  'olivedrab',
  'orangered',
  'palevioletred',
  'peru',
  'purple',
  'rebeccapurple',
  'red',
  'royalblue',
  'saddlebrown',
  'salmon',
  'steelblue',
  'teal'
];

const people_roles_and_objects = [
  'ai',
  'android',
  'automobile',
  'avenger',
  'beyonce',
  'bindelstick',
  'blue eyes white dragon',
  'boba fett',
  'bulbasaur',
  'captain janeway',
  'captain picard',
  'card picker',
  'charizard',
  'charmander',
  'chocobo',
  'cleon',
  'commander sisko',
  'deana troi',
  'digimon',
  'director',
  'dobby',
  'droid',
  'emmissary',
  'engineer',
  'exodia',
  'frieren',
  'geordi laforge',
  'han solo',
  'hari seldon',
  'hypersphere',
  'iron man',
  'jedi',
  'knitter',
  'lwaxana troi',
  'Lwaxana Troi, daughter of the Fifth House, holder of the Sacred Chalice of Rixx, heir to the Holy Rings of Betazed',
  'mandalorian',
  'millenium puzzle',
  'mojito',
  'moonbase',
  'nephilim',
  'oddish',
  'one punch man',
  'orbital',
  'peppa pig',
  'pikachu',
  'pingu',
  'plant pot',
  'poet',
  'Q',
  'raichu',
  'rhombus',
  'riker',
  'scrum disciple',
  'scrum master',
  'servitor',
  'shredder',
  'shrike',
  'sith',
  'skywalker',
  'slime',
  'snowstorm',
  'spock',
  'star destroyer',
  'tarkin',
  'television',
  'tellytubby',
  'tesseract',
  'trackpad',
  'transporter',
  'transporter clone',
  'triangle',
  'unicron',
  'voltron',
  'voter',
  'womble',
  'xanadu',
  'xenu',
  'yugi',
  'zod'
];

/**
 * Words that could lead to unfortunate or offensive combinations.
 */
const forbidden = [
  'attractive',
  'available',
  'christian',
  'chubby',
  'creepy',
  'desirable',
  'dirty',
  'ethnic',
  'explicit',
  'fat',
  'filthy',
  'gay',
  'gorgeous',
  'hard',
  'hot',
  'married',
  'moaning',
  'naughty',
  'oral',
  'protestant',
  'racial',
  'rude',
  'sexual',
  'straight',
  'yeasty',
  'beaver',
  'booby',
  'cow',
  'dog',
  'kite',
  'rat',
  'snake',
  'thrush'
];
var Room = function(io, id ) {
  this.io = io;
  this.id = id;
  this.name = `Room: ${id}`;
  this.createdAt = calcTime(2);
  this.createAdmin = true;
  this.hasAdmin = false;
  this.adminSessionId = null;
  this.cardPack = '135 set';
  this.connections = {}; // we collect the votes in here
  this.forcedReveal = false;
  this.roundLabel = '';
  this.history = [];
};

Room.prototype.info = function(sessionId) {
  this.createAdmin = this.hasAdmin === false;
  if (!this.hasAdmin && sessionId) {
    this.adminSessionId = sessionId;
  }
  this.hasAdmin = true;
  return this.json();
};

Room.prototype.isAdmin = function(socketId) {
  if (!this.adminSessionId) {
    return false;
  }
  var connection = this.connections[this.adminSessionId];
  return connection && connection.socketIds.includes(socketId);
};

Room.prototype.enter = function(socket, data) {
  if (this.connections[data.sessionId]) {
    this.connections[data.sessionId].socketIds.push( socket.id );
    if (data.name) {
      this.connections[data.sessionId].name = this.uniquifyName(data.name, data.sessionId);
    }
    return;
  }

  // Used to colour code the cards and names
  const color = uniqueNamesGenerator({
    dictionaries: [
      colours
    ],
    length: 1
  });

  const uniqueName = uniqueNamesGenerator({
    dictionaries: [
      adjectives.filter( word => !forbidden.includes( word ) ),
      animals.concat( people_roles_and_objects ).filter( word => !forbidden.includes( word ) )
    ],
    separator: ' ',
    length: 2
  });

  var name = this.uniquifyName(data.name || uniqueName, data.sessionId);

  this.connections[data.sessionId] = {
    color: color,
    name: name,
    sessionId: data.sessionId,
    socketIds: [ socket.id ],
    vote: null,
    voter: data.voter !== undefined ? data.voter : true
  };
}

Room.prototype.leave = function(socket) {
  let connection = Object.values(this.connections).find((c) => {
    if ( ! c ) {
      return false;
    }

    if (c.socketIds.length == 0) {
      return false;
    }

    return c.socketIds.includes( socket.id );
  });

  if (connection && connection.sessionId) {
    logger.debug( 'eliminating socket with ID: ' + socket.id, JSON.stringify( this.connections[connection.sessionId].socketIds ) );
    const index = this.connections[connection.sessionId].socketIds.indexOf(socket.id);

    if (index > -1) {
      this.connections[connection.sessionId].socketIds.splice(index, 1);
    }

    // clean up connections with no sockets
    if ( this.connections[connection.sessionId].socketIds.length < 1 ) {
      this.connections[connection.sessionId] = null;

      // Reassign admin if the leaving user was the admin
      if (connection.sessionId === this.adminSessionId) {
        this.reassignAdmin();
      }
    }
  } else {
    logger.warn( 'did not find connection for socket', socket.id );
  }
}

Room.prototype.reassignAdmin = function() {
  var nextAdmin = Object.values(this.connections).find(function(c) {
    return c && c.socketIds.length > 0;
  });

  if (nextAdmin) {
    this.adminSessionId = nextAdmin.sessionId;
    this.hasAdmin = true;
  } else {
    this.adminSessionId = null;
    this.hasAdmin = false;
  }
}

Room.prototype.setCardPack = function(data) {
  this.cardPack = data.cardPack;
  this.io.sockets.in(this.id).emit('card pack set', this.json());
}

Room.prototype.toggleVoter = function(data) {
  if (this.connections[data.sessionId]) {
    this.connections[data.sessionId]['voter'] = data.voter;
    if (!data.voter) {
      this.connections[data.sessionId]['vote'] = null;
    }
  }

  this.io.sockets.in(this.id).emit('voter status changed', this.json());
}

Room.prototype.findSessionBySocket = function(socketId) {
  return Object.values(this.connections).find(function(c) {
    return c && c.socketIds.includes(socketId);
  });
};

Room.prototype.uniquifyName = function(name, excludeSessionId) {
  var self = this;
  var isNameTaken = function(candidate) {
    var lower = candidate.toLowerCase();
    return Object.values(self.connections).some(function(c) {
      return c && c.socketIds.length > 0 && c.sessionId !== excludeSessionId && c.name.toLowerCase() === lower;
    });
  };
  if (!isNameTaken(name)) {
    return name;
  }
  // Prepend a random adjective to make the name unique
  var filteredAdjectives = adjectives.filter(function(w) { return !forbidden.includes(w); });
  for (var i = 0; i < 10; i++) {
    var adj = uniqueNamesGenerator({ dictionaries: [filteredAdjectives], length: 1 });
    var candidate = adj + ' ' + name;
    if (!isNameTaken(candidate)) {
      return candidate;
    }
  }
  return name;
};

Room.prototype.setName = function(socket, name) {
  var connection = this.findSessionBySocket(socket.id);
  if (!connection) {
    return { error: 'Connection not found' };
  }
  connection.name = this.uniquifyName(name, connection.sessionId);
  this.io.sockets.in(this.id).emit('name changed', this.json());
  return {};
};

Room.prototype.recordVote = function(socket, data) {
  var connection = this.findSessionBySocket(socket.id);
  if (connection) {
    connection.vote = data.vote;
  }

  this.io.sockets.in(this.id).emit('voted', this.json());
}

Room.prototype.destroyVote = function(socket, data) {
  var connection = this.findSessionBySocket(socket.id);
  if (connection) {
    connection.vote = null;
  }

  socket.broadcast.to(this.id).emit('unvoted', this.json());
}

Room.prototype.votingFinished = function() {
  if (this.forcedReveal) {
    return true;
  }
  var voters = Object.values(this.connections).filter(function(c) {
    return c && c.socketIds.length > 0 && c.voter;
  });
  if (voters.length === 0) {
    return false;
  }
  return voters.every(function(v) { return v.vote !== null && v.vote !== undefined; });
}

Room.prototype.resetVote = function() {
  // Snapshot the current round into history before clearing
  var votes = [];
  Object.values(this.connections).forEach(function(c) {
    if (c && c.voter && c.vote !== null) {
      votes.push({ vote: c.vote });
    }
  });
  if (votes.length > 0) {
    this.history.push({
      label: this.roundLabel || 'Round ' + (this.history.length + 1),
      cardPack: this.cardPack,
      votes: votes,
      timestamp: Date.now()
    });
  }
  this.roundLabel = '';

  Object.values(this.connections).forEach(function(c) {
    if ( c ) {
      c.vote = null;
    }
  });

  this.forcedReveal = false;
  this.io.sockets.in(this.id).emit('vote reset', this.json());
}

Room.prototype.forceReveal = function() {
  this.forcedReveal = true;
  this.io.sockets.in(this.id).emit('reveal', this.json());
}

Room.prototype.getClientCount = function() {
  return Object.values(this.connections).filter(function(c) {
    if ( ! c ) {
      return false;
    }

    return (c.socketIds.length > 0);
  }).length;
}

Room.prototype.setRoundLabel = function(label) {
  this.roundLabel = label;
  this.io.sockets.in(this.id).emit('round label set', this.json());
};

Room.prototype.json = function() {
  return {
    id: this.id,
    name: this.name,
    createdAt: this.createdAt,
    createAdmin: this.createAdmin,
    hasAdmin: this.hasAdmin,
    adminSessionId: this.adminSessionId,
    cardPack: this.cardPack,
    forcedReveal: this.forcedReveal,
    roundLabel: this.roundLabel,
    history: this.history,
    connections: Object.values(this.connections).filter(
      function(c) {
        return (c && c.socketIds.length > 0);
      }
    )
  };
}

function calcTime(offset) {
  const d = new Date();
  const utc = d.getTime() + (d.getTimezoneOffset() * 60000);
  const nd = new Date(utc + (3600000*offset));
  return nd.toLocaleString();
}

exports.Room = Room;
