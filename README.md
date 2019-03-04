# FangzhouConsistencyMessage
## 1`介绍
**一致性报文CM**(Consistency Message)的实现：

### 1.1`实现基础
CM设计采用以UDP为基础实现。

### 1.2`实现效果
CM的最终效果应该是，A与B二者进行报文通信时，在一定时间内，二者通信不至于紊乱。

### 1.3`报文标记表与报文生存时间
假设A对B发送了甲类报文，甲类报文会在A主机本地进行标记【使用**报文标记表MLT**（Message Label Table）进行记录】，因为A通常需要等待B的反馈结果。这段时间，称为**报文生存时间MST**（Message Survival Time）。

### 1.4`缓冲报文队列、完成动作与超时动作
假设在1.3的情形下，在“甲类报文J1”的MST内：
#### 1.4.1`情形一
如果在没有接受到B的回执报文之前----等价于【MST中，“甲类报文”依旧处于“被标记状态”】，A因为其他原因对B再发送“甲类报文J2”：
则A会拒绝发送，并将“甲类报文J2”放入**缓冲报文队列BMQ**（Buffered Message Queue）中。

#### 1.4.2`情形二
如果在MST内，接受到了B的回执报文：
则A不再需要等待，MST对甲类报文的标记会被取消，同时触发**完成动作CA**（Completion Action）

#### 1.4.3`情形三
如果超过了MST，“甲类报文J1”仍未接受到来自B主机的回复报文，则甲类报文的标记也会被取消【使用MST进行实际控制】，同时触发一致性报文的**超时动作TA**（Timeout Action）

### 1.5`关于缓冲报文队列BMQ
#### 1.5.1`缓冲报文队列与报文标记表的联系
BMQ这种数据结构与MST具有密不可分的联系，首先，BMQ要想增加实际的新的数据成员，就必然依赖于MST所记录的某类报文要处于被标记的状态。

同时，当MST对某类报文的标记将要被取消的时候，必须查询BMQ，从而查询是否有被滞留的缓冲报文（Buffered Message），从而自动重新执行发送操作。
#### 1.5.2`缓冲报文BM
缓冲报文BM的结构如下

【ip<目的IP>，port<目的端口>，data<报文内容>】

### 1.6`关于“动作”的结构设计
#### 1.6.1·动作一定是一个函数
#### 1.6.2`完成动作CA
四个参数带参函数，参数分别是：

报文的类型名，接收方的IP地址，接收方的端口，报文接受方反馈给我们的内容
#### 1.6.3`超时动作TA
四个参数带参函数，参数分别是：

报文的类型名，接收方的IP地址，接收方的端口，发送失败的报文数据

如果MST被设置为0，则本次消息，不再会触发TA。
#### 1.6.4`接受动作RA
四个参数带参函数，参数分别是：

报文的类型名，发送方的IP，发送方的端口，报文发送方发送给我们的内容

### 1.7`关于接收器（Receiver）
接收器是接收方接受到某类报文后的一种处理方式，每一个接收器都对应一个接收器的**接受动作RA**（Receive Action），接收方一般的功能是给予发送方一些回复，当然有些也可以不给予回复。这个可以灵活搭配。接收方如果要给予回复信息，则这里的接受动作不再进行差错控制。

### 1.8`关于消息种类存储器(Message Type Memory)
OMTM(Output Message Type Memory)与IMTM(Input Message Type Memory)是事先再收发消息前，将某类消息存储到本地的实际存储介质

## 2`API调用如下
```
//创建某类报文 参数分别为：报文类名，完成动作，超时动作，生存时间
CM.createMessage(typeName,completionAction,timeoutAction,messageSurvivalTime);

//摧毁某类报文 参数分别为：报文类名
CM.destoryMessage(typeName);

//发送报文 参数分别为：报文类名，目标IP，目标端口，发送数据
CM.sendMessage(typeName,desIP,desPort,data);

//创建接受器 参数分别为：报文类名，接受动作
CM.createReceiver(typeName,receiveAction);

//摧毁接受器 参数分别为：报文类名
CM.destoryReceiver(typeName);

//接受端发送回执信息 参数分别为：报文类名，目标IP，目标端口，发送数据
CM.sendCallback(typeName, ip, port, data);

//重置CM类的报文录入
CM.reset();

//该函数放在UDP的监听处即可
CM.messageDistribution(originMessage, address, port);
//eg:如下
server.on('message', (msg, rinfo) => {
    CM.messageDistribution(msg, rinfo.address, rinfo.port);
});
```

## 3`使用范例
### 3.1`创建发送端代码与接收端代码
```
const CM = require('fangzhouconsistencymessage');
const usualPort = require('../config').UDPLISTEN;
console.log("Ready To Init ConsistencyMessage........")
//发送端代码(接收端可以不使用这段代码)
CM.createMessage('test', function (typeName, desIP, desPort, data) {
    console.log("已经成功发送报文", desIP, desPort, "，并接收到了数据", data);
}, function (typeName, desIP, desPort) {
    console.log("已经超时", typeName, desIP, desPort);
}, 4000);
//接收端代码(同理发送端不需要这段代码)
CM.createReceiver('test', function (typeName, srcIP, srcPort, data) {
    //这里没有用到srcPort，因为发送端使用UDP端口是无法接受我们回复过去的信息的，所以我们回发的端口号usualPort应当是我们事先商定好的
    console.log("接收到了来自", srcIP, srcPort, "的数据", data);
    CM.sendCallback('test', srcIP, usualPort, "谢谢老猥男的数据");
});
console.log("Init ConsistencyMessage Finished.");
//将添加好消息种类的CM暴露出去，供外部调用
module.exports = CM;
```
### 3.2`无论发送端还是接受端，都需要在UDP的接口处添加这段“分发处理代码”
```
CM.messageDistribution(msg, rinfo.address, rinfo.port);
```
其原本整体的udp编写文件为:
```
const config = require('./config');
//此处引用添加了消息了CM类
const CM = require('./CM/init');
module.exports = function (server) {
    server.on('error', (err) => {
        console.log(`服务器异常：\n${err.stack}`);
        server.close();
    });

    server.on('message', (msg, rinfo) => {
        CM.messageDistribution(msg, rinfo.address, rinfo.port);
    });

    server.on('listening', () => {
        const address = server.address();
        console.log(`Udp Listen At : ${address.address}:${address.port}`);
    });

    server.bind(config.UDPLISTEN);
}
```