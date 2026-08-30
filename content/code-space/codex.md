---
title: "Codex CLI 上手指南"
tool: codex
tool_label: "Codex"
kind: "getting-started"
order: 10
pageKind: code-space-doc
description: "从安装、登录到完成第一次可验证的代码修改"
---

Codex CLI 适合直接在终端里处理本地仓库。它可以阅读代码、修改文件、运行项目已有的命令，并在操作超出当前权限时请求确认。

## 安装

macOS 和 Linux 可以使用官方安装脚本：

```bash
curl -fsSL https://chatgpt.com/codex/install.sh | sh
```

确认命令已经进入 `PATH`：

```bash
codex --version
```

也可以通过 npm 安装：

```bash
npm install --global @openai/codex
```

安装方式和支持的平台可能调整，遇到差异时以 [Codex CLI 官方文档](https://developers.openai.com/codex/cli/) 为准。

## 登录并进入项目

切换到项目根目录后启动 Codex：

```bash
cd ~/code/my-project
codex
```

第一次运行会提示登录，可以选择 ChatGPT 账号或界面中提供的其他登录方式。进入会话后先检查当前目录、模型和权限：

```text
/status
/permissions
```

Codex 默认会限制文件写入范围和网络访问。刚开始使用时保留默认权限即可，不要为了少一次确认就直接开放完整系统权限。

## 建立项目规则

在仓库根目录运行：

```text
/init
```

该命令会生成一份 `AGENTS.md` 草稿。它会在 Codex 开始工作前自动载入，适合记录项目中长期有效的信息：

```markdown
# Repository Guide

## Commands
- Build: `make build`
- Test: `make test`
- Lint: `make lint`

## Conventions
- 修改公共接口时同步更新测试和文档。
- 不要提交生成文件。
- 增加生产依赖前先说明原因。

## Verification
- 完成修改后运行与改动范围对应的测试。
- 最终回复列出改动文件和未执行的检查。
```

规则应当具体、可验证。类似“保持代码优雅”的描述没有执行标准，最好改成项目真实使用的命令、目录约束和检查方式。大型仓库可以在子目录继续放置 `AGENTS.md`，距离目标文件更近的规则优先。

## 完成第一次任务

第一次任务可以选一个范围小、结果容易检查的问题：

```text
阅读这个项目，说明入口、主要模块和本地启动方式。先不要修改文件。
```

确认 Codex 对项目的理解没有偏差后，再让它动手：

```text
修复用户为空时个人资料页崩溃的问题。
只修改相关模块，保留现有接口。
补充回归测试，并运行对应测试。
```

一个有效任务通常包含四部分：

1. 目标：要修复或增加什么。
2. 范围：允许修改哪些模块。
3. 约束：不能改变哪些行为。
4. 验证：完成后运行什么检查。

任务进行中可以直接补充信息或纠正方向，不必等当前工作全部结束。修改完成后使用：

```text
/review
```

让 Codex 重新检查当前改动，再通过 `git diff` 和项目测试确认结果。

## 常用命令

| 命令 | 用途 |
| --- | --- |
| `/status` | 查看当前目录、模型和会话配置 |
| `/permissions` | 调整本次会话允许执行的操作 |
| `/model` | 选择模型和推理强度 |
| `/init` | 生成项目级 `AGENTS.md` |
| `/review` | 审查当前修改并寻找问题 |

需要在脚本或 CI 中执行一次性任务时，可以使用非交互模式：

```bash
codex exec "运行单元测试并总结失败原因，不要修改文件"
```

自动化任务应明确限制权限、工作目录和输出格式。不要在未隔离的环境中运行来源不明的提示或脚本。

## 配置个人默认值

个人配置位于 `~/.codex/config.toml`，项目级覆盖配置位于 `.codex/config.toml`。项目配置只会在仓库被信任后加载。

下面是一份保守的本地配置：

```toml
approval_policy = "on-request"
sandbox_mode = "workspace-write"
```

`approval_policy` 决定什么时候请求确认，`sandbox_mode` 决定命令能够访问和修改哪些位置。配置优先级和完整字段可以查看 [Codex 配置文档](https://developers.openai.com/codex/config-basic/)。

## 常见问题

### 找不到 `codex` 命令

重新打开终端并运行：

```bash
command -v codex
echo "$PATH"
```

安装脚本提示成功但仍找不到命令时，检查安装目录是否已经加入 shell 的 `PATH`。

### Codex 没有遵循项目约定

确认 `AGENTS.md` 位于当前仓库路径中，规则没有互相冲突，并重新启动会话。可以让 Codex 先概括当前加载的规则，再开始修改。

### 命令需要网络或工作区外权限

先确认操作确实属于当前任务，再批准单次执行。依赖安装、访问私有仓库和修改工作区外文件都不应默认长期放行。

## 延伸阅读

- [Codex CLI](https://developers.openai.com/codex/cli/)
- [使用 AGENTS.md 配置项目规则](https://developers.openai.com/codex/guides/agents-md/)
- [Codex 基础配置](https://developers.openai.com/codex/config-basic/)
