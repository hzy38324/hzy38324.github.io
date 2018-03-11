---
layout:     post                    # 使用的布局（不需要改）
title:      Java趣谈——如何像Tomcat一样处理请求               # 标题 
subtitle:   #副标题
date:       2018-03-10              # 时间
author:     ZY                      # 作者
header-img: img/banner/how-to-handle-request-like-tomcat.jpg    #这篇文章标题背景图片
catalog: true                       # 是否归档
tags:                               #标签
    - 
---
本集概要：  

 - 基于单线程的Web服务器有什么缺点？
 - 给每个请求创建一条线程，这样做有什么坏处？
 - 怎样利用设计模式，解耦任务的创建和任务的执行？
 - 为什么要使用线程池，它能给我们带来什么？

前情回顾： [Java趣谈——如何构建一个高效且可伸缩的缓存](http://bridgeforyou.cn/2018/02/25/How-to-Build-an-Efficient-and-Scalable-Cache/)

----------

上一集，大雄在哆啦的指导下，开发了一个超级缓存，这段经历让大雄不禁感慨，并发真是一门奇妙的学问。然而，Java并发的精髓才刚刚开始......   

# 老马的Web服务器
“大雄，你看过老马以前写的代码吗？”，一个悠闲的午后，哆啦一边吃着下午茶，一边和大雄聊起了八卦。  
“老马？”，大雄一时没反应过来，“你是说我们的CEO老马么？”  
“对啊，不然还能是谁，给你看老马很久以前写的一个Web服务器。”，说着，哆啦把笔记本的屏幕对向了大雄。  
SingleThreadWebServer（**本文的示例代码，可到[Github](https://github.com/hzy38324/Coding-Pratice)下载**）:  
```java
public class SingleThreadWebServer {
    public static void main(String[] args) throws IOException {
        ServerSocket socket = new ServerSocket(80);
        while (true) {
            Socket connection = socket.accept();
            handleRequest(connection);
        }
    }

    private static void handleRequest(Socket connection) {
        // request-handling logic here
    }
}
```
"哇塞，好一段简洁而又优雅的代码！真不愧是老马！"  
“哈哈，是吗？你再好好看看，这段代码有没有什么问题？”  
“有问题？？多好的一个服务器啊，socket.accept()会阻塞，直到有请求过来，然后将请求交给handleRequest方法处理。处理完之后，继续下一个循环，还是调用socket.accept()获取请求，然后处理。”   
“嗯，你挺懂老马的嘛。那我问一个问题，要是有一个请求处理时花费了很多时间呢？”  
“花费很多时间？“，大雄想了一会，”那这次的循环就一直不会结束，也就意味着其他请求不会被处理，直到这次的请求被处理完。”  
“没错，如果这个请求一直不结束，新的请求就一直不会被处理，**在用户看来服务器就是没有响应**。”  
"这样看来，老马的这段代码有不少问题啊！”  
“哈哈，没错，是有不少问题。不过你要想，老马写这段代码时JDK1.0才刚刚出来，而且那时候业界也没有什么Web服务器可以学习，不像我们现在，有Tomcat这样一个优秀的Web服务器，或者说Java Servlet容器可以参考。作为一个高性能的服务器，Tomcat肯定要解决一个问题：**要怎样实现当请求正在处理的同时，其他请求也可以同时被处理呢**？”  
“这个简单，**当然是利用多线程**！老马之前写的代码，就像他类名说的，是单线程的服务器，自然不能实现同时处理多个请求。”  
“是的，当时之所以用单线程，一是硬件资源的限制，二是那时我们业务的请求不多，一天也不超过100条请求，**而且都是非常轻量级的请求**。但是现在不一样了，我们的Web服务器每天的访问量越来越多，而且请求也不再都是轻量级的了，有些请求动不动就要花费数秒钟的处理时间。”  
“这个改造起来很简单啊，给每个请求，或者说是每个任务，创建一条线程去处理就好了”，说完，大雄拿起键盘，噼里啪啦就敲了起来。  

# 大雄的Web服务器
很快，大雄的“为每个任务创建一条线程”的Web服务器就写好了，ThreadPerTaskWebServer:  
```java
public class ThreadPerTaskWebServer {
    public static void main(String[] args) throws IOException {
        ServerSocket socket = new ServerSocket(80);
        while (true) {
            final Socket connection = socket.accept();
            Runnable task = () -> handleRequest(connection);
            new Thread(task).start();
        }
    }

    private static void handleRequest(Socket connection) {
        // request-handling logic here
    }
}
```
"小子，可以啊，还会用lambda表达式替换内部类了。"  
“那是，这可是JDK1.8的新特性”  
“哈哈，新特性倒是掌握的挺快。只不过，这基本功还不太扎实...”  
“哦？愿闻其详...”，大雄故作谦虚的说。  
“咱先不说'为每个任务创建一条线程'这个方案好不好，咱先聊聊代码设计“，哆啦喝了点水，接着说，”虽说老马之前写的单线程服务器性能不高，但还是有适用场景的，比如在那些请求量很少而且请求都是轻量级的场合，就可以使用单线程，照你这样写，难道要我们跟客户说，‘单线程的，执行SingleThreadWebServer，多线程的，执行ThreadPerTaskWebServer’，而且，你们这两个服务器有很多重复的代码，这些问题你要怎么解决？“  
“那就给客户提供一个properties文件，然后根据客户的配置，我们在服务器里使用不同的请求处理方式？就像这样”，说着，大雄在纸上打起了草稿：
```java
...  
String serverType = readProps();
if("singleThread".equals(serverType)) {
  // 单线程处理
} else if("multiThread".equals(serverType)) {
  // 多线程处理
}
...  
```
"你这样处理，要是以后我们有其他处理请求的方式呢？"  
“那就再加个else if判断！”，大雄不假思索的说。  
“小子，设计模式白学了？”，哆啦拍了下大雄的脑袋，“经常变动的地方，要怎么样？”  
“啊啊，**经常变动的地方，要抽取出来**。可是这里要使用什么设计模式呢？”  
“小子，好好想想，**我们这里是想将请求的产生和请求的处理进行解耦**，我们Web服务器只负责接收请求，至于按照什么方式处理请求，是单线程还是多线程，这个我们交给别的类去处理”  
“产生和处理？”，大雄若有所思，“啊，**是生产者-消费者模式**！”  
“没错，**也可以说是命令模式**。”  

# 使用设计模式解耦代码
“首先，我们需要一个Executor接口，每种任务的执行方式都对应一个实现了Executor接口的类”，大雄说着，写起了代码，Executor:  
```java
public interface Executor {
    void execute(Runnable command);
}
```
“然后，之前老马的单线程服务器的任务执行过程，可以抽取到这里来”，SingleThreadTaskExecutor:  
```java
public class SingleThreadTaskExecutor implements Executor {
    public void execute(Runnable r) {
        r.run();
    };
}
```
“我的多线程服务器，也可以抽取”，ThreadPerTaskExecutor:  
```java
public class ThreadPerTaskExecutor implements Executor {
    public void execute(Runnable r) {
        new Thread(r).start();
    };
}
```
“接下来，我们给这两个Executor写一个工厂类，通过读取配置文件，决定给客户返回什么类型的Executor”，ExecutorFactory（篇幅原因，部分内容省略，想看完整代码的同学可到[Github](https://github.com/hzy38324/Coding-Pratice)查看）:
```java
public class ExecutorFactory
{

    static {
        readPropertiesFromConfigFile();
    }

    public static Executor newExecutor() {
        switch (executorType) {
            case SINGLE_THREAD:
                return new SingleThreadTaskExecutor();
            case THREAD_PER_TASK:
                return new ThreadPerTaskExecutor();
            default:
                return new SingleThreadTaskExecutor();
        }
    }

    private static void readPropertiesFromConfigFile() {
		... 
    }

}
```
“接下来就可以在我们的Web服务器中，通过ExecutorFactory获得任务执行器，来执行任务了”，TaskExecutionWebServer:  
```java
public class TaskExecutionWebServer {
    private static Logger log = LoggerFactory.getLogger(TaskExecutionWebServer.class);

    private static final Executor exec
            = ExecutorFactory.newExecutor();

    public static void main(String[] args) throws IOException {
        log.info("The executor you are using is {}", exec);

        ServerSocket socket = new ServerSocket(80);
        while (true) {
            final Socket connection = socket.accept();
            Runnable task = () -> handleRequest(connection);
            exec.execute(task);
        }
    }

    private static void handleRequest(Socket connection) {
        // request-handling logic here
    }
}
```
“这样就实现请求产生和请求执行的解耦了，以后要是有其他请求执行的方式，只需要写多一个实现了Executor接口的执行器，修改下配置文件，就可以了，**完全不用动TaskExecutionWebServer的代码**。”  
“不错嘛，小伙子，对设计模式的运用还是挺熟的。”  
“那当然。”  
“好了，解决了代码结构设计的问题，再来看看你这个多线程服务器的方案。”  
“嗯？方案有什么问题么？”  
“你现在是每个请求过来，都创建一条线程。有没有考虑过，如果一万个请求同时过来，会怎么样，十万、一百万、一千万呢？”  
“啊，那就会同时创建一千万条线程！我们的处理器才多少个，这样肯定会**有很多条线程处于无所事事的状态**。”  
“不仅如此，**线程的创建和销毁都是需要时间的**，给一个非常轻量级的请求，创建一条线程去处理，有可能创建和销毁线程消耗的时间，比请求处理的时间还长，你说这样划算么？”  
“啊，还有一点，**线程占内存，创建过多的线程还会导致内存溢出**！”，大雄不禁感慨，自己写的一个看着很安全的代码，竟然有这么多Bug。  
“哈哈，这下发现自己的代码很渣渣了吧？”，哆啦逗趣着。  
“这。。。有什么更好的方案么？”  
“**你需要一个池子**”，哆啦故作神秘的说。  

# 线程池
“我们需要一个线程池，在服务器启动的时候，**先创建一定数量的线程**，比如说十条”，哆啦停顿了一下，接着说，“这样当有请求过来时，**我们直接从池子里，取出一条已经创建好的线程，就可以处理请求了**。”  
“哇，**这样就省去了创建线程的时间**。”  
“而且，**我们还将线程的数量控制住了**，不再无限制的创建线程。我们可以根据实际情况，调整线程池中线程的数量，**使CPU达到最佳的忙碌状态**，当然，这需要更高的技术觉悟了。”  
“好，那我想想代码怎么写！”，大雄非常激动，跃跃欲试。  
“着急啥，你以为你是轮子哥？”  
“啊？已经有造好的轮子了？”  
“当然啊，JDK已经提供了很多种Executor的实现了，通过调用**Executors**的工厂方法，比如**newFixedThreadPool**、**newCachedThreadPool**、**newSingleThreadExecutor**、**newScheduledThreadPool**等，就可以获得各种不同实现方式的线程池，这些线程池类都实现了JDK的Executor接口，代码和你写的那个一样。“  
”哈？想不到我的想法竟然和JDK大神们的想法一样！“，大雄兴奋的说。  
“想多了，懂设计模式的人都可以写出Executor接口，要不然怎么说设计模式是程序员的**共享词汇**呢？”  
”Soga...“  
"不过，人家的线程池，并不直接实现Executor接口，人家实现的是ExecutorService接口，这个接口继承了Executor接口，给Executor接口扩展了一些**生命周期管理**的功能，比如关闭线程池、判断线程池是否关闭等，具体你可以再研究下源码了。"   
“哇塞，高级！这个高级！”，大雄看着源码，越看越入神......  

# 总结
这篇文章里，我们使用了生产者消费者模式改良了代码设计，同时引出了Java线程池，总结一下知识点：  
- **生产者消费者模式**。通过使用生产者消费者模式，我们将任务创建和任务执行解耦开来，当然，这也是JDK各种线程池都遵循的设计思想，理解了这一点，有助于我们使用Java 线程池，更有利于我们去理解JDK源码。  
- **线程池**。之所以使用线程池，**是因为它既解决了单线程低吞吐量、响应慢的缺点，又解决了为每个任务创建一条线程所带来的资源管理的问题**。相比单线程，线程池使用了多线程来处理请求，提升了吞吐量和响应速度；相比无限制创建线程的方案，线程池控制了线程的数量，使线程数量维持在合理的水平，充分发挥CPU的作用，也防止线程过多占用内存；同时，线程池提前创建好了线程，省去了请求过来时创建线程的时间。
- **“池”的思想**。**软件中的“池”，可以理解为计划经济时代的工厂**，你要提前生产东西，这样当老百姓或者政府有需要的时候，可以马上提供，但是你又不能无限制的生产，毕竟资源就那么多，都被你拿去生产了，其他人怎么办。数据库连接池是这样，线程池也是如此。  

# 后记
这篇文章的目的是想让读者了解，为什么要使用线程池。篇幅原因，很多东西没有在这篇文章中分享。  

比如，虽说文章名称叫《如何像Tomcat一样处理请求》，但是实际上Tomcat处理请求时，除了使用线程池，其他的逻辑肯定会更为复杂；  

又比如，你想不想知道，请求到了Tomcat后，是如何来到我们的代码中的呢，假设你使用的是SpringMVC；   

Tomcat、Servlet、SpringMVC/Struts，它们之间又是什么关系？  

各种线程池的作用是什么，比如什么时候要使用newCachedThreadPool、什么时候要使用newSingleThreadExecutor，它们的内部实现是怎么样的？  

等等这些问题，读者有兴趣都可以先去研究一下，我也将在后面的文章中和大家分享。  

# 参考
- 《Java并发编程实践》
- [how does Tomcat or any webserver handles requests and dispatches responses?](https://stackoverflow.com/questions/28183075/how-does-tomcat-or-any-webserver-handles-requests-and-dispatches-responses)
- [What is Java Servlet?](https://stackoverflow.com/questions/7213541/what-is-java-servlet)