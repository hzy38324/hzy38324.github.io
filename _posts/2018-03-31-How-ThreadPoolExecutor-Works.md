---
layout:     post                    # 使用的布局（不需要改）
title:      Java线程池是如何诞生的？               # 标题 
subtitle:   #副标题
date:       2018-03-31              # 时间
author:     ZY                      # 作者
header-img: img/banner/soft-skill-1-career-and-personal.jpg    #这篇文章标题背景图片
catalog: true                       # 是否归档
tags:                               #标签
    - Java
    - Concurrency 
---
时间回到2003年，那时我还是一个名不见经传的程序员，但是上级却非常看好我，他们把整个并发模块，都交给了我一个人开发。（难道不是因为经费不足？）  

这个星期，我必须要完成并发模块中非常重要的一个功能——线程池。  

# 为什么要使用线程池
作为一个合格的程序员，接到需求，首先我得问自己一句：  
**为什么要做这个需求？为什么需要线程池？**  

就像十多年后，另一个菜鸟在他的[博客](http://bridgeforyou.cn/2018/03/10/How-to-Handle-Request-Like-Tomcat/)中说的那样：  

**软件中的“池”，可以理解为计划经济时代的工厂。**

首先，作为工厂，你要管理好你生产的东西，老王从你工厂这里拿走了一把斧头，改天他不需要了，还回来，你可以把这把斧头借给老赵；

其次，你又不能无限制的生产，毕竟在资源极度匮乏的时代，如果都被你拿去生产了，其他要用到资源的地方怎么办？

总结成两点，“池”的作用：

- **复用已有资源**
- **控制资源总量**

数据库连接池是这样，线程池也是如此。

你一个任务过来了，我发现池子里有没事干并且还活着的线程，来，拿去用，我也不用费事给你创建一条线程了，要知道线程的创建和销毁可都是麻烦事；  
你一个任务过来了，我发现池子的线程都在忙，并且现在池子的线程已经太多了，再不限制下去就要内存溢出了，来，排队去~    

# 线程池需要考虑哪些问题
简单的架构固然容易实现，但是却不能解决复杂的问题；  
而复杂的架构可以解决复杂的问题，却没那么好实现。  

在介绍线程池原理之前，先来大致看看我设计的线程池ThreadPoolExecutor长什么样子：  
![图片来源 http://tutorials.jenkov.com/java-util-concurrent/threadpoolexecutor.html](/img/post/2018-03-31-How-ThreadPoolExecutor-Works/thread-pool-executor.png)

你们可以先看看这张图，想想图中的各个节点都是什么，为什么需要它们？  

好，现在开始聊聊实现一个线程池，都需要考虑哪些问题。  

**1、 任务队列**  
如果每个任务过来，都直接交给线程去执行，那其实算不上解耦。  

更好的方法是先把任务放到队列里面，然后当线程空闲的时候，去队列里面取任务过来处理。  
为了取的时候可以形成阻塞，我选择了使用阻塞队列**BlockingQueue**，来保存这些未被处理的任务。  

如果你们用过RabbitMQ、Kafka之类的消息中间件，就会发现他们的原理和阻塞队列类似。  

**2、任务队列的类型**  
阻塞队列有很多种：

- **无界的阻塞队列**（Unbounded queues），比如**LinkedBlockingQueue**，来多少任务就放多少；
- **有界的阻塞队列**（Bounded queues），比如**ArrayBlockingQueue**；
- **同步移交**（Direct handoffs），比如**SynchronousQueue**，这个队列的put方法会阻塞，直到有线程准备从队列里面take，所以本质上SynchronousQueue并不是Queue，**它不存储任何东西，它只是在移交东西**  

这么多种队列，都有各自的优劣，所以，把任务队列参数，放在构造函数里头，提供给使用线程池的人去设置，是最好不过的了。  

**3、线程的数量**    
我定义了两个线程数的变量，一个是核心线程数**corePoolSize**，另一个是最大线程数**maximumPoolSize**。这两个参数的差别，可以这样来解释：  

- 当线程池里的线程数少于corePoolSize时，每来一个任务，我就创建一条线程去处理，不管线程池中有没有空闲的线程；
- 当线程池里的线程数达到corePoolSize时，新来的任务，会先放到任务队列里面；
- 当任务队列放满了（如果队列是有界队列），那么要怎么办？马上拒绝新的任务吗？似乎不妥，面对这种业务突然繁忙的情况，我是不是可以破例再创建多几条线程呢？于是就有了maximumPoolSize，如果任务队列满了，但是线程池中的线程数还少于maximumPoolSize，那我就允许线程池继续创建线程，**这就像肠粉店里的桌子，一开始摆上十张，到了中午高峰期时，发现不够用了，老板娘再让小二从厨房里拿出几张桌子出来一样。**

同样的，这两个参数也应该放在构造函数，由使用者根据实际情况，来决定要使用多大容量的线程池。  

**4、Keep-alive times**  
从厨房拿出来的桌子，在高峰期过后，就要渐渐撤回了吧？同样，当我发现线程池中线程的数量超过corePoolSize，就会去监控线程，发现某条线程很久没有工作了，就把它关掉，这里的很久是多久，那就要看你传过来的keepAliveTime是多少了。  
如果你想对corePoolSize线程也做这种监控，只需要调用threadPoolExecutor.allowCoreThreadTimeOut(true)就可以了。   

你也许好奇我是怎样判断线程有多久没有活动了，是不是以为我会启动一个监控线程，专门监控哪个线程正在偷懒？  
想太多，其实我只是在线程从工作队列poll任务时，加上了超时限制，如果线程在keepAliveTime的时间内poll不到任务，那我就认为这条线程没事做，可以干掉了，看看这个代码片段你就清楚了，  

ThreadPoolExecutor getTask(): 
```java
    private Runnable getTask() {
        boolean timedOut = false; 

        for (;;) {
            
            ...
            
            try {
                Runnable r = timed ?
                    workQueue.poll(keepAliveTime, TimeUnit.NANOSECONDS) :
                    workQueue.take();
                if (r != null)
                    return r;
                timedOut = true;
            } catch (InterruptedException retry) {
                timedOut = false;
            }
        }
    }
```

**5、拒绝策略**  
如果线程池已经被shutdown了，或者线程池中使用的是有界队列，而这个队列已经满了，并且线程数已经达到最大线程数，无法再创建新的线程处理请求，这时候要怎么处理新来的任务？  
在和大家一起讨论之后，我们认为至少有这四种策略：  

- **AbortPolicy**：使用这种策略的线程池，将在无法继续接受新任务时，给任务提交方抛出RejectedExecutionException，让他们决定要如何处理；
- **CallerRunsPolicy**：这个策略，顾名思义，将把任务交给调用方所在的线程去执行；
- **DiscardPolicy**：直接丢弃掉新来的任务；
- **DiscardOldestPolicy**：丢弃最旧的一条任务，其实就是丢失blockingQueue.poll()返回的那条任务，要注意，如果你使用的是PriorityBlockingQueue优先级队列作为你的任务队列，那么这个策略将会丢弃优先级最高的任务，所以一般情况下，**PriorityBlockingQueue和DiscardOldestPolicy不会同时使用**

说到策略，你们或许以为我会用策略模式。  
这下你们猜对了，我用的就是策略模式，这个模式是如此简单，以至于我只需要定义一个策略接口，  
RejectedExecutionHandler：  
```java
public interface RejectedExecutionHandler {
    void rejectedExecution(Runnable r, ThreadPoolExecutor executor);
}
```
然后写对应的实现类，实现上面提到的那四种策略，比如DiscardPolicy，直接丢弃，那就是什么都不做呗，  
DiscardPolicy：  
```java
    public static class DiscardPolicy implements RejectedExecutionHandler     {
        public DiscardPolicy() { }

        public void rejectedExecution(Runnable r, ThreadPoolExecutor e) {
        }
    }
```
接着在构造函数里，让你们给我传入你们想要使用的策略，最后在我的拒绝任务reject()方法里，调用你们传过来的策略就ok了，  
```java
    final void reject(Runnable command) {
        handler.rejectedExecution(command, this);
    }
```
为什么使用final？那当然是不想让你们继承啦，这个方法木有定制的必要嘛。  
至于这个reject方法，是在哪里调用的，你们使用idea，alt + f7就知道了，然后你们会看到我写的很多深奥的代码，那些我今天不就不详细讲解了，今天重点讲解构造函数里的几个参数的作用，也就是你们可以定制的几个参数。  

# 给你们造好的轮子
为了方便你们使用，我已经在Executors里面写了几个线程池的**工厂方法**，这样，**很多新手就不需要了解太多关于ThreadPoolExecutor的知识了，他们只需要直接使用我的工厂方法，就可以使用线程池**：  

**1、newFixedThreadPool**  
如果你想对线程池里的线程总数做一个限制，那么通过Executors.newFixedThreadPool(...)获取一个固定线程数的线程池，是一个很不错的选择，它将返回一个corePoolSize和maximumPoolSize相等的线程池，  
Executors newFixedThreadPool：  
```java
    public static ExecutorService newFixedThreadPool(int nThreads) {
        return new ThreadPoolExecutor(nThreads, nThreads,
                                      0L, TimeUnit.MILLISECONDS,
                                      new LinkedBlockingQueue<Runnable>());
    }
```

**2、newCachedThreadPool**  
如果你希望有一个**非常弹性**的线程池，那可以使用newCachedThreadPool：  
```java
    public static ExecutorService newCachedThreadPool() {
        return new ThreadPoolExecutor(0, Integer.MAX_VALUE,
                                      60L, TimeUnit.SECONDS,
                                      new SynchronousQueue<Runnable>());
    }
```
从上面的工厂方法，可以看出，CachedThreadPool是一个这样配置的ThreadPoolExecutor：  

- corePoolSize：0
- maxPoolSize：Integer.MAX_VALUE
- keepAliveTime：60s
- workQueue: SynchronousQueue

**就像不同CPU、显卡的组合的电脑有不同的用途一样（数据分析、打游戏、视频处理等），不同配置的ThreadPoolExecutor也会产生不同的威力**，CachedThreadPool的这些配置产生的威力在于：  

- **对于新的任务，如果此时线程池里没有空闲线程，线程池会毫不犹豫的创建一条新的线程去处理这个任务。**因为corePoolSize是0，当前线程数肯定大于等于corePoolSize，而workQueue是SynchronousQueue，前面说了，SynchronousQueue是不存放东西的，它只移交，所以你可以认为它的队列一直是满的，最后，maxPoolSize是无穷大，再继续创建也不会达到最大线程数，所以线程池会创建一条新的线程去处理这个任务；
- keepAliveTime是60s，你可以认为这就是线程的失效时间。新创建的线程如果60s内都没有任务要执行（缓存没有命中），那么就会被销毁，而如果在这60s内，线程分配到任务了（缓存命中），那么就可以直接拿这条创建好的线程过去用；
- corePoolSize设置成0还有一个好处，那就是当有一大段时间，线程池都没有接收到新的任务时，线程池里的线程会逐渐被销毁，直到线程池中线程数量降为0，这样整个线程池也就不会占用什么资源了，这个特性，使得CachedThreadPool特别适合处理具有周期性的，并且执行时间短（short-lived）的任务，比如晚上十二点时，会有一波业务过来处理，其他时间段，业务很少甚至没有，这种情况就很适合使用CachedThreadPool

当然，CachedThreadPool会有一个很明显的隐患，那就是线程数量不可控，当然，你已经弄懂了ThreadPoolExecutor几个重要参数，你完全可以自己定制一个有线程数量上限的CachedThreadPool，或者在创建完CachedThreadPool后，使用setMaximumPoolSize方法修改最大线程数量。  

**3、newSingleThreadExecutor**  
触类旁通，很容易理解，这里就不贴源码和解释了。  

**4、 newScheduledThreadPool**  
触类旁通，理解起来有些许难度，这里就不贴源码和解释了。

# 总结
本文围绕ThreadPoolExecutor的构造函数，重点讲解了ThreadPoolExecutor中，几个可以给外部定制的参数的意义和实现原理，希望能对你理解线程池并定制自己的线程池有所帮助。当然，线程池内部还有很多复杂的机制，比如各种状态的管理等等，不过这些都不是外部可以定制的了，后面我们再来讨论。  

# 后记
时钟来到了24点，我跑完了所有ThreadPoolExecutor的测试用例，绿条，全部通过。  
正准备提交代码，回家睡觉，突然发现还没给这个类写上自己的大名，于是，啪啪啪，我在类的头上，留下了我的名字......    

![致敬Doug-Lea大神！](/img/post/2018-03-31-How-ThreadPoolExecutor-Works/Doug-Lea.png)


# 参考
- 《Java并发编程实践》
- [ThreadPoolExecutor (Java Platform SE 8 )](https://docs.oracle.com/javase/8/docs/api/java/util/concurrent/ThreadPoolExecutor.html)
- [ThreadPoolExecutor jenkov.com](http://tutorials.jenkov.com/java-util-concurrent/threadpoolexecutor.html)
- [fixedthreadpool-vs-cachedthreadpool-the-lesser-of-two-evils](https://stackoverflow.com/questions/17957382/fixedthreadpool-vs-cachedthreadpool-the-lesser-of-two-evils)
