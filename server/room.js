var _ = require('underscore')._;
const { uniqueNamesGenerator, adjectives, animals } = require('unique-names-generator');

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
  'rebeccapurle',
  'red',
  'royalblue',
  'saddlebrown',
  'salmon',
  'steelblue',
  'teal',
  'yellowgreen'
];

const people_roles_and_objects = [
  'android',
  'avenger',
  'bindelstick',
  'blue eyes white dragon',
  'boba fett',
  'bulbasaur',
  'captain janeway',
  'captain picard',
  'card picker',
  'charmander',
  'chocobo',
  'commander sisko',
  'deana troi',
  'director',
  'dobby',
  'droid',
  'engineer',
  'exodia',
  'geordi laforge',
  'han solo',
  'hari seldon',
  'hypersphere',
  'jedi',
  'lwaxana troi',
  'mandalorian',
  'millenium puzzle',
  'oddish',
  'pikachu',
  'pingu',
  'plant pot',
  'poet',
  'riker',
  'transporter clone',
  'spock',
  'scrum disciple',
  'scrum master',
  'shrike',
  'skywalker',
  'slime',
  'snowstorm',
  'star destroyer',
  'tarkin',
  'television',
  'tesseract',
  'trackpad',
  'triangle',
  'voter',
  'yugi',
];

var Room = function(io, id ) {
  this.io = io;
  this.id = id;
  this.name = `Room: ${id}`;
  this.createdAt = calcTime(2);
  this.createAdmin = true;
  this.hasAdmin = false;
  this.cardPack = '135 set';
  this.connections = {}; // we collect the votes in here
  this.forcedReveal = false;
};

Room.prototype.info = function() {
  this.createAdmin = this.hasAdmin === false;
  this.hasAdmin = true;
  return this.json();
};

Room.prototype.enter = function(socket, data) {
  // console.log("room entered as " + socket.id);
  if (this.connections[data.sessionId]) {
    this.connections[data.sessionId].socketIds.push( socket.id );
  } else {
    // Used to colour code the cards and names
    const color = uniqueNamesGenerator({
      dictionaries: [
        colours
      ],
      length: 1
    });
    const uniqueName = uniqueNamesGenerator({
      dictionaries: [
        adjectives,
        animals.concat( people_roles_and_objects )
      ],
      separator: ' ',
      length: 2
    });

    this.connections[data.sessionId] = {
      color: color,
      name: uniqueName,
      sessionId: data.sessionId,
      socketIds: [ socket.id ],
      vote: null,
      voter: true
    };
  }
}

Room.prototype.leave = function(socket) {
  let connection = _.find(this.connections, (c) => {
    if ( ! c ) {
      return false;
    }
    if (c.socketIds.length == 0) {
      return false;
    }
    return c.socketIds.includes( socket.id );
  });
  if (connection && connection.sessionId) {
    console.log( 'eliminating socket with ID: ' + socket.id, JSON.stringify( this.connections[connection.sessionId].socketIds ) );
    const index = this.connections[connection.sessionId].socketIds.indexOf(socket.id);
    if (index > -1) {
      this.connections[connection.sessionId].socketIds.splice(index, 1);
    }
    // clean up connections with no sockets
    if ( this.connections[connection.sessionId].socketIds.length < 1 ) {
      this.connections[connection.sessionId] = null;
    }
  } else {
    console.log( 'did not find connection?' );
  }
}

Room.prototype.setCardPack = function(data) {
  this.cardPack = data.cardPack;
  this.io.sockets.in(this.id).emit('card pack set');
  // console.log('card pack set');
}

Room.prototype.toggleVoter = function(data) {
  if (this.connections[data.sessionId]) {
    this.connections[data.sessionId]['voter'] = data.voter;
    if (!data.voter) {
      this.connections[data.sessionId]['vote'] = null;
    }
    // console.log("voter set to " + data.voter + " for " + data.sessionId);
  }
  this.io.sockets.in(this.id).emit('voter status changed');
}

Room.prototype.recordVote = function(socket, data) {
  if (this.connections[data.sessionId]) {
    this.connections[data.sessionId]['vote'] = data.vote;
  }
  this.io.sockets.in(this.id).emit('voted');
  socket.emit('voted');
  // this.io.sockets.in(this.id).emit('voted');
}

Room.prototype.destroyVote = function(socket, data) {
  if (this.connections[data.sessionId]) {
    this.connections[data.sessionId]['vote'] = null;
  }
  socket.broadcast.to(this.id).emit('unvoted');
  // this.io.sockets.in(this.id).emit('unvoted');
}

Room.prototype.resetVote = function() {
  _.forEach(this.connections, function(c) {
    if ( c ) {
      c.vote = null;
    }
  })
  this.forcedReveal = false;
  this.io.sockets.in(this.id).emit('vote reset');
}

Room.prototype.forceReveal = function() {
  this.forcedReveal = true;
  this.io.sockets.in(this.id).emit('reveal');
}

Room.prototype.getClientCount = function() {
  return _.filter(this.connections, function(c) {
    if ( ! c ) {
      return false;
    }
    return (c.socketIds.length > 0);
  }).length;
}

Room.prototype.json = function() {
  return {
    id: this.id,
    name: this.name,
    createdAt: this.createdAt,
    createAdmin: this.createAdmin,
    hasAdmin: this.hasAdmin,
    cardPack: this.cardPack,
    forcedReveal: this.forcedReveal,
    connections: _.filter(
      this.connections,
      function(c) {
        return (c && c.socketIds.length > 0);
      }
    )
  };
}


function calcTime(offset) {
  // create Date object for current location
  d = new Date();

  // convert to msec
  // add local time zone offset
  // get UTC time in msec
  utc = d.getTime() + (d.getTimezoneOffset() * 60000);

  // create new Date object for different place
  // using supplied offset
  nd = new Date(utc + (3600000*offset));

  // return time as a string
  return nd.toLocaleString();
}


exports.Room = Room;