const test = require('node:test'); const assert = require('node:assert/strict'); const fs = require('fs'); const path = require('path'); const vm = require('vm')
const designs = require('../map-designs')
const { instrumentLearning } = require('../learning-trace')
test('all published maps use world outcomes with no line counts or required Python constructs', () => {
  for (const d of designs) {
    for (const s of d.scenarios || [{}]) {
      const current = { ...d, ...s }
      assert.ok(!current.learningContract, d.index)
      assert.ok(!current.singleStep, d.index)
      const ast = { type: 'Program', body: [] }; const before = JSON.stringify(ast)
      instrumentLearning(ast, d.index); assert.equal(JSON.stringify(ast), before)
    }
  }
})
test('tutorial checkmarks observe encounters rather than calls', () => {
  const { observed } = require('../tutorial-guide')
  assert.equal(observed({ kind: 'enemies-cleared' }, { teachingAdventure: JSON.stringify({ actors: [{ kind: 'enemy', alive: true }] }) }), false)
  assert.equal(observed({ kind: 'enemies-cleared' }, { teachingAdventure: JSON.stringify({ actors: [] }) }), true)
  assert.equal(observed({ kind: 'enemy-arrived' }, { teachingAdventure: JSON.stringify({ actors: [{ kind: 'enemy', active: true }] }) }), true)
  assert.ok(designs.filter(d => d.tutorial).every(d => d.tutorial.steps.every(s => s.evidence.kind !== 'call')))
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
