---
title: 灵茶山艾府：基础算法笔记
date: 2025-08-19
categories: algorithm
slug: endlesschen-leetcode
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


![](/assets/img/5b141bea-7454-4b4c-8501-35a87beb2a1c.png)

1. 随便找两个数组 eg 3 & 8，
2. 3+8 = 11 > 9 
3. 那么3和  3 -  8 中间的数加起来也大于 11 （同样大于9）
4. 那么把 8 去掉（右指针向前移动 ）
5. 或者
6. 2+6 = 8 < 9
7. 那么2 和 2-6 中间的数加起来也都小于 8 （同样小于9）
8. 那么把2 去掉（左指针向后移动）

![](/assets/img/d85935d4-e348-46bd-97f3-9705f635693b.png)

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




![](/assets/img/3aa44ddc-4d13-4fce-856f-394277b04e64.png)

优化1: 如果最小的三个数加起来 >0 , 那么后面的都大于0了
优化2:如果x（固定的那个值）和最大的两个数加起来是 < 0 的, 那么x和其他的数相加也都是小于0的
![](/assets/img/d7711641-b5a3-4aca-aa4f-b88a45fee1fe.png)![](/assets/img/30e6eb09-bc04-44b8-b5bf-10bb2a2f2319.png)
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

![](/assets/img/33c9aeaf-bcd5-49b9-b652-d64b11b1ea3c.png)

每次去掉一条线
![](/assets/img/f2096b5b-202f-4b9d-95cd-35a0831cbc8f.png)
```go
```

时间复杂度：O(n)
空间复杂度：O(1)

## 接雨水

![](/assets/img/f7ea934c-cc82-4e1a-b9b8-49d9c85da177.png)
### 方法：前缀后缀数组
这个桶取决于通的左边和右边的高度（木桶原理）
两个数组                                 
1. 存储最左边到i个位置的最大高度 【0，1，1，2，2，2，2，3，3，3，3，3】
2. 存储最右边到i个位置的最大高度【3，3，3，3，3，3，3，3，2，2，2，1】

如图所示可以接水的 前缀和后缀分别为 2、3 那么高度差为1 ，可以接水也是1

方法：1. 计算前缀和后缀数组 2. 计算i位置可以接的水

![](/assets/img/dbc9b2f8-a748-45b6-9397-f53e5aafc3e8.png)
时间复杂度：O(n)
空间复杂度：O(n)
### 方法：双向指针

![](/assets/img/9c738464-e483-40a1-afe5-3952d20af580.png)
前缀最大值比后缀最大值小 前缀向右扩展
反之 后缀最大值比前缀最大值小 后缀向左扩展

![](/assets/img/91d769cd-6f9d-41dc-8ab1-df734f9dd390.png)
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

![](/assets/img/d07ffb92-4984-4ea6-a224-7d9635301deb.png)
![](/assets/img/9b35cd4a-5728-4d72-bc95-f051b368a7e7.png)


**遍历右端点，逐步移动左端点** 
![](/assets/img/14d58e1f-4aff-49fd-ae7f-7e5d262dc8ac.png)
时间复杂度：O(n)
空间复杂度：O(1)

> 滑动窗双指针：满足单调性
> - 滑动窗口只适用于“连续子数组/子串”问题，不能提前排序。
> -  左右端点的移动顺序和条件判断是关键。
> - 有些题目窗口大小固定，有些题目窗口大小可变。
## 乘积小于 K 的子数组 

![](/assets/img/426767a2-61de-42e6-892b-3ef74469c270.png)

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
![](/assets/img/66143528-c96a-4b6a-9eda-d1f99548fce3.png)

时间复杂度：O(n)
空间复杂度：O(128)


# 四、二分查找
# 五、
# 六、反转链表
1. 206. 反转链表 https://leetcode.cn/problems/reverse-linked-list/solution/you-xie-cuo-liao-yi-ge-shi-pin-jiang-tou-o5zy/ 
2. 92. 反转链表 II https://leetcode.cn/problems/reverse-linked-list-ii/solution/you-xie-cuo-liao-yi-ge-shi-pin-jiang-tou-teqq/ 
3. 25. K 个一组翻转链表 https://leetcode.cn/problems/reverse-nodes-in-k-group/solution/you-xie-cuo-liao-yi-ge-shi-pin-jiang-tou-plfs/
## 反转链表
![](/assets/img/789b3848-e80e-41cf-952d-151e276283b0.png)

```go
var pre *ListNode
cur = head
```

![](/assets/img/1ad4de88-ff94-44b4-a613-fa791536f0f6.png)
```go
nxt = cur.Next
```

![](/assets/img/1e6d27b5-6b55-4607-9033-867a89ee87e3.png)
```go
cur.Next = pre
pre = cur
cur = nxt
```

![](/assets/img/6f351e5e-2730-4396-99d2-927048ca6b10.png)

```go
func reverseList(head *ListNode) *ListNode {
    var pre *ListNode
    cur:=head
    for cur!=nil{
        // 记录下一个
        nxt := cur.Next
        // 修改指针指向（反转）
        cur.Next = pre
        // 准备下一个
        pre = cur
        cur = nxt
    }
    return pre
}
```

如果是反转中间一部分链表？
## 反转链表II

![](/assets/img/723b21b3-56c7-4555-9a86-d1a81108dd65.png)
p0指向要反转部分的前一个节点
反转结束后，cur指向的是后面不需要反转的节点
![](/assets/img/fda37cea-2818-4dc4-b2b8-3b79ba127520.png)
p0.Next.Next = cur (tail.Next = cur)
p0.Next = pre (pre.Next = head)

![](/assets/img/fe10bfe4-7737-4961-824f-c80148a8a049.png)

新增一个 哨兵节点 dummyNode

![](/assets/img/f1a2dde1-982f-4868-a935-e305093ad73c.png)
## K个一组翻转链表

![](/assets/img/e87c4367-3cbc-455e-8361-8fdb65dfdd91.png)

![](/assets/img/023c95b8-3c29-45bf-8a50-cceb148cc386.png)
![](/assets/img/0b12517d-3e82-4ffe-b757-1866fa850faa.png)
最后返回哨兵节点的头节点

![](/assets/img/6e58e7eb-e605-450b-9c6c-d287096adef4.png)
pre、cur的赋值可以移动到循环外
![](/assets/img/c1c39c0c-5d52-40c3-ba15-d3a25456bc92.png)



## 「补充图示」
nxt是一个记录指针 记录 cur.Next的

![](/assets/img/reverse-linked-list.png)
# 七、快慢指针
1. 876. 链表的中间结点 https://leetcode.cn/problems/middle-of-the-linked-list/solution/mei-xiang-ming-bai-yi-ge-shi-pin-jiang-t-wzwm/ 
2. 141. 环形链表 https://leetcode.cn/problems/linked-list-cycle/solution/mei-xiang-ming-bai-yi-ge-shi-pin-jiang-t-c4sw/ 
3. 142. 环形链表 II https://leetcode.cn/problems/linked-list-cycle-ii/solution/mei-xiang-ming-bai-yi-ge-shi-pin-jiang-t-nvsq/ 
4. 143. 重排链表 https://leetcode.cn/problems/reorder-list/solution/mei-xiang-ming-bai-yi-ge-shi-pin-jiang-t-u66q/

慢指针走一步 快指针走两步
![](/assets/img/fast-slow-ptr.png)

![](/assets/img/2f976863-378b-47b2-b3df-e47fd9ef2610.png)
长度为奇数，fast.next 为空，slow指向中间

![](/assets/img/8147aecb-1bcd-4fc7-8658-39a4522a8417.png)
长度为奇数，fast 为空，slow指向中间

## 链表的中间结点 

![](/assets/img/13955565-e3cf-4004-8dc0-22b575cc9369.png)

## 环形链表

如果有环，快慢指针一定会相遇的
![](/assets/img/56ec5ed8-de87-448d-b868-6d814f31a574.png)

## 环形链表 II (还没理解)
![](/assets/img/0cc023f2-971f-4385-adc5-dfdb013d3b87.png)
![](/assets/img/9a1cf19f-e24e-45b4-8df2-e24b163b4baa.png)

![](/assets/img/9b835d81-6278-4d29-a9ed-a0698496aecc.png)
快慢指针相遇时，慢指针还没走完一整圈 （TODO）
![](/assets/img/2fbb4da2-990d-49ad-95b6-a8ee92dddf40.png)

![](/assets/img/9313411c-f5c4-4130-b1a3-e07df85192d2.png)

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
![](/assets/img/b3b57e19-cc94-4ff6-a506-7291df0b75bc.png)
![](/assets/img/350ca243-b9bc-47b0-874b-92065886cc28.png)
![](/assets/img/008ca4a0-b1e7-461d-8cb3-13b4a1c2c746.png)
![](/assets/img/78619932-f481-4166-9455-bd15fbd15769.png)

1. 拿到中间节点 876
2. 反转链表 206

![](/assets/img/50d4b878-fb5c-4eaf-9437-81147d599fcd.png)
![](/assets/img/4d226a7d-7ec7-4358-b468-958d9089451c.png)

# 八、前后指针
1. 237. 删除链表中的节点 https://leetcode.cn/problems/delete-node-in-a-linked-list/solution/ru-he-shan-chu-jie-dian-liu-fen-zhong-ga-x3kn/ 
2. 19. 删除链表的倒数第 N 个结点 https://leetcode.cn/problems/remove-nth-node-from-end-of-list/solution/ru-he-shan-chu-jie-dian-liu-fen-zhong-ga-xpfs/ 
3. 83. 删除排序链表中的重复元素 https://leetcode.cn/problems/remove-duplicates-from-sorted-list/solution/ru-he-qu-zhong-yi-ge-shi-pin-jiang-tou-p-98g7/ 
4. 82. 删除排序链表中的重复元素 II https://leetcode.cn/problems/remove-duplicates-from-sorted-list-ii/solution/ru-he-qu-zhong-yi-ge-shi-pin-jiang-tou-p-2ddn/

## 删除链表中的节点

复制下一个节点的值
指向下一个节点的Next
![](/assets/img/7e586925-3fdf-4400-9da5-f4204bb02e0d.png)
![](/assets/img/a64b03a3-b322-425a-9cc2-8768ebaad3bb.png)


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
![](/assets/img/2688d713-3fac-4a52-a9ae-6a3b3471f708.png)
![](/assets/img/94b21032-fe61-4cc8-b9a3-39f6b8416256.png)

## 删除排序链表中的重复元素
重复元素只保留一个
![](/assets/img/ba0a5515-d3dd-42fa-90ea-cfbbd6065cbe.png)
![](/assets/img/4224fd70-e406-4059-b88a-7d3129f5e723.png)
需要哨兵节点吗？
不需要，因为头节点可以保留下来的。
![](/assets/img/15962c7a-b666-49e5-8b40-867471452aa4.png)
## 删除排序链表中的重复元素 II
需要把重复的全部删除
![](/assets/img/83779443-d4ac-480f-a7ad-e0f51d53392f.png)
比较下一个节点和下下个节点的值
![](/assets/img/4a0e88dd-b87f-434e-9757-67db1d94b2c1.png)
![](/assets/img/6ede7337-2adb-4342-a274-9ba44021f866.png)

# 九、二叉树 递归
1. 104. 二叉树的最大深度 https://leetcode.cn/problems/maximum-depth-of-binary-tree/solution/kan-wan-zhe-ge-shi-pin-rang-ni-dui-di-gu-44uz/
![](/assets/img/3d6f3356-14bb-485c-b805-228b0eaf2198.png)

## 二叉树的最大深度
![](/assets/img/77f0172f-bb59-4dcb-b46c-31378950329b.png)


![](/assets/img/90cc9bcc-162e-44a0-ab08-8a1e9873f6dd.png)

![](/assets/img/6bf66e54-aaac-41ed-8bde-054c5794e61a.png)


写法2: 传递一个值，依次往下传递
![](/assets/img/18556244-73aa-43c4-b58e-892da4f89e3d.png)
数学归纳法
![](/assets/img/ff792dce-4281-4924-b91b-a98508954268.png)

图示
![](/assets/img/3ae3d5c0-efc7-4b59-86a9-0a6ef2129430.png)

# 十、二叉树 相同 对称 平衡 右视图
1. 100.相同的树 https://leetcode.cn/problems/same-tree/solution/ru-he-ling-huo-yun-yong-di-gui-lai-kan-s-empk/ 
2. 101. 对称二叉树 https://leetcode.cn/problems/symmetric-tree/solution/ru-he-ling-huo-yun-yong-di-gui-lai-kan-s-6dq5/ 
3. 110. 平衡二叉树 https://leetcode.cn/problems/balanced-binary-tree/solution/ru-he-ling-huo-yun-yong-di-gui-lai-kan-s-c3wj/ 
4. 199. 二叉树的右视图 https://leetcode.cn/problems/binary-tree-right-side-view/solution/ru-he-ling-huo-yun-yong-di-gui-lai-kan-s-r1nc/
## 相同的树
value相同 左子树相同，右子树相同
isSame(Left,Left) isSame(Right,Right)
![](/assets/img/623a06f2-d3e8-470a-9830-3bbc114352e3.png)
边界条件
一个为空 返回 

![](/assets/img/b7c003ab-2af3-46e3-b115-95db4c32fc19.png)
## 对称二叉树
![](/assets/img/fde0411a-8177-4d31-9c70-d5a4df227e82.png)

isSymmetric(Left,Right) isSymmetric(Right,Left)
![](/assets/img/8385e51d-77b4-46e7-9ba3-6b751f03d409.png)

## 平衡二叉树
![](/assets/img/962789d8-20c5-459b-9497-02706234e435.png)

-1 作为一个标记位，代表不平衡。
## 二叉树的右视图
![](/assets/img/f9a80524-06f3-4690-b665-9ea2bac66e74.png)

右视图，一层一个值。
![](/assets/img/7c729546-424d-4604-8062-b7ca26b7f094.png)如果深度等于当前ans长度，那么就记录这个值

# 十一、验证二叉搜索树
1. 98. 验证二叉搜索树 https://leetcode.cn/problems/validate-binary-search-tree/solution/qian-xu-zhong-xu-hou-xu-san-chong-fang-f-yxvh/
给你一个二叉树的根节点 `root` ，判断其是否是一个有效的二叉搜索树。
**有效** 二叉搜索树定义如下：
- 节点的左子树只包含 **严格小于** 当前节点的数。
- 节点的右子树只包含 **严格大于** 当前节点的数。
- 所有左子树和右子树自身必须也是二叉搜索树。
![](/assets/img/b7685b73-fc08-4877-a8d8-2f6df151dd25.png)


前序：先访问节点值。每一个节点值，都必须在一个范围内
![](/assets/img/51d8b703-a92e-47ff-9320-2d59caa73801.png)
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

https://leetcode.cn/problems/lowest-common-ancestor-of-deepest-leaves/solutions/2428724/liang-chong-di-gui-si-lu-pythonjavacgojs-xxnk/?envType=daily-question&envId=2025-08-27
1123.最深叶子节点的最近公共祖先/865。具有最深节点的子树

从上到下
```go
func lcaDeepestLeaves(root *TreeNode) *TreeNode {
    var ans *TreeNode
    maxDepth:=-1
    var dfs func(*TreeNode,int)int
    dfs = func(node *TreeNode,depth int)int{
        if node==nil{
            maxDepth = max(maxDepth,depth)
            return depth
        }
        left:=dfs(node.Left,depth+1)
        right:=dfs(node.Right,depth+1)
        if left==right&&left==maxDepth{
            ans = node
        }
        return max(left,right)
    }

    dfs(root,0)
    return ans
}
```
从下到上
```go
func dfs(node *TreeNode) (int, *TreeNode) {
    if node == nil {
        return 0, nil
    }
    leftHeight, leftLCA := dfs(node.Left)
    rightHeight, rightLCA := dfs(node.Right)
    if leftHeight > rightHeight { // 左子树更高
	        return leftHeight + 1, leftLCA
    }
    if leftHeight < rightHeight { // 右子树更高
        return rightHeight + 1, rightLCA
    }
    return leftHeight + 1, node // 一样高
}

func lcaDeepestLeaves(root *TreeNode) *TreeNode {
    _, lca := dfs(root)
    return lca
}
```
# 十三、二叉树层序遍历
使用一个队列，将未访问的节点入队列

# 十四、回溯（1）子集型
# 十五、回溯（2）组合型
# 十六、回溯（3）排序型
# 十七、动态规划
1. 198. 打家劫舍 https://leetcode.cn/problems/house-robber/solution/ru-he-xiang-chu-zhuang-tai-ding-yi-he-zh-1wt1



![](/assets/img/ac0456a8-2f9a-41fd-8077-44767bd63391.png)


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

![](/assets/img/a91c8456-b75b-4aeb-892e-2f34deca9692.png)


![](/assets/img/9d87888f-c73e-4784-a0c1-7d5577af7acb.png)

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

![](/assets/img/ffd1ae4a-226b-4418-95e2-5ab4794bba2c.png)
![](/assets/img/b7c5be45-68e7-4949-a143-d1ece4a71a10.png)

![](/assets/img/1f1e44c6-b2a1-496c-be95-1838f27ed940.png)
## 目标和
给你一个非负整数数组 `nums` 和一个整数 `target` 。
向数组中的每个整数前添加 `'+'` 或 `'-'` ，然后串联起所有整数，可以构造一个 **表达式** ：
- 例如，`nums = [2, 1]` ，可以在 `2` 之前添加 `'+'` ，在 `1` 之前添加 `'-'` ，然后串联起来得到表达式 `"+2-1"` 。
返回可以通过上述方法构造的、运算结果等于 `target` 的不同 **表达式** 的数目。

![](/assets/img/804585d2-bdae-4a15-8333-64171f8ba84d.png)![](/assets/img/635b22b1-e03b-4711-aae5-826e454ccf65.png)


改成递推
![](/assets/img/f44d107f-aa18-4ff0-ac12-91cec0cb939b.png)

![](/assets/img/b7e3e7a5-3b47-464a-8e26-bdd82d347645.png)

%2

![](/assets/img/34cf8c02-2765-4c33-94cf-f7d643483de9.png)

从左到右计算，前面的值会被覆盖，-》 修改为从右往左计算

![](/assets/img/91d9687e-7979-4fa5-ae21-9ca6ac8d0ee4.png)

![](/assets/img/e0b9dc28-90e5-4ebd-a3d6-d200d9fa6a9f.png)

Emmm， 脑子宕机了。
## 零钱兑换

![](/assets/img/6cc8f43e-119a-40fb-928f-868afed2b538.png)


动态规划（自低向上）
![](/assets/img/cb6ab4c2-4d29-47a5-a696-2a20f6d297c6.png)

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
![](/assets/img/fce62a30-0251-4745-999c-c4f54f15b0a8.png)

![](/assets/img/1709f19d-17fe-47c5-8a92-2181c96117ef.png)


https://www.bilibili.com/video/BV17iTvzcEXN/?spm_id_from=333.1007.top_right_bar_window_history.content.click&vd_source=61d0ab7742b04564fc1fbeb00533f72e



## 编辑距离

![](/assets/img/9abf9dae-d0e4-45e4-9f37-befca2b87f8a.png)
e去掉
r去掉
h改为r

s -> t
删除一个字符 -> 去掉s一个字符
插入一个字符 -> 去掉 t 一个字符
修改一个字符 -> s，t分别去掉一个
![](/assets/img/73a49f8b-445f-4e50-b070-143661b762f5.png)

# 二十、线性 DP
1. 300.最长递增子序列 https://leetcode.cn/problems/longest-increasing-subsequence/solution/jiao-ni-yi-bu-bu-si-kao-dpfu-o1-kong-jia-4zma/
## 最长递增子序列 LIS

![](/assets/img/7593f487-6d70-496b-b305-1412e7256006.png)

子集性 回溯
![](/assets/img/db125d82-5660-4ff7-84d9-7109a2daf7b0.png)

### 递归
![](/assets/img/6e61ddda-078e-47d4-8e24-32795491d229.png)
遍历每个值的为右端点，再向前遍历

### 递推
![](/assets/img/4f317bff-9ea6-4b61-97b5-bc3bdfbaf21c.png)

### 贪心+二分查找

![](/assets/img/3a90737b-8f97-4904-86c5-e2b77618d95d.png)

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


# 二十三、树形DP

1. 543.二叉树的直径 https://leetcode.cn/problems/diameter-of-binary-tree/solution/shi-pin-che-di-zhang-wo-zhi-jing-dpcong-taqma/ 
2. 124. 二叉树中的最大路径和 https://leetcode.cn/problems/binary-tree-maximum-path-sum/solution/shi-pin-che-di-zhang-wo-zhi-jing-dpcong-n9s91/ 
3. 2246. 相邻字符不同的最长路径 https://leetcode.cn/problems/longest-path-with-different-adjacent-characters/solution/by-endlesscheng-92fw/


## 543.二叉树的直径
树的直径：
![](/assets/img/47cb8cdd-7d10-45f1-85d7-453fb3ae7dcf.png)
![](Pasted%20image%2020250904145311.png)

```go
func diameterOfBinaryTree(root *TreeNode) (ans int) {
    var dfs func(*TreeNode) int
    dfs = func(node *TreeNode) int {
        if node == nil {
            return -1 // 对于叶子来说，链长就是 -1+1=0
        }
        lLen := dfs(node.Left) + 1  // 左子树最大链长+1
        rLen := dfs(node.Right) + 1 // 右子树最大链长+1
        ans = max(ans, lLen+rLen)   // 两条链拼成路径
        return max(lLen, rLen)      // 当前子树最大链长
    }
    dfs(root)
    return
}
```


## 124. 二叉树中的最大路径和
```go
func maxPathSum(root *TreeNode) int {
    ans := math.MinInt
    var dfs func(*TreeNode) int
    dfs = func(node *TreeNode) int {
        if node == nil {
            return 0 // 没有节点，和为 0
        }
        lVal := dfs(node.Left)  // 左子树最大链和
        rVal := dfs(node.Right) // 右子树最大链和
        ans = max(ans, lVal+rVal+node.Val) // 两条链拼成路径
        return max(max(lVal, rVal)+node.Val, 0) // 当前子树最大链和（注意这里和 0 取最大值了）
    }
    dfs(root)
    return ans
}
```
# 二十六、单调栈
1. 739.每日温度 https://leetcode.cn/problems/daily-temperatures/solution/shi-pin-jiang-qing-chu-wei-shi-yao-yao-y-k0ks/ 
2. 42. 接雨水 https://leetcode.cn/problems/trapping-rain-water/solution/zuo-liao-nbian-huan-bu-hui-yi-ge-shi-pin-ukwm/


## 每日温度
### 从右到左
![](/assets/img/4f80db90-955f-4f5f-a6e0-a54b97c31f3a.png)


6 ：7入栈
3：6入栈
2：5入栈
5:   栈顶不的复合条件，出栈，然后4入站（6的下标-5的下标）

![](/assets/img/4f74bc2a-cc2c-48ab-8a8b-d80bd7d3461a.png)

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
![](/assets/img/64b8df55-0eb8-4f8b-b671-e76540fad10e.png)
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

![](/assets/img/84810de8-73bb-4757-a9b6-b239b4659144.png)

![](/assets/img/082675de-a566-4211-b62f-e18c2df6f8bc.png)

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

![](/assets/img/cab16907-dcc0-424f-8891-f1d46d3d56cb.png)

![](/assets/img/6e909b9a-ff97-4373-9019-ad4e72b33a8c.png)


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
