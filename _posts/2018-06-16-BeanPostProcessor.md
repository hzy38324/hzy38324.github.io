---
layout:     post                    # 使用的布局（不需要改）
title:     BeanPostProcessor —— 连接Spring IOC和AOP的桥梁              # 标题 
subtitle:   #副标题
date:       2018-06-16              # 时间
author:     ZY                      # 作者
header-img: img/banner/soft-skill-1-career-and-personal.jpg    #这篇文章标题背景图片
catalog: true                       # 是否归档
tags:                               #标签
    - Java
    - Spring
---
之前都是从大Boss的视角，来介绍Spring，比如IOC、AOP。  

今天换个视角，从一个小喽啰出发，来加深对Spring的理解。  

这个小喽啰就是，**BeanPostProcessor**（下面简称**BBP**）。  

讲解思路：  

- BBP怎么用 —— 先学会怎么用，再去看原理
- BBP的触发时机 —— 在整个Spring Bean初始化流程中的位置
- BBP自己又是什么时候被创建的？
- BBP是如何连接IOC和AOP的？

# 怎么用
BeanPostProcessor，直译过来，就是“对象后处理器”，**那么这个“后”，是指什么之后呢？**  

试试便知。  

我们先写一个对象，Bean4BBP（**本文的所有代码，可到[Github](https://github.com/hzy38324/Spring-Boot-Practice)上下载**）：  
```java
@Component
public class Bean4BBP {

    private static final Logger log = LoggerFactory.getLogger(Bean4BBP.class);

    public Bean4BBP(){
        log.info("construct Bean4BBP");
    }
}
```

然后再写一个BeanPostProcessor，这时发现它是一个接口，没关系，那就写一个类实现它，CustomBeanPostProcessor：  
```java
@Component
public class CustomBeanPostProcessor implements BeanPostProcessor {

    private static final Logger log = LoggerFactory.getLogger(CustomBeanPostProcessor.class);

    public CustomBeanPostProcessor() {
        log.info("construct CustomBeanPostProcessor");
    }

    @Override
    public Object postProcessBeforeInitialization(Object bean, String beanName) throws BeansException {
        if (bean instanceof Bean4BBP) {
            log.info("process bean before initialization");
        }
        return bean;
    }

    @Override
    public Object postProcessAfterInitialization(Object bean, String beanName) throws BeansException {
        if (bean instanceof Bean4BBP) {
            log.info("process bean after initialization");
        }
        return bean;
    }
}
```
然后启动我们的Spring Boot项目（直接运行Application类），看这几条日志打印的顺序：  
```
construct CustomBeanPostProcessor
construct Bean4BBP
process bean before initialization
process bean after initialization
```
BBP对象首先被创建，然后创建Bean4BBP对象，接着再先后执行BBP对象的postProcessBeforeInitialization和postProcessAfterInitialization方法。  

结论：“对象后处理器”，指的是“**对象创建后处理器**”。  

我们可以利用它，在对象创建之后，对对象进行修改（有什么场合需要用到？思考题，文末回答。）  

那么，为什么要分postProcessBeforeInitialization和postProcessAfterInitialization呢？这里的Initialization是什么意思？  

# 触发时机
我们只需要在CustomBeanPostProcessor的postProcessBeforeInitialization和postProcessAfterInitialization方法里，打上两个断点，一切自然明了。  

断点进来，跟着调用栈这点蛛丝马迹往回走，真相大白： 
![](/img/post/2018-06-16-BeanPostProcessor/before-and-after.png)

在initializeBean方法里面，先后调用了applyBeanPostProcessorsBeforeInitialization和applyBeanPostProcessorsAfterInitialization方法，这两个方法内部，则分别去遍历系统里所有的BBP，然后逐个执行这些BBP对象的postProcessBeforeInitialization和postProcessAfterInitialization方法，去处理对象，以applyBeanPostProcessorsBeforeInitialization为例：  
![](/img/post/2018-06-16-BeanPostProcessor/abbpbi.png)  

那么夹在applyBeanPostProcessorsBeforeInitialization和applyBeanPostProcessorsAfterInitialization方法中间的invokeInitMethods方法是做什么的呢？  

其实这个方法就是Spring提供的，用于对象创建完之后，针对对象的一些初始化操作。这就好比你创建了一个英雄之后，你需要给他进行一些能力属性的初始化、服装初始化一样。  

要验证这一点，很简单，只需让Bean4BBP实现InitializingBean接口：
```java
@Component
public class Bean4BBP implements InitializingBean {

    private static final Logger log = LoggerFactory.getLogger(Bean4BBP.class);

    public Bean4BBP(){
        log.info("construct Bean4BBP");
    }

    @Override
    public void afterPropertiesSet() throws Exception {
        log.info("init Bean4BBP");
    }
}
```
然后重新启动工程，打印顺序如下：  
```
construct CustomBeanPostProcessor
construct Bean4BBP
process bean before initialization
init Bean4BBP
process bean after initialization
```


# BBP是什么时候被初始化的
从上面的代码片段，我们已经知道，在对象创建之后，需要遍历BBP列表，对对象进行处理。  

这也就意味着，**BBP对象，必须在普通对象创建之前被创建**。  

那么BBP都是在什么时候被创建的呢？  

要回答这个问题，非常简单，**我们只需要在CustomBeanPostProcessor的构造函数里打个断点**（这下看到先学会用，再了解原理的好处了吧）  

断点进来，继续利用调用栈，我们找寻到了AbstractApplicationContext的refresh()方法，这个方法里面调用了registerBeanPostProcessors方法，里头就已经把BBP列表创建好了，而普通对象的创建，是在之后的finishBeanFactoryInitialization方法里执行的：  
![](/img/post/2018-06-16-BeanPostProcessor/registBBP.png) 

网上有个图画的特别好，很好的展示了BBP在Spring对象初始化流程的位置：  
![](/img/post/2018-06-16-BeanPostProcessor/spring-bean-init.jpg)
（看到BBP在哪了吗？）  


# BBP的典型使用 - AOP
不知道大家在使用Spring AOP时，有没有发现，带有切面逻辑的对象，注入进来之后，都不是原来的对象了，比如下图：  
![](/img/post/2018-06-16-BeanPostProcessor/aop.png)

调试信息显示，aspectService是一个...$$EnhanceBySpringCGlib的对象，这其实和Spring AOP用到的动态代理有关。  

> 关于Spring AOP的原理，可以参考我之前的回答：[什么是面向切面编程AOP？ - Javdroider Hong的回答 - 知乎](https://www.zhihu.com/question/24863332/answer/350410712)

这也就意味着，**最终放进Spring容器的，必须是代理对象，而不是原先的对象**，这样别的对象在注入时，才能获得带有切面逻辑的代理对象。  

那么Spring是怎么做到这一点的呢？正是利用了这篇文章讲到的BBP。  

显然，我只需要写一个BBP，在postProcessBeforeInitialization或者postProcessAfterInitialization方法中，对对象进行判断，看他需不需要织入切面逻辑，如果需要，那我就根据这个对象，生成一个代理对象，然后返回这个代理对象，那么最终注入容器的，自然就是代理对象了。  

这个服务于Spring AOP的BBP，叫做**AnnotationAwareAspectJAutoProxyCreator**.  

利用idea的diagram功能，可以看出它和BBP的关系：  
![](/img/post/2018-06-16-BeanPostProcessor/AnnotationAwareAspectJAutoProxyCreator.png) 

具体的创建代理对象并返回的逻辑，在postProcessAfterInitialization方法中，大家自行欣赏。  

**可以说，如果没有BBP，那么Spring AOP就只能叫AOP。**  

**BBP是连接IOC和AOP的桥梁。**  

# 总结
这篇文章，主要通过对BBP的讲解，串联起之前讲到的关于Spring的知识，希望能够加深大家对Spring的理解。 

最后，回到开头提出的四个问题：

- BBP怎么用 —— 先学会怎么用，再去看原理
- BBP的触发时机 —— 在整个Spring Bean初始化流程中的位置
- BBP自己又是什么时候被创建的？
- BBP是如何连接IOC和AOP的？

也许你弄懂了，也许没懂，没关系，这篇文章还是跟以前的文章风格不太一样的，比较严肃，有些门槛。如果你暂时还吸收不了，不妨看看我之前的一些文章：  

- [怎么阅读Spring源码？ - Javdroider Hong的回答 - 知乎](https://www.zhihu.com/question/21346206/answer/359268420)
- [Spring IoC有什么好处呢？ - Javdroider Hong的回答 - 知乎](https://www.zhihu.com/question/23277575/answer/344669680)
- [用小说的形式讲解Spring（1） —— 为什么需要依赖注入](https://zhuanlan.zhihu.com/p/29426019)
- [用小说的形式讲解Spring（2） —— 注入方式哪家强](https://zhuanlan.zhihu.com/p/29629813)
- [用小说的形式讲解Spring（3） —— xml、注解和Java Config到底选哪个](https://zhuanlan.zhihu.com/p/29938139)
- [什么是面向切面编程AOP？ - Javdroider Hong的回答 - 知乎](https://www.zhihu.com/question/24863332/answer/350410712)

# 参考

- 《Spring揭秘》


