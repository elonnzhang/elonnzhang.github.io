---
layout: post
title: 灵茶山艾府-基础算法笔记
date: 2025-08-19
categories: cate
---

# 零、内容
https://github.com/EndlessCheng/codeforces-go/blob/master/leetcode/README.md

# 一、相向双指针

https://www.bilibili.com/video/BV1bP411c7oJ?spm_id_from=333.788.videopod.sections&vd_source=61d0ab7742b04564fc1fbeb00533f72e
题单：
1. 167. 两数之和 II - 输入有序数组 https://leetcode.cn/problems/two-sum-ii-input-array-is-sorted/solution/san-shu-zhi-he-bu-hui-xie-xiang-xiang-sh-6wbq/ 
2. 15. 三数之和 https://leetcode.cn/problems/3sum/solution/shuang-zhi-zhen-xiang-bu-ming-bai-yi-ge-pno55/


## 两数之和2-输入为有序数组

- 题目背景：在一个**有序**数组中，找到两个数，使它们的和等于目标值。
- 核心算法：使用“相向双指针”技巧。左指针从头，右指针从尾，根据当前和与目标值的关系移动指针，时间复杂度为 O(n)。


![](assets/img/Pasted%20image%2020250819200544.png)

1. 随便找两个数组 eg 3 & 8，
2. 3+8 = 11 > 9 
3. 那么3和  3 -  8 中间的数加起来也大于 11 （同样大于9）
4. 那么把 8 去掉（右指针向前移动 ）
5. 或者
6. 2+6 = 8 < 9
7. 那么2 和 2-6 中间的数加起来也都小于 8 （同样小于9）
8. 那么把2 去掉（左指针向后移动）

![](assets/img/Pasted%20image%2020250819201309.png)

TODO
```go
func twoSum(numbers []int, target int) []int {
    left, right := 0, len(numbers)-1
    for {
        s := numbers[left] + numbers[right]
        if s == target {
            return []int{left + 1, right + 1} // 题目要求下标从 1 开始
        }
        if s > target {
            right--
        } else {
            left++
        }
    }
}
```


## 三数之和
- 题目背景：在一个数组中，找到所有和为 0 的三元组。
- 核心算法：先对数组排序，然后固定一个数，剩下的用双指针法寻找另外两个数。注意去重处理，避免重复三元组，时间复杂度为 O(n²)。




![](assets/img/Pasted%20image%2020250819201507.png)

优化1: 如果最小的三个数加起来 >0 , 那么后面的都大于0了
优化2:如果x（固定的那个值）和最大的两个数加起来是 < 0 的, 那么x和其他的数相加也都是小于0的
![](assets/img/Pasted%20image%2020250819201807.png)![](assets/img/Pasted%20image%2020250819202017.png)
```go
func threeSum(nums []int) (ans [][]int) {
    // var ans [][]int = make([][]int,0)
    sort.Ints(nums)
    n:=len(nums)
    for a:=0;a<len(nums)-2;a++{
        if a>0&&nums[a]==nums[a-1]{
            continue
        }
        if nums[a]+nums[a+1]+nums[a+2]>0{
            break
        }
        if nums[a]+nums[n-1]+nums[n-2]<0{
            continue
        }

        var b,c int= a+1,n-1
        for b<c{
            s:=nums[a]+nums[b]+nums[c]
            if s==0{
                ans = append(ans, []int{nums[a],nums[b],nums[c]})
                for b++;b<c&&nums[b]==nums[b-1];b++{}
                for c--;b<c&&nums[c]==nums[c+1];c--{}
            }else if s<0{
                b++
            }else{
                c--
            }
        }
    }
    return ans
}
```

时间复杂度：O(n^2)
空间复杂度：O(1)

# 二、相向双指针
1. 11. 盛最多水的容器 https://leetcode.cn/problems/container-with-most-water/solution/by-endlesscheng-f0xz/ 
2. 42. 接雨水 https://leetcode.cn/problems/trapping-rain-water/solution/zuo-liao-nbian-huan-bu-hui-yi-ge-shi-pin-ukwm/

## 盛水最多的容器
- 问题描述：给定一组高度，找出能盛最多水的两个边界，计算最大容积。
- 解题思路：采用“相向双指针”法。左指针从左，右指针从右，计算当前容积后，移动较低的指针，直到两指针相遇。这样能在 O(n) 时间复杂度下找到最大值。
- 关键点：每次移动**较低**的指针，因为容积受限于较短的边。

![](assets/img/Pasted%20image%2020250819202829.png)

每次去掉一条线
![](assets/img/Pasted%20image%2020250819203109.png)
```go
```

时间复杂度：O(n)
空间复杂度：O(1)

## 接雨水

![](Pasted%20image%2020250819203314.png)
### 方法：前缀后缀数组
这个桶取决于通的左边和右边的高度（木桶原理）
两个数组                                 
1. 存储最左边到i个位置的最大高度 【0，1，1，2，2，2，2，3，3，3，3，3】
2. 存储最右边到i个位置的最大高度【3，3，3，3，3，3，3，3，2，2，2，1】

如图所示可以接水的 前缀和后缀分别为 2、3 那么高度差为1 ，可以接水也是1

方法：1. 计算前缀和后缀数组 2. 计算i位置可以接的水

![](Pasted%20image%2020250819204445.png)
时间复杂度：O(n)
空间复杂度：O(n)
### 方法：双向指针

![](assets/img/Pasted%20image%2020250819205210.png)
前缀最大值比后缀最大值小 前缀向右扩展
反之 后缀最大值比前缀最大值小 后缀向左扩展

![](assets/img/Pasted%20image%2020250819205340.png)
```go
func trap(height []int) int {
	preMax, sufMax := 0, 0
	ans := 0
	left, right := 0, len(height)-1
	for left <= right {
		preMax = max(preMax, height[left])
		sufMax = max(sufMax, height[right])
		if preMax < sufMax { // 前缀最大值比后缀最大值小 前缀向右扩展
			ans += preMax - height[left] // 前缀最大-当前高度
			left++
		} else {//反之 后缀最大值比前缀最大值小 后缀向左扩展
			ans += sufMax - height[right]
			right--
		}
	}
	return ans
}

```

---

 **1. 思路回顾**

- **目标**：给定数组 height 表示每根柱子的高度，计算能接多少雨水。
- **原理**：某一位置能接的水量 = min(左侧最高, 右侧最高) - 当前高度。
- **优化**：用双指针 + 前缀最大/后缀最大动态维护，不需要额外数组。
    

  
在代码中：
- preMax 表示当前左侧最高柱子。
- sufMax 表示当前右侧最高柱子。
- 指针 left、right 从两端向中间收缩。
- 逻辑：
    - 如果 preMax < sufMax，那么 left 位置能接多少水只取决于 preMax，于是更新答案并 left++。
    - 否则处理右边 right--。
        

 **2. 执行过程模拟**

假设输入：

```
height := []int{0,1,0,2,1,0,1,3,2,1,2,1}
```

这是经典例子，答案是 6。

  

 **初始化**

```
left=0, right=11
preMax=0, sufMax=0, ans=0
```

 **Step 1**
```
preMax=max(0, height[0]=0)=0
sufMax=max(0, height[11]=1)=1
比较: preMax=0 < sufMax=1
ans += 0 - height[0]=0   // 不能接水
left=1
```
 **Step 2**
```
left=1, right=11
preMax=max(0, height[1]=1)=1
sufMax=max(1, height[11]=1)=1
比较: preMax=1 >= sufMax=1
ans += 1 - height[11]=1-1=0
right=10
```
 **Step 3**
```
left=1, right=10
preMax=1
sufMax=max(1, height[10]=2)=2
比较: preMax=1 < sufMax=2
ans += 1 - height[1]=1-1=0
left=2
```
 **Step 4**
```
left=2, right=10
preMax=max(1, height[2]=0)=1
sufMax=2
比较: preMax=1 < sufMax=2
ans += 1 - height[2]=1-0=1   // 接1单位水
left=3
```
 **Step 5**
```
left=3, right=10
preMax=max(1, height[3]=2)=2
sufMax=2
比较: preMax=2 >= sufMax=2
ans += 2 - height[10]=2-2=0
right=9
```
 **Step 6**
```
left=3, right=9
preMax=2
sufMax=max(2, height[9]=1)=2
比较: preMax=2 >= sufMax=2
ans += 2 - height[9]=2-1=1
right=8
```
 **Step 7**
```
left=3, right=8
preMax=2
sufMax=max(2, height[8]=2)=2
比较: preMax=2 >= sufMax=2
ans += 2 - height[8]=2-2=0
right=7
```
 **Step 8**
```
left=3, right=7
preMax=2
sufMax=max(2, height[7]=3)=3
比较: preMax=2 < sufMax=3
ans += 2 - height[3]=2-2=0
left=4
```
 **Step 9**
```
left=4, right=7
preMax=max(2, height[4]=1)=2
sufMax=3
比较: preMax=2 < sufMax=3
ans += 2 - height[4]=2-1=1
left=5
```
 **Step 10**
```
left=5, right=7
preMax=max(2, height[5]=0)=2
sufMax=3
比较: preMax=2 < sufMax=3
ans += 2 - height[5]=2-0=2
left=6
```
 **Step 11**
```
left=6, right=7
preMax=max(2, height[6]=1)=2
sufMax=3
比较: preMax=2 < sufMax=3
ans += 2 - height[6]=2-1=1
left=7
```
 **Step 12**
```
left=7, right=7
preMax=max(2, height[7]=3)=3
sufMax=3
比较: preMax=3 >= sufMax=3
ans += 3 - height[7]=3-3=0
right=6   // right < left, 循环结束
```

 **3. 结果**

最终 ans = 1+1+2+1+1 = 6。


### 方法：单调栈（后面讲解）
```go
func trap(height []int) int {
    var ans int = 0
    st:=make([]int,0)
    for i,h := range height{
        for len(st)>0 && h>=height[st[len(st)-1]]{
            // top height 是小于 h的
            top:=st[len(st)-1]
            bottomH := height[top]
            st = st[:len(st)-1]// pop
            if len(st) == 0{
                break
            }
            // 三个位置确定一个长方形
            //2. 栈顶（下面的线） 1. 当前h，  3. 栈次顶 （这俩小的确定上面的线）
            top2:= st[len(st)-1]
            dh:= min(height[top2],h)-bottomH // 高度差
            ans += dh * (i- top2-1)
        }
        st = append(st,i)
    }
    return ans
}

```


# 三、滑动窗
1. 209. 长度最小的子数组 https://leetcode.cn/problems/minimum-size-subarray-sum/solution/biao-ti-xia-biao-zong-suan-cuo-qing-kan-k81nh/ 
2. 3. 无重复字符的最长子串 https://leetcode.cn/problems/longest-substring-without-repeating-characters/solution/xia-biao-zong-suan-cuo-qing-kan-zhe-by-e-iaks/ 
3. 713. 乘积小于 K 的子数组 https://leetcode.cn/problems/subarray-product-less-than-k/solution/xia-biao-zong-suan-cuo-qing-kan-zhe-by-e-jebq/

## 长度最小的子数组

![](assets/img/Pasted%20image%2020250819211019.png)
![](assets/img/Pasted%20image%2020250819211033.png)


**遍历右端点，逐步移动左端点** 
![](assets/img/Pasted%20image%2020250819211319.png)
时间复杂度：O(n)
空间复杂度：O(1)

> 滑动窗双指针：满足单调性
> - 滑动窗口只适用于“连续子数组/子串”问题，不能提前排序。
> -  左右端点的移动顺序和条件判断是关键。
> - 有些题目窗口大小固定，有些题目窗口大小可变。
## 乘积小于 K 的子数组 

![](assets/img/Pasted%20image%2020250819211901.png)

```go
func numSubarrayProductLessThanK(nums []int, k int) int {
	if k <=1 || len(nums)==0{
		return 0
	}
	ans := 0
	prod := 1
    i:=0
	for j,x := range nums {
        prod *= x
		for prod>=k {
			prod /= nums[i]
			i++
		}
        ans+=j-i+1
	}
	return ans
}
```

## 无重复字符的最长子串

是否有重复：可以使用一个map来判断
![](assets/img/Pasted%20image%2020250819212148.png)

时间复杂度：O(n)
空间复杂度：O(128)


# 四、二分查找
# 五、
# 六、反转链表
1. 206. 反转链表 https://leetcode.cn/problems/reverse-linked-list/solution/you-xie-cuo-liao-yi-ge-shi-pin-jiang-tou-o5zy/ 
2. 92. 反转链表 II https://leetcode.cn/problems/reverse-linked-list-ii/solution/you-xie-cuo-liao-yi-ge-shi-pin-jiang-tou-teqq/ 
3. 25. K 个一组翻转链表 https://leetcode.cn/problems/reverse-nodes-in-k-group/solution/you-xie-cuo-liao-yi-ge-shi-pin-jiang-tou-plfs/
## 反转链表
![](Pasted%20image%2020250820090254.png)

```go
var pre *ListNode
cur = head
```

![](Pasted%20image%2020250820090812.png)
```go
nxt = cur.Next
```

![](Pasted%20image%2020250820090840.png)
```go
cur.Next = pre
pre = cur
cur = nxt
```

![](Pasted%20image%2020250820091117.png)


如果是反转中间一部分链表？
## 反转链表II

![](Pasted%20image%2020250820091402.png)
p0指向要反转部分的前一个节点
反转结束后，cur指向的是后面不需要反转的节点
![](assets/img/Pasted%20image%2020250820091442.png)
p0.Next.Next = cur
p0.Next = pre

![](Pasted%20image%2020250820091533.png)

新增一个 哨兵节点 dummyNode

![](assets/img/Pasted%20image%2020250820091732.png)
## K个一组翻转链表

![](Pasted%20image%2020250820101613.png)

![](Pasted%20image%2020250820092612.png)
![](Pasted%20image%2020250820092651.png)
最后返回哨兵节点的头节点

![](Pasted%20image%2020250820092939.png) 
pre、cur的赋值可以移动到循环外
![](Pasted%20image%2020250820093611.png)



## 「补充图示」
nxt是一个记录指针 记录 cur.Next的

![](assets/img/reverse-linked-list.png)
# 七、快慢指针
1. 876. 链表的中间结点 https://leetcode.cn/problems/middle-of-the-linked-list/solution/mei-xiang-ming-bai-yi-ge-shi-pin-jiang-t-wzwm/ 
2. 141. 环形链表 https://leetcode.cn/problems/linked-list-cycle/solution/mei-xiang-ming-bai-yi-ge-shi-pin-jiang-t-c4sw/ 
3. 142. 环形链表 II https://leetcode.cn/problems/linked-list-cycle-ii/solution/mei-xiang-ming-bai-yi-ge-shi-pin-jiang-t-nvsq/ 
4. 143. 重排链表 https://leetcode.cn/problems/reorder-list/solution/mei-xiang-ming-bai-yi-ge-shi-pin-jiang-t-u66q/

慢指针走一步 快指针走两步
![](assets/img/fast-slow-ptr.png)

![](Pasted%20image%2020250819212748.png)
长度为奇数，fast.next 为空，slow指向中间

![](Pasted%20image%2020250819212824.png)
长度为奇数，fast 为空，slow指向中间

## 链表的中间结点 

![](Pasted%20image%2020250819212953.png)

## 环形链表

如果有环，快慢指针一定会相遇的
![](Pasted%20image%2020250819213240.png) 

## 环形链表 II (还没理解)
![](Pasted%20image%2020250819213407.png)
![](Pasted%20image%2020250819213432.png)

![](Pasted%20image%2020250819213449.png)
快慢指针相遇时，慢指针还没走完一整圈 （TODO）
![](Pasted%20image%2020250819213823.png)

![](Pasted%20image%2020250819213921.png)

chatGPT解释：
**快慢指针（Floyd 判圈算法，O(1) 空间）**
这个是最优解，也是面试常问的。
 **步骤**
1. **判断链表是否有环**
    - 用快慢指针（slow 每次走 1 步，fast 每次走 2 步）。
    - 如果有环，一定会在某个点相遇；否则 fast 会先到 nil。

2. **找到环的入口**
    - 假设：
        - 链表头到入环点的距离 = a
        - 入环点到相遇点的距离 = b
        - 环的剩余部分距离 = c
    - 那么：
        - slow 走过的路程 = a + b
        - fast 走过的路程 = a + b + n(b + c) （n 表示绕环的圈数）
        - 因为 fast 速度是 slow 的 2 倍：

```
2(a+b) = a+b + n(b+c)
=> a = (n-1)(b+c) + c
```
意思是：**从头节点出发走 a 步，就能到入口；从相遇点出发走 c 步，也能到入口**。
```go
func detectCycle(head *ListNode) *ListNode {
    if head == nil || head.Next == nil {
        return nil
    }

    slow, fast := head, head
    // 1. 找相遇点
    for fast != nil && fast.Next != nil {
        slow = slow.Next
        fast = fast.Next.Next
        if slow == fast { // 相遇
            // 2. 找入口
            p := head
            for p != slow {
                p    = p.Next
                slow = slow.Next
            }
            return p
        }
    }
    return nil
}
```



另外实现方法
哈希表
```go
func detectCycle(head *ListNode) *ListNode {
    visited := map[*ListNode]bool{}
    for head != nil {
        if visited[head] {
            return head
        }
        visited[head] = true
        head = head.Next
    }
    return nil
}
```
##  ** 重排链表

给定一个单链表 `L` 的头节点 `head` ，单链表 `L` 表示为：
L0 → L1 → … → Ln - 1 → Ln
请将其重新排列后变为：
L0 → Ln → L1 → Ln - 1 → L2 → Ln - 2 → …
不能只是单纯的改变节点内部的值，而是需要实际的进行节点交换。
![](Pasted%20image%2020250819215122.png)
![](Pasted%20image%2020250819215248.png)
![](Pasted%20image%2020250819215144.png)
![](Pasted%20image%2020250819215315.png)

1. 拿到中间节点 876
2. 反转链表 206

![](Pasted%20image%2020250819215415.png)
![](Pasted%20image%2020250819215531.png)

# 八、前后指针
1. 237. 删除链表中的节点 https://leetcode.cn/problems/delete-node-in-a-linked-list/solution/ru-he-shan-chu-jie-dian-liu-fen-zhong-ga-x3kn/ 
2. 19. 删除链表的倒数第 N 个结点 https://leetcode.cn/problems/remove-nth-node-from-end-of-list/solution/ru-he-shan-chu-jie-dian-liu-fen-zhong-ga-xpfs/ 
3. 83. 删除排序链表中的重复元素 https://leetcode.cn/problems/remove-duplicates-from-sorted-list/solution/ru-he-qu-zhong-yi-ge-shi-pin-jiang-tou-p-98g7/ 
4. 82. 删除排序链表中的重复元素 II https://leetcode.cn/problems/remove-duplicates-from-sorted-list-ii/solution/ru-he-qu-zhong-yi-ge-shi-pin-jiang-tou-p-2ddn/

## 删除链表中的节点

复制下一个节点的值
指向下一个节点的Next
![](Pasted%20image%2020250820102411.png)
![](Pasted%20image%2020250820102227.png)


## 删除链表的倒数第 N 个结点
什么时候需要哨兵节点？
如果需要删除头节点，就需要 哨兵节点

### 方法一
遍历求的链表长度，n
删除倒数第N个，就是删除正数第n-N个
需要遍历两次
### 方法二
初始化一个right指针，先让right走N步
在初始化一个left指针，此时，left和rihgt一起走，right走到尾部，left走到倒数第N个节点的前一个节点（倒数第N+1个节点）。
left和right保持了 N 的距离，一次遍历
![](Pasted%20image%2020250820102821.png)
![](Pasted%20image%2020250820103003.png)

## 删除排序链表中的重复元素
重复元素只保留一个
![](Pasted%20image%2020250820103106.png)
![](Pasted%20image%2020250820103212.png)
需要哨兵节点吗？
不需要，因为头节点可以保留下来的。
![](Pasted%20image%2020250820103319.png)
## 删除排序链表中的重复元素 II
需要把重复的全部删除
![](Pasted%20image%2020250820103438.png)
比较下一个节点和下下个节点的值
![](Pasted%20image%2020250820103716.png)
![](Pasted%20image%2020250820104741.png)

# 九、二叉树 递归
1. 104. 二叉树的最大深度 https://leetcode.cn/problems/maximum-depth-of-binary-tree/solution/kan-wan-zhe-ge-shi-pin-rang-ni-dui-di-gu-44uz/
![](Pasted%20image%2020250820104933.png)

## 二叉树的最大深度
![](Pasted%20image%2020250820105033.png)


![](Pasted%20image%2020250820105205.png)

![](Pasted%20image%2020250820105344.png)


写法2: 传递一个值，依次往下传递
![](Pasted%20image%2020250820105614.png)
数学归纳法
![](Pasted%20image%2020250820105315.png)

图示
![](Pasted%20image%2020250820105448.png)

# 十、二叉树 相同 对称 平衡 右视图
1. 100.相同的树 https://leetcode.cn/problems/same-tree/solution/ru-he-ling-huo-yun-yong-di-gui-lai-kan-s-empk/ 
2. 101. 对称二叉树 https://leetcode.cn/problems/symmetric-tree/solution/ru-he-ling-huo-yun-yong-di-gui-lai-kan-s-6dq5/ 
3. 110. 平衡二叉树 https://leetcode.cn/problems/balanced-binary-tree/solution/ru-he-ling-huo-yun-yong-di-gui-lai-kan-s-c3wj/ 
4. 199. 二叉树的右视图 https://leetcode.cn/problems/binary-tree-right-side-view/solution/ru-he-ling-huo-yun-yong-di-gui-lai-kan-s-r1nc/
## 相同的树
value相同 左子树相同，右子树相同
isSame(Left,Left) isSame(Right,Right)
![](Pasted%20image%2020250820123329.png)
边界条件
一个为空 返回 

![](Pasted%20image%2020250820123255.png)
## 对称二叉树
![](Pasted%20image%2020250820123402.png)

isSymmetric(Left,Right) isSymmetric(Right,Left)
![](Pasted%20image%2020250820123625.png)

## 平衡二叉树
![](Pasted%20image%2020250820124432.png)

-1 作为一个标记位，代表不平衡。
## 二叉树的右视图
![](Pasted%20image%2020250820124547.png)

右视图，一层一个值。
![](Pasted%20image%2020250820124804.png)如果深度等于当前ans长度，那么就记录这个值

# 十一、验证二叉搜索树
1. 98. 验证二叉搜索树 https://leetcode.cn/problems/validate-binary-search-tree/solution/qian-xu-zhong-xu-hou-xu-san-chong-fang-f-yxvh/
给你一个二叉树的根节点 `root` ，判断其是否是一个有效的二叉搜索树。
**有效** 二叉搜索树定义如下：
- 节点的左子树只包含 **严格小于** 当前节点的数。
- 节点的右子树只包含 **严格大于** 当前节点的数。
- 所有左子树和右子树自身必须也是二叉搜索树。
![](Pasted%20image%2020250820125148.png)


前序：先访问节点值。每一个节点值，都必须在一个范围内
![](Pasted%20image%2020250820125303.png)
中序： 先访问左子树，在访问节点值，在访问右子树。严格递增
需要传入上一个节点值

后序：返回一个合法的范围
```go 
func isValidBST(root *TreeNode) bool {
	// 1. 前序递归
	// return dfs(root, math.MinInt, math.MaxInt)
	// 2. 中序遍历，前面的值要小于当前值，严格递增
	// return inOrder(root,math.MinInt)
    _,r:= postOrder(root)
    return r!=math.MaxInt
}

// root 节点，left right 这棵树的左右边界值，root中的节点值都要在这个范围内
// preOrder
func dfs(root *TreeNode, left, right int) bool {
	if root == nil {
		return true
	}
	val := root.Val
	return left < val && val < right &&
		dfs(root.Left, left, val) &&
		dfs(root.Right, val, right)
}

// 
func inOrder(root *TreeNode, pre int) bool {
	if root == nil {
		return true
	}
    // 左
	if !inOrder(root.Left, pre){
		return false
	}
    // 中
	if root.Val <= pre {
		return false
	}
    // 右
	if !inOrder(root.Right, root.Val) {
		return false
	}
	return true
}

// 返回一个范围  
func postOrder(root *TreeNode)(int,int){
    if root == nil{
        return math.MaxInt,math.MinInt // 不存在
    }

    lMin,lMax := postOrder(root.Left)
    rMin,rMax := postOrder(root.Right)
    //                 x
    //  lMin.   lMax         rMin.     rMax
    x:=root.Val
    // x 一定比 左子树的最大值大，比右子树的最小值小
    // 如果不满足 就
    if x<=lMax || x>rMin{
        return math.MinInt,math.MaxInt
    }
    // 返回左边的 最小值 和右边的最大值
    return min(lMin,x),max(rMax,x)
}
```

# 十二、最近公共祖先

# 十三、二叉树层序遍历
使用一个队列，将未访问的节点入队列

# 十四、回溯（1）子集型
# 十五、回溯（2）组合型
# 十六、回溯（3）排序型
# 十七、动态规划
1. 198. 打家劫舍 https://leetcode.cn/problems/house-robber/solution/ru-he-xiang-chu-zhuang-tai-ding-yi-he-zh-1wt1



![](Pasted%20image%2020250821105659.png)


## 打家劫舍
```
func rob(nums []int) int {
    var dfs func(int)int
    dfs = func(n int)int{
        if n==0{
            return 0
        }
        // max(不选（n-1），选（n-2）+ nums[i])
        return  max(dfs(n-1),dfs(n-2)+nums[n])
    }
    return dfs(len(nums)-1)
}
```
上述代码会超时

重复计算太多了，需要保存一下

![](Pasted%20image%2020250821110534.png)


![](Pasted%20image%2020250821110658.png)

O(n) 的空间复杂度
```go
    var dp []int = make([]int,len(nums)+2)
    for i:=2;i<len(nums)+2;i++{
        dp[i] = max(dp[i-1],dp[i-2]+nums[i-2])
    }
    return dp[len(nums)+1]
```

O(1) 的空间复杂度
```go
    f0,f1:=0,0
    for i:=2;i<len(nums)+2;i++{
        newF1 := max(f1,f0+nums[i-2])
        f0 = f1
        f1 = newF1
    }
    return f1
```
# 十八、0-1背包、 完全背包
1. 494. 目标和 https://leetcode.cn/problems/target-sum/solution/jiao-ni-yi-bu-bu-si-kao-dong-tai-gui-hua-s1cx/ 
2. 322. 零钱兑换 https://leetcode.cn/problems/coin-change/solution/jiao-ni-yi-bu-bu-si-kao-dong-tai-gui-hua-21m5/

![](Pasted%20image%2020250820130848.png)
![](Pasted%20image%2020250820131149.png)

![](Pasted%20image%2020250820131459.png)
## 目标和
给你一个非负整数数组 `nums` 和一个整数 `target` 。
向数组中的每个整数前添加 `'+'` 或 `'-'` ，然后串联起所有整数，可以构造一个 **表达式** ：
- 例如，`nums = [2, 1]` ，可以在 `2` 之前添加 `'+'` ，在 `1` 之前添加 `'-'` ，然后串联起来得到表达式 `"+2-1"` 。
返回可以通过上述方法构造的、运算结果等于 `target` 的不同 **表达式** 的数目。

![](Pasted%20image%2020250820131433.png)![](Pasted%20image%2020250820131712.png)


改成递推
![](Pasted%20image%2020250820131933.png)

![](Pasted%20image%2020250820132050.png)

%2

![](Pasted%20image%2020250820132120.png)

从左到右计算，前面的值会被覆盖，-》 修改为从右往左计算

![](Pasted%20image%2020250820132302.png)

![](Pasted%20image%2020250820132453.png)

Emmm， 脑子宕机了。
## 零钱兑换

![](Pasted%20image%2020250820132612.png)


动态规划（自低向上）
![](Pasted%20image%2020250821091751.png)

```go
func coinChange(coins []int, amount int) int {
    var dp []int = make([]int,amount+1)
    for i:=1;i<=amount;i++{ // 遍历背包
        dp[i]=math.MaxInt/2
        for _,c:= range coins{// 遍历物品
            if c<=i{
                dp[i]= min(dp[i],1+dp[i-c])
            }
           
        }
    }
    if dp[amount]!=math.MaxInt/2{
        return dp[amount]
    }else{
        return -1
    }
}
```
```go
func coinChange(coins []int, amount int) int {
    dp := make([]int, amount+1)
    for i := range f {
        dp[i] = math.MaxInt / 2
    }
    f[0] = 0
    for _, x := range coins { // 遍历物品
        for c := x; c <= amount; c++ { // 遍历背包
            dp[c] = min(dp[c], dp[c-x]+1)
        }
    }
    ans := dp[amount]
    if ans < math.MaxInt/2 {
        return ans
    }
    return -1
}
```
问：关于完全背包，有两种写法，一种是外层循环枚举物品，内层循环枚举体积；另一种是外层循环枚举体积，内层循环枚举物品。如何评价这两种写法的优劣？

答：两种写法都可以，但更推荐前者。外层循环枚举物品的写法，只会遍历物品数组一次；而内层循环枚举物品的写法，会遍历物品数组多次。从 cache 的角度分析，多次遍历数组会导致额外的 cache miss，带来额外的开销。所以虽然这两种写法的时间空间复杂度是一样的，但外层循环枚举物品的写法常数更小。

## 完全平方数

index 1 2 3 4    5    6     7    8     9
       1 4 9 16 25  36  49  64  81
背包是 n 
物品是 i平方
```go
func numSquares(n int) int {
    var dp [10001]int
    for i:=1;i<=n;i++{ // 遍历背包
        dp[i] = math.MaxInt32
        for j:=1;j*j<=i;j++{ // 遍历物品
            dp[i] = min(dp[i],dp[i-j*j]+1)
        }
    }
    return dp[n]
}
```

```go
    for i:=1;i<=n;i++{
        dp[i] = math.MaxInt32
    }
    for i:= 1;i*i<=n;i++{ // 遍历物品
        for j:=i*i;j<=n;j++{  // 遍历背包
            dp[j] = min(dp[j],dp[j-i*i]+1)
        }
    }
    return dp[n]
```



# 十九、线性DP
1. 1143. 最长公共子序列 https://leetcode.cn/problems/longest-common-subsequence/solutions/2133188/jiao-ni-yi-bu-bu-si-kao-dong-tai-gui-hua-lbz5/ 
2. 72. 编辑距离 https://leetcode.cn/problems/edit-distance/solutions/2133222/jiao-ni-yi-bu-bu-si-kao-dong-tai-gui-hua-uo5q/
## 最长公共子序列
![](Pasted%20image%2020250821111541.png)

![](Pasted%20image%2020250821111651.png)


https://www.bilibili.com/video/BV17iTvzcEXN/?spm_id_from=333.1007.top_right_bar_window_history.content.click&vd_source=61d0ab7742b04564fc1fbeb00533f72e



## 编辑距离

![](Pasted%20image%2020250825102503.png)
e去掉
r去掉
h改为r

s -> t
删除一个字符 -> 去掉s一个字符
插入一个字符 -> 去掉 t 一个字符
修改一个字符 -> s，t分别去掉一个
![](Pasted%20image%2020250825102419.png)

# 二十、线性 DP
1. 300.最长递增子序列 https://leetcode.cn/problems/longest-increasing-subsequence/solution/jiao-ni-yi-bu-bu-si-kao-dpfu-o1-kong-jia-4zma/
## 最长递增子序列 LIS

![](Pasted%20image%2020250821115259.png)

子集性 回溯
![](Pasted%20image%2020250821115516.png)

### 递归
![](assets/img/Pasted%20image%2020250826140854.png)
遍历每个值的为右端点，再向前遍历

### 递推
![](Pasted%20image%2020250821115821.png)

### 贪心+二分查找

![](Pasted%20image%2020250826141203.png)

```go
func lengthOfLIS(nums []int) int {
    g := []int{}
    for _, x := range nums {
        j := sort.SearchInts(g, x)
        if j == len(g) { // >=x 的 g[j] 不存在
            g = append(g, x)
        } else {
            g[j] = x
        }
    }
    return len(g)
}
```
# 股票相关
股票买卖系列题目
1. 买卖股票的最佳时机
2. 买卖股票的最佳时机 II
3. 买卖股票的最佳时机 III
4. 买卖股票的最佳时机 IV
5. 买卖股票的最佳时机含冷冻期
6. 买卖股票的最佳时机含手续费

121 最佳买卖股票时机
https://leetcode.cn/problems/best-time-to-buy-and-sell-stock/description/
```go
func maxProfit(prices []int) int {
	maxP := 0
	// 暴力超时
	// if len(prices) <= 1 {
	// 	return maxP
	// }
	// for i := range len(prices) - 1 {
	// 	for j := i + 1; j < len(prices); j++ {
	// 		if prices[i] > prices[j] {
	// 			continue
	// 		}
	// 		maxP = max(maxP, prices[j]-prices[i])
	// 	}
	// }
    // return maxP

	// 一次遍历
    minPrice := prices[0]
    for _,p := range prices{
        maxP = max(maxP,p-minPrice)
        minPrice = min(minPrice,p)
    }
    return maxP
}
```

121.最佳买卖股票时机2
https://leetcode.cn/problems/best-time-to-buy-and-sell-stock-ii/description/
```go
func maxProfit(prices []int) int {
    // 持有或着不持有
    dp:=make([][2]int,len(prices))
    dp[0][0] = 0 // 不持有
    dp[0][1] = -prices[0] // 持有

    for i:=1;i<len(prices);i++{
        dp[i][0] = max(dp[i-1][0],dp[i-1][1]+prices[i]) 
        dp[i][1] = max(dp[i-1][1],dp[i-1][0]-prices[i])
    }

    return dp[len(prices)-1][0]
}
```

两种状态：持有（1） 不持有（0）
下一天的状态依赖于前一天 
	持有：前一天也持有
		    前一天不持有，当天买入
	不持有：前一天不持有
			前一天持有，当前卖出


123 最佳买卖股票时机3 hard


# 二十六、单调栈
1. 739.每日温度 https://leetcode.cn/problems/daily-temperatures/solution/shi-pin-jiang-qing-chu-wei-shi-yao-yao-y-k0ks/ 
2. 42. 接雨水 https://leetcode.cn/problems/trapping-rain-water/solution/zuo-liao-nbian-huan-bu-hui-yi-ge-shi-pin-ukwm/


## 每日温度
### 从右到左
![](Pasted%20image%2020250825104258.png)


6 ：7入栈
3：6入栈
2：5入栈
5:   栈顶不的复合条件，出栈，然后4入站（6的下标-5的下标）

![](Pasted%20image%2020250825105117.png)

### 从左到右

栈顶元素存储的是没有找到下一个更大的数
```go
func dailyTemperatures(temperatures []int) []int {
    n := len(temperatures)
    answer := make([]int, n)
    stack := []int{} // 用栈存储温度的索引
    
    for i := 0; i < n; i++ {
        // 处理栈中的温度, 栈顶温度小于当前问题
        for len(stack) > 0 && temperatures[stack[len(stack)-1]] < temperatures[i] {
			top := stack[len(stack)-1]
            stack = stack[:len(stack)-1]
            answer[idx] = i - top // 计算天数差
        }
        stack = append(stack, i)
    }
    
    return answer
}
```


## 接雨水
### 横向计算
![](Pasted%20image%2020250825132000.png)
面积由三个下标决定

 - 当前元素下标
 - 栈顶元素下标
 - 栈顶元素下面的元素下标


从左开始遍历，
5 2 1 0 没法接水，遍历到4时，可以接水了，如图，
高为1，宽为1 的水
高为1，宽为2 的水
高为2，宽为3的水

单调栈
    5 2 1 0 【4】(2,1,0出栈、4入站)
->    5 4

面积由三个下标决定，
 - 当前下标
 - 栈顶下标
 - 栈次顶下标

5 2 【4】
5 和 4 的下标之差 -1等于面积宽
5 4的最小值 时顶边的高度
2 是底边的高度

![](assets/img/Pasted%20image%2020250826134938.png)

![](assets/img/Pasted%20image%2020250826134656.png)

## 494、下一个更大的元素I
```go
func nextGreaterElement(nums1 []int, nums2 []int) []int {
    idx:=make(map[int]int,len(nums1))
    for i,x := range nums1{
        idx[x] = i
    }
    ans:=make([]int,len(nums1))
    for i:=range ans{
        ans[i] = -1
    }
    st:=[]int{}
    for _,x:= range nums2{
        for len(st)>0 && x>st[len(st)-1]{
            // x 比栈顶元素大
            ans[idx[st[len(st)-1]]]= x
            st = st[:len(st)-1]
        }
        if _,ok:=idx[x];ok{ // x 在 num1 中
            st = append(st,x) // 只需要把 nums1 中的元素入栈
        }
    }
    return ans
}
```
## 503、下一个更大的元素II
```go
func nextGreaterElements(nums []int) []int {
    ans:=make([]int,len(nums))
    for i:= range ans{
        ans[i] = -1
    }
    st:=[]int{} // 存放下标
    for i:=0;i<2*len(nums);i++{
        x := nums[i%len(nums)]
        for len(st)>0&&x>nums[st[(len(st)-1)]]{
            ans[st[len(st)-1]] = x
            st = st[:len(st)-1]
        }
        if i<len(nums){
            st = append(st,i)
        }
    }
    return ans
}
```
# 二十七、单调队列

1. 239.滑动窗口最大值 https://leetcode.cn/problems/sliding-window-maximum/solution/shi-pin-yi-ge-shi-pin-miao-dong-dan-diao-ezj6/
## 滑动窗口最大值

![](assets/img/Pasted%20image%2020250826135247.png)

![](assets/img/Pasted%20image%2020250826135428.png)


## 单调队列套路

1. 右边入（元素进入**队尾**，同时维护队列**单调性**）
2. 左边出（元素离开**队首**）
3. 记录/维护答案（根据**队首**）
```go
func maxSlidingWindow(nums []int, k int) []int {
    ans := make([]int, len(nums)-k+1) // 窗口个数
    q := []int{}

    for i, x := range nums {
        // 1. 右边入
        for len(q) > 0 && nums[q[len(q)-1]] <= x {
		    // 出 不符合单调性的元素
            q = q[:len(q)-1] // 维护 q 的单调性
        }
        q = append(q, i) // 注意保存的是下标，这样下面可以判断队首是否离开窗口

        // 2. 左边出，当前坐标是i
        left := i - k + 1 // 窗口左端点
        if q[0] < left {  // 队首离开窗口
            q = q[1:] // Go 的切片是 O(1) 的
        }

        // 3. 在窗口左端点处记录答案
        if left >= 0 {
            // 由于队首到队尾单调递减，所以窗口最大值就在队首
            ans[left] = nums[q[0]]
        }
    }

    return ans
}
```