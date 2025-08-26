---
layout: post
title: golang-gmp模型
date: 2025-08-14
categories: golang
---

### G M P 模型

一句话：调度器调度任务队列、P在M上运行去执行G

两个任务队列
	 -  全局任务队列
	 - P本地队列
调度器

### 总览

![](assets/img/Pasted%20image%2020250814152829.png)




​ 1、我们通过 go func () 来创建一个 goroutine；

​ 2、有两个存储 G 的队列，一个是局部调度器 P 的本地队列、一个是全局 G 队列。新创建的 G 会先保存在 P 的本地队列中，如果 P 的本地队列已经满了就会保存在全局的队列中；

​ 3、G 只能运行在 M 中，一个 M 必须持有一个 P，M 与 P 是 1：1 的关系。M 会从 P 的本地队列弹出一个可执行状态的 G 来执行，如果 P 的本地队列为空，就会向其他的 MP 组合偷取一个可执行的 G 来执行；

​ 4、一个 M 调度 G 执行的过程是一个循环机制；

​ 5、当 M 执行某一个 G 时候如果发生了 syscall 或则其余阻塞操作，M 会阻塞，如果当前有一些 G 在执行，runtime 会把这个线程 M 从 P 中摘除 (detach)，然后再创建一个新的操作系统的线程 (如果有空闲的线程可用就复用空闲线程) 来服务于这个 P；

​ 6、当 M 系统调用结束时候，这个 G 会尝试获取一个空闲的 P 执行，并放入到这个 P 的本地队列。如果获取不到 P，那么这个线程 M 变成休眠状态， 加入到空闲线程中，然后这个 G 会被放入全局队列中。


![](assets/img/Pasted%20image%2020250814153412.png)



goroutine 的生命周期
```go
// Goroutine states you'll see in the explorer:
// 1. Created - goroutine is spawned
// 2. Running - actively executing
// 3. Sleeping - time.Sleep() or waiting
// 4. Terminated - function returns
```

![](assets/img/Pasted%20image%2020250814154843.png)
https://www.concurrency.rocks/tutorials/basic-goroutines


https://www.concurrency.rocks/