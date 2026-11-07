# 教师参考（自动生成）

来自最终解析场景；修改对应源定义后重新生成。此目录不能作为学生静态资源发布。

## 1 · 训练营③：拐弯取宝

第 1 节 · revision 2 · [源定义](../level-definitions/1.json)

### 场景 0 · 主场景

- 避开尖刺和石墙
- 收集全部1颗宝石
- 唤醒石板 1
- 完成沿路任务，从楼梯离开

```python
hero.moveUp()
hero.moveRight(2)
hero.moveDown()
```

## 2 · 训练营④：四格长廊

第 1 节 · revision 4 · [源定义](../level-definitions/2.json)

### 场景 0 · 主场景

- 不撞石墙
- 点亮沿路全部3块石板
- 完成沿路任务，从楼梯离开

```python
for step in range(3):
    hero.moveRight()
    hero.wait()
hero.moveRight()
```

## 3 · 训练营⑤：绕开巡逻

第 1 节 · revision 2 · [源定义](../level-definitions/3.json)

### 场景 0 · 主场景

- 避开巡逻警戒圈
- 收集全部3颗宝石
- 唤醒石板 1
- 唤醒石板 2
- 完成沿路任务，从楼梯离开

```python
hero.moveUp(2)
hero.moveRight(3)
hero.moveDown(2)
hero.moveRight()
```

## 4 · 训练营①：走到门岗

第 1 节 · revision 1 · [源定义](../level-definitions/4.json)

### 场景 0 · 主场景

- 没有撞到守卫或石墙
- 抵达守卫面前

```python
hero.moveRight()
```

## 5 · 训练营②：报口令通行

第 1 节 · revision 2 · [源定义](../level-definitions/5.json)

### 场景 0 · 主场景

- 不闯关闭的门岗
- 获得守卫放行
- 抵达门岗
- 完成沿路任务，从楼梯离开

```python
hero.moveRight()
print("自己人")
hero.moveRight()
hero.moveRight()
```

## 6 · 训练营⑥：双门岗送信

第 1 节 · revision 2 · [源定义](../level-definitions/6.json)

### 场景 0 · 主场景

- 不闯关闭的门岗
- 收集全部2颗宝石
- 获得守卫放行
- 获得守卫放行
- 抵达门岗
- 抵达门岗
- 完成沿路任务，从楼梯离开

```python
hero.moveRight()
print("自己人")
hero.moveRight(3)
hero.moveUp()
hero.say("送信人")
hero.moveUp(2)
```

## 7 · 第2节 · 领取能量石，交给出口机关

第 2 节 · revision 5 · [源定义](../level-definitions/7.json)

### 场景 0 · 补给箱有 2 块能量石

- 不撞石墙
- 从补给箱领取物品
- 完成实际交付，开启出口
- 启动法阵并传送

```python
stones = hero.take("补给箱")
hero.moveRight(2)
hero.give("出口机关", stones)
```

### 场景 1 · 补给箱有 4 块能量石

- 不撞石墙
- 从补给箱领取物品
- 完成实际交付，开启出口
- 启动法阵并传送

```python
stones = hero.take("补给箱")
hero.moveRight(2)
hero.give("出口机关", stones)
```

## 8 · 第2节 · 修好机关，送出剩余材料

第 2 节 · revision 5 · [源定义](../level-definitions/8.json)

### 场景 0 · 领取 5 块，维修用2块

- 不撞石墙
- 从补给箱领取物品
- 完成实际交付，开启出口
- 启动法阵并传送

```python
total = hero.take("补给箱")
hero.moveRight()
hero.give("维修机关", 2)
remaining = total - 2
hero.moveRight()
hero.give("出口机关", remaining)
```

### 场景 1 · 领取 6 块，维修用2块

- 不撞石墙
- 从补给箱领取物品
- 完成实际交付，开启出口
- 启动法阵并传送

```python
total = hero.take("补给箱")
hero.moveRight()
hero.give("维修机关", 2)
remaining = total - 2
hero.moveRight()
hero.give("出口机关", remaining)
```

## 9 · 第2节 · 补给站：开门才取宝石

第 2 节 · revision 4 · [源定义](../level-definitions/9.json)

### 场景 0 · 补给站开放，有宝石

- 不闯关闭的门岗
- 收集全部1颗宝石
- 完成补给后从下方法阵撤离

```python
if pathOpen("right"):
    hero.moveRight()
    hero.moveLeft()
hero.moveDown()
```

### 场景 1 · 补给站关闭，直接撤离

- 不闯关闭的门岗
- 完成补给后从下方法阵撤离

```python
if pathOpen("right"):
    hero.moveRight()
    hero.moveLeft()
hero.moveDown()
```

## 10 · 第2节 · 两条路选一条

第 2 节 · revision 4 · [源定义](../level-definitions/10.json)

### 场景 0 · 左路开放

- 不闯关闭的门岗
- 收集全部1颗宝石
- 启动法阵并传送

```python
if pathOpen("left"):
    hero.moveLeft()
else:
    hero.moveRight()
```

### 场景 1 · 右路开放

- 不闯关闭的门岗
- 收集全部1颗宝石
- 启动法阵并传送

```python
if pathOpen("left"):
    hero.moveLeft()
else:
    hero.moveRight()
```

## 11 · 第2节 · 门开且安全才走【选做】

第 2 节 · revision 4 · [源定义](../level-definitions/11.json)

### 场景 0 · 门开 / 无尖刺

- 不撞石墙
- 收集全部1颗宝石
- 启动法阵并传送

```python
if pathOpen("right") and nextTileSafe():
    hero.moveRight()
else:
    hero.moveDown()
```

### 场景 1 · 门开 / 有尖刺

- 避开尖刺和石墙
- 收集全部1颗宝石
- 启动法阵并传送

```python
if pathOpen("right") and nextTileSafe():
    hero.moveRight()
else:
    hero.moveDown()
```

### 场景 2 · 门关 / 无尖刺

- 不闯关闭的门岗
- 收集全部1颗宝石
- 启动法阵并传送

```python
if pathOpen("right") and nextTileSafe():
    hero.moveRight()
else:
    hero.moveDown()
```

## 12 · 第2节 · 用手里的金币支付通行费【选做】

第 2 节 · revision 5 · [源定义](../level-definitions/12.json)

### 场景 0 · 领取 5 枚金币

- 不闯关闭的门岗
- 从补给箱领取物品
- 完成实际交付，开启出口
- 启动法阵并传送

```python
coins = hero.take("补给箱")
if coins >= 4:
    hero.moveUp()
    hero.give("守卫", 4)
elif coins >= 2:
    hero.moveRight()
    hero.give("守卫", 2)
else:
    hero.moveDown()
    hero.give("守卫", 1)
```

### 场景 1 · 领取 4 枚金币

- 不闯关闭的门岗
- 从补给箱领取物品
- 完成实际交付，开启出口
- 启动法阵并传送

```python
coins = hero.take("补给箱")
if coins >= 4:
    hero.moveUp()
    hero.give("守卫", 4)
elif coins >= 2:
    hero.moveRight()
    hero.give("守卫", 2)
else:
    hero.moveDown()
    hero.give("守卫", 1)
```

### 场景 2 · 领取 2 枚金币

- 不闯关闭的门岗
- 从补给箱领取物品
- 完成实际交付，开启出口
- 启动法阵并传送

```python
coins = hero.take("补给箱")
if coins >= 4:
    hero.moveUp()
    hero.give("守卫", 4)
elif coins >= 2:
    hero.moveRight()
    hero.give("守卫", 2)
else:
    hero.moveDown()
    hero.give("守卫", 1)
```

### 场景 3 · 领取 1 枚金币

- 不闯关闭的门岗
- 从补给箱领取物品
- 完成实际交付，开启出口
- 启动法阵并传送

```python
coins = hero.take("补给箱")
if coins >= 4:
    hero.moveUp()
    hero.give("守卫", 4)
elif coins >= 2:
    hero.moveRight()
    hero.give("守卫", 2)
else:
    hero.moveDown()
    hero.give("守卫", 1)
```

## 13 · 第3节 · 点亮三间符文室

第 3 节 · revision 4 · [源定义](../level-definitions/13.json)

### 场景 0 · 主场景

- 不撞石墙
- 点亮沿路全部3块石板
- 启动法阵并传送

```python
hero.moveRight()
for room in range(3):
    hero.moveUp(2)
    hero.wait()
    hero.moveDown(2)
    hero.moveRight(2)
```

## 14 · 第3节 · 接通三个继电开关

第 3 节 · revision 4 · [源定义](../level-definitions/14.json)

### 场景 0 · 主场景

- 不撞石墙
- 按顺序点亮指定开关
- 启动法阵并传送

```python
for number in range(1, 4):
    hero.moveRight()
    hero.press(number)
```

## 15 · 第3节 · 绕过短路开关【选做】

第 3 节 · revision 4 · [源定义](../level-definitions/15.json)

### 场景 0 · 主场景

- 不误按接地板，不撞墙
- 按顺序点亮指定开关
- 启动法阵并传送

```python
for number in range(2, 7, 2):
    hero.moveRight(2)
    hero.press(number)
```

## 16 · 第3节 · 每座炉座装一块能量石

第 3 节 · revision 5 · [源定义](../level-definitions/16.json)

### 场景 0 · 2 块能量石，2 座炉座

- 不撞石墙
- 从补给箱领取物品
- 完成实际交付，开启出口
- 启动法阵并传送

```python
count = hero.take("补给箱")
for i in range(count):
    hero.moveRight()
    hero.give("炉座", 1)
```

### 场景 1 · 4 块能量石，4 座炉座

- 不撞石墙
- 从补给箱领取物品
- 完成实际交付，开启出口
- 启动法阵并传送

```python
count = hero.take("补给箱")
for i in range(count):
    hero.moveRight()
    hero.give("炉座", 1)
```

### 场景 2 · 5 块能量石，5 座炉座

- 不撞石墙
- 从补给箱领取物品
- 完成实际交付，开启出口
- 启动法阵并传送

```python
count = hero.take("补给箱")
for i in range(count):
    hero.moveRight()
    hero.give("炉座", 1)
```

## 17 · 第4节 · 把最后一块材料送出去

第 4 节 · revision 5 · [源定义](../level-definitions/17.json)

### 场景 0 · 主场景

- 不撞石墙
- 从补给箱领取物品
- 完成实际交付，开启出口
- 在终点石板停下

```python
remaining = hero.take("补给箱")
while remaining > 0:
    hero.moveRight()
    hero.give("炉座", 1)
    remaining -= 1
    print(remaining)
```

## 18 · 第4节 · 别向空箱索要材料

第 4 节 · revision 5 · [源定义](../level-definitions/18.json)

### 场景 0 · 箱里有3块，装完就停

- 不撞石墙
- 从补给箱领取物品
- 完成实际交付，开启出口
- 在终点石板停下

```python
remaining = hero.take("补给箱")
while remaining > 0:
    hero.moveRight()
    hero.give("炉座", 1)
    remaining -= 1
    print(remaining)
```

### 场景 1 · 箱子已空，不用装填

- 不撞石墙
- 从补给箱领取物品
- 完成实际交付，开启出口
- 在终点石板停下

```python
remaining = hero.take("补给箱")
while remaining > 0:
    hero.moveRight()
    hero.give("炉座", 1)
    remaining -= 1
    print(remaining)
```

## 19 · 第4节 · 沿途充能，找到信标

第 4 节 · revision 2 · [源定义](../level-definitions/19.json)

### 场景 0 · 信标在前方2格

- 不撞石墙
- 点亮沿路全部2块石板
- 到达信标并传送

```python
while not hero.atBeacon():
    hero.wait()
    hero.moveRight()
```

### 场景 1 · 信标在前方4格

- 不撞石墙
- 点亮沿路全部4块石板
- 到达信标并传送

```python
while not hero.atBeacon():
    hero.wait()
    hero.moveRight()
```

### 场景 2 · 信标就在起点

- 不撞石墙
- 到达信标并传送

```python
while not hero.atBeacon():
    hero.wait()
    hero.moveRight()
```

## 20 · 第4节 · 等巡逻走开再前进【选做】

第 4 节 · revision 2 · [源定义](../level-definitions/20.json)

### 场景 0 · 巡逻场景1

- 避开巡逻警戒圈
- 到达信标并传送

```python
while not hero.atBeacon():
    if nextTileSafe():
        hero.moveRight()
    else:
        hero.wait()
```

### 场景 1 · 巡逻场景2

- 避开巡逻警戒圈
- 到达信标并传送

```python
while not hero.atBeacon():
    if nextTileSafe():
        hero.moveRight()
    else:
        hero.wait()
```

## 21 · 第4节 · 过门岗，修复信标路

第 4 节 · revision 3 · [源定义](../level-definitions/21.json)

### 场景 0 · 上行 2 格

- 不闯关闭的门岗
- 点亮沿路全部2块石板
- 获得守卫放行
- 抵达门岗
- 到达信标并传送

```python
hero.moveRight()
print("自己人")
hero.moveRight(2)
while not hero.atBeacon():
    hero.moveUp()
    hero.wait()
```

### 场景 1 · 上行 3 格

- 不闯关闭的门岗
- 点亮沿路全部3块石板
- 获得守卫放行
- 抵达门岗
- 到达信标并传送

```python
hero.moveRight()
print("自己人")
hero.moveRight(2)
while not hero.atBeacon():
    hero.moveUp()
    hero.wait()
```

## 22 · 样关①：把追兵引进陷阱

第 5 节 · revision 1 · [源定义](../level-definitions/22.json)

### 场景 0 · 主场景

- 英雄存活
- 让追兵踩中尖刺
- 完成沿路任务，从楼梯离开

```python
hero.moveUp(2)
hero.moveDown(2)
hero.moveRight(4)
```

## 23 · 样关②：救出弓箭手

第 5 节 · revision 1 · [源定义](../level-definitions/23.json)

### 场景 0 · 主场景

- 英雄和弓手存活
- 击破牢门，救出弓手
- 击败重甲守卫
- 完成沿路任务，从楼梯离开

```python
hero.moveRight()
hero.moveUp()
hero.attack("牢门")
hero.attack("牢门")
hero.moveDown()
hero.moveRight(2)
hero.attack("重甲守卫")
hero.attack("重甲守卫")
hero.attack("重甲守卫")
hero.attack("重甲守卫")
hero.moveRight(3)
```

## 24 · 样关③：启动三座信号台

第 5 节 · revision 2 · [源定义](../level-definitions/24.json)

### 场景 0 · 主场景

- 不撞石墙
- 点亮信号台 1
- 点亮信号台 2
- 点亮信号台 3
- 完成沿路任务，从楼梯离开

```python
hero.moveRight()
for i in range(3):
    hero.moveUp(2)
    print("点火")
    hero.moveDown(2)
    hero.moveRight(2)
```

## 25 · 样关④：守住营地入口

第 5 节 · revision 2 · [源定义](../level-definitions/25.json)

### 场景 0 · 三名敌人，分批到来

- 英雄和营火存活
- 保护营火，击败全部敌人
- 击退全部增援，守住营地

```python
while not isVictory():
    enemy = hero.findNearestEnemy()
    if enemy:
        hero.attack(enemy)
```

### 场景 1 · 四名敌人，间隔变短

- 英雄和营火存活
- 保护营火，击败全部敌人
- 击退全部增援，守住营地

```python
while not isVictory():
    enemy = hero.findNearestEnemy()
    if enemy:
        hero.attack(enemy)
```

## 26 · 攻击教学：击破第一扇牢门

第 1 节 · revision 1 · [源定义](../level-definitions/26.json)

### 场景 0 · 主场景

- 不撞石墙
- 击破牢门（40 → 0）
- 完成沿路任务，从楼梯离开

```python
hero.attack("牢门")
hero.attack("牢门")
hero.moveRight(2)
```

## 27 · 救援挑战：让弓箭手加入

第 1 节 · revision 1 · [源定义](../level-definitions/27.json)

### 场景 0 · 主场景

- 英雄和弓手存活
- 击破牢门，救出弓手
- 击败重甲守卫
- 完成沿路任务，从楼梯离开

```python
hero.moveRight()
hero.moveUp()
hero.attack("牢门")
hero.attack("牢门")
hero.moveDown()
hero.moveRight(2)
hero.attack("重甲守卫")
hero.attack("重甲守卫")
hero.attack("重甲守卫")
hero.attack("重甲守卫")
hero.moveRight(3)
```

## 28 · 信号教学：走近后再点火

第 3 节 · revision 1 · [源定义](../level-definitions/28.json)

### 场景 0 · 主场景

- 不撞石墙
- 点亮信号台
- 完成沿路任务，从楼梯离开

```python
hero.moveRight()
hero.moveUp(2)
print("点火")
hero.moveDown(2)
hero.moveRight(2)
```

## 29 · for挑战：点亮三座信号台

第 3 节 · revision 2 · [源定义](../level-definitions/29.json)

### 场景 0 · 主场景

- 不撞石墙
- 点亮信号台 1
- 点亮信号台 2
- 点亮信号台 3
- 完成沿路任务，从楼梯离开

```python
hero.moveRight()
for i in range(3):
    hero.moveUp(2)
    print("点火")
    hero.moveDown(2)
    hero.moveRight(2)
```

## 30 · 观察教学：找到敌人再攻击

第 2 节 · revision 2 · [源定义](../level-definitions/30.json)

### 场景 0 · 遇到落单斥候

- 不撞石墙
- 完成沿路任务，从楼梯离开

```python
hero.moveRight()
enemy = hero.findNearestEnemy()
hero.attack(enemy)
hero.moveRight(2)
```

### 场景 1 · 遇到门廊哨兵

- 不撞石墙
- 完成沿路任务，从楼梯离开

```python
hero.moveRight()
enemy = hero.findNearestEnemy()
hero.attack(enemy)
hero.moveRight(2)
```

## 31 · 判断教学：没有敌人就不攻击

第 2 节 · revision 2 · [源定义](../level-definitions/31.json)

### 场景 0 · 通道里有斥候

- 不撞石墙
- 完成沿路任务，从楼梯离开

```python
hero.moveRight()
enemy = hero.findNearestEnemy()
if enemy:
    hero.attack(enemy)
hero.moveRight(2)
```

### 场景 1 · 空通道，没有敌人

- 不撞石墙
- 完成沿路任务，从楼梯离开

```python
hero.moveRight()
enemy = hero.findNearestEnemy()
if enemy:
    hero.attack(enemy)
hero.moveRight(2)
```

### 场景 2 · 换岗了，遇到另一名哨兵

- 不撞石墙
- 完成沿路任务，从楼梯离开

```python
hero.moveRight()
enemy = hero.findNearestEnemy()
if enemy:
    hero.attack(enemy)
hero.moveRight(2)
```

## 32 · 守营准备：等待与胜利条件

第 4 节 · revision 2 · [源定义](../level-definitions/32.json)

### 场景 0 · 主场景

- 英雄和营火存活
- 保护营火，击败全部敌人
- 击退全部增援，守住营地

```python
print(isVictory())
hero.wait(1)
enemy = hero.findNearestEnemy()
if enemy:
    hero.attack(enemy)
```

## 33 · while挑战：守住分批增援

第 4 节 · revision 2 · [源定义](../level-definitions/33.json)

### 场景 0 · 三名敌人，分批到来

- 英雄和营火存活
- 保护营火，击败全部敌人
- 击退全部增援，守住营地

```python
while not isVictory():
    enemy = hero.findNearestEnemy()
    if enemy:
        hero.attack(enemy)
```

### 场景 1 · 四名敌人，间隔变短

- 英雄和营火存活
- 保护营火，击败全部敌人
- 击退全部增援，守住营地

```python
while not isVictory():
    enemy = hero.findNearestEnemy()
    if enemy:
        hero.attack(enemy)
```
