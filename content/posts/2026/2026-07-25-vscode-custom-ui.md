---
title: VS Code Custom UI CSS 配置
date: 2026-07-25
categories: tooling
slug: vscode-custom-ui
---


插件ID subframe7536.custom-ui-style

配置 settings.json

```
  "custom-ui-style.external.imports": [
    "file:///Users/elon/.vscode/custom/vscode.css"
  ],
```

自定义样式


```
/* ============================================================
   VS Code 自定义样式（配合 Custom CSS and JS Loader 注入）
   亮暗适配说明：VS Code 会在 .monaco-workbench 上挂主题类
   （亮色 .vs / 暗色 .vs-dark / 高对比 .hc-black .hc-light），
   命令面板相关颜色按主题类分别定义，自动跟随主题切换。
   ============================================================ */

/* 全局：垂直滚动条滑块瘦身（只限垂直，避免把水平滑块压成小方块） */
.scrollbar.vertical .slider {
  background: #bc9abc80 !important;
  width: 6px !important;
}

/* 命令面板：输入框样式 */
.quick-input-filter .monaco-inputbox {
  border-radius: 10px !important;
  padding: 12px !important;
  border: none !important;
  font-family: "腾讯体" !important;
  font-size: 20px !important;
  margin-bottom: 10px !important;
}

/* 命令面板：面板容器（与主题无关的形状/布局） */
.quick-input-widget {
  transform: translateY(-50%) !important;
  top: 50% !important;
  padding: 10px 10px 18px 10px !important;
  backdrop-filter: blur(3px) !important;
  border-radius: 12px !important;
  font-size: larger;
}

/* 命令面板：亮色主题配色（保持原始样式） */
.vs .quick-input-widget,
.hc-light .quick-input-widget {
  box-shadow: 0px 4px 32px rgba(168, 147, 225, 0.851) !important;
  border: 1px solid rgba(168, 147, 225, 0.851) !important;
}

.vs .monaco-inputbox input::placeholder,
.hc-light .monaco-inputbox input::placeholder {
  color: rgba(141, 167, 230, 0.78) !important;
}

/* 命令面板：暗色主题配色（同款紫色发光，透明度略降避免暗底过曝） */
.vs-dark .quick-input-widget,
.hc-black .quick-input-widget {
  box-shadow: 0px 4px 32px rgba(168, 147, 225, 0.851) !important;
  border: 1px solid rgba(168, 147, 225, 0.851) !important;
}

.vs-dark .monaco-inputbox input::placeholder,
.hc-black .monaco-inputbox input::placeholder {
  color: rgba(141, 167, 230, 0.78) !important;
}

/* 列表项标签钉回 13px：抵消面板 font-size: larger 的继承，
   否则命令面板/文件列表条目字体会跟着变大 */
.monaco-list .monaco-list-row .monaco-icon-label .label-name {
  font-size: 13px !important;
  font-weight: 400 !important;
}

/* 命令面板：去掉顶部标题栏露出的那条横线（空标题栏自带背景色） */
.quick-input-widget .quick-input-titlebar {
  background: transparent !important;
}

/* 编辑器：文本光标外观（紫色渐变 + 平滑移动） */
.cursor.monaco-mouse-cursor-text {
  transition: all 0.1s ease-out !important;
  border-radius: 2px !important;
  background: radial-gradient(circle at right bottom, hsla(229, 18%, 83%, 0.606), hsl(287, 49%, 57%)) !important;
}

/* 树视图：隐藏展开箭头（影响所有 tree：资源管理器、大纲、调试等） */
.codicon-tree-item-expanded:before {
  display: none !important;
}

/* 侧边栏标题（EXPLORER / SEARCH 等） */
.composite.title h2 {
  font-weight: bold !important;
  font-size: 12px !important;
  text-transform: uppercase;
  color: #5b6eda !important;
  font-family: "腾讯体" !important;
}

/* 按钮：统一圆角 */
.monaco-workbench .monaco-button,
.monaco-workbench .monaco-button.primary {
  border-radius: 6px !important;
}

/* Command Center：项目名居中 */
.actions-container .command-center-center .command-center-quick-pick {
  margin: auto !important;
  flex: none !important;
}
```
