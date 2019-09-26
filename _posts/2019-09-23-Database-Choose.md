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

《数据库系统概念》

通俗易懂 https://juejin.im/post/5b6d62ddf265da0f491bd200

https://en.wikipedia.org/wiki/NoSQL

https://en.wikipedia.org/wiki/Database



层次 网状 关系型

Codd https://www.seas.upenn.edu/~zives/03f/cis550/codd.pdf

https://stackoverflow.com/questions/2371066/historically-what-made-relational-databases-popular

https://pediaa.com/what-is-the-difference-between-hierarchical-network-and-relational-database-model/

廖雪峰 https://www.liaoxuefeng.com/wiki/1177760294764384/1179613436834240



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

业务越来越复杂，不再只是简简单单的增删改查

关系模型数据库太严格、太谨慎，在一些使用场景上，使用 nosql 就像杀鸡用了牛刀

分布式？关系模型数据库不支持分布式？大数据？拓展？



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

