const test = require('node:test')
const assert = require('node:assert/strict')
const Inventory = require('../item-runtime')
const { mapObjects, describeObject } = require('../map-inspection')
const config = { item: '能量石', unit: '块', supply: { name: '补给箱', at: [12, 24], approach: [12, 12], count: 2 }, receivers: [{ name: '炉座', at: [24, 24], approach: [24, 12], amount: 2 }] }
const design = { index: 7, start: [12, 12], apis: ['take', 'give'], inventory: config }
const world = { age: 0, getThangByID: () => null }
function setup () {
  const hero = { pos: { x: 12, y: 12 } }
  const rules = { world, fail (h, message) { this.failed = true; h.teachingFailure = message } }
  rules.inventory = new Inventory(rules, hero, config)
  return { hero, rules }
}
function help (hero, kind) { return describeObject(mapObjects(design, hero, world).find(o => o.kind === kind), design, hero, world) }
function bag (hero) { return JSON.parse(hero.teachingInventory).bag }

test('claimed supply help refuses repeated pickup and agrees with the actual rejection', () => {
  const { hero } = setup()
  assert.equal(help(hero, 'supply').ready, true)
  assert.equal(hero.take('补给箱'), 2)
  const before = hero.teachingInventory
  const info = help(hero, 'supply')
  assert.equal(info.ready, false)
  assert.equal(hero.teachingInventory, before, 'inspection does not change inventory')
  hero.take('补给箱')
  assert.equal(info.cards[0].status, hero.teachingFailure)
  assert.equal(bag(hero), 2)
})

test('receiver help reports missing supplies and never promises success without an amount', () => {
  const { hero } = setup()
  hero.pos.x = 24
  const empty = help(hero, 'receiver')
  assert.equal(empty.ready, false)
  assert.match(empty.cards[0].status, /先.*领取/)
  hero.pos.x = 12
  hero.take('补给箱')
  hero.pos.x = 24
  const before = hero.teachingInventory
  const partial = help(hero, 'receiver')
  assert.equal(partial.ready, false)
  assert.match(partial.cards[0].status, /位置满足.*数量/)
  assert.equal(hero.teachingInventory, before)
  assert.equal(hero.give('炉座', 2), true)
  const done = help(hero, 'receiver')
  assert.equal(done.ready, false)
  assert.match(done.text, /已交齐/)
  hero.give('炉座', 2)
  assert.equal(done.cards[0].status, hero.teachingFailure)
  assert.equal(bag(hero), 0)
})

test('inventory inspection follows replay snapshots without changing the real transfers', () => {
  const { hero } = setup()
  const firstFrame = hero.teachingInventory
  hero.take('补给箱')
  const takenFrame = hero.teachingInventory
  hero.pos.x = 24
  hero.give('炉座', 2)
  const deliveredFrame = hero.teachingInventory
  assert.match(help(hero, 'receiver').text, /已交齐/)
  hero.teachingInventory = takenFrame
  assert.match(help(hero, 'receiver').cards[0].status, /位置满足.*数量/)
  hero.pos.x = 12
  hero.teachingInventory = firstFrame
  assert.equal(help(hero, 'supply').ready, true)
  assert.equal(hero.teachingInventory, firstFrame)
  hero.teachingInventory = deliveredFrame
  assert.equal(bag(hero), 0)
  assert.equal(help(hero, 'supply').ready, false)
})

test('downloaded native inventory actions agree with help on distances, stock and repeated targets', async () => {
  const fs = require('node:fs'); const os = require('node:os'); const path = require('node:path'); const vm = require('node:vm')
  const express = require('express'); const configure = require('../local-levels')
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'coco-item-interaction-')); const old = process.env.TEACHING_STATE_DIR
  process.env.TEACHING_STATE_DIR = dir
  const app = express(); configure(app); const server = app.listen(0, '127.0.0.1')
  await new Promise(resolve => server.on('listening', resolve))
  const base = `http://127.0.0.1:${server.address().port}`
  try {
    const page = await fetch(base + '/teaching'); const html = await page.text(); const formCookie = page.headers.get('set-cookie').split(';')[0]
    const token = html.match(/name="formToken" value="([0-9a-f]{64})"/)[1]
    const login = await fetch(base + '/teaching/login', { method: 'POST', redirect: 'manual', headers: { cookie: formCookie }, body: new URLSearchParams({ studentId: '99990010', formToken: token }) })
    const cookie = formCookie + '; ' + login.headers.get('set-cookie').split(';')[0]
    const response = await fetch(base + '/db/level.system/facadecccc00000000000001/version/0', { headers: { cookie } })
    assert.equal(response.status, 200)
    // Execute the exact native source response, without a Node require in the engine.
    const Rules = vm.runInNewContext((await response.json()).code, { System: class {} })
    function attempt (inventory = config) {
      const hero = { pos: { x: 12, y: 12 } }
      const frame = { age: 0, getThangByID: id => id === 'Hero Placeholder' ? hero : null, goalManager: { setGoalState () {} } }
      const rules = Object.assign(new Rules(), { world: frame, inventoryConfig: inventory })
      rules.start()
      const d = { ...design, inventory }
      const inspect = kind => describeObject(mapObjects(d, hero, frame).find(o => o.kind === kind), d, hero, frame)
      return { hero, inspect }
    }
    for (const scenario of [
      { y: 12, allowed: true },
      { y: 11.5, allowed: true },
      { y: 11.49, allowed: false },
      { y: 13.11, allowed: false },
    ]) {
      const { hero, inspect } = attempt(); hero.pos.y = scenario.y
      const info = inspect('supply')
      assert.equal(info.ready, scenario.allowed)
      assert.equal(hero.take('补给箱'), scenario.allowed ? 2 : 0)
      assert.equal(bag(hero), scenario.allowed ? 2 : 0)
      if (!scenario.allowed) assert.equal(info.cards[0].status, hero.teachingFailure)
    }
    for (const mode of ['far', 'unclaimed', 'shortage', 'missing-amount', 'negative', 'fraction', 'wrong', 'overdraft', 'duplicate']) {
      const inventory = mode === 'shortage' ? { ...config, supply: { ...config.supply, count: 1 } } : config
      const { hero, inspect } = attempt(inventory)
      if (mode !== 'unclaimed') hero.take('补给箱')
      hero.pos.x = mode === 'far' ? 12 : 24
      if (mode === 'duplicate') assert.equal(hero.give('炉座', 2), true)
      const info = inspect('receiver'); const before = hero.teachingInventory
      const amount = { 'missing-amount': undefined, negative: -1, fraction: 1.5, wrong: 1, overdraft: 3 }[mode]
      hero.give('炉座', ['missing-amount', 'negative', 'fraction', 'wrong', 'overdraft'].includes(mode) ? amount : 2)
      assert.ok(hero.teachingFailure, mode)
      assert.equal(hero.teachingInventory, before, mode + ' cannot consume inventory')
      if (['far', 'unclaimed', 'shortage', 'duplicate'].includes(mode)) assert.equal(info.cards[0].status, hero.teachingFailure, mode)
      else assert.match(info.cards[0].status, /还需.*数量/, 'inspector cannot know the future argument')
    }
    const repeated = { ...config, receivers: [{ ...config.receivers[0], amount: 1 }, { name: '炉座', at: [36, 24], approach: [36, 12], amount: 1 }] }
    const { hero } = attempt(repeated)
    hero.take('补给箱'); hero.pos.x = 24
    const farReceiver = mapObjects({ ...design, inventory: repeated }, hero, world).find(o => o.id === 'receiver-1')
    assert.match(describeObject(farReceiver, { ...design, inventory: repeated }, hero, world).cards[0].status, /还没有走到/)
    assert.equal(hero.give('炉座', 1), true); hero.pos.x = 36; assert.equal(hero.give('炉座', 1), true)
    assert.equal(bag(hero), 0)
    assert.ok(JSON.parse(hero.teachingInventory).receivers.every(r => r.delivered))
  } finally {
    await new Promise(resolve => server.close(resolve))
    if (old === undefined) delete process.env.TEACHING_STATE_DIR; else process.env.TEACHING_STATE_DIR = old
    fs.rmSync(dir, { recursive: true, force: true })
  }
})
