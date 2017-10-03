---
layout:     post                    # 使用的布局（不需要改）
title:      用小说的形式讲解Spring（3） —— Xml、注解和Java Config到底选哪个               # 标题 
subtitle:   有时候选择多了，也会带来幸福的烦恼 #副标题
date:       2017-10-03              # 时间
author:     ZY                      # 作者
header-img: img/banner/spring-novel-3-annotaion-based-configuration-and-java-based-configuration.jpg    #这篇文章标题背景图片
catalog: true                       # 是否归档
tags:                               #标签
    - Spring
    - Java
    - Java EE
---
本集概要：  

 - 为什么说xml配置是类型不安全的配置方式？
 - 如何使用注解进行配置？
 - 注解配置是万能的吗？
 - 如何使用Java Config进行配置？
 - Xml、注解、Java Config，到底该如何选择？

 ----------
 
大雄一脸懵逼，心想，“我就改了一处地方，怎么就把服务器整挂了呢”，大雄仔细看了一下自己改的代码：
```xml
<bean id="serverLogger" class="com.springnovel.perfectlogger.CosoleLogger"/>
```
“啊！！原来是CosoleLogger拼错了...”

# 类型不安全的xml
到了公司，大雄跟哆啦讲了自己干的这件蠢事。  
“小伙子，早上没睡醒吧，哈哈哈”
“额，你还笑得出来”  
“嘿嘿嘿，其实吧，我有办法让你在没睡醒的时候也不会犯这种错误”  
“啥办法，该不会是让我喝咖啡吧...”  
“喝咖啡也没我这个办法管用，你小子之前学Spring的时候，不会只知道用xml这种**类型不安全**的方式来配置吧？”  
“噢，好像还有其他配置方式...注解？还有Java Config...啊！我明白你的意思了，使用注解和Java Config，这样在我拼写错的时候，由于找不到这类，编译都不会通过，我也就知道我拼写错了！”  
“就是罗，而且这只是其他配置方式优于xml配置的一点，你用过之后就会发现他们有更多的优点了”  
“好，我这就试试用注解方式改造一下我们的代码！”  

# 注解
大雄决定先把原来PaymentAction中，使用xml配置的OrderDao改为注解配置。  
首先，大雄给OrderDao加上@Component注解,表明这个类是一个组件类，告诉Spring要为这个class创建bean，并注入给IOrderDao：
```java
@Component
public class OrderDao implements IOrderDao{
    ......
}
```
接着需要告诉Spring哪些包是需要进行扫描并自动装配，因此，大雄新建了一个配置类，然后使用@ComponentScan指明哪些包需要扫描：
```java
@Configuration
@ComponentScan(basePackageClasses={IOrderDao.class,PaymentActionMixed.class})
public class PaymentConfig {

}
```
这里的basePackageClasses是类型安全的，它的值是一个class数组，表明Spring将会扫描这些class所在的包。  
最后需要使用@Autowired，把扫描到的OrderDao注入到PaymentAction中：
```java
@Component
public class PaymentActionMixed {
	
    ......
	private IOrderDao orderDao;
	
	......
	
	@Autowired
	public PaymentActionMixed(IOrderDao orderDao) {
		super();
		this.orderDao = orderDao;
	}

    ......
	
	public void addOrder(String orderType) {
		orderDao.addOrder(orderType);
	}

}
```

测试一下：
```java
@RunWith(SpringJUnit4ClassRunner.class)
@ContextConfiguration(classes=PaymentConfig.class)
public class PaymentMixedTest {
	
	@Autowired
	private PaymentActionMixed paymentActionMixed;
	
	@Test
	public void testPaymentMixedAddOrder() {
		paymentActionMixed.addOrder("create_sub");
	}
}
```
这里使用了SpringJUnit4ClassRunner以便于在测试开始的时候自动创建Spring的上下文，使用@ContextConfiguration告诉Spring要加载什么配置。  
Output:
```
real add order, order type is create_sub
```
“仅仅用了几个注解，就成功地将OrderDao注入到PaymentAction里面了！比起xml啰里啰嗦的配置，简直是太方便了！”大雄像发现了宝藏一样。

# 注解也不是万能的
“注解好方便啊，而且注解的同时还能起到注释的作用，看到@Component注解就知道这个对象是组件，看到@Autowire就知道这里会进行注入，哆啦，我们项目以后都用注解进行配置吧！”   
“哈哈，你小子对注解的理解还挺深入的嘛。你说都用注解进行配置？那你试试把早上害惨你的ConsoleLogger改成注解注入试试？”  
“这还不简单哦，不就加几个注解的事儿吗......”大雄说完，准备找地方加上@Component注解。  
“啊，不对，这个类又不是我们写的，这是我们引用的第三方的jar包......我们改不了它的源码啊......”    
“哈哈哈，你才发现啊？你刚刚不是还是以后都用注解吗？”  
“啊，那看来这里还是得有类型不安全的、啰里啰嗦的xml进行配置了......”  
“是咩？小伙子记性不行啊！”  
“啊对，还有一种配置方式！”  

# Java Config
“啊啊，我有种预感，这种配置方式是自由度最高的，因为他叫Java Config，顾名思义，就是通过Java代码的方式进行注入，终于可以自己写代码进行注入了，配置和注解都感觉好没劲！”大雄兴奋的说道，摩拳擦掌。  
“哈哈，看来你骨子里面还是特别热爱编码的嘛”   
“那是”  
唠完嗑，大雄开始着手使用Java   Config的配置方式来注入第三方jar包里的ConsoleLogger。  
使用Java Config，只需要创建一个配置类，在配置类中编写方法，返回要注入的对象，并给方法加上@Bean注解，告诉Spring为返回的对象创建实例：
```java
@Configuration
public class PaymentJavaConfig {

    @Bean
    public ILogger getIlogger() {
        return new ConsoleLogger();
    }

    @Bean
    public PaymentActionMixed getPaymentActionMixed(ILogger logger)     {
        return new PaymentActionMixed(logger);
    }
}
```
接着就可以进行测试了：
```java
@RunWith(SpringJUnit4ClassRunner.class)
@ContextConfiguration(classes = PaymentJavaConfig.class)
public class PaymentJavaConfigTest {

    @Autowired
    private PaymentActionMixed paymentActionMixed;

    @Test
    public void testPaymentMixedAddOrder() {
        paymentActionMixed.pay(new BigDecimal(100));
    }
}
```
Output:  
```
ConsoleLogger: pay begin, payValue is 100
ConsoleLogger: pay end
```
“Java Config也是非常方便，虽然要写的代码比注解多了不少，但是一方面,相比于注解配置，Java Config对代码没有侵入，可以注入代码不是自己维护的类；另一方面，Java Config是使用Java代码进行注入的，相比于xml来说，又更为自由”  
“嗯嗯，总结的不错。”哆啦拍拍大雄的肩膀，继续说道，“不知不觉你已经在项目开发的过程中，把Spring的两大特性其中的一个，也就是控制反转的使用方式给用了个遍了，对这三种方式的优劣，相信你也有一个大致的认识，晚上回去总结一下，当然，你也可以上网找找资料，看看别人是怎么在这三种配置方式中进行取舍的......”哆啦滔滔不绝，开启了导师模式.......  
“哎呀呀，明白了，我晚上跟静香......哦不，我晚上吃完饭回去就写写总结......”  

# 大雄的笔记
今天大雄又掌握了Spring依赖注入的另外两种配置方式——注解和Java Config，是时候把这三种方式做个总结了：  

| 特点\配置方式 | XML | 注解 | Java Config |
| - | - | - | - |
| 类型是否安全 | N | Y | Y |
| 查找实现类是否方便 | N，需要查找所有xml | Y，只需看实现类那个有加注解 | N，需要查找所有Java Config |
| 可读性 | 差，很多xml标签，不易阅读 | 很好，注解的同时起到注释的作用 | 较好，对于Java程序员来说，阅读Java代码比阅读xml方便 |
| 配置简洁性 | 很啰嗦 | 十分简洁 | 有点啰嗦 |
| 修改配置是否需要重新编译 | N，直接替换xml文件即可 | Y，需重新编译出class文件，然后进行替换 | Y，同注解配置 |
| 是否会侵入代码 | N | Y | N |
| 自由度 | 低，可以使用SPEL语法，但是SPEL语法能实现的功能有限 | 低，只能基于注解的属性进行配置 | 高，可以自由使用Java语法，调用各种函数来注入对象 |
| 注入代码不是自己维护的类 | Y | N | Y |

这么总结下来一看，这三种配置方式，真可谓是各有千秋，不过在选择上还是有一定的规律的：

- xml配置相对于其他两种方式来说，几乎没什么优势，唯一的优势就是修改后不需要重新编译，因此对于一些经常需要修改的配置，可以采用xml。还有就是由于xml是Spring一开始就提供的配置方式，因此很多旧代码还是采用xml，所以在维护旧代码时会免不了用到xml。
- 注解用起来非常地简洁，代码量十分少，因此是项目的第一选择。只有当需要注入代码不是自己维护的第三方jar包中的类时，或者需要更为灵活地注入，比如说需要调用某个接口，查询数据，然后把这个数据赋值给要注入的对象，那么这时候就需要用到Java Config。

# 参考内容

- [Spring Dependency Injection Styles - Why I love Java based configuration - codecentric AG Blog][1]
- [Spring Framework – XML vs. Annotations - DZone Java][2]
- [Xml configuration versus Annotation based configuration][3]
- [Spring annotation-based DI vs xml configuration?][4]
- [Java Dependency injection: XML or annotations][5]


  [1]: https://blog.codecentric.de/en/2012/07/spring-dependency-injection-styles-why-i-love-java-based-configuration/l-or-annotations
  [2]: https://dzone.com/articles/spring-framework-xml-vs-annotations
  [3]: https://stackoverflow.com/questions/182393/xml-configuration-versus-annotation-based-configuration
  [4]: https://stackoverflow.com/questions/8428439/spring-annotation-based-di-vs-xml-configuration
  [5]: https://stackoverflow.com/questions/4995170/java-dependency-injection-xml-or-annotations