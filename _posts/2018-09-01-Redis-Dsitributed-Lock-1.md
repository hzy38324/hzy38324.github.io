---
layout:     post                    # 使用的布局（不需要改）
title:    如何用Redis实现分布式锁（1）—— 单机版             # 标题 
subtitle:   #副标题
date:       2018-09-01              # 时间
author:     ZY                      # 作者
header-img: img/banner/The-Hobbit-Movie-HD-Wallpaper.jpg    #这篇文章标题背景图片
catalog: true                       # 是否归档
tags:                               #标签
    - Redis
    - 分布式锁
    - 分布式
---

# 为什么要使用分布式锁

这个问题，可以分为两个问题来回答：

1. 为什么要使用锁？
2. 分布式锁和本地锁的区别是什么？

**1、为什么要使用锁？**  
*Martin Kleppmann*在他的文章[How to do distributed locking](https://martin.kleppmann.com/2016/02/08/how-to-do-distributed-locking.html)里，把使用锁的目的，总结为两个。  

第一个是**正确性**，这个众人皆知。就像Java里的synchronize，就是用来保证多线程并发场景下，程序的正确性。  

JVM里需要保证并发访问的正确性，在分布式系统里面，也同样需要，只不过**并发访问的单位，不再是线程，而是进程。**  

举个例子，一个文件系统，为了提高性能，部署了三台文件服务器。  

![](/img/post/2018-09-01-Redis-Dsitributed-Lock-1/file-server.png)  

当服务器A在修改文件A的时候，其他服务器就不能对文件A进行修改，否则A的修改就会被覆盖掉，这个跟Git提交代码是一个道理：  

```javascript
function writeData(filename, data) {
    var lock = lockService.acquireLock(filename);
    if (!lock) {
        throw 'Failed to acquire lock';
    }

    try {
        var file = storage.readFile(filename);
        var updated = updateContents(file, data);
        storage.writeFile(filename, updated);
    } finally {
        lock.release();
    }
}
```

锁还有第二个用处——效率。比如应用A有一个耗时的统计任务，每天凌晨两点，定时执行，这时我们给应用A部署了三台机器，如果不加锁，那么每天凌晨两点一到，这三台机器就都会去执行这个很耗时的统计任务，而实际上，我们最后只需要一份统计结果。  

这时候，就可以在定时任务开始前，先去获取锁，获取到锁的，执行统计任务，获取不到的，该干嘛干嘛去。  

这就像宿舍里，玩猜拳，输了的下楼拿外卖，其他人，看电影、打游戏、写作业，做自己的事就好。  

**2、分布式锁和本地锁的区别是什么**？  
就像上面说的，单机，并发的单位是线程，分布式，并发的单位是多进程。  

并发单位的等级上去了，锁的等级自然也得上去。  

以前锁是进程自己的，进程下的线程都看这个锁的眼色行事，谁拿到锁，谁才可以放行。  

进程外面还有别的进程，你要跟别人合作，就不能光看着自己了，**得有一个大家都看得到的，光明正大的地方，来放这把锁。**  

有不少适合放这把锁的地方，redis、zookeeper、etcd等等，今天我们先聊聊如何用redis实现分布式锁。    

# 获取锁

要怎么在redis里获取一把锁呢？  

貌似很简单，执行set命令就好了，还是上面文件系统的例子，比如你想修改文件id是9527的文件，那就往redis里，添加一个key为file:9527，value为任意字符串的值即可：
```
set file:9527 ${random_value}
```
set成功了，就说明获取到锁。  

这样可以吗？很明显不行，set方法默认是会覆盖的，也就是说，就算file:9527已经有值了，set还是可以成功，这样锁就起不到互斥的作用。  

那在set之前，先用get判断一下，如果是null，再去set？  

也不行，原因很简单，get和set都在客户端执行，不具有原子性。  

要实现原子性，唯一的办法，就是只给redis发送一条命令，来完成获取锁的动作。  

于是就有了下面这条命令：
```
set file:9527 ${random_value} NX
```
NX = If Not Existed  
如果不存在，才执行set  

完美了吗？非也，这个值没有设置过期时间，如果后面获得锁的客户端，因为挂掉了，或者其他原因，没有释放锁，那其他进程也都获取不到锁了，结果就是死锁。  

所以有了终极版的获取锁命令：  
```
set file:9527 ${random_value} NX EX ${timeout}
```
使用EX参数，可以设置过期时间，单位是秒，另一个参数PX，也可以设置过期时间，单位是毫秒。  
# Set命令一定是安全的吗

至此我们已经可以获取锁了，在讨论如何释放锁之前，我们不妨再深挖一下上面这条set命令：
```
set file:9527 ${random_value} NX EX ${timeout}
```
我们说，在客户端向redis server发送多条命令，是不安全的，因为不满足原子性。  

那整成一条命令，发给redis server，就一定安全了吗？  

首先，坊间有传言，说set命令，如果带上了EX参数，那么实际上，客户端会把它拆解成两条命令，一条set设置值，一条expire设置过期时间，然后通过使用pipeline，一次性把这两条指令发给server端，所以实际上，服务端还是分两次执行这条命令的，所以还是不满足原子性。  

这种说法对吗？  

不得不说，这是一个很有迷惑性的说法，我上网搜了很多资料，都没找到关于set命令的实现原理的文章，最后只能git clone源码下来，硬啃，居然让我看到了这段**server端解析客户端set命令的代码**：  

t_string.c：
```c
/* SET key value [NX] [XX] [EX <seconds>] [PX <milliseconds>] */
void setCommand(client *c) {
    int j;
    robj *expire = NULL;
    int unit = UNIT_SECONDS;
    int flags = OBJ_SET_NO_FLAGS;

	// 遍历客户端传进来的参数  
    for (j = 3; j < c->argc; j++) {
        char *a = c->argv[j]->ptr;
        robj *next = (j == c->argc-1) ? NULL : c->argv[j+1];

        if ((a[0] == 'n' || a[0] == 'N') &&
            (a[1] == 'x' || a[1] == 'X') && a[2] == '\0' &&
            !(flags & OBJ_SET_XX))
        {
            flags |= OBJ_SET_NX;
        } else if ((a[0] == 'x' || a[0] == 'X') &&
                   (a[1] == 'x' || a[1] == 'X') && a[2] == '\0' &&
                   !(flags & OBJ_SET_NX))
        {
            flags |= OBJ_SET_XX;
        } else if ((a[0] == 'e' || a[0] == 'E') &&
                   (a[1] == 'x' || a[1] == 'X') && a[2] == '\0' &&
                   !(flags & OBJ_SET_PX) && next)
        {
            flags |= OBJ_SET_EX;
            unit = UNIT_SECONDS;
            expire = next;
            j++;
        } else if ((a[0] == 'p' || a[0] == 'P') &&
                   (a[1] == 'x' || a[1] == 'X') && a[2] == '\0' &&
                   !(flags & OBJ_SET_EX) && next)
        {
            flags |= OBJ_SET_PX;
            unit = UNIT_MILLISECONDS;
            expire = next;
            j++;
        } else {
            addReply(c,shared.syntaxerr);
            return;
        }
    }

    c->argv[2] = tryObjectEncoding(c->argv[2]);
    
    // 执行set命令  
    setGenericCommand(c,flags,c->argv[1],c->argv[2],expire,unit,NULL,NULL);
    
}
```

显然，不管你是单纯的set，还是set NX，还是set EX，**都是一条命令发到server端**，然后server端在上面这个setCommand方法里，对传进来的参数进行遍历，判断你是不是要Set if not existed，是不是设置了过期时间，单位是秒还是毫秒等等，最后再去调用setGenericCommand方法，往内存设置值。  

setGenericCommand长这样：  
```c
void setGenericCommand(client *c, int flags, robj *key, robj *val, robj *expire, int unit, robj *ok_reply, robj *abort_reply) {
   // 此处省去一大段代码...  
   
    setKey(c->db,key,val);
    
    server.dirty++;
    
    if (expire) setExpire(c,c->db,key,mstime()+milliseconds);
    
    // 此处省去一大段代码...  
}
```

有同学会说，redis server这边，不也是分两个动作去完成塞值和设置过期时间的吗，先setKey，再setExpire，这也不满足原子性啊。  

哈哈，然而，**Redis是单线程处理命令的**，所以，**在redis执行这段函数的过程中，不可能有精力去执行其他函数**，所以，就算是分成两个动作去执行，也不影响。  

就这样结束了吗？还有其他问题不？  

没有？那我问一个，如果setKey方法执行成功了，但是在执行setExpire之前，redis crash掉了，会怎么样？  

如果不考虑备份，那么没问题，因为数据都是存储在内存，重启后，空空如也。  

如果考虑备份呢？会不会有这种情况，setKey执行后，数据被同步到slave了，执行setExpire之前，然后master crash，slave被提拔为master，这时候key就永远不会过期了？  

思考题。（提示：Redis有两种持久化机制，一种叫AOF，一种叫RDB/快照）  

# 释放锁

好，最后再来看看释放锁。  

有人说，释放锁，简单，直接del：  
```
del file:9527
```
有问题吗？当然有，这会把别人的锁给释放掉。   

举个例子：

- A拿到了锁，过期时间5s  
- 5s过去了，A还没释放锁，也许是发生了GC，也许是某个耗时操作
- 锁过期了，B抢到了锁
- A缓过神来了，以为锁还是自己的，执行del file:9527
- C抢到了锁，也进来了
- B看看屋里的C，有看看刚出门的A，对着A吼了一句：尼玛，你干嘛把我的锁释放了

所以，**为了防止把别人的锁释放了，必须检查一下，当前的value是不是自己设置进去的value**，如果不是，就说明锁不是自己的了，不能释放。  

显然，这个过程，如果放在客户端做，就又不满足原子性了，只能整在一起，一次性让redis server执行完。  

这下redis可没有一条命令，可以做这么多事情的，好在redis提供了lua脚本的调用方式，只需使用eval命令调用以下脚本即可：  
```
if redis.call("get",KEYS[1]) == ARGV[1] then
    return redis.call("del",KEYS[1])
else
    return 0
end
```
那么redis在执行lua脚本时，是原子的吗？答案当然是肯定的：  
> **Atomicity of scripts**  
> Redis uses the same Lua interpreter to run all the commands. Also Redis guarantees that a script is executed in an atomic way: no other script or Redis command will be executed while a script is being executed.

上面这段话摘自redis文档上对于[eval命令](https://redis.io/commands/eval)的介绍，关于这个命令的更多信息，上面都有，这里就不赘述了。  

# 一切都是浮云

了解完如何释放锁，再加上之前的获取锁，我们似乎已经可以用redis来实现分布式锁了。  

但是，一如既往，问自己一句，完美了吗？没有漏洞了？  

嗯，很明显不是，上面讲的算法，**都有一个前提：只有一台Redis实例。**  

而生产环境里，我们是不可能只部署一个实例的，至少，我们也是**主从**的架构：  
![](/img/post/2018-09-01-Redis-Dsitributed-Lock-1/master-slave.png)  

Master节点负责接收写操作，并把数据同步给Slave节点，Slave节点在平时，可以分担一些发往Master的读请求，并在Master crash的时候，承担起Master的作用，保证系统的高可靠。  

然而，**redis的数据同步，不是强一致性的**，毕竟作为一个缓存，要保证读写性能。  

如果A往Master放入了一把锁，然后再数据同步到Slave之前，Master crash，Slave被提拔为Master，这时候Master上面就没有锁了，这样其他进程也可以拿到锁，违法了锁的互斥性。 

那么我们之前将的获取锁和释放锁，都白讲了吗？  

非也，我们只需在这两个方法的基础上，对算法进行一个优化，即可解决这个问题。  

下篇文章，继续分享。  

> 学习的乐趣就在于此，不断的批判自己现有的知识框架，向自己发难，不断提问，像一个哲学大师，在人生的问题上不停的深入思考。  

# 参考

- [Distributed locks with Redis](https://redis.io/topics/distlock)
- [How to do distributed locking](http://martin.kleppmann.com/2016/02/08/how-to-do-distributed-locking.html)
- [基于Redis的分布式锁到底安全吗（上）\| 张铁蕾](http://zhangtielei.com/posts/blog-redlock-reasoning.html)  


