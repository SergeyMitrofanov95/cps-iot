var http = require("http").createServer(handler);
var io = require("socket.io").listen(http);
var fs = require("fs");
var firmata = require("firmata");

console.log("Start the code");

var board = new firmata.Board("/dev/ttyACM0", function(){ // ACM Abstract Control Model for serial communication with Arduino (could be USB)
    console.log("Connecting to Arduino");
    board.pinMode(0, board.MODES.ANALOG);
    board.pinMode(1, board.MODES.ANALOG);
    board.pinMode(2, board.MODES.OUTPUT);
    board.pinMode(3, board.MODES.PWM);
    board.pinMode(4, board.MODES.OUTPUT);
});

function handler(req,res){
    fs.readFile(__dirname + "/example15.html",
    function(err, data){
        if(err){
            res.writeHead(500, {"Content-Type": "text/plain"});
            return res.end("Error loading html page.");
        }
        res.writeHead(200);
        res.end(data);
    })
}

var desiredValue = 0;
var actualValue = 0;

var Kp = 0.55;
var Ki = 0.008;
var Kd = 0.15;

var factor = 0.3;
var pwm = 0;
var pwmLimit = 254;

var err = 0;
var errSum = 0;
var dErr = 0;
var lastErr = 0;

var controlAlgorithmStartedFlag = 0;
var intervalCtrl;

http.listen(8080);

var sendValueViaSocket = function(){};

board.on("ready", function(){
    
    board.analogRead(0, function(value){
        desiredValue = value;
    });
    
    board.analogRead(1, function(value){
        actualValue = value;
    });

io.sockets.on("connection", function(socket){
    socket.emit("messageToClient", "Srv connected, brb OK");
    
    setInterval(sendValues, 40, socket);
    
    socket.on("startControlAlgorithm", function(){
        startControlAlgorithm();
    });
    
    socket.on("stopControlAlgorithm", function(){
        stopControlAlgorithm();
    });

});

});

function controlAlgorithm(){
    err = desiredValue - actualValue;
    errSum += err;
    dErr = err - lastErr;
    pwm = Kp*err+Ki*errSum+Kd*dErr;
    lastErr = err;
    if(pwm > pwmLimit){pwm = pwmLimit};
    if(pwm < -pwmLimit){pwm = -pwmLimit};
    if(pwm > 0){board.digitalWrite(2, 1); board.digitalWrite(4, 0);};
    if(pwm < 0){board.digitalWrite(2, 0); board.digitalWrite(4, 1);};
    board.analogWrite(3, Math.abs(pwm));
};

function startControlAlgorithm(){
    if(controlAlgorithmStartedFlag == 0){
        controlAlgorithmStartedFlag = 1;
        intervalCtrl = setInterval(function(){controlAlgorithm();}, 30);
        console.log("Control algorithm has been started.");
    };
};

function stopControlAlgorithm(){
    clearInterval(intervalCtrl);
    board.analogWrite(3, 0);
    controlAlgorithmStartedFlag = 0;
    console.log("Control algorithm has been stopped.");
};

function sendValues(socket){
    socket.emit("clientReadValues",
    {
        "desiredValue": desiredValue,
        "actualValue": actualValue,
        "pwm": pwm
    });
};