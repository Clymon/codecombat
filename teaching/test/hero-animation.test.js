const test = require('node:test'); const assert = require('node:assert/strict')
const fs = require('node:fs'); const path = require('node:path'); const vm = require('node:vm')
const { heroPose, directionFor, applyHeroFrame } = require('../hero-animation')
const Rules = vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../rules-system.js'), 'utf8'), { System: class {} })
const state = (action, since, more = {}) => ({ health: 100, rotation: 0, teachingVisual: JSON.stringify({ action, since, ...more }) })

test('movement has four independent directions, without mirrored weapons', () => {
  assert.deepEqual([0, Math.PI / 2, Math.PI, -Math.PI / 2, -Math.PI, 2 * Math.PI].map(directionFor), ['right', 'back', 'left', 'fore', 'left', 'right'])
  for (const rotation of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
    const hero = { ...state('move', 1), rotation }
    assert.equal(heroPose(hero, 1.3).action, 'move_' + directionFor(rotation))
    assert.equal(heroPose(hero, 1.3).frame, 2)
    assert.deepEqual(heroPose(hero, 1.3), heroPose(hero, 1.3), 'paused replay is stable')
    assert.equal(heroPose(hero, 1.05).frame, 0, 'rewind restores an earlier stride')
  }
})

test('attack impact is .25 seconds; each consecutive attack begins a new wind-up', () => {
  const h = state('attack', 5)
  assert.deepEqual([5, 5.15, 5.25, 5.55].map(t => heroPose(h, t).frame), [0, 1, 2, 3])
  assert.equal(heroPose(state('attack', 5.7), 5.7).frame, 0)
})

test('hurt and death follow recorded times; death stays down and rewind/new runs restore the hero', () => {
  assert.equal(heroPose(state('move', 1, { hurtAt: 2 }), 2.1).action, 'hurt')
  assert.equal(heroPose(state('move', 1, { hurtAt: 2 }), 2.5).action, 'move_right')
  const h = { ...state('die', 3, { diedAt: 3, hurtAt: 3 }), health: 0 }
  assert.deepEqual(heroPose(h, 3.4), { action: 'die', frame: 2 })
  assert.deepEqual(heroPose(h, 30), { action: 'die', frame: 3 })
  assert.equal(heroPose(state('move', 1), 2).action, 'move_right')
  assert.equal(heroPose({ health: 100, rotation: 0 }, 0).action, 'idle_right')
})

test('visual recording is read-only for game state and captures early-return damage and consecutive swings', () => {
  const hero = { pos: { x: 12, y: 12 }, health: 100, action: 'idle', addTrackedProperties () {}, keepTrackedProperty () {} }
  const world = { age: 0, getThangByID: () => hero }
  const r = Object.assign(new Rules(), { world })
  r.updateRules = () => 'same game result'
  assert.equal(r.update(), 'same game result')
  assert.equal(JSON.parse(hero.teachingVisual).action, 'idle')
  world.age = 1; hero.pos.x = 14; r.update()
  assert.equal(JSON.parse(hero.teachingVisual).action, 'move')
  world.age = 1.1; hero.health = 80; r.update()
  assert.equal(JSON.parse(hero.teachingVisual).hurtAt, 1.1)
  r.adventure = { swing: { started: 2 } }; world.age = 2; r.update()
  assert.equal(JSON.parse(hero.teachingVisual).since, 2)
  r.adventure.swing.started = 2.7; world.age = 2.7; r.update()
  assert.equal(JSON.parse(hero.teachingVisual).since, 2.7)
  world.age = 3; hero.health = 0; r.update()
  world.age = 3.5; r.update()
  assert.equal(JSON.parse(hero.teachingVisual).diedAt, 3)
  assert.deepEqual(hero.pos, { x: 14, y: 12 }); assert.equal(hero.action, 'idle'); assert.equal(hero.health, 0)
})

test('atlas frames exist inside the shipped transparent PNG and use one foot registration', () => {
  const atlas = require('../assets/characters/deepseek-actions-v1.json')
  const png = fs.readFileSync(path.join(__dirname, '../assets/characters', atlas.image))
  const width = png.readUInt32BE(16); const height = png.readUInt32BE(20)
  assert.equal(png[25], 6, 'PNG uses RGBA')
  for (const value of Object.values(atlas.animations)) {
    for (const [x, y, w, h, ax, ay] of value.rasterFrames) {
      assert.ok(x >= 0 && y >= 0 && x + w <= width && y + h <= height)
      assert.deepEqual([ax, ay], [160, 280])
    }
  }
  assert.equal(Object.values(atlas.animations).reduce((n, a) => n + a.rasterFrames.length, 0), 44)
})

test('native replay frame selection pauses the sprite and uses the native layer sprite', () => {
  const seen = []
  const sprite = { spriteSheetPrefix: 'skin-', spriteSheet: { getAnimation: name => name === 'skin-attack_right' && { frames: [11, 12, 13, 14] } }, gotoAndStop: action => seen.push(action), _gotoAndStop: frame => seen.push(frame) }
  const lank = { sprite, actions: { attack_right: {} }, updateScale () {} }
  applyHeroFrame(lank, state('attack', 0), 0.3)
  assert.deepEqual(seen, ['attack_right', 13])
  assert.equal(lank.sprite, sprite)
})
