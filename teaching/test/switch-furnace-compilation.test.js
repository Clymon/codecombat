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

const cases = [
  { index: 14, revision: 4, scenes: ['主场景'], code: 'for number in range(1, 4):\n    hero.moveRight()\n    hero.press(number)\n' },
  { index: 15, revision: 4, scenes: ['主场景'], code: 'for number in range(2, 7, 2):\n    hero.moveRight(2)\n    hero.press(number)\n' },
  { index: 16, revision: 5, scenes: ['2 块能量石，2 座炉座', '4 块能量石，4 座炉座', '5 块能量石，5 座炉座'], code: 'count = hero.take("补给箱")\nfor i in range(count):\n    hero.moveRight()\n    hero.give("炉座", 1)\n' },
]
for (const { index, revision, scenes, code } of cases) {
  test(`level ${index} compiles independently with unchanged scenes, catalog and teacher references`, () => {
    const sources = definitions(index)
    const slug = `local-python-${index}`
    const baselines = scenes.map((title, scene) => JSON.parse(fs.readFileSync(path.join(__dirname, `../levels/scenarios/${slug}-${scene}.json`), 'utf8')))
    const levels = compileLevels(sources)
    assert.deepEqual(levels, baselines)
    const [entry] = compileCatalog(sources)
    assert.equal(entry.catalog.name, baselines[0].name)
    assert.equal(entry.catalog.teachingMap.revision, revision)
    assert.deepEqual(entry.catalog.teachingMap.scenarioTitles, scenes)
    assert.deepEqual(entry.references, scenes.map((title, scene) => ({ scene, title, code })))
    assert.deepEqual(require('../level-access').catalog.find(level => level.slug === slug), entry.catalog)
    assert.deepEqual(require('../qa-cases').find(level => level.slug === slug).references, entry.references)
    assert.deepEqual(compileLevels().filter(level => level.slug === slug), levels)
    for (const map of [entry.catalog.teachingMap, ...levels.map(level => level.teachingMap)]) {
      assert.equal(Object.hasOwn(map, 'solution'), false)
      assert.equal(Object.hasOwn(map, 'scenarios'), false)
    }
  })
}

// Run the generated native configuration through the engine system lifecycle;
// observe hero APIs, goals and replay fields rather than private helpers.
function play (level) {
  const vm = require('node:vm')
  const Rules = vm.runInNewContext(fs.readFileSync(require.resolve('../rules-system'), 'utf8'), {
    System: class {},
    TeachingInventory: require('../item-runtime'),
    TeachingInteractions: require('../interaction-rules'),
  })
  const hero = { health: 100, pos: { x: level.teachingMap.start[0], y: level.teachingMap.start[1] }, setAction () {} }
  const goals = Object.fromEntries(level.goals.map(goal => [goal.id, 'incomplete']))
  const world = {
    age: 0,
    getThangByID: id => id === 'Hero Placeholder' ? hero : null,
    goalManager: { setGoalState: (id, value) => { goals[id] = value }, getGoalState: id => goals[id] },
  }
  hero.world = world
  const config = level.systems.find(system => system.original === 'facadecccc00000000000001').config
  const rules = Object.assign(new Rules(), structuredClone(config), { world })
  rules.start()
  const tick = () => { world.age += 0.1; rules.update() }
  tick()
  return { hero, goals, tick, move: x => { hero.pos.x = x; tick() } }
}

test('numbered switches require ordered presses; walking red plates is safe but pressing each one short-circuits', () => {
  for (const index of [14, 15]) {
    const [level] = compileLevels(definitions(index))
    assert.deepEqual(level.teachingMap.inscriptions, [], 'obsolete number inscriptions are explicitly cleared')
    const walking = play(level)
    for (let x = 24; x <= level.teachingMap.exit[0]; x += 12) walking.move(x)
    assert.equal(walking.hero.health, 100)
    assert.equal(walking.hero.teachingExitReady, false)
    assert.equal(walking.goals['press-switches'], 'incomplete')
    const manual = play(level)
    for (const plate of level.teachingMap.switches) {
      manual.move(plate.at[0])
      assert.equal(manual.hero.press(plate.number), true)
      manual.tick()
    }
    assert.equal(manual.goals['press-switches'], 'success')
    assert.equal(manual.hero.teachingExitReady, true)
    const outOfOrder = play(level)
    const second = level.teachingMap.switches[1]
    outOfOrder.move(second.at[0])
    assert.equal(outOfOrder.hero.press(second.number), false)
    assert.equal(outOfOrder.goals['stay-safe'], 'failure')
    assert.equal(outOfOrder.goals['press-switches'], 'incomplete')
    for (const red of level.teachingMap.decoySwitches || []) {
      const wrong = play(level)
      wrong.move(red.at[0])
      assert.equal(wrong.hero.health, 100)
      assert.equal(wrong.hero.press(red.number), false)
      assert.equal(wrong.hero.health, 0)
      assert.equal(wrong.goals['stay-safe'], 'failure')
      assert.match(wrong.hero.teachingFailure, /接地线.*短路/)
    }
  }
})

test('all furnace scenes require actual delivery of each supplied stone before the exit opens', () => {
  const levels = compileLevels(definitions(16))
  assert.deepEqual(levels.map(level => level.teachingMap.inventory.supply.count), [2, 4, 5])
  for (const level of levels) {
    const inventory = level.teachingMap.inventory
    assert.equal(inventory.receivers.length, inventory.supply.count)
    const delivered = play(level)
    assert.equal(delivered.hero.take('补给箱'), inventory.supply.count)
    for (const receiver of inventory.receivers) {
      delivered.move(receiver.approach[0])
      assert.equal(delivered.hero.teachingExitReady, false)
      assert.equal(delivered.hero.give('炉座', 1), true)
      delivered.tick()
    }
    assert.equal(JSON.parse(delivered.hero.teachingInventory).bag, 0)
    assert.equal(delivered.goals['deliver-supplies'], 'success')
    assert.equal(delivered.hero.teachingExitReady, true)
    const walking = play(level)
    walking.hero.take('补给箱')
    walking.move(level.teachingMap.exit[0])
    assert.equal(walking.hero.teachingExitReady, false)
    assert.equal(walking.goals['deliver-supplies'], 'incomplete')
    assert.equal(JSON.parse(walking.hero.teachingInventory).bag, inventory.supply.count)
    const early = play(level)
    early.hero.take('补给箱')
    early.hero.give('炉座', 1)
    assert.equal(early.goals['stay-safe'], 'failure')
    assert.equal(JSON.parse(early.hero.teachingInventory).bag, inventory.supply.count)
  }
})

test('editing one furnace inventory replaces it completely without changing other compiled scenes', () => {
  const [source] = definitions(16)
  const before = compileLevels([source])
  source.scenarios[0].inventory = {
    ...source.scenarios[0].inventory,
    supply: { ...source.scenarios[0].inventory.supply, count: 1 },
    receivers: [source.scenarios[0].inventory.receivers[0]],
  }
  const after = compileLevels([source])
  assert.deepEqual(after.slice(1), before.slice(1))
  assert.equal(after[0].teachingMap.inventory.receivers.length, 1)
  const inventory = after[0].systems.find(system => system.original === 'facadecccc00000000000001').config.inventoryConfig
  assert.deepEqual(inventory, after[0].teachingMap.inventory)
  assert.equal(inventory.supply.count, 1)
  assert.ok(after[0].goals.some(goal => goal.id === 'deliver-supplies'))
  after[0].teachingMap.inventory.supply.count = 99
  assert.equal(source.scenarios[0].inventory.supply.count, 1)
  assert.equal(compileLevels([source])[0].teachingMap.inventory.supply.count, 1)
})
