---
title: 从 Jekyll 到 Hugo：重构我的终端风格博客
date: 2026-08-30
categories:
  - hugo
  - blog
slug: hugo-update-blog
description: 记录一次从 Jekyll 迁移到 Hugo 的博客重构，包括目录设计、终端 TUI、E-Ink 模式、自定义域名和 GitHub Pages 部署。
---

之前的博客使用 Jekyll，最初只是一个简单的 GitHub Pages 站点。随着文章、剪藏、工具文档和个人项目逐渐增加，原来的目录和模板开始变得难以维护：内容目录、静态资源、页面模板和构建脚本之间的边界并不清晰，想增加一个新页面，往往需要同时修改多个 Jekyll 文件。

这次重构的目标不是把博客换成一个现成主题，而是重新整理它的结构，并保留这个站点原本的个性：一个带有终端 TUI 气质的个人站，同时支持普通网页模式和适合电子墨水屏的阅读模式。

## 为什么选择 Hugo

Jekyll 仍然足够稳定，也很适合 GitHub Pages。但这次更换框架，主要是因为 Hugo 更适合当前的维护方式：

1. Hugo 是单一二进制程序，构建链路不依赖 Ruby、Bundler 和 Gem。
2. Markdown 内容、模板、数据和静态文件有清晰的默认边界。
3. 模板语言足够直接，适合构建一组小而明确的页面组件。
4. 构建速度快，文章和剪藏数量增加后，日常预览仍然轻量。
5. Hugo Pipes 可以处理 SCSS、压缩 CSS 并生成带指纹的资源文件。

这并不意味着 Hugo 在所有场景下都优于 Jekyll。对于已经稳定运行、主题和插件生态高度依赖 Jekyll 的站点，迁移的收益可能不大。但对一个准备重新设计信息架构和交互方式的个人站来说，Hugo 提供了一个更干净的起点。

## 先确定目录边界

迁移时最重要的决定，是先确定哪些目录属于 Hugo，哪些目录属于独立项目，哪些目录只是构建产物。

当前项目的核心结构如下：

~~~text
content/      Markdown 页面和文章
layouts/      Hugo 模板和可复用 partial
assets/       由 Hugo Pipes 处理的 SCSS 等资源
static/       原样复制到发布站点的文件
data/         模板使用的结构化数据
go-change-lab/独立的 Vite/React/TypeScript 项目
cloudflare/   可选的 Cloudflare Worker
public/       Hugo 生成的最终站点
resources/    Hugo Pipes 生成的缓存
~~~

content 只负责内容，layouts 负责表现，static 负责不需要 Hugo 处理的文件。public 和 resources 都是生成目录，不能把它们当成源文件手工维护。

旧的 Jekyll 文件在迁移阶段曾经放到临时目录中用于比对，确认 Hugo 版本可以独立构建后再删除。这样做的价值在于给 URL、文章数量和资源路径留出核对时间，但临时备份不应该成为新的正式目录。

## 让 posts 继续拥有 Blog 页面

我保留了原来的 posts 目录，而没有新建一个 content/blog 目录：

~~~text
content/
└── posts/
    ├── _index.md
    ├── 2021-08-26-hello.md
    ├── 2024-12-25-raft.md
    └── *.md
~~~

content/posts/_index.md 本身就是 posts section 的入口，通过 front matter 设置为 /blog/。这样文章和 Blog 索引仍然属于同一个内容集合，同时不需要额外维护一份 blog 目录。

文章的 URL 使用稳定的 slug：

~~~yaml
permalinks:
  posts: /:slug
  clippings: /clippings/:slug
  code-space: /code-space/:slug
~~~

迁移框架时，最应该优先保护的是已有链接。视觉可以重做，URL 一旦大量变化，就会影响搜索引擎收录、外部引用和过去分享过的文章。

## 从页面模板到 TUI 组件

这次没有把每个页面都写成一套独立 HTML，而是把共同结构拆成几个 partial。

- head.html 负责页面元信息、SEO、CSS 和主题初始化。
- header.html 负责终端 prompt、空间切换和右对齐导航。
- page-command.html 统一输出 ~/page-title $ ls -t。
- unified-list-item.html 统一 Blog、Clippings 和 Archive 的列表项。
- post.html 负责文章正文、元信息和阅读进度。
- archive.html、blog-index.html 和 clippings-index.html 只保留页面特有的组织逻辑。

Header 有一个看起来很小、但实际很重要的布局约束：当前页面名称不能影响右侧链接的位置。

例如首页显示：

~~~text
elonnzhang@home:~$
~~~

文章页显示：

~~~text
elonnzhang@blog:~$
~~~

prompt 使用固定宽度区域，导航使用 margin-left: auto 和 justify-content: flex-end 推到右侧。这样从 About 切换到 Archive，页面左侧的 prompt 内容会变化，但 Header 的整体节奏不会跟着跳动。

首页的“最近写了什么”保留了原来的 post-list 组件，没有强行和其他页面共用同一个 HTML。Blog、Clippings、Archive 采用 unified-list-item.html，首页则保留更适合快速浏览的日期、标题、分类和摘要组合。统一组件不等于所有页面必须长得完全一样，真正应该统一的是信息层级和交互规则。

## 普通网页模式和 E-Ink 模式

这个站点有两种模式。

普通网页模式支持浅色和深色主题，主题选择保存在浏览器 localStorage 中；没有保存过选择时，会回退到系统的 prefers-color-scheme。

E-Ink 模式通过查询参数开启：

~~~text
https://jiabin.dev/hello?eink=1
~~~

同时支持以下入口：

- Kindle User-Agent 自动进入 E-Ink 模式。
- 支持 eink=1、eink=true 和 eink=yes。
- ?web=1 优先级更高，用于从 E-Ink 预览返回普通网页模式。
- Cloudflare Worker 可以读取 X-Eink、Eink 或 Prefer 请求头，并重定向到 eink=1。

进入 E-Ink 模式后，页面会强制使用黑白配色，正文切换为更适合阅读的衬线字体，隐藏主题切换和装饰性背景，并关闭普通过渡动画。较长的文章还可以使用 PREV / NEXT 控件进行分页阅读。

这里的关键不是做一个“黑白主题”，而是让 E-Ink 模式成为一个更少干扰的阅读界面：颜色不能承担唯一的状态表达，代码、表格、图片和长链接都必须在窄屏上保持可读。

## 图片应该放在哪里

Hugo 项目中，图片的位置取决于是否需要经过 Hugo 处理。

这次博客文章中的图片放在：

~~~text
static/assets/img/
~~~

剪藏文章的图片放在：

~~~text
static/assets/clippings/
~~~

Markdown 中使用根路径引用：

~~~markdown
![GC 示意图](/assets/img/go-gc.png)
~~~

assets/ 目录则用于 SCSS 等需要由 Hugo Pipes 处理的源文件。它和 static/ 的区别可以简单理解为：assets 是“需要构建处理的资源”，static 是“直接复制的资源”。

迁移过程中最容易出错的是把 Jekyll 的相对路径原样带进 Hugo。文章在本地能渲染出来，不代表部署后图片路径一定正确，所以图片路径应该在生成目录中再次检查。

## 保留 Go Change Lab

go-change-lab 不是 Hugo 内容，而是一个独立的 Vite/React/TypeScript 项目。它仍然保留在仓库根目录，构建流程如下：

~~~text
go-change-lab/src/
        ↓ npm run build
go-change-lab/dist/
        ↓ copy
static/go-change-lab/
        ↓ hugo build
public/go-change-lab/
~~~

GitHub Actions 会先进入 go-change-lab 执行 npm ci 和 npm run build，再把 dist/ 复制到 static/go-change-lab/，最后构建 Hugo。部署完成后，这个独立应用通过 /go-change-lab/ 访问。

这也是为什么不能简单地把根目录中所有 Hugo 以外的目录都删除。判断一个目录是否应该保留，不只要看它是不是 Hugo 目录，还要看它是否参与生产构建。

## GitHub Pages 和自定义域名

Hugo 站点的规范域名配置在 hugo.yaml：

~~~yaml
baseURL: https://jiabin.dev/
~~~

仓库根目录和 static/ 中都保留 CNAME，内容为：

~~~text
jiabin.dev
~~~

GitHub Pages 的发布源使用 GitHub Actions。部署流程会生成 public/，上传 Pages artifact，再由 GitHub Pages 发布。

Cloudflare DNS 中，apex 域名可以配置为：

~~~text
类型：CNAME
名称：jiabin.dev
目标：elonnzhang.github.io
代理状态：仅 DNS
TTL：自动
~~~

这里有两个容易混淆的点：

1. DNS 指向 GitHub Pages，只代表域名请求能够找到 GitHub 的服务器。
2. 还需要在 GitHub 仓库 Settings → Pages → Custom domain 中填写 jiabin.dev，GitHub 才会把这个域名绑定到当前 Pages 站点并签发 HTTPS 证书。

绑定自定义域名不会让 elonnzhang.github.io 失效。两个域名可以访问同一个部署，jiabin.dev 作为 canonical URL，elonnzhang.github.io 仍然是默认入口。

## 迁移中遇到的几个问题

### 把字符串当成数组取索引

文章 front matter 中的分类通常写成单个字符串：

~~~yaml
categories: tooling
~~~

如果模板直接执行 index .Params.categories 0，Hugo 可能会把字符串当成字符序列处理，最终页面显示 116 这样的数字，而不是 tooling。模板需要同时兼容字符串和数组，并为没有分类的文章提供默认值。

### 生成目录不是源码目录

public/ 是 Hugo 的输出，resources/_gen/ 是资源缓存。手工修改它们只能暂时改变本地结果，下一次构建就会被覆盖。真正的修复应该回到 content、layouts、assets 或 static 中完成。

### about 和 archive 不能被遗忘

迁移初期，首页和 Blog 往往最容易被关注，About 和 Archive 却可能继续沿用旧页面结构。后来把它们也接入共同的 page command、Header 和列表规范，页面才真正属于同一个站点，而不是几个风格不同的孤岛。

### 构建成功不等于已经发布

本地执行 hugo --gc --minify 成功，只能说明模板和内容可以生成。真正发布还需要确认：

- GitHub Actions 使用正确的 Hugo Extended 版本。
- Go Change Lab 能够在干净环境中通过 npm ci 构建。
- public/ 中包含 blog、clippings、archive、about 和 go-change-lab。
- CNAME 被带进最终 artifact。
- GitHub Pages 已绑定自定义域名并完成 HTTPS。

## 现在的构建方式

本地只检查 Hugo：

~~~bash
hugo --gc --minify
~~~

模拟线上完整构建：

~~~bash
cd go-change-lab
npm ci
npm run build
cd ..
cp -R go-change-lab/dist/. static/go-change-lab/
hugo --gc --minify
~~~

检查 Markdown 和模板改动：

~~~bash
git diff --check
~~~

目前这个站点的重点已经从“找一个主题”转成了“维护一套自己的内容系统”：文章是长期资产，模板负责稳定的阅读体验，静态资源有明确归属，独立项目拥有自己的构建边界，部署过程也可以被自动验证。

从 Jekyll 迁移到 Hugo 只是实现层面的变化，真正值得保留下来的，是对内容、链接和阅读方式的控制权。
