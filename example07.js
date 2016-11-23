var http = require("http").createServer(handler);
var io = require("socket.io").listen(http);
var fs = require("fs");
var firmata = require("firmata");

console.log("Start the code");

var board = new firmata.Board("/dev/ttyACM0", function(){ // ACM Abstract Control Model for serial communication with Arduino (could be USB)
    console.log("Connecting to Arduino");
    console.log("Activation of Pin 13");
    board.pinMode(13, board.MODES.OUTPUT); // Configures the specified pin to behave either as an input or an output.
    console.log("Enabling Push Button on pin 2");
    board.pinMode(2, board.MODES.INPUT);
});

function handler(req,res){
    fs.readFile(__dirname + "/example07.html",
    function(err, data){
        if(err){
            res.writeHead(500, {"Content-Type": "text/plain"});
            return res.end("Error loading html page.");
        }
        res.writeHead(200);
        res.end(data);
    })
}

http.listen(8080);

var sendValueViaSocket;

board.on("ready", function(){

io.sockets.on("connection", function(socket){
    socket.emit("messageToClient", "Srv connected, brb OK");
    
    sendValueViaSocket = function(value){
        io.sockets.emit("messageToClient", value);
    }
});

board.digitalRead(2, function(value){
    if(value == 0){
        console.log("LED OFF");
        board.digitalWrite(13, board.LOW);
        sendValueViaSocket(0);
    }
    if(value == 1){
        console.log("LED ON");
        board.digitalWrite(13, board.HIGH);
        sendValueViaSocket(1);
    }
});

});