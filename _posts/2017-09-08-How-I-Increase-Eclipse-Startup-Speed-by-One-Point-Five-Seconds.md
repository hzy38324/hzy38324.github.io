---
layout:     post                    # 使用的布局（不需要改）
title:      我是如何让Eclipse的启动速度提升1.5秒的               # 标题 
subtitle:   学以致用 —— 运用Java虚拟机内存区域和垃圾收集机制的知识，对Eclipse进行调优 #副标题
date:       2017-09-08              # 时间
author:     ZY                      # 作者
header-img: img/banner/how-i-increase-eclipse.jpg    #这篇文章标题背景图片
catalog: true                       # 是否归档
tags:                               #标签
    - Java
    - JVM
    - Eclipse
---

# 前言
在这之前，我写过一篇文章 —— [关于Java虚拟机性能调优的清单][1]，文章里我梳理了JVM调优的所需理论知识和常用工具清单，今天就让我们来使用这份清单，进行一次JVM的调优实战。

# 我为什么选择Eclipse来调优
虽然IntelliJ IDEA的风头似乎已经盖过了Eclipse，但由于工作的原因，在大多数时候我还是使用Eclipse作为开发工具，我想现在使用Eclipse的程序员也一定很多。

既然很多人和我一样，每天都在用Eclipse，那有没有想过:
*  它是采用什么垃圾收集器？
*  启动的时候，都执行了多少次GC？
*  能不能对它的启动速度进行调优？

这篇文章，介绍一下我是如何对Eclipse进行调优，使得它的启动速度提升了1.5秒的。

你可能会说，才1.5秒，需要说的是，笔者的电脑性能比较牛，优化前启动Eclipse只需要**5953ms**，优化结束后是**4693**ms，提升了**21%**的速度，这就像百米赛跑，第一名的博尔特和最后一名的差了不到1秒钟，但已经完全是不同的境界了！

下面让我们开始提速吧！

# 环境信息
*  Eclipse： [eclipse-standard-kepler-R-win32-x86_64](http://www.eclipse.org/downloads/packages/eclipse-standard-43/keplerr)，需要配套1.6+的JDK
*  JDK：jdk1.7.0_51
*  机器环境：WIN10, 64位，12G内存，i7处理器

# 调优前的启动速度
为了方便计算Eclipse的启动速度，这里使用了周志明老师写的一个Eclipse插件，该插件可以在Eclipse启动完成后，计算当前时间和Eclipse开始启动时间直接的间隔，然后在界面上打印出总的启动时间，就像这样：

![](/img/post/2017-09-08-How-I-Increase-Eclipse/plugin-show.png)

插件下载地址：[华章图书 - 深入理解Java虚拟机：JVM高级特性与最佳实践（第2版）](http://www.hzbook.com/Books/7049.html#download)
下载里面的教辅源代码，插件在第五章的源代码中。

笔者一开始的eclipse.ini配置是这样的：
```
-vm
C:/Program Files/Java/jdk1.7.0_51/bin/javaw.exe
-startup
plugins/org.eclipse.equinox.launcher_1.3.0.v20130327-1440.jar
--launcher.library
plugins/org.eclipse.equinox.launcher.win32.win32.x86_64_1.1.200.v20130521-0416
-product
org.eclipse.epp.package.standard.product
--launcher.defaultAction
openFile
--launcher.XXMaxPermSize
128M
-showsplash
org.eclipse.platform
--launcher.XXMaxPermSize
128M
--launcher.defaultAction
openFile
--launcher.appendVmargs
-vmargs
-Dosgi.requiredJavaVersion=1.6
-Xms40m
-Xmx128M
```

配置里面主要是指定了使用JDK7，初始堆大小（-Xms）是40m，最大堆（-Xmx）是128m.
接着，笔者启动了三次Eclipse，三次的启动时间分别是5960ms、5945ms、5954ms，取平均值之后，**调优前的启动时间是5953ms**.
同时笔者通过使用Visual VM，记录了调优前虚拟机的运行状况：

![](/img/post/2017-09-08-How-I-Increase-Eclipse/vsvm01.png)

从Visual VM的监控信息看，启动时间主要有三大块：**编译时间**、**类加载时间**以及**垃圾回收的停顿时间**。
其中，编译时间是指JVM的JIT编译，笔者是64位的机器，只能采用server模式，因此在即时编译上没有什么优化的余地。
> 关于JIT编译器、server模式和client模式，可以参考 [解释执行和即时编译器](http://blog.csdn.net/hzy38324/article/details/77411522#t6)

因此，下面主要对耗时3.468秒的类加载时间，以及新生代（Eden Space）总耗时107ms的13次GC和老年代（Old Gen）总耗时156ms的Full GC，进行调优。

# 类加载时间调优
JVM的类加载，是指将Class文件，加载到虚拟机中。类加载的过程，包括加载、验证、准备、解析、使用、卸载等阶段。

其中验证，是由于Class文件不全都是由Java源码编译而来，Class文件可以使用任何途径产生，甚至可以直接使用十六进制编辑器来编写。因此虚拟机要对Class文件进行验证。而对于Eclipse来说，虚拟机要加载的文件，基本都是我们自己编写的源码，是值得信任的，因此，可以加入参数**-Xverify:none**将类加载时的验证阶段去掉。

去掉之后，再来看Visual VM里的类加载时间，可以看到类加载时间一下子下降到2s：

![](/img/post/2017-09-08-How-I-Increase-Eclipse/vsvm02.png)

同样的，再来启动三次Eclipse，时间分别是4687ms、4700ms、4695ms，取平均值，**去掉验证阶段后的Eclipse的启动时间为4694ms**。

# 垃圾收集的时间调优
再来对垃圾收集进行调优，首先，我们打印一下GC日志，来看看现在Eclipse采用的是什么垃圾收集器，在eclipse.ini中加入：
```
-XX:+PrintGCTimeStamps
-XX:+PrintGCDetails
-Xloggc:gc.log
```
启动后查看gc.log:
```
0.373: [GC [PSYoungGen: 10752K->1528K(12288K)] 10752K->2853K(39936K), 0.0087200 secs] [Times: user=0.05 sys=0.01, real=0.01 secs] 
0.641: [GC [PSYoungGen: 12280K->1512K(23040K)] 13605K->5449K(50688K), 0.0053889 secs] [Times: user=0.00 sys=0.00, real=0.01 secs] 
1.205: [GC [PSYoungGen: 23016K->1522K(23040K)] 26953K->13258K(50688K), 0.0089067 secs] [Times: user=0.00 sys=0.00, real=0.01 secs] 
1.667: [GC [PSYoungGen: 23026K->1515K(42496K)] 34762K->16585K(70144K), 0.0061016 secs] [Times: user=0.00 sys=0.02, real=0.01 secs] 
1.809: [GC [PSYoungGen: 42475K->1515K(42496K)] 57545K->16937K(70144K), 0.0049001 secs] [Times: user=0.02 sys=0.00, real=0.01 secs] 
2.372: [GC [PSYoungGen: 42475K->1528K(23040K)] 57897K->24396K(50688K), 0.0109632 secs] [Times: user=0.05 sys=0.02, real=0.01 secs] 
2.383: [Full GC [PSYoungGen: 1528K->0K(23040K)] [ParOldGen: 22868K->22517K(51200K)] 24396K->22517K(74240K) [PSPermGen: 23460K->23448K(47104K)], 0.1348976 secs] [Times: user=0.38 sys=0.00, real=0.13 secs] 
2.970: [GC [PSYoungGen: 21504K->8905K(30720K)] 44021K->31422K(81920K), 0.0067912 secs] [Times: user=0.00 sys=0.00, real=0.01 secs] 
3.309: [GC [PSYoungGen: 30409K->9243K(30720K)] 52926K->31760K(81920K), 0.0084435 secs] [Times: user=0.05 sys=0.00, real=0.01 secs] 
3.715: [GC [PSYoungGen: 27675K->12787K(31232K)] 50192K->36581K(82432K), 0.0124344 secs] [Times: user=0.06 sys=0.00, real=0.01 secs] 
4.478: [GC [PSYoungGen: 31219K->12778K(28160K)] 55013K->36741K(79360K), 0.0183642 secs] [Times: user=0.06 sys=0.00, real=0.02 secs] 
4.976: [GC [PSYoungGen: 28138K->12745K(29696K)] 52101K->36707K(80896K), 0.0122746 secs] [Times: user=0.06 sys=0.00, real=0.01 secs] 
```

通过其中的PSYoungGen和PSPermGen，可以知道，采用的是新生代Parallel New + 老年代Parallell Old的**吞吐量优先**的组合，让我们来看一下下面这张图：

![](/img/post/2017-09-08-How-I-Increase-Eclipse/collectors.jpg)

两个收集器之间有连线，代表他们可以组合使用，考虑到Eclipse经常需要进行交互，因此吞吐量优先，这种适合后台运行的应用的组合，显得没什么必要，我们可以采用**新生代ParNew** + **老年代CMS**的**降低停顿优先**组合。
>关于吞吐量、停顿时间、垃圾收集器等相关知识的传送门 ：[各有所长的清洁工 -- Java虚拟机的垃圾收集器清单](http://blog.csdn.net/hzy38324/article/details/77411522#t5)

我们往eclipse.ini加入如下配置：
```
-XX:+UseConcMarkSweepGC
-XX:+UseParNewGC
```

接着启动Eclipse，观察Visual VM：

![](/img/post/2017-09-08-How-I-Increase-Eclipse/vsvm03.png)

有点懵逼了，**新生代的GC次数一下子去到了22次，老年代的GC也从一次暴涨到了10次**，不过，虽然GC次数暴涨了，但是垃圾收集的时间并没有增加太多，看来这个组合的收集器还是很给力的，现在我们看一下GC日志，分析一下发生那么多次GC的原因：
```
0.404: [GC0.404: [ParNew: 10944K->1344K(12288K), 0.0061580 secs] 10944K->2856K(39616K), 0.0062909 secs] [Times: user=0.06 sys=0.00, real=0.01 secs] 
0.698: [GC0.698: [ParNew: 12288K->1344K(12288K), 0.0072989 secs] 13800K->5854K(39616K), 0.0073625 secs] [Times: user=0.06 sys=0.00, real=0.01 secs] 
1.051: [GC1.051: [ParNew: 12288K->1344K(12288K), 0.0083077 secs] 16798K->9368K(39616K), 0.0083701 secs] [Times: user=0.00 sys=0.00, real=0.01 secs] 
1.369: [GC1.369: [ParNew: 12288K->1344K(12288K), 0.0082115 secs] 20312K->13721K(39616K), 0.0082795 secs] [Times: user=0.05 sys=0.00, real=0.01 secs] 
1.699: [GC1.699: [ParNew: 12288K->1344K(12288K), 0.0066972 secs] 24665K->16288K(39616K), 0.0067814 secs] [Times: user=0.06 sys=0.00, real=0.01 secs] 
1.706: [GC [1 CMS-initial-mark: 14944K(27328K)] 16460K(39616K), 0.0011819 secs] [Times: user=0.00 sys=0.00, real=0.00 secs] 
1.707: [CMS-concurrent-mark-start]
1.728: [CMS-concurrent-mark: 0.021/0.021 secs] [Times: user=0.05 sys=0.00, real=0.02 secs] 
1.729: [CMS-concurrent-preclean-start]
1.729: [CMS-concurrent-preclean: 0.000/0.000 secs] [Times: user=0.00 sys=0.00, real=0.00 secs] 
1.729: [CMS-concurrent-abortable-preclean-start]
1.786: [GC1.786: [ParNew: 12288K->934K(12288K), 0.0031670 secs] 27232K->16666K(39616K), 0.0032384 secs] [Times: user=0.00 sys=0.00, real=0.00 secs] 
1.832: [GC1.832: [ParNew: 11878K->490K(12288K), 0.0012284 secs] 27610K->16222K(39616K), 0.0013088 secs] [Times: user=0.00 sys=0.00, real=0.00 secs] 
1.869: [GC1.869: [ParNew: 11434K->622K(12288K), 0.0008751 secs] 27166K->16354K(39616K), 0.0009302 secs] [Times: user=0.00 sys=0.00, real=0.00 secs] 
1.902: [GC1.902: [ParNew: 11566K->754K(12288K), 0.0008866 secs] 27298K->16486K(39616K), 0.0009452 secs] [Times: user=0.00 sys=0.00, real=0.00 secs] 
1.934: [GC1.934: [ParNew: 11698K->891K(12288K), 0.0009875 secs] 27430K->16622K(39616K), 0.0010413 secs] [Times: user=0.00 sys=0.00, real=0.00 secs] 
1.966: [GC1.966: [ParNew: 11835K->699K(12288K), 0.0010225 secs] 27566K->16431K(39616K), 0.0011007 secs] [Times: user=0.00 sys=0.00, real=0.00 secs] 
2.079: [CMS-concurrent-abortable-preclean: 0.048/0.350 secs] [Times: user=0.53 sys=0.02, real=0.35 secs] 
2.079: [GC[YG occupancy: 6449 K (12288 K)]2.079: [Rescan (parallel) , 0.0031854 secs]2.082: [weak refs processing, 0.0001384 secs]2.083: [scrub string table, 0.0004222 secs] [1 CMS-remark: 15731K(27328K)] 22180K(39616K), 0.0038528 secs] [Times: user=0.00 sys=0.00, real=0.00 secs] 
2.083: [CMS-concurrent-sweep-start]
2.088: [CMS-concurrent-sweep: 0.005/0.005 secs] [Times: user=0.00 sys=0.00, real=0.01 secs] 
2.088: [CMS-concurrent-reset-start]
2.089: [CMS-concurrent-reset: 0.000/0.000 secs] [Times: user=0.00 sys=0.00, real=0.00 secs] 
2.269: [GC2.269: [ParNew: 11643K->1344K(12288K), 0.0078219 secs] 20634K->13437K(39616K), 0.0078808 secs] [Times: user=0.00 sys=0.00, real=0.01 secs] 
2.484: [GC2.484: [ParNew: 12288K->1344K(12288K), 0.0076834 secs] 24381K->15864K(39616K), 0.0079210 secs] [Times: user=0.01 sys=0.00, real=0.01 secs] 
2.718: [GC2.718: [ParNew: 12095K->1344K(12288K), 0.0085918 secs] 26615K->20205K(39616K), 0.0086568 secs] [Times: user=0.00 sys=0.00, real=0.01 secs] 
2.727: [GC [1 CMS-initial-mark: 18861K(27328K)] 20455K(39616K), 0.0009695 secs] [Times: user=0.00 sys=0.00, real=0.00 secs] 
2.728: [CMS-concurrent-mark-start]
2.777: [CMS-concurrent-mark: 0.048/0.049 secs] [Times: user=0.13 sys=0.00, real=0.05 secs] 
2.777: [CMS-concurrent-preclean-start]
2.778: [CMS-concurrent-preclean: 0.001/0.001 secs] [Times: user=0.00 sys=0.00, real=0.00 secs] 
2.779: [GC[YG occupancy: 3358 K (12288 K)]2.779: [Rescan (parallel) , 0.0007499 secs]2.779: [weak refs processing, 0.0001568 secs]2.780: [scrub string table, 0.0004098 secs] [1 CMS-remark: 18861K(27328K)] 22219K(39616K), 0.0013938 secs] [Times: user=0.00 sys=0.00, real=0.00 secs] 
2.780: [CMS-concurrent-sweep-start]
2.790: [CMS-concurrent-sweep: 0.010/0.010 secs] [Times: user=0.06 sys=0.00, real=0.01 secs] 
2.790: [CMS-concurrent-reset-start]
2.791: [CMS-concurrent-reset: 0.000/0.000 secs] [Times: user=0.00 sys=0.00, real=0.00 secs] 
3.027: [GC3.027: [ParNew: 12288K->1344K(12288K), 0.0070788 secs] 26519K->20052K(39616K), 0.0071626 secs] [Times: user=0.06 sys=0.00, real=0.01 secs] 
3.034: [GC [1 CMS-initial-mark: 18708K(27328K)] 20069K(39616K), 0.0016822 secs] [Times: user=0.00 sys=0.00, real=0.00 secs] 
3.036: [CMS-concurrent-mark-start]
3.080: [CMS-concurrent-mark: 0.044/0.044 secs] [Times: user=0.13 sys=0.00, real=0.04 secs] 
3.080: [CMS-concurrent-preclean-start]
3.081: [CMS-concurrent-preclean: 0.001/0.001 secs] [Times: user=0.00 sys=0.00, real=0.00 secs] 
3.081: [GC[YG occupancy: 3035 K (12288 K)]3.081: [Rescan (parallel) , 0.0014130 secs]3.082: [weak refs processing, 0.0000222 secs]3.082: [scrub string table, 0.0008106 secs] [1 CMS-remark: 18708K(27328K)] 21744K(39616K), 0.0023372 secs] [Times: user=0.00 sys=0.00, real=0.00 secs] 
3.083: [CMS-concurrent-sweep-start]
3.093: [CMS-concurrent-sweep: 0.009/0.009 secs] [Times: user=0.00 sys=0.00, real=0.01 secs] 
3.093: [CMS-concurrent-reset-start]
3.093: [CMS-concurrent-reset: 0.000/0.000 secs] [Times: user=0.00 sys=0.00, real=0.00 secs] 
3.367: [GC3.367: [ParNew: 12288K->1344K(12288K), 0.0092673 secs] 29323K->21524K(40684K), 0.0093494 secs] [Times: user=0.06 sys=0.00, real=0.01 secs] 
3.376: [GC [1 CMS-initial-mark: 20180K(28396K)] 21539K(40684K), 0.0022484 secs] [Times: user=0.00 sys=0.00, real=0.00 secs] 
3.379: [CMS-concurrent-mark-start]
3.440: [CMS-concurrent-mark: 0.061/0.061 secs] [Times: user=0.23 sys=0.02, real=0.06 secs] 
3.440: [CMS-concurrent-preclean-start]
3.442: [CMS-concurrent-preclean: 0.001/0.001 secs] [Times: user=0.00 sys=0.00, real=0.00 secs] 
3.442: [CMS-concurrent-abortable-preclean-start]
3.493: [GC3.493: [ParNew: 12274K->1343K(12288K), 0.0055261 secs] 32455K->23901K(40684K), 0.0056034 secs] [Times: user=0.00 sys=0.00, real=0.01 secs] 
3.696: [GC3.696: [ParNew: 12286K->1344K(12288K), 0.0069481 secs] 34843K->27462K(40876K), 0.0070168 secs] [Times: user=0.06 sys=0.00, real=0.01 secs] 
3.703: [CMS-concurrent-abortable-preclean: 0.060/0.262 secs] [Times: user=0.50 sys=0.01, real=0.26 secs] 
3.704: [GC[YG occupancy: 1572 K (12288 K)]3.704: [Rescan (parallel) , 0.0025590 secs]3.706: [weak refs processing, 0.0001688 secs]3.706: [scrub string table, 0.0008541 secs] [1 CMS-remark: 26118K(28588K)] 27690K(40876K), 0.0036849 secs] [Times: user=0.00 sys=0.00, real=0.00 secs] 
3.707: [CMS-concurrent-sweep-start]
3.717: [CMS-concurrent-sweep: 0.009/0.010 secs] [Times: user=0.00 sys=0.00, real=0.01 secs] 
3.717: [CMS-concurrent-reset-start]
3.717: [CMS-concurrent-reset: 0.000/0.000 secs] [Times: user=0.00 sys=0.00, real=0.00 secs] 
4.034: [GC4.034: [ParNew: 12288K->1344K(12288K), 0.0080462 secs] 36118K->28963K(52008K), 0.0081184 secs] [Times: user=0.00 sys=0.00, real=0.01 secs] 
4.553: [GC4.553: [ParNew: 12288K->1344K(12288K), 0.0073523 secs] 39907K->31479K(52008K), 0.0074360 secs] [Times: user=0.00 sys=0.00, real=0.01 secs] 
4.560: [GC [1 CMS-initial-mark: 30135K(39720K)] 31479K(52008K), 0.0031662 secs] [Times: user=0.03 sys=0.00, real=0.00 secs] 
4.564: [CMS-concurrent-mark-start]
4.676: [CMS-concurrent-mark: 0.100/0.112 secs] [Times: user=0.39 sys=0.00, real=0.11 secs] 
4.676: [CMS-concurrent-preclean-start]
4.677: [CMS-concurrent-preclean: 0.001/0.001 secs] [Times: user=0.00 sys=0.00, real=0.00 secs] 
4.677: [CMS-concurrent-abortable-preclean-start]
5.050: [GC5.050: [ParNew: 12288K->1343K(12288K), 0.0058341 secs] 42423K->32844K(52008K), 0.0059602 secs] [Times: user=0.00 sys=0.00, real=0.01 secs] 
5.425: [GC5.425: [ParNew: 12287K->1344K(12288K), 0.0041361 secs] 43788K->33574K(52008K), 0.0041972 secs] [Times: user=0.00 sys=0.00, real=0.00 secs] 
5.429: [CMS-concurrent-abortable-preclean: 0.144/0.752 secs] [Times: user=2.28 sys=0.27, real=0.75 secs] 
5.429: [GC[YG occupancy: 1443 K (12288 K)]5.429: [Rescan (parallel) , 0.0018369 secs]5.431: [weak refs processing, 0.0001649 secs]5.431: [scrub string table, 0.0007892 secs] [1 CMS-remark: 32230K(39720K)] 33673K(52008K), 0.0028944 secs] [Times: user=0.00 sys=0.00, real=0.00 secs] 
5.432: [CMS-concurrent-sweep-start]
5.447: [CMS-concurrent-sweep: 0.014/0.014 secs] [Times: user=0.03 sys=0.00, real=0.01 secs] 
5.447: [CMS-concurrent-reset-start]
5.447: [CMS-concurrent-reset: 0.000/0.000 secs] [Times: user=0.00 sys=0.00, real=0.00 secs] 
25.095: [GC25.096: [ParNew: 12288K->1344K(12288K), 0.0236873 secs] 39467K->29787K(57588K), 0.0239223 secs] [Times: user=0.05 sys=0.00, real=0.02 secs] 
```
我们看到，**新生代Eden区的容量非常小，只有12288K，约合10m，老年代也同样如此**（而且CMS由于其算法的特殊性，是不会等到老年代全部占满了才进行Full GC的，原因：[CMS收集器](http://blog.csdn.net/hzy38324/article/details/77411522#t13)）。

在笔者12G的机器下，大可以给Eclipse分配多得多的内存，于是将堆的最大容量（-Xmx）设置为1g，初始堆大小（-Xms）也设置为1g，防止运行时自动扩展耗费时间，永久代（-XX:PermSize、-XX:MaxPermSize）设置为256m，新生代（-Xmn）设置为512m。
由于这样设置的话，内存一定是足够的了，因此还可以使用**-XX:+DisableExplicitGC**来防止Eclipse主动调用System.gc():
```
-Xms1024M
-Xmx1024M
-Xmn512M
-XX:PermSize=256M
-XX:MaxPermSize=256M
-XX:+DisableExplicitGC
```

修改完之后，再来启动Eclipse，查看Visual VM:

![](/img/post/2017-09-08-How-I-Increase-Eclipse/vsvm04.png)

可以看到，不管是新生代还是老年代，都不再有GC发生了，再来统计一下启动时间，三次启动分别为4590ms、4710ms、4780ms，取平均值，**进行垃圾收集器优化之后的启动时间是4693ms**。

# 总结
最终调优完成后的eclipse.ini是这样的：
```
-vm
C:/Program Files/Java/jdk1.7.0_51/bin/javaw.exe
-startup
plugins/org.eclipse.equinox.launcher_1.3.0.v20130327-1440.jar
--launcher.library
plugins/org.eclipse.equinox.launcher.win32.win32.x86_64_1.1.200.v20130521-0416
-product
org.eclipse.epp.package.standard.product
--launcher.defaultAction
openFile
--launcher.XXMaxPermSize
128M
-showsplash
org.eclipse.platform
--launcher.XXMaxPermSize
128M
--launcher.defaultAction
openFile
--launcher.appendVmargs
-vmargs
-Dosgi.requiredJavaVersion=1.6
-Xverify:none
-XX:+PrintGCTimeStamps
-XX:+PrintGCDetails
-Xloggc:gc.log
-XX:+UseConcMarkSweepGC
-XX:+UseParNewGC
-Xms40m
-Xmx128M

```
从一开始的5953ms，到最后的4693ms，好吧，我不得不承认省下的这一秒钟启动时间，并不会对我又多大帮助，不过，通过这个例子，我也演示了JVM调优中的一些套路：
-  借助Visual VM或者命令行等工具进行分析；
-  从编译时间、类加载时间、垃圾收集时间三个维度进行优化；
-  根据应用的特点和机器的条件，选择最合适的垃圾收集器组合；
-  分析GC日志，减少GC的次数；

这些调优的思路，都是可以应用到生存环境的。

以上，希望能对你有所帮助。

# 参考内容
- [《深入理解Java虚拟机》][2]
- [Java HotSpot VM Options][3]
- [Java Platform, Standard Edition Troubleshooting Guide - Diagnostic Tools][4]
- [HotSpot Virtual Machine Garbage Collection Tuning Guide][5] 
- [Tuning Java Virtual Machines (JVMs)][6] 


  [1]: http://blog.csdn.net/hzy38324/article/details/77799115
  [2]: https://www.amazon.cn/%E5%9B%BE%E4%B9%A6/dp/B00D2ID4PK/ref=redir_mobile_desktop?ie=UTF8&pi=SS115
  [3]: http://www.oracle.com/technetwork/articles/java/vmoptions-jsp-140102.html
  [4]: http://docs.oracle.com/javase/8/docs/technotes/guides/troubleshoot/tooldescr.html#diagnostic_tools
  [5]: http://docs.oracle.com/javase/8/docs/technotes/guides/vm/gctuning/
  [6]: https://docs.oracle.com/cd/E13222_01/wls/docs81/perform/JVMTuning.html