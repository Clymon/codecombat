const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs'); const vm = require('node:vm')
const { definitions } = require('../lesson-curriculum')
const { compileLevels } = require('../tools/build-levels')
const { mapObjects, describeObject } = require('../map-inspection')
const { taskFeedback } = require('../task-feedback')
const { tagPose } = require('../tag-view')
const Rules = vm.runInNewContext(fs.readFileSync(require.resolve('../rules-system'), 'utf8'), { System: class {}, TeachingInteractions: require('../interaction-rules') })
const levels = compileLevels(definitions()).filter(l => l.teachingMap.sensor?.tag)
function run (level, seed) {
  const hero = { pos: { x: level.teachingMap.start[0], y: level.teachingMap.start[1] }, say (text) { this.sayMessage = text }, setAction () {} }
  const goals = {}; const world = { age: 1, rand: { rand: n => { seed = (1664525 * seed + 1013904223) >>> 0; return Math.floor(seed / 4294967296 * n) } }, getThangByID: id => id === 'Hero Placeholder' ? hero : null, goalManager: { setGoalState: (id, value) => { goals[id] = value } }, endWorld () {} }
  hero.world = world
  const rules = Object.assign(new Rules(), structuredClone(level.systems.find(s => s.original === 'facadecccc00000000000001').config), { world })
  rules.start()
  const open = () => { hero.pos.x = rules.sensor.tag.at[0]; hero.pos.y = rules.sensor.tag.at[1] - 12; hero.openTag('货箱封签'); world.age += 1.2; assert.equal(hero.openTag('货箱封签'), 'done'); return hero.readTag('货箱封签') }
  const sayAt = (i, text) => { const gate = rules.gates[i]; hero.pos.x = gate.approach[0]; hero.pos.y = gate.approach[1]; rules.receiveSpeech({ ...hero.pos, time: world.age, text }, hero) }
  return { rules, hero, world, goals, open, sayAt }
}
test('unpacking requires the adjacent tile, turns the hero, consumes time and reveals a stable per-run value', () => {
  const found = new Set()
  for (let seed = 1; seed < 60; seed++) {
    const a = run(levels[0], seed)
    assert.throws(() => a.hero.openTag('货箱封签'), /正下方/)
    assert.throws(() => a.hero.readTag('货箱封签'), /还没有打开/)
    const before = describeObject(mapObjects(levels[0].teachingMap, a.hero, a.world).find(o => o.kind === 'tag'), levels[0].teachingMap, a.hero, a.world)
    assert.match(JSON.stringify(before), /还没有拆开/)
    a.hero.pos.x = 24; a.hero.openTag('货箱封签')
    assert.equal(a.hero.rotation, Math.PI / 2)
    a.world.age = 1.6; assert.equal(a.hero.openTag('货箱封签'), undefined)
    assert.throws(() => a.hero.readTag('货箱封签'), /还没有打开/)
    a.world.age = 2.2; assert.equal(a.hero.openTag('货箱封签'), 'done')
    const text = a.hero.readTag('货箱封签'); found.add(text)
    assert.equal(a.hero.readTag('货箱封签'), text)
    assert.equal(run(levels[0], seed).open(), text)
    assert.equal(taskFeedback(levels[0].teachingMap, a.hero, a.world).status, text)
  }
  assert.ok(found.size > 25)
})
test('one index mission has two different physical checks, with no duplicate next scene', () => {
  assert.equal(levels.length, 5)
  for (const level of levels) {
    assert.equal(level.teachingMap.scenarioTitles.length, 1)
    const a = run(level, 1234); const text = a.open()
    a.sayAt(0, text[0]); assert.equal(a.rules.gates[0].openedAt, a.world.age)
    assert.equal(a.rules.gates[1].openedAt, undefined)
    a.sayAt(0, text[text.length - 1]); assert.equal(a.rules.gates[1].openedAt, undefined, 'cannot speak to the second guard remotely')
    a.sayAt(1, text[text.length - 1]); assert.equal(a.rules.gates[1].openedAt, a.world.age)
    const bad = run(level, 3456); const value = bad.open(); bad.sayAt(0, value[value.length - 1])
    assert.equal(bad.goals['stay-safe'], 'failure')
    bad.sayAt(0, value[0]); assert.equal(bad.rules.gates[0].openedAt, undefined)
  }
})
test('unpacking replay has visible intermediate stages, stable pause and rewinds to sealed', () => {
  const a = run(levels[0], 3); a.open()
  assert.equal(tagPose(a.hero, 0).progress, 0)
  const half = tagPose(a.hero, 1.6)
  assert.equal(half.opening, true); assert.ok(half.lid > 0 && half.lid < 1); assert.equal(half.opened, false)
  assert.deepEqual(half, tagPose(a.hero, 1.6))
  assert.equal(tagPose(a.hero, 2.3).opened, true)
  assert.equal(tagPose(a.hero, 2.3).paper, 1)
  const level = levels.find(l => l.teachingMap.classroomTask === 'remedial'); const help = run(level, 7)
  assert.equal(taskFeedback(level.teachingMap, help.hero, help.world).observation, '')
  help.open(); assert.match(taskFeedback(level.teachingMap, help.hero, help.world).observation, /0:/)
})
