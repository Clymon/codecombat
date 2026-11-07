const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { compileLevels } = require('../tools/build-levels')
const { compileCatalog } = require('../level-catalog')

const references = {
  1: 'hero.moveUp()\nhero.moveRight(2)\nhero.moveDown()',
  2: 'for step in range(3):\n    hero.moveRight()\n    hero.wait()\nhero.moveRight()\n',
  3: 'hero.moveUp(2)\nhero.moveRight(3)\nhero.moveDown(2)\nhero.moveRight()',
  4: 'hero.moveRight()\n',
  5: 'hero.moveRight()\nprint("自己人")\nhero.moveRight()\nhero.moveRight()\n',
  6: 'hero.moveRight()\nprint("自己人")\nhero.moveRight(3)\nhero.moveUp()\nhero.say("送信人")\nhero.moveUp(2)\n',
}

for (const [index, code] of Object.entries(references)) {
  test(`basic level ${index} can be authored independently with unchanged gameplay and a matching teacher reference`, () => {
    const source = JSON.parse(fs.readFileSync(path.join(__dirname, `../level-definitions/${index}.json`), 'utf8'))
    const slug = `local-python-${index.padStart(2, '0')}`
    const baseline = JSON.parse(fs.readFileSync(path.join(__dirname, `../levels/${slug}.json`), 'utf8'))
    const [actual] = compileLevels([source])
    assert.deepEqual(actual, baseline)
    const [entry] = compileCatalog([source])
    assert.equal(entry.catalog.name, baseline.name)
    assert.deepEqual(entry.references, [{ scene: 0, title: '主场景', code }])
    assert.deepEqual(require('../map-designs').find(d => d.index === Number(index)), source)
    assert.deepEqual(require('../level-access').catalog.find(d => d.slug === slug), entry.catalog)
    assert.equal(require('../qa-cases').find(d => d.slug === slug).references[0].code, code)
    for (const publicMap of [actual.teachingMap, entry.catalog.teachingMap]) {
      assert.equal(Object.hasOwn(publicMap, 'solution'), false)
      assert.equal(Object.hasOwn(publicMap, 'scenarios'), false)
    }
  })
}
