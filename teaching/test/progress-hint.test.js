const test = require('node:test'); const assert = require('node:assert/strict')
const { progressHint } = require('../progress-hint')
const { definitions } = require('../lesson-curriculum')
const d = definitions()[0]; const design = { ...d, ...d.scenarios[0] }
function fixture () {
  const states = {}; const hero = { pos: { x: 12, y: 12 }, health: 100 }
  const world = { age: 0, victory: true, getThangByID: id => states[id] }
  const hint = () => progressHint(design, hero, world)
  return { states, hero, world, hint }
}
test('hint follows the displayed unpack/read/two-post/delivery progress, not precomputed victory', () => {
  const { hero, world, states, hint } = fixture()
  assert.equal(hint().stage, 'approach')
  hero.pos.x = 24; assert.equal(hint().stage, 'open')
  hero.teachingTag = JSON.stringify({ startedAt: 0, openedAt: null }); assert.equal(hint().stage, 'opening')
  hero.teachingTag = JSON.stringify({ startedAt: 0, openedAt: 1.2 }); world.age = 1.2; assert.equal(hint().stage, 'read')
  hero.teachingObservation = JSON.stringify({ name: 'readTag', value: '南-工具-08' }); assert.equal(hint().stage, 'walk-Region Guard')
  hero.pos.x = 48; assert.equal(hint().stage, 'say-Region Guard'); assert.match(hint().text, /第一个字符/)
  states['Region Guard'] = { teachingGateStatus: 'open' }; assert.equal(hint().stage, 'walk-Number Guard')
  hero.pos = { x: 72, y: 36 }; assert.equal(hint().stage, 'say-Number Guard'); assert.match(hint().text, /最后一个字符/)
  states['Number Guard'] = { teachingGateStatus: 'opening' }; assert.equal(hint().stage, 'deliver')
  hero.teachingExitStartedAt = 5; world.age = 5; assert.equal(hint().stage, 'done')
  // Restoring an earlier frame must restore its earlier guidance.
  states['Number Guard'] = { teachingGateStatus: 'waiting' }; hero.teachingExitStartedAt = -1
  assert.equal(hint().stage, 'say-Number Guard')
})
test('failure guidance preserves the actual error and never changes code or world', () => {
  const { hero, world } = fixture(); hero.teachingFailure = '先走到货箱正下方紧邻的一格，再拆封。'
  const before = JSON.stringify(hero); const result = progressHint(design, hero, world)
  assert.equal(result.stage, 'error'); assert.match(result.text, /正下方/); assert.equal(JSON.stringify(hero), before)
})
