---
layout:     post                    # 使用的布局（不需要改）
title:     如何选择数据库    # 标题 
subtitle:   #副标题
date:       2019-09-23              # 时间
author:     ZY                      # 作者
header-img: img/banner/20190128/miguel-angel-hernandez-1322895-unsplash.jpg    #这篇文章标题背景图片
catalog: true                       # 是否归档
tags:                               #标签
    - 数据库
---

-> why nosql 搜集资料

https://www.alachisoft.com/nosdb/why-nosql.html



原则
讲故事 例子
思维导图帮助思维扩散

《数据库系统概念》

通俗易懂 https://juejin.im/post/5b6d62ddf265da0f491bd200

https://en.wikipedia.org/wiki/NoSQL

https://en.wikipedia.org/wiki/Database

====================



我们正在做一个电子书的小程序。

1.0 层次模型数据库

用户购买，生成订单，订单详情里有用户购买的电子书：

![层次模型数据库](/img/post/2019-09-23-database-choose/h-db.png)  

一层一层铺开，一对多，一又对多，这是「层次（Hierarchical）模型数据库」。



2.0 网状模型数据库

一笔订单可以购买多本电子书，一本电子书也可以被多笔订单购买：

![网状模型数据库](/img/post/2019-09-23-database-choose/n-db.png)  

这就形成了「多对多」的「网状（Network）模型数据库」。

为什么没人用网状模型数据库？

为什么都在用关系模型数据库？

你会说，这样不方便遍历所有订单。

并不会，你再加一个根节点就好：

![](/img/post/2019-09-23-database-choose/root-order.png) 

你会说，这样查找效率很低。

也不会，因为可以换下数据结构，比如换成 B+ 树。

为什么没人用网状模型数据库？

为什么都在用关系模型数据库？



3.0 关系模型数据库

无论是层次模型还是网状模型，程序员看到的，都是实实在在的物理存储结构。

查询时，你要照着里面的数据结构，用对应的算法来查；

插入时，你也要照着数据结构，用对应算法来插入，否则你就破坏了数据的组织结构，数据也就坏掉了。

所以，我们经常用的关系数据库，虽然看似一切都理所当然，数据库就该这样嘛，因为我们都没用过前面两种数据库，但其实，它做出了一个革命性的变革：

**用逻辑结构（logical representation of data）代替物理结构（physical representation of data）**

所谓「逻辑结构」，也就是我们经常看到的「表格」，User 是一张表格，Order 是一张表格，Book 又是一张表格，它们之间的关系，用 id 来关联，这些 id，可能是 number 类型，也可能是 string 类型：

![](/img/post/2019-09-23-database-choose/r-db.png) 

但你看到的，不一定就是实际的，你看到的只是让你方便理解的「逻辑结构」，真实数据自然不是这样按表格来存储，表格无异于一个数组，数组查询是很慢的。

真实的「物理结构」，也许还是像「层次模型」和「网状模型」一样，是复杂的数据结构。

但到底是怎样的数据结构，你都无需关心，你只需把它想象成一张「表」去操作，就连可视化工具，都会帮你把数据可视化成表，来方便你理解。

这个观念的提出，来自于 1970 年 Codd 的一篇论文，[A Relational Model of Data for Large Shared Data Banks](https://www.seas.upenn.edu/~zives/03f/cis550/codd.pdf)：

> Future users of large data banks must **be protected from having to know how the data is organized in the machine** (the internal representation). 
>
> Activities of users at terminals and most application programs should **remain unaffected when the internal representation of data is changed** and even when some aspects of the external representation are changed. 
>
> —— Codd

Codd 的这种思想，其实就是经济学里提到的：**分工产生效能**。

程序员们不需要直接和物理结构打交道，只负责告诉数据库，他想做什么，至于数据是如何存储、如何索引，都交给数据库，最终他们看到的就是一张张特别直观、特别好理解的 excel 表格。

而数据库则把维护物理结构的复杂逻辑，交给了自己， 对程序员屏蔽了复杂的实现细节。

开发时写的代码少了，耦合性降低了，数据也不容易损坏 …… 也就提高了生产效率（productive）。

**一切能用同样的耗能，带来更多效能的技术，都会被广泛使用。**



nosql

https://stackoverflow.com/questions/8729779/why-nosql-is-better-at-scaling-out-than-rdbms

https://www.alachisoft.com/nosdb/why-nosql.html

那么后来为什么又有了 nosql 呢？

在 rdbms 被发明的时代，软件多用于大型企业，比如银行、金融等等，人们对数据的要求非常纯粹：准确、可靠、安全，让数据按照期望，正确的写入，不要给老子算错钱就好。于是有了事务的 ACID，原子性、一致性、隔离性和持久性。

那时候用网络的人很少，通过终端来访问客户端，从而操作数据库的人，更少，自然的，数据量和访问量都跟现在没法比，一台机器，足矣，最多再来个一主多从：

img https://zhuanlan.zhihu.com/p/67325171

后来，你知道的，每个人手里都有个手机，每分每秒，都有成千上万的数据，写入你的数据库、从你的数据库被查出，于是有了「分布式」，有了 BASE 和 CAP。这时候，rdbms 就会发现，自己之前的那一套 ACID，竟然有点作茧自缚了。

为了保证事务的隔离性，要进行加锁，分布式，那就要对多台机器的数据进行加锁；

为了保证事务的原子性，在机器 A 的操作和在机器 b 的操作，要么一起成功，要么一起失败；

…...

这些都要去不同节点的机器进行通讯和协调，实现起来非常复杂，而且要付出更多的网络 IO，影响读写性能。

ACID 在分布式系统上实现起来就会变得难以实现，即使实现了，也要付出很大的性能成本，于是才有了后来的各种「分布式一致性协议」，Paxos、Raft、2PC …… 而 Mysql 也提供了各种方案来实现分布式，当然，这些方案自然是很复杂的：

img  Ndb

rdbms 从一开始单机的 ACID，到后来利用 Paxos/Raft/2PC 实现 分布式，绕了一大圈；

而 nosql，从一开始设计，就是奔着分布式去的：

img

总结一下，nosql 比 rdbms 有更强的扩展性，可以充分利用分布式系统来提升读写性能和可靠性。这不是谁设计好坏的问题，而是跟他们的时代背景有关：rdbms 诞生于互联网萌芽的时代，那时数据的准确、可靠是最重要的，而 nosql 诞生于互联网快速发展普及的时代，大数据、分布式、可拓展性成了另一个数据库的重要特性。

再精炼一下：

rdbms 首先得是准确、可靠，然后才向更高的「可拓展性」发展；

而 nosql 生而分布式，可拓展性强，然后才向更高的「准确性」发展。



-> 关系模型？范式？

` 数据结构对比（大对象 vs 小对象）



关系型数据库用起来是非常放心的

事务 ACID 原子性、一致性、隔离性、持久性

各种数据范式 严格



关系型数据库太严格、太谨慎，在一些使用场景上，使用关系型数据库就像杀鸡用了牛刀



从 ACID 到 BASE / CAP

而 nosql 则没有这么多承诺，它的一致性，一般都是最终一致性，当然你可以选择强一致，那自然就要付出点性能作为代价，当然你还可以弱一致，这样会更不安全，但是更快，取决于你对数据的要求



nosql 数据更灵活、读取更方便，但最重要的一点，是扩展性



如果你要求数据十分准确可靠，比如涉及到「钱」的，那最好是用关系型数据库

可如果你对数据要求没那么严格，只是用来查询、统计，极少部分数据有出入不影响，那就没必要杀鸡用牛刀




列式数据库 

HBase BigTable

为什么需要列式数据库：按列统计



K-V 数据库



文档数据库



全文搜索引擎



图形数据库



总结

> 设计实践中，要基于需求、业务驱动架构，无论选用RDB/NoSQL/DRDB,**一定是以需求为导向，最终数据存储方案必然是各种权衡的综合性设计**



参考
层次 网状 关系型

Codd https://www.seas.upenn.edu/~zives/03f/cis550/codd.pdf

https://stackoverflow.com/questions/2371066/historically-what-made-relational-databases-popular

https://pediaa.com/what-is-the-difference-between-hierarchical-network-and-relational-database-model/

廖雪峰 https://www.liaoxuefeng.com/wiki/1177760294764384/1179613436834240
