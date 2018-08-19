---
layout:     post                    # 使用的布局（不需要改）
title:    那些年，我们一起追的Spring              # 标题 
subtitle:   #副标题
date:       2018-08-11              # 时间
author:     ZY                      # 作者
header-img: img/banner/league-of-legends-hd-wallpapers-33299-3436910.png    #这篇文章标题背景图片
catalog: true                       # 是否归档
tags:                               #标签
    - Spring
---
学无止境，但仍需及时总结。  

自去年开始写作以来，写了一些关于Spring的文章，今天将它们汇总起来，一方面方便大家阅读，另一方面，也是一次小的复盘总结。  

# IOC

首先是Spring的IOC，也就是控制反转。  

**控制反转，简单说，就是你不用再自己去new对象啦，Spring已经帮你new好了，而且还配送上门。**  

有同学说，这不就是工厂模式吗？  

的确**，IOC用到了工厂模式，但IOC绝不仅仅是工厂模式。**  

作为一个框架，Spring必须考虑，如何最大程度的简化用户的工作：  

- 如何定义一个Bean
- 如何将一个Bean注入另一个Bean
- 如何在Bean的生命周期里，提供各种“钩子”入口，满足用户的定制需求
- ...

下面是之前写过的关于IOC的文章：  

- [用小说的形式讲解Spring（1） —— 为什么需要依赖注入](https://zhuanlan.zhihu.com/p/29426019)：首先，我们要问自己，为什么要使用Spring，或者说，为什么要使用IOC？
- [Spring IoC有什么好处呢？ - Javdroider Hong的回答 - 知乎](https://www.zhihu.com/question/23277575/answer/344669680)：如果上面这篇文章还不能说服你使用IOC，那么看看这份回答吧 (～￣▽￣)～ 
- [用小说的形式讲解Spring（2） —— 注入方式哪家强](https://zhuanlan.zhihu.com/p/29629813)：如何往一个Bean注入另一个Bean？这些方式要怎么选？
- [用小说的形式讲解Spring（3） —— xml、注解和Java Config到底选哪个](https://zhuanlan.zhihu.com/p/29938139)：如何配置一个Bean？这些方式又孰优孰劣？
- [怎么阅读Spring源码？ - Javdroider Hong的回答 - 知乎](https://www.zhihu.com/question/21346206/answer/359268420)：上面三篇文章都是讲IOC使用层面的，是时候了解一下原理了，一方面让自己遇到Bug时心里不慌，另一方面也是学习一下别人写代码的艺术 ٩(๑>◡<๑)۶ 

# 桥梁 —— BeanPostProcessor  
很多书在讲Spring的时候，往往讲完IOC，就讲AOP了，似乎AOP和IOC是两个互不相干的功能。  

实际上，虽然AOP和IOC确实是两个不同的领域，但是既然是Spring AOP，那么AOP创建的代理对象，也必须交给Spring容器去管理，所以也就有了这篇文章：[BeanPostProcessor —— 连接Spring IOC和AOP的桥梁](https://zhuanlan.zhihu.com/p/38208324)

这篇文章里，你会看到，Spring在Bean初始化的过程中，留下一些“钩子”入口的重要性，同时可以了解到，AOP是如何利用这个钩子，把代理对象放到Springe容器的。  

# Spring事务和AOP  
是的，我并没有写直接以AOP为主题的文章，一方面是懒，另一方面也是因为直接讲AOP，会比较枯燥。  

**我选择的是去讲Spring源码里面，一个利用了IOC和AOP来搭建的模块——Spring Transaction**  

通过对Spring事务的讲解，我们不仅仅学到了如何使用Spring事务，还加深了对IOC的理解，并且看到了AOP的实际应用，一举三得：

- [什么是面向切面编程AOP？ - Javdroider Hong的回答 - 知乎](https://www.zhihu.com/question/24863332/answer/350410712) ：虽然没有写过AOP的文章，但是还是回答过一个问题的，简单了解下什么是AOP
- [玩转Spring —— 消失的事务](https://zhuanlan.zhihu.com/p/38208248) ：通过一段简单的代码片段，初步了解了@Transactional注解的原理，也了解了AOP中代理对象的原理
- [Spring的统一事务模型](https://zhuanlan.zhihu.com/p/38772486)：研究了Spring编程式事务的实现原理，还顺便学习了两种模式（模板模式、策略模式）和ThreadLocal
- Spring的声明式事务模型：深入研究了@Transactional注解的原理，同时往更深层次看了AOP的源码

# 尾声

当然，Spring还有很多高大上的功能，然而，这些个高大上的功能，都是建立在IOC和AOP的基础上的，诸如上面讲到过的Transaction、还有DAO support、Spring MVC、对JavaEE应用的集成（JMS/Cache/Email）等等。  

所以你会发现，不管是Spring官方文档，或者是Spring的书籍，前面两章，无一例外，都是IOC和AOP。  

有了IOC和AOP的基础，再去学习其他模块，就会轻松很多，更容易看出其他模块的精髓。  

最后再推荐一些学习资料。  

其实学习资料这些东西，对于一项成熟的、有强大生态的技术来说，无非就那几样：   

1、几本好书  
对于Spring，推荐这两本书：《Spring实战》 + 《Spring揭秘》  

就像之前在[初学Spring有没有适合的书？ - Javdroider Hong的回答 - 知乎](https://www.zhihu.com/question/22021742/answer/376453942)说的：  

> 第一本告诉你怎么用Spring
>
> 第二本给你简单展示如何用的同时，还告诉你Spring是怎么实现的
>
> 两者一起，让你知其然并知其所以然，绝配。

2、官方文档  
书籍是作者学习吸收后的成果，只能算是二手学习资料。  

官方文档才是一手的学习资料，最靠近知识的源头。由于前面你已经看了书籍，可以说常用的80%的功能你都了解了，剩下的20%，也许就得从官方文档里去挖掘了。  

当然，英文好的同学，上来直接看官方文档也是可以的 (〃'▽'〃)

3、搜索引擎  
推荐两个搜索引擎，1、谷歌   2、知乎  

学习的乐趣在于不断提问、不断发现知识盲点，然后再不断的去搜索和解决问题。  

以上，希望对你学习Spring，能有所帮助。  








