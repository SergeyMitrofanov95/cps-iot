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
    fs.readFile(__dirname + "/example20.html",
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
var KpE = 0; // multiplication of Kp x error
var KiIedt = 0; // multiplication of Ki x integral of error
var KdDe_dt = 0;

var errSumAbs = 0;

var controlAlgorithmStartedFlag = 0;
var intervalCtrl;

http.listen(8080);

var sendValueViaSocket = function(){};
var sendStaticMsgViaSocket = function(){};

board.on("ready", function(){
    
    board.analogRead(0, function(value){
        desiredValue = value;
    });
    
    board.analogRead(1, function(value){
        actualValue = value;
    });

io.sockets.on("connection", function(socket){
    socket.emit("messageToClient", "Srv connected, brb OK");
    socket.emit("staticMsgToClient", "Server connected, board ready.");
    
    setInterval(sendValues, 40, socket);
    
    socket.on("startControlAlgorithm", function(numberOfControlAlgorithm){
        startControlAlgorithm(numberOfControlAlgorithm);
    });
    
    socket.on("stopControlAlgorithm", function(){
        stopControlAlgorithm();
    });
    
    sendValueViaSocket = function (value) {
        io.sockets.emit("messageToClient", value);
    }
    
    sendStaticMsgViaSocket = function (value) {
        io.sockets.emit("staticMsgToClient", value);
    }

});

});

function controlAlgorithm (parameters) {
    if (parameters.ctrlAlgNo == 1) {
        pwm = parameters.pCoeff*(desiredValue-actualValue);
        if(pwm > pwmLimit) {pwm = pwmLimit};
        if(pwm < -pwmLimit) {pwm = -pwmLimit};
        if (pwm > 0) {board.digitalWrite(2,1); board.digitalWrite(4,0);};
        if (pwm < 0) {board.digitalWrite(2,0); board.digitalWrite(4,1);};
        board.analogWrite(3, Math.abs(pwm));
        console.log(Math.round(pwm));
    }
    if (parameters.ctrlAlgNo == 2) {
        err = desiredValue - actualValue;
        errSum += err;
        errSumAbs += Math.abs(err);
        dErr = err - lastErr;
        KpE=parameters.Kp1*err;
        KiIedt=parameters.Ki1*errSum;
        KdDe_dt=parameters.Kd1*dErr;
        pwm = KpE + KiIedt + KdDe_dt;
        lastErr = err;
        if(pwm > pwmLimit){pwm = pwmLimit};
        if(pwm < -pwmLimit){pwm = -pwmLimit};
        if(pwm > 0){board.digitalWrite(2, 1); board.digitalWrite(4, 0);};
        if(pwm < 0){board.digitalWrite(2, 0); board.digitalWrite(4, 1);};
        board.analogWrite(3, Math.abs(pwm));
    }
    if (parameters.ctrlAlgNo == 3) {
        err = desiredValue - actualValue;
        errSum += err;
        dErr = err - lastErr;
        pwm = parameters.Kp2*err + parameters.Ki2*errSum + parameters.Kd2*dErr;
        lastErr = err;
        if(pwm > pwmLimit){pwm = pwmLimit};
        if(pwm < -pwmLimit){pwm = -pwmLimit};
        if(pwm > 0){board.digitalWrite(2, 1); board.digitalWrite(4, 0);};
        if(pwm < 0){board.digitalWrite(2, 0); board.digitalWrite(4, 1);};
        board.analogWrite(3, Math.abs(pwm));
    }
}

function startControlAlgorithm (parameters) {
    if(controlAlgorithmStartedFlag == 0){
        controlAlgorithmStartedFlag = 1;
        intervalCtrl = setInterval(function() {controlAlgorithm(parameters); }, 30);
        console.log("Control algorithm " + parameters.ctrlAlgNo + " started");
        sendStaticMsgViaSocket("Control algorithm " + parameters.ctrlAlgNo + " started | " + json2txt(parameters));
    }
}

function stopControlAlgorithm(){
    clearInterval(intervalCtrl);
    board.analogWrite(3, 0);
    controlAlgorithmStartedFlag = 0;
    pwm = 0;
    err = 0;
    errSum = 0;
    dErr = 0;
    lastErr = 0;
    KpE = 0;
    KiIedt = 0;
    KdDe_dt = 0;
    errSumAbs = 0;
    console.log("ctrlAlg STOPPED");
    sendStaticMsgViaSocket("Stop");
}

function sendValues(socket){
    socket.emit("clientReadValues",
    {
        "desiredValue": desiredValue,
        "actualValue": actualValue,
        "pwm": pwm,
        "err": err,
        "errSum": errSum,
        "dErr": dErr,
        "KpE": KpE,
        "KiIedt": KiIedt,
        "KdDe_dt": KdDe_dt,
        "errSumAbs": errSumAbs
    });
}

function json2txt(obj){
    var txt = '';
    var recurse = function(_obj) {
        if ('object' != typeof(_obj)) {
            txt += ' = ' + _obj + '\n';
        }
        else {
            for (var key in _obj) {
                if (_obj.hasOwnProperty(key)) {
                    txt += '.' + key;
                    recurse(_obj[key]);
                }
            }
        }
    }
    recurse(obj);
    return txt;
}