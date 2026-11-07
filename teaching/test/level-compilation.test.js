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
