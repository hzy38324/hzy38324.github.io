---
layout:     post                    # 使用的布局（不需要改）
title:    Mysql锁：灵魂七拷问             # 标题 
subtitle:   #副标题
date:       2019-03-26              # 时间
author:     ZY                      # 作者
header-img: img/banner/20190128/tim-foster-1322575-unsplash.jpg    #这篇文章标题背景图片
catalog: true                       # 是否归档
tags:                               #标签
    - Mysql
---

# 1 缘起
假设你想给别人说明，Mysql里面是有锁的，你会怎么做？  

大多数人，都会开两个窗口，分别起两个事务，然后update同一条记录，在发起第二次update请求时，block，这样就说明这行记录被锁住了（如果是RR，那么锁住的不只是这行记录）：

![](/img/post/2019-03-26-Mysql-Lock/sql-1.png)  

# 2 禁锢
问题来了，貌似只有显式的开启一个事务，才会有锁，如果直接执行一条update语句，会不会加锁呢？

比如直接执行：

```sql
update t set c = c + 1 where id = 1;
```

这条语句，前面不加begin，不显式开启事务，那么Mysql会不会加锁呢？

直觉告诉你，会。

但是为什么要加锁？

给你五秒钟，说出答案。

...

学过多线程和并发的同学，都知道下面这段代码，如果不加锁，就会有灵异事件：

```java
i++;
```

开启十个线程，执行1000次这段代码，最后i有极大可能性，会小于1000。

这时候，用Java的套路，加锁：

```java
synchornize {
    i++;
}
```

问题解决。

同理，对于数据库，你可以理解为i，就是数据库里的一行记录，i++这段代码，就是一条update语句，而多线程，对应的就是数据库里的多个事务。

既然对内存中i的操作需要加锁，保证并发安全，那么对数据库的记录进行修改，也必须加锁。

这道理很简单，但是很多人，未曾想过。

# 3 释然
为什么大家都喜欢用第一部分里的例子来演示Mysql锁？

因为开两个事务，会block，够直观。

那么问题又来了，为什么会block，或者说，为什么Mysql一定要等到commit了，才去释放锁？

执行完一条update语句，就把锁释放了，不行吗？

举个例子就知道Mysql为什么要这么干了：

![](/img/post/2019-03-26-Mysql-Lock/sql-2.png)  

一开始数据是：{id:1,c:1}

接着事务A通过select .. for update，进行当前读，查到了c=1

接着它继续去更新，把c更新成3，假设这时候，事务A执行完update语句后，就把锁释放了

那么就有了第4行，事务B过来更新，把c更新成4

结果到了第5行，事务A又来执行一次当前读，读到的c，竟然是4，明明我上一步才把c改成了3 ...

事务A不由的发出怒吼：我为什么会看到了我不该看，我也不想看的东西？！

事务B的修改，居然让事务A看到了，这明目张胆的违反了事务ACID中的I，Isolation，隔离性（事务提交之前，对其他事务不可见）。

**所以，结论：Mysql为了满足事务的隔离性，必须在commit才释放锁。**

# 4 自私的基因
有人说，如果我是读未提交（Read Uncommited）的隔离级别，可以读到对方未提交的东西，是不是就不需要满足隔离性，是不是就可以不用等到commit才释放锁了？

非也。

还是举例子：

![](/img/post/2019-03-26-Mysql-Lock/sql-3.png)  

事务A是Read Committed，事务B是Read Uncommitted；

事务B执行了一条update语句，把c更新成了3

假设事务B觉得自己是读未提交，就把锁释放了

那这时候事务A过来执行当前读，读到了c就是3

事务A读到了别的事务没有提交的东西，而事务A，还说自己是读已提交，真是讽刺

根因在于，事务B非常自私，他觉得自己是读未提交，就把锁释放了，结果让别人也被“读未提交”

显然，Mysql不允许这么自私的行为存在。

**结论：就算你是读未提交，你也要等到commit了再释放锁。**

# 5 海纳百川
都知道Mysql的行锁，分为X锁和S锁，为什么Mysql要这么做呢？

这个简单吧，同样可以类比Java的读写锁：

>  It allows multiple threads to read a certain resource, but only one to write it, at a time.

允许多个线程同时读，但只允许一个线程写，既支持并发提高性能，又保证了并发安全。

# 6 凤凰涅磐
最后来个难点的。

假设事务A锁住了表T里的一行记录，这时候，你执行了一个DDL语句，想给这张表加个字段，这时候需要锁表吧？但是由于表里有一行记录被锁住了，所以这时候锁表时会block。

那Mysql在锁表时，怎么判断表里有没有记录被锁住呢？

最简单暴力的，遍历整张表，遍历每行记录，遇到一个锁，就说明表里加锁了。

这样做可以，但是很傻，性能很差，高性能的Mysql，不允许这样的做法存在。

Mysql会怎么做呢？

行锁是行级别的，粒度比较小，好，那我要你在拿行锁之前，必须先拿一个假的表锁，表示你想去锁住表里的某一行或者多行记录。

这样，Mysql在判断表里有没有记录被锁定，就不需要遍历整张表了，它只需要看看，有没有人拿了这个假的表锁。

**这个假的表锁，就是我们常说的，意向锁。**

> Intention locks are table-level locks that indicate which type of lock (shared or exclusive) a transaction requires later for a row in a table

很多人知道意向锁是什么，但是却不知道为什么需要一个粒度比较大的锁，不知道它为何而来，不知道Mysql为何要设计个意向锁出来。

**知其然，知其所以然。**

# 7 参考文献
- [InnoDB Locking](https://dev.mysql.com/doc/refman/8.0/en/innodb-locking.html)
- 《Mysql技术内幕》
- [ReadWriteLock](http://tutorials.jenkov.com/java-util-concurrent/readwritelock.html)
























