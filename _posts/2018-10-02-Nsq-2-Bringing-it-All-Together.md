---
layout:     post                    # 使用的布局（不需要改）
title:    MQ(2) —— 一条消息是如何从生产到被消费的             # 标题 
subtitle:   #副标题
date:       2018-10-02              # 时间
author:     ZY                      # 作者
header-img: img/banner/The-Hobbit-Movie-HD-Wallpaper.jpg    #这篇文章标题背景图片
catalog: true                       # 是否归档
tags:                               #标签
    - Nsq
    - 消息中间件
    - 分布式
---

# Bringing It All Together

接着聊MQ.  

上一篇文章，讲的都是些细碎的知识点，现在，**让我们把这些知识点整合起来，来看看，一条消息，是如何从生产到被消费的。**  

![](/img/post/2018-10-02-Nsq-1/nsq-topic-channel-consumer.gif)  

首先，我们要启动各个服务，生产者、消费者、nsq、nsqlookup.  

假设消费者最先启动，它要消费topic为”order_created“的消息，这时候它向nsqlookup调用`/lookup`接口，试图获取对应topic的nsq。由于nsqlookup还没启动，因此获取失败，不过这并不影响消费者的启动流程，因为它会每隔一段时间，去尝试重新拉取最新的数据。  
![](/img/post/2018-10-02-Nsq-1/nsq-java-client-connect-failed.png)  

消费者可以使用nsq java客户端的示例代码来模拟：  
```java
public static void main(String[] args) {
        NSQLookup lookup = new DefaultNSQLookup();
        lookup.addLookupAddress("localhost", 4161);
        NSQConsumer consumer = new NSQConsumer(lookup, "order_created", "send_msg", (message) -> {
            System.out.println("received: " + message);
            //now mark the message as finished.
            message.finished();

            //or you could requeue it, which indicates a failure and puts it back on the queue.
            //message.requeue();
        });

        consumer.start();
    }
```
为了方便调试，我将向nsqlookup查询最新nsq信息的时间间隔，**由一分钟一次，改为了十秒一次**：  
com.github.brainlag.nsq.NSQConsumer#lookupPeriod:  
```java
private long lookupPeriod = 10 * 1000; // how often to recheck for new nodes (and clean up non responsive nodes)
```

接着，我们启动了nsq和nsqlookup，这下消费者可以调通nsqlookup的接口了，不过由于nsq上面还没有任何topic，因此`/lookup`接口返回的`producers`数组是空，因此消费者仍然无法向任何nsq订阅消息。  

然后，我们调用这条命令，在nsq上创建新的topic:  
```
curl -X POST http://127.0.0.1:4151/topic/create?topic=order_created
```
**nsq创建完topic后，会自动向nsqlookup注册新的topic节点。** 如下图，是我执行了创建topic命令后，nsq和nsqlookup控制台打印的日志：  

![](/img/post/2018-10-02-Nsq-1/nsq-create-topic.jpg)  

当消费者下次过来nsqlookup调用`/lookup`接口时，接口就会告诉它，已经有一台nsq，上面有”order_created“的topic了。于是消费者拿到那台nsq的ip和端口，和它建立连接，向它发送`sub`命令，带上topic和channel参数，订阅这台nsq上面的”order_created“的消息。

![](/img/post/2018-10-02-Nsq-1/nsq-client-subscribe-code.png)  

![](/img/post/2018-10-02-Nsq-1/nsq-client-subscribe.png)  

上图中，可以看到，第一次查询到的信息里，channel数组是空，建立完连接，订阅后，第二次再去查，就可以看到有新的channel。  

这是因为，**当消费者的channel不存在时，nsq将会创建一条新的channel**。和之前创建topic类似，创建完channel，nsq会向nsqlookup注册新的channel节点。不一样的是，**channel会在订阅时，自动创建，而topic，需要我们事先在nsq创建好。**  

然后，我们启动了生产者，生产者向nsq发布了topic为”order_created“的消息，在这里我们使用下面这条命令来模拟发布消息：  
```
curl -d 'hello world' 'http://127.0.0.1:4151/pub?topic=order_created'
```
消息发布给nsq后，就像之前讲的，**nsq会把消息复制到topic下的所有channel中，每个channel复制一份，接着channel再向和它建立连接的其中一个消费者实例，推送这条消息。**  

此时，在消费者侧，已经接收到了消息，控制台打印接收到的消息内容：  
![](/img/post/2018-10-02-Nsq-1/nsq-consumer-consume.png)  

你可以启动多个消费者，比如再启动一个不同channel的消费者，你会发现，两个消费者都会收到消息；而假如你启动的消费者，channel还是”send_msg“，那么两个消费者只有一台会收到消息，而且nsq默认的负载均衡策略是轮询，也就是这一次消费者1收到消息，下一次，就是消费者2收到消息。  

感兴趣的读者不妨在本地跑下nsq玩玩，尝试尝试。  
以下这几个文档足够让你玩high了：  

- [Nsq Installing](https://nsq.io/deployment/installing.html)
- [QUICK START](https://nsq.io/overview/quick_start.html)：介绍如何启动nsq和nsqlookup的
- [NSQD](https://nsq.io/components/nsqd.html)：介绍nsq restful命令的，在本地curl一下，就可以对nsq执行很多操作
- [NSQLOOKUPD](https://nsq.io/components/nsqlookupd.html)：介绍nsqlookup restful命令的

当然，文档都是针对Linux或者OS X的，如果你想在Windows上尝试，那我只能说，总有一种方式适合你。  

# 小结

这篇文章把上一节学到的各个组件串联起来，演示了

- 消费者是如何借助nsqlookup，和nsq建立连接
- 消息是如何被生产，乃至传递到消费者进行消费的

但是我们的视角还是比较粗略的，很多细节都没考虑到，比如：  

- **消息投递语义**：消息会不会在投递到消费者之前，被中断，导致消费没有被消费呢？
- 会不会出现一条消息被多次投递的情况？
- **消息顺序**：消息是有序的，还是无序的？
- **push or pull**: 为什么nsq要采用push，也就是nsq给消费者推送的方式，而不是消费者主动过来pull？
- 采用push，消费者侧如何做**流控**？
- ...  

这些细节，我们留到下次一起讨论。 

# 参考

- [Nsq官方文档](https://nsq.io/)
- [Nsq Java Client](https://github.com/brainlag/JavaNSQClient)


