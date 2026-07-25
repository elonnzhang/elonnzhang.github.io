---
title: "Claude Code 上手指南"
tool: claude-code
tool_label: "Claude Code"
kind: "getting-started"
order: 20
slug: "claude-code"
permalink: "/code-space/claude-code/"
description: "从安装、项目规则到完成第一次交互式开发任务"
---

Claude Code 在终端中读取项目、编辑文件并运行开发命令。下面以 macOS、Linux 和 WSL 为主，完成安装后直接从一个 Git 仓库开始。

## 安装

官方推荐使用原生安装器：

```bash
curl -fsSL https://claude.ai/install.sh | bash
```

macOS 也可以通过 Homebrew 安装稳定版本：

```bash
brew install --cask claude-code
```

检查安装结果：

```bash
claude --version
claude doctor
```

`claude doctor` 只读取安装和配置状态，可以用于检查版本、配置文件错误和更新问题。Windows、Linux 软件源及其他安装方式参见 [Claude Code 安装文档](https://code.claude.com/docs/en/getting-started)。

## 登录并开始会话

进入项目后运行：

```bash
cd ~/code/my-project
claude
```

按照浏览器提示完成登录。也可以显式执行：

```bash
claude auth login
claude auth status --text
```

进入会话后先让 Claude Code 阅读项目，不要马上进行大范围修改：

```text
说明项目入口、主要目录、本地启动方式和测试命令。先不要修改文件。
```

这一步可以尽早发现工作目录不对、构建命令缺失或项目结构理解错误。

## 建立 CLAUDE.md

在交互会话中运行：

```text
/init
```

Claude Code 会分析仓库并生成 `CLAUDE.md` 草稿。建议检查后保留真正有用的内容：

```markdown
# Project Guide

## Commands
- Install: `pnpm install`
- Dev: `pnpm dev`
- Test: `pnpm test`

## Project layout
- `src/api/` 存放接口处理代码。
- `src/components/` 存放可复用组件。
- `tests/` 的目录结构与 `src/` 保持一致。

## Working rules
- 修改行为时补充对应测试。
- 不要修改生成文件和锁文件，除非任务需要。
- 完成后运行受影响模块的测试。
```

项目规则可以放在仓库根目录的 `CLAUDE.md` 或 `.claude/CLAUDE.md`。个人全局规则位于 `~/.claude/CLAUDE.md`，只在本地生效的项目规则可以放进 `CLAUDE.local.md`，并加入 `.gitignore`。

`CLAUDE.md` 应保持简短，主要记录构建命令、目录约定和长期有效的工程规则。只对某类文件生效的约束可以拆到 `.claude/rules/`。

## 完成第一次修改

适合入门的任务应该范围明确，并且能通过测试或页面行为验证：

```text
修复登录表单重复提交的问题。
只修改表单和相关测试，不调整接口协议。
完成后运行对应测试，并总结改动。
```

推荐按下面的顺序推进：

1. 让 Claude Code 定位相关代码并解释原因。
2. 确认修改范围和验证方式。
3. 允许它编辑文件并运行针对性测试。
4. 查看 diff，确认没有混入无关重构。
5. 再运行一次完整检查。

需要先分析而不修改时，可以启动计划模式：

```bash
claude --permission-mode plan
```

也可以在会话里打开权限界面：

```text
/permissions
```

只允许当前任务真正需要的命令。跳过全部权限确认的模式适合已经隔离的临时环境，不应作为日常默认值。

## 常用会话方式

启动时直接附带任务：

```bash
claude "解释这个项目的请求处理链路"
```

继续当前目录最近一次会话：

```bash
claude -c
```

选择历史会话继续：

```bash
claude --resume
```

执行一次非交互查询并退出：

```bash
claude -p "运行静态检查并总结错误，不要修改文件"
```

非交互模式适合脚本和 CI，但要同时限制可用工具、任务轮数和输出格式，避免把交互确认直接搬进自动化环境。

## 配置放在哪里

Claude Code 使用多层配置：

| 范围 | 路径 | 用途 |
| --- | --- | --- |
| 用户 | `~/.claude/settings.json` | 个人主题、工具和通用设置 |
| 项目 | `.claude/settings.json` | 团队共享的权限、Hook 和 MCP 设置 |
| 本地 | `.claude/settings.local.json` | 当前机器和项目的私有覆盖 |
| 项目规则 | `CLAUDE.md` 或 `.claude/CLAUDE.md` | 构建命令、架构和工作约定 |

本地配置的优先级高于项目和用户配置。团队共享配置应提交到版本控制，本机路径、测试账号和个人偏好放在本地配置中。

## 常见问题

### 安装成功但找不到命令

重新打开终端并检查：

```bash
command -v claude
echo "$PATH"
```

原生安装通常把启动文件放在 `~/.local/bin/claude`。该目录不在 `PATH` 时，需要按当前 shell 的方式加入环境变量。

### 登录状态异常

运行：

```bash
claude auth status --text
claude doctor
```

如果浏览器登录没有完成，重新执行 `claude auth login`。公司代理或防火墙环境还需要确认 Claude Code 所需域名能够访问。

### CLAUDE.md 没有生效

在会话中运行 `/context`，检查 Memory files 中是否包含目标文件。规则冲突、文件过长或启动目录不正确，都会让实际行为偏离预期。

### 权限提示过多

使用 `/permissions` 查看规则来源，只为重复且安全的命令增加精确规则。不要直接允许所有 Bash 命令，删除文件、修改 Git 历史和发布操作仍应保留确认。

## 延伸阅读

- [Claude Code 安装与更新](https://code.claude.com/docs/en/getting-started)
- [CLAUDE.md 与项目记忆](https://code.claude.com/docs/en/memory)
- [配置与权限](https://code.claude.com/docs/en/settings)
- [CLI 命令参考](https://code.claude.com/docs/en/cli-usage)
