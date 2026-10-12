---
title: ADK-Go 源码阅读系列
date: 2026-09-19
categories:
  - agent
  - ai
  - golang
tags:
  - agent
  - adk
draft: false
toc: true
slug: adk
description: 沿一次用户请求读懂 ADK-Go：从 Model、Agent、Runner、Flow 到 Tool、Context、Session、Plugin 与 Workflow，追踪对象变化、事件流和运行边界。
---

# ADK-Go 源码阅读合集

用户发来一句“杭州天气怎么样”，从接收输入到给出答案，中间会经历模型请求、工具执行、事件保存和下一轮推理。多 Agent、人工确认、流式输出和长会话则会改变这条路径。

这个系列沿着一次请求追踪 ADK-Go 的实现：**谁创建对象，谁调用接口，数据在哪一步变成事件，结果又如何成为下一次输入。** 各篇聚焦一个模块，并用相邻模块的实际调用方说明它的边界。

> **系列源码基准：[ADK-Go v2.4.0](https://github.com/google/adk-go/tree/v2.4.0)**，commit `4e57df40cbd35f055ba654b03ffb0e509fdd754a`。
>
> 各篇使用同一版本的接口、实现和调用方。普通 Run、Live、不同模型适配器与存储后端的行为分别说明；一种运行方式的结论不自动适用于其他方式。

## 阅读路线

```text
Overview / Quickstart
        ↓
Launcher / Model / Agent
        ↓
Runner → Flow → Tool
        ↓
Context → Session / Event
        ↓
Memory / Plugin / Workflow
        ↓
Artifact → Server → Registry
        ↓
Auth / Telemetry / Platform
```

如果还不了解 ADK，先读 Overview 和 Quickstart；如果已写过简单 Agent，可从 Flow 的天气示例进入，再沿 `Runner → Tool → Context → Session` 追踪它上下游的实现。

| 你想理解的问题 | 推荐路线 | 读完后应能解释 |
| --- | --- | --- |
| 一个 Agent 应用如何启动 | Overview → Quickstart → Launcher | 配置如何变成可运行的 Agent |
| 一句话如何触发工具并得到答案 | Model → Agent → Flow → Tool | FunctionCall 为什么不等于已经执行工具 |
| 执行结果如何保存并进入下一轮 | Runner → Context → Session / Event → 存储实现 | 内存对象、状态 delta、持久化事件之间的区别 |
| 多 Agent 与暂停恢复如何协作 | Agent → Plugin → Workflow | 回调、转移、调度和恢复各由谁控制 |
| 外部服务、观测和测试如何接入 | Artifact → Server → Auth/Telemetry/Platform | 文件版本、协议暴露、身份与可替换系统操作的边界 |
| 如何发现云端 Agent 和 MCP 服务 | Agent Registry → Agent / Tool | 注册资源怎样变成 RemoteAgent 或 Toolset |

## 把模块放回同一次请求

```text
应用 / Launcher
    ↓
Runner：取得 Session，装配 Context，驱动运行
    ↓
Agent：定义角色、指令、工具和协作关系
    ↓
Flow：准备 Request → 调用 Model → 解释 Response
    ↑                                  ↓
下一步的历史输入 ← Session ← Event ← Tool 执行结果
```

这是普通 LLM Agent 的主线示意。Plugin 可以在相关生命周期介入；Workflow 负责节点调度与暂停恢复；Memory 提供跨 Session 的检索能力。{{< ann n blue "区分两层执行" >}}Flow 处理模型与工具循环，Workflow 调度图中的节点{{< /ann >}}。

系列中的主要对象也各有自己的单位：Session 可以覆盖多次交互，{{< ann n amber "执行单位不同" >}}一次 invocation 可以包含多个模型 step，一个 step 又可以产生多条 Event{{< /ann >}}。`LLMRequest` 是模型输入，`Event` 是运行记录；同一条记录中的 `Author` 与 `Content.Role` 也不表达同一个概念。

## 文章目录

### 完整阅读顺序

{{< series-list "adk" >}}

### 分阶段阅读地图

#### 1. 先建立整体认识

| 主题 | 文章 | 重点 |
| --- | --- | --- |
| 全貌 | [ADK Overview](/blog/adk-overview/) | ADK 的模块划分与总体运行模型 |
| 初见 | [ADK Quickstart](/blog/adk-quickstart/) | 从示例程序进入 ADK |
| 入口 | [Launcher](/blog/adk-launcher/) | 应用启动与运行入口 |

#### 2. Agent 执行主链

| 主题 | 文章 | 重点 |
| --- | --- | --- |
| Model | [Model](/blog/adk-model/) | LLM 请求与响应的底层抽象 |
| Agent | [Agent](/blog/adk-agent/) | Agent 接口、Agent tree 与执行能力 |
| Runner | [Runner](/blog/adk-runner/) | Session、Invocation、事件持久化和恢复 |
| Flow | [Flow](/blog/adk-flow/) | 双层循环、对象快照、离线运行示例、确认与流式分支 |
| Tool | [Tool](/blog/adk-tool/) | Tool 声明、执行、确认和结果恢复 |

#### 3. 运行时上下文与持久化

| 主题 | 文章 | 重点 |
| --- | --- | --- |
| Context | [Context](/blog/adk-context/) | Context 分层、派生、状态 delta 与取消 |
| Session / Event | [Session & Event](/blog/adk-session-event/) | Session、Event、State 的关系 |
| InMemory | [Session InMemory](/blog/adk-session-inmemory/) | 内存 Session Service 的实现 |
| Database | [Session Database](/blog/adk-session-database/) | GORM 持久化、事务与 StateDelta |
| Vertex AI | [Vertex AI Session](/blog/adk-session-vertexai/) | Agent Engine RPC、远端事件与 localSession |
| Memory | [Memory](/blog/adk-memory/) | 跨 Session 的长期记忆检索 |

#### 4. 横切能力与工作流

| 主题 | 文章 | 重点 |
| --- | --- | --- |
| Plugin | [Plugin](/blog/adk-plugin/) | 生命周期、callback 调度、替代结果和事件改写 |
| Workflow | [Workflow](/blog/adk-workflow/) | Node、scheduler、interrupt 与 resume |

#### 5. 服务边界与基础设施

| 主题 | 文章 | 重点 |
| --- | --- | --- |
| Artifact | [Artifact](/blog/adk-artifact/) | Service 六个操作、版本、user 作用域与 GCS |
| Server | [Server](/blog/adk-server/) | REST、SSE、A2A、Agent Engine 与入站 authn/authz |
| Agent Registry | [Agent Registry](/blog/adk-agentregistry/) | ADC/mTLS 发现、Agent Card、RemoteAgent 与 MCP Toolset |
| Auth / Telemetry / Platform | [基础设施](/blog/adk-infrastructure/) | 出站凭据、OTel 生命周期、时间/UUID/并发替换点 |

#### 6. 已在相邻文章中提及、但不单列专题的适配器

源码中还有一些针对部署或具体能力的包。`session/compaction` 已在 Runner 篇讨论；`tool/skilltoolset`、`tool/exitlooptool` 与 `tool/toolconfirmation` 已在 Tool 篇的能力矩阵中定位；`cmd/launcher/web` 的 WebUI、A2A、Agent Engine、Eventarc/PubSub 子入口已在 Launcher/Server 篇定位。`cmd/adkgo` 部署 CLI 和 `util/{aiplatform,instructionutil,vertexai}` 仍属于配套辅助层，当前不单列运行时专题；独立 nested module `plugin/agentanalytics` 的版本约束见 Plugin 篇源码索引，不把它误算作根模块 `v2.4.0` 的同一包。

### 源码包覆盖表

下面按 `adk-go` v2.4.0 的公共目录核对文章入口；“配套定位”表示源码已在相邻文章或索引中出现，但没有再拆一篇重复解释。

| 源码包 | 对应文章 / 位置 | 覆盖状态 |
| --- | --- | --- |
| `agent`, `agent/remoteagent`, `model`, `runner`, `workflow` | Agent / Model / Runner / Workflow | 独立专题 |
| `cmd/launcher` 及 `cmd/launcher/web/*` | Launcher / Server | 入口装配与协议挂载 |
| `tool` 及 `agenttool`, `mcptoolset`, `skilltoolset`, `exitlooptool`, `toolconfirmation` | Tool | 主链专题 + 子包源码索引 |
| `session`, `session/database`, `session/inmemory`, `session/vertexai`, `session/compaction` | Session/Event、Database、InMemory、Vertex AI Session、Runner | 后端与压缩配套 |
| `memory` | Memory | 独立专题 |
| `artifact`, `artifact/gcsartifact` | Artifact | 存储契约与两个实现 |
| `plugin` | Plugin | 生命周期专题 |
| `server/adkrest`, `server/adka2a`, `server/agentengine`, `server/authn`, `server/authz` | Server | 协议与入站身份专题 |
| `agentregistry` | Agent Registry | 发现与远端工厂专题 |
| `auth`, `auth/gcp`, `telemetry`, `platform` | Auth / Telemetry / Platform | 横切基础设施专题 |
| `cmd/adkgo`, `util/*` | 本索引“配套辅助层”说明 | 尚无独立运行时专题 |
| `plugin/agentanalytics` | Plugin 源码索引 | 独立 nested module，依赖版本单独说明 |

## 系列文章的组织方式

1. 源码入口与阅读地图；
2. 核心接口与数据结构；
3. 主执行路径：调用栈、数据流和事件流；
4. 关键细节与分支；
5. 重新梳理运行时架构与边界；
6. 这个模块解决了什么问题；
7. 重点结论、常见误解和理解检查；
8. 对应版本的源码、测试与进一步阅读。

每篇从一个具体输入开始，先解释正常路径，再一次改变一个条件：回调提供替代结果会怎样，工具失败会怎样，流式响应未结束会怎样，暂停后又凭什么恢复。源码片段旁解释触发条件、执行顺序和对象变化，便于在不同模块之间继续追踪同一条调用链。

源码摘录、删节代码、解释性伪代码与可运行示例分别标注。固定版本的函数链接用于定位实现；测试和示例用于观察具体输入的结果。模型服务能力与 SDK 中的能力判定也分别说明，避免把一个版本的代码规则当成所有版本的通用保证。

## 继续阅读

- [Flow](/blog/adk-flow/)：从一个不需要 API Key 的天气示例，观察两次模型调用之间的工具与事件闭环。
- [Blog](/blog/)：返回全部文章。
