---
title: VSCode Remote SSH 问题排查
date: 2026-10-10
tags:
  - vscode
categories:
  - vscode
draft: false
slug: fix-vscode-ssh
series:
series_order:
description:
toc: false
---
一台开发机可以正常 SSH 登录，VS Code 的 Remote-SSH 却始终无法建立开发会话。问题不一定在网络或账号：SSH 登录成功之后，VS Code 还要在远端安装并启动 **VS Code Server**。这一步有自己的系统依赖。

本文记录一次实际排查：宿主机运行 CentOS 7，内核为 **4.14**，glibc 为 **2.21**。我们最终让本机 VS Code 通过 SSH 连接远端 Docker daemon，再直接进入开发容器。文末也说明为什么给宿主机补新版 glibc sysroot 只能算临时方案，以及容器对旧内核的限制。

## SSH 连通，为什么 Remote-SSH 仍然失败？

普通 SSH 只需在远端启动 shell。Remote-SSH 的完整路径则是：

```
本机 VS Code → SSH 登录宿主机 → 安装或启动 VS Code Server → 打开远端工作区
```

VS Code 当前的 Linux 远程开发文档列出的通用要求包括：**内核 ≥ 4.18、glibc ≥ 2.28、libstdc++ ≥ 3.4.25**。这台机器的内核与 glibc 均低于门槛。所以 `ssh` 能打开 shell，并不能证明 VS Code Server 能在宿主机运行。遇到类似问题，先在宿主机检查 `uname -r` 和 `getconf GNU_LIBC_VERSION`，再查看 VS Code 的 **Remote - SSH** 输出，确认失败发生在登录、下载、安装还是启动阶段。仅凭版本号可以判断存在兼容风险，但不要把所有连接报错都归因于 glibc。

## 两条可选路径

| 方案 | VS Code Server 运行位置 | 能解决什么 | 主要限制 |
| --- | --- | --- | --- |
| Docker 开发容器 | 容器内 | 用较新的容器用户态提供 glibc、开发工具与项目依赖 | 容器共享宿主机内核；旧内核仍可能导致兼容问题 |
| 宿主机 glibc sysroot | 宿主机上，使用额外提供的动态库 | 尝试让 Server 使用新版 glibc | 官方标注为不受支持的技术性绕行；不能升级内核 |

我们选择第一条：项目本来就有容器开发环境，VS Code 可以直接连接容器，避免把新版运行库注入宿主机的 VS Code Server 启动流程。

## 实际连接路径：SSH 仍然在场

这里的“通过 Docker 连接”并不是不用 SSH。区别在于 SSH 的用途和 VS Code Server 的落点：

```
Remote-SSH 直连：Mac VS Code → SSH → CentOS 7 宿主机 → 宿主机上运行 VS Code Server

Dev Containers：Mac VS Code → Docker context（SSH）→ 远端 Docker daemon
                                               └→ 开发容器内运行 VS Code Server
```

在这次配置中，本机 Docker context 名为 `mis-docker`，endpoint 为 `ssh://mis-docker`；后一个 `mis-docker` 是本机 SSH 配置中的别名。SSH 负责安全地连接 Docker daemon，远端 daemon 管理名为 `mis-dev` 的开发容器。Docker context 只是 Docker 客户端的连接配置，不会将镜像或项目文件搬到 Mac。

可以用以下命令核对连接目标和容器：

```bash
docker context ls
docker context inspect mis-docker
docker --context mis-docker ps
```

若从零配置，先创建不带交互式 `RemoteCommand` 的 SSH 别名，并确认该账号有使用远端 Docker daemon 的权限，然后在本机创建 context：

```bash
docker context create mis-docker --docker host=ssh://mis-docker
docker --context mis-docker ps
```


## 在 VS Code 中进入开发容器

本机安装 **Dev Containers** 扩展，并让扩展使用远端 Docker context。本例在 VS Code 用户设置中配置了：

```json
{
  "containers.environment": {
    "DOCKER_CONTEXT": "mis-docker"
  }
}
```

随后在本机 VS Code 命令面板执行 **Dev Containers: Attach to Running Container...**，选择 `mis-dev`，再打开容器内的项目目录。需要启动全新 VS Code 进程排查环境继承问题时，也可以从本机终端运行 `DOCKER_CONTEXT=mis-docker code --new-window`。Attach 到已有容器不会重新构建镜像。

这次实践中，`mis-dev` 挂载了 MIS 的后端与前端仓库到 `/workspace/mis` 和 `/workspace/mis-fe`；远端 Docker 的数据根目录已迁到 `/home/docker-data`，避免镜像层和 volume 继续占满较小的 `/var` 分区。**数据目录迁移是磁盘容量问题的处理，不是 Remote-SSH 系统依赖问题的修复。**

## 容器不能替换宿主机内核

这是方案的边界。实测该容器内 `getconf GNU_LIBC_VERSION` 输出 **glibc 2.41**，但 `uname -r` 仍输出 **4.14.0_1-0-0-52**，因为普通 Docker 容器与宿主机共享内核。容器内已有 VS Code Server 文件，但这本身不足以证明每个 VS Code 版本、扩展或功能都能长期正常运行。

因此，本方案改善的是容器的用户态环境；**不能宣称它满足官方文档的内核 ≥ 4.18 要求**。如果启动日志明确指向内核特性或内核版本，换更新的基础镜像也无济于事，需要升级宿主机内核，或者迁移到符合要求的开发机。每次 VS Code 或扩展升级后，也应以实际启动和功能验证为准。

## 为什么没有优先选 sysroot？

VS Code 的官方 FAQ 给出旧 Linux 的一种技术性绕行：准备满足要求的 sysroot 和 `patchelf`，设置 `VSCODE_SERVER_CUSTOM_GLIBC_LINKER`、`VSCODE_SERVER_CUSTOM_GLIBC_PATH`、`VSCODE_SERVER_PATCHELF_PATH`，让 Remote-SSH 安装 Server 时使用指定的动态链接器与库。官方明确将其标记为**不受支持**的使用方式，并建议 `patchelf` 使用 0.18 或更新版本。

这个办法针对的是 glibc 等用户态库，**不会改变 4.14 内核**。在宿主机同时低于内核与 glibc 要求的情况下，配置成功也不能保证 Server 正常运行。它适合作为无法迁移机器、又必须直接编辑宿主机时的临时验证手段；从长期维护角度看，升级宿主机系统或换用符合要求的开发机更稳妥。

## 连接成功之后的另一个问题：扩展网络

VS Code 能进入容器，不代表容器内所有扩展都能访问互联网。这次 Copilot Chat 在容器里请求 GitHub token 时连接超时，出现 **“Language Model unavailable”**；本机 Mac 可以访问 GitHub。我们在 VS Code 用户设置里尝试以 `remote.extensionKind` 将 `GitHub.copilot-chat` 指定为 `ui`，让它优先运行在本机扩展宿主。**这项设置已写入，但当时尚未通过重载远端窗口验证实际运行位置和聊天是否恢复**，不能把它写成已完成的网络修复。

这也提醒我们分开排查三段连接：本机到远端 Docker daemon、本机 VS Code 到容器内 VS Code Server，以及扩展运行位置到其外部服务。第一段可用，不能推导出第三段可用。

## 小结

本例的直接原因是：**SSH 负责登录，Remote-SSH 还必须在宿主机启动 VS Code Server**；旧版 CentOS 的系统条件不满足当前文档门槛。Docker context 让 Dev Containers 通过 SSH 管理远端容器，并把 VS Code Server 的运行位置移到较新的容器用户态。这条路径解决了我们优先面对的 glibc 与开发环境问题，同时保留了一项必须清楚写出的限制：容器无法升级宿主机的 4.14 内核，实际兼容性仍需验证。

参考资料：

VS Code Remote Development with Linux、
VS Code Remote Development FAQ：旧版 Linux 与 sysroot、
VS Code Dev Containers。
