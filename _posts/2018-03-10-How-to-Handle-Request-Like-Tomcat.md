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

 - xxx

前情回顾： [Java趣谈——如何构建一个高效且可伸缩的缓存](http://bridgeforyou.cn/2018/02/25/How-to-Build-an-Efficient-and-Scalable-Cache/)

----------
在哆啦的指导下，大雄开发了一个超级缓存，这段经历让大雄不禁感慨，并发真是一门奇妙的学问。然而，Java并发的精髓才刚刚开始......   

# 老马的Web服务器
“大雄，你看过老马以前写的代码吗？”，一个悠闲的午后，哆啦一边吃着下午茶，一边和大雄聊起了八卦。  
“老马？”，大雄一时没反应过来，“你是说我们的CEO老马么？”  
“对啊，不然还能是谁，给你看老马很久以前写的一个Web服务器。”，说着，哆啦把笔记本的屏幕对向了大雄。  
SingleThreadWebServer:  
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
"哇塞，好一段简洁而又优雅的代码！真不愧是老马"  
“哈哈，是吗？你再好好看看，这段代码有什么问题。”  
“有问题？？多好的一个服务器啊，socket.accept()会阻塞，直到有请求过来，然后将请求交给handleRequest方法处理。处理完之后，继续下一个循环，还是调用socket.accept()获取请求，然后处理。”   
“嗯，你挺懂老马的嘛。那我问一个问题，要是有一个请求处理时花费了很多时间呢？”  
“花费很多时间？“，大雄想了一会，”那这次的循环就一直不会结束，也就意味着socket.accept()方法一直不会被执行，也就是说，其他请求不会被处理，直到这次的请求被处理完。这样看来，老马的这段代码有不少问题啊！”  
“哈哈，没错，是有不少问题。不过你要想，老马写这段代码时JDK1.0才刚刚出来，而且那时候业界也没有什么Web服务器可以学习，不像我们现在，有Tomcat这样一个优秀的Web服务器，或者说Java Servlet容器可以参考。作为一个高性能的服务器，Tomcat肯定要解决一个问题：要怎样实现当前请求正在处理的同时，其他请求也可以被同时处理呢？”  
“这个简单，当然是利用多线程！老马之前写的代码，就像他类名说的，是单线程的服务器，自然不能实现同时处理多个请求。”  
“是的，当时之所以用单线程，一是硬件资源的限制，二是那时我们业务的请求不多，一天也不超过100条请求，而且基本都是非常轻量级的请求。但是现在不一样了，我们的Web服务器每天的访问量越来越多，而且请求也不再都是轻量级的了，有些请求动不动就要花费数秒钟的处理时间。”  
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
“咱先不说'为每个任务创建一条线程'这个方案好不好，咱先聊聊代码设计“，哆啦喝了口水，接着说，”虽说老马之前写的单线程服务器性能不高，但还是有适用场景的，比如在那些请求量很少而且请求都是轻量级的场合，就可以使用单线程，照你这样写，难道要我们跟客户说，‘单线程的，执行SingleThreadWebServer，多线程的，执行ThreadPerTaskWebServer’，而且，你们这两个服务器有很多类似的代码，完全可以合并为一个服务器。“  
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
“啊啊，经常变动的地方，要抽取出来。可是这里要使用什么设计模式呢？”  
“小子，好好想想，我们这里是想将请求的产生和请求的处理进行解耦，我们Web服务器只负责接收请求，至于按照什么方式处理请求，是单线程还是多线程，这个我们交给别的类去处理”  
“产生和处理？”，大雄若有所思，“啊，是生产者-消费者模式！”  
“没错，也可以认为是命令模式。”  

# 使用设计模式解耦代码


# 使用生产者消费者模式改良设计

# 线程池

# 参考
