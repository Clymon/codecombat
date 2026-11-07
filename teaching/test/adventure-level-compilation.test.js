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

function checkMigration (index, revision, scenes, code) {
  test(`level ${index} independently compiles its native scenes, catalog and teacher references`, () => {
    const sources = definitions(index)
    const slug = `local-python-${index}`
    const levels = compileLevels(sources)
    assert.equal(levels.length, scenes.length, 'the authoring source independently produces every playable scene')
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
      assert.equal(!!map.singleStep, false)
    }
  })
}

checkMigration(22, 1, ['主场景'], 'hero.moveUp(2)\nhero.moveDown(2)\nhero.moveRight(4)\n')

checkMigration(23, 1, ['主场景'], 'hero.moveRight()\nhero.moveUp()\nhero.attack("牢门")\nhero.attack("牢门")\nhero.moveDown()\nhero.moveRight(2)\nhero.attack("重甲守卫")\nhero.attack("重甲守卫")\nhero.attack("重甲守卫")\nhero.attack("重甲守卫")\nhero.moveRight(3)\n')

checkMigration(24, 2, ['主场景'], 'hero.moveRight()\nfor i in range(3):\n    hero.moveUp(2)\n    print("点火")\n    hero.moveDown(2)\n    hero.moveRight(2)\n')

checkMigration(25, 2, ['三名敌人，分批到来', '四名敌人，间隔变短'], 'while not isVictory():\n    enemy = hero.findNearestEnemy()\n    if enemy:\n        hero.attack(enemy)\n')

checkMigration(26, 1, ['主场景'], 'hero.attack("牢门")\nhero.attack("牢门")\nhero.moveRight(2)\n')

checkMigration(27, 1, ['主场景'], 'hero.moveRight()\nhero.moveUp()\nhero.attack("牢门")\nhero.attack("牢门")\nhero.moveDown()\nhero.moveRight(2)\nhero.attack("重甲守卫")\nhero.attack("重甲守卫")\nhero.attack("重甲守卫")\nhero.attack("重甲守卫")\nhero.moveRight(3)\n')

checkMigration(28, 1, ['主场景'], 'hero.moveRight()\nhero.moveUp(2)\nprint("点火")\nhero.moveDown(2)\nhero.moveRight(2)\n')

checkMigration(29, 2, ['主场景'], 'hero.moveRight()\nfor i in range(3):\n    hero.moveUp(2)\n    print("点火")\n    hero.moveDown(2)\n    hero.moveRight(2)\n')

test('prototype and integrated lessons retain teacher visibility, section order and optional rescue access', () => {
  const { accessFor, catalog } = require('../level-access')
  const { compareLevels } = require('../curriculum')
  const migrated = catalog.filter(level => level.teachingMap.index >= 22 && level.teachingMap.index <= 29)
  assert.deepEqual([...migrated].sort(compareLevels).map(level => [level.teachingMap.index, level.teachingMap.section, level.teachingMap.lessonOrder]), [
    [26, 1, 6.1], [27, 1, 6.2], [28, 3, 13.1], [29, 3, 13.2],
    [22, 5, 22], [23, 5, 23], [24, 5, 24], [25, 5, 25],
  ])
  assert.deepEqual(migrated.filter(level => level.teachingMap.prototype).map(level => level.teachingMap.index), [22, 23, 24, 25])
  assert.deepEqual(migrated.filter(level => level.teachingMap.optional).map(level => level.teachingMap.index), [27])
  const releases = Object.fromEntries(catalog.map(level => [level.slug, true]))
  const progress = Object.fromEntries(catalog.map(level => [level.slug, { teachingComplete: true }]))
  const hidden = accessFor(catalog, { releases, progress })
  const shown = accessFor(catalog, { releases, progress, visibility: releases })
  for (const level of migrated) {
    assert.equal(hidden[level.slug].reason, 'hidden')
    assert.equal(shown[level.slug].open, true)
    const revoked = accessFor(catalog, { releases, progress, visibility: { ...releases, [level.slug]: false } })
    assert.equal(revoked[level.slug].reason, 'hidden')
  }
  assert.deepEqual(shown['local-python-27'].prerequisites, ['local-python-26'])
  assert.deepEqual(shown['local-python-07'].prerequisites, ['local-python-26'])
  for (const index of [22, 23, 24, 25]) assert.deepEqual(shown[`local-python-${index}`].prerequisites, [])
})

test('reinforcement scenes replace the complete adventure object and changes stay in their scene', () => {
  const [source] = definitions(25)
  source.adventure.obsolete = { health: 999 }
  const before = compileLevels([source])
  assert.deepEqual(before.map(level => level.teachingMap.adventure.actors.map(actor => actor.spawnAt)), [[1, 5, 9], [1, 3.5, 6, 11]])
  assert.equal(Object.hasOwn(before[0].teachingMap.adventure, 'obsolete'), false)
  assert.equal(Object.hasOwn(before[1].teachingMap.adventure, 'obsolete'), false)
  source.scenarios[0].adventure.actors.pop()
  source.scenarios[0].adventure.camp.health = 80
  const after = compileLevels([source])
  assert.deepEqual(after[1], before[1])
  assert.equal(after[0].teachingMap.adventure.actors.length, 2)
  assert.equal(after[0].teachingMap.adventure.camp.health, 80)
  assert.equal(after[0].thangs.some(actor => actor.id === '上路斥候'), false)
  assert.equal(after[0].systems.find(system => system.original === 'facadecccc00000000000001').config.adventureConfig.camp.health, 80)
  after[0].teachingMap.adventure.actors[0].health = 999
  assert.equal(compileLevels([source])[0].teachingMap.adventure.actors[0].health, 40)
})

test('tutorial evidence stays connected to actors and clearing a scene tutorial does not affect its sibling', () => {
  const attack = compileCatalog(definitions(26))[0]
  const signal = compileCatalog(definitions(28))[0]
  assert.deepEqual(attack.catalog.teachingMap.tutorial.steps.map(step => step.evidence), [
    { kind: 'damaged', id: '牢门' }, { kind: 'dead', id: '牢门' }, { kind: 'exit' },
  ])
  assert.deepEqual(signal.catalog.teachingMap.tutorial.steps.map(step => step.evidence), [
    { kind: 'lit', id: '信号台1' }, { kind: 'exit' },
  ])
  const [source] = definitions(26)
  source.scenarios = [{ title: '有引导' }, { title: '独立尝试', tutorial: null, labels: [] }]
  source.labels = [{ x: 12, y: 12, text: '演示' }]
  const levels = compileLevels([source])
  assert.deepEqual(levels.map(level => level.teachingMap.tutorial?.steps.length || 0), [3, 0])
  assert.deepEqual(levels[1].teachingMap.labels, [])
  assert.deepEqual(levels.map(level => level.systems.find(system => system.original === 'facadecccc00000000000001').config.adventureConfig.guided), [true, false])
  levels[0].teachingMap.tutorial.steps[0].evidence.id = '改动'
  assert.equal(compileLevels([source])[0].teachingMap.tutorial.steps[0].evidence.id, '牢门')
  for (const index of [27, 29]) assert.equal(compileCatalog(definitions(index))[0].catalog.teachingMap.tutorial, null)
})
