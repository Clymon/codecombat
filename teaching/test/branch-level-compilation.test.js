const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { compileLevels } = require('../tools/build-levels')
const { compileCatalog } = require('../level-catalog')

const cases = [
  { index: 12, revision: 5, supplies: [5, 4, 2, 1], deliveries: [[4], [4], [2], [1]], code: 'coins = hero.take("补给箱")\nif coins >= 4:\n    hero.moveUp()\n    hero.give("守卫", 4)\nelif coins >= 2:\n    hero.moveRight()\n    hero.give("守卫", 2)\nelse:\n    hero.moveDown()\n    hero.give("守卫", 1)\n' },
  { index: 11, revision: 4, routes: [[{ right: true }, [], [[48, 24]], [48, 24]], [{ right: true }, [[48, 24]], [[36, 12]], [36, 12]], [{ right: false }, [], [[36, 12]], [36, 12]]], code: 'if pathOpen("right") and nextTileSafe():\n    hero.moveRight()\nelse:\n    hero.moveDown()\n' },
  { index: 10, revision: 4, routes: [[{ left: true, right: false }, [], [[24, 24]], [24, 24]], [{ left: false, right: true }, [], [[48, 24]], [48, 24]]], code: 'if pathOpen("left"):\n    hero.moveLeft()\nelse:\n    hero.moveRight()\n' },
  { index: 9, revision: 4, routes: [[{ right: true }, [], [[24, 24]], [12, 12]], [{ right: false }, [], [], [12, 12]]], code: 'if pathOpen("right"):\n    hero.moveRight()\n    hero.moveLeft()\nhero.moveDown()\n' },
  { index: 7, revision: 5, supplies: [2, 4], deliveries: [[2], [4]], code: 'stones = hero.take("补给箱")\nhero.moveRight(2)\nhero.give("出口机关", stones)\n' },
  { index: 8, revision: 5, supplies: [5, 6], deliveries: [[2, 3], [2, 4]], code: 'total = hero.take("补给箱")\nhero.moveRight()\nhero.give("维修机关", 2)\nremaining = total - 2\nhero.moveRight()\nhero.give("出口机关", remaining)\n' },
]

for (const expected of cases.sort((a, b) => a.index - b.index)) {
  test(`level ${expected.index} independently compiles every branch with matching gameplay, goals and references`, () => {
    const source = JSON.parse(fs.readFileSync(path.join(__dirname, `../level-definitions/${expected.index}.json`), 'utf8'))
    const slug = `local-python-${String(expected.index).padStart(2, '0')}`
    const levels = compileLevels([source])
    const [entry] = compileCatalog([source])
    assert.equal(source.revision, expected.revision)
    assert.equal(levels.length, expected.supplies?.length || expected.routes.length)
    assert.deepEqual(require('../map-designs').find(d => d.index === expected.index), source)
    assert.deepEqual(require('../level-access').catalog.find(d => d.slug === slug), entry.catalog)
    assert.deepEqual(require('../qa-cases').find(d => d.slug === slug).references, entry.references)
    for (const [scene, actual] of levels.entries()) {
      const baseline = JSON.parse(fs.readFileSync(path.join(__dirname, `../levels/scenarios/${slug}-${scene}.json`), 'utf8'))
      assert.deepEqual(actual, baseline)
      assert.equal(entry.catalog.name, actual.name)
      assert.deepEqual(entry.scenes[scene].teachingMap, actual.teachingMap)
      assert.deepEqual(entry.references[scene], { scene, title: actual.teachingMap.scenarioTitles[scene], code: expected.code })
      const map = actual.teachingMap
      if (expected.supplies) {
        assert.equal(map.inventory.supply.count, expected.supplies[scene])
        assert.deepEqual(map.inventory.receivers.map(receiver => receiver.amount), expected.deliveries[scene])
        assert.ok(actual.goals.some(goal => goal.id === 'take-supplies'))
        assert.ok(actual.goals.some(goal => goal.id === 'deliver-supplies'))
      } else {
        assert.deepEqual([map.sensor.open, map.hazards, map.gems, map.exit], expected.routes[scene])
        assert.equal(actual.goals.some(goal => goal.id === 'deliver-supplies'), false)
      }
      for (const publicMap of [map, entry.catalog.teachingMap]) {
        assert.equal(Object.hasOwn(publicMap, 'solution'), false)
        assert.equal(Object.hasOwn(publicMap, 'scenarios'), false)
      }
    }
  })
}

for (const index of [7, 8, 12]) {
  test(`level ${index} supports standalone, empty and independent inventory variants`, () => {
    const source = JSON.parse(fs.readFileSync(path.join(__dirname, `../level-definitions/${index}.json`), 'utf8'))
    // These levels have scene-only inventory: resolve a complete scene before
    // authoring it as a standalone level without a scenarios property.
    assert.equal(source.inventory, undefined)
    const original = structuredClone(source)
    const standalone = compileCatalog([source])[0].scenes[0].design
    const [single] = compileLevels([standalone])
    assert.deepEqual(single.teachingMap.inventory, source.scenarios[0].inventory)
    assert.equal(single.teachingMap.scenarioIndex, 0)
    assert.deepEqual(compileLevels([{ ...standalone, scenarios: [] }]), [])

    const replacement = structuredClone(source.scenarios.at(-1).inventory)
    replacement.supply.count = 0
    replacement.receivers = []
    const edited = {
      ...standalone,
      scenarios: [
        { title: '无库存', inventory: null, gates: [], inscriptions: [] },
        { title: '空补给箱', inventory: replacement },
        { title: '继承原库存' },
      ],
    }
    const [cleared, empty, inherited] = compileLevels([edited])
    assert.equal(cleared.teachingMap.inventory, null)
    assert.deepEqual(cleared.teachingMap.gates, [])
    assert.deepEqual(cleared.teachingMap.inscriptions, [])
    assert.equal(cleared.goals.some(goal => ['take-supplies', 'deliver-supplies'].includes(goal.id)), false)
    assert.deepEqual(empty.teachingMap.inventory, replacement)
    assert.deepEqual(inherited.teachingMap.inventory, standalone.inventory)
    empty.teachingMap.inventory.supply.count = 99
    empty.teachingMap.inventory.receivers.push({ name: '不会串到其他场景' })
    assert.deepEqual(inherited.teachingMap.inventory, source.scenarios[0].inventory)
    assert.deepEqual(compileLevels([edited])[1].teachingMap.inventory, replacement)
    assert.deepEqual(source, original)
    assert.equal(compileCatalog([edited])[0].references[1].code, standalone.solution)
  })
}
