---
layout:     post                    # 使用的布局（不需要改）
title:     玩转Spring —— 消失的事务              # 标题 
subtitle:   #副标题
date:       2018-06-18              # 时间
author:     ZY                      # 作者
header-img: img/banner/soft-skill-2-career-choice.jpg    #这篇文章标题背景图片
catalog: true                       # 是否归档
tags:                               #标签
    - Java
    - Spring
---
# 消失的事务
端午节前，组内在讨论一个问题：  

**一个没有加@Transactional注解的方法，去调用一个加了@Transactional的方法，会不会产生事务？**  

文字苍白，还是用代码说话。  

先写一个@Transactional的方法（**本文的所有代码，可到[Github](https://github.com/hzy38324/Spring-Boot-Practice)上下载**）：
```java
@Transactional
public void deleteAllAndAddOneTransactional(Customer customer) {
  customerRepository.deleteAll();
  if ("Yang".equals(customer.getFirstName())) {
    throw new RuntimeException();
  }
  customerRepository.save(customer);
}
```
方法内先去执行deleteAll()，删除表中全部数据；然后执行save()保存数据。  

这两个方法中间，会判断传进来的firstName是不是等于“Yang”，是，则抛异常，用于模拟两个数据库操作之间可能发生的异常场景。  

如果没有加@Transactional注解，那么这两个操作就不在一个事务里面，不具有原子性。如果deleteAll之后抛异常，那么就会导致只删除不新增。  

而加了@Transactional之后，这两个动作在一个事务里头，具有原子性，要么全部成功，要么全部失败。如果deleteAll之后抛异常，则事务回滚，恢复原先被删除的数据。  

测试一下，启动Spring Boot工程，首先调用findAll接口，看看数据库中都有哪些数据：  
![](/img/post/2018-06-18-The-Missed-Transaction/findAll.png)

接着调用deleteAndSave接口，故意传入firstName="Yang"，果然返回失败：  
![](/img/post/2018-06-18-The-Missed-Transaction/deleteV1.png)

然后，在回过头去调用findAll接口，看看数据是不是还在：
![](/img/post/2018-06-18-The-Missed-Transaction/findAll.png)

数据都在，说明产生事务了。  

上面都没啥，都跟符合我们的直觉。  

问题来了，如果我的接口是去调用一个没有加@Transactional的方法，然后这个方法再去调用加了@Transactional的方法呢？  
```java
    public void deleteAllAndAddOne(Customer customer) {
        System.out.println("go into deleteAllAndAddOne");
        deleteAllAndAddOneTransactional(customer);
    }


    @Transactional
    public void deleteAllAndAddOneTransactional(Customer customer) {
        customerRepository.deleteAll();
        if ("Yang".equals(customer.getFirstName())) {
            throw new RuntimeException();
        }
        customerRepository.save(customer);
    }
```

直觉告诉我，会的。  

重新编译，启动，调用新的接口，继续故意让它抛异常：  
![](/img/post/2018-06-18-The-Missed-Transaction/deleteV2.png)

然后再去findAll，看看数据还在不在：  
![](/img/post/2018-06-18-The-Missed-Transaction/findAllEmpty.png)

**WTF! 空空如也！数据都没了！**  

**看来我又一次被直觉欺骗了。**  

还是得老老实实看代码，弄懂原理。  

看了一晚上代码，恍然大悟。咱们先画个图解释一下，再来看看代码。    

# 图解@Transactional
首先，我们得先弄懂@Transactional的原理。  

为什么第一种情况，也就是直接调用@Transactional方法，会产生事务？  

**其实Spring的@Transactional，跟Spring AOP一样，都是利用了动态代理。**  

我们写了一个类，里面写了一个加了@Transactional注解的方法，这原本平淡无奇，什么用也没有，就像这样：  
![](/img/post/2018-06-18-The-Missed-Transaction/target1.png)

关键在于，Spring在检查到@Transactional注解之后，给这个对象生成了一个代理对象proxy：  
![](/img/post/2018-06-18-The-Missed-Transaction/proxy1.png)

代理对象的methodB，会先开启事务（beginTransaction），然后再去执行原先对象target的methodB，如果抛异常，则回滚（rollBack），如果一切顺利，则提交（commit）。  

而最后注入Spring容器的，也正是这个带有事务逻辑的代理对象。所以我们调用methodB时会产生事务。  

现在，我们写了一个新方法，methodA，里头去调用methodB：  
![](/img/post/2018-06-18-The-Missed-Transaction/target2.png)

从上面的分析，可以知道，我们最终拿到的，是代理对象。  

那么代理对象的methodA是长什么样子的呢？长这样：  
![](/img/post/2018-06-18-The-Missed-Transaction/proxy2.png)

由于methodA没有加@Transactional注解，所以代理对象里面，直接就是target.methodA()，直接调用了原来对象的methodA。  

这下就很清晰了，代理对象的methodA，去调用原来对象的methodA，原来对象的methodA，再去调用原来对象的methodB，而原来对象的methodB，是不具有事务的。事务只存在于代理对象的methodB. 所以整个方法也就没有事务了。  

# 看看代码
最后再来看看代码。  

只需要在deleteAllAndAddOneTransactional方法内，打一个断点，一切了然。  

分别调用两个接口，比较调用堆栈：  
![](/img/post/2018-06-18-The-Missed-Transaction/stack.png)

明显可以看出，直接调用@Transactional方法，堆栈更长，而且会经过一个叫TransactionInterceptor的拦截器。  

跟着堆栈往上走，会发现关键就在于这个if-else的逻辑，CglibAopProxy：  
![](/img/post/2018-06-18-The-Missed-Transaction/chain.png)

CglibAopProxy会去检查要调用的方法，有没有AOP调用链：  

- 没有，则走if里面的逻辑，直接调用target对象的方法，也就是上面间接调用@Transactional方法的情形；
- 有，则走else逻辑，也就是直接调用@Transactional方法的情形。  

当然，如果deleteAllAndAddOne方法被别的切面拦截，那么调用链chain也不会为空，也会走if逻辑，这时候是否会有事务呢？思考题。  

上面贴的代码是Cglib代理的情形，JDK Proxy的，大家自行欣赏。  

# 总结
这篇文章主要讲了一个有点违反直觉的现象。  

通过这样一个例子，希望能够加深大家对Spring动态代理的理解。  

现在想想，面试时，为什么那么喜欢问源码？  

其实道理很简单，你用了这项技术、这个框架，却不知道它是怎么实现的，那就有可能造成错误的使用。  

# 参考

- 《Spring揭秘》


