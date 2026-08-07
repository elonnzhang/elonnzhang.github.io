"use client";

import { useMemo, useState } from "react";

type ReleaseStatus = "released" | "preview";

type VersionNote = {
  version: string;
  date: string;
  status: ReleaseStatus;
  kicker: string;
  title: string;
  summary: string;
  tags: string[];
  features: { name: string; kind: string; detail: string }[];
  before: string;
  after: string;
  runCode: string;
  runOutput: string;
  metric: string;
  metricLabel: string;
  visual: { label: string; value: number; note: string }[];
  doc: { context: string; use: string; migrate: string };
  source: string;
};

const versions: VersionNote[] = [
  {
    version: "1.16",
    date: "2021.02.16",
    status: "released",
    kicker: "资源进入二进制",
    title: "把静态文件带进程序里",
    summary: "Go modules 成为默认路径，embed 与 io/fs 把“构建时的文件”变成了程序运行时的一部分。",
    tags: ["//go:embed", "io/fs", "go install @version"],
    features: [
      { name: "embed", kind: "语言 / 标准库", detail: "用 //go:embed 将文件、目录直接编译进二进制。" },
      { name: "io/fs", kind: "标准库", detail: "统一只读文件系统抽象，降低文件来源的耦合。" },
      { name: "Modules 默认", kind: "工具链", detail: "GO111MODULE=on，go install 与 go get 的职责开始分离。" },
    ],
    before: "// 运行时必须找到 ./web/index.html\nfile, _ := os.ReadFile(\"web/index.html\")",
    after: "// 构建时打包，运行时无需外置文件\n//go:embed web/index.html\nvar page []byte",
    runCode: "package main\n\nimport (\n\t\"embed\"\n\t\"fmt\"\n)\n\n//go:embed version.txt\nvar versionFile embed.FS\n\nfunc main() {\n\tb, _ := versionFile.ReadFile(\"version.txt\")\n\tfmt.Printf(\"embedded: %s\", b)\n}",
    runOutput: "embedded: go1.16\nfilesystem: in-binary",
    metric: "01",
    metricLabel: "第一次把构建资产变成语言级能力",
    visual: [
      { label: "部署独立性", value: 96, note: "无需拷贝模板文件" },
      { label: "运行时耦合", value: 18, note: "只读 fs 接口" },
      { label: "工具链摩擦", value: 28, note: "Modules 默认" },
    ],
    doc: {
      context: "适合 CLI、静态站点、迁移脚本和需要单文件分发的服务。",
      use: "把版本文件、模板、迁移 SQL 放在源码树内，用 embed.FS 传给需要 fs.FS 的 API。",
      migrate: "先把相对路径读取替换成 //go:embed，再为嵌入文件增加测试，避免部署包漏资源。",
    },
    source: "https://go.dev/doc/go1.16",
  },
  {
    version: "1.17",
    date: "2021.08.16",
    status: "released",
    kicker: "内存边界更明确",
    title: "切片可以变成数组指针",
    summary: "寄存器调用约定、模块图裁剪和新的构建约束语法一起落地，编译器与代码组织开始同时提速。",
    tags: ["(*[N]T)(slice)", "unsafe.Slice", "//go:build"],
    features: [
      { name: "数组指针转换", kind: "语言", detail: "显式把切片转换成数组指针，边界由运行时检查。" },
      { name: "寄存器 ABI", kind: "运行时", detail: "x86-64 等架构减少调用开销，常见服务获得约 5% 提升。" },
      { name: "Module pruning", kind: "工具链", detail: "大型模块只加载需要的依赖图，go list 更轻。" },
    ],
    before: "// 手动复制，容易把长度写错\nvar head [4]byte\ncopy(head[:], payload)",
    after: "// 视图转换，保留零拷贝语义\nhead := (*[4]byte)(payload)",
    runCode: "package main\n\nimport \"fmt\"\n\nfunc head4(b []byte) *[4]byte {\n\treturn (*[4]byte)(b)\n}\n\nfunc main() {\n\tdata := []byte(\"gopher\")\n\tfmt.Println(string(head4(data)[:]))\n}",
    runOutput: "goph\nzero-copy view: 4 bytes",
    metric: "05%",
    metricLabel: "寄存器 ABI 的典型 CPU 改善",
    visual: [
      { label: "调用开销", value: 32, note: "寄存器传参" },
      { label: "依赖解析", value: 44, note: "模块图裁剪" },
      { label: "指针表达力", value: 78, note: "unsafe.Slice" },
    ],
    doc: {
      context: "适合底层库、协议解析和大型多模块仓库。",
      use: "只在切片长度已被可靠校验时做数组指针转换；跨边界 API 优先保留清晰的切片类型。",
      migrate: "把旧 // +build 与新 //go:build 并存一段时间，运行 gofmt 让两种语法保持同步。",
    },
    source: "https://go.dev/doc/go1.17",
  },
  {
    version: "1.18",
    date: "2022.03.15",
    status: "released",
    kicker: "抽象终于可复用",
    title: "泛型、模糊测试与多模块工作区",
    summary: "Go 进入参数化编程时代：类型参数解决复用，fuzzing 进入 go test，go.work 让多模块协作有了正式入口。",
    tags: ["Generics", "Fuzzing", "go.work"],
    features: [
      { name: "类型参数", kind: "语言", detail: "any、comparable 与自定义约束让容器和算法拥有静态类型。" },
      { name: "Fuzzing", kind: "工具链", detail: "testing.F 将随机输入探索纳入 go test 工作流。" },
      { name: "Workspaces", kind: "工具链", detail: "go.work 把多个本地 module 组合成一个开发单元。" },
    ],
    before: "// 为每种数字类型复制一份函数\nfunc SumInt(xs []int) int { ... }\nfunc SumFloat(xs []float64) float64 { ... }",
    after: "// 一份实现，约束表达意图\nfunc Sum[T int | float64](xs []T) T { ... }",
    runCode: "package main\n\nimport \"fmt\"\n\nfunc Max[T int | float64](xs ...T) T {\n\tbest := xs[0]\n\tfor _, x := range xs[1:] {\n\t\tif x > best { best = x }\n\t}\n\treturn best\n}\n\nfunc main() { fmt.Println(Max(8, 13, 5)) }",
    runOutput: "13\nT inferred as int",
    metric: "3×",
    metricLabel: "同一算法覆盖多种具体类型",
    visual: [
      { label: "复用密度", value: 92, note: "类型参数" },
      { label: "测试入口", value: 84, note: "go test -fuzz" },
      { label: "仓库协作", value: 74, note: "go.work" },
    ],
    doc: {
      context: "这是 Go 语言最重要的一次表达力升级，适合容器、算法和通用基础设施。",
      use: "先写清约束，再让类型推导工作；对只有一个调用方的函数，不要为了泛型而泛型。",
      migrate: "从重复实现中找真正稳定的共性，优先将内部库泛型化，再评估公共 API 的兼容成本。",
    },
    source: "https://go.dev/doc/go1.18",
  },
  {
    version: "1.19",
    date: "2022.08.02",
    status: "released",
    kicker: "运行时开始听懂容器",
    title: "给 GC 一条可执行的预算",
    summary: "GOMEMLIMIT 把内存目标带进运行时，atomic.Int64 等类型安全原子类型则把并发状态写得更清楚。",
    tags: ["GOMEMLIMIT", "atomic.Int64", "Memory model"],
    features: [
      { name: "软内存上限", kind: "运行时", detail: "通过 GOMEMLIMIT 或 debug.SetMemoryLimit 给 GC 一个预算。" },
      { name: "类型安全原子", kind: "标准库", detail: "sync/atomic 提供 atomic.Int64、atomic.Pointer[T] 等类型。" },
      { name: "内存模型更新", kind: "语言规范", detail: "同步保证与现代语言内存模型表述保持一致。" },
    ],
    before: "// 只能靠容器 OOM 后重启\nfor { work() }",
    after: "// 把预算交给运行时\ndebug.SetMemoryLimit(512 << 20)",
    runCode: "package main\n\nimport (\n\t\"fmt\"\n\t\"runtime/debug\"\n)\n\nfunc main() {\n\told := debug.SetMemoryLimit(512 << 20)\n\tfmt.Printf(\"memory limit: 512 MiB (was %d)\", old)\n}",
    runOutput: "memory limit: 512 MiB (was -1)\nGC budget: explicit",
    metric: "512",
    metricLabel: "MiB 的软内存目标",
    visual: [
      { label: "峰值可控", value: 88, note: "GC 预算" },
      { label: "并发可读性", value: 86, note: "atomic types" },
      { label: "容器适配", value: 91, note: "服务部署" },
    ],
    doc: {
      context: "适合 Kubernetes 服务、缓存密集型进程和高并发计数器。",
      use: "将预算设在容器限制之下，结合 runtime/metrics 观察 GC 与堆的变化。",
      migrate: "逐步替换裸的 atomic.LoadInt64 / StoreInt64，避免同一字段混用普通访问和原子访问。",
    },
    source: "https://go.dev/doc/go1.19",
  },
  {
    version: "1.20",
    date: "2023.02.01",
    status: "released",
    kicker: "错误与性能都有组合键",
    title: "多个失败，也能保持上下文",
    summary: "errors.Join、切片到数组的值转换、crypto/ecdh 与 PGO 预览，让“工程里的边角”变成稳定 API。",
    tags: ["errors.Join", "crypto/ecdh", "PGO preview"],
    features: [
      { name: "错误组合", kind: "标准库", detail: "errors.Join 保留多个错误，errors.Is / As 仍可检查。" },
      { name: "切片转数组", kind: "语言", detail: "[N]T(s) 生成数组值，适合固定长度协议字段。" },
      { name: "PGO 预览", kind: "工具链", detail: "基于 pprof 画像优化真实热点，后续在 1.21 稳定。" },
    ],
    before: "// 丢掉后续错误\nreturn fmt.Errorf(\"save: %w\", err)",
    after: "// 调用方仍可逐个 errors.Is\nreturn errors.Join(err, cleanupErr)",
    runCode: "package main\n\nimport (\n\t\"errors\"\n\t\"fmt\"\n)\n\nfunc main() {\n\terr := errors.Join(\n\t\terrors.New(\"cache miss\"),\n\t\terrors.New(\"retry exhausted\"),\n\t)\n\tfmt.Println(err)\n}",
    runOutput: "cache miss\nretry exhausted\njoined: 2 causes",
    metric: "2→1",
    metricLabel: "多个错误仍保留在一个返回值里",
    visual: [
      { label: "错误上下文", value: 93, note: "Join / Is / As" },
      { label: "密码学选项", value: 76, note: "crypto/ecdh" },
      { label: "热点优化", value: 61, note: "PGO preview" },
    ],
    doc: {
      context: "适合批处理、清理流程和需要同时报告主错误与收尾错误的服务。",
      use: "只在错误确实并列时 Join；层层包装单个错误时仍用 %w 保持阅读路径。",
      migrate: "先为 errors.Is / As 写断言，再替换原有的“记录一个、吞掉一个”逻辑。",
    },
    source: "https://go.dev/doc/go1.20",
  },
  {
    version: "1.21",
    date: "2023.08.08",
    status: "released",
    kicker: "小工具变成语言肌肉",
    title: "min、max、clear，终于内置",
    summary: "PGO 正式可用，slices / maps / cmp 与结构化日志进入标准库，日常代码少一层自制工具。",
    tags: ["min / max / clear", "slices", "log/slog"],
    features: [
      { name: "内置函数", kind: "语言", detail: "min、max、clear 让常见边界操作直接表达。" },
      { name: "集合工具", kind: "标准库", detail: "slices、maps、cmp 统一常见泛型算法。" },
      { name: "结构化日志", kind: "标准库", detail: "log/slog 让字段化日志拥有标准接口。" },
    ],
    before: "// 过去需要自己写\nif x < lo { x = lo }\nfor k := range cache { delete(cache, k) }",
    after: "// 直接读出意图\nx = min(max(x, lo), hi)\nclear(cache)",
    runCode: "package main\n\nimport \"fmt\"\n\nfunc main() {\n\tlatency := 240\n\tclamped := min(max(latency, 50), 200)\n\tlabels := map[string]string{\"service\": \"api\"}\n\tclear(labels)\n\tfmt.Println(clamped, len(labels))\n}",
    runOutput: "200 0\nclamped + cleared",
    metric: "3",
    metricLabel: "个高频内置动作一次进入语言",
    visual: [
      { label: "表达直接度", value: 94, note: "min / max / clear" },
      { label: "标准化", value: 90, note: "slices / maps" },
      { label: "可观测性", value: 79, note: "log/slog" },
    ],
    doc: {
      context: "适合做一次小而稳的代码现代化，收益通常来自可读性而非炫技。",
      use: "先从边界夹取、清空 map、集合排序等重复样板替换，再引入 slog 的 Handler。",
      migrate: "不要把所有日志一次性改成结构化；先建立字段命名约定和采集端解析规则。",
    },
    source: "https://go.dev/doc/go1.21",
  },
  {
    version: "1.22",
    date: "2024.02.06",
    status: "released",
    kicker: "循环终于按人类直觉工作",
    title: "每次迭代，都有自己的变量",
    summary: "for 循环变量语义修复，整数可直接 range，ServeMux 也终于能用方法与路径模式描述路由。",
    tags: ["loop variables", "range 10", "ServeMux patterns"],
    features: [
      { name: "循环变量", kind: "语言", detail: "go.mod 使用 1.22 语言版本时，每轮迭代拥有独立变量。" },
      { name: "整数 range", kind: "语言", detail: "for i := range 10 直接得到 0 到 9。" },
      { name: "路由模式", kind: "标准库", detail: "net/http ServeMux 支持 GET /items/{id}。" },
    ],
    before: "// 旧语义：闭包共享同一变量\nfor _, v := range values { go use(v) }",
    after: "// 1.22：每轮迭代独立\nfor _, v := range values { go use(v) }",
    runCode: "package main\n\nimport \"fmt\"\n\nfunc main() {\n\tfor i := range 5 {\n\t\tfmt.Printf(\"%d \", i)\n\t}\n\tfmt.Println(\"\\nloop vars: per-iteration\")\n}",
    runOutput: "0 1 2 3 4\nloop vars: per-iteration",
    metric: "0",
    metricLabel: "闭包捕获循环变量的额外修复成本",
    visual: [
      { label: "闭包安全", value: 97, note: "每轮新变量" },
      { label: "循环表达力", value: 83, note: "range 整数" },
      { label: "路由可读性", value: 88, note: "ServeMux" },
    ],
    doc: {
      context: "这是一次行为语义升级：旧代码通常无需改，但 go.mod 的语言版本会决定循环语义。",
      use: "升级语言版本前，为并发循环和闭包补一组行为测试，尤其关注地址和 goroutine 捕获。",
      migrate: "把 go.mod 的 go 1.22 视为行为开关，按模块逐步升级，不要只替换本机 Go 二进制。",
    },
    source: "https://go.dev/doc/go1.22",
  },
  {
    version: "1.23",
    date: "2024.08.13",
    status: "released",
    kicker: "迭代器进入标准语法",
    title: "range 不再只认识容器",
    summary: "range-over-func 正式落地，iter、unique 与 timer 语义一起把“自定义遍历”推进了标准库。",
    tags: ["range-over-func", "iter.Seq", "unique.Handle"],
    features: [
      { name: "函数迭代器", kind: "语言", detail: "for range 可以消费 func(yield func(T) bool)。" },
      { name: "iter 包", kind: "标准库", detail: "iter.Seq / Seq2 为迭代器定义统一形状。" },
      { name: "Timer 回收", kind: "运行时", detail: "未引用的 Timer / Ticker 可以更早被 GC，通道语义也更可靠。" },
    ],
    before: "// 回调嵌套，提前停止不自然\nwalk(tree, func(node Node) bool { ... })",
    after: "// 像遍历 slice 一样遍历自定义数据\nfor node := range Walk(tree) { ... }",
    runCode: "package main\n\nimport \"fmt\"\n\nfunc Count(n int) func(func(int) bool) {\n\treturn func(yield func(int) bool) {\n\t\tfor i := 0; i < n && yield(i); i++ {}\n\t}\n}\n\nfunc main() {\n\tfor i := range Count(4) { fmt.Printf(\"%d \", i) }\n}",
    runOutput: "0 1 2 3\niterator: stopped cleanly",
    metric: "1",
    metricLabel: "一种迭代器形状覆盖多种数据源",
    visual: [
      { label: "遍历组合力", value: 95, note: "range-over-func" },
      { label: "停止语义", value: 88, note: "yield bool" },
      { label: "资源回收", value: 85, note: "timer changes" },
    ],
    doc: {
      context: "适合树、分页 API、数据库游标和懒计算管道。",
      use: "让迭代器只负责产生值；过滤、截断、映射可以组合成独立函数。",
      migrate: "不要把所有回调 API 机械改成 iterator，先从需要提前停止或组合遍历的路径开始。",
    },
    source: "https://go.dev/doc/go1.23",
  },
  {
    version: "1.24",
    date: "2025.02.11",
    status: "released",
    kicker: "类型别名补上最后一块",
    title: "泛型类型也能安全换名",
    summary: "泛型类型别名全面支持，Swiss Tables 重写 map，testing/synctest 让并发测试可以在虚拟时间里运行。",
    tags: ["generic aliases", "Swiss Tables", "synctest"],
    features: [
      { name: "泛型类型别名", kind: "语言", detail: "type Set[T comparable] = map[T]struct{}。" },
      { name: "Swiss Tables", kind: "运行时", detail: "map 的内部实现切换，改善查找与插入的空间效率。" },
      { name: "synctest 实验", kind: "标准库", detail: "隔离并发测试中的时间与 goroutine，减少 flaky test。" },
    ],
    before: "type IDSet = map[string]struct{}\ntype IntSet = map[int]struct{}",
    after: "type Set[T comparable] = map[T]struct{}\nvar ids Set[string]",
    runCode: "package main\n\nimport \"fmt\"\n\n// Go 1.24：泛型类型别名\ntype Set[T comparable] = map[T]struct{}\n\nfunc main() {\n\tusers := Set[string]{\"ada\": {}}\n\tfmt.Println(len(users), users[\"ada\"] == struct{}{})\n}",
    runOutput: "1 true\nalias: same underlying type",
    metric: "∞",
    metricLabel: "别名不会制造新的运行时类型",
    visual: [
      { label: "API 兼容性", value: 93, note: "alias" },
      { label: "Map 局部性", value: 87, note: "Swiss Tables" },
      { label: "测试确定性", value: 82, note: "synctest" },
    ],
    doc: {
      context: "适合库作者做类型迁移，也适合为 map、slice 等底层类型保留可读名字。",
      use: "用别名保持旧 API 的身份不变；需要新方法集时，才定义真正的新类型。",
      migrate: "泛型别名默认要求 Go 1.24 语言版本，升级前检查下游模块的 go 指令。",
    },
    source: "https://go.dev/doc/go1.24",
  },
  {
    version: "1.25",
    date: "2025.08.12",
    status: "released",
    kicker: "运行时学会看 cgroup",
    title: "容器里的并发更像容器",
    summary: "GOMAXPROCS 默认值开始感知 Linux 容器限制，DWARF 5、synctest GA 与 json/v2 实验继续打磨工具链。",
    tags: ["container-aware GOMAXPROCS", "DWARF 5", "json/v2"],
    features: [
      { name: "容器感知", kind: "运行时", detail: "默认 GOMAXPROCS 会参考 CPU quota，并定期更新。" },
      { name: "DWARF 5", kind: "编译器", detail: "更紧凑的调试信息，减少二进制体积与链接成本。" },
      { name: "synctest GA", kind: "标准库", detail: "隔离并发测试从实验能力进入稳定工具箱。" },
    ],
    before: "// 容器内仍按宿主机 CPU 估算\nruntime.GOMAXPROCS(runtime.NumCPU())",
    after: "// 默认行为自动尊重 cgroup quota\n// 只在确有需要时手动覆盖",
    runCode: "package main\n\nimport (\n\t\"fmt\"\n\t\"runtime\"\n)\n\nfunc main() {\n\tfmt.Printf(\"GOMAXPROCS=%d\\n\", runtime.GOMAXPROCS(0))\n\tfmt.Println(\"container quota: observed by default\")\n}",
    runOutput: "GOMAXPROCS=4\ncontainer quota: observed by default",
    metric: "4",
    metricLabel: "容器 quota 下的默认并发度示例",
    visual: [
      { label: "容器适配", value: 96, note: "cgroup quota" },
      { label: "调试体积", value: 81, note: "DWARF 5" },
      { label: "并发测试", value: 90, note: "synctest GA" },
    ],
    doc: {
      context: "这是偏运行时与工具链的版本，应用代码可能零改动，但部署行为会更贴近实际资源。",
      use: "优先删除手写的 GOMAXPROCS 初始化，让 Go 1.25 使用默认容器感知行为。",
      migrate: "为需要固定并发的批处理任务显式设置 GOMAXPROCS，并记录这个决定，而不是依赖宿主机核数。",
    },
    source: "https://go.dev/doc/go1.25",
  },
  {
    version: "1.26",
    date: "2026.02.10",
    status: "released",
    kicker: "表达式可以直接成为指针",
    title: "new，不只会造零值",
    summary: "new(expr) 让可选字段初始化更紧凑，crypto/hpke 与实验性 SIMD 则把安全和硬件能力继续往标准库推进。",
    tags: ["new(expr)", "errors.AsType", "crypto/hpke"],
    features: [
      { name: "new(expr)", kind: "语言", detail: "new(yearsSince(born)) 直接创建带初始值的指针。" },
      { name: "errors.AsType", kind: "标准库", detail: "泛型版本的 errors.As，类型更安全、调用更短。" },
      { name: "crypto/hpke", kind: "标准库", detail: "按 RFC 9180 提供混合公钥加密，支持后量子混合 KEM。" },
    ],
    before: "age := yearsSince(born)\nprofile.Age = &age",
    after: "profile.Age = new(yearsSince(born))",
    runCode: "package main\n\nimport \"fmt\"\n\nfunc yearsSince(born int) int { return 2026 - born }\n\nfunc main() {\n\tage := new(yearsSince(1996))\n\tfmt.Printf(\"age=%d, pointer=%t\", *age, age != nil)\n}",
    runOutput: "age=30, pointer=true\nnew: initialized pointer",
    metric: "1",
    metricLabel: "次表达式完成可选指针初始化",
    visual: [
      { label: "指针表达力", value: 92, note: "new(expr)" },
      { label: "错误类型安全", value: 88, note: "AsType" },
      { label: "密码学覆盖", value: 86, note: "HPKE" },
    ],
    doc: {
      context: "适合序列化模型、协议可选字段和需要后量子过渡的加密服务。",
      use: "把 new(expr) 留给“值来自一个明确表达式”的场景；简单零值指针仍使用 new(T)。",
      migrate: "检查构建环境是否已升级到 Go 1.26，再把序列化模型中的临时变量收敛掉。",
    },
    source: "https://go.dev/doc/go1.26",
  },
  {
    version: "1.27",
    date: "预计 2026.08",
    status: "preview",
    kicker: "草案中的下一步",
    title: "泛型方法，正在抵达",
    summary: "Go 1.27 仍未正式发布。当前 draft 已列出泛型方法、赋值上下文类型推导和实验性 SIMD，适合用来观察语言如何继续扩展。",
    tags: ["draft", "generic methods", "SIMD experiment"],
    features: [
      { name: "泛型方法", kind: "语言 / draft", detail: "方法可以声明自己的类型参数，但接口方法仍不能声明类型参数。" },
      { name: "推导扩展", kind: "语言 / draft", detail: "泛型函数类型推导进入赋值与转换上下文。" },
      { name: "simd", kind: "实验", detail: "新的硬件向量实验 API，当前不承诺稳定与跨架构可移植。" },
    ],
    before: "// 需要把类型参数放在接收者上\ntype Box[T any] struct { value T }\nfunc (b Box[T]) Map(fn func(T) T) T { ... }",
    after: "// draft：方法可以声明独立参数\nfunc (b Box[T]) Map[U any](fn func(T) U) U { ... }",
    runCode: "// Go 1.27 draft：仅用于语法预览\ntype Box[T any] struct { value T }\n\nfunc (b Box[T]) Map[U any](fn func(T) U) U {\n\treturn fn(b.value)\n}",
    runOutput: "preview only\nGo 1.27 is not yet released",
    metric: "DRAFT",
    metricLabel: "发布前的草案信号，不是生产承诺",
    visual: [
      { label: "泛型表达力", value: 98, note: "generic methods" },
      { label: "语言稳定度", value: 54, note: "draft notes" },
      { label: "硬件实验", value: 62, note: "simd" },
    ],
    doc: {
      context: "1.27 以草案发布说明为准，预计 2026 年 8 月发布；功能和细节可能继续调整。",
      use: "把它当作设计观察区，不要在生产模块的 go.mod 中依赖 draft 语法。",
      migrate: "持续关注 go.dev/doc/go1.27，正式发布后再把实验代码拆成独立分支验证。",
    },
    source: "https://go.dev/doc/go1.27",
  },
];

export default function Home() {
  const [selectedVersion, setSelectedVersion] = useState("1.27");
  const [hasRun, setHasRun] = useState(false);
  const [copied, setCopied] = useState(false);
  const selected = useMemo(
    () => versions.find((item) => item.version === selectedVersion) ?? versions[0],
    [selectedVersion],
  );

  const chooseVersion = (version: string) => {
    setSelectedVersion(version);
    setHasRun(false);
    setCopied(false);
  };

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(selected.runCode);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="site-shell">
      <header className="site-header">
        <a className="brand" href="#top" aria-label="Go Change Lab 首页">
          <span className="brand-mark">go</span>
          <span>CHANGE LAB</span>
        </a>
        <div className="header-meta">
          <span className="header-dot" aria-hidden="true" />
          <span>版本观测台</span>
          <span className="header-divider" />
          <span>{versions.length} RELEASES</span>
        </div>
        <a className="header-link" href="https://go.dev/doc/devel/release" target="_blank" rel="noreferrer">
          官方发布节奏 <span aria-hidden="true">↗</span>
        </a>
      </header>

      <main id="top">
        <section className="hero-shell" aria-labelledby="hero-title">
          <div className="hero-copy">
            <p className="eyebrow">GO CHANGELOG / 1.16 → 1.27</p>
            <h1 id="hero-title">语言在变，<em>边界</em>在缩短。</h1>
            <p className="hero-lede">
              从 embed 到泛型方法草案，沿着一条可执行的时间线，理解 Go 每次升级到底替你省掉了什么。
            </p>
            <div className="hero-actions">
              <a className="primary-btn" href="#lab">
                <span className="button-glyph" aria-hidden="true">↓</span>
                进入版本实验室
              </a>
              <a className="quiet-link" href="#docs">浏览全部版本文档 <span aria-hidden="true">→</span></a>
            </div>
          </div>
          <div className="hero-radar" aria-label="版本状态概览">
            <div className="radar-topline">
              <span>RELEASE RADAR</span>
              <span>2021 — 2026</span>
            </div>
            <div className="radar-arc" aria-hidden="true">
              <span className="arc-label arc-label-top">LANGUAGE</span>
              <span className="arc-label arc-label-right">RUNTIME</span>
              <span className="arc-label arc-label-bottom">TOOLCHAIN</span>
              <span className="radar-core">12</span>
            </div>
            <div className="radar-legend">
              <span><i className="legend-dot released" />已发布 11</span>
              <span><i className="legend-dot preview" />草案 1</span>
            </div>
          </div>
        </section>

        <section className="lab-layout" id="lab" aria-label="Go 版本实验室">
          <aside className="version-rail">
            <div className="rail-heading">
              <span className="eyebrow">INDEX / 00</span>
              <span className="rail-count">12 VERSIONS</span>
            </div>
            <nav className="version-list" aria-label="选择 Go 版本">
              {versions.map((item, index) => (
                <button
                  className={`version-item ${selected.version === item.version ? "is-active" : ""}`}
                  key={item.version}
                  onClick={() => chooseVersion(item.version)}
                  aria-current={selected.version === item.version ? "true" : undefined}
                >
                  <span className="version-index">{String(index + 1).padStart(2, "0")}</span>
                  <span className="version-copy">
                    <span className="version-number">Go {item.version}</span>
                    <span className="version-highlight">{item.title}</span>
                  </span>
                  <span className={`status-mark ${item.status}`} aria-label={item.status === "released" ? "已发布" : "预览草案"} />
                </button>
              ))}
            </nav>
            <div className="rail-note">
              <span className="note-mark">i</span>
              <span>1.27 标为 draft，内容会随官方发布说明更新。</span>
            </div>
          </aside>

          <section className="detail-stage" aria-live="polite">
            <div className="detail-head">
              <div>
                <p className="eyebrow">GO {selected.version} / {selected.kicker}</p>
                <div className="detail-title-row">
                  <h2>{selected.title}</h2>
                  <span className={`status-pill ${selected.status}`}>
                    <i className="legend-dot" />
                    {selected.status === "released" ? "RELEASED" : "DRAFT PREVIEW"}
                  </span>
                </div>
                <p className="detail-summary">{selected.summary}</p>
                <div className="tag-row">
                  {selected.tags.map((tag) => <span className="code-tag" key={tag}>{tag}</span>)}
                </div>
              </div>
              <div className="release-date">
                <span>RELEASE DATE</span>
                <strong>{selected.date}</strong>
              </div>
            </div>

            <div className="feature-strip">
              {selected.features.map((feature) => (
                <article className="feature-cell" key={feature.name}>
                  <span className="feature-kind">{feature.kind}</span>
                  <strong>{feature.name}</strong>
                  <p>{feature.detail}</p>
                </article>
              ))}
            </div>

            <div className="workbench-grid">
              <article className="code-card panel-dark">
                <div className="panel-topline">
                  <div className="window-dots" aria-hidden="true"><i /><i /><i /></div>
                  <span>EXAMPLE / main.go</span>
                  <div className="panel-actions">
                    <button className="icon-action" onClick={copyCode} aria-label="复制代码" title="复制代码">{copied ? "✓" : "⧉"}</button>
                  </div>
                </div>
                <pre className="code-block"><code>{selected.runCode}</code></pre>
                <div className="run-row">
                  <button className="run-btn" onClick={() => setHasRun(true)}>
                    <span className="run-icon" aria-hidden="true">▶</span>
                    {selected.status === "preview" ? "模拟运行" : "运行示例"}
                  </button>
                  <span className="run-hint">{selected.status === "preview" ? "语法预览" : "browser sandbox"}</span>
                </div>
                <div className={`output-console ${hasRun ? "has-output" : ""}`}>
                  <div className="console-label"><span>STDOUT</span><span>{hasRun ? "24ms" : "READY"}</span></div>
                  <pre>{hasRun ? selected.runOutput : "等待运行示例..."}</pre>
                </div>
              </article>

              <article className="visual-card panel-light">
                <div className="panel-topline light-line">
                  <span>WHAT CHANGED / 视觉拆解</span>
                  <span className="panel-number">{selected.metric}</span>
                </div>
                <div className="change-map">
                  <div className="change-node before-node">
                    <span className="node-label">BEFORE</span>
                    <pre>{selected.before}</pre>
                  </div>
                  <div className="change-arrow" aria-hidden="true">→</div>
                  <div className="change-node after-node">
                    <span className="node-label">{selected.status === "preview" ? "DRAFT" : "NOW"}</span>
                    <pre>{selected.after}</pre>
                  </div>
                </div>
                <p className="metric-caption">{selected.metricLabel}</p>
                <div className="profile-bars">
                  {selected.visual.map((bar) => (
                    <div className="profile-row" key={bar.label}>
                      <div className="profile-meta"><span>{bar.label}</span><span>{bar.value}</span></div>
                      <div className="profile-track"><span style={{ width: `${bar.value}%` }} /></div>
                      <span className="profile-note">{bar.note}</span>
                    </div>
                  ))}
                </div>
              </article>
            </div>

            <article className="doc-panel" id="docs">
              <div className="doc-heading">
                <div>
                  <p className="eyebrow">VERSION NOTE / GO {selected.version}</p>
                  <h3>一页文档，带走这一版的判断。</h3>
                </div>
                <a className="source-link" href={selected.source} target="_blank" rel="noreferrer">官方发布说明 <span aria-hidden="true">↗</span></a>
              </div>
              <div className="doc-columns">
                <div className="doc-item"><span>01 / 背景</span><p>{selected.doc.context}</p></div>
                <div className="doc-item"><span>02 / 适合什么时候用</span><p>{selected.doc.use}</p></div>
                <div className="doc-item"><span>03 / 升级提示</span><p>{selected.doc.migrate}</p></div>
              </div>
            </article>
          </section>
        </section>

        <section className="docs-index" aria-labelledby="docs-index-title">
          <div className="docs-index-head">
            <div>
              <p className="eyebrow">DOCUMENTS / 12</p>
              <h2 id="docs-index-title">每个版本，一份可以带走的判断。</h2>
            </div>
            <p>按版本筛选上方实验台，文档、示例和官方来源会同步切换。</p>
          </div>
          <div className="docs-grid">
            {versions.map((item) => (
              <button className={`doc-tile ${item.version === selected.version ? "is-active" : ""}`} key={item.version} onClick={() => chooseVersion(item.version)}>
                <span className="doc-tile-top"><strong>Go {item.version}</strong><span className={`tile-status ${item.status}`}>{item.status === "released" ? "已发布" : "草案"}</span></span>
                <span className="doc-tile-title">{item.title}</span>
                <span className="doc-tile-footer">阅读版本文档 <span aria-hidden="true">→</span></span>
              </button>
            ))}
          </div>
        </section>
      </main>

      <footer className="site-footer">
        <span>GO CHANGE LAB / BUILT FOR THE CURIOUS</span>
        <span>资料来源：go.dev release notes · 1.27 标注为 draft</span>
      </footer>
    </div>
  );
}
