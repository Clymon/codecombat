const test = require('node:test'); const assert = require('node:assert/strict')
const Inventory = require('../item-runtime'); const designs = require('../map-designs')
function setup (index = 8, scene = 0) {
  const d = designs.find(d => d.index === index); const map = { ...d, ...(d.scenarios?.[scene] || {}) }; const hero = { pos: { x: map.start[0], y: map.start[1] } }; const goals = {}
  const rules = { world: { age: 0, goalManager: { setGoalState: (id, value) => { goals[id] = value } } }, fail (h, message) { this.failed = true; h.teachingFailure = message } }
  const items = new Inventory(rules, hero, map.inventory)
  return { hero, rules, items, map, goals }
}
test('taking and giving moves real inventory, opens the chest, and only completes after delivery', () => {
  const { hero, items, goals } = setup(); assert.equal(items.ready(), false)
  assert.equal(hero.take('补给箱'), 5); assert.equal(items.bag, 5); assert.equal(items.claimed, true)
  hero.pos.x = 24; assert.equal(hero.give('维修机关', 2), true); assert.equal(items.bag, 3); assert.equal(items.ready(), false)
  hero.pos.x = 36; assert.equal(hero.give('出口机关', 3), true); assert.equal(items.bag, 0); assert.equal(items.ready(), true)
  assert.deepEqual(goals, {}, 'inventory mutations must not trigger premature native victory'); assert.equal(JSON.parse(hero.teachingInventory).event.count, 3)
})
test('remote pickup, duplicate pickup, remote delivery, overdraft and wrong amounts cannot create or consume items', () => {
  for (const mode of ['far-take', 'duplicate', 'far-give', 'overdraft', 'wrong', 'negative', 'fraction']) {
    const { hero, rules, items } = setup()
    if (mode === 'far-take') hero.pos.x = 36
    hero.take('补给箱')
    if (mode === 'duplicate') hero.take('补给箱')
    if (mode.includes('give')) hero.give('维修机关', 2)
    if (['overdraft', 'wrong', 'negative', 'fraction'].includes(mode)) { hero.pos.x = 24; hero.give('维修机关', { overdraft: 6, wrong: 3, negative: -1, fraction: 1.5 }[mode]) }
    assert.equal(rules.failed, true, mode); assert.equal(items.bag, mode === 'far-take' ? 0 : 5); assert.equal(items.ready(), false)
  }
})
test('identically named furnaces receive items only at the current approach, once each', () => {
  const { hero, items } = setup(16); const n = hero.take('补给箱')
  for (let i = 0; i < n; i++) { hero.pos.x += 12; hero.give('炉座', 1) }
  assert.equal(items.ready(), true); assert.equal(items.bag, 0)
})
test('empty supply must still be claimed; it yields zero with no delivery required', () => {
  const { hero, items } = setup(18, 1); assert.equal(items.ready(), false)
  assert.equal(hero.take('补给箱'), 0); assert.equal(items.ready(), true)
})
test('live lesson APIs replace numeric sensors with actual item actions', () => {
  for (const i of [7, 8, 12, 16, 17, 18]) { const d = designs.find(d => d.index === i); assert.deepEqual(d.apis, ['take', 'give']); for (const s of d.scenarios || [d]) assert.ok(s.inventory) }
})
