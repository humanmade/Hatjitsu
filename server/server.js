
/**
 * Module dependencies.
 */
var env = process.env.NODE_ENV || 'development';

const express = require('express');
const app = module.exports = express();
const port = process.env.app_port || 5099;

var lobbyClass = require('./lobby.js');
var path = require('path');
const logger = require('./logger');
const { registerHandlers } = require('./socket-handlers');

const stats = {
  connectionCount: 0,
  disconnectCount: 0,
  socketCount: 0,
  messagesReceived: 0
};

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
        "connectionCount": stats.connectionCount,
        "disconnectCount": stats.disconnectCount,
        "currentSocketCount": stats.socketCount,
        "socketMessagesReceived": stats.messagesReceived
      },
      "rooms": Object.values(lobby.rooms).map(function(room) { return room.json() })
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
  logger.info("Express server listening on port %d in %s mode", port, app.settings.env);
});

const { Server } = require('socket.io');
const io = new Server(server);
var lobby = new lobbyClass.Lobby(io);

registerHandlers(io, lobby, stats);
