---
title: "neat-annotations 上手指南"
tool: neat-annotations
tool_label: "Annotations"
kind: "getting-started"
date: 2026-09-20
order: 30
pageKind: code-space-doc
slug: "neat-annotations"
description: "Hugo shortcode、样式加载、暗色和中文排版怎么接到 neat-annotations"
toc: true
---

[neat-annotations](https://github.com/syabro/neat-annotations) 是一套纯 CSS 标注：给正文里的短语加高亮，需要时再伸出一支手绘箭头和一行手写标签。本站已经接到 `ann` shortcode，文章 Markdown 里直接写即可。

标注是视觉补充，不要把关键信息只放在箭头上。

## 最小例子

The dashboard updates {{< ann n amber "无需刷新" >}}in real time{{< /ann >}}.

源码：

```md
The dashboard updates {{</* ann n amber "无需刷新" */>}}in real time{{</* /ann */>}}.
```

三个位置参数依次是方向、颜色、标签。被包裹的 inner 是箭头指向的目标。

## 方向

方向类表示箭头指向目标的那一侧。`ann-n` 把标签放在目标下方，箭头朝北指回去。

| 类名 | 标签位置 | 箭头朝向 |
| --- | --- | --- |
| `n` | 下 | 北 |
| `ne` | 左下 | 东北 |
| `e` | 左 | 东 |
| `se` | 左上 | 东南 |
| `s` | 上 | 南 |
| `sw` | 右上 | 西南 |
| `w` | 右 | 西 |
| `nw` | 右下 | 西北 |

写了 `note` 但没写方向时，默认 `n`。

{{< ann n blue "默认朝北" >}}target{{< /ann >}} 适合句中短语。

## 颜色

内置六种，浅色 / 深色会跟着站点主题走：

{{< ann amber >}}amber{{< /ann >}}
{{< ann blue >}}blue{{< /ann >}}
{{< ann green >}}green{{< /ann >}}
{{< ann red >}}red{{< /ann >}}
{{< ann purple >}}purple{{< /ann >}}
{{< ann rainbow >}}rainbow{{< /ann >}}

不写颜色就是主题感知的暖灰。任意 CSS 颜色走命名参数：

```md
{{</* ann dir="n" note="hot pink" color="#ff1493" */>}}target{{</* /ann */>}}
```

{{< ann dir="n" note="hot pink" color="#ff1493" >}}target{{< /ann >}}

## 只高亮

省略方向和 `note`，就只剩目标上的色块，没有箭头：

```md
{{</* ann amber */>}}important{{</* /ann */>}}
```

{{< ann amber >}}important{{< /ann >}} 用来标关键词，比加粗更显眼，也不抢行距。

目标自己已有底色时，加上 `nomark="true"`，避免叠两层高亮：

```md
{{</* ann dir="n" color="purple" note="保留原底色" nomark="true" */>}}badge{{</* /ann */>}}
```

## 命名参数

Hugo 不允许同一条 shortcode 混用位置参数和命名参数。参数一多，改用命名写法：

```md
{{</* ann dir="w" color="green" note="从西边指过来" */>}}stable{{</* /ann */>}}
```

{{< ann dir="w" color="green" note="从西边指过来" >}}stable{{< /ann >}}

| 参数 | 作用 |
| --- | --- |
| `dir` | `n` `ne` `e` `se` `s` `sw` `w` `nw` |
| `color` | 内置色名，或任意 CSS 颜色 |
| `note` | 箭头旁的标签 |
| `nomark` | `"true"` 时去掉目标高亮 |
| `class` | 追加 CSS class |
| `style` | 追加 inline style，例如 `--ann-rotate: 2deg` |

inner 会按行内 Markdown 渲染，可以包链接或强调：

```md
打开 {{</* ann n blue "站点配置" */>}}`hugo.yaml`{{</* /ann */>}}。
```

## 排版

箭头和标签绝对定位，不占文档流。本站会给含标注的段落留出空隙，避免箭头被裁掉；一行里仍然不要堆太多。

适合：

- 句中一个短语
- 列表项里的关键词
- 需要读者立刻看见的提醒

不适合：

- 代码块里的 token（高亮是 Chroma class，标注插不进去）
- 表格窄列
- 把操作说明只写在 `note` 里

需要微调时，把 CSS 变量写进 `style`：

| 变量 | 默认 | 控制 |
| --- | --- | --- |
| `--ann-color` | 主题暖灰 | 箭头和标签颜色 |
| `--ann-font` | Patrick Hand + 马善政楷书 | 标签字体 |
| `--ann-mark` | 同色浅底 | 目标高亮 |
| `--ann-label-max-width` | `150px` | 标签折行宽度 |
| `--ann-rotate` | `-4deg` | 标签倾角 |
| `--ann-arrow-x` / `--ann-arrow-y` | `0` | 箭头位移 |
| `--ann-text-x` / `--ann-text-y` | `0` / `5px` | 标签位移 |

```md
{{</* ann dir="n" color="amber" note="再歪一点" style="--ann-rotate: -8deg;" */>}}here{{</* /ann */>}}
```

## Hugo 怎么接

neat-annotations 本身只有一份 CSS，没有 JS、没有构建步骤。接到 Hugo 上要补三层：Markdown 入口、样式加载、和主题 / 中文排版的补丁。

### 1. Markdown 入口是 shortcode，不是 raw HTML

库的官方用法是：

```html
<span class="ann ann-n ann-amber" data-note="无需刷新">in real time</span>
```

本站 Goldmark 已开 `markup.goldmark.renderer.unsafe: true`，这段可以直接写进 `.md`。日常写作仍走 `layouts/shortcodes/ann.html`，避免手拼 class，inner 还能按行内 Markdown 渲染（链接、`` `code` ``、强调）。

shortcode 输出时做了两件 Hugo 特有的事：

- `$.Page.RenderString (dict "display" "inline") .Inner`：inner 不当成独立段落，否则句中标注会被包进 `<p>`。
- 模板末尾用 `{{-` 吃掉换行：否则 `{{</* /ann */>}}.` 的句号会掉到下一行。

Hugo **不允许**同一条 shortcode 混用位置参数和命名参数。短语用位置写法，颜色 / 倾角一多改命名写法。

### 2. CSS 走 `params.customCSS`，补丁叠在库文件上面

`hugo.yaml`：

```yaml
params:
  customCSS:
    - css/chroma.css
    - css/neat-annotations.css
    - css/tui-patch.css
```

Archie 的 `header.html` 会 `resources.Get | fingerprint` 后链进 `<head>`。顺序有意如此：先库文件，后 `tui-patch.css`，覆盖才生效。库文件是 vendored 的 `assets/css/neat-annotations.css`（MIT），不走 jsDelivr。

### 3. `light-dark()` 要靠 `color-scheme`

库用 `light-dark()` 做浅色 / 深色。Archie 的暗色是给 `#darkModeStyle` 加 `disabled`，并在 `html` 上写 `data-theme`。浏览器不会因此切换 `color-scheme`，颜色会停在 light。

`tui-patch.css` 跟主题开关对齐：

```css
html { color-scheme: light; }
html[data-theme="dark"] { color-scheme: dark; }
```

`layouts/partials/head.html` 里那段小脚本负责同步 `data-theme`。

### 4. 标签字体本地托管，不加载 Shantell Sans

库默认 `--ann-font: 'Shantell Sans', cursive`。本站不接外部字体服务，Shantell Sans 从未加载，会落到系统 `cursive`（中文系统上英文字很难看）。

覆盖：

- 英文：`static/fonts/patrick-hand-latin.woff2`（Patrick Hand，OFL，latin 子集）
- 中文：`static/fonts/ma-shan-zheng-cjk.woff2`（[马善政楷书](https://fonts.google.com/specimen/Ma+Shan+Zheng)，OFL，CJK 子集）
- `@font-face` + `--ann-font` 写在 `tui-patch.css`，按 `unicode-range` 分流
- 子集未覆盖的汉字再回退系统楷体

只作用于 `::after` 标签，被高亮的正文仍用文章字体。

### 5. 中文正文：关掉向外伸的 `box-shadow`

库用左右各 `0.3em` 的 `box-shadow` 当荧光笔，阴影**不占布局**。英文词之间的空格能被盖住还好看；CJK 旁边会变成「是App」黏在一起，另一侧「User ，」空一截。

补丁：

- 高亮改成 `padding`，`box-shadow: none`
- 只高亮：`display: inline`，跟正文同一行
- 带 `data-note`（有箭头）：`display: inline-block`，`::before` / `::after` 才有定位盒子

### 6. 箭头不占流，要自己留空

`::before` / `::after` 绝对定位。后面如果紧跟 `h2`，标签会盖住标题（上手页「hot pink」曾经盖住「只高亮」）。

给带方向的目标自己加 margin，而不是给整段加 padding：

```css
.ann-n, .ann-ne, .ann-nw { margin-bottom: 4.75rem; }
.ann-s, .ann-se, .ann-sw { margin-top: 4.75rem; }
.ann-e { margin-inline-start: 7.5rem; }
.ann-w { margin-inline-end: 7.5rem; }
```

正文容器 `.post-content .body { overflow: visible; }`，避免裁切。一行里仍然不要堆太多箭头。

### 7. E-Ink

墨水屏下箭头和标签关掉，只留一条虚线下划线：

```css
html.eink .ann::before,
html.eink .ann::after { display: none !important; }
```

### 文件对照

| 文件 | 作用 |
| --- | --- |
| `assets/css/neat-annotations.css` | vendored 库样式 |
| `assets/css/tui-patch.css` | `color-scheme`、字体、CJK 高亮、箭头占位、E-Ink |
| `layouts/shortcodes/ann.html` | Markdown 入口 |
| `static/fonts/patrick-hand-latin.woff2` | 标签英文字体 |
| `static/fonts/ma-shan-zheng-cjk.woff2` | 标签中文手写体 |
| `hugo.yaml` `params.customCSS` | 加载顺序 |
