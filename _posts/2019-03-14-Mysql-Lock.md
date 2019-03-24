---
layout:     post                    # 使用的布局（不需要改）
title:    Mysql Lock             # 标题 
subtitle:   #副标题
date:       2019-03-14              # 时间
author:     ZY                      # 作者
header-img: img/banner/20190128/philip-reitsperger-1322344-unsplash.jpg    #这篇文章标题背景图片
catalog: true                       # 是否归档
tags:                               #标签
    - Mysql
---

为什么要锁
没有锁会怎么样
两个事务都去update 为什么update要加X锁
类比Java synchronize 对数据修改的原子性 i++

为什么事务A update语句执行完了，还不释放锁，要等提交了才释放？
ACID?

任何隔离级别下，都会加锁吗？读未提交 是不是不会阻塞

锁分类
S锁 X锁
类比读写锁

为什么要SX互斥
不想其他事务更新它
银行转账，读取余额后，判断一下够不够转账，我不允许后面的其他线程去更新它，否则会造成bug

为什么要XX互斥
上面讲的，数据原子性

-> 为什么要意向锁
更细粒度
解决表锁和行锁的冲突问题

手动加锁 自动加锁

mvcc
总不能每次select都去加S锁吧？这样其他事务update了，我就select不了了
于是有了mvcc

next-key lock 幻读

锁解决的问题
脏读
mysql如何解决？

幻读
更新丢失


















