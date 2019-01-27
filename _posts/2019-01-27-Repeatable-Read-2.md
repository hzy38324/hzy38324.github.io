---
layout:     post                    # 使用的布局（不需要改）
title:    Mysql可重复读（2） —— xxx             # 标题 
subtitle:   #副标题
date:       2019-01-22              # 时间
author:     ZY                      # 作者
header-img: img/banner/donald-giannatti-1188271-unsplash.jpg    #这篇文章标题背景图片
catalog: true                       # 是否归档
tags:                               #标签
    - Mysql
    - MVCC
    - 事务
---

上一讲最后抛出了一个问题，Mysql可重复读的“快照”到底是啥？  

是对当前数据的全量拷贝吗？每开启一个事务，都要把当前数据库的数据拷贝一份出来？  

很明显不是。  

一方面，这样做太消耗内存了，另一方面，这样会很慢。  

那么Mysql是如何实现“快照”的呢？  

我们还是用上一讲的例子：  
![](/img/post/2019-01-22-Repeatable-Read-1/sql-2.png)  

我们已经知道，Session A在第二次select时，查询到的结果和第一次select时一样，也就是说，Session B的update，对Session A来说，不可见，Mysql是如何做到的呢？  

**很简单，也很绝妙 —— 数据版本，也就是我们常说的MVCC，多版本并发控制。**  

下面讲具体实现。  

Innodb里面，每行数据，都可以有多个版本，每个版本都有一个字段**trx_id**，记录生成这个版本的事务的ID。  

假设一开始，id=1这行数据，只有一个版本，trx_id是90，意味着生成这个版本的事务ID是90：  
![](/img/post/2019-01-27-Repeatable-Read-2/mvcc-1.png)  

这时候Session A开始了，从上一讲，我们已经知道，begin时并不会生成快照，快照在第一次select时才会生成，那么第一次select时，session A都做了什么呢？  

**session A只需要做一件事：用一个数组，来记录当前活跃的事务ID。**  

假设session A的事务ID是97，当前还有另外两个事务，事务ID是94、96，所以session A会生成一个[94,96,97]的数组。  

这个数组有什么用？后面你就知道了。  

接着，session B执行了update语句，来更新id=1这一行数据，给这一行数据生成一个新的版本，假设session B的事务ID是98，因此这行数据就有了两个版本：  
![](/img/post/2019-01-27-Repeatable-Read-2/mvcc-2.png)    

这时候，session A又来select了，当前版本是session B生成的，那session A是如何找到之前的版本的呢？  

这时候，session A一开始生成的事务数组就派上用场了，session A的事务数组是[94,96,97]，最小事务ID是94，最大事务ID是97，所以，当它遇到一行数据时，会先判断这行数据的版本号X：  

- 如果X小于94，那么意味着这行数据，在session A开始前就已经提交了，应该对session A可见
- 如果X大于97，那么意味着这行数据，是在session A开始之后，才提交的，应该对session A不可见
- 如果X在位于[94，97]这个区间内，那么分两种情况：
	- 如果X在数组里面，比如X是96，那么意味着，当session A开始时，生成这个版本的数据的事务，还没提交，因此这行数据对Session A不可见
	- 如果X不在数组里面，比如X是95，那么意味着，当session A开始时，生成这个版本的数据的事务，已经提交，因此这行数据对Session A可见

好，现在session A开始遍历id=1这行数据的所有版本：  
![](/img/post/2019-01-27-Repeatable-Read-2/mvcc-2.png)    

当前版本是98，大于97，所以不可见，继续看上一个版本；  

再往上，版本是90，小于94，可见，就它了，所以session A select出来的id=1的数据，c的值是1。  
当然，这样的人肉判断实在太麻烦了，在《Mysql实战45讲》里，丁奇给出了这样一个**“等价判断”可见性的原则**：  

- **版本未提交，不可见；**
- **版本已提交，但是是在快照创建后提交的，不可见；**
- **版本已提交，而且是在快照创建前提交的，可见。**

这其实就是可重复读的想要实现的效果。  

最后再给一个复杂点的例子，大家运用上面的原则，来预测sql语句的查询结果：  
![](/img/post/2019-01-27-Repeatable-Read-2/mvcc-3.png)   

小结一下：  

- **“快照”不是全量拷贝，而是利用了数据多版本的特性，也就是MVCC**
- **MVCC的核心在于每个事务自己维护的一个事务ID数组**
- **可以用“等价原则”来判断数据版本的可见性**

问题又来了，这些不同版本的数据，是物理存在于内存或者磁盘中的吗？  
![](/img/post/2019-01-27-Repeatable-Read-2/mvcc-2.png)    

# 参考

- 《Mysql实战45讲》丁奇
- [Innodb Transaction Isolation Levels](https://dev.mysql.com/doc/refman/8.0/en/innodb-transaction-isolation-levels.html)







