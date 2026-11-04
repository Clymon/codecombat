const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const { durations, exitPose } = require('../exit-effects')
const designs = require('../map-designs')
const Rules = vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../rules-system.js'), 'utf8'), { System: class {constructor (world, config) { this.world = world; Object.assign(this, config) }} })
function fixture (config = {}) {
  const hero = { pos: { x: 24, y: 12 }, plansAreFinished: true, setAction (action) { this.action = action } }
  const goals = {}
  const world = { age: 0, hero, goals, getThangByID: id => id === 'Hero Placeholder' ? hero : null, goalManager: { getGoalState: id => goals[id], setGoalState: (id, state) => { goals[id] = state } } }
  const rules = new Rules(world, { exit: [24, 12], exitStyle: 'stairs', exitDirection: [1, 0], exitDuration: durations.stairs, noGems: true, requireFinished: true, ...config })
  return { hero, world, rules, goals }
}
test('departure waits for prerequisites and the end of the program, then finishes before success', () => {
  const { hero, world, rules, goals } = fixture({ checkpoints: [[12, 12]] })
  rules.update()
  assert.equal(hero.teachingExitStartedAt, -1)
  hero.pos.x = 12; rules.update()
  hero.pos.x = 24; hero.plansAreFinished = false; world.age = 1; rules.update()
  assert.equal(hero.teachingExitStartedAt, -1)
  hero.plansAreFinished = true; rules.update()
  assert.equal(hero.teachingExitStartedAt, 1)
  assert.equal(goals['reach-exit'], 'incomplete')
  world.age = 2; rules.update()
  assert.equal(hero.action, 'move')
  assert.deepEqual(hero.pos, { x: 24, y: 12 }, 'animation never changes Python-visible position')
  assert.equal(goals['reach-exit'], 'incomplete')
  world.age = 3; rules.update()
  assert.equal(goals['reach-exit'], 'success'); assert.equal(goals['stay-safe'], 'success')
})
test('failed attempts cannot begin a departure', () => {
  const { hero, rules, goals } = fixture({ hazards: [[24, 12]] })
  rules.update()
  assert.equal(goals['stay-safe'], 'failure')
  assert.equal(hero.teachingExitStartedAt, -1)
})
test('portal fade is tied to replay time, while waiting markers leave the hero visible', () => {
  const portal = { exitStyle: 'portal' }
  assert.equal(exitPose(portal, 2, 1).active, false)
  assert.equal(exitPose(portal, 2, 2).alpha, 1)
  assert.ok(exitPose(portal, 2, 3).alpha < 1)
  assert.equal(exitPose(portal, 2, 4).alpha, 0)
  assert.equal(exitPose(portal, 2, 1).alpha, 1, 'rewind restores visibility')
  assert.equal(exitPose(portal, -1, 100).alpha, 1, 'a new run starts visible')
  assert.equal(exitPose({ exitStyle: 'marker' }, 2, 4).alpha, 1)
  assert.equal(exitPose({ exitStyle: 'camp' }, 2, 4).scale, 1)
})
test('stairs follow the final corridor and switch exits stay on the final switch', () => {
  for (const index of [1, 2, 3, 5, 6, 7, 8, 13, 16]) {
    const d = designs.find(d => d.index === index)
    for (const scene of d.scenarios || [{}]) {
      const map = { ...d, ...scene }; const expected = index === 1 ? [0, -1] : index === 6 ? [0, 1] : [1, 0]
      assert.equal(map.exitStyle, 'stairs'); assert.deepEqual(map.exitDirection, expected)
      const pose = exitPose(map, 0, durations.stairs)
      assert.ok(pose.dx * expected[0] + pose.dy * expected[1] > 0)
      assert.equal(pose.alpha, 0)
    }
  }
  for (const index of [14, 15]) {
    const d = designs.find(d => d.index === index)
    assert.equal(d.exitStyle, 'portal'); assert.deepEqual(d.exit, d.switches.at(-1).at)
  }
  const zero = designs.find(d => d.index === 18).scenarios[1]
  assert.equal(zero.exitStyle, 'marker'); assert.deepEqual(zero.start, zero.exit)
})
