---
title: "Getting started with loops"
source: "https://x.com/ClaudeDevs/status/2074208949205881033"
author:
  - "[[@ClaudeDevs]]"
published: 2026-07-07
created: 2026-07-07
description: "There’s a lot of talk right now about \"designing loops\" instead of prompting your coding agent. If you spend some time on X trying to pin do..."
tags:
  - "clippings"
---
![图像](https://pbs.twimg.com/media/HMkRVmsaEAA3Dl5?format=jpg&name=large)

There’s a lot of talk right now about "designing loops" instead of prompting your coding agent. If you spend some time on X trying to pin down what a loop actually is, you'll come across multiple different answers.

On the Claude Code team, we define **loops as agents repeating cycles of work until a stop condition is met**. We categorize a few different types of loops based on:

- How they are triggered
- How they are stopped
- What Claude Code primitive is used
- What type of task is most appropriate for each.

We’ll cover the main loop types, when to use each, and how to maintain code quality while managing token usage. Not all tasks require complex loops; start with the simplest solution and use these patterns selectively.

## Turn-based loops

![图像](https://pbs.twimg.com/media/HMkOVNybEAAncbL?format=jpg&name=large)

- **Triggered by**: A user prompt.
- **Stop criteria**: Claude judges it has completed the task or needs additional context.
- **Best used for:** Shorter tasks that are not part of a regular process or schedule.
- **Managed usage by:** Write specific prompts and improve verification using skills to reduce the number of turns.**‍**

Every prompt you send starts a manual loop with you directing each turn. Claude gathers context, takes action, checks its work, repeats if needed, and responds. We call this the agentic loop.

For example, ask Claude to create a like button. It reads your code, makes the edit, runs the tests, and hands back something it believes works. You then manually check the work, and write the next prompt.

You can improve the verification step by encoding your manual steps as a SKILL.md so Claude can check more of its own work, end-to-end. This should include tools or connectors to allow Claude to see, measure or interact with the result. The more quantitative the checks are, the easier it is for Claude to self-verify.

For example, in your SKILL.md file you may specify:

```markdown
--- 
name: verify-frontend-change 
description: Verify any UI change end-to-end before declaring it done. 
--- 

# Verifying frontend changes 
Never report a UI change as complete based on a successful edit alone. Verify it the way a human reviewer would: 

1. Start the dev server and open the edited page in the browser. 

2. Interact with the change directly. For a new control (button, input, toggle): click it, confirm the expected state change, and screenshot before/after. 

3. Check the browser console: zero new errors or warnings. 

4. Use the Chrome Devtools MCP, run a performance trace and audit Core Web Vitals.

If any step fails, fix the issue and rerun from step 1 — do not hand back partially verified work.
```

## Goal-based loop (/goal)

![图像](https://pbs.twimg.com/media/HMkOlk3bcAAHX46?format=jpg&name=large)

- **Triggered by**: A manual prompt in real-time.
- **Stop criteria**: Goal achieved OR maximum number of turns reached.
- **Best used for:** Tasks that have verifiable exit criteria.
- **Managed usage by:** Setting a specific completion criteria and explicit turn caps, “stop after 5 tries.”

Sometimes, a single turn is not enough, especially for more complex tasks. Agents do better when they can iterate. You can extend how long Claude keeps iterating by defining what done looks like with /goal.

When you define the success criteria, Claude doesn’t have to make a determination on what is “good enough” and end the loop early. Each time Claude tries to stop, an evaluator model checks your condition and sends it back to work until the goal is met or a number of turns you define is reached.

This is why deterministic criteria, such as number of tests passed or clearing a certain score threshold, are so effective.

For example:

```bash
/goal get the homepage Lighthouse score to 90 or above, stop after 5 tries.
```

## Time-based loop (/loop and /schedule)

- **Triggered by**: A specified time interval.
- **Stop criteria**: You cancel it, or the work completes (the PR merges, the queue is empty).
- **Best used for:** For recurring work, or interfacing with external environments / systems.
- **Managed usage by:** Set longer intervals or react based on events rather than time.

Some agentic work is recurring: the task stays the same and only the inputs change. For example, summarizing Slack messages every morning. Other work depends on external systems, and a simple way to interface with one is to check it on an interval and react to what changed. For example, a PR which may receive code reviews or fail CI.

For these, you can trigger when Claude runs with \`/loop\` which re-runs a prompt on an interval. For example:

```bash
/loop 5m check my PR, address review comments, and fix failing CI
```

\`/loop\` runs on your computer, so if you turn it off, it stops. You can move the loop to the cloud by creating a routine with  \`/schedule\`.

## Proactive loops

![图像](https://pbs.twimg.com/media/HMkPQM8bEAA3RAk?format=jpg&name=large)

- **Triggered by**: An event or schedule, with no human in real time.
- **Stop criteria**: Each task exits when its goal is met. The routine itself runs until you turn it off.
- **Best used for:** Recurring streams of well-defined work: bug reports, issue triage, migrations, dependency upgrades, etc.
- **Managed usage by:** Routing routines to smaller, faster models and using the most capable model for judgment calls.

The primitives above, along with other Claude Code features like **auto mode** and **dynamic workflows** (research preview) can be composed into a loop for long-running work.

For example, to handle incoming feedback, you can use:

1. **\`/schedule\`** (research preview) to run a routine that checks for new reports
2. **\`/goal\`** to define what done looks and **skills** to document how to verify it
3. **Dynamic workflows** to orchestrate agents that triage each report, fix it, and review the fix
4. **Auto mode** so the routine runs without stopping to ask for permission

Putting it together, a prompt could look like this:

```bash
/schedule every hour: check the project-feedback channel for bug reports. /goal: don't stop until every report found this run is triaged, actioned, and responded to. When fixing a bug, use a workflow to explore three solutions in parallel worktrees and have a judge adversarially review them.
```

## Maintaining code quality

The quality of a loop’s output depends on the system around it. When designing the system:

- **Keep the codebase itself clean**: Claude follows patterns and conventions that already exist in your codebase.
- **Give Claude a way to verify its own work**: Encode what good looks like for you and your team with [skills](https://code.claude.com/docs/en/skills).
- **Make docs easy to reach:** Frameworks and libraries docs have up-to-date best practices.
- **Use a second agent for code reviews**: A reviewer with fresh context is less biased and not influenced by the main agent’s reasoning. You can use the built-in \`/code-review\` skill or [Code Review](https://code.claude.com/docs/en/code-review) for Github.

When an individual result doesn’t meet the standard, don’t stop at fixing the individual issue, try to encode it to improve the system for all future iterations.

## Managing token usage

To manage token usage, loops should have clear boundaries:

- **Choose the right primitive and model for the job:** Smaller tasks don’t need multiple agents or loops. Some tasks can use cheaper and faster models.
- **Define clear success and stop criteria:** Be specific about what done looks like so Claude can arrive at the solution sooner (but not too soon).
- **Pilot before a large run:** Dynamic workflows can spawn hundreds of agents. Gauge usage on a smaller slice of the work first.
- **Use scripts for deterministic work**: Running a script is cheaper than reasoning through the steps. For example, a PDF skill can ship a form-filling script that Claude runs each time, instead of re-deriving the code.
- **Don’t run routines more often that you need to:** Match the interval to how often the thing you’re watching changes
- **Review usage:** The \`/usage\` command breaks down recent usage by skills, subagents, and MCPs, \`/goal\` with no arguments shows number of turns and token usage so far, \`/workflows\` shows each agent’s token usage and you can stop an agent at any time.

## Getting started

To summarize:

| Loop | You hand off | Use it when | Reach for |
| --- | --- | --- | --- |
| Turn-based | The check | You're exploring or deciding | Custom verification skills |
| Goal-based | The stop condition | You know what done looks like | /goal |
| Time-based | The trigger | The work happens outside your project on a schedule | /loop  ,  /schedule |
| Proactive | The prompt | The work is recurring and well-defined | All of the above, and dynamic workflows |

To get started with loops, look at the work you already do. Pick one task where you’re the bottleneck and ask which piece you could hand off: can you write the verification check? Is the goal clear enough? Does the work arrive on a schedule?

Once you have an idea, run the loop, observe the results like where it stalls or over-reaches, and don’t be afraid to iterate on it.

For more information, read the Claude Code docs on [running agents in parallel,](https://code.claude.com/docs/en/agents) as well as the [loop](https://code.claude.com/docs/en/goal), [schedule](https://code.claude.com/docs/en/routines), [goal](https://code.claude.com/docs/en/goal), and [dynamic workflows](https://code.claude.com/docs/en/workflows#orchestrate-subagents-at-scale-with-dynamic-workflows) pages.

This article was written by [@delba\_oliveira](https://x.com/@delba_oliveira)


----
# 译文

现在有很多人在讨论：与其不断提示你的编程 Agent，不如“设计循环”。但如果你花点时间在 X 上试图弄清楚“循环”到底是什么，你会看到很多不同答案。

在 Claude Code 团队，我们把 **循环** 定义为：**Agent 重复执行工作周期，直到满足停止条件**。我们会根据以下几个维度，把循环分成几种类型：

* 如何触发
* 如何停止
* 使用了哪种 Claude Code 原语
* 最适合哪类任务

本文会介绍主要的循环类型、每种循环的适用场景，以及如何在管理 token 使用量的同时保持代码质量。并不是所有任务都需要复杂循环；应该从最简单的方案开始，只在合适的时候使用这些模式。

## 基于轮次的循环

* **触发方式**：用户提示词。
* **停止条件**：Claude 判断任务已经完成，或者需要更多上下文。
* **最适合**：较短的任务，且不是固定流程或定期任务的一部分。
* **用量管理方式**：写出更具体的提示词，并通过 skills 改进验证流程，从而减少交互轮次。

你发送的每一个提示词，都会启动一个手动循环。在这个循环中，你负责指导每一轮。Claude 会收集上下文、采取行动、检查自己的工作，如有需要就重复，然后给出回复。我们称之为 agentic loop，也就是智能体循环。

例如，你让 Claude 创建一个点赞按钮。它会阅读你的代码，完成修改，运行测试，然后交付一个它认为可用的结果。接着，你手动检查它的工作，并写出下一条提示词。

你可以把自己的人工检查步骤编码进 `SKILL.md`，从而改进验证环节，让 Claude 能够更完整地端到端检查自己的工作。这个 skill 应该包含工具或连接器，使 Claude 能够查看、测量或与结果交互。验证越量化，Claude 就越容易自我验证。

例如，你可以在 `SKILL.md` 文件中这样写：

```markdown
--- 
name: verify-frontend-change 
description: Verify any UI change end-to-end before declaring it done. 
--- 

# Verifying frontend changes 
Never report a UI change as complete based on a successful edit alone. Verify it the way a human reviewer would: 

1. Start the dev server and open the edited page in the browser. 

2. Interact with the change directly. For a new control (button, input, toggle): click it, confirm the expected state change, and screenshot before/after. 

3. Check the browser console: zero new errors or warnings. 

4. Use the Chrome Devtools MCP, run a performance trace and audit Core Web Vitals.

If any step fails, fix the issue and rerun from step 1 — do not hand back partially verified work.
```

## 基于目标的循环 `/goal`

* **触发方式**：实时手动提示。
* **停止条件**：目标达成，或者达到最大轮次。
* **最适合**：有可验证退出条件的任务。
* **用量管理方式**：设置具体完成标准和明确轮次上限，例如“尝试 5 次后停止”。

有时候，单轮交互并不足够，尤其是在处理更复杂任务时。Agent 在可以迭代时表现更好。你可以通过 `/goal` 定义“完成”的样子，从而延长 Claude 持续迭代的时间。

当你定义成功标准后，Claude 就不需要自己判断什么叫“足够好”，也不容易过早结束循环。每次 Claude 尝试停止时，一个评估模型都会检查你的条件；如果条件没有满足，就会把它送回去继续工作，直到目标达成，或者达到你定义的轮次上限。

这就是为什么确定性的标准非常有效，比如通过多少测试，或者达到某个分数阈值。

例如：

```bash
/goal get the homepage Lighthouse score to 90 or above, stop after 5 tries.
```

## 基于时间的循环 `/loop` 和 `/schedule`

* **触发方式**：指定的时间间隔。
* **停止条件**：你取消循环，或者工作完成，例如 PR 合并、队列清空。
* **最适合**：周期性工作，或者与外部环境、外部系统交互。
* **用量管理方式**：设置更长的间隔，或者基于事件响应，而不是单纯按时间轮询。

有些 agentic 工作是周期性的：任务本身不变，只是输入发生变化。例如，每天早上总结 Slack 消息。还有一些工作依赖外部系统，和这类系统交互的一种简单方式，就是按一定间隔检查它，并根据变化做出反应。例如，一个 PR 可能收到代码评审意见，也可能 CI 失败。

对于这类任务，你可以用 `/loop` 来触发 Claude 定期运行某个提示词。例如：

```bash
/loop 5m check my PR, address review comments, and fix failing CI
```

`/loop` 是在你的电脑上运行的，所以如果你关闭电脑，它就会停止。你可以通过 `/schedule` 创建一个 routine，把这个循环迁移到云端。

## 主动式循环

* **触发方式**：事件或日程，无需人类实时参与。
* **停止条件**：每个任务在目标完成时退出。routine 本身会持续运行，直到你关闭它。
* **最适合**：持续出现、定义明确的周期性工作流，例如 bug 报告、issue 分诊、迁移、依赖升级等。
* **用量管理方式**：把 routine 路由给更小、更快的模型，把最强模型用于需要判断的环节。

上面这些原语，再加上 Claude Code 的其他功能，比如 **auto mode** 和 **dynamic workflows**，可以组合成长时间运行的循环。

例如，为了处理持续进入的反馈，你可以这样组合：

1. 使用 `/schedule` 定期运行一个 routine，检查新的报告。
2. 使用 `/goal` 定义什么叫完成，并用 skills 记录如何验证。
3. 使用 Dynamic workflows 编排多个 Agent，让它们分别分诊每条报告、修复问题，并评审修复结果。
4. 使用 Auto mode，让 routine 不需要停下来请求权限，自动运行。

组合起来，提示词可能长这样：

```bash
/schedule every hour: check the project-feedback channel for bug reports. /goal: don't stop until every report found this run is triaged, actioned, and responded to. When fixing a bug, use a workflow to explore three solutions in parallel worktrees and have a judge adversarially review them.
```

## 维护代码质量

循环输出的质量取决于它周围的系统。设计系统时，需要注意：

* **保持代码库本身干净**：Claude 会遵循代码库里已有的模式和约定。
* **给 Claude 一种验证自己工作的方式**：用 skills 编码你和团队对“好结果”的定义。
* **让文档容易访问**：框架和库的文档包含最新最佳实践。
* **使用第二个 Agent 做代码评审**：一个拥有新鲜上下文的评审者偏见更少，也不会被主 Agent 的推理过程影响。你可以使用内置的 `/code-review` skill，或者用于 GitHub 的 Code Review。

当某个单次结果没有达到标准时，不要只修复这个单独问题。应该尝试把这个问题编码进系统，让未来所有迭代都因此受益。

## 管理 token 使用量

为了管理 token 使用量，循环应该有清晰边界：

* **为任务选择正确的原语和模型**：小任务不需要多个 Agent 或复杂循环。有些任务可以使用更便宜、更快的模型。
* **定义清晰的成功标准和停止条件**：明确什么叫完成，让 Claude 能更快到达解决方案，但也不要太早停止。
* **大规模运行前先试点**：Dynamic workflows 可能会生成数百个 Agent。先在较小范围内估算用量。
* **用脚本处理确定性工作**：运行脚本比让模型一步步推理更便宜。例如，一个 PDF skill 可以内置一个表单填写脚本，让 Claude 每次直接运行，而不是每次重新推导代码。
* **不要让 routine 运行得比实际需要更频繁**：让运行间隔匹配被监听对象的变化频率。
* **检查用量**：`/usage` 命令会按 skills、subagents 和 MCPs 拆分最近的使用量；不带参数的 `/goal` 会显示目前的轮次数和 token 使用量；`/workflows` 会显示每个 Agent 的 token 使用量，并且你可以随时停止某个 Agent。

## 如何开始

总结如下：

| 循环   | 你交出去的东西 | 适用场景           | 应该使用                      |
| ---- | ------- | -------------- | ------------------------- |
| 基于轮次 | 检查环节    | 你还在探索或决策       | 自定义验证 skills              |
| 基于目标 | 停止条件    | 你知道什么叫完成       | `/goal`                   |
| 基于时间 | 触发器     | 工作在你的项目之外按计划发生 | `/loop`、`/schedule`       |
| 主动式  | 提示词     | 工作是周期性的，并且定义明确 | 以上全部，以及 dynamic workflows |

想要开始使用 loops，可以先观察你已经在做的工作。挑一个你自己成为瓶颈的任务，然后问自己：哪一部分可以交给 Agent？你能不能写出验证检查？目标是否足够清晰？工作是否按某种节奏到来？

一旦你有了想法，就运行这个循环，观察结果，比如它在哪里卡住、在哪里越界，然后持续迭代它。

更多信息可以阅读 Claude Code 文档，包括 running agents in parallel、loop、schedule、goal，以及 dynamic workflows 页面。

本文作者是 @delba_oliveira。
