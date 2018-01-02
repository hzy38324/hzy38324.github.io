---
layout:     post                    # 使用的布局（不需要改）
title:      如何写出线程不安全的代码               # 标题 
subtitle:    #副标题
date:       2017-12-31              # 时间
author:     ZY                      # 作者
header-img: img/banner/how-to-write-un-thread-safe-code.jpg    #这篇文章标题背景图片
catalog: true                       # 是否归档
tags:                               #标签
    - Java
    - 并发编程
---
# 什么是线程安全性
很多时候，我们的代码，在单线程的环境下是可以运行的非常完美，然而，一旦把代码放到多线程的环境下去接受蹂躏，结果常常是惨不忍睹的。  

《Java并发编程实践》中，给出了**线程安全性**的解释：

> A class is thread-safe when it continues to **behave** **correctly** when accessed from multiple threads. 

当一个类，不断被多个线程调用，仍能表现出正确的行为时，那它就是线程安全的。  
这里的关键在于对“**正确的行为**”的理解，什么意思呢？多写几个线程不安全的代码你就明白了。

# 消失的请求数
假设我们需要给Servlet增加一个统计请求数的功能，于是我们使用了一个long变量作为计数器，并在每次请求时都给这个计数器加一（**本文的所有代码，可到[Github](https://github.com/hzy38324/Coding-Pratice/tree/master/CodePractice/src/main/java/com/sexycode/codepractice/unthreadsafe)下载**）：
```java
public class UnsafeCountingServlet extends GenericServlet implements Servlet {
    private long count = 0;

    public long getCount() {
        return count;
    }

    public void service(ServletRequest servletRequest, ServletResponse servletResponse) throws ServletException, IOException {
        ++count;
        // To something else...
    }
}
```
在单线程的环境下，这份代码绝对正确，然而，当有多个线程同时访问时，问题就暴露了。  

关键就在于++count，它看上去只是一个操作，实际上包含了三个动作：
1. 读取count
2. 将count加一
3. 将count的值到内存中

这是一个“**读取-修改-写入**”的操作序列，因此假设现在count是9，然后：
1. 线程A进入service方法，读到count值是9
2. 在A修改完count的值但是还没写入内存之前，线程B也进入service方法，并且读取了count值，这时候线程B读取到的count还是9
3. 最后，两个线程都对值为9的count，进行了加一的操作，两次请求下来，计数器只增加了一次。  

显然，这个类，在多线程的环境下，**没有表现出我们预期的行为**，所以称它为**线程不安全**。  

# 意外怀孕
这一次，我们需要写一个单例，单例很简单呀，不就是构造函数私有化么：
```java
public class UnsafeSingleton {
    private static UnsafeSingleton instance = null;

    private UnsafeSingleton() {

    }

    public static UnsafeSingleton getInstance() {
        if (instance == null)
            instance = new UnsafeSingleton();
        return instance;
    }
}
```
如果只有一个线程调用我们的代码，那这个类，永远不会生出二胎。但是，放在多线程的环境下，它就可能会意外怀孕了： 

1. 线程A调用getInstance方法，这时候instance是null，进入if代码块
2. 在线程A执行new UnsafeSingleton()之前，线程B先跨一步，执行if判断，这时候instance还是null，嗯，线程B也进去了
3. 接下来，两个线程都会执行new UnsafeSingleton()...悲剧就这样发生了

预期中的计划生育失败，我们再一次写出了线程不安全的代码。

# 考题泄漏
如果说前面两种破坏方式都太过明显，很难在代码review中逃过法眼的话，接下来这种方式，就显得非常高级了。
```java
public class ThisEscape {
    private final List<Event> listOfEvents;

    public ThisEscape(EventSource source) {
        source.registerListener(new EventListener() {
            public void onEvent(Event e) {
                doSomething(e);
            }
        });
        listOfEvents = new ArrayList<Event>();
    }

    void doSomething(Event e) {
        listOfEvents.add(e);
    }


    interface EventSource {
        void registerListener(EventListener e);
    }

    interface EventListener {
        void onEvent(Event e);
    }

    interface Event {
    }
}
```  
这个类的构造函数接收了一个事件源，在构造函数中，会给事件源添加一个监听器。咋看之下，你也许不会发现这段代码有什么问题，其实这里面暗藏着NullPointerException：

1. 线程A将事件源传入构造函数，并且执行了registerListener的代码
2. 在线程A给listOfEvents初始化之前，线程B触发了事件源，由于线程A已经往事件源注册了监听器，因此会执行onEvent函数，也就是doSomething(e);
3. 而此时listOfEvents还没被初始化，因此listOfEvents.add(e)报空指针异常

这一切的根源都在于，ThisEscape的构造函数，在ThisEscape还没实例化完成之前，**就把this对象泄漏出去**，使得外部可以调用实例对象的方法，这就像还没开考，就把考题给公布出去了，因此称之为，考题泄漏。  

《Java并发编程实践》将这种误把对象发布出去的行为，称为对象逸出（Escape）。

# 半成品
对象逸出是指不想发布对象，却不小心发布了。还有一种是，想发布对象，却在对象还没制造好之前，就给了对方使用半成品的机会：
```java
public class StuffIntoPublic {
    public Holder holder;

    public void initialize() {
        holder = new Holder(42);
    }
}

public class Holder {
    private int n;

    public Holder(int n) {
        this.n = n;
    }

    public void assertSanity() {
        if (n != n)
            throw new AssertionError("This statement is false.");
    }
}
```
很难想象，什么情况下n != n会成立，并抛出异常。大家可以先参考[StackOverflow](https://stackoverflow.com/questions/1621435/not-thread-safe-object-publishing)里的解释，主要是涉及到Java的**指令重排**，后面会给大家详细讲解。

# 小结
这篇文章给大家解释了什么是线程安全，并且举了四个线程不安全的例子来加深大家对线程安全的理解：消失的请求数、意外怀孕、考题泄漏、半成品。这四个例子，分别对应三种常见的线程不安全情形：

1. 读取-修改-写入： 对应上面“消失的请求数”的例子
2. 先检查后执行：对应上面“意外怀孕”的例子
3. 发布未完整构造的对象：对应上面“考题泄漏”和“半成品”两个例子

绝大多数的线程不安全问题，都可以归结为这三种情形。而这三种情形，其实又可以再缩减为两种：**对象创建时**和**对象创建后**。**不仅仅是在对象创建后的业务逻辑中要考虑线程的安全性，在对象创建的过程中，也要考虑线程安全**。  

# 后记
这篇文章里只是解释了为什么这些代码会有线程安全问题，并没有跟大家说如何对代码进行修改，使之成为“线程安全”，我会在后面的文章中和大家一起详细探讨。  

有人可能会说，线程安全嘛，加**同步锁**不就可以啦，其实不然，光光同步锁，就有很多可以探究的了：

1. 同步锁的原理是什么
2. 锁的重入(Reentrancy)是什么
3. 同步锁的本质？
4. ... 

更何况，解决并发问题，也**绝对不是加锁这么简单**，我们还需要了解：

1. volatile关键字的含义
2. 指令重排是什么
3. 如何安全的发布对象
4. 如何设计一个线程安全的类
5. ...

再者，解决了线程安全，我们还需要考虑线程的**生命周期管理**、线程使用的**性能**问题等：

1. 如何取消一个线程
2. 如何关闭一个有很多线程的服务
3. 如何设计线程池的大小
4. ThreadPoolExecutor，Future等Java线程框架的使用
5. 线程被中断了如何处理
6. 线程池资源不够了，有什么处理策略
7. 死锁的N种情形
8. ...

乃至我们学习Java并发编程最最初始的问题：  

1. **我们为什么要学习并发编程**
2. 并发和异步的关系

这些，都是我新的一年里要和大家一起分享的，分享的内容主要基于《Java并发编程实践》里提到的知识，我买了中文版和英文版。这是一本很难啃的书，我会一如既往的用通俗易懂的语言来和大家分享我的学习心得。

# 参考

- 《Java并发编程实践》
- [how-is-listing-3-7-working-in-java-concurrency-in-practice](https://stackoverflow.com/questions/28237509/how-is-listing-3-7-working-in-java-concurrency-in-practice)
- [not-thread-safe-object-publishing](https://stackoverflow.com/questions/1621435/not-thread-safe-object-publishing)