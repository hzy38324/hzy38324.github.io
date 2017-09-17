---

layout:     post                    # 使用的布局（不需要改）

title:      用小说的形式讲解Spring（1） —— 为什么需要依赖注入               # 标题 

subtitle:   菜鸟大雄是如何偶遇Spring的 #副标题
date:       2017-09-16              # 时间
author:     ZY                      # 作者
header-img: img/banner/spring-novel-why-use-dependency-injection.png    #这篇文章标题背景图片
catalog: true                       # 是否归档
tags:                               #标签
    - Spring
    - Java
    - Java EE
---

大雄是一个刚踏入社会的95后，热爱编程的他，在毕业之后进入了一家互联网公司，负责公司内一个电商项目的开发工作。  
为了让大雄更快的成长，公司安排了哆啦作为大雄的导师。

# 春风得意
在哆啦的指导下，大雄很快对这个项目的代码有了大致的了解，于是哆啦准备给大雄安排点任务。  

“大雄，我们这项目现在缺少**日志打印**，万一到时上线后发现bug了，很难定位。你看看有什么办法可以把一些必要的信息**打印到日志文件**中。”  
“没问题！”大雄爽快地答应了。  

大雄以前在学校时，经常上网找各种资源，于是很快就锁定了一个叫PerfectLogger的工具。“资料很完善，很多大神都推荐它，嗯，就用它了”。  

大雄看了一下PerfectLogger的官方文档，发现里面提供了很多种日志打印功能，有打印到文件的，有打印到控制台的，还有打印到远程服务器上的，这些类都实现了一个叫ILogger的接口：  

- ILogger
  - FileLogger
  - ConsoleLogger
  - ServerLogger
  - ...

“哆啦说要打印到文件，那就用FileLogger吧！”  
于是，大雄先在支付接口的代码中，加入了日志打印（**本文使用的代码，可以到 [SpringNovel][1] 下载**）：
```java
public class PaymentAction {
	
	private ILogger logger = new FileLogger();
	
	public void pay(BigDecimal payValue) {
		logger.log("pay begin, payValue is " + payValue);
		
		// do otherthing
		// ...
		
		logger.log("pay end");
	}
}
```
接着，大雄又在登录、鉴权、退款、退货等接口，都加上和支付接口类似的日志功能，要加的地方还真不少，大雄加了两天两夜，终于加完了，大功告成！想到自己第一个任务就顺利完成了，大雄不禁有点小得意...

# 改需求了
很快公司升级了系统，大雄做的日志功能也将第一次迎来生产环境的考验。

两天后，哆啦找到了大雄。
“大雄，测试那边说，日志文件太多了，不能都打印到本地的目录下，要我们把日志打印到一台**日志服务器上**，你看看改动大不大。”  
“这个简单，我只需要做个**全局替换**，把FileLogger都替换成ServerLogger就完事了。”  
哆啦听完，皱了皱眉头，问道，“那要是下次公司让我们把日志打印到控制台，或者又突然想让我们打印到本地文件呢，你还是继续全局替换吗？”  
大雄听完，觉得是有点不妥......

# 代码如何解耦
“我看了一下你现在的代码，每个Action中的logger都是由Action自己创造的，所以如果要修改logger的实现类，就要改很多地方。有没有想过可以**把logger对象的创建交给外部去做呢**？”  
大雄听完，觉得这好像是某种自己以前学过的设计模式，“工厂模式！”大雄恍然大悟。

很快，大雄对代码做了重构：
```java
public class PaymentAction {
	
	private ILogger logger = LoggerFactory.createLogger();
	
	public void pay(BigDecimal payValue) {
		logger.log("pay begin, payValue is " + payValue);
		
		// do otherthing
		// ...
		
		logger.log("pay end");
	}
}
```
```java
public class LoggerFactory {
	public static ILogger createLogger() {
		return new ServerLogger();
	}
}
```
有了这个LoggerFactory，以后要是要换日志打印的方式，只需要修改这个工厂类就好了。

# 啪！一盘冷水
大雄高兴地给哆啦提了代码检视的请求，但是，很快，一盘冷水就泼了过来，哆啦的回复是这样的：

 - 工厂类每次都new一个新对象，是不是很浪费，能不能做成**单例**的，甚至是做成单例和多例是**可以配置**；
 - 如果有这种需求：支付信息比较多而且比较敏感，日志要打印到远程服务器，其他信息都打印到本地，怎么实现；
 - ...

大雄看完，顿时感觉自己2young2simple了，准备今晚留下来好好加班......

# Spring! Spring!
正当大雄郁闷着的时候，屏幕右下角哆啦的头像突然蹦了出来。  

“其实这种**将对象交给外部去创建**的机制，不仅仅是工厂模式，它还被称为**控制反转**（Inverse of Control），它还有另一个更常用的名称，**依赖注入**（Dependency Injection）。这种机制，业界已经有很成熟的实现了，它就是**Spring Framework**，晚上早点回去，有空可以看看Spring，明天再过来改。”

那天晚上，大雄在网上找了下Spring的资料，他似乎发现了另一个世界...

# 使用Spring改造代码
第二天大雄早早地就来到了公司，他迫不及待地想把原来的代码使用Spring的方式改造一遍。  

在使用[gradle][2]引入了必要的jar包后，大雄对原来的PaymentAction做了修改，不再在类内部创建logger对象，同时给PaymentAction添加了一个构造函数，方便Spring进行注入：
```java
public class PaymentAction {
	
	private ILogger logger;
	
	public PaymentAction(ILogger logger) {
		super();
		this.logger = logger;
	}

	public void pay(BigDecimal payValue) {
		logger.log("pay begin, payValue is " + payValue);
		
		// do otherthing
		// ...
		
		logger.log("pay end");
	}
}
```
接着创建了一个以&lt;beans&gt;为根节点的xml文件，引入必要的XSD文件，并且配置了两个bean对象，使用了&lt;constructor-arg&gt;标签，指定了ServerLogger作为PaymentAction构造函数的入参：
```xml
<?xml version="1.0" encoding="UTF-8"?>
<beans xmlns="http://www.springframework.org/schema/beans"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="http://www.springframework.org/schema/beans http://www.springframework.org/schema/beans/spring-beans.xsd">

  <bean id="paymentAction" class="com.springnovel.paymentwithspringxml.PaymentAction">
  	<constructor-arg ref="serverLogger" />
  </bean>
        
  <bean id="serverLogger" class="com.springnovel.perfectlogger.ServerLogger" />

</beans>
```
差不多了，现在测试一下：
```java
ApplicationContext context = new ClassPathXmlApplicationContext("payment.xml");
PaymentAction paymentAction = (PaymentAction) context.getBean("paymentAction");
paymentAction.pay(new BigDecimal(2));
```
Output:
```
ServerLogger: pay begin, payValue is 2
ServerLogger: pay end
```
很棒！ServerLogger对象已经被注入到PaymentAction中了。  
就这样，大雄很快就使用Spring实现了自己昨天写的工厂类的功能，修复了之前代码耦合性过高的问题。

# 学以致用
这边大雄正高兴呢，突然发现旁边的测试妹妹静香眉头紧锁，于是过去关心了一番。  
原来静香正在测试一个删除订单的功能，但是现在测试用的数据库突然挂了，导致静香不能进行测试。

大雄看了看订单删除接口的代码：
```java
public class OrderAction {
	public void deleteOrder(String orderId) {
		// 鉴权
		// 此处略去一万字...
		
		IOrderDao orderDao = new OrderDao();
		orderDao.deleteOrder(orderId);
	}
}
```
“这又是一个**代码耦合过紧**的问题！”大雄脱口而出。  
“这个删除订单的接口有几个逻辑：鉴权、删除、回滚等，但是这里把删除的数据库操作和OrderDao绑定死了，**这样就要求测试这个接口时必须要连接到数据库中**，但是作为单元测试，我们只是想测删除订单的逻辑是否合理，而订单是否真的删除，应该属于另一个单元测试了” 大雄很是激动，嘴里唾沫横飞。  
“我来帮你改一下。”  

“控制反转”后的OrderAction:  
```java
public class OrderAction {
	
	private IOrderDao orderDao;
	
	public OrderAction(IOrderDao orderDao) {
		super();
		this.orderDao = orderDao;
	}

	public void deleteOrder(String orderId) {
		// 鉴权
		// 此处略去一万字...
		
		orderDao.deleteOrder(orderId);
	}
}
```
改造后的OrderAction，不再和OrderDao这个实现类耦合在一起，做单元测试的时候，可以写一个“Mock”测试，就像这样：
```java
@Test
public void mockDeleteOrderTest() {
	IOrderDao orderDao = new MockOrderDao();
	OrderAction orderAction = new OrderAction(orderDao);
	orderAction.deleteOrder("1234567@#%^$");
}
```
而这个MockOrderDao是不需要连接数据库的，因此即便数据库挂了，也同样可以进行单元测试。

一旁的哆啦一直在静静地看着，然后拍了拍大雄的肩膀，“晚上请你和静香去撸串啊”，说完，鬼魅的朝大雄挑了挑眉毛。

# 大雄的笔记
这两天大雄可谓是收获颇丰，见识了依赖注入的必要性，还了解了如何使用Spring实现依赖注入。撸完串后，回到家，大雄在记事本上写下了心得：

 - 为什么要使用依赖注入
   - 传统的代码，每个对象负责管理与自己需要依赖的对象，导致如果需要切换依赖对象的实现类时，需要修改多处地方。同时，过度耦合也使得对象难以进行单元测试。
   - 依赖注入把对象的创造交给外部去管理,很好的解决了代码**紧耦合**（tight couple）的问题，是一种让代码实现**松耦合**（loose couple）的机制。
   - 松耦合让代码更具灵活性，能更好地**应对需求变动**，以及**方便单元测试**。

 - 为什么要使用Spring
   - 使用Spring框架主要是为了**简化Java开发**（大多数框架都是为了简化开发），它帮我们封装好了很多完善的功能，而且Spring的生态圈也非常庞大。
   - 基于XML的配置是Spring提供的**最原始的依赖注入配置方式**，从Spring诞生之时就有了，功能也是最完善的（但是貌似有更好的配置方法，明天看看！）。
 

# 未完待续
写完笔记，大雄继续看之前只看了一小部分的Spring指南，他发现除了构造器注入，还有一种注入叫set注入；除了xml配置，还可以使用注解、甚至是Java进行配置。Spring真是强大啊，给了用户那么多选择，可**具体什么情况下该使用哪种注入方式和哪种配置方式呢**，大雄陷入了沉思......

# 参考内容

 - 《Spring in Action》
 - [tutorialspoint - Spring Tutorial][3]
 - [javatpoint - Spring Tutorial][4]
 - [Why does one use dependency injection?][5]
 - [Dependency Injection and Unit Testing][6]


  [1]: https://github.com/hzy38324/SpringNovel
  [2]: https://gradle.org/
  [3]: https://www.tutorialspoint.com/spring/
  [4]: https://www.javatpoint.com/spring-tutorial
  [5]: https://stackoverflow.com/questions/14301389/why-does-one-use-dependency-injection
  [6]: https://javaranch.com/journal/200709/dependency-injection-unit-testing.html