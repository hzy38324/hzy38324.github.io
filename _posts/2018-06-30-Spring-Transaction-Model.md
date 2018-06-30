---
layout:     post                    # 使用的布局（不需要改）
title:     Spring的统一事务模型              # 标题 
subtitle:   #副标题
date:       2018-06-30              # 时间
author:     ZY                      # 作者
header-img: img/banner/spring-novel-3-annotaion-based-configuration-and-java-based-configuration.jpg    #这篇文章标题背景图片
catalog: true                       # 是否归档
tags:                               #标签
    - Spring
    - Java
---
组内每周都会有技术分享，轮着来，人人有份。  

刚来一个月不到，就轮到我了。  

看了一个星期的Spring事务，于周五分享之，反响还不错。  

遂将ppt改成文稿，和诸君分享。  

难度一般，老少咸宜。  

# Spring事务的知识体系

进入主题之前，先来了解一下Spring事务都有哪些内容：  
![](/img/post/2018-06-30-Spring-Transaction-Model/spring-tx-overview.png)

Spring事务包含对分布式事务和单机事务的支持，我们用的比较多的是单机事务，也就是只操作一个数据库的事务。  

单机事务，按照用法分，又可以分为编程式事务模型（TransactionTemplate）和声明式事务模型（@Transactional注解），后者可以理解为 aop + 编程式事务模型。  

编程式事务模型里面涉及到很多知识点，比如统一事务模型、事务传播级别、事务隔离级别等。  

我们今天要讲的是其中一点，统一事务模型。  

希望这次的分享能够让大家，对Spring事务有一个整体性的认识。  

# 不仅仅是Template

Spring的统一事务模型，解决的一个核心问题，就是不管你用的是什么数据访问方式，Hibernate、MyBatis抑或是JDBC，你的Service层的代码都是一样的，不需要做任何变动。  

使用@Transactional注解的，相信大家都用过，而且由于注解的实现比较隐晦，不利于我们理解原理，这里就不演示。  

下面介绍编程式事务模型，TransactionTemplate：  
![](/img/post/2018-06-30-Spring-Transaction-Model/tx-template-code.png)

不管后面你的Dao实现如何变化，上面这一段Service代码都无需修改，而且依旧可以保持事务的逻辑。  

Spring是怎么做到的呢？  

有人说，是模板模式。  

点开TransactionTemplate，的确是封装了事务操作的“套路”：
![](/img/post/2018-06-30-Spring-Transaction-Model/tx-template-inner.png)

但是细看就会发现，这和我们传统的template模式还有点不同。  

传统的template，一般会有一个抽象类，抽象类里封装了一系列有规律的套路，然后有些套路是抽象的，需要你自己去实现：  
![](/img/post/2018-06-30-Spring-Transaction-Model/template-d-p.png)

而TransactionTemplate，它已经是一个具体的类，无需实现任何方法，拿来即用。  

但仔细看，就会发现里面有一个叫transactionManager的家伙，出镜率特别高，它帮TransactionTemplate做了很多事情。  

点开一个，这家伙是个叫PlatformTransactionManager的接口：
![](/img/post/2018-06-30-Spring-Transaction-Model/plat-f-tx-ma.png)

恍然大悟，你只需给TransactionTemplate传一个PlatformTransactionManager的具体实现，也就是告诉TransactionTemplate，事务创建、提交、回滚的策略，它就可以按照自己的那套流程，完成事务的操作。  

这其实是策略模式，这其实是模板+策略的双剑合璧。  

针对不同的厂商，只需要提供不同的PlatformTransactionManager实现即可。  

比如对于MyBatis，就用DataSourceTxManager，对于Hibernate，就用HibernateTxManager：
![](/img/post/2018-06-30-Spring-Transaction-Model/diff-impl.png)

不同厂商在实现的时候，按照自己对应的事务操作方式，进行实现即可。  

比如DataSourceTxManager，创建事务的时候，new了一个自己的事务对象，最后返回一个Object类型，在commit的时候，再把这个Object，强转成自己的事务对象：  
![](/img/post/2018-06-30-Spring-Transaction-Model/d-s-tx-m.png)

HibernateTxManager也是如此：  
![](/img/post/2018-06-30-Spring-Transaction-Model/h-tx-m.png)

我们在使用的时候，只需要通过Spring IOC，告诉Spring，要注入哪个TransactionManager，要使用哪种策略即可：  
![](/img/post/2018-06-30-Spring-Transaction-Model/spring-config)

# connection-pass

了解完Spring是如何实现统一的事务模型，不知道你是否也有疑问，既然是事务，那就要保证事务里的所有dao操作，都要使用同一个数据库连接进行操作，但是我们在写代码的时候，并不需要给dao传入connection对象：  
![](/img/post/2018-06-30-Spring-Transaction-Model/connection.png)

Spring又是怎么做到的？  

答案是ThreadLocal。  

通过ThreadLocal，在同一个线程中共享connection。  

这很好理解，关键是，这是一个什么样的ThreadLocal？填空题。  
![](/img/post/2018-06-30-Spring-Transaction-Model/thread-local.png) 

也许你和我一开始想的一样，认为这里面放到就是connection对象。  

直接放connection对象会有一个问题，那就是当你事务里面涉及到对多个数据库进行操作时，后面的操作取到的都是第一个数据库操作放进去的connection：  
![](/img/post/2018-06-30-Spring-Transaction-Model/db-1-2.png)

如上图，假设deleteAll操作的是db1，那么它创建了针对db1的connection，然后放进ThreadLocal，然后save，本来是想操作db2的，结果它从threadLocal里拿到的，却是刚刚deleteAll时，放进去的操作db1的connection，卒。  

实际上，Spring在ThreadLocal里头，放的是一个Map。key是dataSource，value才是connection.  
![](/img/post/2018-06-30-Spring-Transaction-Model/tx-syn-m.png)

# 如何新开一个事务

Spring是支持在事务里面新开一个事务的，最简单的方式就是使用声明式事务模型：  
![](/img/post/2018-06-30-Spring-Transaction-Model/new-yx.png)

然而，按照之前的理论，如果每次都是从ThreadLocal里去获取connection，那么永远拿到的都是旧的事务，不会创建新事务。  

Spring又是如何实现新开事务的呢？  

很简单，链表。  

一开始，旧事务绑定在当前线程：  
![](/img/post/2018-06-30-Spring-Transaction-Model/t-b-1.png)

当需要新开事务时，先将原来的事务解绑：
![](/img/post/2018-06-30-Spring-Transaction-Model/t-b-2.png)

然后new一个新的事务：
![](/img/post/2018-06-30-Spring-Transaction-Model/t-b-3.png)

接着将新的事务指向旧事务：
![](/img/post/2018-06-30-Spring-Transaction-Model/t-b-4.png)

最后将新事务绑定到当前线程：
![](/img/post/2018-06-30-Spring-Transaction-Model/t-b-5.png)

之所以需要将新事务指向旧事务，形成一个事务链，是因为新事务在提交或者回滚之后，还需要恢复旧事务：
![](/img/post/2018-06-30-Spring-Transaction-Model/t-b-6.png)
![](/img/post/2018-06-30-Spring-Transaction-Model/t-b-7.png)

这一块逻辑对应的代码：  
![](/img/post/2018-06-30-Spring-Transaction-Model/bind-code.png)
![](/img/post/2018-06-30-Spring-Transaction-Model/link.png)

# 总结

这个星期看的Spring事务，不仅仅是解答了我对Spring事务的一些疑惑，还学到了一些挺巧妙的编程招式，比如模板模式竟然可以和策略模式一起使用。  

总结一下：  

- Spring如何实现统一的事务模型：Template + Strategy
- 如何在方法间共享Connection：ThreadLocal
- 如何挂起和恢复线程：链表
- 提到的类：
  - TransactionTemplate 事务模板 
  - PlatformTransactionManager 事务操作策略接口
  - AbstractPlatformTransactionManager 事务操作策略抽象类
    - DataSourceTxManager 具体策略，适用于JDBC/MyBatis  
    - HibernateTxManager 具体策略，适用于Hibernate
  - TxSynManager 事务同步管理器，在线程中同步数据库连接等信息
  - DataSourceUtils 数据库操作Utils 

# 参考

- 《Spring揭秘》
