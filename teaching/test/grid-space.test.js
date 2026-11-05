const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs'); const vm = require('node:vm'); const path = require('node:path')
const { CELL_SIZE, cellsFor } = require('../grid-space')
const Rules = vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../rules-system.js'), 'utf8'), { System: class {} })
function speak (x, y, walls = []) {
  const guard = {}; const hero = {}; const gate = { id: 'Guard', at: [36, 12], approach: [24, 12], password: '自己人' }
  const rules = Object.assign(new Rules(), { world: { age: 0, getThangByID: () => guard }, gates: [gate], walls })
  rules.receiveSpeech({ x, y, text: '自己人', time: 0 }, hero)
  return gate.openedAt != null
}
test('guard speech works from the adjacent approach cell, not beyond it, diagonally or through masonry', () => {
  assert.equal(speak(24, 12), true)
  assert.equal(speak(24.3, 12), true, 'small native arrival drift is tolerated')
  for (const [x, y] of [[22.5, 12], [12, 12], [24, 24], [48, 12], [36, 24]]) assert.equal(speak(x, y), false, `${x},${y}`)
  assert.equal(speak(24, 12, [{ x: 30, y: 12, halfWidth: 2, halfHeight: 2 }]), false)
})
test('every scene uses the same movement cell size and renders original walkable centres', () => {
  for (const d of require('../map-designs')) {
    for (const [i, s] of (d.scenarios || [{}]).entries()) {
      const scene = { ...d, ...s }; const cells = cellsFor(scene)
      const level = require(`../levels/scenarios/local-python-${String(d.index).padStart(2, '0')}-${i}.json`)
      const motion = level.systems.find(s => s.original === '528113240268d018e300000c')
      assert.equal(motion.config.simpleMoveDistance, CELL_SIZE)
      assert.ok(cells.some(c => c.x === scene.start[0] && c.y === scene.start[1]), `${d.index}/${i} start`)
      assert.equal(new Set(cells.map(c => `${c.x},${c.y}`)).size, cells.length)
    }
  }
})
test('hero head-to-foot height occupies a readable fraction of a horizontal cell', () => {
  const type = require('../hero-types').deepseekType()
  const atlas = require('../assets/characters/deepseek-actions-v1.json')
  const ratio = atlas.anchor[1] * type.scale / (CELL_SIZE * 10)
  assert.ok(ratio >= 0.7 && ratio <= 0.9, `hero/cell height ${ratio}`)
})
