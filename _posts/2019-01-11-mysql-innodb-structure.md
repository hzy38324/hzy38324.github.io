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



2、Change Buffer



3、Adaptive Hash Index



4、Log Buffer



内存和磁盘之间：操作系统缓存



InnoDB 磁盘架构

1、Tablespaces



2、Doublewrite Buffer



3、Redo Log



4、Undo Logs



未完待续

磁盘存储格式&索引



参考

