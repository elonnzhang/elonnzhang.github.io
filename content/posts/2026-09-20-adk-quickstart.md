---
title: Agent Development Kit (ADK) . - 初见 ADK
date: 2026-09-20
categories:
  - agent
  - ai
  - golang
tags:
  - "agent"
draft: false
slug: adk-quickstart
description: ADK 快速上手 demo 阅读
---

一个 Quickstart 的 code

```go
func main() {
    ctx := context.Background()

    model, err := gemini.NewModel(ctx, "gemini-flash-latest", &genai.ClientConfig{
        APIKey: os.Getenv("GOOGLE_API_KEY"),
    })
    if err != nil {
        log.Fatalf("Failed to create model: %v", err)
    }

    a, err := llmagent.New(llmagent.Config{
        Name:        "weather_time_agent",
        Model:       model,
        Description: "Agent to answer questions about the time and weather in a city.",
        Instruction: "Your SOLE purpose is to answer questions about the current time and weather in a specific city. You MUST refuse to answer any questions unrelated to time or weather.",
        Tools: []tool.Tool{
            geminitool.GoogleSearch{},
        },
    })
    if err != nil {
        log.Fatalf("Failed to create agent: %v", err)
    }

    config := &launcher.Config{
        AgentLoader: agent.NewSingleLoader(a),
    }

    l := full.NewLauncher()
    if err = l.Execute(ctx, config, os.Args[1:]); err != nil {
        log.Fatalf("Run failed: %v\n\n%s", err, l.CommandLineSyntax())
    }
}
```

>> 一句话: 从 model 开始 构建一个 llmagent 通过 launch 启动 一个AI 应用

上面使用了 full launcher，我们只看一个具体实现

```go
// cmd/launcher/launcher.go:54-75
type Launcher interface {
    Execute(ctx, *Config, args []string) error
    CommandLineSyntax() string
}

// NewLauncher returnes the most versatile universal launcher with all options built-in.
func NewLauncher() launcher.Launcher {
    return universal.NewLauncher(
        console.NewLauncher(),
        web.NewLauncher(webui.NewLauncher(), a2a.NewLauncher(), pubsub.NewLauncher(), eventarc.NewLauncher(), api.NewLauncher()))
}

```

CLI 的启动方式

```go
// Execute implements launcher.Launcher. It parses arguments and runs the launcher.
func (l *consoleLauncher) Execute(ctx context.Context, config *launcher.Config, args []string) error {
    if err := config.Validate(); err != nil {
        return err
    }
    remainingArgs, err := l.Parse(args)
    if err != nil {
        return fmt.Errorf("cannot parse args: %w", err)
    }
    // do not accept additional arguments
    err = universal.ErrorOnUnparsedArgs(remainingArgs)
    if err != nil {
        return fmt.Errorf("cannot parse all the arguments: %w", err)
    }
    return l.Run(ctx, config)
}
```

→ 继续深入 `l.Run`，构建了一个 `Runner` ，然后 `r.Run`

```go
// Run implements launcher.SubLauncher. It starts the console interaction loop.
func (l *consoleLauncher) Run(ctx context.Context, config *launcher.Config) error {
  // .....

    r, err := runner.New(runner.Config{
        AppName:         appName,
        Agent:           rootAgent,
        SessionService:  sessionService,
        ArtifactService: config.ArtifactService,
        PluginConfig:    config.PluginConfig,
        Compaction:      config.Compaction,
        MemoryService:   config.MemoryService,
    })
    if err != nil {
        return fmt.Errorf("failed to create runner: %v", err)
    }
    ///....
    for event, err := range r.Run(ctx, userID, sess.ID(), userMsg, agent.RunConfig{
        StreamingMode: streamingMode,
    })

    ///....

}
```

→ 到了 `Runner.Run` 了, 生成 `Event`

```go
func (r *Runner) Run(ctx context.Context, userID, sessionID string, msg *genai.Content, cfg agent.RunConfig, opts ...RunOption) iter.Seq2[*session.Event, error] {
    // TODO(hakim): we need to validate whether cfg is compatible with the Agent.
    //   see adk-python/src/google/adk/runners.py Runner._new_invocation_context.
    // TODO: setup tracer.
    return func(yield func(*session.Event, error) bool) {
    // ...
    }
}
```

到目前为止出现的 Keyword 有

1. Model
2. Agent
3. Launch
4. Runner
5. Session
6. Artifact
7. Plugin
8. Compaction
9. Memory
10. session.Event
