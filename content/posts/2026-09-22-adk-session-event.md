---
title: Agent Development Kit (ADK) . - Session&Event
date: 2026-09-22
tags:
  - agent
  - ai
  - golang
draft: false
slug: adk-session-event
description: Session 是一次会话的历史与状态容器，Event 是会话里的一条记录，State 是带作用域的键值。理解这三者，才能看懂 Runner 为什么那样落库、Agent 为什么那样读写状态。
---
ADK-Go 源码阅读笔记 · Session & Event

> 前两篇一直在说「事件流」「落库」「状态」，这一篇把它们的数据模型翻出来。Session 是一次会话的历史与状态容器，Event 是会话里的一条记录，State 是带作用域的键值。理解这三者，才能看懂 Runner 为什么那样落库、Agent 为什么那样读写状态。

源码：`session/service.go`（接口）、`session/session.go`（数据模型）、`session/inmemory.go`（内存实现）。

## 三层生命周期：Session ⊃ Invocation ⊃ Event

读数据模型之前，先立一个心智框架——三个嵌套的生命周期：

```
Session：一段持续多轮的会话
  └── Invocation：用户发起的一轮执行
        └── Event：这一轮里产生的一条原子记录
```

一个具体例子：

```
Session: order-support-001
├── Invocation 1
│   ├── 用户输入 Event
│   ├── Agent FunctionCall Event
│   ├── Tool FunctionResponse Event
│   └── Agent 最终回答 Event
└── Invocation 2
    ├── 用户输入 Event
    └── Agent 最终回答 Event
```

归属靠两个 ID 串起来：多个 Event 靠相同的 `InvocationID` 归到同一轮执行，多个 Invocation 靠相同的 `SessionID`（准确说是 `(AppName, UserID, SessionID)` 三元组）归到同一段会话。同一个用户可以有多个 Session，同一个 Session 又可以包含很多轮 Invocation。这三层关系是后面一切落库、状态读写的坐标系。

## 一、`session.Service` (Storage) 接口

The Service interface defines how sessions are persisted. ADK provides multiple implementations.

所有会话后端都实现这五个方法（`session/service.go:46-77`），全部基于请求/响应结构体：

```go
// It provides a set of methods for managing sessions and events.
type Service interface {
    Create(context.Context, *CreateRequest) (*CreateResponse, error)
    Get(context.Context, *GetRequest) (*GetResponse, error)
    List(context.Context, *ListRequest) (*ListResponse, error)
    Delete(context.Context, *DeleteRequest) error
    AppendEvent(context.Context, Session, *Event) error
}
```

配套：

- 哨兵错误 `ErrNotFound`（`service.go:41`）——只有 `Get` 和 `AppendEvent` 会包它；`Delete` 是幂等 no-op，`List` 找不到就返回空。REST 层把它映射成 404。
- 便捷构造器 `InMemoryService()`（`service.go:80`）。
- `GetRequest` 带过滤：`NumRecentEvents int`（`:111`）和 `After time.Time`（`:114`），用来只取最近若干条 / 某时间点之后的事件。

`AppendEvent` 的文档注释（`service.go:51-76`）规定了两条被共享 conformance 测试套件强制的契约：

 - **(a)** 到达时没有 `ID` 的事件必须被赋一个；
 - **(b)** `EventActions.Compaction` 必须能在存储往返中存活。这两条后面会解释为什么重要。

实现
 - Database → [/adk-session-database](/blog/adk-session-database)
 - InMemory → [/adk-session-inmemory](/blog/adk-session-inmemory)
 - VertexAI

## 二、Session：一个接口，不是结构体

`Session` 是**接口**（`session/session.go:40-54`）：

A Session is the source of truth for an active interaction. It encapsulates the conversation history (Events) and the context (State).

```go
// Session represents a series of interactions between a user and agents.
type Session interface {
    ID() string
    AppName() string
    UserID() string
    State() State
    Events() Events
    LastUpdateTime() time.Time
}
```

内存实现是未导出的 `session` 结构体（`session/inmemory.go:319-327`）：

```go
type session struct {
    id        id             // appName, userID, sessionID
    mu        sync.RWMutex   // 保护可变字段
    events    []*Event
    state     map[string]any
    updatedAt time.Time
}
```

配套的还有 `State`（`session.go:59`，Get/Set/All）、`ReadonlyState`（`session.go:75`）、`Events`（`session.go:87`，All/Len/At）几个小接口。

## 三、Event：内嵌 LLMResponse 的一条事件

`Event`（`session/session.go:100-149`）最值得注意的是它**内嵌了 `model.LLMResponse`**（`:101`），所以模型输出的所有字段（`Content`、`Partial` 等）都被提升到 Event 上：

```go
type Event struct {
    model.LLMResponse                  // :101 内嵌：Content / Partial / ...
    ID             string             // :104 由存储赋值
    Timestamp      time.Time          // :105 由存储赋值
    InvocationID   string             // :108 由 agent.Context 赋值
    Branch         string             // :116 如 agent_1.agent_2
    IsolationScope string             // :121 prompt 历史可见性闸门
    Author         string             // :123 "user" 或 agent 名
    Actions        EventActions       // :126 事件携带的副作用
    LongRunningToolIDs []string       // :130 HITL 长任务标记
    Routes         []string           // :132 workflow 路由
    RequestedInput *RequestInput      // :141 HITL 暂停信号
    Output         any                // :144 workflow 节点输出
    NodeInfo       *NodeInfo          // :148 workflow 节点元数据
}
```

`NewEvent(ctx, invocationID)`（`session.go:239`）通过 `platform` 包分配 ID/时间戳（可替换以便确定性重放），并预分配两个 delta map。

**`EventActions`**（`session/session.go:249-277`）是「这条事件想产生哪些副作用」的载体：

```go
type EventActions struct {
    StateDelta                 map[string]any                 // 状态变更
    ArtifactDelta              map[string]int64               // 文件名 → 版本号
    RequestedToolConfirmations map[string]toolconfirmation.ToolConfirmation
    SkipSummarization          bool                           // 暂停循环等用户确认
    TransferToAgent            string                         // 转交给某 Agent
    Escalate                   bool                           // LoopAgent 退出信号
    Compaction                 *EventCompaction               // 仅框架可写
}
```

几个耐人寻味的行为：

- `MarshalJSON`（`session.go:297`）用影子指针字段，使 `StateDelta`/`ArtifactDelta` 在 nil 时省略、在「已分配但空」时输出 `{}`——因为 adk-python 拒绝这些非可选 dict 为 `null`，这是跨运行时互操作的妥协。
- `Compaction` 是框架专属：append 时深拷贝（`clone()`，`session.go:382`），并在拷贝调用方 actions 的地方被清空，所以工具/回调**伪造不了**压缩记录（这就是《2 Runner》里 `fromPlugin` 要「先存后恢复」压缩记录的原因）。
- `IsFinalResponse()`（`session.go:218`）对压缩事件返回 false（纯簿记，无内容）。
- `UnmarshalJSON`（`session.go:485`）能同时吃 RFC-3339 字符串时间戳（本包编码）和数字 epoch 秒（adk-python 编码），并把 Python 传来的全零 `NodeInfo` 置 nil——又是一处跨实现兼容。

## 四、State 的三种作用域

状态不是一个扁平 map，而是通过 key 前缀划分作用域（`session/session.go:416-429`）：

```go
const (
    KeyPrefixApp  = "app:"   // 跨该 app 的所有用户+会话共享
    KeyPrefixTemp = "temp:"  // 仅本次 invocation，结束即丢弃
    KeyPrefixUser = "user:"  // 该用户在此 app 下的所有会话共享
)
```

无前缀的 key = 会话级。这套划分的拆/合逻辑在 `internal/sessionutils/utils.go`：

- `ExtractStateDeltas(delta)`（`utils.go:31`）把一个混合 delta 拆成 app / user / session 三份：剥掉 `app:`/`user:` 前缀分别归类，**`temp:` 直接丢弃**，其余归 session。
- `MergeStates(app, user, session)`（`utils.go:58`）是读取时的逆操作：session key 原样，app/user key 重新加回前缀。

所以**你在 `ctx.State()` 看到的那个带前缀的扁平 map，其实是一个投影**。内存服务内部物理上分三份存（`appState`、`userState`、每会话 `state`，`inmemory.go:40-44`），`ExtractStateDeltas`/`MergeStates` 就是「线上视图 ↔ 存储视图」的拆合层。

`temp:` 有两条独立的丢弃路径：`ExtractStateDeltas` 在路由到持久存储时忽略它；`trimTempDeltaState`（`inmemory.go:443`）在事件存入会话事件日志**之前**再剥一次。

## 五、内存服务如何 append 事件 + 应用 state delta

入口 `inMemoryService.AppendEvent`（`session/inmemory.go:197-268`），调用链：

```
AppendEvent(ctx, curSession, event):
  1. 校验；若 event.Partial → 直接短路（partial 从不落库）    inmemory.go:204
  2. event.ID 为空则就地赋值（满足 Service 契约 a）          inmemory.go:212
  3. 断言 curSession 为 *session；锁 service.mu               inmemory.go:216
  4. 按编码 key 找到存储的 session；找不到 → ErrNotFound       inmemory.go:224
  5. sess.appendEvent(event)：更新调用方的 live session        inmemory.go:237
       ├─ updateSessionState：maps.Copy(完整 StateDelta，含 temp:)
       └─ trimTempDeltaState + append + 更新 updatedAt
  6. 另组 eventCopy 写进 omap 里的 canonical record          inmemory.go:244
       只 clone StateDelta / ArtifactDelta / Compaction 等几个字段
       RequestedInput / NodeInfo / LLMResponse.Content 仍是原指针
  7. ExtractStateDeltas → appState / userState / stored.state  inmemory.go:271
```

fan-out 那一段（`inmemory.go:261-266`）是理解作用域落库的关键：

```go
if len(event.Actions.StateDelta) > 0 {
    appDelta, userDelta, sessionDelta := sessionutils.ExtractStateDeltas(event.Actions.StateDelta)
    s.updateAppState(appDelta, curSession.AppName())
    s.updateUserState(userDelta, curSession.AppName(), curSession.UserID())
    maps.Copy(stored_session.state, sessionDelta)
}
```

canonical record 不是 live 那条的镜像：`StateDelta` / `ArtifactDelta` / `Compaction` 会 clone，`RequestedInput` / `NodeInfo` / `LLMResponse.Content` 仍是原指针。详细写法见 [/adk-session-inmemory](/adk-session-inmemory)。读取时 `Get`/`List` 再通过 `mergeStates`（`inmemory.go:307`）把三份作用域合回一个扁平视图，并应用 `NumRecentEvents`/`After` 过滤。

## 六、其它后端（角色速览）

- `session/database`（`service.go`）：GORM 支持的 `Service`，可接 PostgreSQL / Spanner / SQLite。构造器 `NewSessionService(dialector, opts...)`。
- `session/vertexai`（`vertexai.go`）：Vertex AI Agent Engine 后端。**它由服务端赋事件 ID，并在读取时重新赋 ID**——这正是 `EventRef`（`session.go:410`）用 `{InvocationID, Timestamp}` 而不用事件 ID 作 key 的原因。
- `session/compaction`：不是 `Service`，而是总结层。它**从不改动历史**，只 append 一条带 `EventCompaction` 的事件，其覆盖范围在拼 prompt 时被跳过并替换为摘要。

## 七、Partial 事件与 IsFinalResponse

两个和「哪些事件算数」相关的概念，实际使用时最容易踩坑。

**Partial 事件**是流式模型吐出的增量片段：

```
event.Partial == true
"订" → "订单" → "订单已" → "订单已确认"
```

规则很干脆：Runner 会把 partial 事件 yield 给客户端做实时显示，但**绝不落库**`runner.go:766`、内存服务 `inmemory.go:204`）。只有最终那条非 partial 事件才进 `Session.Events`。否则历史里会塞满文本碎片，下一轮拼 prompt 时上下文全是重复内容。

**`IsFinalResponse()`**（`session.go:218`）判断一条事件是否是某个 Agent 的最终响应。下面这些都**不是**最终响应：partial 片段、FunctionCall、FunctionResponse、尾部的 CodeExecutionResult、Compaction 记录。但有例外——等待长任务工具、或设了 `SkipSummarization` 的事件会终止当前 Agent 回合，因此**会**被视为该 Agent 的 final response。

一个常被误解的点：

> 一个 Invocation 里可能有多个 Agent（转交、子 Agent），因此可能出现**多个** `IsFinalResponse()==true` 的事件。它不是「整轮只有一条终态事件」的保证。

## 八、Workflow 相关字段与 Resume

《Workflow》会详讲引擎，这里只看它往 Event 上挂了什么、以及为什么 Resume 能只靠事件历史。Workflow 调度器会在事件上填：`Output`（传给下游节点的业务数据）、`Routes`（该走哪些条件边）、`Branch`、`NodeInfo`（归属哪个节点）、`RequestedInput`（HITL 暂停信号）、`LongRunningToolIDs`。

这里要分清四个极易混淆的字段：

| 字段 | 用途 |
|---|---|
| `Content` | 显示给用户 / 加入 LLM 历史的消息、FunctionCall、FunctionResponse |
| `Output` | 传给下游 workflow 节点的业务数据 |
| `Routes` | 选择哪条条件边（如 `approved` 分支） |
| `Actions.StateDelta` | 更新 Session 状态 |

它们可以同时出现在一条事件上，但用途完全不同：`Content` 给人和模型看，`Output` 给下游节点，`Routes` 给调度器选路，`StateDelta` 落到状态。

`NodeInfo`（如 `Path: "research_workflow@1/researcher@1"`）的作用是把事件归属到具体节点、从历史恢复节点输出、区分 DynamicNode 自身事件与子节点事件、表达 `WithUseAsOutput` 的输出委托链。当没有显式 `Output` 时，`MessageAsOutput` 允许把模型文本当作节点输出。

**为什么 Resume 不依赖内存里的旧调度器？** 因为 workflow 的运行状态全能从 Session 事件历史重建。暂停时产生一条带 `RequestedInput`/`LongRunningToolIDs`/`InvocationID`/`NodeInfo.Path`/`Branch` 的事件；用户回复也成为一条事件，其 `FunctionResponse.ID == RequestInput.InterruptID`。恢复时扫描历史即可还原：哪个节点在哪个 Branch 暂停、原始输入是什么、哪些中断已被响应、前置节点产过什么 Output。所以 Resume 靠的是事件流，不是存活的 Scheduler 对象。

## 九、心智模型：Event 是事实，State 是快照

把三者的关系收束成一句话：

```
Event         —— 一件已经发生的事（消息 / 工具调用 / 节点输出 / 状态变更）
Session.Events —— 按时间排列的事实日志
Session.State  —— 所有 StateDelta 应用后的当前结果
```

State 不记录「怎么一步步变过来」，只保留当前值：

```
Events:  stage=new → stage=reviewing → stage=approved
State:   stage=approved
```

放回 workflow 里就是一条闭环：

```
Node 产生 Event
   ↓
Scheduler 读 Output / Routes 决定下一步
   ↓
Runner 把非 partial Event 追加进 Session
   ↓
Session Service 应用 StateDelta（按 app/user/session 作用域 fan-out）
   ↓
后续节点 / 下一轮 Invocation 读历史与状态
```

## 十、本篇要点

- **一个接口五个方法**，请求/响应结构体风格；`ErrNotFound` 是唯一需要 `errors.Is` 的哨兵。
- **Event 内嵌 `model.LLMResponse`**，并额外挂 `Actions`（副作用）、`Branch`/`IsolationScope`（可见性）、HITL 与 workflow 相关字段。
- **`EventActions.Compaction` 框架专属**，深拷贝 + 清洗防篡改；跨 Python 互操作在 JSON 编解码里到处留痕。
- **State 三作用域（app/user/temp + 会话级）是投影**：对外扁平带前缀，对内物理分三份，`ExtractStateDeltas`/`MergeStates` 负责拆合，`temp:` 永不持久化。
- **partial 不落库、事件深拷贝存储**，是内存服务两条一致贯彻的规则。
