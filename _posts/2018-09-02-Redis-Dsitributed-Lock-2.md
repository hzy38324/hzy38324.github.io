---
layout:     post                    # 使用的布局（不需要改）
title:    如何用Redis实现分布式锁（2）—— 集群版             # 标题 
subtitle:   #副标题
date:       2018-09-02              # 时间
author:     ZY                      # 作者
header-img: img/banner/eiffel-tower-wallpaper-18.jpg    #这篇文章标题背景图片
catalog: true                       # 是否归档
tags:                               #标签
    - Redis
    - 分布式锁
    - 分布式
---

# 单机版实现的局限性

在上一篇文章中，我们讨论了Redis分布式锁的实现，简单回顾下。  

获取锁：
```
set file:9527 ${random_value} NX EX ${timeout}
```
释放锁，调用lua脚本：
```
if redis.call("get",KEYS[1]) == ARGV[1] then
    return redis.call("del",KEYS[1])
else
    return 0
end
```
这套实现机制，在只有一个Redis实例的情况下，确实很完美。  

然而，大多数生产环境，都不可能只部署一个Redis，至少也是主从架构：
![](/img/post/2018-09-01-Redis-Dsitributed-Lock-1/master-slave.png)   

更多的是主从+分片的架构：
![](/img/post/2018-09-02-Redis-Dsitributed-Lock-2/partition.png)  

当然主从架构也可以进化为一主多从架构乃至主从链架构（Master-Salve Chain）:
![](/img/post/2018-09-02-Redis-Dsitributed-Lock-2/master-multi-slave.png)  
![](/img/post/2018-09-02-Redis-Dsitributed-Lock-2/master-slave-chain.png)  

而其实在主从架构下，之前那套分布式锁的机制，就已经失效了，原因正如之前说的：
> 如果A往Master放入了一把锁，然后再数据同步到Slave之前，Master crash，Slave被提拔为Master，这时候Master上面就没有锁了，这样其他进程也可以拿到锁，违法了锁的互斥性。 

那么，要怎么解决这个问题呢？  

# Redlock算法

针对Redis集群架构，redis的作者antirez提出了Redlock算法，来实现集群架构下的分布式锁。  

Redlock算法并不复杂，我们先简单描述一下，假设我们Redis分片下，有三个Master的节点，这三个Master，又各自有一个Slave：  
![](/img/post/2018-09-02-Redis-Dsitributed-Lock-2/partition.png)  

好，现在客户端想获取一把分布式锁：  

- 记下开始获取锁的时间 startTime
- 按照A->B->C的顺序，依次向这三台Master发送获取锁的命令。客户端在等待每台Master回响应时，都有超时时间timeout。举个例子，客户端向A发送获取锁的命令，在等了timeout时间之后，都没收到响应，就会认为获取锁失败，继续尝试获取下一把锁
- 如果获取到超过半数的锁，也就是 3/2+1 = 2把锁，这时候还没完，要记下当前时间endTime
- 计算拿到这些锁花费的时间 costTime = endTime - startTime，如果costTime小于锁的过期时间expireTime，则认为获取锁成功
- 如果获取不到超过一半的锁，或者拿到超过一半的锁时，计算出costTime>=expireTime，这两种情况下，都视为获取锁失败
- 如果获取锁失败，需要向全部Master节点，都发生释放锁的命令，也就是那段Lua脚本

看完这个Redlock算法，相信你会有很多疑问，下面就一起来追问Redlock。  

# 追问Redlock

1、为什么要给每个获取锁的请求设置timeout  

为了防止在某个出了问题的Master节点上，浪费太多时间。一旦超时了，马上尝试下一个。  

2、获取了过半数的锁之后，还要不要继续获取  

这个没有约束。  

你可以选择适可而止，这样可以提高获取锁的速度，总共三台，A和B都拿到了，就不必去拿C了。  

你也可以很贪心，A和B都拿到了，还要去拿C。这有什么好处呢？后面会跟你说。  

3、如果costTime只比expireTime小一点点，会不会有问题？  

当然有问题，这样你前脚刚拿到锁，走进门，后脚分布式锁就过期了，别人也拿到锁，进门了，互斥性被打破。  

解决办法是，每个请求的timeout要比expireTime小很多，比如你的expireTime是10s，那么timeout可以设置为50ms，这样costTime最多也就50\*3=150ms，剩下的9850ms，这九秒多钟，你都可以用来执行代码，保证不会有其他进程可以进入。  

> For example if the auto-release time is 10 seconds, the timeout could be in the ~ 5-50 milliseconds range. This prevents the client from remaining blocked for a long time trying to talk with a Redis node which is down: if an instance is not available, we should try to talk with the next instance ASAP.

当然，如果你的代码执行了9850ms还没执行完，那别的进程还是可以抢到锁。这也是一个暂时无解的问题。  

4、释放锁时，为什么不能只向成功获取到锁的Master发送释放命令，而要向所有的Master节点发送  

很简单，假设你向Master A发送了获取锁的命令，set命令执行成功了，但是在回响应时发送了故障，响应没发回来，过了超时时间后，你会认为获取锁失败，而实际上，锁已经在redis那边生效了。  

所以在释放锁的时候，必须向全部节点都发生命令，不管你到底有没有在那节点上面获取到锁。  

5、如果有节点crash，锁不也还是会丢失吗？  

的确，单机时候的问题，在集群依然存在。  

Redlock算法，在有节点重启或者crash的情况下，也会有可能无法达到互斥的目的。  

假设有三个节点ABC：  

- 进程1在B和C上拿到了锁
- 这时候B crash了
- 如果B没有Slave节点，那么B会重启，如果数据还没备份，那么重启后B上的锁就丢了
- 又或者B有Slave节点，但是crash时，Master B的数据还没同步到Slave，Slave被提拔为Master
- 不管有没有Slave，其他进程都有可能在Bcrash掉之后，在B上拿到锁，再加上在A拿到的锁，就可以拿到超过半数的锁，这样就有两个进程同时拿到了锁，互斥性被打破

对于上面这个问题，Redis的作者，同时也是Redlock的作者antirez，提出了delay的解决方案，就是让B别那么快重启，稍微等一下，等的时间，就是分布式锁的最大过期时间，等到其他节点上的锁都过期了，你再重启，对外提供服务。  

对于有Slave的情况，也可以用类似的方案，Slave先别那么快接替Master，稍微等一下下。  

6、会不会有锁饥饿的问题？  

还是三台Master节点，现在有三个进程同时要加同一把锁，会不会出现每次都是一个进程抢到一把锁的情况？  

这是有可能的。  

解决办法1：  
获取锁失败后，随机休息一段时间  

解决办法2：  
如果客户端在发现，就算后面全部的锁，都被我抢到，加起来也不能超过半数，这时候就不再继续往下抢。  

举个例子，进程1抢到了节点A的锁，进程2抢到节点B的，这时候进程3想过来抢锁，按照ABC的顺序，逐个抢，A和B都抢不过别人，于是掐指一算，就算C让我抢到了，我也抢不到超过半数了，没必要继续抢了，我还是先尝试抢一下A吧。  

这样就不会出现三把锁，分别被三个不同的进程抢的情况了。 

Redisson（一个Java的redis客户端）在实现redlock时就采用了这个解决方案。  

RedissonMultiLock line248:  
![](/img/post/2018-09-02-Redis-Dsitributed-Lock-2/redisson-faillocknum.png)

现在让我们回过头来看第2个问题，获取了过半数的锁之后，还要不要继续获取？  

之前说了，不继续获取可以提高速度，但是贪心点继续获取也并非一无是处，比如你已经获取了A和B，如果把C也获取了，那么就算后面A挂掉了，别人也最多只能从恢复过来的A上获取到锁，还是拿不到超过半数的。  

# Redlock实现：Redisson

上面讲的只是Redlock的算法，具体怎么用代码来实现，可以看redlock各种语言的客户端源码，比如Java的实现，就可以看看Redisson。  

我在看的过程中，就发现redisson在释放锁的时候，只是释放了成功获取到的锁。  
RedissonMultiLock line248:  
![](/img/post/2018-09-02-Redis-Dsitributed-Lock-2/redisson-unlock.png)  

当然，或许redisson有其他考虑，这个还不得而知。  

> 针对这个疑惑，给redisson提了个issuse（https://github.com/redisson/redisson/issues/1606），不过还没有答复 (￣▽￣)／ 

# 参考

- [Distributed locks with Redis](https://redis.io/topics/distlock)
- [How to do distributed locking](http://martin.kleppmann.com/2016/02/08/how-to-do-distributed-locking.html)
- [基于Redis的分布式锁到底安全吗（下）\| 张铁蕾](http://zhangtielei.com/posts/blog-redlock-reasoning-part2.html)  


