---
layout:     post                    # 使用的布局（不需要改）
title:     Java第一课              # 标题 
subtitle:   #副标题
date:       2018-06-10              # 时间
author:     ZY                      # 作者
header-img: img/banner/java-hello-world.png    #这篇文章标题背景图片
catalog: true                       # 是否归档
tags:                               #标签
    - Java
    - JVM
---
# 你的解释不是我想要的

“同学们好，我是教授你们Java101课程的S老师。下面开始我们的第一堂课吧。”  

“Java安装、编辑器安装、以及运行起hello world代码，我已经在课前预习邮件里，告诉大家要怎么做了，不知道大家完成的怎么样？”   

“老师，您的邮件里就一句话，‘请自行Google’ ...”  

“没错。”  

其实我内心OS是：如果台下大部分学生，都完成不了预习任务，嗯，那这门课又开不成了，我又可以安心做研究。  

不过为了让这个故事继续下去，我们姑且假设大部分学生都完成了预习任务吧。  

“嗯，同学们很出色，下面再来一起看看这两段Hello World代码”  

HelloWorld-1:  
```java
public class HelloWorld {
    public static void main(String[] args) {
        int i = 0;
        i = i++;
        System.out.println(i);
    }
}
```

HelloWorld-2:  
```java
public class HelloWorld {
    public static void main(String[] args) {
        int i = 0;
        i = ++i;
        System.out.println(i);
    }
}
```

“相信大家也都知道运行结果了，**第一段代码是0，第二段代码是1**。好，我们的第一堂课就是这样，大家还有什么疑问吗？”  

大概过了半分钟，台下有个同学问道，“老师，我想知道为什么？为什么只是换了下顺序，结果就不一样了？”  

这是我期待已久的问题，对，就是简简单单三个字，“为什么”  

旁边一同学，说道，“这个我知道。i =i++，会先赋值，再加一，所以结果是0，而i = ++i，会先把i加一，然后再赋值，所以结果是1”  

全场感叹，都向那位同学投以敬佩的目光，毕竟他的理论足以解释现象。  

唯有刚刚提问的同学，说了一句，“**你的解释不是我想要的**......”  

# 翻译官

这堂Java第一课的高潮终于到来了，我很激动。 

刚刚这位同学的解释，不可谓不对，但是终究没说到点上。   

i =i++，会先赋值，再加一，所以结果是0，**这个解释很正确，但是理由在哪？**  

**这只是你的片面之词呢？还是道听途说所得？这个解释不足以服众。**    

你写的代码，是高级语言，是给人看的，机器可看不懂。  

所以在你写的代码，到机器开始执行中间，肯定有一个翻译的过程。  

**Java中，这个翻译的动作，是由JVM，Java虚拟机来完成。**  

大家都知道Java是跨平台的，所谓“Write Once, Run Anywhere”, 同样一份代码，可以在不同的平台上运行，不像别的语言，比如C，也许这段代码在Linux上正常，去到OS X就有Bug了。  

那么Java是如何实现跨平台的呢？简单说，靠的就是JVM这个翻译官。  

你写好的代码，会被编译成一个.class文件，也就是Java字节码文件，这里面记录的是一系列要在JVM执行的指令。  

接着，你拿着这份字节码指令，去到任意一个JVM，Linux的JVM也好，OS X的也好，它们都会帮你把它翻译成对于平台的机器指令。这就实现了跨平台、  

**Java字节码是国际通用语言（英语），JVM是翻译官。**  

# 反汇编

回到我们的问题，++i和i++为什么会不一样呢？  

这就要看这两行高级语言代码，转成字节码指令之后是什么样子了。    

先来看看HelloWorld-1。首先使用javac把你写的高级语言，也就是java文件，编译成字节码文件。我已经把源代码中的System.out.println(i)删掉，这样我们就可以专心观察i++和++i：  
```
javac HelloWorld.java
```
可以看到HelloWorld.java同级目录下，出现了一个HelloWorld.class文件。  

class文件里面都是二进制的数据。为什么是二进制？因为这些都是告诉JVM要做什么事情的指令，而机器只看得懂0101之类的二进制。  

所以，我们需要对这个二进制数据，进行反汇编，把它变成人类看得懂的语言，来看看这些二进制数据都在说些什么，这里我们用到javap：  
```
javap -c HelloWorld.class
```
命令执行后，控制台打印出一系列的字节码指令，其中main函数的字节码指令如下：  
```
  public static void main(java.lang.String[]);
    Code:
       0: iconst_0
       1: istore_1
       2: iload_1
       3: iinc          1, 1
       6: istore_1
       7: return
```
这一串的指令，主要涉及到两个数据结构，**一个是操作数栈（operand stack），另一个是局部变量表（local variable）。前者是栈，后者是数组。**    

那么这些指令都是什么意思？  

不急，下面图文并茂，给你解释。  

# 栈和数组的故事

1、iconst_0  
把一个值为0的int值，压到操作数栈中。  

![](/img/post/2018-06-10-Java-HelloWorld/ol-1.png) 

2、istore_1  
从操作数栈中弹出一个值，存放到局部变量表index为1的位置（为什么不是0，思考题）  

pop之前：  
![](/img/post/2018-06-10-Java-HelloWorld/ol-2.png) 

pop之后：  
![](/img/post/2018-06-10-Java-HelloWorld/ol-2-2.png) 

以上两条指令对应的是第一行代码 int i = 0：

它实现了给i赋值，并且把i放到局部变量表的功能。  

下面再来看看 i = i++ 对应的指令。  

3、iload_1  
把局部变量表中，index=1位置的值，压到操作数栈中。  

![](/img/post/2018-06-10-Java-HelloWorld/ol-3.png) 

4、iinc 1, 1  
对局部变量表index=1位置的值，进行加1操作。  

![](/img/post/2018-06-10-Java-HelloWorld/ol-4.png) 

iinc指令包含两个参数：  

- 第一个是index，代表要操作是局部变量表哪个位置的值；
- 第二个是const，代表要加多少；

现在局部变量表里的i其实是等于1的，可是为什么最后打印出来还是0呢？  

问题出在最后一条指令。  

5、istore_1  
从操作数栈中弹出一个值，将它赋值给局部变量表中，index为1位置上的值。  

pop之前：
![](/img/post/2018-06-10-Java-HelloWorld/ol-5.png) 

pop之后：
![](/img/post/2018-06-10-Java-HelloWorld/ol-5-2.png) 

完蛋，这下i又变成0了。  

至于 i = ++i为什么最后是1 ，请大家按照上面的思路，自行分析。  

其实两者的差别只在iload_1和iinc 1, 1的顺序上。  

i = ++i，iinc 1, 1在前，iload_1在后，所以最后结果是1.  

上面这些指令的含义，不需要刻意去记，有JVM规范可以查看：[The Java Virtual Machine Instruction Set](https://docs.oracle.com/javase/specs/jvms/se7/html/jvms-6.html)

这堂课提到的操作数栈和局部变量表，只是JVM运行时数据区域中，很小的一块，完整的模型图是这样：  
![](/img/post/2018-06-10-Java-HelloWorld/jmm.jpg) 

操作数栈和局部变量表，位于图中的JVM Stack中，也就是我们常说的虚拟机栈。  

# End

这堂课的重点，并不在于跟大家解释i++和++i的区别，而是要给大家引入一个Java中十分重要的观察角度——JVM.   

你写的代码，只是表象，程序不一定按照表象去执行。  

万一发现很奇怪的现象了，莫慌，别忘了中间还有个JVM在作祟。  

......  

忽然，闹钟响了。  

“傻蛋，怎么老是做这个梦。你早就因为开不了课被大学辞退了。”  

起床，刷牙洗脸，上班。  

今天又会有什么好玩的需求？        

# 参考

- [The Java Virtual Machine Instruction Set](https://docs.oracle.com/javase/specs/jvms/se7/html/jvms-6.html)
- 《文学回忆录》


