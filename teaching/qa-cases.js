// Teacher QA programs: run only against the isolated classroom service.
const compiled = require('./level-catalog').compileCatalog()
const samples = { 1: 'hero.moveUp()\nhero.moveRight(2)\nhero.moveDown()', 2: 'for step in range(3):\n    hero.moveRight()\n    hero.wait()\nhero.moveRight()', 3: 'hero.moveUp(2)\nhero.moveRight(3)\nhero.moveDown(2)\nhero.moveRight()' }
const bad = {
  22: [[0, 'hero.moveRight(4)', '未引诱追兵，直接到出口'], [0, 'hero.moveUp(2)\nhero.moveRight(2)', '英雄自己踩中尖刺']],
  23: [[0, 'hero.moveRight()\nhero.moveUp(3)', '硬闯未破牢门'], [0, 'hero.attack("不存在的门")', '对象名字错误']],
  24: [[0, 'print("点火")\nhero.moveRight(7)', '在远处喊口令'], [0, 'hero.moveRight()\nhero.moveUp(2)\nprint("出发")', '台前口令错误']],
  25: [[0, 'hero.attack(hero.findNearestEnemy())', '尚无敌人，缺少if判断'], [1, 'hero.wait()\nenemy = hero.findNearestEnemy()\nwhile True:\n    hero.attack(enemy)', '循环外只找一次，目标倒下仍反复攻击']],
  1: [[0, 'hero.moveRight()', '近路尖刺'], [0, 'hero.moveUp()', '只踩石板，未取宝到出口']],
  2: [[0, 'hero.moveRight(4)', '走过石板但没有充满'], [0, 'hero.moveRight()\nhero.wait(3)\nhero.moveRight(3)', '只在第一块等3秒，另外两块没有充能'], [0, 'hero.wait(3)\nhero.moveRight(4)', '在石板外等待']],
  3: [[0, 'hero.moveRight(3)', '走巡逻通道'], [0, 'hero.moveUp(2)\nhero.moveRight(3)', '漏宝石和出口']],
  4: [[0, 'pass', '没有到岗'], [0, 'hero.moveRight(2)', '越过守卫前站位']],
  5: [[0, 'print("自己人")\nhero.moveRight(3)', '远处喊口令'], [0, 'hero.moveRight()\nprint("出发")\nhero.moveRight(2)', '错误口令硬闯']],
  6: [[0, 'hero.moveRight()\nprint("自己人")\nhero.moveRight(3)\nhero.moveUp(3)', '未通过第二门岗'], [0, 'hero.moveRight()\nprint("自己人")\nhero.moveRight(3)\nhero.moveUp()\nprint("自己人")\nhero.moveUp(2)', '第二门岗用错口令']],
  7: [[0, 'steps = 1\nhero.moveRight(steps)', '少一格'], [0, 'steps = 3\nhero.moveRight(steps)', '多一格']],
  8: [[0, 'total = 5\npassed = 2\nremaining = total + passed\nhero.moveRight(remaining)', '剩余距离加错'], [0, 'remaining = 2\nhero.moveRight(remaining)', '误把已走距离当剩余']],
  9: [[1, 'if False:\n    hero.moveRight()\nhero.moveDown()', '假判断跳过补给检查'], [0, 'if pathOpen("right"):\n    hero.moveRight()\nhero.moveDown()', '取物后未回到岔口'], [1, 'hero.moveRight()', '封路仍前进'], [0, 'if False:\n    hero.moveRight()', '放行却不走']],
  10: [[1, 'hero.moveLeft()', '始终走左路'], [0, 'hero.moveLeft()\nhero.moveRight()', '两边都执行回到起点']],
  11: [[2, 'if pathOpen("right") or nextTileSafe():\n    hero.moveRight()\nelse:\n    hero.moveDown()', '把and写成or'], [1, 'if pathOpen("right"):\n    hero.moveRight()\nelse:\n    hero.moveDown()', '忽略尖刺']],
  12: [[0, 'score = hero.readSignal()\nif score >= 60:\n    hero.moveRight()\nelif score >= 80:\n    hero.moveUp()\nelse:\n    hero.moveDown()', '低门槛先判断'], [1, 'score = hero.readSignal()\nif score > 80:\n    hero.moveUp()\nelif score >= 60:\n    hero.moveRight()\nelse:\n    hero.moveDown()', '漏80边界']],
  13: [[0, 'for step in range(2):\n    hero.moveRight()', '少一次'], [0, 'for step in range(4):\n    hero.moveRight()', '多一次']],
  14: [[0, 'for number in range(1, 3):\n    hero.moveRight()\n    hero.press(number)', '漏3号'], [0, 'for number in range(1, 4):\n    hero.press(number)\n    hero.moveRight()', '先按后走']],
  15: [[0, 'for number in range(2, 6, 2):\n    hero.moveRight(2)\n    hero.press(number)', '漏6号'], [0, 'for number in range(2, 7, 2):\n    hero.moveRight()\n    hero.press(number)', '步长与走的距离不对应']],
  16: [[0, 'for step in range(5):\n    hero.moveRight()', '对短廊写死5次'], [0, 'length = hero.pathLength()\nfor step in range(length - 1):\n    hero.moveRight()', '少一次']],
  17: [[0, 'remaining = 3\nwhile remaining > 0:\n    hero.moveRight()\n    print(remaining)', '没有更新'], [0, 'remaining = 3\nwhile remaining > 0:\n    hero.moveRight()\n    print(remaining)\n    remaining -= 1', '在更新前报告旧值']],
  18: [[1, 'remaining = hero.pathLength()\nhero.moveRight()\nwhile remaining > 0:\n    hero.moveRight()\n    remaining -= 1\n    print(remaining)', '0格仍先走一步'], [0, 'remaining = hero.pathLength()\nwhile remaining > 0:\n    hero.moveRight()\n    print(remaining)', '缺少更新']],
  19: [[2, 'hero.moveRight()\nwhile not hero.atBeacon():\n    hero.moveRight()', '起点信标仍先走'], [0, 'arrived = hero.atBeacon()\nwhile not arrived:\n    hero.moveRight()', '循环外只检测一次']],
  20: [[1, 'while not hero.atBeacon():\n    hero.moveRight()', '没有等巡逻'], [1, 'safe = nextTileSafe()\nwhile not hero.atBeacon():\n    if safe:\n        hero.moveRight()\n    else:\n        hero.wait()', '不重新检测路况']],
  21: [[0, 'print("自己人")\nhero.moveRight(3)', '起点说口令'], [1, 'hero.moveRight()\nprint("自己人")\nfor step in range(2):\n    hero.moveRight()\nremaining = 2\nwhile remaining > 0:\n    hero.moveUp()\n    remaining -= 1', '把未知上行距离写死为2']],
}
Object.assign(bad, {
  7: [[0, 'stones = hero.take("补给箱")\nhero.moveRight(2)', '领取了但未实际交付'], [0, 'hero.take("补给箱")\nhero.take("补给箱")', '重复领取同一箱']],
  8: [[0, 'total = hero.take("补给箱")\nhero.moveRight()\nhero.give("维修机关", 2)\nremaining = total + 2\nhero.moveRight()\nhero.give("出口机关", remaining)', '把已交出的2块加回去'], [0, 'total = hero.take("补给箱")\nhero.give("维修机关", 2)', '还没走到维修机关前']],
  12: [[2, 'coins = hero.take("补给箱")\nif coins >= 2:\n    hero.moveUp()\n    hero.give("守卫", 4)\nelse:\n    hero.moveDown()', '拿2枚却试图走4枚的路线']],
  16: [[0, 'count = hero.take("补给箱")\nfor i in range(count):\n    hero.moveRight()', '只走过去，不装填'], [0, 'count = hero.take("补给箱")\nfor i in range(count):\n    hero.give("炉座", 1)\n    hero.moveRight()', '先装填后移动，位置错误']],
  17: [[0, 'remaining = hero.take("补给箱")\nwhile remaining > 0:\n    hero.moveRight()\n    hero.give("炉座", 1)\n    print(remaining)', '实际物品减少，但变量没有更新']],
  18: [[1, 'remaining = hero.take("补给箱")\nhero.moveRight()\nwhile remaining > 0:\n    hero.give("炉座", 1)\n    remaining -= 1', '空箱仍先走了一步']],
})
module.exports = compiled.map(({ design: d, slug, references }) => ({ index: d.index, section: d.section, slug, references: references.map(reference => ({ ...reference, code: reference.code || samples[d.index] })), mistakes: (bad[d.index] || []).map(([scene, code, reason]) => ({ scene, code, reason })) }))
