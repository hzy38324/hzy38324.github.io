---
layout:     post                    # 使用的布局（不需要改）
title:    MQ(5) —— Nsq vs Kafka             # 标题 
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

# Nsq vs Kafka

正如之前说的，Nsq是一款极简的消息中间件。  

通过前面几讲对Nsq的学习，我们可以更加轻松的上手其他的Mq。  

**这一节，就让我们在对比中，学习另一种Mq，Kafka，在对比中，加深对Mq的理解。**  

首先，先放上Nsq和Kafka的架构图。  

Nsq:  
![](/img/post/2018-10-02-Nsq-1/nsq-topic-channel-consumer.gif)  

Kafka:  
![图片来源：sookocheff.com](/img/post/2018-05-28-Kafka-Tutorial/brokers.png) 

在第一篇文章里，我演示了nsq是如何从一条队列，不断的解决各种问题，最后成为一个中间件的。  

同样，对于Kafka，它在演化为一个靠谱的中间件的过程中，也需要解决很多类似的问题。  

**1、如何让一个topic的消息，能够被多个消费者实例消费**  

在nsq，采用的是channel的方式，而kafka，则是引入了”消费者组“的概念：
![](/img/post/2018-10-02-Nsq-1/kafka-consumer-group.jpg)  

**2、如何让mq、生产者、消费者能够自动发现对方**  

我们知道，这需要一个类似于注册中心的中间件，nsq用的是nsqlookup，而kafka则直接采用了zookeeper:  
![](/img/post/2018-10-02-Nsq-1/kafka-architecture-kafka-zookeeper-coordination.png)  

**3、如何实现集群**  

nsq的集群比较”另类“，让每个生产者自己配套一个nsq，kafka的集群就比较”正常“，正如上面架构图展示的：
![图片来源：sookocheff.com](/img/post/2018-05-28-Kafka-Tutorial/brokers.png) 

另外，在一些实现细节上，两者也有所不同。  

**1、内存 vs 磁盘**  

Nsq把消息放到了内存，只有当队列里消息的数量超过`--mem-queue-size`配置的限制时，才会对消息进行持久化。  

而Kafka，则直接把消息存储到磁盘中。  

存储到磁盘？这样效率岂不是很低？Kafka知道大家有这样的疑虑，因而在它的官方文档里，写了一大段话来平息大家对磁盘存储的”怨恨“：[Kafka - Design File System](https://kafka.apache.org/documentation/#design_filesystem )  

大概意思是，我们对磁盘的用法做了改进，使得使用磁盘的性能比人们想象中的要快很多，不过里头的原理太过高深，还附上了篇论文，哀家没看懂，就不在这里和大家瞎比比了 .....  

Kafka觉得，反正最后也要进行持久化的，与其在内存不足的时候，匆匆忙忙去进行刷盘，不如直接就把数据放进磁盘：  

> rather than maintain as much as possible in-memory and flush it all out to the filesystem in a panic when we run out of space, we invert that. All data is immediately written to a persistent log on the filesystem without necessarily flushing to disk. In effect this just means that it is transferred into the kernel's pagecache.  

嗯，貌似有点道理，大家有兴趣的话可以点链接进去看看。  

**2、push vs pull**  

对于选择push还是pull，这个没有唯一的答案，各有利弊。  

push  

- 优点：**延时小**，几乎可以做到实时
- 缺点：**消费者端不好做流控**  很难做批量推送，不知道要推送多少合适
- 解决思路：参考[MQ（3）—— 刨根问底里](http://bridgeforyou.cn/2018/10/02/Nsq-3-Details/)头讲的nsq的流控策略

pull  

- 优点：消费者可以自己把握节奏
- 缺点：
	- **延时大** 	
	- **消费者可能经常有空pull**，即pull不到消息，造成浪费
- 解决思路：Kafka采用的是**阻塞式pull**

> To avoid this we have parameters in our pull request that allow the consumer request to block in a "long poll" waiting until data arrives

Kafka同样写了一大段文章，来解释他们为什么要采用pull: [Kafka: Push vs Pull](https://kafka.apache.org/documentation/#design_pull)

**3、数据备份**  

Nsq只把消息存储到一台机器中，不做任何备份，一旦机器奔溃，磁盘损坏，消息就永久丢失了。  

Kafka则通过partition的机制，对消息做了备份，增强了消息的安全性。  

**4、无序 vs 支持有序**  

Nsq不支持顺序消费，原因已经在之前提过：  

> 比如说channel A里现在有两条消息，M1和M2，M1先产生，M2后产生，channel A分别将M1和M2推送给了消费者 C1和C2，那么有可能C1比C2先处理完消息，这样是有序的；但也有可能，C2先处理了，这样M2就比M1先被处理，这样就是无序的。 

而Kafka则支持顺序消费，具体可以参考 [Kafka: Ordering Messege](https://medium.com/@felipedutratine/kafka-ordering-guarantees-99320db8f87f) 

要使用Kafka的顺序消费功能，必须满足几个条件：

- **要被顺序消费的消息，必须都放到一个partition里面**
- **partition只能被消费者组里的一个消费者实例消费**

比如，topic A的消息 都要顺序消费，那么topic A只允许有一个partition；  

又比如，topic A的消息里面，userId相同的消息，要被顺序消费，那么就要根据userId字段做hash，保证相同userId的消息，去到同一个partition。  

**5、消息投递语义**  

之前说过，消息投递语义(Message Delivery Semantics)有三种：

- **最多一次(At most once)**
- **至少一次(At least once)**
- **准确一次(Exactly once)**

Nsq只支持至少一次，也就是说，消息有可能被多次投递，消费者必须自己保证消息处理的幂等性。  
而Kafka则支持准确一次，具体可以参考下面两篇文章：  

- [Kafka: Message Delivery Semantics](https://kafka.apache.org/documentation/#semantics)
- [Exactly-once Semantics are Possible: Here’s How Kafka Does it](https://www.confluent.io/blog/exactly-once-semantics-are-possible-heres-how-apache-kafka-does-it/)

# 小结

这篇文章，通过Nsq和Kafka的对比，讲解了一些Kafka的特性，如果读者想对Kafka有进一步了解，不妨看看我之前写的一篇[Kafka简明教程](http://bridgeforyou.cn/2018/05/28/Kafka-Tutorial/)  

同时，我们也看到了相比于Nsq，Kafka更加强大，弥补了Nsq的一些“缺点”，而有赞也借鉴了Kafka的实现思路，对Nsq进行了自研开发，下一讲就一起来看看有赞是如何对Nsq进行改进的。  

# 参考

- [Nsq官方文档](https://nsq.io/)
- [Kafka官方文档](https://kafka.apache.org/documentation/)


