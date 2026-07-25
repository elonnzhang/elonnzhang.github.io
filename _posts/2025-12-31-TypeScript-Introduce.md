---
layout: post
title: TypeScript 入门
date: 2025-12-31
categories: frontend
---

[typescript org](https://www.typescriptlang.org/docs/handbook/intro.html)

TypeScript 是 JavaScript 的一种“风格”或“变体”。

## 一、背景：JavaScript 的问题从何而来

JavaScript 最初是为**浏览器中的短脚本**设计的语言，而非大型工程：

- 早期代码规模小、容错要求低
- 语言设计偏灵活，隐式类型转换多
- 运行时错误多，且往往**无法提前发现**
    
随着 Web 和 Node.js 的发展，JS 被用于：

- 前端大型应用
- 后端服务
- 全栈开发
    
结果是：  
**“一门为小脚本设计的语言，被用于百万行级别的工程”**，问题被系统性放大。

典型问题包括：
- `==` 导致的隐式类型转换陷阱
- 表达式语义反直觉（如 `1 < x < 3`）
- 访问不存在的属性却不报错，直到运行时才暴雷

----
- JavaScript’s equality operator (`==`) _coerces_ its operands, leading to unexpected behavior:  
```ts
if ("" == 0) {
  // It is! But why??
}
if (1 < x < 3) {
  // True for *any* value of x!
}
```
    
- JavaScript also allows accessing properties which aren’t present:
```ts
const obj = { width: 10, height: 15 };
// Why is this NaN? Spelling is hard!
const area = obj.width * obj.heigth;
```
----

## 二、TypeScript 的定位：静态类型检查器

**TypeScript 的本质不是一门全新的语言，而是：**

> JavaScript + 编译期的静态类型检查

核心定位非常克制、也非常重要：

- **在代码运行之前发现错误**
- **不改变 JavaScript 的运行方式**
- **不引入新的运行时成本**

关键概念：
- **静态检查（Static Checking）**：不运行代码就发现错误
- **静态类型检查（Static Type Checking）**：基于“值的类型”判断操作是否合法
    
示例价值：
- 拼写错误（`heigth` → `height`）
- 不合理的运算（`number / array`）
这些错误在 JS 中要么不报错、要么运行时报错，而 TS 可以在你敲代码时就拦住。

## 三、与 JavaScript 的关系：完全兼容的超集

### 1. 语法层面（Syntax）

- **所有合法的 JavaScript，都是合法的 TypeScript**
- TS 不会因为“写法”否定任何 JS 代码

换句话说：
- JS → TS 是“零语法成本迁移”

### 2. 类型层面（Types）

TypeScript 在 JS 之上**增加规则**，用于约束值的使用方式：

- 哪些类型可以参与哪些运算
- 某个对象“应该”有哪些属性
- 某个函数“期望”接收和返回什么
    
重要态度：
- TS 的类型系统目标是：  
    **“尽可能放行正确代码，同时捕获尽可能多的常见错误”**
- 有时会显得“过于保守”，但这是可配置、可逐步放松的
    
## 四、关键承诺：不改变运行时行为

这是 TypeScript 的**底层原则**，非常重要：

### 1. 运行时行为保持一致

- TS **永远不会改变 JS 的运行结果**
- 即使 TS 报错，代码在 JS 中仍然可以照常运行
    
例如：
- JS 中 `1 / 0 === Infinity`
- TS 不会把它改成抛异常
    
### 2. 类型会被“擦除”（Erased Types）

- 编译完成后，**类型信息完全消失**
- 输出的就是普通 JavaScript
    
因此：
- 类型只存在于**开发期**
- 对性能、体积、运行时零影响

### 3. 没有 TS 专属运行时库

- TS 不提供额外的运行时 API
- 使用的仍然是 JS 的标准库 / 第三方库
    
这保证了：
- TS 不制造“生态割裂”
- JS 与 TS 可以无缝共存

## 五、学习顺序的结论：不能跳过 JavaScript

> **你不可能在不懂 JavaScript 的情况下学好 TypeScript**

原因很现实：
- TS 的运行时就是 JS
- 所有“怎么做事”的问题，本质仍是 JS 问题
- TS 只负责：**“你这样写，合不合理”**
- 

因此：
- 查资料时，不必执着于 “TypeScript 版本的答案”
- **绝大多数 JS 解决方案，直接适用于 TS**

## 六、实践导向的学习建议

文档给出的推荐路径是：

1. **补齐 JavaScript 基础**
    - MDN / Microsoft JS 资源
        
2. **快速理解 TS 在 JS 上加了什么**
    - 类型
    - 编译期错误
        
3. **逐步深入 TS Handbook**
    - Everyday Types
    - Functions / Objects
    - Narrowing / Generics
        
4. **多用 Playground 验证直觉**
  
## 七、一句话总结

> **TypeScript 不是为了“写得更高级”，而是为了“更早发现错误、降低大型工程的不确定性”。**
