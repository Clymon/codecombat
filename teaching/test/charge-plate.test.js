const test = require('node:test'); const assert = require('node:assert/strict'); const fs = require('node:fs'); const vm = require('node:vm'); const path = require('node:path')
const Rules = vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../rules-system.js'), 'utf8'), { System: class {} })
const { runeProgress } = require('../charge-view')
function setup () {
  const goals = {}; const hero = { pos: { x: 24, y: 12 }, health: 100 }
  const world = { age: 0, goalManager: { setGoalState: (id, status) => { goals[id] = status } } }
  const rules = Object.assign(new Rules(), { world, chargePlates: [24, 36, 48].map(x => ({ at: [x, 12], radius: 2, seconds: 1 })) })
  const tick = time => { world.age = time; rules.updateChargePlates(hero); return JSON.parse(hero.teachingCharge) }
  return { hero, world, goals, rules, tick }
}
test('three physical plates each require one second; one long wait cannot charge distant plates', () => {
  const { hero, rules, tick, goals } = setup(); tick(0)
  const half = tick(0.5); assert.equal(half.lit, 0); assert.equal(runeProgress(rules.chargePlates[0], half.plates[0]), 0.5)
  assert.equal(tick(1).lit, 1); assert.equal(tick(10).lit, 1); assert.equal(goals['charge-plate'], 'incomplete')
  hero.pos.x = 36; tick(11); assert.equal(tick(12).lit, 2)
  hero.pos.x = 48; tick(13); assert.equal(tick(14).lit, 3); assert.equal(goals['charge-plate'], 'success')
  hero.pos.x = 60; assert.equal(tick(15).complete, true)
})
test('passing through starts a ring; leaving only resets the unfinished plate', () => {
  const { hero, tick } = setup(); tick(0); tick(1)
  hero.pos.x = 36; tick(2); assert.ok(tick(2.25).plates[1].elapsed > 0)
  hero.pos.x = 40; const left = tick(2.3)
  assert.equal(left.plates[1].elapsed, 0); assert.equal(left.plates[1].interruptedAt, 2.3)
  assert.equal(left.lit, 1); assert.equal(left.plates[0].complete, true)
  hero.pos.x = 24; tick(3); assert.equal(tick(5).lit, 1, 'revisiting a lit plate cannot count twice')
})
test('code ending on a plate only charges that plate, not the entire exit circuit', () => {
  const { hero, tick, goals } = setup(); hero.plansAreFinished = true
  hero.pos.x = 12; tick(0); assert.equal(tick(10).lit, 0)
  hero.pos.x = 36; tick(11); const state = tick(14)
  assert.equal(state.plates[1].complete, true); assert.equal(state.lit, 1); assert.equal(state.complete, false); assert.equal(goals['charge-plate'], 'incomplete')
})
test('fresh simulations reset all plates and time steps do not affect charging', () => {
  const whole = setup(); const split = setup(); whole.tick(0); split.tick(0)
  for (let t = 0.05; t < 1; t += 0.05) split.tick(t)
  assert.equal(whole.tick(1).plates[0].elapsed, split.tick(1).plates[0].elapsed)
  assert.equal(setup().tick(0).lit, 0)
})
test('four tile corridor provides three distinct one-second plates without syntax requirements', () => {
  const level = require('../levels/local-python-02.json'); const d = level.teachingMap
  assert.deepEqual(d.chargePlates.map(p => p.at), [[24, 12], [36, 12], [48, 12]])
  assert.ok(d.chargePlates.every(p => p.seconds === 1)); assert.ok(d.apis.includes('wait')); assert.equal(d.learningContract, null)
  assert.ok(level.goals.some(g => g.id === 'charge-plate')); assert.ok(!level.goals.some(g => g.id === 'collect-parcels'))
})
