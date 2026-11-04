// Teacher QA programs: run only against the isolated classroom service.
const designs = require('./map-designs')
const samples = { 1: 'hero.moveUp()\nhero.moveRight(2)\nhero.moveDown()', 2: 'hero.moveRight(4)', 3: 'hero.moveUp(2)\nhero.moveRight(3)\nhero.moveDown(2)\nhero.moveRight()' }
const bad = {
  1: [[0, 'hero.moveRight()', '近路尖刺'], [0, 'hero.moveUp()', '只踩石板，未取宝到出口']],
  2: [[0, 'hero.moveRight(3)', '停在第三格'], [0, 'hero.moveRight(5)', '超过出口']],
  3: [[0, 'hero.moveRight(3)', '走巡逻通道'], [0, 'hero.moveUp(2)\nhero.moveRight(3)', '漏宝石和出口']],
  4: [[0, 'pass', '没有到岗'], [0, 'hero.moveRight(2)', '越过守卫前站位']],
  5: [[0, 'print("自己人")\nhero.moveRight(3)', '远处喊口令'], [0, 'hero.moveRight()\nprint("出发")\nhero.moveRight(2)', '错误口令硬闯']],
  6: [[0, 'hero.moveRight()\nprint("自己人")\nhero.moveRight(3)\nhero.moveUp(3)', '未通过第二门岗'], [0, 'hero.moveRight()\nprint("自己人")\nhero.moveRight(3)\nhero.moveUp()\nprint("自己人")\nhero.moveUp(2)', '第二门岗用错口令']],
  7: [[0, 'steps = 1\nhero.moveRight(steps)', '少一格'], [0, 'steps = 3\nhero.moveRight(steps)', '多一格']],
  8: [[0, 'total = 5\npassed = 2\nremaining = total + passed\nhero.moveRight(remaining)', '剩余距离加错'], [0, 'remaining = 2\nhero.moveRight(remaining)', '误把已走距离当剩余']],
  9: [[1, 'hero.moveRight()', '封路仍前进'], [0, 'if False:\n    hero.moveRight()', '放行却不走']],
  10: [[1, 'hero.moveLeft()', '始终走左路'], [0, 'hero.moveLeft()\nhero.moveRight()', '两边都执行回到起点']],
  11: [[2, 'if hero.pathOpen("right") or hero.nextTileSafe():\n    hero.moveRight()\nelse:\n    hero.moveDown()', '把and写成or'], [1, 'if hero.pathOpen("right"):\n    hero.moveRight()\nelse:\n    hero.moveDown()', '忽略尖刺']],
  12: [[0, 'score = hero.readSignal()\nif score >= 60:\n    hero.moveRight()\nelif score >= 80:\n    hero.moveUp()\nelse:\n    hero.moveDown()', '低门槛先判断'], [1, 'score = hero.readSignal()\nif score > 80:\n    hero.moveUp()\nelif score >= 60:\n    hero.moveRight()\nelse:\n    hero.moveDown()', '漏80边界']],
  13: [[0, 'for step in range(2):\n    hero.moveRight()', '少一次'], [0, 'for step in range(4):\n    hero.moveRight()', '多一次']],
  14: [[0, 'for number in range(1, 3):\n    hero.moveRight()\n    hero.press(number)', '漏3号'], [0, 'for number in range(1, 4):\n    hero.press(number)\n    hero.moveRight()', '先按后走']],
  15: [[0, 'for number in range(2, 6, 2):\n    hero.moveRight(2)\n    hero.press(number)', '漏6号'], [0, 'for number in range(2, 7, 2):\n    hero.moveRight()\n    hero.press(number)', '步长与走的距离不对应']],
  16: [[0, 'for step in range(5):\n    hero.moveRight()', '对短廊写死5次'], [0, 'length = hero.pathLength()\nfor step in range(length - 1):\n    hero.moveRight()', '少一次']],
  17: [[0, 'remaining = 3\nwhile remaining > 0:\n    hero.moveRight()\n    print(remaining)', '没有更新'], [0, 'remaining = 3\nwhile remaining > 0:\n    hero.moveRight()\n    print(remaining)\n    remaining -= 1', '在更新前报告旧值']],
  18: [[1, 'remaining = hero.pathLength()\nhero.moveRight()\nwhile remaining > 0:\n    hero.moveRight()\n    remaining -= 1\n    print(remaining)', '0格仍先走一步'], [0, 'remaining = hero.pathLength()\nwhile remaining > 0:\n    hero.moveRight()\n    print(remaining)', '缺少更新']],
  19: [[2, 'hero.moveRight()\nwhile not hero.atBeacon():\n    hero.moveRight()', '起点信标仍先走'], [0, 'arrived = hero.atBeacon()\nwhile not arrived:\n    hero.moveRight()', '循环外只检测一次']],
  20: [[1, 'while not hero.atBeacon():\n    hero.moveRight()', '没有等巡逻'], [1, 'safe = hero.nextTileSafe()\nwhile not hero.atBeacon():\n    if safe:\n        hero.moveRight()\n    else:\n        hero.wait()', '不重新检测路况']],
  21: [[0, 'print("自己人")\nhero.moveRight(3)', '起点说口令'], [1, 'hero.moveRight()\nprint("自己人")\nfor step in range(2):\n    hero.moveRight()\nremaining = 2\nwhile remaining > 0:\n    hero.moveUp()\n    remaining -= 1', '把未知上行距离写死为2']],
}
module.exports = designs.map(d => ({ index: d.index, section: d.section, slug: `local-python-${String(d.index).padStart(2, '0')}`, references: (d.scenarios || [{}]).map((s, scene) => ({ scene, title: s.title || '主场景', code: s.solution || d.solution || samples[d.index] })), mistakes: bad[d.index].map(([scene, code, reason]) => ({ scene, code, reason })) }))
