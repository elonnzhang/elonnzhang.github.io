---
title: Agent Development Kit (ADK) . - Memory
date: 2026-09-22
tags:
  - agent
  - ai
  - golang
draft: false
slug: adk-memory
description: Memory 是**跨会话**的长期知识：把若干 Session 摄取进去，之后用一段 query 把相关条目搜回来，拼进 prompt 或作为工具结果还给模型。
---
ADK-Go 源码阅读笔记 ·
{{< ann n amber "Keyword" >}}Memory{{< /ann >}}.
> Session 是**当前这段对话**的历史。Memory 是**跨会话**的长期知识：把若干 Session 摄取进去，之后用一段 query 把相关条目搜回来，拼进 prompt 或作为工具结果还给模型。Runner 把 `memory.Service` 塞进 InvocationContext（《2 Runner》），工具侧通过 `ctx.SearchMemory` 用（《Tool》）。框架**不会**在 `Run` 结束时自动入库——写入是调用方的事。

源码：`memory/service.go`（接口）、`memory/inmemory.go`（关键词检索）、`memory/vertexai/`（Vertex MemoryBank）、适配器 `internal/memory/memory.go`，消费侧 `tool/loadmemorytool`、`tool/preloadmemorytool`。

## 一、`memory.Service`：写入和检索两方法

```go
// memory/service.go:31-39
type Service interface {
    AddSessionToMemory(ctx context.Context, s session.Session) error
    SearchMemory(ctx context.Context, req *SearchRequest) (*SearchResponse, error)
}
```

```go
// SearchRequest represents a request for memory search.
type SearchRequest struct {
    Query   string
    UserID  string
    AppName string
}

// SearchResponse represents the response from a memory search.
type SearchResponse struct {
    Memories []Entry
}

// Entry represents a single memory entry.
type Entry struct {
    // ID is the unique identifier of the memory.
    ID string
    // Content contains the main content of the memory.
    Content *genai.Content
    // Author of the memory.
    Author string
    // Timestamp shows when the original content of this memory happened.
    // This string will be forwarded to LLM. Preferred format is ISO 8601    format.
    Timestamp time.Time
    // CustomMetadata contains optional custom metadata associated with the    memory.
    CustomMetadata map[string]any
}
```

`SearchRequest` 是 `{Query, UserID, AppName}`（`:41-46`）——**没有 SessionID**。记忆的作用域是「这个 app 下的这个用户」，不是某一轮对话。

`Entry`（`:53-66`）一条记忆就是一条被摄取的事件切片：`ID`（原事件 ID）、`Content`（`*genai.Content`）、`Author`、`Timestamp`、`CustomMetadata`。Timestamp 会原样转给 LLM，文档偏好 ISO 8601。

## 二、谁写入：不是 Runner，是调用方

全仓库生产路径里，`AddSessionToMemory` 的调用方是：

- `examples/tools/loadmemory/main.go`：示范里手动把上一段 session 摄进去
- `examples/agentengine/main.go`：在回调里 `ic.Memory().AddSessionToMemory(ic, ic.Session())`

Runner / Flow / REST handler **都没有**自动调用。这是和 Session 最关键的差别：Session 的 AppendEvent 由 Runner 保证；Memory 的摄取是应用策略——你可以每轮都加、只在会话结束时加、或从不加。

Context 上的适配器（`internal/memory/memory.go:24-40`）绑死了 `AppName` / `UserID`，工具里 `SearchMemory(ctx, query)` 不用自己填作用域。`AddSessionToMemory` 则把整份 `session.Session` 交出去，由实现自己按 App+User 归档。

## 三、in-memory：按词计分，最多 10 条

`InMemoryService()`（`memory/inmemory.go:37`）按 `{appName, userID}` 分桶。每个用户下再按 session ID 存一组 `value`。

`AddSessionToMemory`（`:75-130`）：

1. 扫 session 全部事件，跳过 `Content == nil`
2. 只收有文本的 parts，按空格切词、转小写，预计算 `words` 集合和 `textLower`
3. **整份 session 覆盖写入**——同一 session ID 再加一次是替换，不是追加。替换时保留它在 `sessionOrder` 里的位置（对齐 Python dict）

`SearchMemory`（`:132-200`）：

- 查询词同样按空格切。含非 ASCII 的词额外允许**子串匹配**（CJK 等没有空格分词）
- 每条记忆的分数 = 命中了几个不同的查询词
- 全量打分后再 `SortStable`（分数高优先；同分保持插入序），截断 `maxSearchResults = 10`
- 读锁覆盖整个扫描，避免和并发写入 race

这不是向量检索。query 和记忆文本共享的词越多越靠前；常见词会命中大半个 store，所以必须先排序再截断，否则后写入、更相关的事件可能进不了 prompt。

空 query（切完没有词）直接返回空列表，不报错。

## 四、Vertex MemoryBank：把生成交给云

`memory/vertexai.NewService`（`vertexai.go:46`）对接 Vertex Agent Engine 的 MemoryBank。`ServiceConfig.StateKeySessionLastUpdateTime`：

- 空：整份 session 送去生成记忆
- 非空：从 session state 读这个 key（必须是 `time.Time`），只送比它新的事件。注释警告这个值要尽早写上（例如 `BeforeRunCallback`），否则过滤窗口没锚点

`WaitForCompletion` 控制 add 是异步还是等 MemoryBank 做完。检索走 `client.searchMemory`，语义由服务端定义，不再是本地关键词。

## 五、两条消费路径

**`load_memory`（模型显式调用）**（`tool/loadmemorytool`）

- `ProcessRequest`：`PackTool` + 追加「你有记忆，需要时调 load_memory」instruction
- `Run`：从 args 取 `query`，`toolCtx.SearchMemory`，返回 `{"memories": []Entry}`

**`preload_memory`（模型看不见）**（`tool/preloadmemorytool`）

- 不往 `Config.Tools` 塞声明
- `ProcessRequest` 用**当前用户消息文本**当 query 搜一把，命中则把过去对话格式化进 `<PAST_CONVERSATIONS>` instruction
- 用户消息为空或没有记忆时静默跳过

两者都走同一个 `SearchMemory`。preload 每回合都花一次检索配额；load 由模型决定何时花。Callback context 上的 `SearchMemory` 被护栏拒绝（《4 Context》）——记忆检索是工具能力，不是回调能力。

## 六、{{< ann dir="nw" color="green" note="重点看这个" >}}本篇要点{{< /ann >}}

- Memory 的作用域是 {{< ann amber >}}App + User{{< /ann >}}，不是 Session。Session 是对话事实流，Memory 是跨会话检索层。
- **写入不是自动的。** `AddSessionToMemory` 由应用在合适的生命周期调用；同一 session 再加是覆盖。
- in-memory 是词重叠打分、最多 10 条、非 ASCII 走子串；Vertex 把生成和检索交给 MemoryBank。
- 模型侧两条入口：显式 `load_memory` 工具，或静默的 `preload_memory` 注入。
