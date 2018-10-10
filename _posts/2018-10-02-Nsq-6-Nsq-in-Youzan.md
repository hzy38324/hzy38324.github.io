---
layout:     post                    # 使用的布局（不需要改）
title:    MQ(6) —— Nsq in 有赞             # 标题 
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

# 有赞自研Nsq

上篇文章，我们对比了Nsq和Kafka两个消息中间件，Kafka的功能上更为强大，弥补了Nsq的一些不足，比如对顺序消费的支持、数据备份等等。  

那么，如果你还是想用Nsq，但同时你还想让消息能够被顺序消费，怎么办？  

一个字，改。别忘了Nsq是开源的，所有的代码都可以在[Github](https://github.com/nsqio/nsq)上找到，你可以随心所欲地对Nsq的代码进行改造。  

有赞就是基于Nsq的源码，同时借鉴了Kafka的一些实现思路，对Nsq进行了自研改造。  

如果你在Google上搜索“nsq github”，在Nsq官方Github的下一条，就可以看到[有赞自研的Nsq](https://github.com/youzan/nsq):  

![](/img/post/2018-10-02-Nsq-1/nsq-github.png)  

可能有同学会问，为什么不直接用Kafka呢？  

如果看了上一篇文章，你就会知道，Kafka是pull的，在消息实时性上肯定不及采用push的Nsq.  

所以如果业务上对实时性要求很高，那么采用push类型的MQ更为合适。  

Kafka比较适合于大数据处理之类的业务，我生成一个大数据分析的任务，交给Kafka，消费者那边什么时候有空了，再从Kafka那边pull过来进行处理。  

另外，Nsq是用Go语言写的，很适合拥有Go技术栈能力的公司进行自研开发。  

正如上面提到的，有赞之所以对Nsq进行改造，主要是因为Nsq有几个缺陷让有赞很难受：  

- 生产者不能动态发现nsq
- 数据缺少备份
- 无法实现顺序消费

下面这张图，是有赞自研后的nsq架构图：  
![](/img/post/2018-10-02-Nsq-1/nsq-youzan.jpg)  

现在再来看看，有赞解决这三个问题的思路。  

1、生产者不能动态发现nsq  
nsq官方推荐的集群策略，要求每个生产者都配置一个nsq，这样有两个问题：  

- 每增加一个生产者，就要增加一个nsq，有点浪费
- 如果生产者配套的nsq挂了，这个生产者就不能发布消息

解决方案：让生产者像消费者那样，通过nsqlookup来动态查找nsq的消息。  

2、数据缺少备份  
之前的文章中说过，nsq选择把消息放到内存中，只有当队列里消息的数量超过`--mem-queue-size`配置的限制时，才会对消息进行持久化，把消息保存到磁盘中，简称”刷盘“。  

但是即使将`--mem-queue-size`设置为0，即每条消息都会保存到磁盘（当然这样会很影响效率），也不能保证数据的安全，一旦nsq节点磁盘受损，数据还是会丢失。  

我们需要对数据进行复制，才能实现消息的真正可靠性。  

有赞借鉴了Kafka的partition机制，把消息复制到多个nsq的partition中，比如topic A的消息，配置了两个partition，一个在nsq A，另一个在nsq C，那么一旦有新的topic A的消息被生产，消息就会被复制到这两个nsq中，原理和Kafka的一致，消息先被发布到leader partition，leader partition再把消息复制到其他partition。  
![](/img/post/2018-10-02-Nsq-1/nsq-youzan-partition.jpg)  

同时，有赞也对进来nsq的消息，直接进行刷盘，不再等队列里消息的数量超过`--mem-queue-size`配置的限制时，才会对消息进行持久化，channel主动过来磁盘读取消息，下面是改造前和改造后，消息读取方式的对比：  
![](/img/post/2018-10-02-Nsq-1/nsq-youzan-topic-read-change.jpg)  

3、无法实现顺序消费  
有赞nsq实现顺序消费，同样借鉴了Kafka的实现思路：  

- 相同ID的，只会去到相同的partition
- 调整并发消费策略, 保证同一时刻只会投递一条消息进行消费, 等待上一次ack成功后才继续投递下一条消息

![](/img/post/2018-10-02-Nsq-1/order-msg.jpg)  

# 参考

- [有赞技术博客](https://tech.youzan.com/tag/nsq/)
- [有赞Nsq](https://github.com/youzan/nsq)
- [有赞Nsq Java Client](https://github.com/youzan/nsqJavaSDK)
- [Nsq官方文档](https://nsq.io/)


