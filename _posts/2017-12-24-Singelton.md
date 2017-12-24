---
layout:     post                    # 使用的布局（不需要改）
title:      圣诞节，让我们聊聊单例模式               # 标题 
subtitle:   请叫我雷锋 #副标题
date:       2017-12-24              # 时间
author:     ZY                      # 作者
header-img: img/banner/singelton.jpg    #这篇文章标题背景图片
catalog: true                       # 是否归档
tags:                               #标签
    - Java
    - 单例
    - 设计模式

---
> 圣诞节到了，是时候对单例有一个新的认识了，不然一个就会变成两个、四个...很多个...嗯，我说的是圣诞老人...

很久之前看到一篇讲单例的文章，看完才知道看似简单的单例模式，其实有很大的考究，最近又看到了几篇类似的文章，发现单例其实很复杂。费了很大力气，理顺了思路，顿时又觉得单例模式可以不用那么复杂了。   
 
首先，我们得问自己一个问题：为什么要使用单例？
# 为什么要使用单例
单例，顾名思义，就是让一个类只存在一个实例对象，那么什么时候我们会需要单例呢？最常见的有以下两种情形：

- **无状态的工具类**：比如日志工具类，不管是在哪里使用，我们需要的只是它帮我们记录日志信息，除此之外，并不需要在它的实例对象上存储任何状态，这时候我们就只需要一个实例对象即可。
- **全局信息类**：比如我们在一个类上记录网站的访问次数，我们不希望有的访问被记录在对象A上，有的却记录在对象B上，这时候我们就让这个类成为单例。

单例起到的好处主要有两点：
- 节省内存
- 方便管理

值得注意的是，单例往往都可以通过static来实现，把一个实例方法变成静态方法，或者把一个实例变量变成静态变量，都可以起到单例的效果。在我看来，这只是面向对象和面向过程的区别。

# 一个完美的懒汉模式
了解完为什么要使用单例，接下来让我们来实现一个完美的单例模式。  
实现单例模式，你只需要注意以下几点：

1. 将**构造函数私有化**，防止别的开发人员调用而创建出多个实例
1. **在类的内部创建实例**，创建时要注意**多线程**并发访问可能导致的new出多个实例的问题
1. **提供获取唯一实例的方法**

基于以上三点，我们实现了下面这个“懒汉”单例模式（**本文的所有代码，可到[Github](https://github.com/hzy38324/Coding-Pratice/tree/master/CodePractice/src/main/java/com/sexycode/codepractice/singleton)上下载**）：
```java
public class PerfectLazyManSingleton {
    private volatile static PerfectLazyManSingleton instance = null;

    private PerfectLazyManSingleton() {
    }

    public static PerfectLazyManSingleton getInstance() {
        if(instance == null) {
            synchronized (PerfectLazyManSingleton.class) {
                if(instance == null) {
                    instance = new PerfectLazyManSingleton();
                }
            }
        }
        return instance;
    }
}
```   
这个单例在**实际使用**中已经是完美的了：

- 使用私有构造函数防止new出多个实例
- 使用Double-Check + synchronized同步锁，解决多线程并发访问可能导致的在内部调用多次new的问题
- 使用volatile关键字，解决由于指令重排而可能出现的在内部调用多次new的问题

至于很多文章里说的利用类加载器、利用反射等创建多个实例的问题，我们只需要知道有这个可能性就好，因为这些都不是正常创建对象的方式，**我们使用单例模式是为了防止其他开发人员不小心new出多个实例**，而如果开发人员都动用了反射和ClassLoader这些重型武器了，那我想这绝对不是“不小心”了。  

与其浪费心思、牺牲代码可读性、牺牲性能，去获取“绝对意义”上的单例，还不如在类上面加上行注释——“This is a single-instance class. Do not try to create another instance”，来提示那些看到私有构造函数还不知道这是个单例的新手们，不要尝试创建新的实例了！

> 如果真想实现“绝对意义”上的单例，那就使用枚举吧。

# 单例工厂
消除重复是程序员的天性，如果我们每次需要单例对象时，都按照上面的模式把类设计成单例，那显然是不可接受的。这时候我们就可以设计一个单例工厂，这个单例工厂就像民政局一样，我给他一个身份证号码，他给我返回唯一一个对应的人。
```java
public class SingletonRegistry {
    public static SingletonRegistry REGISTRY = new SingletonRegistry();
    private static HashMap map = new HashMap();
    private static Logger logger = LoggerFactory.getLogger(SingletonRegistry.class);

    private SingletonRegistry() {
    }

    public static synchronized Object getInstance(String classname) {
        Object singleton = map.get(classname);
        if (singleton != null) {
            return singleton;
        }
        try {
            singleton = Class.forName(classname).newInstance();
            logger.info("created singleton: " + singleton);
        } catch (ClassNotFoundException cnf) {
            logger.warn("Couldn't find class " + classname);
        } catch (InstantiationException ie) {
            logger.warn("Couldn't instantiate an object of type " +
                    classname);
        } catch (IllegalAccessException ia) {
            logger.warn("Couldn't access class " + classname);
        }
        map.put(classname, singleton);
        return singleton;
    }
}
```
关于这个SingletonRegistry，有以下几点需要注意的：
- 这个SingletonRegistry本身也是单例，使用的是“饿汉”版的单例模式
- 由于getInstance方法要返回的实例不再是类的成员变量，因此不再能够使用volatile来获得线程之间的可见性，因此要将整个getInstance方法加上同步锁

这个单例工厂的用法非常简单：
```java
public class Singleton {
   private Singleton() {
   }
   public static Singleton getInstance() {
      return (Singleton)SingletonRegistry.REGISTRY.getInstance(classname);
   }
}
```

# 饿汉版单例模式
饿汉版的单例模式非常简单，上面的SingletonRegistry其实就是“饿汉”版的单例模式，一个完美的饿汉单例模式代码如下：
```java
public class SingletonHungryMan {
    public final static SingletonHungryMan INSTANCE = new SingletonHungryMan();
    private SingletonHungryMan() {
        // Exists only to defeat instantiation.
    }
    public void sayHello() {
        System.out.println("hello");
    }

}
```
为什么这里就不用担心多线程并发导致的new了多个示例呢？  
关键在于这是static静态变量，而静态变量归属于类，会在类加载的过程中被初始化，而Java类加载的过程默认是线程安全的，除非自定义的类加载器覆写了loadClass函数。  
下面就是ClassLoader的loadClass方法，这个方法很好的展示了什么是双亲委派模型：
```java
protected Class<?> loadClass(String name, boolean resolve)
        throws ClassNotFoundException
{
    synchronized (getClassLoadingLock(name)) {
        // First, check if the class has already been loaded
        Class<?> c = findLoadedClass(name);
        if (c == null) {
            long t0 = System.nanoTime();
            try {
                if (parent != null) {
                    c = parent.loadClass(name, false);
                } else {
                    c = findBootstrapClassOrNull(name);
                }
            } catch (ClassNotFoundException e) {
                // ClassNotFoundException thrown if class not found
                // from the non-null parent class loader
            }

            if (c == null) {
                // If still not found, then invoke findClass in order
                // to find the class.
                long t1 = System.nanoTime();
                c = findClass(name);

                // this is the defining class loader; record the stats
                sun.misc.PerfCounter.getParentDelegationTime().addTime(t1 - t0);
                sun.misc.PerfCounter.getFindClassTime().addElapsedTimeFrom(t1);
                sun.misc.PerfCounter.getFindClasses().increment();
            }
        }
        if (resolve) {
            resolveClass(c);
        }
        return c;
    }
}
```
当然了，饿汉版的单例模式如果受到非常规的攻击，还是会生出二胎出来的，比如利用反射把私有的构造器设为Accessible，抑或是使用自定义的类加载器进行加载，产生新的实例。  
> 对于任意一个类，都需要由加载它的类加载器和这个类本身一同确立其在Java虚拟机中的唯一性 —— 《深入理解Java虚拟机》 第7章 虚拟机类加载机制

我分别使用了反射和类加载器，对上面的SingletonHungryMan进行了攻击，代码如下：
```java
public class SingletonHungryManTest {
    private SingletonHungryMan sone = null;
    private Object stwo = null;
    private Object sthree = null;
    private static Logger logger = LoggerFactory.getLogger(SingletonHungryManTest.class);

    @Before
    public void setUp() throws ClassNotFoundException, IllegalAccessException, InstantiationException, NoSuchMethodException, InvocationTargetException, NoSuchFieldException {
        sone = SingletonHungryMan.INSTANCE;
        stwo = createAnotherInstanceUsingRelection();
        sthree = createAnotherInstanceUsingAnotherClassLoader();
    }

    private Object createAnotherInstanceUsingRelection() throws ClassNotFoundException, NoSuchMethodException, InstantiationException, IllegalAccessException, InvocationTargetException {
        Class<SingletonHungryMan> singletonHungryManClass = SingletonHungryMan.class;
        Constructor<?> declaredConstructor = singletonHungryManClass.getDeclaredConstructor();
        declaredConstructor.setAccessible(true);
        return declaredConstructor.newInstance();
    }

    private Object createAnotherInstanceUsingAnotherClassLoader() throws ClassNotFoundException, NoSuchMethodException, InstantiationException, IllegalAccessException, InvocationTargetException, NoSuchFieldException {
        // use custom class loader to load class
        ClassLoader myLoader = getMyLoader();
        Class<?> myClass = myLoader.loadClass("com.sexycode.codepractice.singleton.SingletonHungryMan");
        // use reflection to get field
        Field field = myClass.getField("INSTANCE");
        // return the field's value
        return field.get(null);
    }

    private ClassLoader getMyLoader() throws ClassNotFoundException {
        return new ClassLoader() {
            @Override
            public Class<?> loadClass(String name) throws ClassNotFoundException {
                try {
                    String fileName = name.substring(name.lastIndexOf(".") + 1) + ".class";
                    InputStream is = getClass().getResourceAsStream(fileName);
                    if (is == null) {
                        return super.loadClass(name);
                    }
                    byte[] b = new byte[is.available()];
                    is.read(b);
                    return defineClass(name, b, 0, b.length);
                } catch (IOException e) {
                    throw new ClassNotFoundException(name);
                }
            }
        };
    }

    @Test
    public void testUnique() throws NoSuchMethodException, InvocationTargetException, IllegalAccessException {
        logger.info("checking singletons for equality");
        sone.sayHello();
        invokeMethod(stwo, "sayHello");
        invokeMethod(sthree, "sayHello");
        Assert.assertNotEquals(true, sone == stwo);
        Assert.assertNotEquals(true, sone == sthree);
    }

    private void invokeMethod(Object obj, String method) throws NoSuchMethodException, IllegalAccessException, InvocationTargetException {
        Method sayHello = obj.getClass().getMethod(method);
        sayHello.invoke(obj);
    }
}
```
# 可序列化对象的单例
可序列化对象，在进行序列化之后，可以进行多次的反序列化，这时候如果要维持单例，就要实现readResolve方法：
```java
public class SingletonSerializable implements java.io.Serializable {
    public static SingletonSerializable INSTANCE = new SingletonSerializable();

    private SingletonSerializable() {
        // Exists only to thwart instantiation.
    }

    private Object readResolve() {
        return INSTANCE;
    }

}

```
# 小结
实现单例模式，其实没有那么复杂，我们要考虑的只是如何防止其他开发人员在**常规操作**下创建多个实例，至于那些非常规的手段，并不值得牺牲代码可读性和性能去进行防御。  

最最重要的是，圣诞节来了，你知道怎么实现单例、防止多例了么？

# 参考

- [Simply Singleton](https://www.javaworld.com/article/2073352/core-java/simply-singleton.html)
- [when-to-use-the-singleton](https://stackoverflow.com/questions/228164/on-design-patterns-when-to-use-the-singleton)
- [when-are-static-variables-are-initialized](https://stackoverflow.com/questions/8704423/when-are-static-variables-are-initialized)
- 《深入理解Java虚拟机》