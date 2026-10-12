---
title: Agent Development Kit (ADK) · 13 - Session Vertex AI
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
slug: adk-session-vertexai
series: adk
series_order: 13
description: 对照 ADK-Go v2.4.0，拆解 session/vertexai 如何把 Session Service 映射到 Vertex AI Agent Engine，并与 InMemory、Database 的语义边界对比。
---

# ADK-Go 源码阅读笔记 · Vertex AI Session：远端后端怎样保持 Session 契约

> **源码基准：[ADK-Go v2.4.0](https://github.com/google/adk-go/tree/v2.4.0)**，commit `4e57df40cbd35f055ba654b03ffb0e509fdd754a`。以下“当前实现”均指此版本。
>
> [返回 ADK 源码阅读合集](/blog/adk/) · 前置阅读：[Session、Event 与 State](/blog/adk-session-event/)、[InMemory](/blog/adk-session-inmemory/)、[Database](/blog/adk-session-database/) · 配套阅读：[Runner](/blog/adk-runner/)、[Server](/blog/adk-server/)。

`session.Service` 是 Runner 依赖的抽象，但不同后端并不提供相同的性能和事务语义。InMemory 把对象放在进程内，Database 把对象编码进本地数据库；`session/vertexai` 则把 Session、Event 和 State 映射到 Vertex AI Agent Engine 的 RPC。

这篇文章只追踪这个适配层，不把 Agent Engine 当成另一个 Runner。Runner 仍然负责 invocation 和事件消费，Vertex AI service 负责远端 Session 的创建、读取、列举、删除及追加。

## 一、源码入口与阅读地图

| 入口 | 源码 | 要回答的问题 |
| --- | --- | --- |
| 构造 | [`session/vertexai/vertexai.go#L34-L56`](https://github.com/google/adk-go/blob/v2.4.0/session/vertexai/vertexai.go#L34-L56) | Project、Location、ReasoningEngine 怎样变成 Service？ |
| Service | [`vertexai.go#L58-L155`](https://github.com/google/adk-go/blob/v2.4.0/session/vertexai/vertexai.go#L58-L155) | 五个公开操作如何委托远端 client？ |
| 本地句柄 | [`session.go#L29-L91`](https://github.com/google/adk-go/blob/v2.4.0/session/vertexai/session.go#L29-L91) | 远端 Session 返回后，Runner 持有的对象保存什么？ |
| State | [`session.go#L116-L154`](https://github.com/google/adk-go/blob/v2.4.0/session/vertexai/session.go#L116-L154) | State 的读写是否需要再次 RPC？ |
| RPC 映射 | [`vertexai_client.go#L69-L110`](https://github.com/google/adk-go/blob/v2.4.0/session/vertexai/vertexai_client.go#L69-L110) | Create 如何映射 Agent Engine resource？ |
| Get 并发 | [`vertexai.go#L69-L114`](https://github.com/google/adk-go/blob/v2.4.0/session/vertexai/vertexai.go#L69-L114) | Session 元数据和 Events 如何同时读取？ |

```text
runner.Run
   │ session.Service
   ▼
vertexAiService
   ├─ vertexAiClient.Get/Create/List/Delete
   ├─ Vertex AI Agent Engine RPC
   └─ localSession（本地句柄与快照）
          ├─ State() → 本地 map + mutex
          └─ Events() → 本地切片快照
```

## 二、接口与数据：远端资源加本地句柄

### 1. 配置中的 AppName 不是 Reasoning Engine ID

`VertexAIServiceConfig` 要求 ProjectID、Location 和 ReasoningEngine。创建 Session 时，client 会根据 `req.AppName` 解析对应的 Agent Engine resource，再把 `req.UserID`、初始 State 和可选 SessionID 转成 `CreateSessionRequest`（[`vertexai_client.go#L69-L105`](https://github.com/google/adk-go/blob/v2.4.0/session/vertexai/vertexai_client.go#L69-L105)）。因此一个 service 可以服务多个 app，但每个 app 必须能解析到自己的 reasoning engine。

### 2. localSession 仍是 Runner 可用的 Session

远端创建成功后返回 `localSession`。它实现公共 `session.Session`：身份字段来自请求/远端响应，Events 是受锁保护的指针切片快照，State 是受同一把锁保护的 map（[`session.go#L29-L74`](https://github.com/google/adk-go/blob/v2.4.0/session/vertexai/session.go#L29-L74)）。这意味着 Runner 读取 `sess.State()` 或 `sess.Events()` 时，不会为每次访问重新请求远端。

但这不是“所有数据已经永久同步”的保证：远端 Event 列表只在 Get 时装载，之后 AppendEvent 成功才更新本地句柄。

### 3. AppendEvent 先远端，再本地

`AppendEvent` 要求 Session ID 和非 nil Event，先调用 Agent Engine 的 append RPC，成功后才确认传入的是这个实现创建的 `*localSession`，并把事件应用到本地状态/事件列表（[`vertexai.go#L139-L155`](https://github.com/google/adk-go/blob/v2.4.0/session/vertexai/vertexai.go#L139-L155)）。传入 InMemory 或 Database 的 Session 会在本地类型检查处失败；这不是所有 `session.Session` 都能跨 Service 混用的接口承诺。

本地 append 会跳过 `Partial` 事件；非 partial 事件先应用 StateDelta，再剔除 `temp:` 状态键后保存到本地事件列表（[`session.go#L76-L90`](https://github.com/google/adk-go/blob/v2.4.0/session/vertexai/session.go#L76-L90)、[`#L156-L195`](https://github.com/google/adk-go/blob/v2.4.0/session/vertexai/session.go#L156-L195)）。远端是否已经接受事件，取决于 RPC 是否成功，不能由本地句柄的后续错误反推为“远端未写入”。

## 三、主执行路径：Get 为什么是两个 RPC

### 1. Create：创建远端，再等待可读资源

```text
CreateRequest(AppName, UserID, State)
        │
        ├─ resolve AppName → Agent Engine resource
        ├─ CreateSession RPC（可返回 long-running operation）
        ├─ 从 operation name 提取 session ID
        └─ waitForOperation → GetSession + ListEvents
```

当前实现的等待函数会轮询 Get；短暂的 NOT_FOUND 会按递增延迟重试，超过次数后返回超时（[`vertexai_client.go#L122-L146`](https://github.com/google/adk-go/blob/v2.4.0/session/vertexai/vertexai_client.go#L122-L146)）。这反映的是远端资源传播延迟，不是 Runner 的 retry policy。

### 2. Get：并行读取元数据和事件

`Get` 用 `errgroup.WithContext` 同时调用 `getSession` 和 `listSessionEvents`。任一调用失败会取消另一个；如果任一错误能确认 NOT_FOUND，service 重新包装为 `session.ErrNotFound`，避免并发失败时只暴露一个 context canceled（[`vertexai.go#L74-L111`](https://github.com/google/adk-go/blob/v2.4.0/session/vertexai/vertexai.go#L74-L111)）。成功后才把事件切片附到 localSession。

```text
GetRequest
   ├─ GetSession RPC ─────┐
   └─ ListEvents RPC ─────┤→ localSession.events
                          └→ session.GetResponse
```

这和 Database 的一次事务查询不同：这里是两个独立的远端读操作，由 errgroup 负责取消和错误合并。

### 3. StateDelta 怎样落到本地句柄

远端 append 成功后，本地 `updateSessionState` 把 Event 的 StateDelta 合并到 map；随后 `trimTempDeltaState` 只从保存到本地历史的事件副本中移除 `temp:` key，当前调用方持有的原 Event 不会被改写（[`session.go#L156-L195`](https://github.com/google/adk-go/blob/v2.4.0/session/vertexai/session.go#L156-L195)）。因此 Runner 立即看到的 Event 和下一次 Get 读回的 Event 可能在临时状态字段上不同。

## 四、关键分支与边界

### 1. UserID 是远端归属校验的一部分

读取远端 Session 时，client 比较返回的 `UserId` 与请求 UserID；不匹配会报错。Session ID 不是足够的授权边界，调用方仍应在服务层做好入站 authn/authz（[`vertexai_client.go#L149-L180`](https://github.com/google/adk-go/blob/v2.4.0/session/vertexai/vertexai_client.go#L149-L180)）。

### 2. 列表和删除的过滤能力来自远端 API

`List` 只要求 AppName，并委托 `listSessions`；它不像 InMemory 那样扫描本地复合键。`Delete` 则要求 AppName、UserID、SessionID，并调用远端删除（[`vertexai.go#L117-L136`](https://github.com/google/adk-go/blob/v2.4.0/session/vertexai/vertexai.go#L117-L136)）。不能把本地后端的排序、过滤或删除幂等细节直接套到 Vertex AI。

### 3. Partial Event 不进入本地历史

本地 `appendEvent` 对 Partial 直接返回 nil。它符合 Runner 对 partial 事件“不追加到 Session”的主线，但远端 append 的具体服务行为仍由 Agent Engine RPC 决定；本文不把本地跳过路径扩大成云端协议保证。

### 4. 失败可能发生在远端成功之后

远端 append 成功后，如果把 Session 断言成 `*localSession` 或本地状态更新失败，调用仍可能返回错误。应用应把这类错误视为“远端结果需要核对”，而不是自动重试同一个 Event；否则可能造成重复追加。

### 5. Compaction 是 Runner 的策略，不是 VertexAI Session 的隐藏功能

`session/compaction` 生成摘要 Event，Runner 决定何时调用它并把结果交给 Session Service。Vertex AI backend 负责保存 Event，不会因为使用远端 Session 就自动启用 compaction；配置和错误边界见 [Runner](/blog/adk-runner/)。

## 五、与其他后端的架构对照

| 后端 | 数据位置 | `Get` 语义 | Append 后本地对象 | 典型边界 |
| --- | --- | --- | --- | --- |
| InMemory | 进程内复合键 map | 直接找对象 | 同一进程内更新 | 进程退出即丢失 |
| Database | GORM 数据库 | 查询/解码 | 数据库事务与本地 session wrapper | JSON 类型/事务边界 |
| Vertex AI | Agent Engine RPC | 元数据与 events 并行远端读取 | RPC 成功后更新 localSession | 网络、传播延迟、远端归属 |

三者都实现 `session.Service`，但这个接口只规定方法和错误契约，不规定延迟、事务或跨进程一致性。Runner 的正确使用方式是依赖接口，具体恢复/重试策略则要看后端。

## 六、这个模块解决了什么问题

它让同一套 Runner/Agent 代码可以把 Session 放进 Vertex AI Agent Engine，而不把云 RPC 细节泄漏到 Agent 或 Flow。代价是：本地句柄只是远端快照，Create 可能等待 LRO，Get 有两个并发 RPC，Append 需要防止把不同后端的 Session 混用。

## 七、重点结论与常见误解

- `session/vertexai` 是 `session.Service` 的远端实现，不是另一个 Runner。
- `Get` 同时读取 Session 元数据和事件，NOT_FOUND 会被专门归一化；不要把并发取消误判为真实缺失。
- `AppendEvent` 的远端写入先于 localSession 更新；返回错误时要考虑远端可能已经成功。
- `localSession.State` 和 `Events` 是本地缓存/快照，不能等同于每次访问都实时读取 Agent Engine。
- Vertex AI backend 不自动打开 compaction；摘要策略仍由 Runner 和 `session/compaction` 配置决定。

## 八、相关源码与进一步阅读

- [session/vertexai/vertexai.go](https://github.com/google/adk-go/blob/v2.4.0/session/vertexai/vertexai.go)：Service 构造、CRUD、Get 并发和 AppendEvent。
- [session/vertexai/session.go](https://github.com/google/adk-go/blob/v2.4.0/session/vertexai/session.go)：localSession、State、事件快照和临时状态清理。
- [session/vertexai/vertexai_client.go](https://github.com/google/adk-go/blob/v2.4.0/session/vertexai/vertexai_client.go)：Agent Engine RPC、资源名和 LRO 等待。
- [Session、Event 与 State](/blog/adk-session-event/)：公共接口和事件契约。
- [InMemory](/blog/adk-session-inmemory/)、[Database](/blog/adk-session-database/)：本地后端的复制、事务和类型边界。
- [Runner](/blog/adk-runner/)：compaction、HITL 恢复和事件追加顺序。
