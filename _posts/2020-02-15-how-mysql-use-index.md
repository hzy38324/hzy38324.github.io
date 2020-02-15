---
layout:     post                    # 使用的布局（不需要改）
title:    MySQL索引的N种用途             # 标题 
subtitle:   #副标题
date:       2020-02-15              # 时间
author:     ZY                      # 作者
header-img: img/banner/20190128/alyssa-graham-1322772-unsplash.jpg    #这篇文章标题背景图片
catalog: true                       # 是否归档
tags:                               #标签
    - MySQL
---

面试时喜欢问一个问题：MySQL 索引的作用是什么？

同学一般回答，加速查询，减少磁盘 IO.

索引为什么可以加速查询，减少磁盘 IO 呢？

因为索引就像一份字典的目录，可以帮你找到数据的位置。

嗯，这只是一个比喻，你知道 MySQL 索引的数据结构是长什么样子的吗？

呃，MySQL 大多数索引都是用的基于 B-tree 的变种，我们习惯叫它 B+ tree，其他的索引还有 hash 索引、R-trees 索引这些。

好，那你能把 B+tree 画出来，然后讲一下它是如何帮助 MySQL 更快的查询数据的吗？

很多同学都知道索引的作用是什么、索引是 B+ tree 等等，但是却很少有人能清楚的画出 B+ tree 是如何帮助 MySQL 加速查询的，而不知道这个，也就意味着你无法判断，什么样的 sql 语句会走索引，什么样的 sql 语句走不了索引，而知道这个，则从此一通百通。

给你们一分钟时间画 B+tree.

.

.

不等了，我先开始了。

MySQL 的  B+tree 长什么样子？

聚簇索引

事实上，在你还没有执行 `create index` 语句的时候，MySQL 里面就已经有棵 B+ tree了。

执行建表语句：

```sql
CREATE TABLE `student` (
  `id` BIGINT UNSIGNED AUTO_INCREMENT NOT NULL COMMENT '主键id',
  `student_no` VARCHAR(64) COMMENT '学号',
  `name` VARCHAR(64) COMMENT '学生姓名',
  `age` INT COMMENT '学生年龄',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB CHARSET=utf8mb4 COMMENT='学生信息表';
```

插入 5 条数据：

```sql
insert into student(student_no,name,age) values(101,"Alice",18);
insert into student(student_no,name,age) values(102,"Bob",19);
insert into student(student_no,name,age) values(104,"Brandt",15);
insert into student(student_no,name,age) values(105,"David",19);
insert into student(student_no,name,age) values(109,"David",18);
```

在你插入的过程中，MySQL就会用你指定的主键，在这里是递增主键，维护起一颗 B+ 树，我用了旧金山大学做的一个 [BPlusTree Visualization](https://www.cs.usfca.edu/~galles/visualization/BPlusTree.html) 的模拟工具来模拟这颗树的样子：

img

如果你有时间，也建议你到这个网站去，从 1 到 5，一个一个插入，你会看到 B+ tree 在插入的过程中是怎么维护它的几个特性的：

- 有序：节点左边比右边小
- 自平衡：左右两边数量趋于相等
- 节点分裂：在遇到节点元素过载时，是如何分裂成两个的，其实这个也是 MySQL 页分裂的原理

模拟工具只能支持插入一个值，所以你看不到主键之外的其他数据，实际上，B+ tree 的叶子节点是带有行的全部数据的，所以我又自己画了张图：

img

如果没有这棵 B+ tree，你要根据主键查询，比如

```sql
select * from student where id = 5;
```

对不起，数据是无序的，你只能全表扫描。

现在有了这棵 B+ tree，数据被有规律的存储起来的，查找 `id=5`：

- 从上到下，先找到id=3，5比它大，找右节点
- 找到4，发现5还是比它大，继续找右节点
- 到达叶子节点里，叶子节点是一个递增的数组，那就用快速排序，找到 `id=5` 的数据

你要访问磁盘的次数，是由这棵树的层数决定的。为了方便说明，我在文章里举的例子的数据量不会太大，所以用不用索引，性能提升的效果不明显，但是你可以自行脑补大数据量的画面。

如果你没有指定主键呢？没关系，**唯一键**也可以。

连唯一键也没有？也没关系，mysql会给你建一个**rowid字段**，用它来组织这棵 B+ tree.

反正 MySQL 就一个目的，数据要有规律的存储起来，就像之前在 link 数据库是什么 里说的，这是数据库和文件系统的不一样的地方。

这个 MySQL 无论如何都会建起来，并且存储有完整行数据的索引，就叫**聚簇索引**（clustered index）。



二级索引

聚簇索引只能帮你加快主键查询，但是如果你想根据姓名查询呢？

对不起，看看上面这棵树你就知道，数据并没有按照姓名进行组织，所以，你还是只能全表扫描。

不想全表扫描，怎么办？那就给姓名字段也加个索引，让数据按照姓名有规律的进行组织：

```sql
create index idx_name on student(name);
```

这时候 MySQL 又会建一棵新的 B+ tree：

img

你会发现这棵树的叶子节点，只有主键ID，没有完整数据，这时候你执行：

```sql
select * from student where name = "David";
```

MySQL 到你刚刚创建的这棵 B+ tree 查询，快速的查到有两条姓名是“David”的记录，并且拿到它们的主键，分别是 4 和 5，但是你是要`select *`呀，怎么办？

别忘了，MySQL 在一开始就给你建了一颗 B+ tree 了，把这两棵树，放在一起，拿着这两个主键ID，去聚簇索引找，事情不就解决了？

img

这个不带行数据信息的索引，就叫**二级索引**（secondary index），也叫辅助索引。



复合索引

如果我在根据姓名和年龄同时查询呢？

```sql
select * from student where name = "David" and age = 18;
```

还是那个道理，数据虽然按照 name 有规律的组织了，但是没有按照 age 有规律组织，所以我们要给 `name` 和 `age `同时建索引：

```sql
create index idx_name_age on student(name,age);
```

这时候 MySQL 又会建一棵 B+ tree，这下 B+ tree 的节点里面，不只有name，还有age了，而且排序时，是先用 name 比较大小，如果 name 相同，则用 age 比较：

img

还是那句话，这里举的例子数据量很少，你可以想象下有一万个叫“David”的学生，年龄随机分布在13到20之间，这时候如果没有按照 age 进行有规律的存储，你还是得扫描一万行数据。



未完待续

写到这，我想起之前大学的一个学霸，人家考高数前都在背公式，他却在纸上练习这些公式的推导过程，纸上写的密密麻麻，当时不解，现在回想起来，这实在是降维打击。

别人都只会用公式，他却时刻牢记这些公式是怎么来的，别人考试就只会套用公司，他却可以用这些公式以外的知识解决问题。

MySQL 索引也是，很多人都知道索引就像字典的目录，索引是 B+ tree，但是知道这些有什么用呢？

知识是需要往深里学，才能转化为能力的，你知道的多，并不代表你能解决的问题就多，反而那些知道的没那么多，但是对他知道的东西，都研究透彻的人，才能一通百通。

当你知道了 MySQL 的聚簇索引-二级索引长成这个样子后，还用去背什么“最左匹配”吗？

随便问个问题，只给 student 表建 `idx_name_age` 这个复合索引，这两个 sql 语句，会走索引吗？

```sql
select * from student where name = "David";
```

```sql
select * from student where age = 18;
```

照着上面这几张图，你几乎可以推导出一切，什么样的 sql 能走索引，什么样的 sql 不能。

甚至，这么精妙的数据结构设计，就知道用来加速查询吗？

至少现在我能想到的，索引可以拿来干的事情，就至少有四种。

下次聊。

（吐血画图，此处应该有点赞）



参考




























