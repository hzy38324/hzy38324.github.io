---
layout:     post                    # 使用的布局（不需要改）
title:      如何在Spring Boot中使用TDD写出高质量的接口               # 标题 
subtitle:   #副标题
date:       2018-01-07              # 时间
author:     ZY                      # 作者
header-img: img/banner/how-to-use-tdd-on-sping-boot.jpg    #这篇文章标题背景图片
catalog: true                       # 是否归档
tags:                               #标签
    - TDD
    - Spring Boot
---
之前在《[如何说服你的同事使用TDD](http://bridgeforyou.cn/2017/12/03/How-to-Persuade-Your-Teemmate-to-use-TDD/)》中介绍了为什么要使用TDD（测试驱动开发），以及如何使用TDD写代码。文章发表后，有同学在评论区中表示文章写得不错，但是举得例子太过脱离实际了，能不能举一个在实际工作中的例子呀。这篇文章，就来分享一下在Spring Boot中，如何使用TDD写出**功能健壮**、**代码整洁**的**高质量接口**。  

我将用一个简单的案例，向你展示：  

- 什么是“接口文档->测试用例->产品代码”的TDD开发流程
- 在Spring Boot中，怎样同时使用集成测试和单元测试，保证测试的覆盖面
- 使用Spring Boot测试框架的一些优秀实践
- 为什么要使用TDD

# 接口文档
我们要实现的接口，功能非常简单，就是能够对敏感字眼进行检查的发帖功能，不允许发带有“shit”、“fxxk”之类字眼的帖子，嗯，我们是一个文明的社区！ 
 
接口文档如下：  

**接口说明**  
发布帖子，同时对敏感字眼进行校验  
  
**URL**   
/v2.0/posts  

**HTTP请求方式**  
POST  

**请求体**  
参数： content（帖子的内容，String）  

**响应**  
200 创建成功，返回成功创建的帖子信息  
400 创建失败，帖子中包含敏感字眼  

**示例1**  
请求体  
```
{
    "content": "hello world!"
}
```
响应  
200  
```
{
    "id": 1,
    "content": "hello world!",
    "username": "sexy code",
    "createDate": 1515312619351
}
```  
**示例2**  
请求体  
```
{
    "content": "hello shit!"
}
```
响应  
```
{
    "errorCode": 100001,
    "errorInfo": "post contains sensitive info"
}
```

# 测试策略
如果不采用TDD，那么下一步就是拿着接口文档开发接口了，但是这很不TDD。TDD要求我们先写测试用例。  
> 你或许会认为不写测试用例，同样可以写出实现功能的接口。别急，测试用例带给你的好处远远不止正确性。

看完上面那份接口文档，我们很自然的想到有下面两个测试用例：  
1. 发布内容合规的帖子，成功发布，返回200和对应的数据  
2. 发布含有敏感字眼的帖子，发布失败，返回400和错误提示  

上面这两个测试用例，都是从模拟客户端请求，到后台业务层和数据库层操作，再到返回响应的端到端测试，因此属于**集成测试**。  
集成测试要求我们启动Spring Boot的容器，因此运行起来会比较慢。通常情况下，集成测试只覆盖基本场景，更细致的测试，可以交给**单元测试**。  
比如在这个场景中，我们可以针对判断内容中是否含有敏感信息的这个功能，进行单元测试，这也就要求我们把这个功能，抽取成一个方法，这样才方便我们写测试用例。由于单元测试不需要启用Spring Boot容器，因此测试用例运行起来将非常迅速。  

> TDD在不知不觉中提高了我们的代码质量。它让我们从测试用例的角度出发，思考如何写出方便测试的代码，方便测试的代码，往往是符合单一职责的。  

# 集成测试
制定好测试策略之后，下面开始写第一个测试用例。  

一个测试用例通常包括以下三个步骤：  
1. 创建环境，初始化数据
2. 执行操作
3. 验证操作结果

对于我们这个发帖的接口，那就是：
1. 创建Spring Boot容器
2. 向发帖的接口，发送Post请求
3. 根据返回的帖子id，去数据库查询，看查到的数据，是不是和发送的数据一致

使用Spring Boot提供的测试框架，可以很轻松的将上面这个过程写成代码（**本文的所有代码，可到[Github](https://github.com/hzy38324/tiny-facebook)下载，欢迎加星**）：
```java
@RunWith(SpringRunner.class)
@SpringBootTest
@AutoConfigureMockMvc
public class PostControllerV2ITTest {

    public static final String POST_CONTENT_VALID = "post content test";
    public static final String POST_URL = "/v2.0/posts";

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private PostRepository postRepository;

    @Test
    public void testCreatePost_returnSuccess() throws Exception {
        ResultActions resultActions = sendCreatePostRequest(POST_CONTENT_VALID);

        checkCreateValidPostResult(resultActions, POST_CONTENT_VALID);
    }

	...

}
```
PostControllerV2ITTest类上的几个注解，@RunWith、@SpringBootTest等，是Spring Boot提供的用于创建集成测试环境的注解，本文重点在于TDD，因此这几个注解的具体用途和原理就不一一赘述了，有兴趣的同学可以查看[Spring Boot官方文档](https://docs.spring.io/spring-boot/docs/current/reference/html/boot-features-testing.html)中关于测试框架的介绍。    
代码中发送请求的函数sendCreatePostRequest和检查请求结果的函数checkCreateValidPostResult分别如下：  
sendCreatePostRequest:
```java
    private ResultActions sendCreatePostRequest(String postContent) throws Exception {
        PostCreateDTO postCreateDTO = new PostCreateDTO(postContent);
        return mockMvc.perform(post(POST_URL)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(postCreateDTO)));
    }
```
checkCreateValidPostResult:
```java
    private void checkCreateValidPostResult(ResultActions resultActions, String expectedContent) throws Exception {
        resultActions.andExpect(status().isCreated());

        Post postFromRsp = transferResponse2PostEntity(resultActions);
        Post postFromDB = postRepository.findOne(postFromRsp.getId());

        assertNotNull(postFromDB);
        assertEquals(expectedContent, postFromDB.getContent());
    }

    private Post transferResponse2PostEntity(ResultActions resultActions) throws java.io.IOException {
        String response = resultActions.andReturn().getResponse().getContentAsString();
        return objectMapper.readValue(response, Post.class);
    }
```
写完测试用例，编辑器会用飘红提醒你，你还没创建PostRepository、Post、PostCreateDTO这些类。嗯，别急，这就创建。  
PostRepository，使用Spring Data，可以轻松写出一个自带增删改查功能的DAO：
```java
public interface PostRepository extends CrudRepository<Post, Long> {
}
```
Post，其实就是数据库中的存储结构，用Java Entity的形式表示出来：
```java
@Entity
public class Post {
    @Id
    @GeneratedValue(strategy = GenerationType.AUTO)
    private long  id;
    private String content;
    private String username;
    private Date createDate;

    public long  getId() {
        return id;
    }

    public void setId(long id) {
        this.id = id;
    }

    public String getContent() {
        return content;
    }

    public void setContent(String content) {
        this.content = content;
    }

    public String getUsername() {
        return username;
    }

    public void setUsername(String username) {
        this.username = username;
    }

    public Date getCreateDate() {
        return createDate;
    }

    public void setCreateDate(Date createDate) {
        this.createDate = createDate;
    }
}
```
PostCreateDTO，发帖接口的请求体：
```java
public class PostCreateDTO {
    private String content;

    public String getContent() {
        return content;
    }

    public void setContent(String content) {
        this.content = content;
    }

    public PostCreateDTO(String content) {
        this.content = content;
    }

    public PostCreateDTO() {
    }
}
```
创建完这三个类之后，测试用例可以编译通过了，执行它，由于我们还没有写接口，嗯，测试用例理所当然、意料之中地失败了：
![](/img/post/2018-01-07-How-to-Use-TDD-on-Sping-Boot/1-fail-test.png)

预期201，实际404，因为我们还没提供接口。  
那下面自然就是写接口啦，终于可以写产品代码了！
PostController，只负责定义接口路径，逻辑全部交给Service：
```java
@RestController
@RequestMapping("/v2.0/posts")
public class PostControllerV2 {

    @Autowired
    private PostService postService;

    @RequestMapping(value="", method= RequestMethod.POST)
    public ResponseEntity createPost(@RequestBody PostCreateDTO postCreateDTO) {
        return postService.createPost(postCreateDTO);
    }

}
```
PostService，业务层操作，将PostCreateDTO转成Post，然后调用postRepository，将数据保存到数据库中：
```java
@Service
public class PostService {

    @Autowired
    private PostRepository postRepository;

    @Autowired
    private UserService userService;

    public ResponseEntity createPost(PostCreateDTO postCreateDTO) {
        Post postCreateResult = savePost2DB(postCreateDTO);
        return ResponseEntity.status(HttpStatus.CREATED).body(postCreateResult);
    }

    private Post savePost2DB(PostCreateDTO postCreateDTO) {
        Post post = new Post();
        post.setCreateDate(new Date());
        post.setContent(postCreateDTO.getContent());
        post.setUsername(userService.queryCurrentUserName());
        return postRepository.save(post);
    }
}
```
PostService中用到了另一个Service，UserService，用于获取当前登录用户，当然这里并没有真的去从session中获取用户信息：
```java
@Service
public class UserService {
    public String queryCurrentUserName() {
        return "sexy code";
    }
}
```
完工，运行下测试用例，通过后，我们继续写下一个集成测试用例——敏感字段校验。  

第二个用例依然遵循测试用例“三部曲”，创建环境->创建带有敏感信息的帖子->检查响应是不是400、检查数据库中是不是没有数据。这里只贴上新增的代码。    
PostControllerV2ITTest:  
```java
	public static final String POST_CONTENT_SENSITIVE = "post content test fuck";
	...

    @Test
    public void testCreatePost_withSensitiveInfo_returnBadRequest() throws Exception {
        ResultActions resultActions = sendCreatePostRequest(POST_CONTENT_SENSITIVE);

        checkCreateSensitivePostResult(resultActions);
    }
	
	...  

	private void checkCreateSensitivePostResult(ResultActions resultActions) throws Exception {
        resultActions.andExpect(status().isBadRequest());

        long count = postRepository.count();
        assertEquals(0, count);
    }
```
运行新的测试用例，自然又是理所当然的失败。继续写产品代码。由于我们遵循良好的分层结构，Controller不需要做任何修改，只需给PostService加上判断敏感字段的逻辑即可，PostService：
```java
...

    public ResponseEntity createPost(PostCreateDTO postCreateDTO) {
        if(isPostContainsSensitiveInfo(postCreateDTO.getContent())) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(new ErrorInfo(SENSITIVE_INFO_ERROR_CODE, POST_CONTAINS_SENSITIVE_INFO));
        }
        Post postCreateResult = savePost2DB(postCreateDTO);
        return ResponseEntity.status(HttpStatus.CREATED).body(postCreateResult);
    }

    private boolean isPostContainsSensitiveInfo(String content) {
        // TODO: change to throw exception and use global exception handler to return response
        if(content.contains("shit") || content.contains("fuck")) {
            return true;
        }
        return false;
    }

...

```
这里的isPostContainsSensitiveInfo就是我们用来判断敏感字段的方法，我们将整个判断逻辑抽取出来，方便后面的单元测试。  
值得注意的是，这个方法更好的做法是在判断为含有敏感信息时，抛出异常，而不是返回true这种标志（参见《Effective Java》第九章异常中提出的原则），不过由于我还没给整个Spring Boot项目加上全局异常处理器，因此这里暂时先使用返回boolean的方式来处理，后面会写一篇文章来分享如何在Spring Boot中把异常转换为http状态码。  

写完产品代码，再来运行测试用例，通过。  

# 单元测试
现在我们的代码已经可以满足上面两个集成测试，可以说基础场景的功能我们已经实现了。但是我们的**测试覆盖率**并不全。  
举个简单的例子，"shit"和"fxxk"都是敏感信息，但是上面我们只测试了"fxxk"的场景，可是专门给"shit"这个场景写一个集成测试又未免太过兴师动众，这时候我们就可以使用单元测试，来对功能进行**更细致**并且**更快速**的测试。由于isPostContainsSensitiveInfo是private方法，因此我们在测试时用到了反射。    
PostServiceUnitTest：  
```java
public class PostServiceUnitTest {

    @Test
    public void testMethod_IsPostContainsSensitiveInfo() throws NoSuchMethodException, InvocationTargetException, IllegalAccessException {
        Class<PostService> postServiceClass = PostService.class;
        Method method = postServiceClass.getDeclaredMethod("isPostContainsSensitiveInfo", String.class);
        method.setAccessible(true);

        PostService postService = new PostService();
        checkWithContent(method, postService, "hi and fuck", true);
        checkWithContent(method, postService, "hello world", false);
        checkWithContent(method, postService, "hello shit", true);

    }

    private void checkWithContent(Method method, PostService postService, String content, boolean expected) throws IllegalAccessException, InvocationTargetException {
        boolean isSensitive = (Boolean)method.invoke(postService, content);
        assertEquals(expected, isSensitive);
    }
}

```
显然，这是一个非常简单的Junit，不需要启用Spring Boot容器，运行起来自然也是相当迅速，在我的机器上，执行一次集成测试要花费**15秒**，其中绝大多数时间都是花在初始化容器上，而执行一个单元测试只需要**1秒**。  

# 防止测试用例之间相互影响
写测试用例有一个原则，那就是各个用例之间不能够相互影响，而我在testCreatePost_returnSuccess用例中给数据库插入了数据，却没有在testCreatePost_withSensitiveInfo_returnBadRequest用例开始之前对数据库进行清空，这样testCreatePost_returnSuccess用例中插入的数据就会带到下一个用例中去，更不幸的是，我们在testCreatePost_withSensitiveInfo_returnBadRequest用例中还加入了如下数据库count的校验：
```java
	...
	long count = postRepository.count();
	assertEquals(0, count);
	...
```
因此，只要testCreatePost_returnSucces用例在testCreatePost_withSensitiveInfo_returnBadRequest之前执行，那么testCreatePost_withSensitiveInfo_returnBadRequest就会失败。  
我们来验证一下，为了实现上面所讲的测试用例的执行顺序，我给PostControllerV2ITTest加入了@FixMethodOrder(MethodSorters.NAME_ASCENDING)注解：
```
@FixMethodOrder(MethodSorters.NAME_ASCENDING)
public class PostControllerV2ITTest
```
执行测试用例，果然，testCreatePost_withSensitiveInfo_returnBadRequest失败了：
![](/img/post/2018-01-07-How-to-Use-TDD-on-Sping-Boot/2-fail-test.png)
预期0，结果1，因为我们在用例开始前没有清空数据库，导致用例之间相互影响。要解决这个问题，很简单，只需要写个@Before注解的函数，并在函数中清空表中的数据：
```java
    @Before
    public void setup() {
        postRepository.deleteAll();
    }
```
@Before是Junit提供的注解，每个测试用例在执行前，都会执行被@Before注解的函数。  

# 更多
这篇文章只是举了一个我认为的，足够简单，却又足够说明问题的例子，在实际开发中，自然会遇到更多的场景，比如：
1. 你们项目加入了鉴权，每个请求过来都会被拦截，导致你在测试用例中发出的请求都会返回401，怎么办？你可以使用[standalonesetup](https://stackoverflow.com/questions/32223490/are-springs-mockmvc-used-for-unit-testing-or-integration-testing)的方式，只加载你需要的Bean，这样就不会引入鉴权框架；你也可以使用Mock，把鉴权的函数Mock掉；当然你也可以Mock其他的函数，反正只要制造你已经登录的假象就好了；或许你还有其他奇技淫巧...
2. 你不想每次都把请求返回的结果转成Java Bean，然后一个个字段去校验，你希望直接校验json字符串？没问题，Spring Boot支持你这样做： [Auto-configured JSON tests](https://docs.spring.io/spring-boot/docs/current/reference/html/boot-features-testing.html#boot-features-testing-spring-boot-applications-testing-autoconfigured-json-tests) 
3. 你写了一个很复杂的Dao操作，想要对它进行单元测试？这也没问题： [Auto-configured Data JPA tests](https://docs.spring.io/spring-boot/docs/current/reference/html/boot-features-testing.html#boot-features-testing-spring-boot-applications-testing-autoconfigured-jpa-test)

Spring Boot为我们写好测试用例、用好TDD提供了非常方便的框架，我们只需尽情去写测试用例，尽情去TDD就好了。  

# 再谈TDD
这篇文章虽然是在谈如何在Spring Boot中使用TDD写高质量的接口，但是从这样一个例子中，我们也看到了TDD的很多好处：

1. 让你开发时充满**成就感**：你写代码就是为了让原本fail的测试用例通过，这让你写代码时更加具有目标，同时也让你的代码好坏具有可以**量化**的指标。
2. 促进**整洁的代码**：正如之前提到的，TDD让我们从测试用例的角度出发，思考如何写出方便测试的代码，方便测试的代码，往往是符合**单一职责**的。
3. **提高开发的效率**：我身边很多不写测试用例的同事，每次一修改代码，就把代码编译成class文件放到环境上，然后重启、测试，这对于小项目来说尚可接受，但是对于一个大的项目，重启往往需要花费很多时间，而且在我接触到的一个Docker容器化的项目中，还不支持用单个class文件替换的方式去打补丁，每次替换都需要替换整个服务的代码，嗯，然后每次替换、验证、发现新Bug，再修改、替换、验证... 这样开发的效率自然不高。但是如果你已经在本地环境上写了充分的测试用例，那么代码一把布上去，一把验证通过，也就是家常便饭了的事了。
4. 提高了测试用例的**代码覆盖率**：这几乎无需解释，先写测试用例，再写产品代码，和先写产品代码，后来由于某种政治任务的压迫，再来补测试用例，前者写出来的测试用例质量一定更高，测试的覆盖率也一定更大。而代码覆盖率的提高，将带给我们下面两个个超级好处：

	- **方便重构**：有多少次你看到一份写的很烂的代码，却又不敢重构，生怕把原有的功能搞坏？有了高覆盖率的测试用例，你就不再担心这个了，重构后，只需要跑一遍用例，就知道你的重构有没有影响原先的功能。
	- **测试即文档**：测试用例是最好的文档，文档会撒谎、注释会撒谎，但是代码不会。

写完这篇文章，结合之前那篇《[如何说服你的同事使用TDD](http://bridgeforyou.cn/2017/12/03/How-to-Persuade-Your-Teemmate-to-use-TDD/)》，嗯，这下我真的非常有信心，可以说服你们使用TDD，说服你们去说服你们同事，使用TDD了。

# 参考
- [Spring Boot Testing](https://docs.spring.io/spring-boot/docs/current/reference/html/boot-features-testing.html)
- [spring-guides/gs-testing-web](https://github.com/spring-guides/gs-testing-web.git)
- [How do I test a private function or a class that has private methods, fields or inner classes?](https://stackoverflow.com/questions/34571/how-do-i-test-a-private-function-or-a-class-that-has-private-methods-fields-or)
- [junit-team/junit4 - test-execution-order](https://github.com/junit-team/junit4/wiki/test-execution-order)
- [Are Spring's MockMvc used for unit testing or integration testing?](https://stackoverflow.com/questions/32223490/are-springs-mockmvc-used-for-unit-testing-or-integration-testing)
- [Unit and Integration Tests in Spring Boot - DZone Integration](https://dzone.com/articles/unit-and-integration-tests-in-spring-boot)
- [Injecting Mockito mocks into a Spring bean](https://stackoverflow.com/questions/2457239/injecting-mockito-mocks-into-a-spring-bean)
- 《Effective Java》
- 《程序员的职业素养》
- 《代码整洁之道》
- 《重构》



