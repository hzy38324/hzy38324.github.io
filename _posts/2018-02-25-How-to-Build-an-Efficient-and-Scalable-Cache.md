---
layout:     post                    # 使用的布局（不需要改）
title:      Java并发趣谈——如何构建一个高效且可伸缩的缓存               # 标题 
subtitle:    #副标题
date:       2018-02-25              # 时间
author:     ZY                      # 作者
header-img: img/banner/how-to-build-an-efficient-and-scalable-cache.jpg    #这篇文章标题背景图片
catalog: true                       # 是否归档
tags:                               #标签
    - Java
    - Concurrency
---
本集概要：  

 - 怎样构建一个线程安全而又高效、可伸缩的缓存？
 - 怎样利用设计模式，把缓存做成通用的工具？
 - 除了synchronize和volatile，我们还能使用哪些工具来开发线程安全的代码？

前情回顾： [Volatile趣谈——我是怎么把贝克汉姆的进球弄丢的](http://bridgeforyou.cn/2018/02/10/Funny-Volatile/)

----------
大雄开发的门线传感器在曼联和阿森纳的比赛中一鸣惊人，越来越多的客户向公司订购这款软件......   
# 糙版缓存
一天，哆啦对大雄说，“大雄，你看我们后台这个统计用户消费信息的报表，每次统计都要去查数据库，既消耗资源，查询起来也慢，你看看能不能给做一个**缓存**？”  
“缓存？这个简单呀，缓存的原理其实就是一个**键值对**，也就是Map，只要把用户的id作为key，把对应的统计结果作为value，放到Map里头缓存起来，下次再来查询时，先到Map去搜，搜到了就直接返回，搜不到，再去查数据库计算，这样就ok了”  
“可以呀，思路很清晰嘛，一下子就讲出了一份设计文档”  
“那是，那我开始写代码啦！”，大雄泡了杯茶，关掉QQ和Outlook，开始写起了代码。  

很快，第一版代码出炉了，UserCostStatComputer（**本文的示例代码，可到[Github](https://github.com/hzy38324/Coding-Pratice)下载**）:  
```java
public class UserCostStatComputer {
    private final Map<String, BigInteger> cache = new HashMap();

    public synchronized BigInteger compute(String userId) throws InterruptedException {
        BigInteger result = cache.get(userId);
        if (result == null) {
            result = doCompute(userId);
            cache.put(userId, result);
        }
        return result;
    }

    private BigInteger doCompute(String userId) throws InterruptedException {
        // assume it cost a long time...
        TimeUnit.SECONDS.sleep(3);
        return new BigInteger(userId);
    }
}
```
“为了**线程安全**，我给整个compute方法加上了**synchronized**修饰符，保证每次只有一个线程可以进入compute方法”，大雄向哆啦介绍他的代码。  
哆啦看了看，说，“大雄，你这代码写的快是快，但是**有点糙**啊”  
“这。。。”  
“咱先不说性能，就说你这设计，你有没有考虑过，**要是还有其他地方也需要缓存，你难道也把这份缓存的逻辑拷贝过去？**”  
“啊，对呀，总不能每次要用到缓存，就在原先代码里加个Map，然后再写上if判断吧......”  
"小伙子觉悟不错，好好想想，怎样给原先没有缓存的统计函数，加上缓存的功能？"  
“给原先没有某某功能的函数，加上某某功能，这话听着很熟悉啊...”    

# 通用缓存
大雄在大脑中检索着，“对了！**装饰模式**！哎，之前学过的，怎么到实际运用中就忘了呢！”  
利用设计模式，大雄很快把代码进行了重构。  
首先，定义一个Computable接口：
```java
public interface Computable<A, V> {
    V compute(A arg) throws Exception;
}
```
接着，每个要使用缓存功能的计算器，都要去实现这个接口，比如UserCostStatComputer：
```java
public class UserCostStatComputer implements Computable<String, BigInteger> {
    @Override
    public BigInteger compute(String userId) throws Exception {
        // assume there is a long time compute...
        TimeUnit.SECONDS.sleep(3);
        return new BigInteger(userId);
    }
}
```
现在这个UserCostStatComputer是没有缓存功能的，没关系，来一个**装饰器**就OK了，Memoizer1：  
```java
public class Memoizer1<A, V> implements Computable<A, V> {
    private final Map<A, V> cache = new HashMap<A, V>();
    private final Computable<A, V> c;

    public Memoizer1(Computable<A, V> c) {
        this.c = c;
    }

    public synchronized V compute(A arg) throws Exception {
        V result = cache.get(arg);
        if (result == null) {
            result = c.compute(arg);
            cache.put(arg, result);
        }
        return result;
    }
}
```
Memoizer1即**实现了Computable接口**，又**持有一个Computable对象**，同时在自己的compute方法中，调用了Computable对的compute方法，在这个compute方法的外圈，可以看到就是之前的缓存逻辑。  
那么要怎样使用Memoizer1给UserCostStatComputer装饰上缓存功能呢？很简单：  
```java
Computable computer = new Memoizer1(new UserCostStatComputer());
computer.compute("1");
```
利用Memoizer1这个装饰器，我们成功的给原先不具有缓存功能的UserCostStatComputer加上了缓存。  
“后面要是有其他的计算器，比如用户地区分布统计计算器、用户年龄分布统计计算器，我们都可以像UserCostStatComputer一样，实现Computable，就可以使用装饰器，装饰上缓存功能了“，大雄得意洋洋地说。  
“不错，小伙子悟性很强啊”，哆啦拍拍大雄的肩膀，“好了，现在通过设计模式解决了代码通用性问题，是时候看看你这个性能问题了”  

# 雇个保姆
“性能问题？我这个代码性能有问题么”，大雄翻着白眼。  
“你看看，你把synchronize加在了什么地方？你加在了函数签名的位置，意味着一次只能有一个线程能够进入compute方法，这就导致了一个用户的id在计算的时候，其他用户无法进行计算，只能等到正在计算的用户计算完了，才能进入compute方法”  
“啊，这对性能影响挺大的。。。”  
“没错，换句话说，你这个加锁的**粒度太大**了，我们先把synchronize去掉，看看有什么线程安全问题，再来逐一解决”  
去掉synchronize的compute方法：  
```java
    public V compute(A arg) throws Exception {
        V result = cache.get(arg);
        if (result == null) {
            result = c.compute(arg);
            cache.put(arg, result);
        }
        return result;
    }
```
“很明显，由于你用的是线程不安全的HashMap，cache.put(arg, result)这一行代码就有线程安全问题”，哆啦说。  
“那给这行代码加锁？像这样”，大雄说着在纸上写出草稿：
```java
synchronized(this) {
  cache.put(arg, result);
}
```
“哈哈，你怎么那么喜欢用synchronized，这样可以是可以，但是粒度还是太大了，Java早就给你提供了一个叫**ConcurrentHashMap**的保姆，我们只要把线程安全**委托**给它去处理就好了”  
“啊，我怎么又忘了...”  
说完，大雄修改了代码：
```java
  private final Map<A, V> cache = new ConcurrentHashMap<A, V>();
  // private final Map<A, V> cache = new HashMap<A, V>();
```
# 未来任务
"现在再来看其他地方，由于把synchronize去掉了，现在不同的用户id可以同时计算，但是也导致了相同用户id也会同时被计算，也就是说**同样的数据会被计算多次**，这样缓存就没意义了"  
“啊，假设用户id为1的数据正在计算，这个时候又来了一个线程，也是计算用户id为1的，如果这个线程可以知道，当前有没有线程正在计算id为1的数据，如果有，就等待这个线程返回计算结果，如果没有，就自己计算，那问题不就解决了？可是这个逻辑挺复杂的，好难实现啊”  
“哈哈，很简单，Java早就提供了**Future**和**FutureTask**，来实现你说的这种功能，来，把键盘给我，好久没写代码了”，哆啦说完，马上敲起了键盘。  
终极版Memoizer：  
```java
public class Memoizer <A, V> implements Computable<A, V> {
    private final ConcurrentMap<A, Future<V>> cache
            = new ConcurrentHashMap<A, Future<V>>();
    private final Computable<A, V> c;

    public Memoizer(Computable<A, V> c) {
        this.c = c;
    }

    public V compute(final A arg) throws Exception {
        // use loop for retry when CancellationException
        while (true) {
            Future<V> f = cache.get(arg);
            if (f == null) {
                Callable<V> callable = new Callable<V>() {
                    public V call() throws Exception {
                        return c.compute(arg);
                    }
                };
                FutureTask<V> ft = new FutureTask<V>(callable);

                // use putIfAbsent to avoid multi thread compute the same value
                f = cache.putIfAbsent(arg, ft);

                if (f == null) {
                    f = ft;
                    ft.run();
                }
            }

            try {
                return f.get();
            } catch (CancellationException e) {
                // remove cache and go into next loop to retry
                cache.remove(arg, f);
            } catch (ExecutionException e) {
                // throw it and then end
                e.printStackTrace();
                throw e;
            }
        }
    }
}
```
简单解释一下代码逻辑，线程进了compute方法后：
1. 首先去存放future的Map里，搜索**有没有已经其他线程已经创建好的future**
2. 如果有（不等于null），那就调用future的get方法
3. 如果已经计算完成，get方法会**立刻返回计算结果**
4. 否则，get方法会**阻塞**，直到结果计算出来再将其返回。
5. 如果没有已经创建的future，那么就自己创建future，进行计算

有几个小点要单独解释的：  
1、**为什么要使用putIfAbsent**  
这里之所以用putIfAbsent而不用put，原因很简单。  
如果有两个都是计算userID=1的线程，同时调用put方法，那么返回的结果都不会为null，后面还是会创建两个任务去计算相同的值。  
而putIfAbsent，当map里面已经有对应的值了，则会返回已有的值，否则，会返回null，这样就可以解决相同的值计算两次的问题。  
2、**为什么要while (true) {}**  
这是因为future的get方法会由于线程被**中断**而抛出CancellationException。  
我们对于CancellationException的处理是cache.remove(arg, f);，也就是把缓存清理掉，然后进入下一个循环，重新计算，直到计算成功，或者抛出ExecutionException。  

# 总结
这篇文章中，我们先是用装饰模式，改良了代码的设计，接着通过使用并发容器ConcurrentHashMap以及同步工具Future，取代了原先的synchronize，实现了线程安全性的委托。  
《Java并发编程实践》中，将委托称为**实现线程安全的一个最有效策略**。委托其实就是把原来通过使用synchronize和volatile来实现的线程安全，委托给Java提供的一些基础构建模块（当然你也可以写自己的基础构建模块）去实现，这些基础构建模块包括：
- **同步容器**：比如Vector，同步容器的原理大多就是synchronize，所以用的不多；
- **并发容器**：比如本文用到的ConcurrentHashMap，当然还有CopyonWriteArrayList、LinkedBlockingQueue等，根据你的需求使用不同数据结构的并发容器；
- **同步工具类**：比如本文用到的Future和FutureTask，还有闭锁（Latches）、信号量（Semaphores）、栅栏（Barriers）等

这些基础构建模块，在加上之前所讲的synchronize和volatile，就形成了**Java并发的基础知识**：
- [如何写出线程不安全的代码](http://bridgeforyou.cn/2017/12/31/How-to-Write-Un-Thread-Safe-Code/)
- [如何用一句话介绍synchronize的内涵](http://bridgeforyou.cn/2018/01/20/Java-Synchronize/)
- [Volatile趣谈——我是怎么把贝克汉姆的进球弄丢的](http://bridgeforyou.cn/2018/02/10/Funny-Volatile/)

其实也就是《Java并发编程实践》第一部分的迷你版，总结成一句话就是：  
要想写出线程安全的代码，我们需要用到使用synchronize、volatile，或者将线程安全委托给基础构建模块。  
当然，在实际应用中，只有这些基础知识是不够的，最简单的例子，你不可能每次请求过来都创建线程，这会吃光内存的。所以，你需要一个**线程池**，来限制线程的数量，这也就引出了《Java并发编程实践》的第二部分，结构化并发应用程序（Structuring Concurrent Applications），听名字确实不知道想讲什么，所以我也将把它啃下来，然后像第一部分一样，用尽可能通俗易懂的语言和大家分享学习心得。

# 参考
- 《Java并发编程实践》
- [Future (Java Platform SE 7 )](https://docs.oracle.com/javase/7/docs/api/java/util/concurrent/Future.html)

