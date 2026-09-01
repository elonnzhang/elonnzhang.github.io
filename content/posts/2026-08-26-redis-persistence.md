---
title: Redis 持久化 - AOF & RDB
date: 2026-08-26
categories:
  - redis
draft: false
slug: page-url
---

Redis 基于内存运行，因此如果 Redis 服务器崩溃，数据将会丢失。为了防止数据丢失，Redis 提供了两种持久化机制：RDB 和 AOF。

## 先给结论

- **RDB 是定期快照**：文件小、加载快、适合备份和快速恢复，但两次快照之间的写入可能全部丢失。
- **AOF 是写命令日志**：通常能把故障时的丢失窗口压到约 1 秒，但文件会增长，需要 rewrite；磁盘写入、`fsync` 和恢复回放都要付出成本。
- **线上有状态数据通常同时开 RDB 和 AOF**：AOF 用于较小的 RPO，RDB 用于备份、迁移和快速装载。两者同时打开时，Redis 启动优先加载 AOF。
- **Redis 7 是文件布局分水岭**：AOF 从单文件变为 Multi-Part AOF（MP-AOF），由 base 文件、incremental 文件和 manifest 共同组成。备份时不能只拷贝一个 `appendonly.aof`。
- **持久化不是高可用**：副本、Sentinel、Cluster 能缩短故障切换时间，但不能替代跨故障域的持久化备份。

可以把目标拆成两个指标：

- **RPO（Recovery Point Objective）**：最多能接受丢多少数据。
- **RTO（Recovery Time Objective）**：希望多快恢复服务。

RDB 通常更偏向较短的 RTO，AOF 通常更偏向较小的 RPO。最终结果还受文件系统、磁盘控制器、云盘写入保障和备份流程影响，不能只看 Redis 配置名义上的策略。

## 1. Redis 为什么需要持久化

Redis 的工作集在内存中。进程重启、主机掉电或容器被销毁时，内存状态本身不会保留。持久化把内存状态转换为可在启动时重新装载的文件：

```text
客户端命令
    |
    v
内存中的数据集 ---------------> RDB 快照（某一时刻的完整状态）
    |
    +--------------------------> AOF（按顺序记录的写命令）
```

这里有三个容易混淆的边界：

1. `write(2)` 成功，只表示数据进入了内核或文件描述符的写入路径，不等于已经落到稳定介质。
2. `fsync()` 成功，表示操作系统已请求把数据刷到存储设备；设备本身是否有掉电保护仍是基础设施问题。
3. 复制确认只表示副本处理到了某个复制偏移量。副本如果没有自己的持久化，主机和副本同时丢失时仍然没有可用备份。

因此，配置持久化时应先写出故障模型：是进程崩溃、主机掉电、磁盘损坏，还是误删和勒索软件？单机 AOF 只能解决其中一部分问题。

## 2. AOF（Append-Only File）

`src/aof.c`

AOF 记录 Redis 处理过的写命令，使用 RESP 命令序列保存。Redis 重启时按文件顺序执行这些命令，重建内存数据集。它不是普通意义上的纯文本日志，不能假设任意文本编辑器修改后仍然有效。

一次写入大致经过以下阶段：

```text
执行写命令
    |
    v
AOF buffer -> write() 到增量文件 -> fsync（按策略）
                                      |
                                      +--> 进程重启时回放
```

AOF 的三种写入配置

- always, 同步写回, 每次命令执行后，都会落盘
- everysec, 每次命令执行后，先写AOF缓冲区，并每秒同步磁盘
- no, 只写AOF 缓冲区，操作系统决定落盘

`appendfsync` 三种策略

| 策略       | Redis 行为                       | 故障时的典型风险                              | 适用方向                 |
| ---------- | -------------------------------- | --------------------------------------------- | ------------------------ |
| `always`   | 每次写入后都同步刷盘             | 延迟和 IOPS 成本最高；仍受存储设备保障影响    | 极小 RPO、写入量可控     |
| `everysec` | 通常每秒后台刷盘一次             | 掉电时可能丢约 1 秒写入；慢盘会扩大实际窗口   | 大多数在线业务的折中方案 |
| `no`       | 不主动调用 `fsync`，交给操作系统 | 丢失窗口由内核和文件系统决定，可能远大于 1 秒 | 可重建缓存、追求吞吐     |

### 2.1 AOF Rewrite

随着时间推移，不断的接受命令，AOF 文件会持续增大，从而导致性能问题。
AOF 文件会累积冗余命令，例如无效或已过期的命令。AOF 重写机制会将这些命令合并为一条命令（类似批处理命令），以减小并压缩文件大小。
AOF 由后台子进程 BGREWRITEAOF 执行。

触发方式:

- 手动执行 `BGREWRITEAOF`
- 自动触发：主循环检查 AOF 当前大小相对于上次 Rewrite 后大小的增长比例

```c
    growth = (aof_current_size * 100 / base) - 100;
    if (growth >= aof_rewrite_perc &&
        aof_current_size > aof_rewrite_min_size)
    {
        rewriteAppendOnlyFileBackground();
    }
```

关配置通常是：

```conf
auto-aof-rewrite-percentage 100
auto-aof-rewrite-min-size 64mb
```

```text
当前 AOF 大小 > auto-aof-rewrite-min-size
并且
相对上次 rewrite 的增长百分比 >= auto-aof-rewrite-percentage
```

含义是：AOF 相比上次 Rewrite 后增长至少 100%，并且文件大于 64 MB 时自动 Rewrite。
如果当前已有 RDB、AOF Rewrite 或 Module 子进程运行，Rewrite 会被标记为 scheduled，等当前后台任务结束后再执行。

BGREWRITEAOF 返回 Background append only file rewriting started 表示任务提交到后台

判断 Rewrite 任务成功与否，要看

```sh
redis-cli INFO persistence \
  | grep -E 'aof_rewrite_in_progress|aof_last_bgrewrite_status|aof_current_size'
aof_rewrite_in_progress:0
aof_last_bgrewrite_status:ok
```

---

`REWRITEAOF` -> `rewriteAppendOnlyFile`

```c
/* Write a sequence of commands able to fully rebuild the dataset into
 * "filename". Used both by REWRITEAOF and BGREWRITEAOF.
 *
 * In order to minimize the number of commands needed in the rewritten
 * log Redis uses variadic commands when possible, such as RPUSH, SADD
 * and ZADD. However at max AOF_REWRITE_ITEMS_PER_CMD items per time
 * are inserted using a single command. */
```

`BGREWRITEAOF` -> `rewriteAppendOnlyFileBackground`

```c
/* ----------------------------------------------------------------------------
 * AOF background rewrite
 * ------------------------------------------------------------------------- */

/* This is how rewriting of the append only file in background works:
 *
 * 1) The user calls BGREWRITEAOF
 * 2) Redis calls this function, that forks():
 *    2a) the child rewrite the append only file in a temp file. temp-rewriteaof-bg-<pid>.aof
 *    2b) the parent open a new INCR AOF file to continue writing.
 * 3) When the child finished '2a' exists.
 * 4) The parent will trap the exit code, if it's OK, it will:
 *    4a) get a new BASE file name and mark the previous (if we have) as the HISTORY type
 *    4b) rename(2) the temp file in new BASE file name
 *    4c) mark the rewritten INCR AOFs as history type
 *    4d) persist AOF manifest file
 *    4e) Delete the history files use bio
 */
```

### 2.2 Redis AOF Rewrite 流程：临时文件、BASE 与 INCR

Redis 的 AOF Rewrite 不是把旧 AOF 文件逐条压缩，而是根据当前内存中的数据集重新生成一份等价的持久化内容。现代 Redis 使用 Multi-Part AOF，将文件分为 BASE、INCR 和 HISTORY 三类：

- **BASE**：上一次成功 Rewrite 时的数据快照。
- **INCR**：上一次成功 Rewrite 之后产生的增量写命令。
- **HISTORY**：已经被新的 BASE 替代、等待后台删除的旧文件。

#### Rewrite 的两个并行部分

执行 `BGREWRITEAOF` 时，Redis 同时进行两件事：

1. 子进程根据 Fork 时刻的内存状态生成新的 BASE。
2. 父进程创建新的 INCR AOF，继续记录 Rewrite 期间产生的写命令。

因此，Rewrite 期间的数据恢复顺序是：

```text
新的 BASE AOF
    +
Rewrite 期间的 INCR AOF
```

子进程不会直接修改旧 BASE；父进程也不会把 Rewrite 期间的新命令写进子进程正在生成的 BASE 文件。

#### 2a：子进程生成临时 BASE

后台 Rewrite 的子进程在 [`src/aof.c:2458`](../src/aof.c#L2458) 生成目标临时文件名：

```c
snprintf(tmpfile, 256, "temp-rewriteaof-bg-%d.aof", (int)getpid());
rewriteAppendOnlyFile(tmpfile);
```

源码随后明确把它称为 `temporary AOF base file`。所以：

```text
temp-rewriteaof-bg-<pid>.aof
```

的角色是“临时 BASE 文件”，不是 INCR 文件。

##### 实际写入还有一层临时文件

`rewriteAppendOnlyFile(filename)` 不会直接写入传入的 `filename`。它先在 [`src/aof.c:2364`](../src/aof.c#L2364) 创建另一层临时文件：

```c
snprintf(tmpfile, 256, "temp-rewriteaof-%d.aof", (int)getpid());
fp = fopen(tmpfile, "w");
```

写入完成后，Redis 执行 `fflush`、`fsync` 和 `fclose`，再通过 `rename` 原子改名：

```c
rename(tmpfile, filename);
```

所以子进程内部实际是两步：

```text
temp-rewriteaof-<pid>.aof
    -> temp-rewriteaof-bg-<pid>.aof
```

这两个名称都是临时名称，后缀 `.aof` 只是源码固定的临时命名，并不声明文件内部格式。

#### 临时文件的内容格式由配置决定

`rewriteAppendOnlyFile` 在 [`src/aof.c:2378`](../src/aof.c#L2378) 根据 `aof-use-rdb-preamble` 选择写入方式：

```c
if (server.aof_use_rdb_preamble) {
    rdbSaveRio(...);
} else {
    rewriteAppendOnlyFileRio(&aof);
}
```

这意味着：

- `aof-use-rdb-preamble yes`：临时 BASE 的内容使用 RDB 编码。
- `aof-use-rdb-preamble no`：临时 BASE 的内容使用 RESP 格式的 AOF 命令。

因此，一个名为 `temp-rewriteaof-bg-123.aof` 的文件，内部完全可能是 RDB 编码。临时文件名后缀不能用来判断格式。

#### 2b：父进程创建独立的 INCR AOF

父进程在 Fork 前调用 `openNewIncrAofForAppend()`（[`src/aof.c:2447`](../src/aof.c#L2447)），创建一个与子进程临时 BASE 完全独立的 INCR 文件。

这个文件记录的是：

```text
Fork 之后，Rewrite 期间父进程接收到的所有新写命令
```

例如 Fork 时数据是：

```text
key = A
```

Rewrite 期间客户端执行：

```text
SET key B
SET other C
```

那么最终会得到：

```text
BASE：SET key A
INCR：SET key B
      SET other C
```

加载 BASE 后再执行 INCR，最终状态就是 `key = B`、`other = C`。

所以，2a 和 2b 的文件不是同一个：

```text
2a temp-rewriteaof-bg-<pid>.aof  -> 临时 BASE
2b new INCR AOF                  -> Rewrite 期间的增量文件
```

#### Rewrite 成功后的正式文件名

Rewrite 成功后，父进程调用 `getNewBaseFileNameAndMarkPreAsHistory()`。该函数在 [`src/aof.c:435`](../src/aof.c#L435) 根据配置选择正式 BASE 文件的格式后缀：

```c
char *format_suffix = server.aof_use_rdb_preamble
    ? RDB_FORMAT_SUFFIX
    : AOF_FORMAT_SUFFIX;
```

正式 BASE 文件名规则是：

```text
server.aof_filename.seq.base.format
```

源码注释明确给出：

```text
appendonly.aof.1.base.aof  // aof-use-rdb-preamble no
appendonly.aof.1.base.rdb  // aof-use-rdb-preamble yes
```

随后在 [`src/aof.c:2600`](../src/aof.c#L2600) 执行：

```c
rename(tmpfile, new_base_filepath);
```

完整路径可以表示为：

```text
aof-use-rdb-preamble yes:

temp-rewriteaof-123.aof
  -> temp-rewriteaof-bg-123.aof
  -> appendonly.aof.N.base.rdb
```

```text
aof-use-rdb-preamble no:

temp-rewriteaof-123.aof
  -> temp-rewriteaof-bg-123.aof
  -> appendonly.aof.N.base.aof
```

#### 结论

`BASE` 是 AOF 架构中的文件角色；`.rdb` 或 `.aof` 是文件内容的编码格式。

因此，`temp-rewriteaof-bg-<pid>.aof` 并不意味着它一定是 RESP AOF。它只是 Rewrite 阶段固定命名的临时 BASE 文件，最终会根据 `aof-use-rdb-preamble` 被原子改名为 `.base.rdb` 或 `.base.aof`。

#### Rewrite 期间的新命令处理

在子进程遍历数据期间，父进程仍然接收并执行新命令。每个写命令会：
写入父进程的 AOF 缓冲区。
定期刷新到新的 INCR AOF 文件。
子进程完成后，这个 INCR 文件保存 Rewrite 期间发生的所有变化。

```c
feedAppendOnlyFile()
flushAppendOnlyFile()
```

## 3. Redis 7+ 的 Multi-Part AOF

Redis 7.0 的升级（MP-AOF）

Redis 7 将 AOF 从“一个不断增长的文件”改成一组由 manifest 描述的文件。

> 在 Redis 7.0 之前，重写时需要将新产生的写命令放入“重写缓冲区”，容易导致内存暴涨。
> 从 Redis 7.0 开始引入了 MP-AOF（Multi-Part AOF） 机制，将 AOF 拆分为三种文件：
>
> - Base 文件：存放重写后的全量基础数据（通常是 RDB 或纯 AOF 格式）。
> - Incr 文件：存放日常运行中产生的增量命令日志。
> - Manifest 文件：负责记录和管理上述文件的清单与加载顺序。
> - HISTORY 文件，After a successful rewrite, the previous BASE and INCR become HISTORY files. They will be automatically removed unless garbage collection is disabled.
>
> * The following is a possible AOF manifest file content:
> *
> * file appendonly.aof.2.base.rdb seq 2 type b
> * file appendonly.aof.1.incr.aof seq 1 type h
> * file appendonly.aof.2.incr.aof seq 2 type h
> * file appendonly.aof.3.incr.aof seq 3 type h
> * file appendonly.aof.4.incr.aof seq 4 type i
> * file appendonly.aof.5.incr.aof seq 5 type i
>
> 这样新命令直接写入新的 Incr 文件，彻底解决了老版本重写时的内存暴涨和磁盘双写问题。

![Redis7-AOF](/assets/img/redis7-aof.png)

### 3.1 base 可以是 RDB，也可以是 AOF

`aof-use-rdb-preamble yes`（Redis 5.0 及当前版本默认值）让 rewrite 生成 RDB 格式的 base。启动时 Redis 识别 `REDIS` 签名，先加载 base，再回放后续 RESP 增量。这样兼顾了 AOF 的恢复语义和 RDB 的加载效率。

只有为了兼容旧工具或旧解析器时，才考虑 `aof-use-rdb-preamble no`。关闭后，base 会变成命令形式，加载和文件体积通常更差；新数据结构还可能对旧解析器造成额外兼容问题。

### 3.2 manifest 是持久化数据的一部分

manifest 记录每个文件是 base、incremental 还是历史文件，以及应用顺序。复制或备份 MP-AOF 时，必须把 manifest 和它引用的所有文件视为一个集合：

- 不要只复制当前打开的 `.incr.aof`；
- 不要用文件名排序替代 manifest 顺序；
- 不要在 rewrite 正在切换文件时直接把目录当作静态快照；
- 恢复前先用目标版本的 `redis-check-aof` 检查 manifest。

Redis 7 仍兼容从旧版本升级来的单文件 AOF：启动时会把旧文件迁移到 AOF 目录并生成 manifest。但升级前仍应保留原始文件和可回滚副本。

### 3.3 时间戳标记与时间点恢复

Redis 7 增加 `aof-timestamp-enabled`，可在 AOF 中记录时间戳标记，用于按时间点截断和恢复。这个选项会改变 AOF 格式，可能让现有 AOF 解析器失效；启用前应确认所有检查、上传和恢复工具都理解新格式。

## 4. RDB

RDB 通过将内存中的数据以快照的形式保存到磁盘来实现。与记录每次操作的 AOF 不同，RDB 记录的是某一时刻的数据状态。

### 触发方式:

- SAVE # 手动触发，同步保存，会阻塞当前 Redis 服务器
- BGSAVE # 手动触发，异步保存，Redis 进程会派生一个子进程。
- SAVE m n #自动触发，如果数据集在 m 秒内被修改 n 次，则会自动触发
- 复制全量同步时，为副本生成 RDB 数据流；
- 关机时根据 `shutdown` 选项生成快照。

生产环境一般使用 `BGSAVE`。Redis `fork()` 出子进程，子进程遍历数据集并写临时文件，成功后再原子替换目标文件；父进程继续处理请求。父子进程共享未修改的内存页，写入发生时才触发 Copy-on-Write（CoW）。因此，RDB 的内存成本不是简单的“数据集再复制一份”，但写入越密集，CoW 峰值越可能接近数据集规模。

Redis 7 示例配置的默认快照规则是 `3600 1`、`300 100`、`60 10000`；写入 `save ""` 可以完全关闭基于规则的快照。这里的“默认”是配置文件口径，不代表云厂商托管实例或发行版一定使用相同值。

简化后的流程如下：

```text
BGSAVE
  |
  +--> fork()
        |
        +--> 子进程：遍历内存 -> 临时 RDB -> flush/fsync -> rename
        |
        +--> 父进程：继续服务请求，修改页时产生 CoW
```

当前源码的 `redis.conf` 默认启用 `rdbcompression yes`、`rdbchecksum yes`。RDB 格式 v5 及以后在文件尾部带 CRC64 校验；关闭校验可以节省一部分 CPU，但会降低发现文件损坏的能力。

### RDB 的优点

- **文件紧凑**：一次编码当前状态，不保留历史写入。
- **加载快**：顺序读取二进制结构，通常比回放很长的命令日志快。
- **适合离线备份**：可把一个完整文件上传到对象存储、复制到异地或用于迁移。
- **适合复制全量同步**：RDB 可以直接作为全量数据传输载荷，甚至可以使用 diskless replication。

### RDB 的代价和误区

- `save 900 1` 不是“每 900 秒精确保存一次”，而是满足条件后由后台任务保存。故障时的损失窗口取决于实际触发和完成时间。
- `SAVE` 会阻塞主线程，数据量大时不应在生产高峰执行。
- `BGSAVE` 和 AOF rewrite 都要 `fork()`，必须预留 CoW 内存和临时磁盘空间。
- 默认 `stop-writes-on-bgsave-error yes`。RDB 后台保存失败后，Redis 可能返回 `MISCONF` 并拒绝写入，直到保存恢复或管理员调整策略。关闭这个保护开关之前，应先确认监控能及时发现持久化失败。
- RDB 是某一时刻的快照，不是逐条写入的审计日志，也不能提供任意时间点回滚。

### COW

使用 BGSAVE 不会阻塞住进程，快照期间依然可以处理写请求，由于 Redis 使用了操作系统的写时复制(Copy-On-Write，COW)。

前提：fork 出子进程

执行 ⁠bgsave⁠ 时，Redis 主进程调用 ⁠fork()⁠ 生成一个子进程，由子进程负责把内存数据写进 ⁠dump.rdb⁠。

关键在于：⁠fork⁠ 之后，父子进程并不会真的复制一份完整的内存。**它们共享同一份物理内存页，操作系统只是复制了页表（page table），让两个进程的虚拟地址都指向相同的物理页**。

#### COW 的核心动作

操作系统在 fork 后把这些共享页统一标记为**只读**。此时：

- 子进程读：直接读共享页，看到的就是 fork 那一刻的数据快照。它只管读，所以整个快照期间看到的都是一致的、冻结的内存视图。

- 主进程有写操作进来：CPU 尝试写只读页 → 触发缺页/保护异常（page fault） → 内核介入，此时才真正复制这一个页（通常 4KB）：给主进程分配一份新的物理页、拷贝内容、解除只读、让主进程改新页；子进程仍指向旧页。

“写时”才”复制”——这就是名字的由来。没被改动的数据始终共享，只有被写的那些页才逐个分裂成两份。

#### 为什么这样设计

- 快照一致性：子进程看到的旧页不会被主进程修改污染，落盘的是 fork 瞬间的干净状态。

- 省内存 + 快：不用一开始就复制整块内存，只按需复制被改的页。多数快照期间只有一小部分数据在变，开销很小。

#### 代价

尽管 ⁠bgsave⁠ 不会阻塞主线程，但频繁执行完整快照仍会带来性能开销。例如，必须通过 ⁠fork⁠ 创建子进程，而创建子进程期间确实会阻塞主线程。

具体来说有两个隐藏成本：

1. fork 本身会短暂阻塞主线程——内存越大，复制页表越慢（大实例上可能是毫秒到几十毫秒级的卡顿）。

2. 写放大：如果快照期间写入非常频繁，大量页被触发复制，极端情况下内存占用会接近翻倍。所以生产上一般要预留足够内存，避免 OOM。

一句话概括：COW 让父子进程先共享内存、把页设为只读，谁写就单独给谁复制那一页，从而既保证快照一致，又避免一次性全量拷贝。

## 5. RDB 与 AOF 同时开启时会发生什么

在 Redis 7.0 的启动路径中，`loadDataFromDisk()` 在 `appendonly yes` 时先调用 `loadAppendOnlyFiles()`；只有 AOF 未启用时才走 `rdbLoad()`。因此：

- AOF 和 RDB 同时开启时，**启动优先加载 AOF**；
- RDB 仍然可以作为备份和复制载荷；
- 在当前 7.0.15 路径中，如果 AOF 目录或 manifest 不存在、且没有可升级的旧式单文件 AOF，`loadAppendOnlyFiles()` 返回 `AOF_NOT_EXIST` 后不会自动进入 `rdbLoad()`；随后启动流程会尝试为 AOF 创建一个空的 base 文件。因此，删除或移动 AOF 文件后重启，不能把 `dump.rdb` 当作自动回退方案，必须先在隔离目录验证并准备明确的恢复步骤。

这条规则也解释了为什么“两个文件都在磁盘上”不等于“两个文件可以互相替代”。它们可能代表不同的时间点，加载优先级决定最终状态。

### 5.1 一张表看懂 RDB 与 AOF

| 维度           | RDB                              | AOF                                                       |
| -------------- | -------------------------------- | --------------------------------------------------------- |
| 记录内容       | 某一时刻的完整数据集             | 按顺序记录的写命令（MP-AOF 还包含 base/incremental 关系） |
| 主要写入方式   | 周期性 `BGSAVE` 或手动快照       | 每次写入先进入 AOF buffer，再按 `appendfsync` 刷盘        |
| 故障丢失窗口   | 通常是最近一次成功快照之后的写入 | `always` 最小，`everysec` 通常约 1 秒，`no` 由 OS 决定    |
| 恢复速度       | 通常更快，顺序加载二进制         | 取决于 base 格式、增量文件数量和命令回放量                |
| 文件体积       | 通常更小                         | 追加会变大，需 rewrite；MP-AOF 需计算文件集合峰值         |
| 运行时成本     | `fork` + CoW + 快照 I/O          | 持续写入、fsync、rewrite + CoW                            |
| 适合场景       | 快速恢复、离线备份、全量复制     | 小 RPO、写入持久性、按顺序重建                            |
| 不能解决的问题 | 不能提供任意时刻回滚             | 不能替代异地备份和高可用                                  |

## 6. 多版本对比：从单文件 AOF 到 MP-AOF

下表的 RDB 格式号来自各版本源码中的 `src/rdb.h`（早期版本使用 `REDIS_RDB_VERSION` 宏）。格式号变化表示序列化结构发生了兼容性变化；通常是新版本可以读取部分旧格式，而旧版本不能读取新格式，不能把它当成双向兼容承诺。

| 版本                                                               | RDB 格式号 | AOF / RDB 相关变化                                                                | 升级与运维影响                                                    |
| ------------------------------------------------------------------ | ---------: | --------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| [2.8 / 3.0](https://github.com/redis/redis/blob/3.0.0/src/rdb.h)   |          6 | 经典 RDB + 单文件 AOF；AOF 已支持 `no`、`always`、`everysec`                      | 文件布局简单，但没有后来的 RDB base 优势                          |
| [3.2（2016）](https://github.com/redis/redis/blob/3.2.0/src/rdb.h) |          7 | 增加更多数据类型编码，仍是单文件 AOF                                              | 新 RDB 不应直接交给更老版本加载                                   |
| [4.0（2017）](https://github.com/redis/redis/blob/4.0.0/src/rdb.h) |          8 | AOF rewrite 引入 RDB preamble；4.0 配置默认关闭                                   | 旧 AOF 工具可能只理解纯 RESP，需要验证                            |
| [5.0（2018）](https://github.com/redis/redis/blob/5.0.0/src/rdb.h) |          9 | RDB 支持 Streams 等新结构；`aof-use-rdb-preamble` 默认开启                        | 单文件布局仍未改变；AOF 的 rewrite/base 加载更快                  |
| 6.0 / 6.2（2020-2021）                                             |          9 | 持久化语义基本稳定，持续修复 CoW、fsync、模块 AUX 和 RDB 加载问题                 | 可在同一文件布局下升级，但要关注补丁版本的持久化修复              |
| 7.0（2022）                                                        |         10 | 引入 MP-AOF、manifest、`appenddirname`；AOF 时间戳标记；RDB v10                   | AOF 由单文件变为目录集合；RDB v10 对旧版本不兼容                  |
| 7.2（2023）                                                        |         11 | 引入 `WAITAOF`，可等待本地和指定副本的 AOF 同步；RDB v11                          | 可把“写入成功”与持久化确认拆开；旧客户端需识别新命令              |
| 7.4（2024）                                                        |         12 | Hash 字段级过期改变 RDB 序列化；`WAITAOF` 可在脚本中使用                          | 不是 AOF 布局变化，但 RDB 跨版本回退要重新演练                    |
| 8.0（2025）                                                        |         12 | Redis Query、JSON、时间序列和概率结构并入发行版；AOF 增加复制偏移元数据以辅助恢复 | 持久化内容覆盖更多内置数据类型；升级前检查模块和 ACL              |
| 8.2（2025）                                                        |         12 | 核心 AOF 布局未变，重点是加载、内存和性能改进                                     | 重点验证恢复耗时、CoW 和模块数据，而非迁移文件名                  |
| 8.4（2025）                                                        |         12 | 增加 `aof-load-corrupt-tail-max-size`，可对小范围损坏尾部自动截断恢复             | 默认值为 0（关闭）；仍应先复制原文件并保留人工修复路径            |
| 8.6（2026）                                                        |         13 | Streams 的 IDMP 状态进入 RDB/AOF 序列化                                           | 新格式回退到旧版本前必须做完整恢复演练                            |
| 8.8（2026）                                                        |         14 | Streams XNACK、Array 等结构带来新的 RDB 编码                                      | 不能只根据主版本号判断文件可读性，应检查格式和数据类型            |
| 8.10（2026）                                                       |         15 | Compact Hash 等结构更新 RDB；新增基于 MP-AOF 的 `BACKUP` / `preload-file` 流程    | 可使用 Redis 原生的备份生命周期，但仍要把密封文件复制到独立故障域 |

几个结论值得单独强调：

1. **7.0 的升级重点是文件布局**。备份脚本、磁盘告警、容器卷挂载和恢复脚本都要从“文件”改成“文件集合”。
2. **7.2 的升级重点是确认语义**。`WAITAOF 1 1 1000` 的含义是等待本地 AOF 和至少一个副本达到当前连接之前的写入偏移，超时后返回实际达到的数量；它不是跨机房事务提交，也不能替代备份。
3. **8.4 之后要区分 truncated 和 corrupt tail**。`aof-load-truncated` 处理意外 EOF；`aof-load-corrupt-tail-max-size` 处理尾部格式损坏。两者都只针对尾部，文件中间损坏仍应停机检查。
4. **8.10 的 `BACKUP` 不是把活动文件随便复制一遍**。它围绕 MP-AOF 的 base、增量和 manifest 建立可密封的集合，上传前仍需检查 `BACKUP STATUS` 和文件校验。

## 7. 生产选型建议

| 业务类型                      | 建议                               | 说明                                                           |
| ----------------------------- | ---------------------------------- | -------------------------------------------------------------- |
| 可完全重建的缓存              | 关闭持久化，或只保留低频 RDB       | 省磁盘和写放大；把 Redis 当缓存而不是事实源                    |
| 普通在线状态、允许约 1 秒 RPO | AOF `everysec` + RDB               | AOF 负责较小丢失窗口，RDB 负责备份和快速装载                   |
| 对单次写入确认很敏感          | AOF `always`，必要时使用 `WAITAOF` | 先压测 fsync 延迟；确认存储设备有稳定介质保障                  |
| 大数据集、重启时间优先        | RDB + 低频 AOF 或外部数据库        | 评估 AOF 回放时间和 rewrite 峰值，不能只看吞吐                 |
| 需要审计或任意时间点恢复      | AOF 时间戳标记或外部日志系统 + RDB | Redis AOF 不是完整的合规审计系统，需单独设计保留和不可篡改策略 |

一个偏稳妥的 Redis 7+ 配置片段如下：

```conf
dir /var/lib/redis
dbfilename dump.rdb

# RDB：备份和较快恢复
save 900 1
save 300 10
save 60 10000
stop-writes-on-bgsave-error yes
rdbcompression yes
rdbchecksum yes
rdb-save-incremental-fsync yes

# AOF：把故障丢失窗口控制在目标范围内
appendonly yes
appendfilename "appendonly.aof"
appenddirname "appendonlydir"
appendfsync everysec
no-appendfsync-on-rewrite no
auto-aof-rewrite-percentage 100
auto-aof-rewrite-min-size 256mb
aof-use-rdb-preamble yes
aof-load-truncated yes
aof-rewrite-incremental-fsync yes
```

这不是通用最佳值。`rdb-save-incremental-fsync` 和 `aof-rewrite-incremental-fsync` 会把大文件写入分段刷盘，帮助降低单次 I/O 峰值，但不会改变 RPO。所有 `save` 阈值、rewrite 最小大小和 AOF 策略都应以数据集大小、写入速率、磁盘延迟、可接受 RPO/RTO 和恢复演练结果为准。

### 7.1 需要“落盘确认”时

Redis 7.2 及以后可以把写入和持久化确认分成两个阶段：

```text
SET order:1001 paid
WAITAOF 1 1 1000
```

`WAITAOF` 的三个参数依次是 `numlocal`、`numreplicas` 和超时（毫秒）。返回值是 `[已满足的本地数量, 已满足的副本数量]`。它只能在主节点使用；副本是否启用 AOF、网络是否可用、fsync 是否被慢盘拖延，都会影响结果。

## 8. 备份、迁移和故障排查

### 8.1 备份检查清单

1. **RDB**：等待 `BGSAVE` 完成且 `rdb_last_bgsave_status:ok`，再复制 `dump.rdb`。复制后用 `redis-check-rdb` 检查。
2. **Redis 7+ AOF**：把 `appendonlydir` 中 manifest 引用的 base 和所有 incremental 一起保存；不要只保存当前增量文件。
3. **Redis 8.10+**：可以用 `BACKUP START`、`BACKUP STATUS`、`BACKUP SEAL` 生成密封的 MP-AOF 集合，再由外部程序上传。
4. **跨版本迁移**：先在隔离实例用目标版本加载备份，确认 key 数、关键业务校验值、TTL、Streams 消费组和模块数据，再切换流量。
5. **空间预算**：同时计算数据集、旧持久化文件、rewrite 临时文件、CoW 内存和日志/监控占用。MP-AOF rewrite 期间用 `du` 检查整个目录，而不是只看一个文件大小。

### 8.2 把“写入失败”和“rewrite 失败”分开

| 现象                                                                  | 先看什么                                                                     | 正确判断                                                                                   |
| --------------------------------------------------------------------- | ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `MISCONF ... Errors writing to the AOF file: No space left on device` | `INFO persistence` 中的 `aof_last_write_status`，以及 Redis 日志和磁盘空间   | 这是普通 AOF append/write 失败，不等于 AOF rewrite 失败；先处理磁盘和写入错误              |
| `aof_last_bgrewrite_status:err`                                       | `aof_rewrite_in_progress`、`aof_rewrites_consecutive_failures`、rewrite 日志 | 这是后台 rewrite 失败；旧的有效 AOF 集合可能仍在，但需要立即修复空间、权限或 fork/CoW 问题 |
| `rdb_last_bgsave_status:err` 且写入被拒绝                             | `rdb_bgsave_in_progress`、`rdb_last_cow_size`、`stop-writes-on-bgsave-error` | RDB 后台保存失败；不要只把保护开关改成 `no` 来掩盖问题                                     |
| 启动提示 AOF 尾部 truncated                                           | `aof-load-truncated`、最后一个文件是否为增量文件                             | 只涉及意外 EOF 的尾部；先保留原文件，再决定自动截断或用检查工具修复                        |
| 启动提示 AOF 中间格式损坏                                             | `redis-check-aof` 输出和 manifest                                            | 尾部自动恢复选项帮不上忙；应从副本恢复或人工定位损坏点                                     |

常用观测命令：

```shell
redis-cli INFO persistence
redis-cli CONFIG GET appendonly appendfsync auto-aof-rewrite-percentage auto-aof-rewrite-min-size
df -h /var/lib/redis
du -ah /var/lib/redis/appendonlydir | sort -h | tail
```

Redis 7+ 检查 MP-AOF 时，传给 `redis-check-aof` 的对象通常是 manifest，而不是随便挑出的某个 `.aof` 文件；具体参数以目标版本的 `redis-check-aof --help` 为准。

### 8.3 恢复前的最低验证

- 用与备份兼容的 Redis 版本启动临时实例；
- 检查 `DBSIZE`、关键 key 的值和 TTL；
- 检查 Streams 的最后 ID、消费组和 pending entries；
- 若使用模块或 Redis 8 内置数据结构，确认对应组件已加载；
- 记录加载耗时和峰值内存，作为 RTO/RAM 预算；
- 恢复演练结束后销毁临时实例和包含敏感数据的临时文件。

## 9. 常见问题的短答案

### AOF 一定比 RDB 安全吗？

不一定。AOF 的默认 `everysec` 通常有更小的丢失窗口，但会受到 fsync 延迟、磁盘故障、rewrite 期间策略和备份流程影响。没有异地副本的单机 AOF 仍然是单点。

### 只开 AOF 可以吗？

可以，但通常不划算。没有 RDB 时，离线备份和快速迁移少了一个简单可靠的载体；AOF rewrite 失败、文件损坏或恢复回放过慢时也少了一条退路。

### RDB 和 AOF 会互相覆盖吗？

不会在运行中互相改写同一个文件，但启动加载顺序有明确优先级：AOF 开启时优先加载 AOF。两者代表的时间点不同，不能把它们当作无条件等价的副本。

### 复制能代替持久化吗？

不能。复制解决的是服务可用性和数据副本数量，持久化解决的是重启和介质恢复。主节点误删、应用 bug、同一机房掉电等事件可能同时影响多个副本。

## 10. 参考资料与源码入口

- [Redis persistence 官方文档](https://redis.io/docs/latest/operate/oss_and_stack/management/persistence/)
- [Redis 6.0 release notes](https://github.com/redis/redis/blob/6.0/00-RELEASENOTES)
- [Redis 6.2 release notes](https://github.com/redis/redis/blob/6.2/00-RELEASENOTES)
- [Redis 7.0 release notes](https://github.com/redis/redis/blob/7.0/00-RELEASENOTES)
- [Redis 7.2 release notes](https://github.com/redis/redis/blob/7.2/00-RELEASENOTES)
- [Redis 7.4 release notes](https://github.com/redis/redis/blob/7.4/00-RELEASENOTES)
- [Redis 8.0 release notes](https://github.com/redis/redis/blob/8.0/00-RELEASENOTES)
- [Redis 8.2 release notes](https://github.com/redis/redis/blob/8.2/00-RELEASENOTES)
- [Redis 8.4 release notes](https://github.com/redis/redis/blob/8.4/00-RELEASENOTES)
- [Redis 8.6 release notes](https://github.com/redis/redis/blob/8.6/00-RELEASENOTES)
- [Redis 8.8 release notes](https://github.com/redis/redis/blob/8.8/00-RELEASENOTES)
- [Redis 8.10 release notes](https://github.com/redis/redis/blob/8.10/00-RELEASENOTES)
- [WAITAOF command](https://redis.io/docs/latest/commands/waitaof/)
- [当前分支 `redis.conf`](../redis.conf)：RDB/AOF 默认值、fsync、rewrite 和尾部处理选项
- [当前分支 `src/aof.c`](../src/aof.c)：MP-AOF manifest、写入、加载和 rewrite 流程
- [当前分支 `src/rdb.c`](../src/rdb.c)：RDB 编解码、校验和加载流程
- [当前分支 `src/server.c`](../src/server.c)：启动时 AOF/RDB 加载选择和 `INFO persistence`
  \*\*
