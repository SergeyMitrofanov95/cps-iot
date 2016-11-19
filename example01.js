var http = require("http");
var firmata = require("firmata");

console.log("Start the code");

var board = new firmata.Board("/dev/ttyACM0", function(){
    console.log("Connection to Arduino");
    console.log("Activation of Pin 13");
    board.pinMode(13, board.MODES.OUTPUT);
});

http.createServer(function(req,res){
    var parts = req.url.split("/"),
    operator = parseInt(parts[1],10);
    
    if (operator == 0){
        console.log("Putting LED to OFF.");
        board.digitalWrite(13, board.LOW);
    }
    else if (operator == 1){
        console.log("Putting LED to ON.");
        board.digitalWrite(13, board.HIGH);
    }
    
    res.writeHead(200, {"Content-Type": "text/plain"});
    res.write("For test write into browser e.g. 123.1.2.3:8080/1");
    res.end("The value of the operator is: " + operator);
    
}).listen(8080, "172.16.22.61");