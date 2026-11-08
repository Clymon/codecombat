const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

// The checked-in native artifact is the known-good gameplay baseline, not a
// reconstruction of the compiler's expected output.
test('the side-room level compiles to its existing playable artifact and matching catalog/reference', () => {
  const { compileLevels } = require('../tools/build-levels')
  const levels = compileLevels()
  const actual = levels.find(l => l.slug === 'local-python-13')
  const baseline = JSON.parse(fs.readFileSync(path.join(__dirname, '../levels/local-python-13.json')))
  assert.deepEqual(actual, baseline)
  assert.equal(actual.teachingMap.revision, 4)
  assert.equal(actual.goals.find(g => g.id === 'charge-plate').name, '点亮沿路全部3块石板')
  const { catalog } = require('../level-access')
  const entry = catalog.find(l => l.slug === actual.slug)
  assert.equal(entry.name, actual.name)
  assert.deepEqual(entry.teachingMap.chargePlates, actual.teachingMap.chargePlates)
  const reference = require('../qa-cases').find(c => c.index === 13).references[0]
  assert.match(reference.code, /hero.wait\(\)/)
  assert.equal(actual.teachingMap.solution, undefined)
  assert.equal(actual.teachingMap.scenarios, undefined)
})

test('scene changes replace complete fields, clear inherited devices and remain isolated', () => {
  const { compileLevels } = require('../tools/build-levels')
  const { compileCatalog } = require('../level-catalog')
  const source = structuredClone(require('../map-designs').find(d => d.index === 13))
  source.sensor = { open: { left: true }, value: 10 }
  source.scenarios = [
    { title: '空房', chargePlates: [], sensor: null, solution: 'hero.moveRight(7)\n' },
    { title: '一间房', chargePlates: [{ at: [24, 36], radius: 2, seconds: 1 }], sensor: { open: { right: true } } },
  ]
  const [empty, one] = compileLevels([source])
  assert.equal(empty.goals.some(g => g.id === 'charge-plate'), false)
  assert.equal(empty.teachingMap.sensor, null)
  assert.equal(one.goals.find(g => g.id === 'charge-plate').name, '点亮沿路全部1块石板')
  assert.deepEqual(one.teachingMap.sensor, { open: { right: true } })
  assert.deepEqual(compileCatalog([source])[0].references[0], { scene: 0, title: '空房', code: 'hero.moveRight(7)\n' })
  assert.deepEqual(one.teachingMap.scenarioTitles, ['空房', '一间房'])
  one.teachingMap.chargePlates[0].seconds = 9
  assert.equal(source.scenarios[1].chargePlates[0].seconds, 1)
  assert.equal(compileLevels([source])[1].teachingMap.chargePlates[0].seconds, 1)
  for (const level of [empty, one]) {
    assert.equal(level.teachingMap.solution, undefined)
    assert.equal(level.teachingMap.scenarios, undefined)
  }
})

test('the catalog uses numeric identity order independent of input order', () => {
  const { compileCatalog } = require('../level-catalog')
  const definitions = require('../map-designs')
  const selected = [13, 2, 10].map(index => definitions.find(d => d.index === index))
  assert.deepEqual(compileCatalog(selected).map(entry => entry.design.index), [2, 10, 13])
})

test('invalid objects in a resolved scene report the level, scene and authoring field', () => {
  const { compileLevels } = require('../tools/build-levels')
  const source = structuredClone(require('../map-designs').find(d => d.index === 23))
  source.scenarios = [{ title: '损坏的救援', adventure: structuredClone(source.adventure) }]
  source.scenarios[0].adventure.actors[1].releaseBy = '不存在的门'
  assert.throws(() => compileLevels([source]), /Level 23, scene 0 .*损坏的救援.*field adventure.actors\[1\].releaseBy.*不存在的门/)
})

test('compilation rejects duplicate identities and invalid gameplay positions before native generation', () => {
  const { compileLevels } = require('../tools/build-levels')
  const definitions = require('../map-designs')
  for (const [index, change, field] of [
    [23, d => { d.adventure.actors[1].id = d.adventure.actors[0].id }, 'adventure.actors[1].id'],
    [23, d => { delete d.adventure.actors[0].id }, 'adventure.actors[0].id'],
    [23, d => { d.adventure.actors[0].at = [Infinity, 12] }, 'adventure.actors[0].at'],
    [23, d => { d.start = [-1, 12] }, 'start'],
    [23, d => { d.goals.push({ id: 'reach-exit', name: '重复出口' }) }, 'goals'],
    [15, d => { d.decoySwitches[0].number = 2 }, 'decoySwitches[0].number'],
    [13, d => { d.chargePlates.push(structuredClone(d.chargePlates[0])) }, 'chargePlates[3].at'],
    [13, d => { d.scenarios = [{ index: 14 }] }, 'index'],
    [7, d => { d.scenarios[0].inventory.supply.approach = [10000, 12] }, 'inventory.supply.approach'],
  ]) {
    const source = structuredClone(definitions.find(d => d.index === index))
    change(source)
    assert.throws(() => compileLevels([source]), error => error.message.includes(`Level ${index}, scene 0`) && error.message.includes(`field ${field}`), field)
  }
  const source = definitions.find(d => d.index === 13)
  assert.throws(() => compileLevels([source, source]), /Level 13, scene base, field index.*duplicate/)
  assert.throws(() => compileLevels([{ ...source, index: '13' }]), /field index.*integer/)
})

test('malformed scenes fail with authoring context and decorative coordinates remain legal', () => {
  const { compileLevels } = require('../tools/build-levels')
  const source = structuredClone(require('../map-designs').find(d => d.index === 13))
  assert.throws(() => compileLevels([{ ...source, scenarios: [null] }]), /Level 13, scene 0, field scenarios/)
  const decorated = { ...source, torches: [[-4, 12], [source.size[0] + 4, 12]] }
  const [level] = compileLevels([decorated])
  assert.equal(level.thangs.filter(thang => thang.id.startsWith('Torch ')).length, 2)
})
