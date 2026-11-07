const test = require('node:test'); const assert = require('node:assert/strict'); const fs = require('node:fs'); const vm = require('node:vm'); const path = require('node:path')
const esper = require('../../bower_components/esper.js/esper.js')
const scope = { esper, console }; scope.self = scope
vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../../bower_components/esper.js/esper-plugin-lang-python.js'), 'utf8'), scope)
const Rules = vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../rules-system.js'), 'utf8'), { System: class { constructor (world) { this.world = world } } })
function setup () {
  const world = { age: 0, dt: 0.05, goalManager: { setGoalState () {} } }
  const hero = { world, setAction () {}, unblock () {}, health: 100 }
  world.getThangByID = () => hero
  const rules = new Rules(world); rules.start()
  return { world, hero, rules }
}
test('wait defaults to one simulated second and an explicit duration controls its deadline', () => {
  const { world, hero } = setup()
  assert.equal(hero.wait(1), undefined)
  world.age = 0.5; assert.equal(hero.wait(1), undefined, 'a 1-second wait cannot finish at 0.5')
  world.age = 1; assert.equal(hero.wait(1), 'done')
  assert.equal(hero.wait(), undefined); world.age = 1.5; assert.equal(hero.wait(), undefined); world.age = 2; assert.equal(hero.wait(), 'done')
  assert.equal(hero.wait(3), undefined); world.age = 4.5; assert.equal(hero.wait(3), undefined); world.age = 5; assert.equal(hero.wait(3), 'done')
  assert.equal(hero.wait(0), 'done')
})
test('polling loops yield without needing a movement or wait statement', () => {
  const { instrumentClock } = require('../execution-clock')
  const { world, hero } = setup(); let pending; let attacks = 0
  const tick = hero.__classroomTick
  hero.__classroomTick = id => {
    const result = tick.call(hero, id)
    if (result === 'done') return result
    pending = new esper.FutureValue(); return pending
  }
  hero.isVictory = () => attacks === 1
  hero.findNearestEnemy = () => world.age >= 1 ? { id: '斥候' } : null
  hero.attack = () => { attacks++ }
  const engine = esper({ language: 'python' }); engine.addGlobal('hero', hero)
  const ast = instrumentClock(esper.languages.python.parser('while not hero.isVictory():\n    enemy = hero.findNearestEnemy()\n    if enemy:\n        hero.attack(enemy)'))
  engine.loadAST(ast)
  let done = false
  for (let frame = 0; frame < 30 && !done; frame++) {
    world.age = frame * world.dt
    if (pending) { pending.resolve(esper.Value.fromNative('done')); pending = null }
    let steps = 0
    while (!done && steps++ < 5000) {
      if (pending) break
      done = engine.evloop.next().done
    }
    assert.ok(steps < 5000, 'a no-enemy loop monopolized the frame before the spawn time')
  }
  assert.equal(attacks, 1); assert.equal(done, true)
})

test('loop scheduling preserves break, continue and zero iterations without syntax-shape instrumentation', () => {
  const { instrumentClock } = require('../execution-clock'); const { instrumentLearning } = require('../learning-trace')
  const ast = instrumentLearning(esper.languages.python.parser('total = 0\nfor i in range(5):\n    if i == 1:\n        continue\n    if i == 4:\n        break\n    total += i\nwhile False:\n    total = 99\nhero.say(total)'), 13)
  assert.equal(ast.classroomInstrumented, undefined)
  instrumentClock(ast); const serialized = JSON.stringify(ast); instrumentClock(ast); assert.equal(JSON.stringify(ast), serialized)
  let said; const hero = { __classroomTrace () {}, __classroomTick () {}, say: n => { said = n } }
  const engine = esper({ language: 'python' }); engine.addGlobal('hero', hero); engine.loadAST(ast); engine.runSync()
  assert.equal(said, 5)
})
test('invalid waits stop with an explicit message instead of an unresolvable deadline', () => {
  for (const duration of [-1, 0.5, 1.5, Infinity, NaN, '1', true, 31]) {
    const { hero, rules } = setup(); hero.wait(duration)
    assert.equal(rules.failed, true); assert.match(hero.teachingFailure, /0到30之间的整数/)
  }
})

test('waiting does not consume the movement and attack safety quota', () => {
  const { hero, rules } = setup(); rules.maxActions = 2
  for (let i = 0; i < 100; i++) assert.equal(hero.wait(0), 'done')
  assert.equal(rules.failed, undefined); assert.equal(rules.actionCount || 0, 0)
})

test('wait stops movement momentum instead of sliding away during the delay', () => {
  const { hero, world } = setup()
  hero.velocity = { x: 12, y: 3 }; hero.intent = 'move'; hero.targetPos = { x: 60, y: 12 }
  hero.setTargetPos = p => { hero.targetPos = p }
  hero.wait(1)
  assert.equal(hero.targetPos, null); assert.equal(hero.intent, undefined)
  assert.equal(hero.velocity.x, 0); assert.equal(hero.velocity.y, 0)
  world.age = 1; assert.equal(hero.wait(1), 'done')
})
