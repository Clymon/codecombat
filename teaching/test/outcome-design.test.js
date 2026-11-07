const test = require('node:test'); const assert = require('node:assert/strict'); const vm = require('node:vm'); const fs = require('node:fs')
const designs = require('../map-designs'); const Rules = vm.runInNewContext(fs.readFileSync(require.resolve('../rules-system'), 'utf8'), { System: class {}, TeachingInteractions: require('../interaction-rules') })
function setup (index, scene = 0) {
  const d = designs.find(d => d.index === index); const map = { ...d, ...d.scenarios?.[scene] }
  const hero = { health: 100, pos: { x: map.start[0], y: map.start[1] }, setAction () {} }; const goals = {}
  const world = { age: 0, getThangByID: () => hero, goalManager: { setGoalState: (id, state) => { goals[id] = state } } }
  const rules = Object.assign(new Rules(), map, { world }); hero.world = world
  return { map, hero, rules, goals, world }
}
test('side-room power is physical: walking the main corridor does not complete any plate', () => {
  const { map, hero, rules, world, goals } = setup(13)
  rules.updateChargePlates(hero)
  for (let x = 24; x <= 96; x += 12) { hero.pos.x = x; world.age++; rules.updateChargePlates(hero) }
  assert.equal(rules.chargeState.lit, 0); assert.equal(goals['charge-plate'], 'incomplete')
  for (const p of map.chargePlates) { hero.pos = { x: p.at[0], y: p.at[1] }; world.age++; rules.updateChargePlates(hero); world.age++; rules.updateChargePlates(hero) }
  assert.equal(goals['charge-plate'], 'success')
})
test('manual numbered presses work; pressing a red grounded plate causes a visible short circuit', () => {
  const correct = setup(15); correct.rules.installSensors(correct.hero)
  assert.equal(correct.map.inscriptions.length, 0, 'legacy number signs must not cover the red ground symbol')
  for (const s of correct.map.switches) { correct.hero.pos.x = s.at[0]; assert.equal(correct.hero.press(s.number), true) }
  assert.equal(correct.goals['press-switches'], 'success')
  const wrong = setup(15); wrong.rules.installSensors(wrong.hero); wrong.hero.pos.x = 24
  assert.equal(wrong.hero.press(1), false); assert.equal(wrong.hero.health, 0); assert.match(wrong.hero.teachingFailure, /接地线.*短路/)
})
test('inventory delivery does not require saying a bookkeeping value', () => {
  for (const n of [17, 18]) {
    const d = designs.find(d => d.index === n)
    for (const s of d.scenarios || [{}]) assert.equal(({ ...d, ...s }).expectedSpeech, null)
  }
})
test('different patrol identities and an empty corridor make observing the target useful', () => {
  const a = designs.find(d => d.index === 30).scenarios
  assert.equal(new Set(a.map(s => s.adventure.actors[0].id)).size, 2)
  const b = designs.find(d => d.index === 31).scenarios
  assert.ok(b.some(s => s.adventure.actors.length === 0)); assert.equal(b.length, 3)
})
