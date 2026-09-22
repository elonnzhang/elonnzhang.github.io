---
title: Agent Development Kit (ADK) . - Overview
date: 2026-09-20
tags:
  - agent
  - ai
  - golang
draft: false
slug: adk-overview
description: 一文了解 ADK 全貌
---

ADK-Go 源码阅读笔记 · 总览

> 本系列基于 `google.golang.org/adk/v2`（adk-go 的 2.x 主线）源码，逐模块拆解 Google Agent Development Kit 的 Go 实现。所有引用都标注 `文件:行号`，方便对照源码。仓库根目录：`adk-go/`。

## 一、ADK-Go 是什么

ADK Go 是一个 **code-first** 的 Go Agent 开发框架。它 model-agnostic（但对 Gemini 做了优化），是 ADK 家族（Python / Java / Kotlin / TypeScript / Go）中的一员。这些实现共享同一套概念模型，但各自独立演进——其中 **adk-python 是行为的事实标准（source of truth）**，Go 版本在大量地方注释里显式对齐 Python 的语义。

读源码之前，先记住一句贯穿全篇的话：

> `Runner` 负责「运行一次 Agent 调用」，但不决定智能行为本身。
> 具体行为由 `Agent` 决定；如果是 `LlmAgent`，则由模型和工具共同决定。

## 二、三层心智模型

可以把整个框架理解成从上到下三层，加上横切的服务与插件：

```
                       应用入口层
        Console / adkrest(HTTP) / adka2a / 自定义
                            │
                            v
                       运行时编排层
                          Runner              ← 一次请求的总调度器
                            │
     ┌──────────────────────┼──────────────────────┐
     v                      v                      v
 SessionService       ArtifactService         MemoryService
 会话历史+状态          文件/二进制               跨会话长期记忆
     └──────────────────────┼──────────────────────┘
                            v
                     InvocationContext          ← 把「这一次调用」的一切串起来
                            │
                            v
                       Agent 执行层
      Agent / LlmAgent / WorkflowAgent / RemoteAgent
                            │
              ┌─────────────┼─────────────┐
              v             v             v
            Model         SubAgents      A2A / MCP
          （模型推理）    （子 Agent 树）  （远程 Agent）
                            │
                            v
                          Tool
```

横切一切的还有 **Plugin**（全局生命周期钩子）和 **Callback**（单 Agent 钩子），它们不在上面的竖直链条里，而是缠绕在每一层的 before/after 边界上。

## 三、一条贯穿全系列的主线：iter.Seq2 事件流

理解 adk-go 最关键的一个设计决策：**每一层都返回 `iter.Seq2[*session.Event, error]`**（Go 1.23 的 range-over-func 迭代器）。

```go
// agent/agent.go:47
Run(InvocationContext) iter.Seq2[*session.Event, error]
```

这意味着：

- Runner 的 `Run`、Agent 的 `Run`、Workflow Node 的 `Run`，签名形状完全一致——都是「吐出事件、可能带错误」的流。
- **组合就是「range 子层的流，再 re-yield」**。SequentialAgent 顺序 range 每个子 Agent，LoopAgent 循环 range，Runner range 根 Agent……层层嵌套却是同一种拼法。
- 流是**惰性**的：不 range 就什么都不发生（`runner/runner.go:540` 整个逻辑都在返回的闭包里）。
- 错误作为第二返回值随事件一起流出，`yield` 返回 `false` 表示消费方不想再要了，生产方必须停止。

这条主线会在后面每一篇里反复出现。先记住这个形状，读后面就轻松了。

## 四、核心概念速查表

| 概念 | 接口/类型 | 位置 | 一句话 |
|---|---|---|---|
| Agent | `agent.Agent` | `agent/agent.go:44` | 六方法接口，一切执行单元的抽象 |
| Runner | `runner.Runner` | `runner/runner.go:224` | 一次请求的编排器，串起服务、插件、根 Agent |
| Session | `session.Session` | `session/session.go:40` | 一次会话的历史与状态（接口） |
| Event | `session.Event` | `session/session.go:100` | 会话里的一条事件，内嵌 `model.LLMResponse` |
| State | `session.State` | `session/session.go:59` | 带 `app:`/`user:`/`temp:` 作用域的键值状态 |
| InvocationContext | `agent.InvocationContext` | `agent/context.go:63` | 一次 invocation 的作用域上下文 |
| Context | `agent.Context` | `agent/context.go:142` | 统一上下文，回调/工具/节点能力的全集 |
| Plugin | `plugin.Plugin` | `plugin/plugin.go` | 跨整个 run 的全局生命周期钩子 |
| LLM | `model.LLM` | `model/llm.go:26` | 两方法接口，`GenerateContent` 返回 `iter.Seq2[*LLMResponse, error]` |
| Tool | `tool.Tool` | `tool/` | 模型可调用的工具 |
| Workflow | `workflow.Workflow` | `workflow/workflow.go:150` | 静态图 + 调度器的多 Agent 编排引擎 |

## 五、一次请求的端到端流程

把最常见的路径（root 是一个 `LlmAgent`，用户发来一句话）走一遍，你会摸到几乎所有模块的边界。下面是 `runner.Run` 的骨架（`runner/runner.go:536`）：

```
用户 msg
  │
  ▼  runner.Run(ctx, userID, sessionID, msg, cfg)          runner/runner.go:536
  │    返回 iter.Seq2，range 时才真正执行（惰性）
  │
  ├─ getOrCreateSession                                     runner/runner.go:510
  │    SessionService.Get，失败且 autoCreate → Create
  │
  ├─ 构造 InvocationContext                                  icontext.NewInvocationContext
  │    绑定 Agent / Session / Artifacts / Memory / RunConfig
  │
  ├─ appendMessageToSession（把用户消息落库为 Event）        runner/runner.go:1059
  │    先跑 Plugin 的 OnUserMessage 钩子
  │
  ├─ Plugin.BeforeRun  （可短路整轮）                        runner/runner.go:709
  │
  ├─ for event := range rootAgent.Run(ctx) {                runner/runner.go:726
  │      ├─ Plugin.OnEvent 钩子（可改写事件）
  │      ├─ 非 partial 事件 → SessionService.AppendEvent 落库
  │      └─ yield 给调用方
  │  }
  │
  ├─ Plugin.AfterRun（defer，观察型）                        runner/runner.go:707
  │
  └─ 压缩 compaction（defer，保证一定跑）                     runner/runner.go:652
```

而 `rootAgent.Run(ctx)` 内部（若是 LlmAgent）又是一个「模型调用 → 工具调用 → 再模型调用」的回合循环，由 `internal/llminternal/base_flow.go` 的 `Flow.Run` 驱动，直到某个事件 `IsFinalResponse()`。这部分在《1 Agent》里细讲。

## 六、贯穿全篇的几个设计原则

这些原则来自仓库的 `AGENTS.md`，也在源码里处处印证，是理解 adk-go 的钥匙：

**1. Interface-first（接口优先）**
核心抽象都是接口：`agent.Agent`、`tool.Tool`、`tool.Toolset`，以及 `session`/`artifact`/`memory` 各自的 `Service`。具体实现藏在子包或 `internal/`，唯独 in-memory 实现放在接口旁边。

**2. 用 New 构造，而不是直接实现接口**
`agent.Agent` 接口里有一个**未导出**方法 `internal() *agent`（`agent/agent.go:52`），这让外部包**无法**直接实现它。所有 Agent 都必须经由 `agent.New` / `llmagent.New` / `sequentialagent.New` … 构造。这是刻意为之的演进策略（注释见 `agent/agent.go:42`）。

**3. Callbacks over subclassing（回调而非继承）**
定制行为靠传入 before/after 回调，而不是重写方法。回调按顺序执行，**第一个返回非 nil 内容的回调短路后续**。`Before` 模型/工具回调返回非 nil 结果或错误都会短路真实调用；而 `BeforeAgentCallback` 只有非 nil 内容才短路，返回错误会浮现但不阻止 Agent 运行——这个非对称在《5 Plugin》里详谈。

**4. Cross-cutting 用 Plugin**
需要横跨整个 run 的行为（日志、分析、重试、请求改写）注册成 `plugin.New(...)`，而不是去改运行循环。Plugin 挂在 `context.Context` 上，随整个 run 流动，对每个 Agent、每次模型调用、每次工具调用都生效。

**5. 事件流不收集成切片**
`for event, err := range … {}` 逐个消费，边生产边落库、边 yield，天然支持流式（SSE）与背压。

## 七、模块阅读顺序

本系列按依赖关系由「执行核心」到「编排外围」组织，建议顺序阅读：

1. **《Agent》** — 六方法接口、base agent 的驱动循环、LlmAgent 的模型/工具回合循环、四种工作流 Agent。
2. **《Runner》** — 编排器如何串起服务、插件、会话，以及 compaction。
3. **《Session & Event》** — 事件与状态的数据模型、三种状态作用域、in-memory 落库链路。
4. **《Context》** — 三个接口 + 三层实现，`commonContext` 如何用一个结构体实现全部能力。
5. **《Plugin》** — 全局钩子 vs 单 Agent 回调，短路语义，PluginManager。
6. **《Workflow》** — 静态图 + 单消费者调度器，节点类型、路由、HITL 暂停/恢复。
7. **《Model》** — `LLM` 接口、请求处理器链、`callLLM` 短路、流式聚合，以及 Gemini / OpenAI / Apigee。
8. **《Tool》** — FunctionCall → 工具执行，confirmation / 长任务如何停住回合。
9. **《Memory》** — 跨会话记忆何时写入、何时拼进 prompt。
10. **《Artifact》** — blob 存储，版本与 `user:` 作用域。
11. **《Server》** — REST / A2A 如何把协议请求变成 `runner.Run`。
12. **《Launcher》** — CLI 装配 console / web / api / a2a。

横切的 Auth / Telemetry / AgentRegistry / Platform 用到再查，不必单独成篇。
