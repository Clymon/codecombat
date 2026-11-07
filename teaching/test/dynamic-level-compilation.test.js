const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { compileLevels } = require('../tools/build-levels')
const { compileCatalog } = require('../level-catalog')

function definitions (index) {
  const dir = path.join(__dirname, '../level-definitions')
  return fs.readdirSync(dir).filter(name => /^\d+\.json$/.test(name))
    .map(name => JSON.parse(fs.readFileSync(path.join(dir, name), 'utf8')))
    .filter(design => design.index === index)
}

const inventoryCode = 'remaining = hero.take("补给箱")\nwhile remaining > 0:\n    hero.moveRight()\n    hero.give("炉座", 1)\n    remaining -= 1\n    print(remaining)\n'
function checkMigration (index, revision, scenes, code) {
  test(`level ${index} independently compiles its native scenes, catalog and teacher references`, () => {
    const sources = definitions(index)
    const slug = `local-python-${index}`
    const levels = compileLevels(sources)
    assert.equal(levels.length, scenes.length, 'the authoring source must independently produce every playable scene')
    const baselines = scenes.map((title, scene) => JSON.parse(fs.readFileSync(path.join(__dirname, `../levels/scenarios/${slug}-${scene}.json`), 'utf8')))
    assert.deepEqual(levels, baselines)
    const [entry] = compileCatalog(sources)
    assert.equal(entry.catalog.teachingMap.revision, revision)
    assert.deepEqual(entry.catalog.teachingMap.scenarioTitles, scenes)
    assert.equal(entry.catalog.name, baselines[0].name)
    assert.deepEqual(entry.references, scenes.map((title, scene) => ({ scene, title, code })))
    assert.deepEqual(require('../level-access').catalog.find(level => level.slug === slug), entry.catalog)
    assert.deepEqual(require('../qa-cases').find(level => level.slug === slug).references, entry.references)
    assert.deepEqual(compileLevels().filter(level => level.slug === slug), levels)
    for (const map of [entry.catalog.teachingMap, ...levels.map(level => level.teachingMap)]) {
      assert.equal(Object.hasOwn(map, 'solution'), false)
      assert.equal(Object.hasOwn(map, 'scenarios'), false)
      assert.equal(map.learningContract, null)
      assert.equal(map.singleStep, false)
    }
  })
}

checkMigration(17, 5, ['主场景'], inventoryCode)
checkMigration(18, 5, ['箱里有3块，装完就停', '箱子已空，不用装填'], inventoryCode)
checkMigration(19, 2, ['信标在前方2格', '信标在前方4格', '信标就在起点'], 'while not hero.atBeacon():\n    hero.wait()\n    hero.moveRight()\n')
checkMigration(20, 2, ['巡逻场景1', '巡逻场景2'], 'while not hero.atBeacon():\n    if nextTileSafe():\n        hero.moveRight()\n    else:\n        hero.wait()\n')
checkMigration(21, 3, ['上行 2 格', '上行 3 格'], 'hero.moveRight()\nprint("自己人")\nhero.moveRight(2)\nwhile not hero.atBeacon():\n    hero.moveUp()\n    hero.wait()\n')

function play (level) {
  const vm = require('node:vm')
  const Rules = vm.runInNewContext(fs.readFileSync(require.resolve('../rules-system'), 'utf8'), {
    System: class {},
    TeachingInventory: require('../item-runtime'),
    TeachingInteractions: require('../interaction-rules'),
  })
  const hero = { health: 100, pos: { x: level.teachingMap.start[0], y: level.teachingMap.start[1] }, setAction () {}, say (text) { this.sayMessage = text; return 'done' } }
  const actors = Object.fromEntries((level.teachingMap.gates || []).map(gate => [gate.id, { pos: { x: gate.at[0], y: gate.at[1] } }]))
  const goals = Object.fromEntries(level.goals.map(goal => [goal.id, 'incomplete']))
  const world = {
    age: 0,
    getThangByID: id => id === 'Hero Placeholder' ? hero : actors[id],
    goalManager: { setGoalState: (id, value) => { goals[id] = value }, getGoalState: id => goals[id] },
  }
  hero.world = world
  const config = level.systems.find(system => system.original === 'facadecccc00000000000001').config
  const rules = Object.assign(new Rules(), structuredClone(config), { world })
  rules.start()
  const tick = (seconds = 0.1) => { world.age += seconds; rules.update() }
  tick()
  return { hero, goals, tick, move: (x, y = 12) => { hero.pos.x = x; hero.pos.y = y; tick() } }
}

test('the empty box has no inherited receivers but must still be opened before the exit is ready', () => {
  const [stocked, empty] = compileLevels(definitions(18))
  assert.equal(stocked.teachingMap.inventory.supply.count, 3)
  assert.equal(stocked.teachingMap.inventory.receivers.length, 3)
  assert.equal(empty.teachingMap.inventory.supply.count, 0)
  assert.deepEqual(empty.teachingMap.inventory.receivers, [])
  assert.deepEqual(empty.teachingMap.exit, [12, 12])
  const run = play(empty)
  assert.equal(run.hero.teachingExitReady, false)
  assert.equal(run.goals['take-supplies'], 'incomplete')
  assert.equal(run.hero.take('补给箱'), 0)
  run.tick()
  assert.equal(run.goals['take-supplies'], 'success')
  assert.equal(run.goals['deliver-supplies'], 'success')
  assert.equal(run.hero.teachingExitReady, true)
  const full = play(stocked)
  assert.equal(full.hero.take('补给箱'), 3)
  for (const x of [24, 36, 48]) {
    full.move(x)
    assert.equal(full.hero.teachingExitReady, false)
    assert.equal(full.hero.give('炉座', 1), true)
    full.tick()
  }
  assert.equal(full.hero.teachingExitReady, true)
  assert.equal(full.goals['show-values'], undefined, 'bookkeeping speech is not required')
})

test('two, four and zero charge plates match their beacons and permit manual actions with default waits', () => {
  const levels = compileLevels(definitions(19))
  assert.deepEqual(levels.map(level => level.teachingMap.exit), [[36, 12], [60, 12], [12, 12]])
  assert.deepEqual(levels.map(level => level.teachingMap.chargePlates.length), [2, 4, 0])
  assert.deepEqual(levels.map(level => level.goals.find(goal => goal.id === 'charge-plate')?.name), ['点亮沿路全部2块石板', '点亮沿路全部4块石板', undefined])
  for (const level of levels) {
    const run = play(level)
    for (const plate of level.teachingMap.chargePlates) {
      run.move(...plate.at)
      assert.equal(run.hero.wait(), undefined)
      run.tick(0.5)
      assert.equal(run.hero.wait(), undefined)
      run.tick(0.5)
      assert.equal(run.hero.wait(), 'done')
    }
    run.move(...level.teachingMap.exit)
    assert.equal(run.hero.atBeacon(), true)
    assert.equal(run.hero.teachingExitReady, true)
    if (level.teachingMap.chargePlates.length) {
      assert.equal(run.goals['charge-plate'], 'success')
      const walking = play(level)
      walking.move(...level.teachingMap.exit)
      assert.equal(walking.hero.teachingExitReady, false)
    }
  }
})

test('scene arrays clear instead of inheriting and edited charge routes leave other scenes unchanged', () => {
  const [source] = definitions(19)
  source.chargePlates = [{ at: [12, 12], radius: 2, seconds: 9 }]
  const before = compileLevels([source])
  assert.deepEqual(before[2].teachingMap.chargePlates, [])
  source.scenarios[0].chargePlates = [{ at: [12, 12], radius: 2, seconds: 1 }]
  source.scenarios[0].exit = [24, 12]
  source.scenarios[0].exitMarker = { x: 24, y: 5, label: '信标' }
  const after = compileLevels([source])
  assert.deepEqual(after.slice(1), before.slice(1))
  assert.deepEqual(after[0].teachingMap.exit, [24, 12])
  assert.equal(after[0].goals.find(goal => goal.id === 'charge-plate').name, '点亮沿路全部1块石板')
  assert.equal(Object.hasOwn(after[0].teachingMap.exitMarker, 'direction'), false, 'nested objects replace the entire inherited value')
  after[0].teachingMap.chargePlates[0].seconds = 99
  assert.equal(compileLevels([source])[0].teachingMap.chargePlates[0].seconds, 1)
  delete source.scenarios[2].chargePlates
  assert.equal(compileLevels([source])[2].teachingMap.chargePlates[0].seconds, 9, 'omitting an array inherits the default')
})

test('empty inventory and patrol objects replace all inherited nested values independently', () => {
  const [supply] = definitions(18)
  supply.inventory = { ...supply.scenarios[0].inventory, obsolete: { amount: 99 } }
  const before = compileLevels([supply])
  assert.equal(Object.hasOwn(before[1].teachingMap.inventory, 'obsolete'), false)
  supply.scenarios[0].inventory.supply.count = 2
  supply.scenarios[0].inventory.receivers.pop()
  assert.deepEqual(compileLevels([supply])[1], before[1])
  const [patrol] = definitions(20)
  patrol.guard = { ...patrol.scenarios[0].guard, obsolete: { radius: 99 } }
  const patrolBefore = compileLevels([patrol])
  assert.deepEqual(patrolBefore.map(level => level.teachingMap.guard.phase), [0, Math.PI])
  assert.equal(Object.hasOwn(patrolBefore[1].teachingMap.guard, 'obsolete'), false)
  patrol.scenarios[0].guard.radius = 4
  const patrolAfter = compileLevels([patrol])
  assert.deepEqual(patrolAfter[1], patrolBefore[1])
  assert.equal(patrolAfter[0].systems.find(system => system.original === 'facadecccc00000000000001').config.guard.radius, 4)
})

test('both vertical beacon routes require gate permission and every upper charge plate', () => {
  const levels = compileLevels(definitions(21))
  assert.deepEqual(levels.map(level => level.teachingMap.exit), [[48, 36], [48, 48]])
  assert.deepEqual(levels.map(level => level.teachingMap.chargePlates.length), [2, 3])
  for (const level of levels) {
    const run = play(level)
    run.move(24)
    run.hero.say('自己人')
    run.tick(1.1)
    assert.equal(run.goals['gate-Final Post'], 'success')
    run.move(48)
    assert.equal(run.hero.teachingExitReady, false)
    for (const plate of level.teachingMap.chargePlates) {
      run.move(...plate.at)
      run.tick(1)
    }
    assert.equal(run.hero.atBeacon(), true)
    assert.equal(run.goals['charge-plate'], 'success')
    assert.equal(run.hero.teachingExitReady, true)
    const noPermission = play(level)
    for (const plate of level.teachingMap.chargePlates) {
      noPermission.move(...plate.at)
      noPermission.tick(1)
    }
    assert.equal(noPermission.goals['gate-Final Post'], 'incomplete')
    assert.equal(noPermission.hero.teachingExitReady, false)
  }
})
