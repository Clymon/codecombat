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

function checkMigration (index, scenes, code) {
  test(`level ${index} independently compiles its native scenes and matching catalog/reference`, () => {
    const sources = definitions(index)
    const slug = `local-python-${index}`
    const levels = compileLevels(sources)
    assert.equal(levels.length, scenes.length, 'the complete authoring definition produces every scene without legacy fallback')
    const baselines = scenes.map((title, scene) => JSON.parse(fs.readFileSync(path.join(__dirname, `../levels/scenarios/${slug}-${scene}.json`), 'utf8')))
    assert.deepEqual(levels, baselines)
    const [entry] = compileCatalog(sources)
    assert.equal(entry.catalog.teachingMap.revision, 2)
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

checkMigration(30, ['遇到落单斥候', '遇到门廊哨兵'], 'hero.moveRight()\nenemy = hero.findNearestEnemy()\nhero.attack(enemy)\nhero.moveRight(2)\n')

checkMigration(31, ['通道里有斥候', '空通道，没有敌人', '换岗了，遇到另一名哨兵'], 'hero.moveRight()\nenemy = hero.findNearestEnemy()\nif enemy:\n    hero.attack(enemy)\nhero.moveRight(2)\n')

checkMigration(32, ['主场景'], 'print(isVictory())\nhero.wait(1)\nenemy = hero.findNearestEnemy()\nif enemy:\n    hero.attack(enemy)\n')

checkMigration(33, ['三名敌人，分批到来', '四名敌人，间隔变短'], 'while not isVictory():\n    enemy = hero.findNearestEnemy()\n    if enemy:\n        hero.attack(enemy)\n')

test('enemy present, absent and changed identity scenes replace the full actor configuration independently', () => {
  const [source] = definitions(31)
  source.adventure.obsolete = { health: 999 }
  const before = compileLevels([source])
  assert.deepEqual(before.map(level => level.teachingMap.adventure.actors.map(actor => actor.id)), [['落单斥候'], [], ['门廊哨兵']])
  for (const level of before) assert.equal(Object.hasOwn(level.teachingMap.adventure, 'obsolete'), false)
  assert.equal(before[1].thangs.some(actor => ['落单斥候', '门廊哨兵'].includes(actor.id)), false)
  source.scenarios[0].adventure.actors[0].health = 40
  const after = compileLevels([source])
  assert.deepEqual(after.slice(1), before.slice(1))
  assert.equal(after[0].teachingMap.adventure.actors[0].health, 40)
  after[2].teachingMap.adventure.actors[0].id = '改动'
  assert.equal(compileLevels([source])[2].teachingMap.adventure.actors[0].id, '门廊哨兵')
})

test('tutorial evidence, default visibility and optional challenge placement remain available to teachers', () => {
  const { accessFor, catalog } = require('../level-access')
  const migrated = catalog.filter(level => level.teachingMap.index >= 30 && level.teachingMap.index <= 33)
  assert.deepEqual(migrated.map(level => [level.teachingMap.section, level.teachingMap.lessonOrder, !!level.teachingMap.optional]), [
    [2, 8.1, false], [2, 9.1, false], [4, 19.1, false], [4, 19.2, true],
  ])
  assert.deepEqual(migrated.map(level => level.teachingMap.tutorial?.steps.map(step => step.evidence.kind) || []), [
    ['enemies-cleared', 'exit'], ['enemies-cleared', 'exit'], ['enemy-arrived', 'victory'], [],
  ])
  const releases = Object.fromEntries(catalog.map(level => [level.slug, true]))
  const progress = Object.fromEntries(catalog.map(level => [level.slug, { teachingComplete: true }]))
  const hidden = accessFor(catalog, { releases, progress })
  const shown = accessFor(catalog, { releases, progress, visibility: releases })
  for (const level of migrated) {
    assert.equal(hidden[level.slug].reason, 'hidden')
    assert.equal(shown[level.slug].open, true)
    assert.equal(accessFor(catalog, { releases, progress, visibility: { ...releases, [level.slug]: false } })[level.slug].reason, 'hidden')
  }
  assert.deepEqual(shown['local-python-33'].prerequisites, ['local-python-32'])
  const [source] = definitions(31)
  source.scenarios[1].tutorial = null
  const scenes = compileLevels([source])
  assert.deepEqual(scenes.map(level => level.systems.find(system => system.original === 'facadecccc00000000000001').config.adventureConfig.guided), [true, false, true])
  assert.equal(scenes[1].teachingMap.tutorial, null)
})

test('reinforcement timing and native goals retain every wave in independent scenes', () => {
  const [source] = definitions(33)
  const before = compileLevels([source])
  const config = level => level.systems.find(system => system.original === 'facadecccc00000000000001').config
  assert.deepEqual(before.map(level => config(level).adventureConfig.actors.map(actor => actor.spawnAt)), [[1, 5, 9], [1, 3.5, 6, 11]])
  for (const level of before) {
    assert.deepEqual(level.teachingMap.goals, [{ id: 'defend-camp', name: '保护营火，击败全部敌人' }])
    assert.equal(config(level).adventureConfig.mode, 'defend')
    assert.equal(config(level).adventureConfig.camp.health, 100)
    assert.equal(config(level).adventureConfig.guided, false)
  }
  source.scenarios[0].adventure.actors.pop()
  source.scenarios[0].adventure.camp.health = 80
  const after = compileLevels([source])
  assert.deepEqual(after[1], before[1])
  assert.equal(config(after[0]).adventureConfig.camp.health, 80)
  assert.equal(after[0].thangs.some(actor => actor.id === '上路斥候'), false)
  const preparation = config(compileLevels(definitions(32))[0])
  assert.deepEqual(preparation.adventureConfig.actors.map(actor => actor.spawnAt), [1])
  assert.equal(preparation.adventureConfig.guided, true)
})
