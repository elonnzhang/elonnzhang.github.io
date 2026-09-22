---
title: Agent Development Kit (ADK) . - Session Database
date: 2026-09-22
tags:
  - agent
  - ai
  - golang
draft: false
slug: adk-session-database
description: session/database 用 GORM 把 Session、Event、三层 State 落到四张表。核心不是「存一条 Event」，而是一次事务里同时提交历史追加、StateDelta 和更新时间。
---
ADK-Go 源码阅读笔记 · Session Database

> 上一篇讲完 Session / Event / State 的数据模型，这一篇看关系型实现：`session/database` 如何用 GORM 把它们落到四张表。真正的核心不是「把 Session JSON 塞进一列」，而是一次事务里同时提交 Event 历史、三层 StateDelta 和 `update_time`。

源码主要在：

- `session/database/service.go`
- `session/database/storage_session.go`
- `session/database/gorm_datatypes.go`
- `session/database/session.go`

```
session.Service
    ↓
databaseService
    ↓
gorm.DB
    ↓
PostgreSQL / MySQL / SQLite / Spanner / 其他 GORM Dialector
```

入口两个：已有 Dialector 用 `NewSessionService`，已有 `*gorm.DB` 用 `NewSessionServiceFromDB`。

## 一、建表

```go
sessionService, err := database.NewSessionServiceFromDB(db)
if err != nil {
    log.Fatal(err)
}
if err := database.AutoMigrate(sessionService); err != nil {
    log.Fatal(err)
}
```

`AutoMigrate` 只接受 `session/database` 自己创建的 Service——内部要取出具体的 `*gorm.DB`。它迁移四个模型，对应四张表：

| 模型 | 表 | 作用 |
| --- | --- | --- |
| `storageSession` | `sessions` | Session 元数据 + Session-level State |
| `storageEvent` | `events` | Event 历史，一行一条 |
| `storageAppState` | `app_states` | App 级共享状态 |
| `storageUserState` | `user_states` | User 级共享状态 |

生产环境更适合用迁移工具管 Schema，而不是每次启动 `AutoMigrate`。

## 二、四张表

`sessions` 的逻辑主键是 `(AppName, UserID, ID)`，也就是 `(app_name, user_id, session_id)`。Session-level State 放在 `sessions.state`。Events 通过外键挂在 Session 上，`OnDelete:CASCADE`。

`events` 的逻辑主键是 `(ID, AppName, UserID, SessionID)`。Event ID 单独不够当主键——不同 Session 可能撞同一个 Event ID，组合键避免跨 Session 冲突。关联键是 `(AppName, UserID, SessionID)`。

`app_states` 以 `AppName` 为主键；`user_states` 以 `(AppName, UserID)` 为主键。前者全 App 共享，后者同一用户在同一 App 下的多个 Session 共享。删 Session 不会动这两张表。

复杂字段不能当普通 SQL 列。`Actions` 直接 `json.Marshal` 成 `[]byte`；`Content` / `Output` / `Routes` / `NodeInfo` / `RequestedInput` 等走 `dynamicJSON`（本质是 `json.RawMessage`）——数据库层只保存合法 JSON，不提前决定 Go 类型。Workflow 依赖的 `Routes`、`NodeInfo`、`RequestedInput`、`IsolationScope`、`Output`、`Branch` 都必须能往返，否则路由、HITL Resume、动态节点恢复、Branch 隔离都会断。

## 三、三层 State 怎么拆

ADK 的 State 作用域是 App / User / Session。一个 Event 的 `StateDelta` 可能同时带四种键：

```go
event.Actions.StateDelta = map[string]any{
    "app:default_currency": "USD",
    "user:language":         "zh-CN",
    "current_order":         "order-123",
    "temp:attempt":          2,
}
```

`extractStateDeltas` 按前缀拆开：

```
app:key   → app_states，库里的 key 是 key
user:key  → user_states，库里的 key 是 key
temp:key  → 不持久化
普通 key   → sessions.state
```

读回来再合并 `sessions.state + app_states + user_states`，对外重新带上 `app:` / `user:` 前缀。`temp:` 只在当前执行期间可读；持久化前会复制一份 Event 再剥掉临时键，不改调用者手里的原始 Delta。

直接改 `sess.State().Set(...)` 只动当前 `localSession` 内存，不会 UPDATE，也不会生成 Event / StateDelta。Agent / Tool / Callback / Workflow 里应走 `ctx.State()`——它把修改记到当前 Event 的 `StateDelta`，等 Runner `AppendEvent` 才落库。

## 四、JSON 列的两个坑

`stateMap`（`map[string]any`）实现了 GORM 自定义类型：写出 JSON，读回 map。PostgreSQL 用 `JSONB`，MySQL 用 `LONGTEXT`，Spanner 用 `STRING(MAX)`。`NULL` / 空字符串会变成空 map，而不是 nil。

更大的坑在 `Event.Output`，类型是 `any`。写入 `json.Marshal`，读回 `json.Unmarshal` 到 `any`，于是：

```
JSON object → map[string]any
JSON number → float64
JSON array  → []any
```

原来的 `Order{ID: "1", Total: 100}` 读回来会变成 `map[string]any{"ID": "1", "Total": float64(100)}`。跨库往返后，Workflow 节点通常要靠输入 Schema 和 `typeutil.ConvertToWithJSONSchema`，而不是裸的 Go 类型断言——这也是 `FunctionNode` 要 Schema 的原因。

JSON 还划了一条边界：channel、function、mutex、不可序列化对象、大二进制都不该进 Event / State。二进制走 Artifact Service，这里只存引用。

## 五、Create 和 Get

`Create` 在一个事务里：校验 AppName / UserID → 空 SessionID 则生成 UUID → 查或初始化 app/user state → 拆初始 State → 写三处 → 建 `sessions` 行。事务是必要的，否则可能 `app_states` / `user_states` 写成功、`sessions` 失败。返回的是合并三层 State 后的 `localSession`。

`Get` 按三列主键读 Session，再查 events（`After` 过滤、`NumRecentEvents` 截断），读 app/user state，反序列化后合并。返回的同样是内存快照，不是数据库连接代理。

只取最近 N 条时，SQL 是 `ORDER BY timestamp DESC, id DESC LIMIT N`，内存里再反转成从旧到新。倒序是为了让数据库直接切最新 N 条，不必扫完全部历史再截。第二排序键 `id` 是因为微秒级 Timestamp 可能撞车——没有它，Prompt 历史、Compaction 覆盖、Workflow Resume、最近 Event 过滤在不同库上顺序会漂。同一时间戳下 ID 能保证稳定，但不一定等于原始追加顺序。

## 六、AppendEvent：真正的核心

一次 `AppendEvent` 大致是：忽略 Partial Event → 补 ID、Timestamp 截到微秒 → 先更新本地 `localSession` → 进事务重新读库中的 Session → stale 检查 → 拆 StateDelta → 更新三层 State → 插入 Event → 推 `sessions.update_time`。

Partial Event（流式 token）只给 UI，不进历史、不应用 StateDelta、不推更新时间。只有最终的非 partial Event 才落库。

事务把这几步绑在一起：

```
读 sessions / app_states / user_states
更新三层 State
插入 events
更新 sessions.update_time
```

一个 Event 同时改 `app:feature_flag`、`user:last_topic`、`stage` 时，三处写入要么全成要么全回滚。

### Stale Session

这是基于时间戳的乐观并发。请求 A、B 都拿到 `updatedAt = 10:00` 的快照；B 先追加，库变成 `10:05`；A 再追加时，事务内发现 `storageUpdateTime > sessionUpdateTime`，返回 stale session error，避免旧快照覆盖新状态。

两个细节：Event Timestamp 截到微秒；检查依赖调用者用的是从 Service 拿到的快照。长时间持有旧 Session、追加失败后，应重新 `Get` 再重试。多实例部署尤其要验证这条重试路径。

### 本地先写、事务后提交

`databaseService` 返回的是 `localSession`（自带 `events` / `state` / `updatedAt` 缓存）。当前实现是**先改本地，再跑数据库事务**。事务失败时，手里的 Session 可能已经比库多一条事件或状态——不能再当权威，必须重新 `Get`。`Events()` 返回切片快照，避免调用者遍历时长期持有锁。

## 七、Delete

`Delete` 删 `sessions` 行。外键级联启用时，对应 `events` 一起走。App / User State 是共享的，不随某个 Session 删除。

## 八、和 InMemory 的差异

| 行为 | InMemoryService | Database Service |
| --- | --- | --- |
| 存储 | Go map / 切片 | 四张表 + JSON 列 |
| 重启 | 丢失 | 保留 |
| AppendEvent | 内存锁 | GORM 事务 |
| 并发 | mutex | 事务 + stale timestamp |
| Event 查询 | 切片过滤 | SQL 排序 + Limit |
| 复杂字段 | Go 对象 | JSON 往返（类型会退化） |
| `temp:` | 运行时保留，存储时移除 | 运行时保留，库不保存 |

生产上还要额外看：连接池、事务隔离级别、查询索引、Event 表增长、定期 compaction、`Event.Output` / State 体积、多实例下的 stale 重试。

## 九、最关键的理解

`session/database` 做了四件事：

1. Session 元数据和当前 Session State 在 `sessions`。
2. Event 历史以行的形式在 `events`。
3. App / User 状态拆到独立表。
4. 单个事务同时提交 Event 和 StateDelta。

所以一次持久化不是「保存 Event」，而是：

```
Event 历史追加
+ State 增量应用
+ Session 更新时间推进
+ App/User 状态更新
```

多轮对话、Workflow Resume、HITL、状态共享、多实例部署，都建立在这条事务边界上。
