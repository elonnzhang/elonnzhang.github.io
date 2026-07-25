# 本地开发指南

这个项目使用 Jekyll 和 GitHub Pages 构建。日常开发推荐通过 Docker 运行固定版本的 Ruby，避免 macOS 系统 Ruby 与项目依赖不兼容。

## 环境要求

Docker 开发方式需要：

- Docker Desktop 或其他可用的 Docker daemon
- GNU Make
- Git

原生开发方式需要 Ruby 3.3、Bundler 和项目依赖的本地编译环境。当前 macOS 自带的 Ruby 2.6 不适合直接运行本项目。

## 快速开始

检查环境并安装依赖：

```bash
make doctor
make setup
```

启动本地预览：

```bash
make serve
```

浏览器访问：

```text
http://127.0.0.1:4173
```

`make serve` 会监听源文件变化并重新构建。停止服务时在当前终端按 `Ctrl+C`。

如果 `4173` 已被占用，可以临时指定其他端口：

```bash
make serve PORT=4174 LIVERELOAD_PORT=35730
```

## 常用命令

| 命令 | 用途 |
| --- | --- |
| `make help` | 列出所有开发命令 |
| `make doctor` | 检查 Docker、Make 和项目文件 |
| `make setup` | 创建依赖卷并安装 Gem |
| `make serve` | 启动带 LiveReload 的本地服务 |
| `make serve-drafts` | 同时预览草稿和未发布内容 |
| `make build` | 使用 GitHub Pages 安全模式生成 `_site/` |
| `make check` | 执行生产构建和 Git diff 格式检查 |
| `make shell` | 进入带完整依赖的 Ruby 容器 |
| `make stop` | 停止名为 `elonnzhang-blog-dev` 的预览容器 |
| `make clean` | 删除 Jekyll 生成文件和缓存 |

默认配置可以在命令行覆盖：

```bash
make build RUBY_IMAGE=ruby:3.3-bookworm
make setup BUNDLE_VOLUME=my_blog_bundle
make serve CONTAINER_NAME=my-blog PORT=4174
```

## 项目目录

```text
.
├── _posts/                    # 按日期组织的博客文章
├── Clippings/                 # Obsidian Web Clipper 保存的文章
├── _code_space/               # Codex、Claude Code 等工具教程
├── _data/code_space/links.yml # Code Space 中指向已有文章的入口
├── _includes/                 # Header、Footer 等页面片段
├── _layouts/                  # 页面和文章布局
├── _sass/                     # 终端主题及响应式样式
├── assets/                    # 图片、字体和 JavaScript
├── _config.yml                # Jekyll 配置
└── Makefile                   # 本地开发命令
```

`_site/` 是生成结果，不要手工修改，也不要提交到 Git。

## 新增博客文章

博客文章放在 `_posts/`，文件名使用 `YYYY-MM-DD-slug.md`：

```markdown
---
layout: post
title: "文章标题"
date: 2026-07-25
categories: golang
description: "用于首页列表和 SEO 的简短说明"
---

正文从这里开始。
```

项目默认文章链接为 `/:title`。文件名中的日期不会出现在公开 URL 中，修改标题和文件名之前需要确认旧链接是否仍应保留。

## 新增 Code Space 教程

独立教程放在 `_code_space/`：

```markdown
---
title: "工具上手指南"
tool: example
tool_label: "Example"
kind: "getting-started"
order: 30
description: "一行说明教程解决什么问题"
---

正文从这里开始。
```

默认地址是 `/code-space/<文件路径>/`。需要更整洁的 URL 时，可以在 Front Matter 中明确配置：

```yaml
permalink: /code-space/example/
```

如果 Code Space 只需要链接到已有博客文章，不要复制正文，在 `_data/code_space/links.yml` 增加入口：

```yaml
- title: "已有文章标题"
  tool: "example"
  tool_label: "Example"
  kind: "config"
  order: 30
  url: "/existing-post"
  description: "入口说明"
```

## 新增 Clipping

Obsidian Web Clipper 保存的 Markdown 文件放在 `Clippings/`。至少保留标题和创建时间：

```markdown
---
title: "原文标题"
created: 2026-07-25
description: "原文内容摘要"
---
```

Clippings 列表按 `created` 倒序排列。文件可以保留原始标题，不要求使用博客文章的日期文件名格式。

## 修改样式和脚本

主题样式主要位于 `_sass/base.scss`，入口文件是 `css/main.scss`。修改 Header、Footer 或页面骨架前，先检查 `_includes/` 和 `_layouts/` 中是否已有对应结构。

交互脚本位于 `assets/js/`：

- `theme.js`：亮暗模式
- `reading-progress.js`：文章阅读进度
- `post-pagination.js`：访客选择每页文章数

样式和交互需要检查：

- 桌面与手机宽度
- 亮色与暗色模式
- `?eink=1` 墨水屏模式
- 键盘焦点和页面横向溢出

## 提交前检查

运行：

```bash
make check
```

该命令会使用 `--safe --strict_front_matter` 完成一次生产构建，然后检查 Git diff 中的空白问题，并确认首页与 Code Space 首页已经生成。

内容修改还应手动打开相关页面，检查标题、代码块、表格、图片和内部链接。不要只检查首页。

## 原生 Ruby 开发

已经安装 Ruby 3.3 和 Bundler 时，可以不用 Docker：

```bash
make native-setup
make native-serve
```

原生构建命令：

```bash
make native-build
```

Docker 和原生方式会使用不同的 Gem 安装位置，但生成目录都是 `_site/`。

## 常见问题

### 端口已被占用

`make serve` 会在启动前检查站点端口和 LiveReload 端口。如果端口被本项目通过 Makefile 启动的容器占用，先停止它：

```bash
make stop
```

旧的无标签容器或其他本地进程不会被 `make stop` 自动删除。根据错误信息中的容器 ID 停止对应容器，或者改用新的端口：

```bash
docker rm -f <container-id>
make serve PORT=4174 LIVERELOAD_PORT=35730
```

### Gem 安装失败

先确认 Docker 网络正常，然后重新运行：

```bash
make setup
```

依赖保存在名为 `elonnzhang_blog_bundle` 的 Docker volume 中，删除该卷会触发完整重装。

### Front Matter 构建失败

`make check` 使用严格 Front Matter 模式。检查 YAML 分隔线、缩进、引号和日期格式，确认文件开头没有多余字符。

### 页面存在但访问返回 404

确认生成文件位于 `_site/` 中，并使用 Jekyll 服务访问。直接用简单静态服务器预览时，没有扩展名的路径可能无法映射到对应的 `index.html`。
