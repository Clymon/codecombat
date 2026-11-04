const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs'); const path = require('node:path')
const { readLevel } = require('../local-levels')
const { FLOOR_TYPES, floorShape, isLocalType } = require('../local-type-ids')
const { floorType, sceneryBounds } = require('../village-scenes')
const { companionPose } = require('../companion-reactions')

test('all formal scenes change only floor/hero art while preserving physics, goals and saved progress revisions', () => {
  const dirs = ['../levels', '../levels/scenarios']
  for (const dir of dirs) {
    for (const file of fs.readdirSync(path.join(__dirname, dir)).filter(f => /^local-python-\d+(?:-\d+)?\.json$/.test(f))) {
      const original = JSON.parse(fs.readFileSync(path.join(__dirname, dir, file)))
      const scene = dir.endsWith('scenarios') ? Number(file.match(/-(\d+)\.json$/)[1]) : 0
      const served = readLevel(original.slug, scene)
      assert.deepEqual(served.systems, original.systems)
      assert.deepEqual(served.goals, original.goals)
      assert.equal(served.teachingMap.revision, original.teachingMap.revision)
      assert.deepEqual(served.thangs.map(t => t.components), original.thangs.map(t => t.components))
      assert.deepEqual(served.thangs.map(t => t.id), original.thangs.map(t => t.id))
      const expectedFloor = FLOOR_TYPES[original.teachingMap.section - 1]
      for (let i = 0; i < served.thangs.length; i++) {
        if (original.thangs[i].id === 'Hero Placeholder') continue
        if (expectedFloor && original.thangs[i].thangType === require('../common/dungeon-floor.json').original) {
          const shape = floorShape(served.thangs[i].thangType)
          const pos = original.thangs[i].components.find(c => c.original === '524b75ad7fc0f6d519000001').config.pos
          assert.equal(shape.section, original.teachingMap.section)
          const bounds = sceneryBounds(original.teachingMap)
          if (shape.width && shape.height) {
            assert.ok(pos.x - 10 + shape.left >= bounds[0])
            assert.ok(pos.x - 10 + shape.left + shape.width <= bounds[2])
            assert.ok(pos.y - 8.5 + shape.bottom >= bounds[1])
            assert.ok(pos.y - 8.5 + shape.bottom + shape.height <= bounds[3])
          }
          assert.equal(floorType(served.thangs[i].thangType).shadow, 0)
        } else assert.equal(served.thangs[i].thangType, original.thangs[i].thangType)
      }
    }
  }
  const clips = new Set()
  for (const file of fs.readdirSync(path.join(__dirname, '../levels')).filter(f => /^local-python-\d+\.json$/.test(f))) {
    for (const t of readLevel(file.slice(0, -5)).thangs) if (floorShape(t.thangType)) clips.add(t.thangType)
  }
  assert.equal(new Set([...clips].map(id => floorType(id).slug)).size, clips.size, 'sprite atlas keys must be unique for every clip')
  for (const id of FLOOR_TYPES) {
    assert.equal(isLocalType(id), true)
    assert.deepEqual(floorType(id).components, require('../common/dungeon-floor.json').components)
  }
})

test('companion reacts to recorded events, rewinds, and never celebrates readiness alone', () => {
  const hero = { health: 100, teachingExitReady: true, teachingExitStartedAt: -1 }
  assert.equal(companionPose(hero, [], 10).mood, 'calm')
  const gate = { teachingGateStatus: 'opening', teachingGateMessageAt: 3 }
  assert.equal(companionPose(hero, [gate], 3.5).mood, 'cheer')
  assert.equal(companionPose(hero, [gate], 2).mood, 'calm')
  hero.teachingAdventure = JSON.stringify({ events: [{ kind: 'ignite', at: 5 }] })
  assert.equal(companionPose(hero, [], 5.4).mood, 'cheer')
  assert.equal(companionPose(hero, [], 6.4).mood, 'calm')
  hero.teachingExitStartedAt = 7
  assert.equal(companionPose(hero, [], 7.5).mood, 'cheer')
  hero.teachingVisual = JSON.stringify({ hurtAt: 7.3 })
  assert.equal(companionPose(hero, [], 7.5).mood, 'surprised')
  assert.equal(companionPose({ health: 0 }, [], 10).mood, 'surprised')
  assert.equal(companionPose({ health: 100, teachingExitStartedAt: -1 }, [], 0).mood, 'calm')
})
