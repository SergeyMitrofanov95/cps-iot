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
    fs.readFile(__dirname + "/example23.html",
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
var pwmLimit = 110;
var lastPWM = 0;

var err = 0;
var errSum = 0;
var dErr = 0;
var lastErr = 0;
var KpE = 0; // multiplication of Kp x error
var KiIedt = 0; // multiplication of Ki x integral of error
var KdDe_dt = 0;

var parametersStore ={};
var errSumAbs = 0;
var errAbs = 0; // absolute error
var errLast = 0;

var controlAlgorithmStartedFlag = 0;
var intervalCtrl;

var readAnalogPin0Flag = 1;

http.listen(8080);

var sendValueViaSocket = function(){};
var sendStaticMsgViaSocket = function(){};

board.on("ready", function(){
    
    board.analogRead(0, function(value){
        if (readAnalogPin0Flag == 1) desiredValue = value;
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
    
    socket.on("sendPosition", function(position){
        readAnalogPin0Flag = 0;
        desiredValue = position;
        socket.emit("messageToClient", "Position set to: position.");
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
        errAbs = Math.abs(desiredValue-actualValue);
      errSumAbs += errAbs;
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
        errAbs = Math.abs(err);
         errSumAbs += errAbs;
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
         err = desiredValue - actualValue; // error as difference between desired and actual val.
         errSum += err; // sum of errors | like integral
         errAbs = Math.abs(err);
         errSumAbs += errAbs;
         dErr = err - lastErr; // difference of error
         pwm = parameters.Kp2*err+parameters.Ki2*errSum+parameters.Kd2*dErr; // PID expression
         console.log(parameters.Kp2 + "|" + parameters.Ki2 + "|" + parameters.Kd2);
         lastErr = err; // save the value of error for next cycle to estimate the derivative
         if (pwm > pwmLimit) {pwm =  pwmLimit}; // to limit pwm values
         if (pwm < -pwmLimit) {pwm = -pwmLimit}; // to limit pwm values
         if (pwm > 0) {board.digitalWrite(2,1); board.digitalWrite(4,0);}; // direction if > 0
        if (pwm < 0) {board.digitalWrite(2,0); board.digitalWrite(4,1);}; // direction if < 0
        board.analogWrite(3, Math.abs(pwm));        
    }
    if (parameters.ctrlAlgNo == 4) {
         errLast = err;
         err = desiredValue - actualValue; // error
         errSum += err; // sum of errors, like integral
         errAbs = Math.abs(err);
        errSumAbs += errAbs;
         dErr = err - lastErr; // difference of error
         // for sending to client we put the parts to global scope
         KpE=parameters.Kp3*err;
         KiIedt=parameters.Ki3*errSum;
         KdDe_dt=parameters.Kd3*dErr;
         console.log(parameters.Ki3 + " " + 254/parameters.Ki3 + " " + errSum)
        if(errSum > 254/parameters.Ki3)
             errSum = 254/parameters.Ki3;
         if(errSum < -254/parameters.Ki3)
            errSum = -254/parameters.Ki3;
         if(err*errLast < 0)
             errSum = 0;
             pwm = KpE + KiIedt + KdDe_dt; // above parts are used
             lastErr = err; // save the value for the next cycle
        if(pwm > pwmLimit) {pwm = pwmLimit}; // to limit the value for pwm / positive
        if(pwm < -pwmLimit) {pwm = -pwmLimit}; // to limit the value for pwm / negative
        if (pwm > 0) {board.digitalWrite(2,1); board.digitalWrite(4,0);}; // določimo smer če je > 0
         if (pwm < 0) {board.digitalWrite(2,0); board.digitalWrite(4,1);}; // določimo smer če je < 0
        board.analogWrite(3, Math.abs(pwm));    
         console.log("algorithm 4 444");
      }
}

function startControlAlgorithm (parameters) {
    if(controlAlgorithmStartedFlag == 0){
        controlAlgorithmStartedFlag = 1;
        intervalCtrl = setInterval(function() {controlAlgorithm(parameters); }, 30);
        console.log("Control algorithm " + parameters.ctrlAlgNo + " started");
        sendStaticMsgViaSocket("Control algorithm " + parameters.ctrlAlgNo + " started | " + json2txt(parameters));
        parametersStore = parameters;
    }
}

function stopControlAlgorithm(){
    clearInterval(intervalCtrl);
    board.analogWrite(3, 0);
    sendStaticMsgViaSocket("Control algorithm " + parametersStore.ctrlAlgNo + " stopped | " + json2txt(parametersStore) + " | errSumAbs = " + errSumAbs);
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
    errLast = 0;
    parametersStore = {}; 
    console.log("ctrlAlg STOPPED");
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
        "errSumAbs": errSumAbs,
        "errAbs": errAbs
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