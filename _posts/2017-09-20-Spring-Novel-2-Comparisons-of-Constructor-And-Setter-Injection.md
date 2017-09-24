---
layout:     post                    # 使用的布局（不需要改）
title:      用小说的形式讲解Spring（2） —— 注入方式哪家强               # 标题 
subtitle:   构造器注入和set注入，到底选哪个好呢 #副标题
date:       2017-09-24              # 时间
author:     ZY                      # 作者
header-img: img/banner/spring-novel-2-comparisons-of-constructor-and-setter-injection.png    #这篇文章标题背景图片
catalog: true                       # 是否归档
tags:                               #标签
    - Spring
    - Java
    - Java EE
---
本集概要：  

 - 构造器注入有什么缺点？
 - 如何使用setter注入？
 - setter注入为什么会导致空指针异常？

前情回顾：[用小说的形式讲解Spring（1） —— 为什么需要依赖注入][1]

----------

大雄给项目引入了Spring框架，解决了代码过度耦合的问题，当然，这只是Spring强大功力的冰山一角，菜鸟大雄还仍然是菜鸟大雄......

# 越来越庞大的构造函数
一天，晨会过后，哆啦对大雄说，“大雄，我们的订单接口和支付接口都已经非常完善了，现在需要**在支付完成时更新一下订单的状态**，你看看这个需求如何实现。”  
“这个好办，只需要给支付接口添加一个新的依赖IOrderDao，然后把OrderDao注入进去就可以了。”  
“好小子，张嘴一个‘依赖’，闭嘴一个‘注入’，术语说的挺溜的呀”  
“那是，你等着，马上搞定这个需求”，说完，大雄就火急火燎地写代码去了。

大雄给PaymentAction加了一个成员变量orderDao，然后新建了一个构造函数，把orderDao注入到PaymentAction里面去，接着写了一个updateOrderAfterPayment方法，调用orderDao的方法更新订单（**本文使用的代码，可以到 [SpringNovel][2] 下载，欢迎加星**）：
```java
public class PaymentAction {

    private ILogger logger;
    
    // new proprety !!!
    private IOrderDao orderDao;

    public PaymentAction(ILogger logger) {
        super();
        this.logger = logger;
    }
    
    // new constructor !!!
    public PaymentAction(ILogger logger, IOrderDao orderDao) {
        super();
        this.logger = logger;
        this.orderDao = orderDao;
    }

    public void pay(BigDecimal payValue) {
        logger.log("pay begin, payValue is " + payValue);

        // do otherthing
        // ...

        logger.log("pay end");
    }
    
    // new method !!!
    public void updateOrderAfterPayment(String orderId) {
        orderDao.updateOrderAfterPayment(orderId);
    }

}
```
最后大雄修改了一下payment.xml，注入orderDao：
```xml
<bean id="paymentAction" class="com.springnovel.payment.springxml.PaymentAction">
	<constructor-arg ref="serverLogger">
	</constructor-arg>
	<constructor-arg ref="orderDao">
	</constructor-arg>
</bean>

<bean id="serverLogger" class="com.springnovel.perfectlogger.ServerLogger" />
<bean id="orderDao" class="com.springnovel.dao.OrderDao" />
```
就这样，大雄很快实现了往支付接口添加订单更新功能的需求，兴冲冲地给哆啦提交了代码Review的请求...  

很快，Review结果回来了：

 - 如果后面PaymentAction需要依赖更多的接口，比如短信发送接口、支付宝接口、微信支付接口等等，你还是往构造函数里面加吗？假如**依赖了20个接口，那你的构造函数就会有20个参数**，就像下面这段代码，你觉得这样的代码优雅吗？ 
```java
public PaymentAction(ILogger logger, IOrderDao orderDao, ISMSUtil smsUtil, IPaybal paybal, IWechatPay wechatPay, ...) {
    super();
    this.logger = logger;
    this.orderDao = orderDao;
    this.smsUtil = smsUtil;
    this.paybal = paybal;
    this.wechatPay = wechatPay;
    ...
}
```

哆啦的话再一次给大雄浇了一盘冷水，“为啥每次review都不能一次过......”

# Setter注入
怎样解决构造函数越来越庞大的问题呢？大雄忽然想到之前在《Effective Java》的第一章看到的一个叫做[Builder模式][3]的例子，Builder模式把一个原本很庞大的构造函数，简化成一个小的的构造函数外加很多个set函数。  
“啊，不一定要用构造器注入！还有setter注入！”，大雄这才想起来之前学习Spring时看到的另一种注入方式 —— setter注入。

接下来，就是用setter注入改造PaymentAction了，大雄把之前含有两个参数的构造函数去掉，然后加上了一个setOrderDao方法：
```java
public class PaymentAction_SetInjection {

    private ILogger logger;
    private IOrderDao orderDao;

    public PaymentAction_SetInjection(ILogger logger) {
        super();
        this.logger = logger;
    }
    
    // setter injection !!!
    public void setOrderDao(IOrderDao orderDao) {
        this.orderDao = orderDao;
    }

    public void pay(BigDecimal payValue) {
        logger.log("pay begin, payValue is " + payValue);

        // do otherthing
        // ...

        logger.log("pay end");
    }

    public void updateOrderAfterPayment(String orderId) {
        orderDao.updateOrderAfterPayment(orderId);
    }

}
```
接着再修改一下payment.xml，使用&lt;property&gt;标签，注入orderDao：
```xml
<bean id="paymentAction_setInjection" class="com.springnovel.payment.springxml.PaymentAction_SetInjection">
	<constructor-arg ref="serverLogger">
	</constructor-arg>
	<property name="orderDao" ref="orderDao"></property>
</bean>
```
测试一下：
```java
public void test_PaymentAction_UpdateOrder_XML_SetInjection() {
	ApplicationContext context = new ClassPathXmlApplicationContext("payment.xml");
	PaymentAction_SetInjection paymentAction = (PaymentAction_SetInjection) context.getBean("paymentAction_setInjection");
	paymentAction.updateOrderAfterPayment("123456");
}
```
Output:
```
real update order after payment, orderId is 123456
```
“完美！setter注入其实也没什么嘛！”，大雄大叫道，偷偷瞄了哆啦一眼，哆啦此时正专注地看着自己的屏幕，似乎没有觉察到这边厢亢奋的大雄。  

# 空指针异常！
大雄再一次准备给哆啦提交review请求，在食指即将按下回车的那一刹那，他仿佛拥有了窥视未来的能力，他看到哆啦拿着装满冷水的脸盆，朝他洒过来.... “啊，不对劲，那这样构造器注入岂不是完败于setter注入了？不科学呀。。。setter注入肯定有什么局限是我还没发现的.....”

“Spring容器初始化对象时，会去调用对象的构造函数，此时如果采用构造器注入，并且xml里没有配置对应的&lt;constructor&gt;标签，那么由于没有与之匹配的构造函数，注入应该会失败”  
“而setter注入，如果没有配置&lt;property&gt;，是会提示初始化失败呢，还是压根就不注入呢？”，大雄的脑袋飞快地翻转着。

“修改一下代码，验证一下不就知道了！”
于是大雄首先把&lt;constructor&gt;标签注释掉：
```java
<bean id="paymentAction_setInjection" class="com.springnovel.payment.springxml.PaymentAction_SetInjection">
	<!--<constructor-arg ref="serverLogger">-->
	<!--</constructor-arg>-->
	<property name="orderDao" ref="orderDao"></property>
</bean>
```
执行测试用例，果然报错了：
```
org.springframework.beans.factory.BeanCreationException: 
...
No default constructor found; 
```
提示“没有默认的构造函数”，可见由于没有配置&lt;constructor&gt;标签，Spring容器调用了空参数的构造函数，而PaymentAction类并没有空参的构造函数，因此报错了，**这种错误会导致容器初始化失败，因此很容易发现**。

接着大雄撤销了操作，然后把&lt;property&gt;标签注释掉：
```xml
<bean id="paymentAction_setInjection" class="com.springnovel.payment.springxml.PaymentAction_SetInjection">
	<constructor-arg ref="serverLogger">
	</constructor-arg>
	<!--<property name="orderDao" ref="orderDao"></property>-->
</bean>
```
重新执行测试用例，啊，报错了！ 空指针异常！：
```
java.lang.NullPointerException
	at com.springnovel.payment.springxml.PaymentAction_SetInjection.updateOrderAfterPayment(PaymentAction_SetInjection.java:34)
	at com.springnovel.test.PaymentTest.test_PaymentAction_UpdateOrder_XML_SetInjection(PaymentTest.java:46)
```
看来如果没有在xml里面指定要注入的对象，那么set注入不会失败，所依赖的对象没有被注入任何对象，因此默认为null。
“这可不太好，**万一真的粗心大意忘了在xml里面指定要注入的对象呢，容器是可以成功启动，但是运行时可就挂了。。。**”  
“有没有办法让setter注入的属性成为必填项呢？”

大雄决定上网搜索一下资料，打开Google，输入“spring setter bitian...”  
“啊不。。什么鬼。。。必填英文怎么说来着。。。”  
“噢噢，required嘛，HTML5的一个必填校验属性就叫Required”  
噼里啪啦，大雄输入了“spring setter required”  
很快，他发现Spring2.0提供了一个@Required注解......

# Reuqired注解
“这就好办了！”，大雄对照着教程，修改起了代码。
首先要开启Spring注解的功能，给payment.xml加入这些配置：
```xml
...
<beans
       ...    
       xmlns:context="http://www.springframework.org/schema/context"
       xsi:schemaLocation="
        ...
        http://www.springframework.org/schema/context
	    http://www.springframework.org/schema/context/spring-context-2.5.xsd">

    <context:annotation-config/>
...
```
接着再给PaymentAction的setOrderDao方法加入@Required注解：
```java
@Required
public void setOrderDao(IOrderDao orderDao) {
	this.orderDao = orderDao;
}
```
再次执行测试用例，结果当然还是报错，不过这次是在容器初始化就提示错误了:
```
org.springframework.beans.factory.BeanCreationException: 
...
Property 'orderDao' is required for bean 'paymentAction_setInjection'
```
“这下好了，在Spring容器创建对象时就报错了，不会等到执行代码时再来抛个空指针异常，简直是粗心大意的程序员的救星啊！”

大雄仔细地对代码做了检查，最后敲了回车，给哆啦提交了Review请求。

“叮，pass!”，大概过了半个小时，屏幕弹出通知，大雄的代码终于通过了哆啦和小组成员的检视，成功提交到代码库了！

# 大雄的笔记
今天大雄学到了构造器注入之外的另外一种注入方式——setter注入，临睡前，大雄习惯性地对今天所学到的知识做了总结：

 - Constructor注入 vs Setter注入

   - Constructor注入能够强制要求调用者注入构造函数中的所有参数，否则在容器初始化时就会失败；但是如果要注入的对象过多，就会导致**构造函数过于庞大**。
   - Setter注入，类似于Builder模式，将原本庞大的构造函数，拆解为了**一个小的构造函数**和**许多个set方法**。setter注入不能保证对象一定会被注入，但是可以使用**@Required**注解，强制要求使用者注入对象，否则在容器初始化时就会报错。

总结完，大雄一跃而起，啪的一下蹦到了席梦思上，整个人成“大”字状，眼睛一闭，嘴巴一张，很快进入了梦乡......
   
# 大雄的梦
睡梦中，大雄看到了一只非常奇怪的“三眼乌鸦”，“三眼乌鸦”静静的木在树枝上，等大雄一靠近，就很快地飞到另一颗树上，大雄就这样追了好久....
突然，大雄看到一座桥，桥头立着一块牌子，上面写着“Bridge for You”
“桥为我？桥给我？？”  
一旁的“三眼乌鸦”实在看不下去了，骂道，“是给你准备的桥！笨蛋！”  
“给我准备的？那我得走过去看看！”，说完，大雄走进了那座桥 -> [Bridge for You][4]

# 未完待续
第二天一大早，手机突然响了，睡梦中的大雄迷迷糊糊地接了电话...

“喂！大雄啊，还在睡觉啊？？快起来，有个需求要改一下！”，原来是那个讨厌的项目经理胖虎...  
“改..改需求？！”  
“之前不是让你们把日志打印到日志服务器了吗？刚刚客户说了，要换，要打到控制台！今天早上就要改完！”  
“哇靠....”大雄脱口而出，不过他很快就暗暗高兴，因为他知道由于采用了依赖注入，现在他只需要改一处配置，“哎呀，这客户咋那么多事，你等着啊，我现在改，要改的地方多着呢，改完你得请我吃饭”  
“小兔崽子，项目上线了你要吃多少都行！”  

大雄马上起身，打开便携，把payment.xml的ServerLogger改为了ConsoleLogger：
```java
<bean id="serverLogger" class="com.springnovel.perfectlogger.CosoleLogger"/>
```
“要测试一下吗？哎，算了，测啥测，肯定没问题”，说完大雄提交了代码给胖虎，然后给胖虎发了条信息，让他审核一下。
胖虎很快将大雄的代码提交到代码库...

“真是的，搞得我觉都没睡好...”，大雄正准备睡个回笼觉....手机又响了...  
“大雄，你怎么搞得！改了你的代码，现在服务器连启动都失败了！”  
“啊？？？怎么可能...”，大雄一脸懵逼......  

# 参考内容

 - 《Spring in Action》
 - [Explain why constructor inject is better than other options][5]
 - [Setter injection versus constructor injection and the use of @Required][6]
 - [Spring dependency checking with @Required Annotation][7]


  [1]: http://bridgeforyou.cn/2017/09/16/Spring-Novel-1-Why-Use-Dependency-Injection/
  [2]: http://blog.csdn.net/hzy38324/article/details/72793035#t1
  [3]: http://blog.csdn.net/hzy38324/article/details/72793035#t1
  [4]: http://bridgeforyou.cn/
  [5]: https://stackoverflow.com/questions/21218868/explain-why-constructor-inject-is-better-than-other-options
  [6]: https://spring.io/blog/2007/07/11/setter-injection-versus-constructor-injection-and-the-use-of-required/
  [7]: https://www.mkyong.com/spring/spring-dependency-checking-with-required-annotation/