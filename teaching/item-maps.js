// Supply objects have real quantities and destinations; scene changes vary the shipment.
const supply = count => ({ name: '补给箱', at: [12, 24], approach: [12, 12], count })
const receiver = (name, x, amount) => ({ name, at: [x, 24], approach: [x, 12], amount, kind: 'socket' })
const corridor = length => ({ size: [Math.max(60, 24 + length * 12), 48], start: [12, 12], exit: [12 + length * 12, 12], corridors: [[12, 12, 20 + length * 12, 12], [12, 12, 12, 24]], checkpoints: [], gems: [], hazards: [], gates: [], torches: [[6, 32]], labels: [], inscriptions: [], exitStyle: 'portal' })
const inventory = (count, receivers) => ({ item: '能量石', unit: '块', supply: supply(count), receivers })
const route = (count, receivers) => ({ ...corridor((receivers.at(-1)?.approach[0] || 12) / 12 - 1), inventory: inventory(count, receivers), corridors: [[12, 12, (receivers.at(-1)?.approach[0] || 12) + 8, 12], ...[12, ...receivers.map(r => r.at[0])].map(x => [x, 12, x, 24])] })
const furnaces = count => Array.from({ length: count }, (_, i) => receiver('炉座', 24 + i * 12, 1))
module.exports = function applyItems (designs) {
  const get = n => designs.find(d => d.index === n)
  for (const index of [7, 8, 12, 16, 17, 18]) Object.assign(get(index), { revision: 4, visualTask: true, allowCodeChanges: false, apis: ['take', 'give'], powerCircuit: false })
  Object.assign(get(7), {
    name: '第2节 · 领取能量石，交给出口机关',
    knowledge: '变量：保存实际领取的数量',
    quest: '箱子里有一批能量石。全部取出，送给右边的出口机关。',
    description: '你已经站在补给箱前。用 stones = hero.take("补给箱") 领取并保存数量。向右走两格，再用 hero.give("出口机关", stones) 交出这批物品。箱子打开、背包增加；交付后机关亮起、背包清空，法阵才会启动。两批不同数量的物资使用同一份代码。',
    starter: '# 打开补给箱，把领取数量保存到 stones。\n# 右走两格，再把 stones 块交给出口机关。\n',
    scenarios: [2, 4].map(n => ({ title: `补给箱有 ${n} 块能量石`, ...route(n, [receiver('出口机关', 36, n)]), solution: 'stones = hero.take("补给箱")\nhero.moveRight(2)\nhero.give("出口机关", stones)\n' })),
    hints: ['take 返回的是本次真正取出的数量，不是距离。重复调用不会再得到一批。', '交付时把变量 stones 放在第二个参数位置，不加引号。'],
  })
  Object.assign(get(8), {
    name: '第2节 · 修好机关，送出剩余材料',
    knowledge: '减法：总数减去已经交出的数量',
    quest: '先给维修机关2块能量石，再把余下的全部交给出口机关。',
    description: '领取补给箱里的全部能量石，保存为 total。向右走一格，给“维修机关”2块；用 remaining = total - 2 算出剩余数量。再右走一格，把 remaining 块交给“出口机关”。两处都收到正确数量才会开启法阵。换一批物资后不改代码。',
    starter: 'total = hero.take("补给箱")\n# 先右走一格，交出2块维修材料。\n# 算出剩余数量，再送给下一格旁的出口机关。\n',
    scenarios: [5, 6].map(n => ({ title: `领取 ${n} 块，维修用2块`, ...route(n, [receiver('维修机关', 24, 2), receiver('出口机关', 36, n - 2)]), solution: 'total = hero.take("补给箱")\nhero.moveRight()\nhero.give("维修机关", 2)\nremaining = total - 2\nhero.moveRight()\nhero.give("出口机关", remaining)\n' })),
    hints: ['领取的总数不会随背包消耗自动变化。用减法计算剩余数量。', '画面中的背包会随实际交付减少，可以和变量计算结果核对。'],
  })
  Object.assign(get(16), {
    name: '第3节 · 每座炉座装一块能量石',
    knowledge: 'for：用领取数量决定重复次数',
    quest: '把领取的能量石分给沿路炉座，每座一块。全部装好才能开启出口。',
    description: '先用 count = hero.take("补给箱") 领取整批物资。用 for i in range(count)，每轮右走一格，再用 hero.give("炉座", 1) 装一块。只走过炉座不会点亮它。箱子分别装2、4、5块，同一份代码要完成全部场景。',
    starter: 'count = hero.take("补给箱")\n# 每轮：走到下一座炉座前，装入1块能量石。\n',
    scenarios: [2, 4, 5].map(n => ({ title: `${n} 块能量石，${n} 座炉座`, ...route(n, furnaces(n)), solution: 'count = hero.take("补给箱")\nfor i in range(count):\n    hero.moveRight()\n    hero.give("炉座", 1)\n' })),
    hints: ['range 的次数来自 count，不能固定写成某一批的数量。', '移动和装填都放在循环内。背包清空时，所有炉座应该都亮了。'],
  })
  const whileCode = 'remaining = hero.take("补给箱")\nwhile remaining > 0:\n    hero.moveRight()\n    hero.give("炉座", 1)\n    remaining -= 1\n    print(remaining)\n'
  Object.assign(get(17), {
    ...route(3, furnaces(3)),
    name: '第4节 · 边装填，边记录剩余材料',
    knowledge: 'while：消耗物品并更新剩余数量',
    quest: '领取三块能量石，每座炉座装一块，报出还剩多少。',
    description: '用 remaining = hero.take("补给箱") 领取能量石。只要 remaining > 0，就右走一格，给炉座1块，把 remaining 减1，再显示 remaining。背包和输出应同时从3变成2、1、0；全部炉座点亮后出口启动。',
    starter: 'remaining = hero.take("补给箱")\n# 还有材料就继续：右走、装1块、减1、显示剩余数量。\n',
    solution: whileCode,
    expectedSpeech: ['2', '1', '0'],
    exitStyle: 'marker',
    hints: ['give 会减少实际背包数量，但不会修改你定义的 remaining。', '每装一块，就把 remaining 减1，然后再输出。'],
  })
  Object.assign(get(18), {
    name: '第4节 · 修好不断索要材料的程序',
    knowledge: 'while 排错：更新变量与零次执行',
    quest: '修复装填程序，让它在能量石用完后停止。空箱时不需要移动或装填。',
    description: '已有程序忘记减少 remaining。先运行，观察背包已空而程序仍想继续的结果。在交付后、输出前补上变量更新。同一份程序还要处理空箱：领取返回0，循环一次也不执行。必须真正领取，不能删掉整段代码冒充完成。',
    starter: 'remaining = hero.take("补给箱")\nwhile remaining > 0:\n    hero.moveRight()\n    hero.give("炉座", 1)\n    print(remaining)\n',
    scenarios: [3, 0].map(n => ({ title: n ? '箱里有3块，装完就停' : '箱子已空，不用装填', ...route(n, furnaces(n)), exitStyle: 'marker', expectedSpeech: n ? ['2', '1', '0'] : [], solution: whileCode })),
    hints: ['背包减少，不等于 remaining 会自动减少。检查循环内更新变量的那一行。', '领取空箱得到0；while 条件第一次就为假。'],
  })
  // Coins make the numeric threshold a payment, with an actual recipient and deduction.
  const d = get(12)
  Object.assign(d, {
    name: '第2节 · 用手里的金币支付通行费【选做】',
    knowledge: 'if / elif / else：按金币数量选择通道',
    quest: '领到金币后选择通道：有4枚走上路，有2枚走右路，只有1枚走下路。到守卫前付费离开。',
    description: '补给箱在左侧，英雄已站在领取位置。用 coins = hero.take("补给箱") 领取金币。4枚及以上走上路并交4枚；否则，2枚及以上走右路并交2枚；否则走下路交1枚。每条路走一格，再用 hero.give("守卫", 金额) 付费。只走到法阵不付费不能过关。四种物资场景使用同一份代码。',
    starter: 'coins = hero.take("补给箱")\n# 从4枚这一档开始判断；走到守卫前，交出对应通行费。\n',
    hints: ['先比较 coins >= 4，再比较 coins >= 2。', '每个分支里都有移动和付费两步。金币不足时不能强行支付。'],
    scenarios: [5, 4, 2, 1].map(n => {
      const direction = n >= 4 ? 'up' : n >= 2 ? 'right' : 'down'
      const at = direction === 'up' ? [36, 48] : direction === 'right' ? [60, 24] : [36, 0]
      const approach = direction === 'up' ? [36, 36] : direction === 'right' ? [48, 24] : [36, 12]
      return { ...d.scenarios[n >= 4 ? 0 : n >= 2 ? 2 : 3], title: `领取 ${n} 枚金币`, exit: approach, gems: [], inscriptions: [{ text: '4 枚', x: 36, y: 43 }, { text: '2 枚', x: 55, y: 29 }, { text: '1 枚', x: 36, y: 5 }], sensor: {}, inventory: { item: '金币', unit: '枚', supply: { name: '补给箱', at: [24, 24], approach: [36, 24], count: n }, receivers: [{ name: '守卫', at, approach, amount: n >= 4 ? 4 : n >= 2 ? 2 : 1, kind: 'npc' }] }, solution: 'coins = hero.take("补给箱")\nif coins >= 4:\n    hero.moveUp()\n    hero.give("守卫", 4)\nelif coins >= 2:\n    hero.moveRight()\n    hero.give("守卫", 2)\nelse:\n    hero.moveDown()\n    hero.give("守卫", 1)\n' }
    }),
  })
}
