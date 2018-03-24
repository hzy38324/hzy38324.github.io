---
layout:     post                    # 使用的布局（不需要改）
title:      Java趣谈——如何写出一个高效的页面渲染器               # 标题 
subtitle:   #副标题
date:       2018-03-24              # 时间
author:     ZY                      # 作者
header-img: img/banner/how-to-write-a-effective-html-render.jpg    #这篇文章标题背景图片
catalog: true                       # 是否归档
tags:                               #标签
    - Java
    - Concurrency 
---
本集概要：  

 - 如何对页面渲染进行任务划分？
 - 这些任务要如何并行执行，才能实现最优效率？
 - 如何实现在每张图片下载完成之后马上渲染到页面上？
 - CompletionService的原理是什么？

前情回顾： [Java趣谈——如何像Tomcat一样处理请求](http://bridgeforyou.cn/2018/03/10/How-to-Handle-Request-Like-Tomcat/)

----------

上一集，大雄借助线程池，将老马的单线程Web服务器改造了一把，当然，老马留下来的瑰宝可远远不止一个Web服务器......  

# 老马的页面渲染器
“大雄，想不想再看一个老马之前写的代码？”，一天早上，哆啦来到大雄的卓旁，故作神秘地说。
“哈？好啊，求之不得！”  
“这次我们来看他写的一个页面渲染器。”  
“页面渲染器？你是说像谷歌、火狐浏览器那样，将html文件从网上抓取下来，然后把页面展现给用户的那种渲染器吗？”  
“没错，当时老马只做了文本渲染和图片渲染，咱一起来看看。”  

SingleThreadRenderer（**本文的示例代码，可到[Github](https://github.com/hzy38324/Coding-Pratice)下载**）:    
```java
public class SingleThreadRenderer implements HtmlRenderer {

    public void renderPage(String source) throws Exception {
        renderText(source);

        List<ImageData> imageData = new ArrayList<ImageData>();
        for (ImageInfo imageInfo : scanForImageInfo(source))
            imageData.add(imageInfo.downloadImage());

        for (ImageData data : imageData)
            renderImage(data);
    }

}
```
“哇，高手就是高手，内功相当深厚，写的代码真是整洁，让人一看就秒懂！”，大雄一如既往地拍马屁，仿佛老马就在旁边。  
“呵呵，那你倒是说说，这段代码是啥意思？”，哆啦打趣着。  
“很明显嘛，renderPage方法接收一段字符串，比如html的网页源代码，然后就对这段代码进行解析，先是renderText，也就是对源代码中的文本内容进行渲染，先把文本展示出来，然后再通过scanForImageInfo，扫描源代码里都有哪些img标签，接着再执行downloadImage，把图片内容一张张下载下来，最后再使用renderImage，把图片渲染到页面上。”  
“可以啊，小伙子。你觉得这段代码有什么可以改进的吗？”  
“哈，这下可难不倒我，多线程！”  
“哦？你想怎么个多线程法？”  
“渲染文本的时候，同时就可以去下载图片啦，不必等到文本都渲染完了，再去下载图片”，说完，大雄噼里啪啦地敲起了键盘。

# 异构并行
很快，大雄写出了自己的“多线程”页面渲染器。  
FutureRenderer：  
```java
public class FutureRenderer implements HtmlRenderer {
    private final ExecutorService executor = Executors.newCachedThreadPool();

    public void renderPage(String source) throws Exception {
        final List<ImageInfo> imageInfos = scanForImageInfo(source);
        Callable<List<ImageData>> task =
                () -> {
                    List<ImageData> result = new ArrayList<>();
                    for (ImageInfo imageInfo : imageInfos)
                        result.add(imageInfo.downloadImage());
                    return result;
                };

        // start download image before render text
        Future<List<ImageData>> future = executor.submit(task);

        renderText(source);

        List<ImageData> imageData = future.get();
        for (ImageData data : imageData)
            renderImage(data);
    }
}
```
“我用到了上次我们改造Web服务器时用到的**线程池**技术，在renderText之前，我就把下载图片的任务交给线程池去执行了，这样，渲染器在渲染文本的同时，也在下载图片，这样用户就可以更快的看到图片了。”，大雄向哆啦解释着他写的代码。  
“嗯，挺好的，实现了渲染文本和下载图片两个**异构**（Heterogeneous）任务的并行执行，不过也正因为如此，**这个方案存在异构任务特有的致命缺陷**。”    
“异构任务？致命缺陷？？”  
“哈，异构任务，就是不同种类的任务的意思，比如洗碗时，清洗和烘干，就是两个异构任务。”  
“Soga...那为什么说异构任务会有致命缺陷呢？”  
“很简单，你想想看，假设renderText需要10秒，下载图片也需要10秒，那么你的页面渲染器，由于采用了并行，这两个任务可以同时进行，所以总共需要花费时间也是10秒，而老马的串行页面渲染器，则需要20秒，在这种情况下，你的页面渲染器完爆老马。”  
“嗯，这不挺好的吗？”，大雄得意地说。  
“但是，假设下载图片还是需要10秒，但是renderText只需要1秒，那用你的页面渲染器，还是需要10秒，而老马的呢？这次老马的只需要11秒了，老马只比你慢了十分之一。而且要知道这种情况是很常见的，渲染文本的速度要远远快于下载图片的速度。”  
“啊，**比老马写多了这么多代码，用了比老马复杂的技术，结果性能却没提升多少**。。。”，大雄沮丧的说。  
“哈哈，别急，稍微换个方案就好了。”  
“啊？”  
“异构任务并行不好，那就把同构任务做成并行呗！”  

# 同构并行
“同构并行？你是说**同时下载多张图片**？”  
“是的，不仅如此，**我们还要在每张图片下载完成之后，马上渲染出来给用户看**”  
“这有难度啊，我要不断地监控每张图片的下载任务，也就是不断循环所有的Future对象，发现下载好的，就去渲染。”  
“嗯，有这个思路就不错了，JDK已经提供可以实现类似功能的框架，你就先别急着造轮子了。”  
“哦？”  
“**CompletionService**，你上网搜一下就知道了”  

大雄谷歌了一把，很快就捣腾出自己的一份代码。  
CompletionServiceRenderer：  
```java
public class CompletionServiceRenderer implements HtmlRenderer {
    private final ExecutorService executor = Executors.newCachedThreadPool();

    public void renderPage(String source) throws Exception {
        final List<ImageInfo> info = scanForImageInfo(source);
        CompletionService<ImageData> completionService =
                new ExecutorCompletionService<>(executor);
        for (final ImageInfo imageInfo : info)
            completionService.submit(() ->
                    imageInfo.downloadImage());

        renderText(source);

        for (int t = 0, n = info.size(); t < n; t++) {
            Future<ImageData> f = completionService.take();
            ImageData imageData = f.get();
            renderImage(imageData);
        }
    }

}
```
“这里我给每张图片的下载都创建了独立的任务，然后通过completionService.submit()，开始在线程池里并行执行下载任务，最后使用了completionService.take()方法，这是一个阻塞方法，直到有任务执行完成，也就是图片下载完成，才会返回带有任务执行结果的Future对象，然后我就可以取出下载结果，渲染图片了”  

# CompletionService连环炮
“可以啊，学的挺快的，那我问你，**CompletionService到底是个什么东西？**”  
“哈，我们可以拿CompletionService和ExecutorService做个比较，ExecutorService的submit()方法会返回一个Future对象，通过这个Future对象我们可以拿到任务的执行结果，**但是如果我们想获得所有任务的执行结果，就得自己去维护这些Future对象，而CompletionService就是为了解决这个开发难题而发明的**“  
“嗯，不错，知其然知其所以然”  
”再往深处讲，**CompletionService其实只是一个接口**，接口定义的是一种**规范**，而CompletionService接口所定义的，**是一套将创建任务和消费任务完成结果进行解耦的规范**，就像这个接口的第一行注释所描述的一样”  
> A service that decouples the production of new asynchronous tasks from the consumption of the results of completed tasks. 

“CompletionService接口有五个方法，看下JDK源码就很清楚了”  
![](/img/post/2018-03-24-How-to-Write-a-Effective-Html-Render/CompletionService.png) 
接口很简单，总共五个方法，大致上可以分为两类：

- **任务创建方法**：就是两个submit方法，其中一个接受Callable参数，Callable是Runnable的升级版，最大的好处是**Callable类型的任务有返回值，并且可以声明异常**；另一个submit方法，接收的是Runnable类型的参数，当然，最终在实现时，还是在方法内部通过一个叫RunnableAdapter的适配器，将Runnable转成Callable；
- **任务结果获取方法**：就是take()和两个poll()，其实take是一定会**阻塞**的，而空参数的poll，则不会阻塞，有结果则返回结果，没有则返回null，还有一个poll，则可以指定超时时间。

所以，**所有的CompletionService接口的实现类，都需要回答两个问题**：

- 如何创建任务？
- 如何获取任务执行结果？

“在JDK里，CompletionService接口目前只有一个实现，那就是我刚刚用到的**ExecutorCompletionService**”  
“哦？那它是如何回答那两个问题的呢？”，哆啦继续追问。  
“很简单，ExecutorCompletionService的构造函数里需要传入一个Executor线程池对象，**任务的创建就是委托给这个线程池对象去执行的**。”  
“嗯，那任务执行结果呢？是放在哪里，如何获取的？”  
“ExecutorCompletionService内部有一个**completionQueue**，**这是一个阻塞队列BlockingQueue**，用来存放任务的执行结果。take、poll方法，其实是委托给这个阻塞队列去实现的”  
“最后一个问题，**ExecutorCompletionService是如何把完成了的任务放到这个completionQueue的？**”  
“哈哈，这个我刚好也看到了，在submit的时候，ExecutorCompletionService交给线程池的，**是一个覆写了done方法的Future对象**，叫**QueueingFuture**，这个QueueingFuture的done方法，就会把任务放入completionQueue”  
QueueingFuture：  
```java
    private class QueueingFuture extends FutureTask<Void> {
        QueueingFuture(RunnableFuture<V> task) {
            super(task, null);
            this.task = task;
        }
        protected void done() { completionQueue.add(task); }
        private final Future<V> task;
    }
```
"可以啊，小伙子"  
“哈哈，其实也就看了下，里面很多设计思想还没来得及去仔细琢磨......”


# 总结
本文通过对页面渲染器的并行方案的优化，以及对CompletionService接口的使用，实现了一个高效的页面渲染器，总结如下：

- **优化并行方案**。学会使用线程池只是技术上的进步，但是在实际运用中，**任务执行方案的设计也同样重要**。要如何设计任务并行的方案，让哪些任务跟哪些任务并行执行？通过上面的介绍，我们可以得出这个结论：**在保证执行结果正确性的前提下，同构任务的并行优于异构任务的并行**。
- **CompletionService接口**。CompletionService接口制定了一套创建任务和消费任务执行结果的解耦规范，**其实现类ExecutorCompletionService，分别将任务创建和任务执行结果委托给了线程池和阻塞队列去实现**。


# 参考
- 《Java并发编程实践》
- [When should I use a CompletionService over an ExecutorService?](https://stackoverflow.com/questions/4912228/when-should-i-use-a-completionservice-over-an-executorservice)