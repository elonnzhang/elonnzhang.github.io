---
title: Agent Development Kit (ADK) · 17 - Artifact
date: 2026-09-23
categories:
  - agent
tags:
  - agent
  - ai
  - golang
draft: false
slug: adk-artifact
series: adk
series_order: 17
description: 对照 ADK-Go v2.4.0 源码，拆解 Artifact Service 的六个操作、版本与作用域、InMemory/GCS 实现，以及 Context 中 ArtifactDelta 的真实边界。
toc: true
---

# ADK-Go 源码阅读笔记 · Artifact：文件版本、作用域与事件摘要

> **源码基准：[ADK-Go v2.4.0](https://github.com/google/adk-go/tree/v2.4.0)**，commit 4e57df40cbd35f055ba654b03ffb0e509fdd754a。本文的“当前实现”均指这个版本。
>
> 本文范围：公开 artifact.Service 契约、请求校验、InMemoryService、GCS 实现，以及 Runner 如何把它们接到 agent.Context。Session/Event 中的 ArtifactDelta 只作为“版本摘要”解释，不展开整个 Session Service 的实现。
>
> [返回 ADK 源码阅读合集](/blog/adk/) · 配套阅读：[Context](/blog/adk-context/)、[Runner](/blog/adk-runner/)、[Session & Event](/blog/adk-session-event/)、[Tool](/blog/adk-tool/)。

用户上传一张天气截图，工具把它保存成 report.txt，随后又生成一版带结论的文件。应用需要回答几个看似简单的问题：第二次保存是不是覆盖第一次，下一次会话能不能看到同一个文件，Event 里的 ArtifactDelta 是否就是文件内容，以及 GCS 返回的 URI 能不能直接拿来下载？

先给结论：**Artifact Service 保存的是带版本号的 genai.Part，版本键由 app/user/session/filename 组成；agent.Artifacts 只是把当前 Session 的身份填进请求；ArtifactDelta 只记录“某文件成功保存到了哪个版本”，并不代替保存，也不包含 payload。** InMemory 和 GCS 遵守同一个六方法接口，但版本竞争、返回的 Part 形态和元数据能力不同。

本文用同一组身份贯穿：AppName=weather、UserID=u-1、SessionID=s-1。先保存两次 report.txt，再读最新版本、指定版本和元数据；第四节把文件改名为 user:profile.json，并把后端换成 GCS，观察作用域和并发分支。

### 阅读前先分清这些词

| 术语 | 本文中的准确含义 | 不要混成什么 |
| --- | --- | --- |
| Artifact | 一个 genai.Part 指针及其文件名、版本和存储身份 | Session Event 本身；Event 只可携带版本摘要 |
| artifact.Service | 接受 AppName/UserID/SessionID/FileName 请求的六操作存储契约 | agent.Artifacts 这个给 Context 使用的薄适配器 |
| 版本 0 | 在 Load/GetArtifactVersion 中表示“取最新”，在 Delete 中表示“删全部” | 一个实际存储版本；实际版本从 1 开始 |
| user: 文件名 | 触发跨 Session 的用户作用域 | 文件系统路径；路径分隔符仍会被拒绝 |
| ArtifactDelta | filename -> version 的事件动作字段 | 保存操作、payload 或事务日志 |
| CanonicalURI | 后端原生方案的对象身份，例如 gs://... | 已认证的 HTTP 下载地址 |

## 一、源码入口与阅读地图

Artifact 的入口不在 Runner，而在顶层 artifact 包。Runner 只负责把当前 Session 的身份装配进内部适配器；Context 和工具看到的是 agent.Artifacts，不是 artifact.Service 的请求结构。

| 阅读顺序 | 文件 / 符号 | 需要回答的问题 |
| --- | --- | --- |
| 1. 公开契约 | [artifact/service.go#L31-L51](https://github.com/google/adk-go/blob/v2.4.0/artifact/service.go#L31-L51) | 六个操作分别返回什么？ |
| 2. 请求与元数据 | [artifact/service.go#L59-L123](https://github.com/google/adk-go/blob/v2.4.0/artifact/service.go#L59-L123)、[#L125-L162](https://github.com/google/adk-go/blob/v2.4.0/artifact/service.go#L125-L162)、[#L164-L322](https://github.com/google/adk-go/blob/v2.4.0/artifact/service.go#L164-L322) | 哪些字段必填，版本 0 怎样解释？ |
| 3. Context 适配器 | [internal/artifact/artifacts.go#L26-L71](https://github.com/google/adk-go/blob/v2.4.0/internal/artifact/artifacts.go#L26-L71) | agent.Artifacts 如何补齐身份？ |
| 4. Runner 装配 | [runner/run_node.go#L283-L313](https://github.com/google/adk-go/blob/v2.4.0/runner/run_node.go#L283-L313) | 谁创建这个适配器，什么时候可能是 nil？ |
| 5. 本地实现 | [artifact/inmemory.go#L34-L163](https://github.com/google/adk-go/blob/v2.4.0/artifact/inmemory.go#L34-L163)、[#L165-L327](https://github.com/google/adk-go/blob/v2.4.0/artifact/inmemory.go#L165-L327) | 版本和用户作用域怎样编码？ |
| 6. GCS 实现 | [artifact/gcsartifact/service.go#L59-L170](https://github.com/google/adk-go/blob/v2.4.0/artifact/gcsartifact/service.go#L59-L170)、[#L238-L505](https://github.com/google/adk-go/blob/v2.4.0/artifact/gcsartifact/service.go#L238-L505) | 并发写入、对象路径和元数据怎样处理？ |
| 7. 事件边界 | [agent/common_context.go#L87-L155](https://github.com/google/adk-go/blob/v2.4.0/agent/common_context.go#L87-L155)、[#L464-L495](https://github.com/google/adk-go/blob/v2.4.0/agent/common_context.go#L464-L495) | 保存成功后谁写入 ArtifactDelta？ |

~~~text
Runner
  └─ current Session: app / user / session
       │
       ▼
internal/artifact.Artifacts
  ├─ Save(name, Part)      ─┐
  ├─ Load(name[, version])  │  填入四个身份字段
  └─ List()                ─┘
       │
       ▼
artifact.Service
  ├─ InMemoryService     → 有序复合键 + Part 指针
  └─ gcsartifact.Service → GCS 对象 + 版本前置条件
       │
       └─ 成功 Save 返回 version
              │
              ▼
       tracked Context（若当前 wrapper 启用）
              │
              ▼
       EventActions.ArtifactDelta[name] = version
~~~

internal/artifact 是 Go 的 internal 包，只能由模块内部导入。应用侧通常拿到的是 agent.Context，通过 ctx.Artifacts() 调用；真正的存储后端由 Runner 配置注入。

## 二、核心接口与数据结构

### 1. Service 的六个操作

源码中的公共接口很小，但每个方法对版本 0 的解释不同。下面是 [artifact.Service](https://github.com/google/adk-go/blob/v2.4.0/artifact/service.go#L31-L51) 的源码摘录：

~~~go
type Service interface {
    Save(ctx context.Context, req *SaveRequest) (*SaveResponse, error)
    Load(ctx context.Context, req *LoadRequest) (*LoadResponse, error)
    Delete(ctx context.Context, req *DeleteRequest) error
    List(ctx context.Context, req *ListRequest) (*ListResponse, error)
    Versions(ctx context.Context, req *VersionsRequest) (*VersionsResponse, error)
    GetArtifactVersion(ctx context.Context, req *GetArtifactVersionRequest) (*GetArtifactVersionResponse, error)
}
~~~

| 操作 | 输入核心字段 | 成功结果 | Version=0 的意义 |
| --- | --- | --- | --- |
| Save | 四个身份字段 + Part | 新版本号 | 当前两个内置实现都会自动分配下一版本 |
| Load | 四个身份字段，可选版本 | 完整 genai.Part | 读取最新版本 |
| Delete | 四个身份字段，可选版本 | error | 删除该文件的全部版本 |
| List | AppName/UserID/SessionID | 文件名列表 | 不适用 |
| Versions | 四个身份字段 | 版本号列表 | 不适用 |
| GetArtifactVersion | 四个身份字段，可选版本 | 元数据结构 | 返回最新版本的元数据 |

Delete 的接口注释规定删除不存在的条目不应报错；具体后端仍需把这个契约落实到自己的对象删除调用上。读取、列版本和读取元数据在找不到对象时都应让调用方能用 errors.Is(err, fs.ErrNotExist) 判断。

### 2. 请求校验不是装饰性检查

所有请求实现都先调用自己的 Validate。AppName、UserID、SessionID 和 FileName 按顺序检查非空；SaveRequest 还要求 Part 非空，并要求 Part.Text 非空或 Part.InlineData 非空。文件名不能包含路径分隔符。[service.go#L72-L123](https://github.com/google/adk-go/blob/v2.4.0/artifact/service.go#L72-L123) 定义了公共校验函数和保存请求的完整规则，其他请求在 [#L130-L261](https://github.com/google/adk-go/blob/v2.4.0/artifact/service.go#L130-L261) 与 [#L286-L318](https://github.com/google/adk-go/blob/v2.4.0/artifact/service.go#L286-L318) 复用相同的字段约束。

~~~go
// 通过校验的最小文本 Part
req := &artifact.SaveRequest{
    AppName:   "weather",
    UserID:    "u-1",
    SessionID: "s-1",
    FileName:  "report.txt",
    Part:      genai.NewPartFromText("杭州今天晴转多云"),
}
~~~

这里有两个容易漏掉的边界：

1. genai.NewPartFromBytes([]byte{}, "application/octet-stream") 的 InlineData 非空，即使数据长度为零也能通过校验；“零字节”不等于“没有 Part”。
2. user:profile.json 没有路径分隔符，能通过文件名校验；user:dir/profile.json 会被拒绝，不能借助用户命名空间绕过路径限制。

### 3. Part、版本元数据和适配器

保存与读取的 payload 是 genai.Part 指针；版本元数据则是另一种对象：

~~~go
type ArtifactVersion struct {
    Version        int64
    CanonicalURI   string
    CustomMetadata map[string]any
    CreateTime     time.Time
    MimeType       string
}
~~~

定义见 [service.go#L269-L284](https://github.com/google/adk-go/blob/v2.4.0/artifact/service.go#L269-L284)。CanonicalURI 是存储方案原生的身份字符串，不是下载授权；没有这类方案的实现可以留空。InMemory 只填版本和 MIME 类型，GCS 还填 URI、对象 metadata 和创建时间。

agent.Artifacts 的公开接口只有四个更贴近 Context 的方法：Save、List、Load、LoadVersion。[agent/agent.go#L110-L117](https://github.com/google/adk-go/blob/v2.4.0/agent/agent.go#L110-L117) 刻意没有暴露 Delete、Versions 或 GetArtifactVersion。Runner 内部的 [Artifacts](https://github.com/google/adk-go/blob/v2.4.0/internal/artifact/artifacts.go#L26-L71) 把这些调用转换成公共请求：

~~~text
ctx.Artifacts().Save(ctx, "report.txt", part)
  → SaveRequest{
       AppName: weather, UserID: u-1, SessionID: s-1,
       FileName: report.txt, Part: part,
    }
  → artifact.Service.Save(...)
~~~

这层转换解释了一个 API 边界：应用可以在工具里保存和读取，但不能仅凭 agent.Artifacts 直接列出版本、删除单个版本或读取 ArtifactVersion 元数据；需要直接持有 artifact.Service 才能使用完整六操作契约。

两种后端的构造入口也在不同包中：测试或单进程示例可以直接调用 artifact.InMemoryService()（[inmemory.go#L34-L45](https://github.com/google/adk-go/blob/v2.4.0/artifact/inmemory.go#L34-L45)）；GCS 则由 gcsartifact.NewService(ctx, bucketName, opts...) 创建，它先建立 cloud storage.Client，再返回实现 Service 的对象（[gcsartifact/service.go#L59-L73](https://github.com/google/adk-go/blob/v2.4.0/artifact/gcsartifact/service.go#L59-L73)）。Runner 配置哪一个，Context 侧的调用形状都不变。

### 4. SaveRequest.Version 的注释与当前实现

SaveRequest 的字段注释写着“如果设置，artifact 将以此版本保存；未设置则创建新版本”。但 v2.4.0 的两个内置 Save 实现都没有读取 req.Version：

- InMemory 在 [inmemory.go#L141-L163](https://github.com/google/adk-go/blob/v2.4.0/artifact/inmemory.go#L141-L163) 总是 find 最新版本后加一。
- GCS 在 [gcsartifact/service.go#L132-L169](https://github.com/google/adk-go/blob/v2.4.0/artifact/gcsartifact/service.go#L132-L169) 总是列出最大版本后尝试写 max+1。

因此，本文把“指定保存版本”视为**接口字段上的意图，不是这两个实现当前兑现的行为**。调用方若把 Version: 7 传给这两个后端，不能据此断言结果一定是 7；应以返回的 SaveResponse.Version 为准。这个差异也说明，读源码时不能只看 request struct 的注释，要继续追到实现函数。

## 三、主执行路径：一次文件保存如何变成版本和事件

### 1. Runner 先绑定 Session 身份

在运行节点时，Runner 只有在配置了 artifactService 后才创建内部适配器；AppName、UserID、SessionID 都来自已取得的 storedSession。[run_node.go#L283-L313](https://github.com/google/adk-go/blob/v2.4.0/runner/run_node.go#L283-L313)

~~~go
if r.artifactService != nil {
    artifacts = &artifactinternal.Artifacts{
        Service:   r.artifactService,
        SessionID: storedSession.ID(),
        AppName:   storedSession.AppName(),
        UserID:    storedSession.UserID(),
    }
}
~~~

所以同一个工具代码在两个 Session 中调用 ctx.Artifacts().Save(ctx, "report.txt", part) 时，文件名可以相同，实际键却不同。没有配置 Artifact Service 时，ctx.Artifacts() 会是 nil；工具必须先判断能力是否存在，不能假定每个 Runner 都提供文件存储。

### 2. 贯穿示例的调用栈与对象变化

~~~text
工具 / callback
  → agent.Context.Artifacts().Save
    → internal/artifact.Artifacts.Save
      → artifact.SaveRequest{weather,u-1,s-1,report.txt,Part}
        → InMemoryService 或 gcsService
          → SaveResponse{Version: 1}
~~~

示例第一次保存 report.txt：

~~~go
part1 := genai.NewPartFromText("杭州天气：晴转多云")
saved1, err := ctx.Artifacts().Save(ctx, "report.txt", part1)
// saved1.Version == 1

part2 := genai.NewPartFromText("杭州天气：晴转多云；建议带伞")
saved2, err := ctx.Artifacts().Save(ctx, "report.txt", part2)
// saved2.Version == 2

latest, _ := ctx.Artifacts().Load(ctx, "report.txt")
old, _ := ctx.Artifacts().LoadVersion(ctx, "report.txt", 1)
~~~

正常路径的快照如下：

| 时刻 | 真实存储 | 调用方拿到的值 | 说明 |
| --- | --- | --- | --- |
| T0 | 没有 report.txt | part1 在内存中 | 尚未写入 Service |
| T1 | report.txt@1 = part1 | SaveResponse{Version:1} | 第一次保存创建版本 |
| T2 | report.txt@1 和 @2 = part2 | SaveResponse{Version:2} | 第二次保存创建新版本，不覆盖 @1 |
| T3 | 不变 | Load 返回 @2 | 版本 0 解析为最新 |
| T4 | 不变 | LoadVersion(...,1) 返回 @1 | 指定版本读取旧内容 |

Load 返回的是完整 Part；GetArtifactVersion 只返回版本、MIME、时间和后端元数据，不返回正文。两者是 payload 读取与对象描述读取的两个 API，不应互换。

### 3. Save 成功后，ArtifactDelta 才可能出现

工具 Context 的构造会使用 newTrackedArtifacts 包装 agent.Artifacts。在 NewToolContext 中，传入的 actions 会先补齐 StateDelta 和 ArtifactDelta，随后每次成功 Save 都会把返回版本写入动作 map：

~~~go
resp, err := a.Artifacts.Save(ctx, name, data)
if err != nil {
    return resp, err
}
a.actions.ArtifactDelta[name] = resp.Version
~~~

完整实现见 [common_context.go#L144-L155](https://github.com/google/adk-go/blob/v2.4.0/agent/common_context.go#L144-L155) 与 [#L464-L495](https://github.com/google/adk-go/blob/v2.4.0/agent/common_context.go#L464-L495)。因此 report.txt 两次保存后的动作可能是：

~~~text
真实 Artifact Service：report.txt@1、report.txt@2 已经存在
EventActions.ArtifactDelta：{"report.txt": 2}
~~~

这不是“两份内容被塞进 Event”，而是 Event 记录本次动作最后观察到的版本。若保存返回错误，wrapper 在写入 ArtifactDelta 前就返回，不会伪造版本摘要。

还有一个必须保留的限定：NewCallbackContext 直接使用 ic.Artifacts()，而 NewCallbackContextWithArtifactTracking 才显式包上 tracked wrapper（见 [common_context.go#L70-L103](https://github.com/google/adk-go/blob/v2.4.0/agent/common_context.go#L70-L103)）。所以不能笼统地说“所有 Context 保存都会自动产生 ArtifactDelta”；要看当前 callback 或 tool 使用的是哪一种 Context 构造路径。

tracked wrapper 自己也不负责并发版本仲裁：它直接把 resp.Version 赋给同名 key，源码注释还提示需要 RWLock 并检查多个工具保存同一文件时的更高版本（[common_context.go#L482-L493](https://github.com/google/adk-go/blob/v2.4.0/agent/common_context.go#L482-L493)）。后面 Flow 合并并行事件时取更高版本，是另一层的合并规则，不能反推 wrapper 内部已经线程安全。

调用点还可能经过 internal/context：它的 NewCallbackContext 明确调用 tracking 版本（[internal/context/callback_context.go#L22-L35](https://github.com/google/adk-go/blob/v2.4.0/internal/context/callback_context.go#L22-L35)）。因此真正可复现的判断方法是沿调用方追到构造函数，而不是只根据“callback”这个名字推断是否会产生 delta。

### 4. 事件持久化不会替 Artifact Service 回滚

EventActions.ArtifactDelta 的定义只是 filename -> version：[session/session.go#L248-L277](https://github.com/google/adk-go/blob/v2.4.0/session/session.go#L248-L277)。Session Service 保存 Event 时会复制这个 map（InMemory 示例见 [session/inmemory.go#L229-L260](https://github.com/google/adk-go/blob/v2.4.0/session/inmemory.go#L229-L260)），但不会重新保存文件，也不会根据 map 删除文件。

~~~text
Save(Part) 成功 ───────► 外部 Artifact Service 已有版本
       │
       └─ tracked wrapper ─► EventActions.ArtifactDelta
                                  │
                                  ▼
                            Event / Session history
~~~

如果随后 Event append 失败，已经写入的 Artifact 不会由这条代码路径自动删除；反过来，Event 成功也不代表某个没有经过 tracked wrapper 的直接 Service 调用会被摘要。这里没有跨两个 Service 的事务。

### 5. 并行事件合并的是摘要，不是文件

Flow 合并并行 FunctionResponse 事件时，若两边都有 ArtifactDelta，mergeArtifactDeltas 对同名文件取更高版本：[base_flow.go#L1502-L1548](https://github.com/google/adk-go/blob/v2.4.0/internal/llminternal/base_flow.go#L1502-L1548)。

~~~text
分支 A：{"report.txt": 3}
分支 B：{"report.txt": 4}
合并后：{"report.txt": 4}
~~~

这是事件摘要的合并规则，不是对 Artifact Service 的 compare-and-swap，也不会把版本 3 的内容复制到版本 4。真正的并发写入保护由后端实现决定，GCS 的规则见下一节。

## 四、关键细节与分支

### 4.1 user: 把 Session 作用域换成 User 作用域

普通文件 report.txt 的逻辑键包含 Session：

~~~text
weather / u-1 / s-1 / report.txt / 2
~~~

当文件名以 user: 开头时，InMemory 在 Save、Load、Delete、Versions 和 GetArtifactVersion 中把 sessionID 改成固定的 user；List 则同时扫描当前 Session 和这个用户作用域。源码分别见 [inmemory.go#L141-L152](https://github.com/google/adk-go/blob/v2.4.0/artifact/inmemory.go#L141-L152)、[#L165-L204](https://github.com/google/adk-go/blob/v2.4.0/artifact/inmemory.go#L165-L204) 与 [#L224-L325](https://github.com/google/adk-go/blob/v2.4.0/artifact/inmemory.go#L224-L325)。

GCS 用对象名表达同一规则：

~~~text
普通：app/user/session/file/version
用户：app/user/user/user:file/version
~~~

准确的构造函数在 [gcsartifact/service.go#L76-L101](https://github.com/google/adk-go/blob/v2.4.0/artifact/gcsartifact/service.go#L76-L101)。这里第二个 user 是作用域目录，后面的 user:file 仍是完整文件名；它不是把 user: 从名字中剥掉。

因此，在 s-1 保存 user:profile.json 后，用同一个 AppName 和 UserID、换成 s-2 仍能读取它；但换 UserID 或 AppName 就看不到。SessionID 仍然是请求必填字段，只是在存储键上不再决定用户作用域文件的位置。

### 4.2 InMemory：有序复合键让“最新”可被找到

InMemory 服务的核心结构是一个带读写锁的 omap.Map[string,genai.Part 指针]。键按 AppName、UserID、SessionID、FileName、Rev(Version) 编码：[inmemory.go#L34-L78](https://github.com/google/adk-go/blob/v2.4.0/artifact/inmemory.go#L34-L78)。版本用反向排序编码，因此 find 从范围起点拿到的第一项就是最新版本（[#L98-L105](https://github.com/google/adk-go/blob/v2.4.0/artifact/inmemory.go#L98-L105)）。

~~~text
同一逻辑文件的键（概念化）
  (weather,u-1,s-1,report.txt,Rev(2))
  (weather,u-1,s-1,report.txt,Rev(1))
~~~

Save 在锁内查找最新版本并加一；Load(version>0) 精确取键，Load(version==0) 调用 find；Delete(version==0) 删除这个文件的版本范围。这里保存的是 genai.Part 指针，读取也返回存储的指针；实现没有在这层复制 payload。这使它很适合测试和演示，但不能把它的内存别名行为当作远端对象存储的通用保证。

### 4.3 InMemory 与 GCS 的 List 都会合并两种作用域

InMemory 的 List 先扫描当前 Session，再扫描 (AppName,UserID,"user")，用 map 去重后排序；GCS 的 List 则分别查询 Session 前缀和 User 前缀，也用 map 去重并排序（[gcsartifact/service.go#L330-L391](https://github.com/google/adk-go/blob/v2.4.0/artifact/gcsartifact/service.go#L330-L391)）。

对示例而言，当前 Session 里有 report.txt，用户作用域有 user:profile.json，List 返回：

~~~text
[report.txt user:profile.json]
~~~

这个列表是文件名集合，不包含版本号；要显示版本必须另调 Versions。不要因为某个文件出现在 Session 的列表里，就推断它一定是 Session 独占文件。

### 4.4 版本 0 是一个按操作变化的哨兵值

| 调用 | Version=0 | Version>0 |
| --- | --- | --- |
| Load | resolve/find 最新版本 | 精确读取该版本 |
| Delete | 删除该文件的全部版本 | 只删除指定版本 |
| GetArtifactVersion | 取最新版本元数据 | 取指定版本元数据 |
| Versions | 没有版本参数 | 返回全部版本 |

GCS 的 resolveVersion 在 [gcsartifact/service.go#L443-L457](https://github.com/google/adk-go/blob/v2.4.0/artifact/gcsartifact/service.go#L443-L457) 中显式使用 slices.Max；这也是为什么调用方不应依赖 Versions 返回顺序。InMemory 的扫描顺序来自有序键实现，GCS 的对象迭代顺序来自存储查询，接口本身没有承诺一个跨后端相同的顺序。

### 4.5 GCS Save 是“列出后抢占版本”，不是事务递增器

GCS 不能把“读取最大版本”和“创建下一个对象”合成一个列表操作。Save 的实际循环是：

~~~text
列出已有版本
  ↓
next = max + 1（没有版本则为 1）
  ↓
以 DoesNotExist 前置条件写入 next
  ├─ 成功             → 返回 next
  ├─ HTTP 412 / gRPC FailedPrecondition
  │                    → 抖动退避，重新列版本再试
  └─ 其他错误         → 立即返回，不重试
~~~

实现和常量见 [gcsartifact/service.go#L104-L119](https://github.com/google/adk-go/blob/v2.4.0/artifact/gcsartifact/service.go#L104-L119) 与 [#L121-L236](https://github.com/google/adk-go/blob/v2.4.0/artifact/gcsartifact/service.go#L121-L236)：最多 16 次尝试，退避基准 10ms、上限 1s；耗尽时返回包装过的 ErrVersionConflict。调用方应使用 errors.Is(err, gcsartifact.ErrVersionConflict) 判断可重试的版本竞争，而不是把所有保存错误都重试。

这个方案只保护使用同一前置条件的写入者。若另一个客户端无条件覆盖同名对象，源码注释明确说版本方案可能丢失；它不是整个 bucket 的通用锁。

### 4.6 GCS 的正文回读与 InMemory 不完全相同

GCS Load 先取对象属性，再读全部字节，并用 genai.NewPartFromBytes(data, attrs.ContentType) 创建新的 Part（[gcsartifact/service.go#L283-L327](https://github.com/google/adk-go/blob/v2.4.0/artifact/gcsartifact/service.go#L283-L327)）。这意味着：

- GCS 回读统一从字节和 MIME 还原，原始 Text/InlineData 的 Go 表示不必与保存时相同。
- InMemory 直接返回保存的 genai.Part 指针，保留指针和原始字段形态。
- 应用应依赖 Part 的语义内容，而不要依赖两个后端的内部指针、字段布局或别名行为。

写入时，GCS 对 InlineData 设置其 MIME 类型；对文本设置 text/plain（[gcsartifact/service.go#L203-L225](https://github.com/google/adk-go/blob/v2.4.0/artifact/gcsartifact/service.go#L203-L225)）。零字节 InlineData 仍会创建真实对象，测试专门覆盖了连续保存不能覆盖成同一个版本的情况。

### 4.7 GetArtifactVersion 的 URI 是身份，不是下载链接

GCS 版本元数据中的 CanonicalURI 固定为：

~~~text
gs://<bucket>/<app>/<user>/<session-or-user-scope>/<filename>/<version>
~~~

实现选择 gs://，而不是对象的 MediaLink，因为 MediaLink 是认证的 JSON API 下载 URL；把它当作模型 file_uri 时，模型可能把 HTTP 页面当成文件而无法读取。源码注释和构造见 [gcsartifact/service.go#L460-L504](https://github.com/google/adk-go/blob/v2.4.0/artifact/gcsartifact/service.go#L460-L504)。

InMemory 的 GetArtifactVersion 只返回版本和 MIME 类型：文本默认为 text/plain，InlineData 使用其 MIME；CanonicalURI、CustomMetadata 和 CreateTime 保持零值（[inmemory.go#L288-L327](https://github.com/google/adk-go/blob/v2.4.0/artifact/inmemory.go#L288-L327)）。所以元数据展示页需要允许后端能力不同，不能把空 URI 当成“读取失败”。

### 4.8 错误、取消与已发生的副作用

请求校验错误在进入后端前返回；找不到对象的读取和元数据请求包装 fs.ErrNotExist。GCS 的列举、读写和删除都把 context.Context 传到底层客户端；退避等待也会在 Context 取消时返回 Context 错误（[gcsartifact/service.go#L184-L200](https://github.com/google/adk-go/blob/v2.4.0/artifact/gcsartifact/service.go#L184-L200)）。

还要留意一个契约边界：Service 接口注释说删除不存在的条目不应报错，但 GCS 的 Delete 直接把对象删除错误向上包装，没有在本层显式把 storage.ErrObjectNotExist 转成 nil（[gcsartifact/service.go#L238-L280](https://github.com/google/adk-go/blob/v2.4.0/artifact/gcsartifact/service.go#L238-L280)）。因此不能只看接口注释就假定真实 GCS 的 404 一定被吞掉；使用 GCS 时应把这个后端差异纳入错误处理和测试。

但取消和失败不是回滚：

~~~text
Save 写入成功
  → 后续 Event append 失败 / Context 被取消
  → Artifact 版本仍可能留在后端
~~~

如果业务要求“文件和事件必须一起提交”，需要在 Artifact Service 与 Session Service 之上增加自己的幂等键、补偿删除或事务协调；当前接口没有提供跨服务事务。

## 五、重新梳理：运行时架构与边界

| 边界 | 接收与产出 | 负责的动作 | 不负责的动作 |
| --- | --- | --- | --- |
| 工具 / callback | agent.Context → agent.Artifacts 调用 | 选择文件名、构造 genai.Part、处理返回版本和错误 | 不决定底层对象路径，不自动拥有事务 |
| Runner / internal adapter | 当前 Session 身份 + 简化调用 → artifact.*Request | 注入 App/User/Session，暴露 Save/List/Load/LoadVersion | 不实现版本算法，不返回完整元数据 API |
| artifact.Service | 完整请求 → Part、版本、元数据或 error | 校验请求、保存/读取/删除/列举 | 不创建 Session Event，不把结果交给模型 |
| InMemory / GCS | Service 请求 → 具体对象存储 | 版本分配、作用域映射、后端读写 | 不保证跨后端相同的指针和元数据形态 |
| Context tracked wrapper | 成功 SaveResponse → ArtifactDelta | 把文件名和版本写入当前 EventActions | 不保存 payload，不补偿失败，不代表所有 Context 都启用追踪 |
| Session / Event | EventActions → 历史记录 | 持久化版本摘要并参与后续历史 | 不根据 ArtifactDelta 重新上传或删除文件 |

把贯穿示例放回这张边界图：工具先调用 Context；Runner 预先把 Session 身份绑定到内部适配器；后端决定版本和对象路径；若当前 Context 是 tracked wrapper，成功版本才被写入 EventActions；Session 之后只保存这个摘要。模型下一轮若需要文件内容，仍要通过 Artifact 的 Load 路径取得 Part，不能从 ArtifactDelta 反解正文。

**主线规则与旁路：** 普通工具 Context 使用 NewToolContext，因此成功保存会有版本摘要；直接持有 artifact.Service 的代码可以绕过 Context，不自动产生 EventActions；普通 NewCallbackContext 也不等于 artifact-tracking callback，只有显式的 NewCallbackContextWithArtifactTracking 才包装 Save。把这三条路径混成一条，会错误推断事件总能反映所有文件写入。

## 六、这个模块解决了什么问题

### 1. 它解决的核心问题

Artifact 把“较大的、可能需要复用的二进制或文本 Part”从会话事件正文中分离出来，同时保留三个维度：

1. **身份隔离**：同名文件按 App、User、Session 区分；user: 提供跨 Session 的用户作用域。
2. **版本可追溯**：保存不会覆盖旧版本，调用方可以取最新、指定版本或列出版本。
3. **后端可替换**：测试可用 InMemory，生产可用 GCS；上层只依赖 Service 或 agent.Artifacts 契约。

### 2. 代价与适用边界

- 每次保存产生版本，长期运行需要明确清理策略；Delete 是显式操作，不会因新版本自动回收旧版本。
- GCS 每次保存至少要列版本再上传；并发高时会触发退避和 ErrVersionConflict，调用方需要处理重试和幂等。
- Event 只记录版本摘要，Artifact 与 Session 没有跨服务事务；失败补偿必须由应用设计。
- InMemory 的指针别名、GCS 的字节回读和元数据差异，意味着测试不能只断言某个后端的内部表示。
- agent.Artifacts 的简化接口不覆盖删除、版本列表和元数据查询；需要管理功能时应在合适边界注入完整 artifact.Service，而不是从 EventActions 猜测。

## 七、重点结论与常见误解

| 误解 | 源码事实 |
| --- | --- |
| 第二次 Save 会覆盖第一次 | 两个内置实现都创建 max+1 版本；旧版本仍可读取 |
| ArtifactDelta 就是文件内容 | 它只是 filename -> version 的 EventActions 字段 |
| 每个 Context 的 Save 都自动写 delta | 只有 tracked wrapper 才记录；普通 callback Context 可能使用原始 Artifacts |
| user: 是普通文件名前缀而已 | 它把存储键切换到同一 App/User 下的固定 user 作用域 |
| Version=0 总是“版本 0” | Load/Get metadata 取最新，Delete 删除全部 |
| SaveRequest.Version=7 会写出 v7 | v2.4.0 的 InMemory/GCS Save 未读取这个字段，实际返回值才是事实 |
| GCS CanonicalURI 可以当 HTTP 下载链接 | 当前实现返回 gs:// 对象身份，不返回认证 MediaLink |
| Event 保存失败会撤销文件 | 两个 Service 没有跨服务事务，已成功的 Save 可能保留 |
| List 只列当前 Session 文件 | 当前两个实现都会把当前 Session 和用户作用域文件合并返回 |

### 用贯穿示例检查自己

给定 weather/u-1/s-1：

1. 保存 report.txt 两次后，Load(report.txt) 返回哪一版？
2. 把文件改成 user:profile.json，换到 s-2 后还需要哪个身份保持不变？
3. ArtifactDelta={"report.txt":2} 能否恢复正文？如果不能，应该调用哪个 API？
4. 两个 GCS writer 同时观察到最大版本为 3 时，为什么不会都成功写入版本 4？

答案分别是：最新版本 2；AppName 与 UserID；不能，需 Load 或 LoadVersion；DoesNotExist 前置条件让一个写入者收到 precondition failure 并重新列版本。

## 八、源码索引与进一步阅读

### 公共契约与测试

- [artifact/service.go](https://github.com/google/adk-go/blob/v2.4.0/artifact/service.go)：Service、六类 Request/Response、校验和 ArtifactVersion。
- [artifact/request_validation_test.go](https://github.com/google/adk-go/blob/v2.4.0/artifact/request_validation_test.go)：必填字段、Part 形态和路径分隔符测试。
- [internal/artifact/tests/service_suite.go](https://github.com/google/adk-go/blob/v2.4.0/internal/artifact/tests/service_suite.go)：InMemory/GCS 共用的保存、读取、删除、用户作用域和元数据行为。

### 存储实现

- [artifact/inmemory.go](https://github.com/google/adk-go/blob/v2.4.0/artifact/inmemory.go)：有序复合键、读写锁、版本查找和 user: 作用域。
- [artifact/gcsartifact/service.go](https://github.com/google/adk-go/blob/v2.4.0/artifact/gcsartifact/service.go)：GCS 对象路径、并发 Save、退避、List、Load 和 CanonicalURI。
- [artifact/gcsartifact/gcs_client.go](https://github.com/google/adk-go/blob/v2.4.0/artifact/gcsartifact/gcs_client.go)：GCS client/object wrapper 与 DoesNotExist 前置条件。
- [artifact/gcsartifact/gcs_test.go](https://github.com/google/adk-go/blob/v2.4.0/artifact/gcsartifact/gcs_test.go)：并发版本、冲突耗尽、零字节对象、URI 形式和错误包装测试。

### 运行时桥接

- [agent/agent.go#L110-L117](https://github.com/google/adk-go/blob/v2.4.0/agent/agent.go#L110-L117)：Context 可见的 agent.Artifacts 接口。
- [internal/artifact/artifacts.go](https://github.com/google/adk-go/blob/v2.4.0/internal/artifact/artifacts.go)：把简化接口映射到公共 Service 请求。
- [runner/run_node.go#L283-L313](https://github.com/google/adk-go/blob/v2.4.0/runner/run_node.go#L283-L313)：Runner 注入当前 Session 的三种身份。
- [agent/common_context.go#L87-L155](https://github.com/google/adk-go/blob/v2.4.0/agent/common_context.go#L87-L155)、[#L464-L495](https://github.com/google/adk-go/blob/v2.4.0/agent/common_context.go#L464-L495)：tracked artifact 与 ArtifactDelta。
- [session/session.go#L248-L313](https://github.com/google/adk-go/blob/v2.4.0/session/session.go#L248-L313)：EventActions 字段与 JSON 保留规则。
- [internal/llminternal/base_flow.go#L1502-L1548](https://github.com/google/adk-go/blob/v2.4.0/internal/llminternal/base_flow.go#L1502-L1548)：并行事件合并时按更高版本合并摘要。

继续阅读 [Context](/blog/adk-context/) 可看 Context 派生、状态 delta 和取消如何影响工具；再读 [Session & Event](/blog/adk-session-event/) 可把 ArtifactDelta 放回 Event 持久化和历史重建的完整链路。
