const test = require('node:test'); const assert = require('node:assert/strict'); const { spawnSync } = require('node:child_process'); const path = require('node:path')
const check = (index, code) => spawnSync('python3', [path.join(__dirname, '../tools/check-learning.py'), String(index)], { input: code, encoding: 'utf8' })
test('syntax validation accepts alternative expressions and expanded action sequences', () => {
  for (const [i, code] of [[9, 'pathOpen("right") and hero.moveRight()'], [14, 'hero.moveRight()\nhero.press(1)\nhero.moveRight()\nhero.press(2)\nhero.moveRight()\nhero.press(3)'], [16, 'hero.take("补给箱")\nhero.moveRight()\nhero.give("炉座", 1)'], [17, 'for n in range(3):\n    hero.moveRight()'], [19, 'for n in range(2):\n    hero.wait()\n    hero.moveRight()']]) assert.equal(check(i, code).status, 0)
  assert.equal(check(9, 'if :').status, 1)
})
const { taskFeedback } = require('../task-feedback')
const designs = require('../map-designs')
test('supply scenes both require leaving and only the open scene requires collecting a gem', () => {
  const d = designs.find(d => d.index === 9)
  for (const s of d.scenarios) { assert.notDeepEqual(s.exit, s.start); assert.equal(s.exitStyle, 'portal'); assert.equal(s.gems.length, s.sensor.open.right ? 1 : 0) }
})
test('feedback points to next real switch and changes only after its replay count advances', () => {
  const d = designs.find(d => d.index === 14); const hero = { pos: { x: 24, y: 12 }, teachingPressedCount: 0, teachingExitStartedAt: -1 }
  const world = { getThangByID: () => null }
  let state = taskFeedback(d, hero, world); assert.deepEqual(state.target, [24, 12]); assert.match(state.status, /0 \/ 3/); assert.match(state.status, /press/)
  hero.teachingPressedCount = 1; state = taskFeedback(d, hero, world); assert.deepEqual(state.target, [36, 12]); assert.match(state.status, /1 \/ 3/)
  hero.teachingPressedCount = 3; assert.match(taskFeedback(d, hero, world).status, /出口启动/)
})
