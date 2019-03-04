const dgram = require('dgram');
/**
 * [Message Label Table]
 */
let MLT = {};
/**
 * [Buffered Message Queue]
 */
let BMQ = {};
/**
 * [Input Message Type Memory]
 * these messages will be received from others
 */
let IMTM = {};
/**
 * [Output Message Type Memory]
 * these messages will be sent to others
 */
let OMTM = {};

/**
 * @todo create a message type which is unique
 * @param {string} typeName Names of message types, each of which is unique
 * @param {function} completionAction If a return message from B is received in "MST": A does not need to wait any longer, and the marking of such message by "MST" will be cancelled, triggering the action at the same time.
 * @param {function} timeoutAction If the "MST" is exceeded and the "Class A message" has not received the retaliation message from the host B, the tag of "Class A message" will be cancelled, and the timeout action of the consistent message will be triggered.
 * @param {number} messageSurvivalTime A usually needs to wait for B's feedback. This period is called messageSurvivalTime
 * @param {bool} needCallback is it need counterpart's callback? 
 * @returns is success create Message? 
 */
function createMessage(typeName, completionAction, timeoutAction, messageSurvivalTime, needCallback) {
    if (OMTM[typeName] == null) {
        let messageType = new Object();
        OMTM[typeName] = messageType;
        messageType.completionAction = completionAction;
        messageType.timeoutAction = timeoutAction;
        messageType.messageSurvivalTime = messageSurvivalTime;
        messageType.needCallback = needCallback;
        MLT[typeName] = false;
        BMQ[typeName] = new Array();
        return true;
    }
    return false;
}
module.exports.createMessage = createMessage;

/**
 * @todo destroy a message type
 * @param {string} typeName Names of message types, each of which is unique
 * @returns true or false
 */
function destoryMessage(typeName) {
    if (OMTM[typeName] != null) {
        OMTM[typeName] = null;
        MLT[typeName] = null;
        BMQ[typeName] = null;
        return true;
    } else {
        return false;
    }
}
module.exports.destoryMessage = destoryMessage;

/**
 * @todo create a type of message receiver
 * @param {string} typeName Names of message types, each of which is unique
 * @param {function} receiveAction Execute this function after receiving a message
 * @returns success or failed
 */
function createReceiver(typeName, receiveAction) {
    if (IMTM[typeName] == null) {
        let messageType = new Object();
        IMTM[typeName] = messageType;
        messageType.receiveAction = receiveAction;
        return true;
    } else {
        return false;
    }
}
module.exports.createReceiver = createReceiver;

/**
 * @todo destroy a type of message receiver
 * @param {string} typeName Names of message types, each of which is unique
 */
function destoryReceiver(typeName) {
    if (IMTM[typeName] != null) {
        IMTM[typeName] = null;
        return true;
    } else {
        return false;
    }
}
module.exports.destoryReceiver = destoryReceiver;

/**
 * @todo send data to another terminal
 * @param {string} typeName Names of message types, each of which is unique
 * @param {string} ip IP address of the destination terminal
 * @param {number} port Port of the destination terminal
 * @param {object} data data to be sent
 * @returns true or false
 */
function sendMessage(typeName, ip, port, data) {
    if (MLT[typeName] == null) {
        return false;
    }
    if (MLT[typeName] == true) {
        pushIntoBufferMessageQueue(typeName, ip, port, data);
        return true;
    } else {
        transmitData(typeName, ip, port, data);
    }
}

/**
 * @todo send data to BMQ
 * @param {string} typeName 
 * @param {string} ip 
 * @param {number} port 
 * @param {object} data 
 * @returns push success or failed
 */
function pushIntoBufferMessageQueue(typeName, ip, port, data) {
    if (BMQ[typeName] == null) {
        return false;
    }
    BMQ[typeName].push({
        ip: ip,
        port: port,
        data: data
    });
    return true;
}
/**
 * @todo the real function which can transmit data
 * @param {string} typeName 
 * @param {string} ip 
 * @param {number} port 
 * @param {object} data 
 */
function transmitData(typeName, ip, port, data) {
    //use this object to send udp data
    let udpClient = dgram.createSocket('udp4');
    //Indicates that the current type of message is occupied
    MLT[typeName] = true;
    let sendData = JSON.stringify({
        typeName: typeName,
        callback: false,
        data: data
    });
    udpClient.send(sendData, port, ip, function (err) {
        if (err) {
            console.log(err);
        }
        udpClient.close();
    });
    //set Interval to trigger timer
    let outMessageType = OMTM[typeName];
    if (outMessageType.needCallback == true) {
        outMessageType.timer = setTimeout(function () {
            outMessageType.timeoutAction(typeName, ip, port, data);
            reAlive(typeName);
        }, outMessageType.messageSurvivalTime);
    }else{
        reAlive(typeName);
    }
}
/**
 * check BMQ's data,try to push them
 * @param {string} typeName 
 * @returns is there any buffered message needs to be sent
 */
function checkBMQ(typeName) {
    if (BMQ[typeName] == null) {
        return false;
    }
    let bufferedMessage = BMQ[typeName].shift();
    if (bufferedMessage != null) {
        sendMessage(typeName, bufferedMessage.ip, bufferedMessage.port, bufferedMessage.data);
    }
    return true;
}
/**
 * to set MLT and check BMQ
 * @param {string} typeName 
 */
function reAlive(typeName) {
    MLT[typeName] = false;
    clearTimeout(OMTM[typeName].timer);
    checkBMQ(typeName);
}
module.exports.sendMessage = sendMessage;

/**
 * to give the infomation sender a callback
 * @param {string} typeName 
 * @param {string} ip 
 * @param {number} port 
 * @param {object} data 
 */
function sendCallback(typeName, ip, port, data) {
    //use this object to send udp data
    let udpClient = dgram.createSocket('udp4');
    let sendData = JSON.stringify({
        typeName: typeName,
        callback: true,
        data: data
    });
    udpClient.send(sendData, port, ip, function (err) {
        if (err) {
            console.log(err);
        }
        udpClient.close();
    });
}
module.exports.sendCallback = sendCallback;

/**
 * to distribute the coming message
 * @param {string} msg 
 * @param {string} address 
 * @param {number} port 
 * @returns is success distribution?
 */
function messageDistribution(originMessage, address, port) {
    try {
        let msg = JSON.parse(originMessage);
        if (msg.callback == false) {
            if (IMTM[msg.typeName] == null) {
                return false;
            }
            IMTM[msg.typeName].receiveAction(msg.typeName, address, port, msg.data);
        } else {
            if (OMTM[msg.typeName] == null) {
                return false;
            }
            OMTM[msg.typeName].completionAction(msg.typeName, address, port, msg.data);
            reAlive(msg.typeName);
        }
    } catch (err) {
        console.log(err);
    }
}
module.exports.messageDistribution = messageDistribution;

/**
 * reset all the members(MLT BMQ IMTM OMTM)
 */
function reset() {
    MLT = {};
    BMQ = {};
    IMTM = {};
    OMTM = {};
}
module.exports.reset = reset;