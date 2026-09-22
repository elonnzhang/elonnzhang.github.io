---
title: Agent Development Kit (ADK) . - Laucher
date: 2026-09-20
tags:
  - agent
  - ai
  - golang
draft: false
slug: adk-launcher
description: 一文了解 ADK Laucher, Agent 应用入口层
---

ADK-Go 源码阅读笔记 · Launcher

> Server 是协议适配。Launcher 是进程入口：解析 CLI、装配三大服务和 AgentLoader、选出 console 或 web，再把请求交给 handler。读到这里，从 `main` 到 `runner.Run` 的竖直链条就闭合了。

源码：`cmd/launcher/launcher.go`（接口与 Config）、`universal/`（按子命令分发）、`console/`、`web/`（及其 sublauncher：`api`、`a2a`、`webui`、`pubsub`、`eventarc`）、预设组合 `full/` 与 `prod/`。`cmd/adkgo` 是仓库自带的 CLI 二进制，内部调这些 launcher。

## 一、两层接口

```go
// cmd/launcher/launcher.go:54-75
type Launcher interface {
    Execute(ctx, *Config, args []string) error
    CommandLineSyntax() string
}

type SubLauncher interface {
    Keyword() string          // "console" / "web" / ...
    Parse(args) (rest, error)
    Run(ctx, *Config) error
    // + 帮助文本
}
```

`Config`（`:78-116`）是进程级装配单：Session / Artifact / Memory、AgentLoader、Plugin、Telemetry、Authenticator / Authorizer、Compaction。和 `adkrest.ServerConfig` 几乎同构。Compaction 同样 **全进程一份**；多 app 要不同策略就起多个进程。

`Config.Validate`（`:41-49`）在任何服务开始听端口之前跑 compaction 形状检查——注释强调 runner 是每请求才 `New` 的，不在这里拦，进程会「启动成功、请求全挂」。

## 二、universal：第一个子命令是默认

`universal.NewLauncher(subs...)`（`universal/universal.go:43`）按 CLI 第一个 token 选 SubLauncher。关键词必须唯一。**列表里的第一个是无参数时的默认**——所以 `full.NewLauncher` 把 console 放第一位，没写 `web` 就进交互终端。

`full`（`cmd/launcher/full/full.go:31-32`）：

```
universal(
  console,
  web(webui, a2a, pubsub, eventarc, api),
)
```

`prod`（`prod/prod.go:29-30`）去掉 console 和 ADK Web UI，只留 REST + A2A：

```
universal( web(api, a2a) )
```

> ⚠️ 本地玩用 full，部署用 prod。

## 三、console：一条 session，循环 stdin → Run

`console.Run`（`console/console.go:71`）：

1. 装 telemetry（可 `--otel_to_cloud`）
2. SessionService 空则 `InMemoryService`；`Create` 一条 `console_user` / `console_app` 的 session
3. `runner.New` 一次，root agent 来自 `AgentLoader.RootAgent()`
4. 读 stdin 行，转成 user Content，`r.Run(...)`，把事件打到 stdout
5. `--streaming_mode=sse|none`；Ctrl-C 走 `shutdown-timeout`

console **自己 Create session**，不会 404。REST 默认要 session 先存在，这是入口层一个容易踩的差。

HITL：console 认 `adk_request_confirmation` / `RequestedInput`，在终端里问人，再把 FunctionResponse 喂回下一轮（`console/hitl.go`）。这是工具确认和 Workflow 暂停在 CLI 上的汇合点。

## 四、web：一个 HTTP server，多个 SubLauncher 往上挂路由

`web.NewLauncher(subs...)` 自己也是 SubLauncher，keyword=`web`。`web.Sublauncher` 比通用 SubLauncher 多两个方法：`SetupSubrouters(router, config)` 和启动时的 `UserMessage`。

`Run` 起 `http.Server`（端口、读写超时、可选 h2c、OTel），然后让每个**被 CLI 点名的** sublauncher 往同一个 mux 上挂路由：

| keyword | 包 | 挂什么 |
|---|---|---|
| `api` | `web/api` | `adkrest.NewServer`，可选 path prefix、CORS（origin 来自 `-webui_address`）、SSE 超时、debug API |
| `a2a` | `web/a2a` | `adka2a.NewExecutor` + a2a-go JSON-RPC handler |
| `webui` | `web/webui` | ADK Web 静态资源，SPA fallback |
| `pubsub` / `eventarc` | `web/triggers/...` | 云事件入口，内部还是 `runner.Run` |

没在命令行点名的 sublauncher 不挂。`prod` 只点了 api 和 a2a，所以没有 Web UI。

`api` 把 launcher.Config 翻成 `adkrest.ServerConfig` 再 `NewServer`——compaction 预校验发生在这里，和上一篇同一条路径。

## 五、从 argv 到 `runner.Run`

```
main
  → full.NewLauncher().Execute(ctx, &launcher.Config{AgentLoader, services...}, os.Args[1:])
  → universal 按 "console" | "web" 分发
       ├─ console: Create session → runner.New → 循环 stdin → Run
       └─ web: http.Server
            ├─ /api/...  adkrest  每请求 runner.New → Run / RunSSE / RunLive
            ├─ A2A JSON-RPC       Executor → runner.Run → Task 事件
            └─ ADK Web 静态页     浏览器打回 /api
```

AgentLoader 决定「这个 app 名对应哪棵 Agent 树」。三大服务决定状态落在哪。Launcher 自己不执行智能。

## 六、本篇要点

- Launcher 是 CLI + 装配；SubLauncher 是一种运行模式。universal 用第一个关键词选择，列表首项为默认。
- `full` = console + 全套 web；`prod` = 仅 REST + A2A。
- console 自建 session、单 Runner 循环；REST 每请求新建 Runner，session 默认必须已存在。
- web 是一个 mux，api / a2a / webui / 触发器按需挂载。
- Compaction、鉴权、服务实例都是进程级；要隔离就起多个进程。

到这里，从 `iter.Seq2` 主线到 HTTP 入口的阅读顺序走完。
