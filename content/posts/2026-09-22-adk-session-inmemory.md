---
title: Agent Development Kit (ADK) . - Session InMemory
date: 2026-09-22
tags:
  - agent
  - ai
  - golang
draft: false
slug: adk-session-inmemory
description: session.InMemoryService 把四张表收成三块 map。没有 InMemoryDB，没有 JSON，也没有 stale 检查；Create/Get 返回拷贝，AppendEvent 同时改 live session 和 omap 里的 canonical record。
---
ADK-Go 源码阅读笔记 · Session InMemory

> 公开入口是 `session.InMemoryService()`，内部是未导出的 `inMemoryService`。它实现同一套 `session.Service`，把 Database 的四张表收成三块内存：有序 Session 表、App State、User State。

源码：`session/service.go`（`InMemoryService` 构造器）、`session/inmemory.go`（全部实现）、`internal/sessionutils/utils.go`（三层 State 拆合）。

## 一、定义

```go
func InMemoryService() Service {
    return &inMemoryService{
        appState:  make(map[string]stateMap),
        userState: make(map[string]map[string]stateMap),
    }
}

type inMemoryService struct {
    mu        sync.RWMutex
    sessions  omap.Map[string, *session]     // 零值可用，构造器不初始化
    userState map[string]map[string]stateMap // appName → userID → state
    appState  map[string]stateMap            // appName → state
}

type stateMap map[string]any
```

`sessions` 的 key 不是裸 `SessionID`。三元组 `(AppName, UserID, SessionID)` 经 `rsc.io/ordered` 编码成可排序字符串，`List` 才能对 `omap` 做范围扫描：

```go
func (id id) Encode() string {
    return string(ordered.Encode(id.appName, id.userID, id.sessionID))
}
```

```go
func (s *inMemoryService) List(ctx context.Context, req *ListRequest) (*ListResponse, error)
    // ....
    if userID == "" {
        hi = id{appName: appName + "\x00"}.Encode()
    } else {
        hi = id{appName: appName, userID: userID + "\x00"}.Encode()
    }
```

`userID == ""` 时上界是 `appName+"\x00"`，列出该 App 下所有用户；否则只扫该用户。`Delete` 只从 `omap` 删 Session，不碰 `appState` / `userState`，缺失也是 no-op，不返回 `ErrNotFound`。

调用者拿到的 `Session` 是未导出的 `session`，不是存储里那份：

```go
type session struct {
    id        id
    mu        sync.RWMutex // 只护 events / state / updatedAt
    events    []*Event
    state     map[string]any
    updatedAt time.Time
}
```

`Create` / `Get` / `List` 都先 `copySessionWithoutStateAndEvents`（只拷 `id` 和 `updatedAt`），再单独填 state / events。`AppendEvent` 用类型断言要求 `curSession` 必须是这个实现自己的 `*session`，把 Database 的 `*localSession` 传进来会直接失败。

## 二、Create / Get / List

`Create` 要求 `AppName`、`UserID`；空 `SessionID` 走 `platform.NewUUID(ctx)`。已存在则报错。`req.State == nil` 时换成空 map。随后：

1. 把新 `*session` 放进 `omap`（`updatedAt = platform.Now(ctx)`）
2. `ExtractStateDeltas(req.State)` 拆出 app / user（`temp:` 丢掉）
3. `updateAppState` / `updateUserState` 写进服务级 map
4. `val.state = MergeStates(app, user, state)` —— 换成一份新的合并 map
5. 返回的拷贝：`maps.Clone(val.state)`，`slices.Clone(val.events)`

所以 Create 返回值不共享存储里的 state map。`platform.Now` / `NewUUID` 都从 context 取，测试可以注入。

`Get` 找不到包 `ErrNotFound`。state 是 `mergeStates(stored.state, appName, userID)` 的新 map，会把**当前**的 app / user 覆盖上去。events 先按 `NumRecentEvents` 从尾部截，再假定已按时间排好，用 `sort.Search` 做 `After` 过滤。最后 `append` 到新切片——新的 slice header，**同一个 `*Event` 指针**。Database 的 `Get` 会反序列化出新对象；这里没有 JSON，指针就是 canonical record。

`List` 同样 merge state，但**不拷 events**。返回的 Session 事件列表是空的。

## 三、AppendEvent：live 一份，canonical 一份

Partial（`event.Partial`，来自内嵌的 `model.LLMResponse`）直接 `return nil`，不写任何一边。空 `ID` 就地写到调用者的 Event 上（conformance 要求；VertexAI 是服务端赋 ID，这条对它豁免）。

然后是两条独立的写入。源码注释写明：canonical record **不是** live 那条的镜像。

```
调用者手里的 live *session              omap 里的 stored *session
sess.appendEvent(event)                 另组一个 eventCopy 再 append
  updateSessionState                    ExtractStateDeltas(完整 StateDelta)
    maps.Copy(state, 完整 StateDelta)     app → s.appState
    （含 temp: / app: / user:）           user → s.userState
  events 追加 trimTemp 后的 Event         session → maps.Copy(stored.state)
  updatedAt = event.Timestamp             events 追加 eventCopy
                                          updatedAt = event.Timestamp
```

`trimTempDeltaState` 只在确实有 `temp:` 键时才拷贝 Event，不改调用者原来的 `StateDelta`。没有临时键时它返回原指针，所以 **live.events 可能和调用者的 Event 是同一个对象**。

`eventCopy` 的拷贝边界是不对称的，不要说「深拷贝整条 Event」：

| 字段 | stored 侧 |
| --- | --- |
| `Actions.StateDelta` | `maps.Clone(trim 之后的)`，无 `temp:` |
| `Actions.ArtifactDelta` | `maps.Clone` |
| `Actions.RequestedToolConfirmations` | `maps.Clone` |
| `Actions.Compaction` | `Compaction.clone()`（含 `ExcludedEvents`、`CompactedContent.Parts`） |
| `LongRunningToolIDs` / `Routes` | `slices.Clone` |
| `RequestedInput` / `NodeInfo` / `Output` | 原指针 |
| `LLMResponse` | 结构体值拷贝，内部的 `Content` 等仍是原指针 |

这就是为什么有专门的测试：改调用者手里的 `Compaction` 不能污染 `Get()` 回来的记录；`NodeInfo` / `RequestedInput` / `Routes` / `IsolationScope` 必须能往返，否则 HITL Resume 会断。

没有 stale timestamp 检查。`service.mu` 把 `AppendEvent` 串行化，两个旧快照都会成功，后写覆盖 State，两条 Event 都进历史。这是内存实现能这么简单的前提，也是多实例不能用它的原因。

`appendEvent` 先改 live，再写 stored。如果后面的 stored 更新理论上失败（当前实现几乎没有这条路径），live 已经超前——和 Database「先改 `localSession` 再跑事务」是同一类问题。Session 找不到时返回 `ErrNotFound`，发生在改 live 之前。

## 四、三层 State 在内存里怎么拆

和 Database 共用 `internal/sessionutils`：

```
app:key   → appState[appName][key]
user:key  → userState[appName][userID][key]
temp:key  → ExtractStateDeltas 直接丢
普通 key   → session.state
```

读的时候 `MergeStates` 把 `app:` / `user:` 前缀加回去。`temp:` 有两条独立路径：

- 当前这次执行：`updateSessionState` 把完整 `StateDelta`（含 `temp:`）拷进 **live** `session.state`，所以 `sess.State().Get("temp:k1")` 能读到
- 事件历史 / 下次 `Get`：live.events 和 stored.events 都剥掉 `temp:`；stored.state 只吃 `sessionDelta`，merge 后的快照里也没有

直接 `sess.State().Set(...)` 只改这份拷贝的 map，不进 `appState` / `userState`，也不生成 Event。要让服务级状态变化，仍然得走 `ctx.State()` → `StateDelta` → `AppendEvent`。

`state.All()` 在锁内 `maps.Clone` 再迭代，是点时刻快照，不是 live view。`session.Events()` **不** clone 切片（Database 的 `localSession.Events()` 会 `slices.Clone`），只在 `RLock` 下返回 slice header。

## 五、和 Database 的对照

| | `inMemoryService` | `databaseService` |
| --- | --- | --- |
| 结构 | `omap` + 两块 state map | `sessions` / `events` / `app_states` / `user_states` |
| 调用者对象 | 未导出 `*session` | 未导出 `*localSession` |
| 锁 | 一把 `service.mu` | GORM 事务 |
| 并发 | 后写赢 | stale `update_time` 拒绝旧快照 |
| Event 往返 | 指针（部分字段 clone） | JSON；`any` 会退化成 `map` / `float64` |
| `Get` 的 Event | 与 stored **共享** `*Event` | 反序列化出新对象 |
| `Events()` | 不 clone 切片 | `slices.Clone` |
| Timestamp | 原样 | 截到微秒 |
| 重启 | 丢 | 留 |

核心可以记成：InMemory 把 Database 的四张表收成三块 map，把事务收成一把锁。`AppendEvent` 仍然是「历史追加 + 三层 StateDelta」，只是没有乐观并发，也没有类型退化；代价是 live 和 canonical 必须分开写，而且 clone 只覆盖会被调用者事后改掉的那几个字段。
