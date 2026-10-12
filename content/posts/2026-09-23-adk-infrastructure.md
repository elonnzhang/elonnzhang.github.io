---
title: Agent Development Kit (ADK) · 20 - Auth、Telemetry 与 Platform
date: 2026-09-23
categories:
  - agent
  - ai
  - golang
tags:
  - agent
  - ai
  - golang
draft: false
toc: true
slug: adk-infrastructure
series: adk
series_order: 20
description: 对照 ADK-Go v2.4.0，拆解 auth 的凭据解析、Telemetry 的 OpenTelemetry 生命周期，以及 platform 的时间和 UUID 注入边界。
---

# ADK-Go 源码阅读笔记 · Auth、Telemetry 与 Platform：横切能力怎样进入一次运行

> **源码基准：[ADK-Go v2.4.0](https://github.com/google/adk-go/tree/v2.4.0)**，commit `4e57df40cbd35f055ba654b03ffb0e509fdd754a`。本文的“当前实现”均指这个版本。
>
> [返回 ADK 源码阅读合集](/blog/adk/) · 配套阅读：[Runner](/blog/adk-runner/)、[Context](/blog/adk-context/)、[Plugin](/blog/adk-plugin/)、[Server](/blog/adk-server/)。

ADK 的主链文章通常从 Runner 开始：取得 Session，运行 Agent，保存 Event。但真实应用还要解决三类横切问题：工具访问外部服务时用谁的凭据，运行过程怎样被观测，以及事件里的时间戳和 ID 怎样在测试中变得可控。

这三件事分别落在 `auth`、`telemetry` 和 `platform` 包。它们都不负责调用模型，也不拥有 Session；它们通过接口和 `context.Context` 进入调用树，把能力交给真正的请求、事件或服务。

{{< ann n amber "横切能力不是隐式全局状态" >}}凭据和测试 provider 都沿着 context 或对象边界传递{{< /ann >}}。因此“配置了 ADC”不等于每个 HTTP 请求都会自动带 token，“初始化了 Telemetry”也不等于已经注册成全局 provider。

## 阅读前先分清三个层次

| 层次 | 负责什么 | 不负责什么 |
| --- | --- | --- |
| `auth.CredentialProvider` | 在一次请求上下文中解析可用凭据 | 不发送 HTTP 请求 |
| `auth.Credential` | 把已解析凭据写入 HTTP headers | 不决定何时刷新或重试 |
| `auth.Transport` | 每次 `RoundTrip` 解析并应用凭据 | 不替调用方管理用户授权 |
| `telemetry.Providers` | 持有 OTel tracer/logger provider，注册和关闭 | 不自动创建业务 span |
| `platform` provider | 为当前 context 提供时间、UUID 和任务调度策略 | 不改变包级默认行为 |

## 一、源码入口与阅读地图

| 阅读顺序 | 源码 | 要回答的问题 |
| --- | --- | --- |
| 1 | [`auth/credential.go#L25-L120`](https://github.com/google/adk-go/blob/v2.4.0/auth/credential.go#L25-L120) | 一个凭据怎样写到请求头？ |
| 2 | [`auth/providers.go#L29-L178`](https://github.com/google/adk-go/blob/v2.4.0/auth/providers.go#L29-L178) | Static token、ADC、Service Account 的解析边界是什么？ |
| 3 | [`auth/transport.go#L22-L75`](https://github.com/google/adk-go/blob/v2.4.0/auth/transport.go#L22-L75) | provider 何时被调用，Request 是否会被原地修改？ |
| 4 | [`telemetry/telemetry.go#L28-L119`](https://github.com/google/adk-go/blob/v2.4.0/telemetry/telemetry.go#L28-L119) | OTel provider 怎样创建、注册和关闭？ |
| 5 | [`telemetry/config.go#L55-L136`](https://github.com/google/adk-go/blob/v2.4.0/telemetry/config.go#L55-L136) | Cloud 导出和自定义 processor 怎样组合？ |
| 6 | [`platform/time.go#L22-L50`](https://github.com/google/adk-go/blob/v2.4.0/platform/time.go#L22-L50)、[`uuid.go#L23-L52`](https://github.com/google/adk-go/blob/v2.4.0/platform/uuid.go#L23-L52) | 时间和 ID 的 provider 如何只影响当前调用树？ |
| 7 | [`platform/exec.go#L22-L94`](https://github.com/google/adk-go/blob/v2.4.0/platform/exec.go#L22-L94) | 模型工具并发怎样替换为宿主自己的 TaskRunner？ |
| 8 | [`auth/gcp/client.go#L203-L370`](https://github.com/google/adk-go/blob/v2.4.0/auth/gcp/client.go#L203-L370) | Agent Identity / IAM Connector 的 transport client 如何轮询和映射凭据？ |

```text
agent.Context / request.Context
             │
             ├── auth.Transport.RoundTrip
             │       ├─ CredentialProvider.Credential
             │       ├─ Credential.Apply
             │       └─ Base.RoundTrip
             │
             ├── session.NewEvent / other ADK code
             │       ├─ platform.Now(ctx)
             │       └─ platform.NewUUID(ctx)
             │
             └── telemetry.New → Providers.SetGlobalOtelProviders
                                      └─ Providers.Shutdown
```

## 二、核心接口与数据

### 1. Provider、Credential、Transport 是三次分工

`CredentialProvider` 只返回一个实现 `Apply(http.Header)` 的 `Credential`。例如 `BearerCredential` 设置 `Authorization: Bearer ...`，`APIKeyCredential` 设置调用方指定的 header；`OAuth2Credential` 则在每次 `Apply` 时从 `TokenSource` 取得 token（[`credential.go#L47-L95`](https://github.com/google/adk-go/blob/v2.4.0/auth/credential.go#L47-L95)）。

```go
type Credential interface {
    Apply(http.Header) error
}

type CredentialProvider interface {
    Credential(context.Context) (Credential, error)
}
```

`Transport` 把两者接到 `http.RoundTripper`：它拿 `req.Context()` 调 provider，clone 请求，再应用凭据，最后交给 `Base`。请求体在 provider 或 Apply 失败时由 Transport 负责关闭，成功后交回底层 transport（[`transport.go#L37-L75`](https://github.com/google/adk-go/blob/v2.4.0/auth/transport.go#L37-L75)）。

### 2. ADC 是惰性解析，不是启动时全局登录

`ADC` 返回的是一个 lazy provider。首次调用才执行 `google.FindDefaultCredentials`；成功的 `TokenSource` 被复用，初始化失败则允许下一次重试。初始化在脱离调用者取消、但受 `initTimeout` 限制的 goroutine 中执行；等待者仍可以用自己的 context 提前退出（[`providers.go#L124-L131`](https://github.com/google/adk-go/blob/v2.4.0/auth/providers.go#L124-L131)、[`#L184-L233`](https://github.com/google/adk-go/blob/v2.4.0/auth/providers.go#L184-L233)）。

Service Account 根据配置选择显式 JSON key、ADC access token 或指定 audience 的 ID token。显式 key 的 access token 路径要求非空 scopes；`Audience` 非空时改走 ID token（[`providers.go#L133-L178`](https://github.com/google/adk-go/blob/v2.4.0/auth/providers.go#L133-L178)）。

### 3. `auth/gcp` 是 transport client，不是用户解析 provider

`auth/gcp` 面向 Google Cloud Agent Identity 和 IAM Connector 两个凭据服务。`NewClient` 默认用 ADC 的 cloud-platform scope 创建 HTTP client，并拒绝 redirect；调用方也可以传入自带认证的 client（[`auth/gcp/doc.go#L15-L29`](https://github.com/google/adk-go/blob/v2.4.0/auth/gcp/doc.go#L15-L29)、[`client.go#L203-L240`](https://github.com/google/adk-go/blob/v2.4.0/auth/gcp/client.go#L203-L240)）。

`RetrieveCredential` 先校验 resource 和 UserID，再按资源名是否匹配 `projects/*/locations/*/connectors/*` 选择 Connector 或 Agent Identity。服务返回 pending 时按退避继续轮询；需要交互同意时转换成上层 `auth.ConsentRequiredError`，拒绝或超时则返回可用 sentinel error（[`client.go#L243-L370`](https://github.com/google/adk-go/blob/v2.4.0/auth/gcp/client.go#L243-L370)、[`agentidentity.go#L46-L71`](https://github.com/google/adk-go/blob/v2.4.0/auth/gcp/agentidentity.go#L46-L71)、[`connector.go#L41-L84`](https://github.com/google/adk-go/blob/v2.4.0/auth/gcp/connector.go#L41-L84)）。

这里的边界很容易读错：该包只负责“给定 resource + acting user 后，怎样向凭据服务取回 credential”；`auth.CredentialProvider` 如何从 ADK invocation context 找到 acting user，是更高一层的组合。它也不会替业务 HTTP 请求自动安装到所有 client 上。

### 4. Telemetry 只有两个生命周期动作

`telemetry.New` 返回 `Providers`，其中 tracer 和 logger provider 可以分别为空。`SetGlobalOtelProviders` 只注册非空项；它不会替调用方创建 span。应用也可以直接把 `Providers.TracerProvider` 交给不使用 OTel global 的库。进程退出前应显式调用 `Shutdown`，它会聚合 tracer 和 logger 的关闭错误（[`telemetry.go#L28-L60`](https://github.com/google/adk-go/blob/v2.4.0/telemetry/telemetry.go#L28-L60)）。

选项可以打开 GCP 导出、提供 resource、追加 span/log processor，或直接注入已经创建的 provider（[`config.go#L66-L136`](https://github.com/google/adk-go/blob/v2.4.0/telemetry/config.go#L66-L136)）。这些选项改变 provider 的装配，不改变 Runner 的事件语义。

### 5. Platform provider 由 context 携带

默认 `platform.Now(ctx)` 使用 `time.Now`，`NewUUID(ctx)` 使用随机 UUIDv4。`WithTimeProvider` 和 `WithUUIDProvider` 返回带 provider 的 context；派生 context 会继承它，另一个调用树不会受到影响（[`time.go#L30-L50`](https://github.com/google/adk-go/blob/v2.4.0/platform/time.go#L30-L50)、[`uuid.go#L31-L52`](https://github.com/google/adk-go/blob/v2.4.0/platform/uuid.go#L31-L52)）。Session 的 `NewEvent` 通过这些 seam 取得时间和 ID，所以测试可以同时固定两者而不改全局时钟。

`platform` 还提供 `TaskRunner`。默认 `RunTasks` 为每个独立任务启动一个 goroutine，并用 `WaitGroup` 建立完成屏障；`WithTaskRunner` 可以让宿主改成顺序执行、限流执行或自己的 executor。即使自定义 runner 提前返回，`RunTasks` 仍会等待包装后的任务全部完成（[`exec.go#L22-L94`](https://github.com/google/adk-go/blob/v2.4.0/platform/exec.go#L22-L94)）。Flow 的并行 FunctionCall 执行通过这个入口提交任务，因此可以在不改 Flow 代码的情况下固定并发策略。

## 三、主执行路径：一次外部请求怎样获得凭据

```text
工具/适配器创建 http.Request
        │ request.Context() 继承 invocation context
        ▼
auth.Transport.RoundTrip
        │ Provider.Credential(ctx)
        ├─ ADC / ServiceAccount / custom provider
        ▼
Credential.Apply(clonedRequest.Header)
        │
        ▼
Base.RoundTrip(clonedRequest)
```

这条链有两个容易遗漏的事实：

1. provider 是按请求解析的，不应把一个用户的已解析 credential 放到跨用户的全局变量中；刷新和缓存由底层 `TokenSource` 负责。
2. `Transport` clone 请求后才改 header，因此不会原地修改调用方持有的 `Request`；但 HTTP body 的所有权仍遵循 `RoundTripper` 契约。

事件创建是同一思路的另一种应用：`session.NewEvent(ctx, invocationID)` 使用 context 中的 platform provider，生成可重复的 ID 和时间；它仍然是普通 Event，不会因为 provider 存在就自动写入 Session（[`session.go#L233-L245`](https://github.com/google/adk-go/blob/v2.4.0/session/session.go#L233-L245)）。

Telemetry 的路径则是启动/关闭边界：

```text
telemetry.New(ctx, opts...)
        ├─ 配置 resource / processors / exporters
        ▼
Providers.SetGlobalOtelProviders()   (可选)
        │
        └─ 应用和 ADK 产生 span/log
                    ↓
         Providers.Shutdown(shutdownCtx)
```

`New` 成功不代表已注册 global；`SetGlobalOtelProviders` 成功也不代表已经有业务数据。两件事都要由应用显式完成。

## 四、关键分支与失败边界

### 1. Credential 失败与 HTTP 失败不是一层

provider 返回错误时，Transport 不会调用底层网络；Apply 失败同样不会发送请求。只有凭据准备成功后，网络错误才来自 `Base.RoundTripper`。因此重试策略不能把所有错误都归类为“服务端 5xx”。

### 2. ConsentRequiredError 不能直接序列化给模型

交互式 OAuth provider 可以返回 `*ConsentRequiredError`，它携带授权 URI、nonce 和恢复 key，但 `Error()` 故意只返回 `auth: interactive consent required`。这些字段是给上层 HITL 流程使用的，不应记录到日志、span 或 JSON；错误正文可能进入 Tool 结果和 Session（[`providers.go#L55-L80`](https://github.com/google/adk-go/blob/v2.4.0/auth/providers.go#L55-L80)）。

### 3. nil provider 的默认行为不同

`auth.Transport` 没有 provider 会返回错误；`telemetry.Providers` 中某个 provider 为空则只跳过对应的 global 注册和 shutdown；`platform` 发现 nil provider 时退回系统默认实现。不能把三种 nil 语义混为一种“自动补默认”。

### 4. Global OTel 与显式 provider 可以并存，但要明确所有权

库可以直接使用 `Providers.TracerProvider`，也可以注册成 global。若同时由多个组件创建并关闭 provider，关闭顺序和所有权需要由应用约定；ADK 的 `Shutdown` 只关闭它自己持有的 provider。

### 5. context provider 不是可变全局时钟

`WithTimeProvider`/`WithUUIDProvider` 只在返回 context 的调用树中生效。若在 Runner 外创建 Event，或把另一个未携带 provider 的 context 传给底层服务，测试不会得到固定时间/ID。要验证事件序列，必须把同一个 context 传过完整调用链。

## 五、架构边界

```text
Runner / Flow / Tool
       │
       ├─ 使用 agent.Context，但不拥有 auth provider
       ├─ 创建 Event，但不持有全局时钟
       └─ 产生 span/log，但不决定 exporter

auth      → outbound HTTP 的身份材料
telemetry → OTel provider 的装配与生命周期
platform  → 当前调用树的可替换系统操作
```

`auth` 解决的是“请求以谁的身份发出”，不是 REST 入站认证；后者由 `server/authn` 和 `server/authz` 负责，见 [Server](/blog/adk-server/)。`telemetry` 也不是 Plugin：Plugin 可以观察 ADK 生命周期并改写结果，Telemetry 只提供观测后端。`platform` 更不是 Session Service，它只提供时间、UUID 和任务调度三个系统操作的 seam。

## 六、这些模块解决了什么问题

### 1. 把外部身份从工具代码中抽离

工具或远程适配器只需要配置一个 `http.Client{Transport: &auth.Transport{...}}`，不用在每个请求里重复 token、header 和 refresh 逻辑。

### 2. 让观测初始化有明确的所有权

`Providers` 把创建、global 注册和关闭集中到一个对象，避免“启动时创建但从未 flush”的隐性泄漏。

### 3. 让事件测试不依赖墙上时钟

context-scoped time/UUID provider 能固定 Event 的时间和 ID，同时保持并发测试之间互不污染。

代价是调用链必须保留 context 和生命周期责任：丢掉 context、忘记 shutdown，或把入站身份和出站 credential 混用，都会让这些抽象失去意义。

## 七、重点结论与常见误解

- `CredentialProvider` 解析 credential，`Credential` 写 header，`Transport` 连接 HTTP；三者不能互换。
- ADC 是惰性、可复用的 token source，不是一次启动就把 token 写进全局变量。
- `SetGlobalOtelProviders` 是可选注册动作；`telemetry.New` 本身不代表 global 已生效。
- `WithTimeProvider` 和 `WithUUIDProvider` 只影响携带它们的 context 派生树。
- 出站 auth 与入站 REST authn/authz 是两套边界；不要用同一个名词推断同一实现。
- `ConsentRequiredError` 的授权 URI 和 nonce 是敏感恢复材料，不能把 `Error()` 以外的字段直接喂给模型或日志系统。

## 八、相关源码与进一步阅读

- [auth/doc.go](https://github.com/google/adk-go/blob/v2.4.0/auth/doc.go)：包职责与 Credential/Provider/Transport 分层。
- [credential.go](https://github.com/google/adk-go/blob/v2.4.0/auth/credential.go)：API key、Bearer、Basic、OAuth2。
- [providers.go](https://github.com/google/adk-go/blob/v2.4.0/auth/providers.go)：StaticToken、ADC、ServiceAccount 与惰性初始化。
- [transport.go](https://github.com/google/adk-go/blob/v2.4.0/auth/transport.go)：按请求解析凭据并 clone Request。
- [auth/gcp/client.go](https://github.com/google/adk-go/blob/v2.4.0/auth/gcp/client.go)、[agentidentity.go](https://github.com/google/adk-go/blob/v2.4.0/auth/gcp/agentidentity.go)、[connector.go](https://github.com/google/adk-go/blob/v2.4.0/auth/gcp/connector.go)：Agent Identity / IAM Connector transport client。
- [telemetry.go](https://github.com/google/adk-go/blob/v2.4.0/telemetry/telemetry.go)：Providers、global 注册与 shutdown。
- [config.go](https://github.com/google/adk-go/blob/v2.4.0/telemetry/config.go)：Cloud 导出和 OTel processor 选项。
- [platform/time.go](https://github.com/google/adk-go/blob/v2.4.0/platform/time.go)、[platform/uuid.go](https://github.com/google/adk-go/blob/v2.4.0/platform/uuid.go)：可替换的时间和 ID。
- [Context](/blog/adk-context/)：这些 context 能力如何进入 callback、tool 和 workflow。
- [Server](/blog/adk-server/)：入站 HTTP 认证、授权和协议适配。
