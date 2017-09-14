---
layout:     post                    # 使用的布局（不需要改）
title:      为什么说Java匿名内部类是残缺的闭包               # 标题 
subtitle:   总有那么些十分基础的知识点，值得好好研究 #副标题
date:       2017-09-14              # 时间
author:     ZY                      # 作者
header-img: img/banner/anonymous-class-and-final.jpg    #这篇文章标题背景图片
catalog: true                       # 是否归档
tags:                               #标签
    - Java
---
# 前言
我们先来看一道很简单的小题：
```java
public class AnonymousDemo1
{
    public static void main(String args[])
    {
        new AnonymousDemo1().play();
    }

    private void play()
    {
        Dog dog = new Dog();
        Runnable runnable = new Runnable()
        {
            public void run()
            {
                while(dog.getAge()<100)
                {
                    // 过生日，年龄加一
                    dog.happyBirthday();
                    // 打印年龄
                    System.out.println(dog.getAge());
                }
            }
        };
        new Thread(runnable).start();
        
        // do other thing below when dog's age is increasing
        // ....
    }
}
```
其中Dog类是这样的：
```java
public class Dog
{
    private int age;

    public int getAge()
    {
        return age;
    }

    public void setAge(int age)
    {
        this.age = age;
    }

    public void happyBirthday()
    {
        this.age++;
    }
}
```
这段程序的功能非常简单，就是启动一个线程，来模拟一只小狗不断过生日的一个过程。

不过，这段代码并不能通过编译，为什么，仔细看一下！  
.    
.  
.  
.  
.  
.  
看出来了吗？是的，play()方法中，**dog变量要加上final修饰符**，否则会提示：
> Cannot refer to a non-final variable dog inside an inner class defined in a different method

加上final后，编译通过，程序正常运行。
但是，**这里为什么一定要加final呢？**
学Java的时候，我们都听过这句话（或者类似的话）：

> 匿名内部类来自**外部闭包环境**的**自由变量**必须是final的

那时候一听就懵逼了，什么是闭包？什么叫自由变量？最后不求甚解，反正以后遇到这种情况就加个final就好了。  
显然，这种对待知识的态度是不好的，必须“知其然并知其所以然”，最近就这个问题做了一番研究，希望通过比较通俗易懂的言语分享给大家。

> 我们学框架、看源码、学设计模式、学并发编程、学缓存，甚至了解大型网站架构设计，可回过头来看看一些非常简单的Java代码，却发现还有那么几个旮旯，是自己没完全看透的。

# 匿名内部类的真相
既然不加final无法通过编译，那么就加上final，成功编译后，查看class文件反编译出来的结果。  
在class目录下面，我们会看到有两个class文件：AnonymousDemo1.class和AnonymousDemo1\$1.class，其中，带美元符号\$的那个class，就是我们代码里面的那个匿名内部类。接下来，使用 [jd-gui][1] 反编译一下，查看这个匿名内部类：
```java
class AnonymousDemo1$1
  implements Runnable
{
  AnonymousDemo1$1(AnonymousDemo1 paramAnonymousDemo1, Dog paramDog) {}
  
  public void run()
  {
    while (this.val$dog.getAge() < 100)
    {
      this.val$dog.happyBirthday();
      
      System.out.println(this.val$dog.getAge());
    }
  }
}
```
这代码看着不合常理：

- 首先，构造函数里传入了两个变量，一个是AnonymousDemo1类型的，另一个是Dog类型，但是方法体却是空的，看来是反编译时遗漏了；
- 再者，run方法里this.val$dog这个成员变量并没有在类中定义，看样子也是在反编译的过程中遗漏掉了。

既然 jd-gui 的反编译无法完整的展示编译后的代码，那就只能使用 [javap][2] 命令来反汇编了，在命令行中执行：
```
javap -c AnonymousDemo1$1.class
```
执行完命令后，可以在控制台看到一些汇编指令，这里主要看下内部类的构造函数：
```
com.bridgeforyou.anonymous.AnonymousDemo1$1(com.bridgeforyou.anonymous.Anonymo
usDemo1, com.bridgeforyou.anonymous.Dog);
    Code:
       0: aload_0
       1: aload_1
       2: putfield      #14                 // Field this$0:Lcom/bridgeforyou/an
onymous/AnonymousDemo1;
       5: aload_0
       6: aload_2
       7: putfield      #16                 // Field val$dog:Lcom/bridgeforyou/a
nonymous/Dog;
      10: aload_0
      11: invokespecial #18                 // Method java/lang/Object."<init>":
()V
      14: return
```
这段指令的重点在于第二个**putfield**指令，结合注释，我们可以知道，**构造器函数将传入的dog变量赋值给了另一个变量**，现在，我们可以手动填补一下上面那段信息遗漏掉的反编译后的代码：
```java
class AnonymousDemo1$1
  implements Runnable
{
  private Dog val$dog;
  private AnonymousDemo1 myAnonymousDemo1;
  
  AnonymousDemo1$1(AnonymousDemo1 paramAnonymousDemo1, Dog paramDog) {
	this.myAnonymousDemo1 = paramAnonymousDemo1;
	this.val$dog = paramDog;
  }
  
  public void run()
  {
    while (this.val$dog.getAge() < 100)
    {
      this.val$dog.happyBirthday();
      
      System.out.println(this.val$dog.getAge());
    }
  }
}
```

至于外部类AnonymousDemo1，则是**把dog变量传递给AnonymousDemo1$1的构造器，然后创建一个内部类的实例**罢了，就像这样：
```java
public class AnonymousDemo1
{
  public static void main(String[] args)
  {
    new AnonymousDemo1().play();
  }
  
  private void play()
  {
    final Dog dog = new Dog();
    Runnable runnable = new AnonymousDemo1$1(this, dog);
    new Thread(runnable).start();
  }
}
```
> 关于Java汇编指令，可以参考 [Java bytecode instruction listing][3]s

到这里我们已经看清匿名内部类的全貌了，其实Java就是把外部类的一个变量拷贝给了内部类里面的另一个变量。  
我之前在 [用画小狗的方法来解释Java值传递][4] 这篇文章里提到过，Java里面的变量都不是对象，这个例子中，无论是内部类的val$dog变量，还是外部类的dog变量,他们都只是一个存储着对象实例地址的变量而已，而由于做了拷贝，这两个变量指向的其实是同一只狗（对象）。

![](/img/post/2017-09-14-Anonymous-Class-and-Final/bind-to-the-same.png)

那么为什么Java会要求外部类的dog一定要加上final呢？  
一个被final修饰的变量：

- 如果这个变量是基本数据类型，那么它的值不能改变；
- 如果这个变量是个指向对象的引用，那么它所指向的地址不能改变。

> 关于final，维基百科说的非常清楚 [final (Java) - Wikipedia][5]

因此，这个例子中，假如我们不加上final，那么我可以在代码后面加上这么一句dog = new Dog(); 就像下面这样：
```java
// ...
new Thread(runnable).start();

// do other thing below when dog's age is increasing
dog = new Dog();
```
这样，外面的dog变量就指向另一只狗了，而内部类里的val$dog，还是指向原先那一只，就像这样：

![](/img/post/2017-09-14-Anonymous-Class-and-Final/bind-diff.png)

这样做导致的结果就是**内部类里的变量和外部环境的变量不同步，指向了不同的对象**。  
因此，编译器才会要求我们给dog变量加上final，防止这种不同步情况的发生。

# 为什么要拷贝
现在我们知道了，是由于一个拷贝的动作，使得内外两个变量无法实时同步，其中一方修改，另外一方都无法同步修改，因此要加上final限制变量不能修改。  

那么为什么要拷贝呢，不拷贝不就没那么多事了吗？  

这时候就得考虑一下Java虚拟机的运行时数据区域了，dog变量是位于方法内部的，因此dog是在虚拟机栈上，也就意味着这个变量无法进行共享，匿名内部类也就无法直接访问，因此只能通过值传递的方式，传递到匿名内部类中。 

那么有没有不需要拷贝的情形呢？有的，请继续看。

# 一定要加final吗
我们已经理解了要加final背后的原因，现在我把原来在函数内部的dog变量，往外提，“提拔”为类的成员变量，就像这样：
```java
public class AnonymousDemo2
{
    private Dog dog = new Dog();

    public static void main(String args[])
    {
        new AnonymousDemo2().play();
    }

    private void play()
    {
        Runnable runnable = new Runnable()
        {
            public void run()
            {
                while (dog.getAge() < 100)
                {
                    // 过生日，年龄加一
                    dog.happyBirthday();
                    // 打印年龄
                    System.out.println(dog.getAge());
                }
            }
        };
        new Thread(runnable).start();

        // do other thing below when dog's age is increasing
        // ....
    }
}
```
这里的dog成了成员变量，对应的在虚拟机里是在堆的位置，而且无论在这个类的哪个地方，我们只需要通过 this.dog，就可以获得这个变量。因此，在创建内部类时，无需进行拷贝，甚至都无需将这个dog传递给内部类。  

通过反编译，可以看到这一次，内部类的构造函数只有一个参数：
```java
class AnonymousDemo2$1
  implements Runnable
{
  AnonymousDemo2$1(AnonymousDemo2 paramAnonymousDemo2) {}
  
  public void run()
  {
    while (AnonymousDemo2.access$0(this.this$0).getAge() < 100)
    {
      AnonymousDemo2.access$0(this.this$0).happyBirthday();
      
      System.out.println(AnonymousDemo2.access$0(this.this$0).getAge());
    }
  }
}
```
在run方法里，是直接通过AnonymousDemo2类来获取到dog这个对象的，结合javap反汇编出来的指令，我们同样可以还原出代码：
```java
class AnonymousDemo2$1
  implements Runnable
{
  private AnonymousDemo2 myAnonymousDemo2;
  
  AnonymousDemo2$1(AnonymousDemo2 paramAnonymousDemo2) {
	this.myAnonymousDemo2 = paramAnonymousDemo2;
  }
  
  public void run()
  {
    while (this.myAnonymousDemo2.getAge() < 100)
    {
      this.myAnonymousDemo2.happyBirthday();
      
      System.out.println(this.myAnonymousDemo2.getAge());
    }
  }
}
```
相比于demo1，demo2的dog变量具有"天然同步"的优势，因此就无需拷贝，因而编译器也就不要求加上final了。

# 回看那句经典的话
上文提到了这句话 —— “匿名内部类来自外部闭包环境的自由变量必须是final的”，一开始我不理解，所以看着很蒙圈，现在再来回看一下：  

首先，**自由变量**是什么？  
一个函数的“自由变量”就是**既不是函数参数也不是函数内部局部变量**的变量，这种变量一般处于函数运行时的**上下文**，就像demo中的dog，有可能第一次运行时，这个dog指向的是age是10的狗，但是到了第二次运行时，就是age是11的狗了。  

然后，**外部闭包环境**是什么？  
**外部环境如果持有内部函数所使用的自由变量，就会对内部函数形成“闭包”**，demo1中，外部play方法中，持有了内部类中的dog变量，因此形成了闭包。  
当然，demo2中，也可以理解为是一种闭包，如果这样理解，那么这句经典的话就应该改为这样更为准确：

> 匿名内部类来自外部闭包环境的自由变量必须是final的，**除非自由变量来自类的成员变量**。

# 对比JavaScript的闭包
从上面我们也知道了，**如果说Java匿名内部类时一种闭包的话，那么这是一种有点“残缺”的闭包，因为他要求外部环境持有的自由变量必须是final的。**

而对于其他语言，比如C#和JavaScript，是没有这种要求的，而且内外部的变量可以自动同步，比如下面这段JavaScript代码（运行时直接按F12，在打开的浏览器调试窗口里，把代码粘贴到Console页签，回车就可以了）：
```javascript
function fn() {
    var myVar = 42;
    var lambdaFun = () => myVar;
    console.log(lambdaFun()); // print 42
    myVar++;
    console.log(lambdaFun()); // print 43
}
fn();
```
这段代码使用了lambda表达式（Java8也提供了，后面会介绍）创建了一个函数，函数直接返回了myVar这个外部变量，在创建了这个函数之后，对myVar进行修改，可以看到函数内部的变量也同步修改了。  
应该说，这种闭包，才是比较“正常“和“完整”的闭包。

# Java8之后的变动
在JDK1.8中，也提供了lambda表达式，使得我们可以对匿名内部类进行简化，比如这段代码：
```java
int answer = 42;
Thread t = new Thread(new Runnable() {
    public void run() {
        System.out.println("The answer is: " + answer);
   }
});
```
使用lambda表达式进行改造之后，就是这样：
```java
int answer = 42;
Thread t = new Thread(
    () -> System.out.println("The answer is: " + answer)
);
```
值得注意的是，**从JDK1.8开始，编译器不要求自由变量一定要声明为final**，如果这个变量在后面的使用中**没有发生变化**，就可以通过编译，Java称这种情况为“**effectively final**”。  
上面那个例子就是“effectively final”，因为answer变量在定义之后没有变化，而下面这个例子，则无法通过编译：
```java
int answer = 42;
answer ++; // don't do this !
Thread t = new Thread(
   () -> System.out.println("The answer is: " + answer)
);
```

# 花絮
在研究这个问题时，我在StackOverflow参考了这个问题：[Cannot refer to a non-final variable inside an inner class defined in a different method][6]

其中一个获得最高点赞、同时也是被采纳的回答，是这样解释的：

> When the main() method returns, local variables (such as lastPrice and price) will be cleaned up from the stack, so they won't exist anymore after main() returns.
    But the anonymous class object references these variables. Things would go horribly wrong if the anonymous class object tries to access the variables after they have been cleaned up.
    By making lastPrice and price final, they are not really variables anymore, but constants. The compiler can then just replace the use of lastPrice and price in the anonymous class with the values of the constants (at compile time, of course), and you won't have the problem with accessing non-existent variables anymore.

大致的意思是：由于外部的变量会在方法结束后被销毁，因此要将他们声明为final常量，这样即使外部类的变量销毁了，内部类还是可以使用。  

这么浅显、无根无据的解释居然也获得了那么多赞，后来评论区有人指出了错误，回答者才在他的回答里加了一句：

> edit - See the comments below - the following is not a correct explanation, as KeeperOfTheSoul points out.

可见，看待一个问题时，不能只从表面去解释，要解释一个问题，必须弄清背后的原理。

# 参考内容

- [Cannot refer to a non-final variable inside an inner class defined in a different method][7]
- [Why a non-final "local" variable cannot be used inside an inner class, and instead a non-final field of the enclosing class can?][8]
- [Captured variable in a loop in C#][9]
- [Java 8 Lambda Limitations: Closures - DZone Java][10]
- [Difference between final and effectively final][11]
- [final (Java) - Wikipedia][12]
- [java为什么匿名内部类的参数引用时final？][13]
- [Java bytecode instruction listings][14]
- [What are Free and Bound variables?][15]


  [1]: http://jd.benow.ca/
  [2]: https://docs.oracle.com/javase/8/docs/technotes/tools/windows/javap.html
  [3]: https://en.wikipedia.org/wiki/Java_bytecode_instruction_listings
  [4]: http://bridgeforyou.cn/2017/09/10/Explain-Java-Pass-by-Value-in-a-Humorous-Way/
  [5]: https://en.wikipedia.org/wiki/Final_%28Java%29
  [6]: https://stackoverflow.com/questions/1299837/cannot-refer-to-a-non-final-variable-inside-an-inner-class-defined-in-a-differen
  [7]: https://stackoverflow.com/questions/1299837/cannot-refer-to-a-non-final-variable-inside-an-inner-class-defined-in-a-differen
  [8]: https://stackoverflow.com/questions/5801829/why-a-non-final-local-variable-cannot-be-used-inside-an-inner-class-and-inste
  [9]: https://stackoverflow.com/questions/271440/captured-variable-in-a-loop-in-c-sharp
  [10]: https://dzone.com/articles/java-8-lambas-limitations-closures
  [11]: https://stackoverflow.com/questions/20938095/difference-between-final-and-effectively-final
  [12]: https://en.wikipedia.org/wiki/Final_%28Java%29
  [13]: https://www.zhihu.com/question/21395848
  [14]: https://en.wikipedia.org/wiki/Java_bytecode_instruction_listings
  [15]: https://stackoverflow.com/questions/21855838/what-are-free-and-bound-variables