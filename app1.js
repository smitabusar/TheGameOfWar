var path = require("path"),
    _ = require("underscore"),
    express = require("express"),
    socketio = require("socket.io"),
    http=require("http"),
    Deck=require("./js/deck.js"),
    Games=require("./js/game.js");

// ExpressJS Server Definition
var expressApp = express();
expressApp.use(express.static(path.join(__dirname, 'templates')))
          .use(express.static(path.join(__dirname, 'css')))
          .use(express.static(path.join(__dirname, 'js')))
          .use(express.static(path.join(__dirname, 'images')));

expressApp.get("/", function(req, res) {
     res.redirect("playingBoard1.html");
});

// Create joined express and socket.io server
var httpServer = http.createServer(expressApp),
    ioServer = socketio.listen(httpServer);

var gameCounter = 0;

function pushToGame(game, eventname, data){
    var numplayers = game.Players.length;
    for (var i = 0; i < numplayers; i++) {
        var playerSocket = game.Players[i].socket;
        ioServer.sockets.socket(playerSocket).emit(eventname, data);
    }
}

ioServer.sockets.on("connection", function(clientSocket) {
  clientSocket.emit("updateGameList", Games.All);

  clientSocket.on("create", function(data) {
      gameCounter ++;
      var player={};
      player.name=data.playerName;
      player.socket=clientSocket.id;
      Games.Add(gameCounter, player);
      clientSocket.broadcast.emit("updateGameList", Games.All);
      clientSocket.emit("switchToGame" ,Games.Find(gameCounter));
  });

  clientSocket.on("join", function(data) {
        var player={};
        player.name=data.playerName;
        player.socket=clientSocket.id;
        var joined = Games.Join(data.gameID, player);
        if (joined){
          var game=Games.Find(data.gameID);
          clientSocket.emit("switchToGame",game);
          pushToGame(game, "updatePlayerList", game);
        } else {
          //if they failed, their game list needs refreshing
            clientSocket.emit("updateGameList", Games.All);
        }
    });

  clientSocket.on('deal', function(gamesID){
        var game = Games.Find(gamesID);
        game.openToJoin = false;
        var players = game.Players;
        var numplayers = game.Players.length;
        var deck = Deck.Deal(numplayers);
        for (var i = 0; i < numplayers; i++) {
            var playerSocket = players[i].socket;
            ioServer.sockets.socket(playerSocket).emit("cardDecks", deck[i]);
        }
        clientSocket.broadcast.emit("updateGameList", Games.All);
    });

  clientSocket.on("submit-card", function(data) {
      var game = Games.Find(data.id);
      var player = Games.FindPlayer(game, clientSocket.id);
      player.ready = true;
      player.cardsLeft = data.cardsLeft;
      game.CardHolder.push({socketid: clientSocket.id, card: data.card});
      var numCards = game.CardHolder.length;
      var numplayers = game.Players.length;
      pushToGame(game, "updatePlayerList", game)
      if (numCards === numplayers) {
        var winningCard = Deck.Compare(game.CardHolder);
        var returnCardsWinner = _.pluck(game.CardHolder, 'card');
        //console.log(x);
        ioServer.sockets.socket(winningCard.socketid).emit('winner', returnCardsWinner);
        var winningplayer = _.findWhere(game.Players, {socket: winningCard.socketid});
        winningplayer.cardsLeft += numplayers;
        pushToGame(game, 'alertwinner', winningplayer.name);
        _.each(game.CardHolder, function(card){
            var player = Games.FindPlayer(game, card.socketid);
            player.lastCard = card.card;
        });
        game.CardHolder = [];
        _.each(game.Players, function(player){
            player.ready = false;
        });
        pushToGame(game, "updatePlayerList", game)
      }
    });

  
});

httpServer.listen(3000);
console.log("Started The Game of War on port 3000");