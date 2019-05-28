---
layout:     post                    # 使用的布局（不需要改）
title:    Mysql Replication 简明教程            # 标题 
subtitle:   #副标题
date:       2019-05-28              # 时间
author:     ZY                      # 作者
header-img: img/banner/20190128/miguel-angel-hernandez-1322895-unsplash.jpg    #这篇文章标题背景图片
catalog: true                       # 是否归档
tags:                               #标签
    - Mysql
---

# 主从架构图

学习也好，分析问题也好，都要有系统思维。  

当别人还停留在只有一个Mysql实例的认知时，你要知道，其实生产环境的Mysql，最起码也应该长这样：  

![from https://dev.mysql.com/doc/refman/5.7/en/replication-solutions-switch.html](/img/post/2019-05-28-Mysql-Master-Slave/redundancy-before.png)  

# 为什么要主从

几乎每个上了生产环境的系统，都不可能是单机的，通常都采用了主从架构。  

而为什么要采用主从，只需记住这几个关键字：**SPOF**，**读写分离**，**Backup**，**Scale-Out**：

- **防止SPOF**：SPOF，single point of failure，如果你只有一个Mysql实例，那么它的死亡，就意味着你数据库服务的终止，也就意味着你整个系统的奔溃。但是如果你挂了一个Mysql，还有千千万万个Mysql顶上去，那就稍微牛B些了。
- **读写分离**：通常我们的业务，都是读多于写，这时候就可以把写交给Master，把读交给其他的Slave
  - 比如你想要**备份（backup）数据**，如果直接在Master上执行mysqldump，很明显，会影响到线上的写操作，这时候就可以找一台slave，安安静静的执行；
  - 比如你发现读请求越来越多了，这时候只需要加多几台Slave，来分担下读请求，这就是**Scale-Out，拓展性**；
  - 又比如，你想对数据进行分析，统计一下最近几天各种类型的订单数量，这时候，在一台Slave上默默操作，或者从一台Slave上，把数据导出到hadoop，交给hadoop去分析，都可以。

# 两个动作

每个支持主从架构的系统，都要考虑要如何实现两个动作：**主从复制**和**主从切换**。

平时数据要从Master复制到各个Slave；而在Master宕机时，则要进行主从切换，将Master切换到其中一台Slave上。

下面就来聊聊Mysql是如何实现这两个动作的。

# 主从复制

Master写入数据后，需要把数据同步给Slave，这就是主从复制。

**那么Master把这些数据，以什么样的协议、格式发给Slave呢？由于不同系统的功能不同，他们用于存储数据的数据结构也不同，所以，他们之间的复制方式也各有差异。**

比如redis，发的就是rdb或者aof文件，而Mysql，则发的是bin log。

bin log有三种格式，statement/row/mixed ，具体可以参考 [Replication Formats](https://dev.mysql.com/doc/refman/8.0/en/replication-formats.html) 。

那么bin log又是如何从Master发给Slave，又是如何被Slave执行的呢？

Mysql用了[三个线程](https://dev.mysql.com/doc/refman/8.0/en/replication-implementation-details.html)，来实现这个过程，一个在Master，两个在Slave：

- **Binlog dump thread**：负责把bin log发给slave
- **Slave I/O thread**：负责接收master发过来的bin log，并把它暂时存放在一个叫**relay log**的日志文件
- **Slave SQL thread**：读取relay log，执行里面的内容

至于为什么mysql要这么设计，其实仔细观察，就会发现这整个过程，有点像消息中间件处理消息的过程，所以问题就变成我之前写的另一篇文章：[为什么要使用消息中间件](https://zhuanlan.zhihu.com/p/46201859)

你看，**知识是互通的**。  

# 主从延迟

在讲主从切换之前，我们来聊下主从延迟。  

有主从的系统，都会有延迟，那种在Master写入后，Slave马上同步发生变化的事情，想想就知道，是不存在的。  

那么导致主从延迟的原因有哪些呢？  

可能是**Slave机器性能太差**，在Master执行1s的语句，在Slave要执行5s，通常在经济拮据的公司就会这么干，搞一台很一般的机器，来做Slave；  

咱们不差钱，那就让Slave的机器和Master一样优秀。  

可是这样还是主从延迟很大，为啥？  

噢，原来咱们**把太多的查询分析业务放slave了**，各个业务端，在分析数据时，为了不影响Master，都选择走Slave，Slave压力太大，自然延迟了。  

于是我们有了一主多从，Slave你不是忙不过来吗，那我给你找多几个帮手。  

这下应该延迟会小了吧？  

并没有，我们发现系统偶尔还是会有很大延迟，查了很久，发现是Slave在执行一个耗时10s的事务，等执行完commit时，Slave已经延迟了10s。  

这下知道为什么尽量不要写**大事务**了吧。  

# 主从切换

现在可以来讲「主从切换」了。  

**正因为有上面的「主从延迟」，才有了当Master宕机时，我们在一致性和可用性之间寻求优先级的纠结。**  

其实也就是CAP理论里经常遇到的选择，在P（分区容忍性）必须满足的情况下，到底是选择C（强一致性）还是A（可用性）。  

![from https://dev.mysql.com/doc/refman/5.7/en/replication-solutions-switch.html](/img/post/2019-05-28-Mysql-Master-Slave/redundancy-after.png)  

如果要保证强一致性，那么切换时就有这几个步骤：

- 把原来的Master，设置为read-only = true，这个时刻记为time1；
- 等待Slave执行完Master发给它的bin log，直到Slave和Master一致，这个时刻记为time2；
- 现在一致了，可以把slave设置为read-only = false，即可写入

在这个过程中，从time1到time2的时间，系统是无法被写入的，即不可用。  

这个不可用的时间，取决于切换的时候，slave和master的延迟时间，延迟的越长，同步完成需要的时间就越长，不可用的时间也就越长。  

保证强一致性，就会牺牲可用性，如果你不想系统有不可用的时间呢？那就得牺牲强一致性，因为你必须在Slave和Master还没完全同步时，就把Slave切换为Master。  

主从数据不一致，会有什么问题呢？思考题。  

# 总结

这篇文章只是在讲Mysql的主从吗？  

我们总会说，技术那么多，还日新月异的，好像每天都有新的很厉害的技术出来，学不动。  

**但其实，如果学一项技术，就只是在学一项技术，而不去举一反三，发现知识背后通用的规则，那你之前学的知识，就只是在占用你大脑的内存，对你之后学的东西，没任何帮助。**  

**但是如果你可以把所学的知识，串起来，形成一个体系，用系统的角度去看他们，那就不一样了。**  

比如今天我学了Mysql主从，那么当我们下次在学习其他系统的主从架构时，比如说redis，就可以照着今天这个思路去学习：

- redis的主从架构长什么样子？
- redis主从之间如何进行复制，数据格式是怎么样的？
- redis主从延迟的原因有哪些？
- master宕机时，redis如何进行主从切换？
- ...  

知识都是通的。

# 留个问题

现在我们学会用「主从」的角度来看待mysql，而不再是一个独立的机器。  

有什么用呢？留个问题好了。  

我们在业务中经常会用到外键，比如有两张表，一张是「方案表 plan」，另一种是「方案适用员工表 plan_staff」，plan_staff里有一个字段，plan_id，指向了plan表的主键，这样做，有问题吗？  

# 参考

- [Mysql Replication](https://dev.mysql.com/doc/refman/8.0/en/replication.html)
- Mysql实战45讲 丁奇













