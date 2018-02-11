---
layout:     post                    # 使用的布局（不需要改）
title:      Volatile趣谈——我是怎么把贝克汉姆的进球弄丢的               # 标题 
subtitle:    #副标题
date:       2018-02-10              # 时间
author:     ZY                      # 作者
header-img: img/banner/funny-volatile.jpeg    #这篇文章标题背景图片
catalog: true                       # 是否归档
tags:                               #标签
    - Java
    - Concurrency
---
# 大雄的门线传感器
大雄公司最近在给国际足球协会研制一款门线传感器。这可是一个大单，组织特地安排了大雄作为首席程序员，开发这款软件。    
需求很简单，传感器需要在皮球越过门线的时候，给裁判身上的耳麦发送消息，告诉裁判球进了。  
“So easy”，大雄四两拨千斤地写了一个进球通知线程：
```java
public class GoalNotifier implements Runnable {
    public boolean goal = false;

    public boolean isGoal() {
        return goal;
    }

    public void setGoal(boolean goal) {
        this.goal = goal;
    }

    @Override
    public void run() {
        while (true) {
            if (isGoal()) {
                System.out.println("Goal !!!!!!");

                // Tell the referee the ball is in.
                // ...

                // reset goal flag
                setGoal(false);
            }
        }
    }
}
```
“只要在比赛一开始就启动这个线程，然后当球越过球门线的时候，调用我的setGoal()方法，把进球标志goal设置成true就OK了”，大雄对着投影里的代码，跟产品经理胖虎讲解着自己伟大的设计。  
“很棒！代码写的非常简洁，设计非常优雅，连我都看不出有什么Bug。静香，不用浪费时间测试了，直接上线吧，时间就是金钱，我们要敢在别的竞争对手之前，推出这款产品！”，胖虎激动的说，唾沫横飞。  
“好的，我也相信大雄的能力！”，静香含情脉脉的看着大雄，眼里都是崇拜。  

# Oop! Bug!
很快，大雄的门线传感器上线了。英格兰足协老总约翰是个很喜欢新科技的人，他迫不及待地想把这项技术推广到他的国家。  
这天，有一场让世界瞩目的友谊赛——曼联传奇队 vs 阿森纳传奇队。“把我们刚刚买过来的门线技术用上去，让这群老家伙见识一下什么是高科技！”，约翰说。  

比赛开始，刚开场，只见鲁尼把球往旁边一拨，贝克汉姆就顺势一脚圆月弯刀，皮球划出一道美丽的弧线，飞过大半个足球场，阿森纳门将始料不及，只能目送皮球应声入网！  

这个过程之迅猛，只能用下面这段代码来描述了：  
```java
public class Game {

    public static void main(String[] args) throws InterruptedException {
        // Game begun! Init goalNotifier thread
        GoalNotifier goalNotifier = new GoalNotifier();
        Thread goalNotifierThread = new Thread(goalNotifier);
        goalNotifierThread.start();

        // After 3s
        Thread.sleep(3000);
        // Goal !!!
        goalNotifier.setGoal(true);
    }

}
```
就在曼联队队员抱在一起庆祝的时候，裁判跑了过来，宣布进球无效，原因是门线传感器没有提示他进球了。。。  
“What ???”，贝克汉姆一脸懵逼。。。  
“大雄，怎么回事？？？”，约翰气冲冲的对旁边的大雄说。  
“啊，难道是线程没起来吗？”，大雄也是一脸懵逼，“我加了日志的，看一下后台就知道了！”  
于是大雄登录了后台服务器，查看了日志信息：  
![](/img/post/2018-02-10-Funny-Volatile/no-log.png)
“啊，一行日志都没有。。。”，大雄很慌，“看来只能求助哆啦了。。。”  

大雄赶紧视频了正在日本度假的哆啦，视频里，哆啦一边喝着大阪清酒，一边看着大雄的代码，大概过了十秒钟，突然挂断了视频。  
“难道连哆啦也没有办法了。。”，就在大雄绝望的时候，他突然收到哆啦发来的信息，打开一看，里面就一个词：  
**volatile**    

“啊，难道是它。。。”，来不及想太多了，贝克汉姆随时都会再进球，“不能让我贝失望啊”，大雄赶紧改了一行代码：  
```java
public class GoalNotifier implements Runnable {
//    public boolean goal = false;
    public volatile boolean goal = false;
    ...  
```
刚改完代码，这边曼联队就得到一个禁区外任意球的机会，贝克汉姆一记招牌的圆月弯刀，皮球直挂死角！不过这次，大家都没庆祝，而是一致看向了裁判，全场鸦雀无声。。。  
突然，主席台那里，有一个像逗比一样的青年，大声的吼着，“Yeah!!! 日志打印出来了！！！”，声音之大，响彻全场。  
![](/img/post/2018-02-10-Funny-Volatile/log.png)
过了大概两秒钟，人们才看到裁判把手指向了中圈，示意进球有效。。。  

# volatile和Java内存模型
“为什么把goal变量加上volatile修饰符，问题就解决了呢？”，带着这个疑问，大雄开始研究了起来。渐渐的，他认识到，看Java代码，不能只看表象，还要透过Java虚拟机，去看透本质。**从JavaSE到JVM，这是一场认知的跃迁**。  

首先要解决的问题是，不加volatile之前，main函数明明调用了setGoal()方法，把goal改成了true，可为什么GoalNotifier线程里的goal还是false？  
答案是，主线程里调用setGoal()方法修改的goal，和GoalNotifier线程里的goal，是两个**副本**。  
What??? 变量还有副本？  
单看代码，自然是看不出“副本”的，我们必须剥开代码这层皮，到Java虚拟机里头去看看。  

在介绍JVM中的“副本”之前，我们先来简单聊聊物理机的“副本”，因为JVM的副本和物理机的副本很像。 
计算机，相比于处理器的运算速度，**IO操作的速度往往有几个数量级的差距**，因此像下面这段常见的++运算：  
```java
int count = 0;
...
count ++;
```
如果计算机把count的值存储在内存中，那么每次++操作，就有一次从内存中读取i的值的操作，以及一次把i的值加1的操作，别忘了，还有一次把i的值写进去内存的操作：  
T(一次循环) = T(读IO) + T(+1运算) + T(写IO)  
而IO操作的速度往往比运算速度多几个数量级，所以：  
T(一次循环) ≈ T(读IO) + T(写IO)  
显然，IO操作的速度严重拖后腿了，**不管运算速度再快，只要IO操作还在，这个++操作的速度就永远由IO操作的速度决定**。  
我们人类自然不允许这样的情况发生，因此我们在处理器和内存之间，引入了读写速度接近处理器运算速度的一层**高速缓存**：  
![CPU、高速缓存和内存](/img/post/2018-02-10-Funny-Volatile/cpumemory.png)
这样，在上面的++操作里面，count变量只有在初始化的时候，需要写入主内存，接着，count就被从主内存拷贝到处理器的高速缓存中，下次再想对它执行++操作时，直接从高速缓存中读取就可以了，++操作执行完之后，也不需要马上同步到主内存。  

虽然各种平台都会有高速缓存和主内存，但是不同平台的内存模型并不完全相同。这也就导致了像C/C++这种直接使用物理机内存模型的编程语言，有时候一份代码在一个平台上可以正常运行，去到另一个平台就挂了，所以需要“面向平台”编程。而Java，正如广告语说的，“Write once, run anywhere”，相同的一份代码，去到哪个平台都可以直接拿过去用。  
为什么Java这么神奇呢？这自然是JVM的功劳，你下载JDK的时候，会让你选择是Windows还是Linux的。使用不同平台的JDK，最大的差异就是JVM了，相同的一份代码，Windows版的JVM帮你把代码翻译成Windows系统能识别的机器语言，Linux版的JVM则翻译成Linux的语言。  
**JVM帮你屏蔽了不同平台直接的差异**。  
自然的，对于物理机的内存模型，JVM也要进行“介入”，我们编写的Java代码，是不会直接去操作物理机的内存的，而是去操作JVM定义的**Java内存模型**（Java Memory Model, JMM），再通过JMM去操作物理机的内存。  
Java的内存模型和上面讲的物理机的内存模型非常类似：  
![Java内存模型](/img/post/2018-02-10-Funny-Volatile/JMM.png)
现在再回过头来看大雄碰到的问题：main函数明明调用了setGoal()方法，把goal改成了true，可为什么GoalNotifier线程里的goal还是false？  
答案已经很明确了，这里面有两个线程，main函数所在的是主线程和GoalNotifier线程，这两个线程都分别从主内存从拷贝了一个goal变量的副本，所以当main函数调用setGoal()方法修改goal时，**修改的其实是自己线程工作空间上的那个副本goa**l，对主内存的goal没有影响，对GoalNotifier线程的goal副本更加没有影响，GoalNotifier线程自然就感知不到goal变成true了。  

那么，要怎样才能让GoalNotifier线程，能够感知到main函数修改了goal呢？  
很简单嘛，让main函数修改了goal之后**主动同步**到主内存，并且让GoalNotifier线程在读取goal的之前，主动从主内存去取goal，事实上，这就是volatile的原理。  

# volatile的内幕
那么volatile是如何让修改的变量立刻同步到主内存的呢？  
同样，单看代码是看不出来的，volatile只是我们告诉JVM的一个标志，那么JVM对于有volatile和没有volatile的代码，在翻译成**机器指令**时，会有什么不同呢？  

有同学会建议用javap命令反汇编查看一下，如果你也这么想，那现在我直接告诉你，不可以，至于为什么，你可以先自行研究，我将在后面单独用一篇文章讨论。  
在这里我们要使用**JIT级别**的**反汇编**命令，原因同样不在这里赘述。下面简单介绍一下方法。  
加入如下虚拟机参数：  
```
-XX:+UnlockDiagnosticVMOptions -Xcomp -XX:+PrintAssembly -XX:CompileCommand=compileonly,*GoalNotifier.setGoal
```

-XX:+UnlockDiagnosticVMOptions -XX:+PrintAssembly：开启JIT反汇编  
-Xcomp：让虚拟机以编译模式执行代码，使得JIT编译可以立即触发
-XX:CompileCommand=compileonly,\*GoalNotifier.setGoal：只反汇编GoalNotifier的setGoal方法  

然后执行两次代码，一次加入volatile修饰符，一次不加，把两次控制台打印的汇编语言，放到文件对比工具上对比一下，打印的信息很多，但是通过文件对比工具，我们可以很清楚的看到，加了volatile的代码中，多了一行代码：
![](/img/post/2018-02-10-Funny-Volatile/compare.png)
这行“lock add dword ptr”的代码是干什么用的呢？关键在于lock，这个lock不是指令，而是指令前缀，我对汇编语言不熟悉，这里借用《深入学习Java虚拟机》里的解释：“lock的作用是使得本CPU的Cache写入内存，同时使其他CPU的Cache无效”，其实也就是我们上面讲的，将修改后的变量主动同步到主内存。  

> 加了虚拟机参数后，运行的时候你可能会看到错误提示，别慌，很容易解决。另外，我把我做实验生成的两份汇编语言以及其他代码上传到[Github](https://github.com/hzy38324/Coding-Pratice/tree/master/CodePractice/src/main/java/com/sexycode/codepractice/volatilePractice)了，有兴趣的同学可以下载下来研究。  

# 总结
对于volatile这个关键字，可能大家都听过很多遍，但是由于实际中很少用到，所以大多不太了解其背后的原理。这次通过对volatile的介绍，顺带讲解了Java内存模型，同时也看到了Java虚拟机在Java中的扮演的地位，还是那句话，**看Java代码，不能只看表象，还要透过Java虚拟机，去看透本质。从JavaSE到JVM，这是一场认知的跃迁**。  

这篇文章与其说是讲volatile，不如说是讲JVM。对volatile的介绍也只提到了它在**可见性**上的作用，volatile的另一个作用——**禁止指令重排**，并没有提及，毕竟指令重排是个很高深的家伙，我也将在后面的文章中和大家一起探讨。  

祝大家春节快乐！


# 参考
- 《深入理解Java虚拟机》
- 《Java并发编程实践》
- [what-does-the-lock-instruction-mean-in-x86-assembly](https://stackoverflow.com/questions/8891067/what-does-the-lock-instruction-mean-in-x86-assembly)
- [IA-32 Assembly Language Reference Manual - LOCK Prefix](https://docs.oracle.com/cd/E19455-01/806-3773/instructionset-128/index.html)
- [How to build hsdis-amd64.dll and hsdis-i386.dll on Windows](https://dropzone.nfshost.com/hsdis.htm)
- [how-to-see-jit-compiled-code-in-jvm](https://stackoverflow.com/questions/1503479/how-to-see-jit-compiled-code-in-jvm)
