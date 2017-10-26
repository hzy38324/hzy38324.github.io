---
layout:     post                    # 使用的布局（不需要改）
title:      用小说的形式讲解Spring（4） —— 使用Spring Boot创建NoXml的Web应用              # 标题 
subtitle:   大道至简·Spring Boot #副标题
date:       2017-10-21              # 时间
author:     ZY                      # 作者
header-img: img/banner/spring-novel-3-annotaion-based-configuration-and-java-based-configuration.jpg    #这篇文章标题背景图片
catalog: true                       # 是否归档
tags:                               #标签
    - Spring
    - Java
    - Spring Boot
---
>本文中的项目使用[Github](https://github.com/hzy38324/tiny-facebook)托管，已打[Tag](https://github.com/hzy38324/tiny-facebook/releases)，执行git checkout v1.0 即可获取本文所涉及的代码。

本集概要：

- 怎样用Spring Boot搭建Web应用？
- Spring Boot和Spring相比，有什么优势？
- Spring Boot的起步依赖和自动配置是什么东西？
- 为什么不需要配置Servlet容器也可以启动Web应用？

----------

经过了国庆七天长假的休息，回到公司的大雄已经打满了鸡血，准备在新的项目 —— tiny facebook，大干一场。第一次被委以重任，大雄心里还是有点小紧张的...  

“从目前社区的反馈来看，Spring Boot相比于Spring而言，可以大大提高开发的效率，我们这个tiny facebook，就用Spring Boot开发吧！”，哆啦对大雄说。  
“啊，那我岂不是又得重新学习啦，好不容易才学完了Spring的基础...”  
“学是肯定还要学的，但是其实Spring Boot只是将原先Spring一些比较繁琐的配置简化了而已，进一步提高了Java开发的效率，而你之前学的Spring控制反转，对你理解Spring Boot是有很大作用的。”  
“Soga！那就是说原理是一样的罗，那好办！哆啦你有没有写过什么总结文档，让我参考一下嘛”   
“自己到Spring官网上找去，你小子整天就想不劳而获...”，哆啦心里暗自说道，其实我就没写过总结文档。

# 原料
“哎，我最讨厌看英文文档了”，打开[Spring官网](https://spring.io/)，看到一堆密密麻麻的英文时，大雄的头顶仿佛有很多只乌鸦飞过。  
跟随着链接，大雄找到了一个Spring Boot的[Get Started](https://spring.io/guides/gs/spring-boot/)教程，“来吧，可恶的英文，我要hello world了！”  
大雄在机子上准备好了JDK1.8和Gradle4.1，开始按照教程搭建他的Spring Boot。  

# 初始化Gradle工程
首先要搭建Gradle项目的框架，非常简单，[Get Started](https://spring.io/guides/gs/spring-boot/)里面的Build With Gradle部分有简略教程，详细教程可以看[Building Java Projects with Gradle](https://spring.io/guides/gs/gradle/)。  
在项目根目录下创建src\main\java文件夹，接着在和src同级的目录下创建build.gradle：  
```
buildscript {
    repositories {
        mavenCentral()
    }
    dependencies {
        classpath("org.springframework.boot:spring-boot-gradle-plugin:1.5.7.RELEASE")
    }
}

apply plugin: 'java'
apply plugin: 'eclipse'
apply plugin: 'idea'
apply plugin: 'org.springframework.boot'

jar {
    baseName = 'tiny-facebook'
    version =  '0.1.0'
}

repositories {
    mavenCentral()
}

sourceCompatibility = 1.8
targetCompatibility = 1.8

dependencies {
    // There's tomcat embedded in it
    compile("org.springframework.boot:spring-boot-starter-web")
    // tag::actuator[]
    compile("org.springframework.boot:spring-boot-starter-actuator")
    // end::actuator[]
    testCompile("junit:junit")
    testCompile("org.springframework.boot:spring-boot-starter-test")
}
```
看了一下内容，大致上就是配置一些依赖包，先不管那么多了，把工程跑起来先，后面再来研究。  
接着执行：
```
gradle wrapper --gradle-version 2.13
```
这个命令执行完之后会生成gradlew.bat文件，gradlew命令里面内置了一些脚本，可以让没有安装gralde的机器也可以运行这个gradle工程，就像下面这段文档所说的：
> The Gradle Wrapper is the preferred way of starting a Gradle build. It consists of a batch script for Windows and a shell script for OS X and Linux. These scripts allow you to run a Gradle build without requiring that Gradle be installed on your system. This used to be something added to your build file, but it’s been folded into Gradle, so there is no longer any need. 

# 编写接口
在src\main\java\目录下创建了一个名为com.b4u.tinyfacebook.controller的包，用来存放项目的Controller，然后在底下创建了PostController类：
```java
@RestController
public class PostController {
    @RequestMapping("/post")
    public String post() {
        return "this is a post";
    }
}
```

# Application
在src\main\java\com\b4u\tinyfacebook目录下创建Application类：
```java
@SpringBootApplication
public class Application {

    public static void main(String[] args) {
        SpringApplication.run(Application.class, args);
    }

    @Bean
    public CommandLineRunner commandLineRunner(ApplicationContext ctx) {
        return args -> {

            System.out.println("Let's inspect the beans provided by Spring Boot:");

            String[] beanNames = ctx.getBeanDefinitionNames();
            Arrays.sort(beanNames);
            for (String beanName : beanNames) {
                System.out.println(beanName);
            }

        };
    }

}
```

# 运行
在项目根目录下执行：
```
gradlew build && java -jar build/libs/tiny-facebook-0.1.0.jar
```
这里面包含了两条命令，前一条是构建jar包，后一条是执行jar包。  
可以看到控制台打出了“Srping”的字样，最后输出：
```
Started Application in 5.743 seconds (JVM running for 6.388)
```
访问http://localhost:8080/post:
![](/img/post/2017-10-21-Spring-Novel-4-Build-RESTful-Service-with-Spring-Boot/request-01.png)
“太神奇了，**只用了不到5分钟的时间，不用一行Xml代码，就可以创建一个Web应用了！**”

# 提交代码
到这里算是实现了一个基于Spring Boot的最小Web项目了，大雄把代码提交到了[Github](https://github.com/hzy38324/tiny-facebook)，并且打上了Tag，使用下面命令就可以拿到这份代码啦：
```
git clone git@github.com:hzy38324/tiny-facebook.git
git checkout v1.0
```
"**大家快来给我加星吧，嘿嘿嘿**"，大雄开始做起了白日梦。

# 探秘
照着文档一路做下来，一个Web工程就这样出来，不过这里面还有很多不知其然的地方，大雄决定一探究竟。  
## 哪来的Servlet容器
按照以往的经验，在写完代码之后，还需要把代码部署到Servlet容器中去，比如Tomcat，接着启动容器，才可以访问，可是上面的步骤里似乎并没有涉及到Servlet容器，这是为什么？  

其实，我们在build.gradle里面引入了spring-boot-starter-web这个依赖，利用传递依赖的特性，我们就可以顺带引入了一个内嵌的Tomcat：
```
dependencies {
    // There's tomcat embedded in it
    compile("org.springframework.boot:spring-boot-starter-web")
```
我们在Application中，使用@Bean注解了commandLineRunner，因此这个方法在Spring Boot容器启动时会被执行，在这个方法里面，打印了容器内的所有对象,在打印列表中，我们可以找到：
```
tomcatEmbeddedServletContainerFactory
```
这个就是内嵌的tomcat容器了。  

事实上spring-boot-starter-web这个依赖还帮我们引入了很多Web开发中常用的依赖，比如Spring MVC，Spring Boot觉得，反正你们开发Web的时候，都是要用到SpringMVC的，干脆我就把SpringMVC和Spring打包在一起给你好了，而且不需要你指定版本号，**Spring Boot会根据自身的版本号，下载对应版本的其他依赖**，这样你就**不用担心说自己选择的各种依赖之间会不兼容**了，因为Spring Boot都帮你处理好了。这种做法，大大简化了我们的开发，因而也被叫做**起步依赖**。

## @RestController
@RestController注解等于@Controller + @ResponseBody，也就是说，@RestController即把被它注解的类，交给了Spring容器管理，又使得这个请求将会返回数据，而不是返回视图。

## 为什么不需要一行Xml代码
Spring Boot给人最深的印象就是，整个Web应用的创建过程中，不需要编写任何Xml文件，以往在使用Spring时，至少需要在application.xml和web.xml里面，进行Spring的一些配置，比如开启自动注入、配置DispatcherServlet（Spring MVC的前端控制器，就是它，找到请求对应的Controller，并交给Controller处理）等等，那么Spring Boot为什么不需要一行Xml代码，就可以实现和Spring一样的功能呢？  

首先我们得再来看一下这个Application类：
```java
@SpringBootApplication
public class Application {

    public static void main(String[] args) {
        SpringApplication.run(Application.class, args);
    }

    @Bean
    public CommandLineRunner commandLineRunner(ApplicationContext ctx) {
        return args -> {

            System.out.println("Let's inspect the beans provided by Spring Boot:");

            String[] beanNames = ctx.getBeanDefinitionNames();
            Arrays.sort(beanNames);
            for (String beanName : beanNames) {
                System.out.println(beanName);
            }

        };
    }

}
```
这里的@SpringBootApplication注解，实际上包含了三个注解：

- @Configuration：表明这是一个Java Config的配置类（Java Config是Spring依赖注入配置方式三种中的其中一种，不了解的同学可以参考之前的章节：[xml、注解和Java Config到底选哪个](http://bridgeforyou.cn/2017/10/03/Spring-Novel-3-Annotaion-Based-Configuration-and-Java-Based-Configuration/)），因此在这个类下面使用@Bean就可以往容器注入对象了；
- @ComponentScan：启用组件扫描，这就能理解为什么不需要在xml里面开启扫描了吧！当然这个配置要结合上面的@Configuration才有效；
- @EnableAutoConfiguration ：开启Spring Boot**自动配置**的能力，就是这个注解，让你少写了很多Xml配置呢！

那么这个“自动配置”到底是什么原理呢？其实顾名思义，就是自动帮你写好配置的意思，比如说，Spring Boot检查到了你的classpath下面有Spring MVC，那就说明你用到了Spring MVC，既然你用到了Spring MVC，那你肯定要去web.xml中去配置DispatcherServlet，既然你肯定要做，好，不用麻烦你了，我帮你配置好了，你直接用就行！这就是Spring Boot自动配置最“淳朴”的解释啦，如果你想了解自动配置的具体原理，可以参考《Spring Boot实战》2.3章节。

# 大雄的笔记
今天又是收获丰富的一天，大雄见识到了什么叫服务意识，服务意识就是我知道你要做什么，然后提前帮你做了。Spring Boot就是一个服务意识超强的帮手。临睡前，大雄把关于Spring Boot的学习心得记了下来：

- Spring Boot使用了**自动配置**的特性，帮我们配置好了以前使用Spring开发时需要做的很多固定配置，从而让我们**更加专注于核心代码的开发**；
- Spring Boot提供了很多**起步依赖**，减少了对引入依赖的代码的编写，也避免了手动引入依赖可能造成的各个依赖之间不兼容的问题；
- **Spring官网的资料写的真不赖！是我看到的写的最好的英文文档！**

# 未完待续
“小伙子英文不错嘛，这就把框架搭好了”，哆啦拍着大雄的肩膀，少见的表扬了一句。  
“Where where, 人家文档写的好嘛！”  
“哎哟呵，这么谦虚。 对了，我们这个tiny facebook后面肯定少不了要提供很多RESTful接口的，你预研一下如何实现Get啊Post啊Put啊Delete啊啥啥啥的接口吧。”  
“这还不简单，现在那个接口，默认是Get方式，要改成其他方式，不就加上注解指定一下就好啦！”  
“实现是很简单，但你知道RESTful和传统的SOAP有什么区别吗？为什么RESTful这么流行？怎样写好一个RESTful接口？Post和Put有什么区别......”，哆啦又开启了唐僧叨叨逼模式...  
......

# 参考内容
- [Building an Application with Spring Boot](https://spring.io/guides/gs/spring-boot/)
- [Building Java Projects with Gradle](https://spring.io/guides/gs/gradle/)
- 《Spring Boot实战》