---

layout:     post                    # 使用的布局（不需要改）
title:      如何用一句话介绍synchronize的内涵               # 标题 
subtitle:    #副标题
date:       2018-01-20              # 时间
author:     ZY                      # 作者
header-img: img/banner/java-synchronize.jpg    #这篇文章标题背景图片
catalog: true                       # 是否归档
tags:                               #标签
    - Java
    - Concurrency

---
# 内涵与表象
关于synchronize，一个非常通俗易懂，很容易记住的解释是：
> Java语言的关键字，当它用来修饰一个方法或者一个代码块的时候，能够保证在同一时刻最多只有一个线程执行该段代码。  

这个解释很好，它**非常直观**的告诉我们使用synchronize会带来什么效果。  
然而，也正因为如此，这个解释太过停留在了**表面**，就像给一款洗衣机做广告，广告中说这款自动式洗衣机可以一键洗衣一样，如果只是这样说，那根本无法展示这台洗衣机有什么与众不同的地方，因为市面上可以一键式操作的洗衣机太多了，必须向客户抛出问题，这款洗衣机是如何一键式完成整个洗衣流程的、为什么这款洗衣机洗的比别人干净，然后贴上各种高科技高逼格的图片、播放各种酷炫的动画视频，这样，客户才了解了这款洗衣机的**内涵**，才有可能对这款洗衣机动心。  

回到synchronize，开头的解释告诉我们，synchronize可以“保证在同一时刻最多只有一个线程执行该段代码”，那么，我们就不得不去想： 

- synchronize是如何“保证在同一时刻最多只有一个线程执行该段代码”的？
- “保证在同一时刻最多只有一个线程执行该段代码”，这又会带来什么意义？

太长不看版：
> Java中的synchronize，通过使用**内置锁**，来实现对变量的同步操作，进而实现了对变量操作的**原子性**和其他线程对变量的**可见性**，从而确保了并发情况下的线程安全。


# 基本用法
首先还是要刷一把代码，我会用一个简单的例子演示如何使用synchronize，并对其进行测试。如果你已经了解了synchronize的用法，可以快速略读这一小节。  

假设我们要给一个处理器加入计数器，每次调用时给计数器加一，为方便扩展，我们定义了如下接口（**本文的示例代码，可到[Github](https://github.com/hzy38324/Coding-Pratice)下载**）：  
CountingProcessor:  
```java
public interface CountingProcessor {
    void process();
    long getCount();
}
```
不使用同步机制，我们写出了第一个版本：  
UnThreadSafeCountingProcessor:  
```java
public class UnThreadSafeCountingProcessor implements CountingProcessor {

    private long count = 0;

    public void process() {
        doProcess();
        count ++;
    }

    public long getCount() {
        return count;
    }

    private void doProcess() {
    }
}
```
这个版本自然是线程不安全的，原因就是之前在《[如何写出线程不安全的代码](http://bridgeforyou.cn/2017/12/31/How-to-Write-Un-Thread-Safe-Code/)》里提到的，count++是一个“读取-修改-写入”三个动作的操作序列。要想验证这个类是线程不安全的，非常简单，写个测试类测一下就知道了（用例写的比较粗糙，后面再来谈谈如何测试并发程序）：  
SynchronizeProcessTest:
```java
public class SynchronizeProcessTest {

    public static final int LOOP_TIME = 1000 * 10000;

    @Test
    public void test_UnThreadSafeCountingProcessor() {
        CountingProcessor countingProcessor = new UnThreadSafeCountingProcessor();
        runTask(countingProcessor);
    }

    private void runTask(CountingProcessor processor) {
        Thread thread1 = new Thread(new ProcessTask(processor, LOOP_TIME), "thread-1");
        Thread thread2 = new Thread(new ProcessTask(processor, LOOP_TIME), "thread-2");
        thread1.start();
        thread2.start();
        // wait unit all the threads have finished
        while(thread1.isAlive() || thread2.isAlive()) {}
    }
}
```  
其中的ProcessTask如下所示：  
```java
public class ProcessTask implements Runnable {

    private static Logger logger = LoggerFactory.getLogger(ProcessTask.class);

    private CountingProcessor countingProcessor;
    private long loopTime;

    public ProcessTask(CountingProcessor countingProcessor, long loopTime) {
        this.countingProcessor = countingProcessor;
        this.loopTime = loopTime;
    }

    public void run() {
        int i = 0;
        while (i < loopTime) {
            countingProcessor.process();
            i ++;
        }
        logger.info("Finally, the count is {}", countingProcessor.getCount());
    }
}
```
在ProcessTask里，我们不断循环执行process()方法，让计数器不断递增。然后在测试类中，我们创建了两个线程，分别指定ProcessTask的循环次数为一千万次，最后查看日志打印，如果程序时线程安全的，那么当最后一个线程结束时，打印的计数器应该是两千万，接着我们运行测试用例：  
![](/img/post/2018-01-20-Java-Synchronize/fail-test.png)  
从运行结果可以看出来，在经历了两千万次调用后，count的值是10469363，少计算了快一半。  

要让我们这个计数器变得线程安全，有很多种方法，这里只介绍使用synchronize的两种方法，第一种，我们可以给整个函数加上synchronize修饰符：  
SynchronizeMethodCountingProcessor:  
```java
	...  
    public synchronized void process() {
        doProcess();
        count++;
    }
	...  

```
这样子固然可以解决问题，但是我们其实没必要对整个函数都进行同步，这样会影响程序的吞吐量，我们只需要在计数器加一的过程进行同步就好了，由此我们写出第二种synchronize的版本，也就是synchronize代码块：  
SynchronizeBlockCountingProcessor:  
```java
	...
    public void process() {
        doProcess();
        synchronized (this) {
            count ++;
        }
    }
	...
```
同样，我们给这两个类增加两个测试用例，借助前面良好的程序设计，我们这两个用例得以写的非常简洁：  
SynchronizeProcessTest:  
```java
	...

    @Test
    public void test_SynchronizeMethodCountingProcessor() {
        CountingProcessor countingProcessor = new SynchronizeMethodCountingProcessor();
        runTask(countingProcessor);
    }

    @Test
    public void test_SynchronizeBlockCountingProcessor() {
        CountingProcessor countingProcessor = new SynchronizeBlockCountingProcessor();
        runTask(countingProcessor);
    }

	...
```  
执行用例：  
![](/img/post/2018-01-20-Java-Synchronize/success-test1.png)  
![](/img/post/2018-01-20-Java-Synchronize/success-test2.png)  
可以看到，使用synchronize改造后的版本，最后count都等于两千万，说明它们是线程安全的。

# 原子性
上面的例子，展示了synchronize的一个作用：**确保了操作的原子性**。  
原先count++是三个动作，其他线程可以在这三个操作之间对count变量进行修改，而在使用了synchronize之后，这三个动作就变成一个不可拆分、一气呵成的动作，不必担心在这个操作的过程中会有其他线程进行干扰，这就是原子性。  
原子操作是线程安全的，这其实也是我们经常使用synchronize来实现线程安全的原因。  

# 可见性
上面我们提到了synchronize的第一个作用，确保原子性，这其实是从**使用synchronize的线程**的角度来讲的，而如果我们从**其他线程**的角度来看，那么synchronize则是实现了**可见性**。  
可见性的意思是变量的修改可以被其他线程观察到，在上面计数器的例子中，由于一次只有一个线程可以执行count++，抢不到锁的线程，必须等抢到锁的线程更新完count之后，才可以去执行count++，而这个时候，count也已经完成了更新，新的锁持有者，可以看到更新后的count，而不至于拿着旧的count值去进行计算，这就是可见性。 
 
提起可见性，我们就不得不提到volatile关键字，volatile实现了比synchronize更轻量级的同步机制，或者说，加锁机制既确保了可见性，有确保了原子性，而volatile只能保证可见性。  
> Locking can guarantee both visibility and atomicity; volatile variables can only guarantee visibility. —— 《Java并发编程实践》

关于volatile关键字，我们后面再单独研究，这里就不深入探讨了。  

下面，让我们来探讨开头提的问题，synchronize是如何“保证在同一时刻最多只有一个线程执行该段代码”的？  

# 内置锁
关于synchronize，我们经常使用的隐喻就是锁，首先进入的线程，拿到了锁的唯一一把钥匙，至于其他线程，就只能阻塞（Blocked）；等到线程走出synchronize之后，会把锁释放掉，也就是把钥匙扔出去，下一个拿到钥匙的线程，就可以结束阻塞状态，继续运行。  
但是锁从哪来呢？随随便便抓起一个东西就可以作为锁么？  
还真是这样，**Java中每一个对象都有一个与之关联的锁**，称为**内置锁**：  
> Every object has an intrinsic lock associated with it. —— [The Java™ Tutorials](https://docs.oracle.com/javase/tutorial/essential/concurrency/locksync.html)

当我们使用synchronize修饰非静态方法时，用的是调用该方法的实例的内置锁，也就是**this**;  
当我们使用synchronize修饰静态方法时，用的是调用该方法的所在的**类对象**的内置锁;  
更多时候，我们使用的是synchronize代码块，我们经常用的是synchronize(this)，也就是把对象实例作为锁。  

同一时间进入同一个锁的线程只有一个，如果我们希望有多个线程可以同时进入多个加了锁的方法，那只靠一个this锁肯定是不够的，那怎么办？一点都不担心，还记得上面说的吗，Java中每个对象都是锁，想用的时候new一个Object就好了：  
```
public class MsLunch {
    private long c1 = 0;
    private long c2 = 0;
    private Object lock1 = new Object();
    private Object lock2 = new Object();

    public void inc1() {
        synchronized(lock1) {
            c1++;
        }
    }

    public void inc2() {
        synchronized(lock2) {
            c2++;
        }
    }
}
```
Java中只能使用对象作为锁吗，当然不是的，我们还可以自己打造一把锁，也就是**显示锁**，比如这样：  
```
      Lock lock = ...;
      if (lock.tryLock()) {
          try {
              // manipulate protected state
          } finally {
              lock.unlock();
          }
      } else {
          // perform alternative actions
      }
```
至于显示锁具体怎么用和它的原理，以及Java中其他奇奇怪怪的锁，我们也不在这里细究，后面再和大家一块探讨。  

# 重入
最后再来看看这个代码有什么问题： 
```java
public class Widget {
	public synchronized void doSomething() {
		...
	}
}

public class LoggingWidget extends Widget {
	public synchronized void doSomething() {
		System.out.println(toString() + ": calling doSomething");
		super.doSomething();
	}
}
```
分析：  
前面提到，synchronized修饰非静态方法时，用的是调用该方法的对象实例作为锁，所以上面的代码中，调用LoggingWidget的doSomething时，拿到了实例的锁的钥匙，接着再去调用父类的doSomething方法，父类的方法同样被synchronized修饰，此时钥匙已经被拿走了而且还没释放，所以阻塞，而阻塞导致LoggingWidget的doSomething方法无法执行完成，因而锁一直不会被释放，所以，死锁了？？？  

**当然不是**，上面的理解错在了弄错了**锁的持有者**，**锁的持有者是“线程”，而不是“调用”**，线程在进入LoggingWidget的doSomething方法时，已经拿到this对象内置锁的钥匙了，下次再碰到同一把锁，自然是用同一把钥匙去打开它就可以了。这就是内置锁的**可重入性**（Reentrancy）。  
  
既然锁是可重入的，那么也就意味着，JVM不能简单的在线程执行完synchronized方法或者synchronized代码块时就释放锁，因为线程可能同时“重入”了很多道锁，事实上，JVM是借助锁上的**计数器**来判断是否可以释放锁的：
> Reentrancy  is  implemented  by associating with each lock an acquisition **count** and an owning thread. When the count is zero, the lock is considered unheld. When a thread acquires a previously unheld lock, the JVM records the owner and sets the acquisition count to one.  If  that  same  thread  acquires  the  lock  again,  the  count  is  incremented,  and  when  the  owning  thread  exits  the synchronized block, the count is decremented. When the count reaches zero, the lock is released. —— 《Java并发编程实践》

如果将含有synchronized代码块的代码编译出来的class文件，使用javap进行反汇编，你可以看到会有两条指令：
monitorenter和monitorexit，这两条指令做的也就是上面说的那些事，有兴趣的同学可以研究一下。  

# 总结
这篇文章主要对Java中的synchronized做了一些研究，总结一下：  

1. Java中每个对象都有一个**内置锁**。
1. 与内置锁相对的是**显示锁**，使用显示锁需要手动创建Lock对象，而内置锁则是所有对象自带的。
1. synchronized使用对象自带的内置锁来进行加锁，从而保证在同一时刻最多只有一个线程执行代码。
1. 所有的加锁行为，都可以带来两个保障——**原子性**和**可见性**。其中，原子性是相对锁所在的线程的角度而言，而可见性则是相对其他线程而言。
2. **锁的持有者是“线程”**，而不是“调用”，这也是锁的为什么是**可重入**的原因。

如何向一个新手介绍synchronized的表象？  
> Java语言的关键字，当它用来修饰一个方法或者一个代码块的时候，能够保证在同一时刻最多只有一个线程执行该段代码。 

如何在一个老司机面前装逼格？  
> Java中的synchronize，通过使用**内置锁**，来实现对变量的同步操作，进而实现了对变量操作的**原子性**和其他线程对变量的**可见性**，从而确保了并发情况下的线程安全。

# 后记
难道synchronize就是这样了？自然不是，只要你继续研究，肯定还会提出很多问题。我先提一个：

- 抢不到锁而进入阻塞状态的线程，怎么知道锁什么时候会被释放？

要想弄清楚synchronize的原理，最直截了当的方式自然是看源码，当然这也是难度最大的，毕竟JVM源码都是C语言；另一种方法就是不断向自己提问，然后不断搜索资料，解答自己提出的问题。  

看似简单的知识，深究起来，往往没那么简单。  
只有学会提问，才能透过表象，看清原理；理解了原理，遇到Bug才能不慌。

# 参考
- 《Java并发编程实践》
- [Synchronized Methods](https://docs.oracle.com/javase/tutorial/essential/concurrency/syncmeth.html)
- [Intrinsic Locks and Synchronization](https://docs.oracle.com/javase/tutorial/essential/concurrency/locksync.html)