---
layout:     post                    # 使用的布局（不需要改）
title:     ThreadLocal趣谈 —— 杨过和他的四个冤家              # 标题 
subtitle:   #副标题
date:       2018-06-09              # 时间
author:     ZY                      # 作者
header-img: img/banner/how-to-explain-restful-to-my-wife.png    #这篇文章标题背景图片
catalog: true                       # 是否归档
tags:                               #标签
    - ThreadLocal
    - Java
---
作为一篇趣谈，这篇文章不打算太过深入的分析ThreadLocal内部机制。  

只希望通过一种有趣的方式，让大家了解ThreadLocal的两大用途：  

- **实现线程安全；**
- **保存线程上下文信息**；

源码的事，后面再讨论。  

这篇趣谈的主人公是杨过。我们将聊聊杨过是如何利用ThreadLocal打败四大高手的。  

# 一个一个上
一日醒来，杨过发现小龙女离家出走，于是外出寻找，不料碰上了金轮法王、李莫愁、裘千尺、公孙止四个冤家。  

“哼，四个打我一个，算什么英雄好汉，有本事的，一个一个上！”  

按照杨过的说法，这个场景，写成Java代码，大概就是这样：  
```java
public class ThreadSafeSDFUsingSync {
    private SimpleDateFormat sdf = new SimpleDateFormat("yyyyMMdd HHmm");

    public synchronized String formatIt(Date date) {
        return sdf.format(date);
    }
}
```
杨过就是这个线程不安全的SimpleDateFormat，一旦被多个线程同时操作（被多个高手同时进攻），就会出现异常（被打死），所以他选择了加锁，也就是synchronize，这样就不会有线程安全问题了。  

> 为什么SimpleDateFormat是线程不安全的？这主要是因为，它内部使用了一个全局的Calendar变量，来存储date信息。详细解释可以参考文末列出的文章。  

# 瞬间分身术
“呵呵，可笑，谁说我们是英雄好汉了？”，李莫愁说道。  

说罢，四大高手一齐使出看家本领，欲置杨过于死地。  

杨过先前在百花谷学到了周伯通的左右互搏术，结合小时候看到的《火影忍者》里的影分身术，领悟出了自己的一套瞬间分身法。  

只要有人向他进攻，他就能瞬间分身，去抵挡住对方的攻势。  

写成代码，就是把上面的SimpleDateFormat，换成天然线程安全的局部变量，这样就无需使用synchronize加锁了：  

```java
public class ThreadSafeSDFUsingLocalVariable {
    public String formatIt(Date date) {
        SimpleDateFormat sdf = new SimpleDateFormat("yyyyMMdd HHmm");
        return sdf.format(date);
    }
}
```

# 分身大法
就这样双方僵持了两个小时，杨过发现这样打下去自己体力只会越来越差，因为每次四大高手中的任意一方发起进攻，自己都要花费内功产生一个分身（每次线程一调用，都需要去new一个对象）。  

“能不能让分身不用完就消失呢？”，杨过一边应付攻势，一边思考着。  

突然，他领悟出了一套可以持久分身的绝招，一下子分身出四个杨过，分别对付四个敌人。    

写成代码，那就是用一个Map，key是线程ID，value是SimpleDateFormat，要用的时候，根据当前线程ID获取对应的SimpleDateFormat即可：  
```java
public class ThreadSafeSDFUsingMap {
    private Map<Long, SimpleDateFormat> sdfMap = new ConcurrentHashMap();

    public String formatIt(Date date) {
        Thread currentThread = Thread.currentThread();
        long threadId = currentThread.getId();

        SimpleDateFormat sdf = sdfMap.get(threadId);
        if (null == sdf) {
            sdf = new SimpleDateFormat("yyyyMMdd HHmm");
            sdfMap.put(threadId, sdf);
        }

        return sdf.format(date);
    }
}
```
当然，JDK早已经知道到我们会有这种需求，他们提供了**ThreadLocal**，**来帮助我们实现把变量和线程进行绑定的功能**，上面的代码，可以用ThreadLocal进行改写：  
```java
public class ThreadSafeSDFUsingThreadLocal {
    private static final ThreadLocal<SimpleDateFormat> formatter = new ThreadLocal();

    static {
        formatter.set(new SimpleDateFormat("yyyyMMdd HHmm"));
    }

    public String formatIt(Date date) {
        SimpleDateFormat simpleDateFormat = formatter.get();
        return simpleDateFormat.format(date);
    }
}
```

> 使用ThreadLocal的静态方法withInitial，可以让上面这段代码更简洁。  

# 简单看看ThreadLocal
ThreadLocal的实现思路，正如我们上面ThreadSafeSDFUsingMap所演示的，通过Map这样的key-value结构来将变量绑定到线程。  

**只不过这个Map不是常见的HashMap结构，这个Map也不是存储在ThreadLocal，并且Map的key也不是线程ID。**  

我们只需看一下ThreadLocal的set方法便可知道大概：  
```java
    public void set(T value) {
        Thread t = Thread.currentThread();
        ThreadLocalMap map = getMap(t);
        if (map != null)
            map.set(this, value);
        else
            createMap(t, value);
    }
    
    ThreadLocalMap getMap(Thread t) {
        return t.threadLocals;
    }
```
set方法会先获取到当前线程，然后获取当前线程对象中，一个ThreadLocalMap类型的map，然后把自己，也就是threadLocal作为key，把要存储的值作为value，塞入这个map。  

**这张图很好的描述了Thread、ThreadLocal、ThreadLocalMap三者的关系：**  
![](/img/post/2018-06-09-Thread-Local/threadlocal-internal.png) 

为什么JDK要把数据放在Thread对象？而不直接放到ThreadLocal？为什么key值不是线程ID，而是ThreadLocal？思考题。后面再讨论。  

# ThreadLocal的另一个用途
上面讲的都是ThreadLocal在实现线程安全上的用途。  

ThreadLocal还有另一个用途，那就是保存线程上下文信息。  

这一点在很多框架乃至JDK类加载中都有用到。  

比如Spring的事务管理，方法A里头调用了方法B，方法B如果失败了，需要执行connection.rollback()来回滚事务。  

那么方法B怎么知道connection是哪个？最简单的就是方法A在调用方法B时，把connection对象传进去，伪代码如下：  
```java
@Transactional
methodA(){
  methodB(connection);
}
```
显然，这样很挫，需要修改方法的定义。  

不过你现在知道ThreadLocal了，只需把connection塞入threadLocal，methodB和methodA在一个线程中执行，那么自然，methodB可以获取到和methodA相同的connection。  

具体可以参考Spring的TransactionSynchronizationManager类，至于Spring的事务管理原理，后面再讨论。  

# 总结
这篇文章带大家初步看了看ThreadLocal，了解了ThreadLocal的两大用途。  

当然ThreadLocal肯定还有更多的用途，只要我们弄懂了它的原理，就知道如何灵活使用。  

关于ThreadLocal的源码，比如：

- 它和HashMap在key-value功能的实现上有何不同
- 它为什么使用了WeakReference
- 使用了WeakReference就不会有内存溢出的风险了吗？

咱们下回继续讨论。  

# 参考

- ThreadLocal怎么用：[Baeldung java-threadlocal](http://www.baeldung.com/java-threadlocal)
- 什么时候可以使用ThreadLocal：[when-and-how-should-i-use-a-threadlocal-variable](https://stackoverflow.com/questions/817856/when-and-how-should-i-use-a-threadlocal-variable)
- SimpleDateFormat为什么线程不安全
  - [why-is-javas-simpledateformat-not-thread-safe](https://stackoverflow.com/questions/6840803/why-is-javas-simpledateformat-not-thread-safe)
  - [java-dateformat-is-not-threadsafe-what-does-this-leads-to](https://stackoverflow.com/questions/4021151/java-dateformat-is-not-threadsafe-what-does-this-leads-to)
- 《Spring揭秘》第五部分 事务管理



