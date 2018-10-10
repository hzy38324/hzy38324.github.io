---
layout:     post                    # 使用的布局（不需要改）
title:    MQ(3) —— 刨根问底             # 标题 
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

# 一些细节

前面两节，我们分别从微观和宏观的角度，了解了[Nsq的几个组件](http://bridgeforyou.cn/2018/10/02/Nsq-3-Details/)，以及[一条消息是是如何被生产和消费的](http://bridgeforyou.cn/2018/10/02/Nsq-2-Bringing-it-All-Together/)。  

这一节，咱们再次把镜头拉近，来看看nsq内部实现的几个有趣的细节。  

**1、消息至少被投递一次**  
这是nsq的[Guarantees](https://nsq.io/overview/features_and_guarantees.html#guarantees)中的一个：

> messages are delivered at least once

消息投递策略，是消息中间件的特有属性，不同的消息中间件，对投递策略的支持也不同。比如Kafka，就支持最多一次（At most once）、至少一次(At lease once)、准确一次(Excatly once)三种策略，而nsq，则只支持最常见的一种，也就是至少一次。  

怎样保证消息至少被投递一次呢？  

如果消费者收到消息，并成功执行，那么就给nsq返回`FIN`，代表消息已被成功执行，这时nsq就可以把内存中，也就是channel里的消息干掉；  

而如果消费者处理消息时发生了异常，需要重试，那么就给nsq返回`REQ`，代表requeue，重新进入队列的意思，nsq就会把消息重新放到队列中，再次推送给消费者(这一次可能是另一个消费者实例)。如果消费者迟迟没有给nsq回响应，超过了最大等待时间，那么nsq也会将消息requeue.  

**所以，消费者必须保证操作的幂等性。**  

**2、重试次数**  
nsq推送过来的消息里，有个`attempts`字段，代表着尝试的次数，一开始是1，每次客户端给nsq会`REQ`响应后，nsq再次推送过来的消息，`attempts`都会加1，消费者可以按照自己的需要，对重试次数进行限制，比如希望最多尝试6次，那么就在消费者的处理逻辑中，判断`attempts <= 6`，是，则执行处理逻辑，否则，打印日志或者做其他处理，然后直接返回`FIN`，告诉nsq不要再重试。  

**3、消息无序性**  
消息是否有序，是消息中间件的特有属性。通过上面的分析，很明显，nsq的消息是无序的，这也在nsq官网里的[Guarantees](https://nsq.io/overview/features_and_guarantees.html#guarantees)中有提到：  

> messages received are un-ordered

比如说channel A里现在有两条消息，M1和M2，M1先产生，M2后产生，channel A分别将M1和M2推送给了消费者 C1和C2，那么有可能C1比C2先处理完消息，这样是有序的；但也有可能，C2先处理了，这样M2就比M1先被处理，这样就是无序的。  

正是由于这种一有消息就推送的策略，nsq里的消息处理是无序的。  

**4、push or pull**  
push还是pull，这也是在设计一个消息中间件时，必须要考虑的问题。**Kafka用的是pull，而Nsq采取的是push。**  

相比于pull，push的好处不言而喻 —— **消息处理更加实时**，一旦有消息过来，立即推送出去，而pull则具有不确定性，你不知道消费者什么时候有空过来pull，因此做不到实时消息处理。这也是有赞只把Kafka用在那些对实时性要求不高的业务上的原因，比如大数据统计。  

也正是因为采用了push，**nsq选择把消息放到内存中**，只有当队列里消息的数量超过`--mem-queue-size`配置的限制时，才会对消息进行持久化，把消息保存到磁盘中，简称”刷盘“。  

> nsqd provides a configuration option --mem-queue-size that will determine the number of messages that are kept in memory for a given queue

而采用pull的Kafka，则直接把消息存储到磁盘。  

**push + 内存存储，or pull + 磁盘存储，这也是消息中间件设计时的一些套路。**  

当然，push机制也有缺陷，那就是当消费者很忙碌的时候，你还一直给它push，那只会逼良为娼，所以采用push的消息中间件，必须要进行流控。  

> 关于push和pull的分析，后面再和大家深入探讨，有兴趣的同学可以先看下Kafka官网的这篇分析：[Push vs Pull](https://kafka.apache.org/documentation/#design_pull)

**5、流控**  
Nsq流控的方式非常简单，当消费者和nsq建立好连接，准备好接受消息时，会给nsq回一个`RDY`的响应，同时带上一个`rdy_count`，代表准备接受消息的数量，于是nsq会给消费者推送消息，每推送一条，对应连接的`rdy_count`就减1(如果是批量推送，则批量减)，直到连接的`rdy_count`变成0，则不再继续推送消息。  

当消费者觉得自己可以接收很多消息时，只需再发一次`RDY`命令，就可以更新连接的`rdy_count`，nsq就会继续给消费者推送消息。  

在java客户端实现中，采取的策略是，如果发现已经处理完超过一半的消息，就再去发`RDY`消息，要求nsq送更多消息过来。  
com.github.brainlag.nsq.NSQConsumer#processMessage：  
![](/img/post/2018-10-02-Nsq-1/nsq-client-request-more.png)  


# 参考

- [Nsq官方文档](https://nsq.io/)
- [Nsq Java Client](https://github.com/brainlag/JavaNSQClient)


