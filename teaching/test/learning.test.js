const test = require('node:test'); const assert = require('node:assert/strict'); const fs = require('fs'); const path = require('path'); const vm = require('vm'); const { spawnSync } = require('child_process')
const esper = require('../../bower_components/esper.js/esper.js')
const scope = { esper, console }; scope.self = scope
vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../../bower_components/esper.js/esper-plugin-lang-python.js'), 'utf8'), scope)
const { instrumentLearning } = require('../learning-trace'); const { rewritePrintAsHeroSay } = require('../print-to-say'); const Learning = require('../learning-runtime'); const contracts = require('../learning-contracts.json')
function run (index, code, extra = {}) {
  let steps = 0
  const hero = { moveRight: () => { steps++ }, moveUp: () => { steps++ }, moveDown: () => {}, say: () => {}, press: () => {}, wait: () => {}, pathLength: () => extra.length ?? 3, atBeacon: () => steps >= (extra.length ?? 3), isVictory: () => steps >= 2, findNearestEnemy: () => ({ id: '敌人' }), attack: () => { steps++ } }
  const rules = { sensor: { length: extra.length ?? 3 }, fail (hero, message) { this.failed = true; hero.teachingFailure = message } }
  const learning = new Learning(rules, hero, contracts[index])
  const ast = instrumentLearning(rewritePrintAsHeroSay(esper.languages.python.parser(code)), index)
  const engine = esper({ language: 'python' }); engine.addGlobal('hero', hero); engine.loadAST(ast); engine.runSync()
  return { hero, rules, learning, accepted: learning.accept(), steps }
}
test('real Python parser and interpreter run for/while instrumentation without changing outcomes', () => {
  const a = run(13, '# 注释不算\n\nfor i in range(3):\n    hero.moveRight()\n'); assert.equal(a.accepted, true); assert.equal(a.steps, 3); assert.equal(a.learning.source.statements, 2)
  const b = run(19, 'while not hero.atBeacon():\n    hero.moveRight()\n'); assert.equal(b.accepted, true); assert.equal(b.steps, 3)
  const c = run(19, 'while not hero.atBeacon():\n    hero.moveRight()\n', { length: 0 }); assert.equal(c.accepted, true); assert.equal(c.steps, 0)
})
test('unrolled code, semicolon compression, dead loop and loop with no repeated action cannot pass', () => {
  for (const code of ['hero.moveRight()\nhero.moveRight()\nhero.moveRight()', 'hero.moveRight(); hero.moveRight(); hero.moveRight()', 'for i in range(0):\n    hero.moveRight()']) assert.equal(run(13, code).accepted, false, code)
  const dummy = run(17, 'if False:\n    while True:\n        hero.moveRight()\nhero.moveRight()'); assert.equal(dummy.accepted, false); assert.match(dummy.hero.teachingFailure, /外面|循环/)
  const empty = run(17, 'while False:\n    hero.moveRight()'); assert.equal(empty.accepted, false)
})
test('count is statement based, multiline calls and inline strings do not confuse it', () => {
  const a = run(13, 'for i in range(\n    3\n):\n    hero.moveRight(\n    )'); assert.equal(a.accepted, true); assert.equal(a.learning.source.statements, 2)
  const b = run(13, 'for i in range(3): hero.moveRight(); hero.say("# ;")'); assert.equal(b.accepted, false); assert.equal(b.learning.source.statements, 3)
})
test('loop defense requires actual search and conditional attack; comments cannot substitute', () => {
  const good = run(33, 'while not hero.isVictory():\n    enemy = hero.findNearestEnemy()\n    if enemy:\n        hero.attack(enemy)\n    else:\n        hero.wait()\n'); assert.equal(good.accepted, true)
  const bad = run(33, 'while not hero.isVictory():\n    hero.attack("敌人")'); assert.equal(bad.accepted, false)
})
test('front-end and server agree on line counts for every reference solution', () => {
  for (const d of require('../map-designs')) {
    for (const scene of d.scenarios || [d]) {
      if (!contracts[d.index] || !scene.solution) continue
      const ast = instrumentLearning(rewritePrintAsHeroSay(esper.languages.python.parser(scene.solution)), d.index)
      const meta = JSON.parse(ast.body[0].expression.arguments[1].value)
      if (contracts[d.index].maxStatements) assert.ok(meta.statements <= contracts[d.index].maxStatements, `${d.index}: ${meta.statements}`)
      const check = spawnSync('python3', [path.join(__dirname, '../tools/check-learning.py'), String(d.index)], { input: scene.solution, encoding: 'utf8' }); assert.equal(check.status, 0, `${d.index}: ${check.stdout}`)
    }
  }
})
test('tutorials check observed replay state and all new chains default hidden', () => {
  const { observed } = require('../tutorial-guide')
  assert.equal(observed({ kind: 'dead', id: '牢门' }, { teachingAdventure: JSON.stringify({ actors: [{ id: '牢门', alive: true }] }) }), false)
  assert.equal(observed({ kind: 'dead', id: '牢门' }, { teachingAdventure: JSON.stringify({ actors: [{ id: '牢门', alive: false }] }) }), true)
  const designs = require('../tutorial-maps'); assert.equal(designs.length, 8); assert.ok(designs.every(d => d.prototype)); assert.deepEqual([...new Set(designs.map(d => d.section))], [6, 7, 8])
  assert.ok(designs.filter(d => d.tutorial).every(d => d.tutorial.steps.every(s => s.text && s.observe && s.evidence)))
})

test('frame updates retain the same learning instance and initial zero-distance scene', () => {
  const Rules = vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../rules-system.js'), 'utf8'), { System: class { constructor (world, config) { this.world = world; Object.assign(this, config) } }, TeachingLearning: Learning })
  const hero = { pos: { x: 12, y: 12 }, setAction () {} }; const goals = {}
  const world = { age: 0, dt: 0.05, getThangByID: id => id === 'Hero Placeholder' ? hero : null, goalManager: { getGoalState: id => goals[id], setGoalState: (id, value) => { goals[id] = value } } }; hero.world = world
  const rules = new Rules(world, { learningContract: contracts[19], exit: [12, 12], sensor: {}, noGems: true, checkpoints: [] }); rules.start()
  const learning = rules.learning
  // The world worker may pass boxed strings; keep that case in this regression.
  learning.record(Object('source'), Object(JSON.stringify({ statements: 2, loops: ['while'], calls: [{ name: 'moveRight', context: ['while'] }] })))
  learning.record('check', 'while:0')
  for (let i = 0; i < 5; i++) { world.age = i * world.dt; rules.update(); assert.equal(rules.learning, learning); assert.ok(learning.source) }
  assert.equal(learning.accept(), true)
})
test('native idle completion cannot prematurely resolve a custom attack or wait', () => {
  const Rules = vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../rules-system.js'), 'utf8'), { System: class { constructor (world) { this.world = world } } })
  let unblocked = 0
  const hero = { unblock () { unblocked++ }, setAction () {} }; const rules = new Rules({ getThangByID: () => hero }); rules.start()
  hero.currentPlan = { methodName: 'attack' }; rules.adventure = { swing: {} }; hero.unblock(); assert.equal(unblocked, 0)
  rules.adventure.swing = null; hero.unblock(); assert.equal(unblocked, 1)
  hero.currentPlan = { methodName: 'wait' }; hero.teachingWaitUntil = 1; hero.unblock(); assert.equal(unblocked, 1)
  hero.teachingWaitUntil = null; hero.unblock(); assert.equal(unblocked, 2)
})
