---
layout:     post                    # 使用的布局（不需要改）
title:    Mysql可重复读（1） —— 快照何时创建             # 标题 
subtitle:   #副标题
date:       2019-01-22              # 时间
author:     ZY                      # 作者
header-img: img/banner/denys-nevozhai-1190332-unsplash.jpg    #这篇文章标题背景图片
catalog: true                       # 是否归档
tags:                               #标签
    - Mysql
    - MVCC
    - 事务
---

以前，对可重复读的理解，就是别的事务的提交，对当前事务的查询结果，不会产生影响；  

后来，知道事务在一开始的时候，会生成一个快照；  

不过这样的对可重复读的理解，依然肤浅。  

在我看来，要想真正弄懂可重复读，至少要把以下几个名词，能够串起来，解释清楚：  

- **快照读([consistent nonlocking reads](https://dev.mysql.com/doc/refman/8.0/en/innodb-consistent-read.html))**
- **当前读([locking reads](https://dev.mysql.com/doc/refman/8.0/en/glossary.html#glos_locking_read))**
- **MVCC**
- **gap lock**
- **next-key lock**
- **幻读**

从这一讲开始，我就试着用各种例子，把这些知识串起来，给大家讲清楚到底什么是**Repeatable Read**.  

先从简单的开始，**我们说的“快照”，是什么时候开始创建的？**  

有同学说，快照在begin的时候就创建了。  

是吗？  

我们建一张极简的表：
```sql
CREATE TABLE `t` (
  `id` int(11) NOT NULL,
  `c` int(11) DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB;
```
插入两条数据：
```sql
insert into t values(1,1),(2,2);
```

然后按照下面表格的顺序，在两个会话窗口执行如下sql语句：  
![](/img/post/2019-01-22-Repeatable-Read-1/sql-1.png)  

你可以像我这样，打开两个命令行窗口，分别执行：  
![](/img/post/2019-01-22-Repeatable-Read-1/ter-1.png)  

如果Mysql真的是在begin的时候，就创建了快照，那么session A执行select语句时，查询到的c应该是1，但是，实际查询到的，却是3，说明begin后，快照并没有立刻生成。  

于是我们试着把select语句放到session B的update语句之前：  
![](/img/post/2019-01-22-Repeatable-Read-1/sql-2.png)  

这次你会发现，session A在执行第二天select语句时，查询到的c还是1，说明快照已经在执行第一条select语句时生成了，session B的update对session A不产生影响。  

那么是不是就可以说，快照会在执行那些操作mysql数据库的sql语句时生成呢？  

并不是，**只有“快照读”的sql语句，才会生成快照**，比如**不加锁的select语句**；  

**而“当前读”的sql语句，是不会生成快照的**，比如update，select ... for update, select .. lock in share mode等；  

所以下面这个例子，session A在select时看到的还会是被session B修改的数据，因为在update时并没有生成快照：  
![](/img/post/2019-01-22-Repeatable-Read-1/sql-3.png)  

那你说，我就是想在begin时就生成快照呢？  

送你一条sql：  
```sql
start transaction with consistent snapshot; 
```

小结一下：  

- **可重复读的关键，来自于“快照”**
- **“快照”并不是在begin后就生成，而是在第一条“快照读”语句后才生成**

那么问题又来了，“快照”到底是啥？是对当前数据的全量拷贝吗？难道每开启一个事务，都要把当前数据库的数据拷贝一份出来？  

下一讲，咱们来聊聊可重复读的实现原理 —— MVCC。  








