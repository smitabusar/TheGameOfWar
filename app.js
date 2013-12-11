var path = require("path"),
    _ = require("underscore"),
    express = require("express"),
    socketio = require("socket.io"),
    http=require("http"),
    Deck=require("./js/deck.js"),
    Games=require("./js/game.js");

// ExpressJS Server Definition
var expressApp = express();
expressApp.use(express.static(path.join(__dirname, 'templates')));
// expressApp.set("views", path.join(__dirname, "templates"))
   // .set("view engine", "hbs");

expressApp.get("/", function(req, res) {
     res.redirect("playingBoard.html");
});

expressApp.get("/game/:gameid", function(req, res) {
     var gameid = req.param("gameid");
});

// expressApp.get("/:filename", function(req, res) {
//     var filename = req.param("filename");

//     if(!_.has(fileContent, filename)) {
//         fileContent[filename] = "";
//     }

//     res.render("editor", {filename: filename, content: fileContent[filename]});
// });


// Create joined express and socket.io server
var httpServer = http.createServer(expressApp)
    ioServer = socketio.listen(httpServer);

var gameCounter = 0;

// Listen for socket.io events
ioServer.on("connection", function(clientSocket) {
    //so the player gets the games on connect:
    clientSocket.emit("updateGameList", Games.All);

    clientSocket.on("create", function(data) {
    	gameCounter ++;
        Games.Add(gameCounter, clientSocket.id);// we need to store client socket id's to push to correct players
        clientSocket.broadcast.emit("updateGameList", Games.All);
        clientSocket.emit("updateGameList", Games.All);
    });
    clientSocket.on("start", function(data) {
        console.log(data);
        Games.Start(data.gameID);
        clientSocket.broadcast.emit("sendUserStack", Games.All[data.gameID]);
    });
    
    clientSocket.on('deal', function(data){

        var game = _.findWhere(Games.All, {gameid: data.gameID});
        var players = game.Players;
        var numplayers = game.Players.length;
        var deck = Deck.Deal(numplayers);
        console.log("numplayers - " + numplayers);
        clientSocket.emit("cardDecks", ioServer);
        for (var i = 0; i < numplayers; i ++) {
            players[i].emit('cardDecks', deck[i]);
        }

    });

    clientSocket.on("join", function(data) {
        var joined = Games.Join(data.gameID, clientSocket.id);
        console.log(joined);
        clientSocket.emit("join", {
            success: joined,
            gameID: data.gameID // so that start button knows which game to join
        });
        if (joined){
            clientSocket.broadcast.emit("updateGameList", Games.All);
        } else {
            clientSocket.emit("updateGameList", Games.All);
            //if they failed, their game list needs refreshing
        }
    });
});

httpServer.listen(3000);
console.log("Started The Game of War on port 3000");