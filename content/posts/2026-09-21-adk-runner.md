---
title: Agent Development Kit (ADK) . - Runner
date: 2026-09-21
tags:
  - agent
  - ai
  - golang
draft: false
slug: adk-runner
description: Agent 决定「做什么」，Runner 决定「怎么把一次请求跑完」。这一篇拆解 `runner.Runner`：它如何串起会话、工件、记忆三大服务和插件系统，如何把一句用户消息变成一串落库的事件，以及那个容易被忽略但设计得很讲究的压缩（compaction）机制。
---

ADK-Go 源码阅读笔记 · Runner

> Agent 决定「做什么」，Runner 决定「怎么把一次请求跑完」。这一篇拆解 `runner.Runner`：它如何串起会话、工件、记忆三大服务和插件系统，如何把一句用户消息变成一串落库的事件，以及那个容易被忽略但设计得很讲究的压缩（compaction）机制。

源码主要在 `runner/runner.go`，外加节点路径的 `runner/run_node.go`、`runner/agent_node.go`。

## 一、Runner 结构体：一次编排需要哪些零件

`runner.Runner`（`runner/runner.go:224-239`）：

```go
type Runner struct {
    appName           string                          // :225
    rootAgent         agent.Agent                     // :226
    sessionService    session.Service                 // :227  必填
    artifactService   artifact.Service                // :228  可选
    memoryService     memory.Service                  // :229  可选
    parents           parentmap.Map                   // :231  预算好的 Agent 树父子关系
    pluginManager     *plugininternal.PluginManager   // :232
    autoCreateSession bool                            // :233
    compactionConfig  *compaction.Config              // :238  nil 表示关闭压缩
}
```
`func New(cfg Config) (*Runner, error)`

```go
// Config is used to create a [Runner].
type Config struct {
    AppName string
    // Root agent which starts the execution.
    Agent          agent.Agent
    SessionService session.Service

    // optional
    ArtifactService artifact.Service
    // optional
    MemoryService memory.Service
    // optional
    PluginConfig PluginConfig
    // optional
    AutoCreateSession bool
    // optional
    Compaction *compaction.Config
}
```

几个要点：

- `rootAgent` 的**类型**决定 `Run` 走哪条路：是 `LlmAgent` 走「节点路径」，否则走「传统 Agent 路径」（`runner.go:570`）。
- `sessionService` 是唯一必填的服务（`New` 里 nil 会报错，`runner.go:118`）；artifact / memory 可选，非 nil 时才会在每次 run 里构造对应的适配器。
- `parents` 是构造时用 `parentmap.New` 预算好的父子映射（`runner.go:122`），供「跨 Agent 树能否 transfer」的判断使用。
- `compactionConfig` 是 `Config.Compaction` 校验并解析 summarizer 后的副本；nil 就彻底不压缩。

对应的 `runner.Config`（`runner.go:48-79`）就是上面这些的公开版本：`AppName`、`Agent`、`SessionService`（必填），`ArtifactService`、`MemoryService`、`PluginConfig`、`AutoCreateSession`、`Compaction`（可选）。`New` 也提供 `NewInMemory`（`runner.go:210`）这个便捷构造器。

> 澄清一个常见误解：**Runner 没有 `RunWithConfig` 方法**。公开的运行入口只有两个——`Run`（`runner.go:536`）和 `RunLive`（`runner.go:851`）。单次运行的微调通过 `RunOption`（如 `WithStateDelta`、`WithYieldUserMessage`）完成。




## 二、Run 返回的是一个惰性事件流

`Run` 的签名（`runner.go:536`）：

```go
func (r *Runner) Run(ctx context.Context, userID, sessionID string,
    msg *genai.Content, cfg agent.RunConfig, opts ...RunOption,
) iter.Seq2[*session.Event, error]
```

它返回一个 `iter.Seq2` —— Go 1.23 的 range-over-func。**关键：返回时什么都还没做**，全部逻辑都在返回的 `func(yield func(*session.Event, error) bool)` 闭包里（`runner.go:540`），只有当调用方 `for event, err := range …` 时才真正执行。

流的契约有几条，值得记住：

- 每次迭代要么 `(event, nil)` 要么 `(nil, err)`。
- **错误不一定终止迭代**：Agent 报错时先 yield，只有 `yield` 返回 false 才停，否则 `continue`（`runner.go:727-732`）。
- `yield` 返回 false = 消费方不要了，生产方必须停止且**绝不能再调 yield**——所以那些提前退出的分支是「记日志」而不是「再 yield」（`runner.go:646`）。
- **partial 事件**（流式增量）会 yield 给调用方，但**不落库**（`runner.go:766`）。

## 三、Run 的完整流程（传统 Agent 路径）

以 root 不是 LlmAgent 的路径为例（LlmAgent 会在第 4 步分叉到节点路径），逐步拆：

```
Run(ctx, userID, sessionID, msg, cfg):
  1. 包装 yield：任何 err 都置 invocationFailed=true             runner.go:546
       （用来防止「跑坏的一轮」被压缩）
  2. 应用 RunOptions → runOptions{stateDelta, yieldUserMessage}   runner.go:555
  3. getOrCreateSession(ctx, userID, sessionID)                  runner.go:560 / 510
       SessionService.Get；失败且 autoCreateSession → Create
  4. 分叉：isLlmAgent(rootAgent)?                                runner.go:570
       是  → runNode(...)（见第五节），return
       否  → 继续 ↓
  5. context 装配：parentmap / runconfig / plugin / compaction    runner.go:633
  6. defer compactOnce()（保证压缩一定会跑）                      runner.go:652
  7. 构造 Artifacts / Memory 适配器（服务非 nil 时）              runner.go:666
  8. icontext.NewInvocationContext(...)                          runner.go:686
       绑定 Agent / Session / Artifacts / Memory / UserContent / RunConfig
  9. appendMessageToSession(...)：把用户消息落库                  runner.go:697 / 1059
       ├─ 先跑 Plugin.OnUserMessage 回调
       ├─ 可选：把输入 blob 存成 artifact
       └─ SessionService.AppendEvent（Author="user"）
 10. defer Plugin.AfterRun                                       runner.go:707
 11. Plugin.BeforeRun：若返回早退结果/错误                       runner.go:709
       → 追加并 yield 一个早退事件，然后 return
 12. for event, err := range rootAgent.Run(ctx) {                runner.go:726
       ├─ err → yield；yield 返回 false 则停
       ├─ Plugin.OnEvent 回调（可改写事件；先存好 Compaction）    runner.go:754
       ├─ 非 partial → SessionService.AppendEvent 落库           runner.go:766
       └─ yield 给调用方                                         runner.go:773
     }
 13. compactOnce()（drain 后再补一次；与 defer 幂等）             runner.go:784
```

注意 memory/artifact：Runner 的 `Run` 本身并不直接调 memory 服务，而是把它们通过 invocation context 的适配器暴露给 Agent（第 7、8 步）。记忆的写入是服务/Agent 自己的事。

那个「包装 yield 记录失败」的小技巧值得看一眼（`runner.go:546-553`）：

```go
invocationFailed := false
emit := yield
yield = func(ev *session.Event, err error) bool {
    if err != nil { invocationFailed = true }
    return emit(ev, err)
}
```

以及核心的消费循环（`runner.go:726`，精简）：

```go
for event, err := range r.rootAgent.Run(ctx) {
    // ... nil / error / MessageAsOutput 处理 ...
    if pluginManager != nil {
        record := event.Actions.Compaction              // 先保存框架写的压缩记录
        modifiedEvent, err := pluginManager.RunOnEventCallback(ctx, event)
        event = fromPlugin(event, modifiedEvent, record) // 恢复压缩记录，防插件篡改
    }
    if !event.LLMResponse.Partial {
        r.sessionService.AppendEvent(ctx, storedSession, event)  // 非 partial 才落库
    }
    if !yield(event, nil) { return }
}
```

## 四、Compaction：把历史压缩掉，但别把这一轮搞坏

长对话会撑爆上下文窗口，compaction 就是「把旧历史总结成一条摘要事件」的机制。`compactionConfig`（`runner.go:238`）驱动两种策略（定义见 `session/compaction/compaction.go:157`）：

- **滑动窗口（Sliding window）**：`CompactionInterval` + `OverlapSize`。在**一次 invocation 完成之后**运行，按整个 invocation 为粒度做总结。`CompactionInterval > 0` 时启用。
- **尾部保留（Tail retention）**：`TokenThreshold` + `EventRetentionSize`。在**一次 invocation 内、模型调用之前**运行，由请求处理器读上下文里的 compaction runtime 触发。它直接 append，且**不跑插件钩子**。

构造期解析：`resolveCompactionConfig`（`runner.go:163`）校验配置、拷贝一份，若没设 `Summarizer` 就用 root agent 的模型装一个 `LLMSummarizer`——如果 root 不是 LLM agent 或没有模型，就报错（`runner.go:176-201`），并有 60s 超时（`defaultSummarizerTimeout`，`runner.go:156`）。

**什么时候跑滑动窗口压缩？** `compactAfterInvocation`（`runner.go:263`）通过 defer 里的 `compactOnce` 触发。它的守卫层层叠叠，体现了这机制的谨慎：

```
compactAfterInvocation:
  · 只在 HasSlidingWindow 时跑                    runner.go:264
  · panic 恢复：把 summarizer 的 panic 变成
    ErrCompaction 错误，而不是让进程崩溃           runner.go:276
  · 若尾部保留已在本轮压缩过 → 跳过                runner.go:286
  · 若 ctx.Err() != nil → 跳过                     runner.go:292
  · 重新加载 session（用当前状态而非快照）          runner.go:303
  · SlidingWindow 生成摘要 + finish 回调           runner.go:308
  · 竞态守卫：若期间有新事件落进摘要范围 → 放弃      runner.go:341 / 406
  · 摘要过一遍 Plugin.OnEvent（这是对 Python 的
    刻意分歧——Python 直接 append）                 runner.go:382
  · AppendEvent 落库                              runner.go:416
  · 追加后修复（处理未受守卫保护的 append 期间落入
    的零散事件）                                    runner.go:434
```

**为什么压缩要挂 defer？** 因为消费方可能在拿到终止事件后 `break`（比如 A2A executor 就这么干），如果压缩只写在循环结束之后，就会被跳过。挂 defer 才能保证无论迭代如何结束都会跑（`runner.go:640`）。

`compactOnce` 本身是幂等的（`runner.go:652-664`）：

```go
compacted := false
compactOnce := func() error {
    if compacted || invocationFailed { return nil }   // 跑坏的一轮不压缩
    compacted = true
    return r.compactAfterInvocation(ctx, storedSession, invocationCtx)
}
defer func() {
    if err := compactOnce(); err != nil { log.Printf("adk: %v", err) }
}()
```

一个重要细节：**摘要永远不会 yield 给调用方**，它只是给下一轮拼 prompt 用的簿记。压缩失败也是**非致命**的独立错误 `compaction.ErrCompaction`（`compaction.go:135`）——这一轮的事件早已落库，调用方可以 `errors.Is` 判断后继续。

## 五、节点路径：LlmAgent 是怎么被当成 workflow 节点跑的

当 root 是 `LlmAgent`，`Run` 在第 4 步分叉到 `runNode`（`runner/run_node.go:66`）。核心思路：**把这个 Agent 包成一个只有 `START → node` 的极简 workflow，交给 workflow 引擎跑**，从而与 Python 的事件路径对齐，并天然获得 HITL 恢复能力。

任意 Agent 变成节点的转换在 `newAgentNode`（`runner/agent_node.go:43`）：

```go
func newAgentNode(a agent.Agent) workflow.Node {
    cfg := workflow.NodeConfig{EmitsOwnSpan: true}
    if isLlmAgent(a) {
        cfg.RerunOnResume = &rerunOnResume   // LlmAgent 恢复时重跑
    }
    return workflow.NewDynamicNode(a.Name(), runAgentNodeBody(a), cfg)
}
```

`runNode` 的流程（`run_node.go`）：挂 compaction runtime → 用 `buildRunnerNode`→`newAgentNode` 造节点 → 包进 `START → node` 的合成 workflow（`WithRootWrapper()` 保持与 Python 事件路径一致）→ 建节点 invocation context → 落库用户消息（若设了 `WithYieldUserMessage` 也会 yield）→ 跑 Before/AfterRun 插件钩子 → 用 `ReconstructRunState` 从会话历史重建 workflow 状态 → 根据是否有「已回答的待处理中断」决定走 `wf.Resume`（HITL 续跑）还是 `wf.Run`（全新一轮）。之后的消费循环与传统路径一样（OnEvent 钩子、非 partial 落库、yield），最后补一次 `compactOnce`。

HITL 的关键在 `runAgentNodeBody`（`agent_node.go:66`）：当某个事件带 `LongRunningToolIDs` 时，节点会「停车」（返回 `workflow.ErrNodeInterrupted`）。这套暂停/恢复机制在《6 Workflow》里完整展开。

## 六、本篇要点

- **Runner 是编排器，不是执行者**：它管服务装配、会话读写、插件生命周期、压缩，真正的智能行为下放给 root Agent。
- **`Run` 返回冷的 `iter.Seq2`**：range 时才执行；partial 事件 yield 但不落库；错误随流走，`yield` 返回 false 即停。
- **两条路径**：LlmAgent 走「合成 workflow 节点」路径（为了 HITL 与 Python 对齐），其余走传统 Agent 路径。
- **Compaction 用 defer 保证执行、用大量守卫保证安全**：滑动窗口在 invocation 后、尾部保留在模型调用前；摘要不 yield，失败非致命。
- **服务通过 InvocationContext 适配器下发**，Runner 自身不直接碰 memory。
