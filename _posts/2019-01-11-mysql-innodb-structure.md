---
layout:     post                    # 使用的布局（不需要改）
title:     MySQL innodb 架构   # 标题 
subtitle:   #副标题
date:       2019-01-11              # 时间
author:     ZY                      # 作者
header-img: img/banner/20190128/miguel-angel-hernandez-1322895-unsplash.jpg    #这篇文章标题背景图片
catalog: true                       # 是否归档
tags:                               #标签
    - Mysql
---

引言：MySQL的设计之美

在上一讲：MySQL 是如何实现 ACID 中的 D 的？里，用了一个问题，给大家介绍了 MySQL 中的两个成员 binlog 和 redo log。然而，这只是 MySQL 家族里的两个小喽啰，Mysql 可以做到高性能高可靠，靠的绝对不只有他们俩。

Mysql 里还有什么其他成员呢？

对于 Mysql，要记住、或者要放在你随时可以找到的地方的两张图，一张是 MySQL 架构图，另一张则是 innodb 架构图：

img mysql 架构图

img innodb 架构图

遇到问题，或者学习到新知识点时，就往里套，想一想，这是对应这两张图的哪个模块、是属于具体哪个成员的能力。

存储引擎层，决定了你的 MySQL 会怎样存储数据，怎样读取和写入数据，也在很大程度上决定了 MySQL 的读写性能和数据可靠性。

对于这么重要的一层能力，MySQL 提供了极强的扩展性，你可以定义自己要使用什么样的存储引擎，InnoDB、MyISAM、MEMORY、CSV，甚至你可以自己开发一个存储引擎然后使用它。

> MySQL 的设计，非常具有美感，高内聚松耦合的原则在 MySQL 身上始终体现着，学习 MySQL，学的不只是如何更好的使用 MySQL，更是借鉴思考，学习如何更好的进行系统设计。

在自己写一个存储引擎之前，我们先来了解一下别人是怎么实现的，而 InnoDB，毫无疑问，是其中的佼佼者。

通常我们说 Mysql 高性能高可靠，都是指基于 innodb 存储引擎的 Mysql，所以，这一讲，先让我们来看看，除了 redo log，InnoDB 里还有哪些成员，他们都有什么能力，承担了什么样的角色，他们之间又是怎么配合的？



InnoDB 内存架构

1、Buffer Pool

> The buffer pool is an area in main memory where `InnoDB` caches table and index data as it is accessed.

正如上文提到的，MySQL 不会直接取修改磁盘的数据，因为这样做太慢了，MySQL 会先改内存，然后记录 redo log，等有空了再刷磁盘，如果内存里没有数据，就去磁盘 load。

而这些数据存放的地方，就是 Buffer Pool。

我们平时开发时，会用 redis 来做缓存，缓解数据库压力，其实 MySQL 自己也做了一层类似缓存的东西。

MySQL 是以「页」（page）为单位从磁盘读取数据的，Buffer Pool 里的数据也是如此，实际上，Buffer Pool 是`a linked list of pages`，一个以页为元素的链表。为什么是链表？因为和缓存一样，它也需要淘汰机制。

Buffer Pool 采用基于 LRU 的算法来管理内存：

img LRU

>  关于 Buffer Pool 的更多知识，诸如如何配置大小、如何监控等等：[Buffer Pool](https://dev.mysql.com/doc/refman/8.0/en/innodb-buffer-pool.html)

2、Change Buffer

上面提到过，如果内存里没有对应「页」的数据，MySQL 就会去把数据从磁盘里 load 出来，如果每次需要的「页」都不同，或者不是相邻的「页」，那么每次 MySQL 都要去 load，这样就很慢了。

于是如果 MySQL 发现你要修改的页，不在内存里，就把你要对页的修改，先记到一个叫 Change Buffer 的地方，同时记录 redo log，然后再慢慢把数据 load 到内存，load 过来后，再把 Change Buffer 里记录的修改，应用到内存（Buffer Pool）中，这个动作叫做 merge；而把内存数据刷到磁盘的动作，叫 purge：

- merge：Change Buffer -> Buffer Pool
- purge：Buffer Pool -> Disk

img Change Buffer

> The change buffer is a special data structure that caches changes to **secondary index** pages when those pages are not in the **buffer pool**. The buffered changes, which may result from INSERT, UPDATE, or DELETE operations (DML), are **merged** later when the pages are loaded into the buffer pool by other read operations.

上面是 MySQL 官网对  Change Buffer 的定义，仔细看的话，你会发现里面提到： Change Buffer 只在操作「二级索引」（secondary index）时才使用，原因是「聚簇索引」（clustered indexes）必须是「唯一」的，也就意味着每次插入、更新，都需要检查是否已经有相同的字段存在，也就没有必要使用 Change Buffer 了；另外，「聚簇索引」操作的随机性比较小，通常在相邻的「页」进行操作，比如使用了自增主键的「聚簇索引」，那么 insert 时就是递增、有序的，不像「二级索引」，访问非常随机。

> 如果想深入理解 Change Buffer 的原理，除了 MySQL 官网的介绍：[Change Buffer](https://dev.mysql.com/doc/refman/8.0/en/innodb-change-buffer.html)，还可以阅读下《MySQL技术内幕》的「2.6.1 - 插入缓冲」章节，里面会从 Change Buffer 的前身 —— Insert Buffer 开始讲起，很透彻。

3、Adaptive Hash Index

MySQL 索引，不管是在磁盘里，还是被 load 到内存后，都是 B+ 树，B+ 树的查找次数取决于树的深度。你看，数据都已经放到内存了，还不能“一下子”就找到它，还要“几下子”，这空间牺牲的是不是不太值得？

尤其是那些频繁被访问的数据，每次过来都要走 B+ 树来查询，这时就会想到，我用一个指针把数据的位置记录下来不就好了？

这就是「自适应哈希索引」（Adaptive Hash Index）。自适应，顾名思义，MySQL 会自动评估使用自适应索引是否值得，如果观察到建立哈希索引可以提升速度，则建立。

4、Log Buffer

> The log buffer is the memory area that holds data to be written to the log files on disk.

从上面架构图可以看到，Log Buffer 里的 redo log，会被刷到磁盘里。



内存和磁盘之间：操作系统缓存



InnoDB 磁盘架构

1、Tablespaces



2、Doublewrite Buffer



3、Redo Log



4、Undo Logs



未完待续

磁盘存储格式&索引



参考

- 《MySQL技术内幕》

