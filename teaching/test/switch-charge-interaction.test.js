const test = require('node:test')
const assert = require('node:assert/strict')
const { mapObjects, describeObject } = require('../map-inspection')
const design = { index: 14, start: [12, 12], exit: [60, 12], apis: ['press', 'wait'], switches: [{ number: 1, at: [24, 12] }, { number: 2, at: [36, 12] }], decoySwitches: [{ number: 9, at: [48, 12] }] }
async function nativeRules () {
  const fs = require('node:fs'); const os = require('node:os'); const path = require('node:path'); const vm = require('node:vm')
  const express = require('express'); const configure = require('../local-levels')
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'coco-switch-charge-')); const old = process.env.TEACHING_STATE_DIR
  process.env.TEACHING_STATE_DIR = dir
  const app = express(); configure(app); const server = app.listen(0, '127.0.0.1')
  await new Promise(resolve => server.on('listening', resolve))
  const base = `http://127.0.0.1:${server.address().port}`
  try {
    const page = await fetch(base + '/teaching'); const html = await page.text(); const formCookie = page.headers.get('set-cookie').split(';')[0]
    const token = html.match(/name="formToken" value="([0-9a-f]{64})"/)[1]
    const login = await fetch(base + '/teaching/login', { method: 'POST', redirect: 'manual', headers: { cookie: formCookie }, body: new URLSearchParams({ studentId: '99990011', formToken: token }) })
    const cookie = formCookie + '; ' + login.headers.get('set-cookie').split(';')[0]
    const response = await fetch(base + '/db/level.system/facadecccc00000000000001/version/0', { headers: { cookie } })
    assert.equal(response.status, 200)
    return vm.runInNewContext((await response.json()).code, { System: class {} })
  } finally {
    await new Promise(resolve => server.close(resolve))
    if (old === undefined) delete process.env.TEACHING_STATE_DIR; else process.env.TEACHING_STATE_DIR = old
    fs.rmSync(dir, { recursive: true, force: true })
  }
}
function setup (Rules, d = design) {
  const goals = {}; const hero = { pos: { x: 24, y: 12 }, health: 100 }
  const world = { age: 0, getThangByID: id => id === 'Hero Placeholder' ? hero : null, goalManager: { setGoalState: (id, state) => { goals[id] = state }, getGoalState: id => goals[id] } }
  const { start, ...config } = d
  const rules = Object.assign(new Rules(), config, { world, noGems: true })
  hero.world = world
  rules.start()
  const inspect = id => describeObject(mapObjects(d, hero, world).find(o => o.id === id), d, hero, world)
  const tick = time => { world.age = time; rules.updateRules() }
  return { hero, world, rules, inspect, tick, goals }
}

test('native switches and map help share position, sequence, completed and dangerous states', async () => {
  const Rules = await nativeRules()
  for (const x of [24, 25, 25.01]) {
    const { hero, inspect } = setup(Rules); hero.pos.x = x
    const help = inspect('switch-1')
    assert.equal(help.ready, x <= 25)
    assert.equal(hero.press(1), help.ready)
    if (!help.ready) assert.equal(hero.teachingFailure, help.cards[0].status)
  }
  const wrong = setup(Rules); wrong.hero.pos.x = 36
  assert.equal(wrong.inspect('switch-2').ready, false, 'standing on the wrong next switch is not ready')
  const reason = wrong.inspect('switch-2').cards[0].status
  assert.equal(wrong.hero.press(2), false); assert.equal(wrong.hero.teachingFailure, reason)
  const run = setup(Rules)
  assert.equal(run.hero.press(1), true)
  assert.equal(run.inspect('switch-1').ready, false)
  run.hero.pos.x = 36
  assert.equal(run.inspect('switch-2').ready, true)
  assert.equal(run.hero.press(2), true)
  assert.equal(run.inspect('switch-2').ready, false)
  assert.match(run.inspect('switch-2').text, /已经启动/)
  assert.equal(run.goals['press-switches'], 'success')
  const red = setup(Rules); red.hero.pos.x = 48; red.tick(0)
  assert.equal(red.hero.health, 100, 'walking over red plate is safe')
  const danger = red.inspect('switch-9')
  assert.equal(danger.ready, false); assert.match(danger.text, /走过安全/)
  assert.equal(red.hero.press(9), false); assert.equal(red.hero.health, 0)
  assert.equal(red.hero.teachingFailure, danger.cards[0].status)
})

test('native charging and help preserve continuous occupancy, wait timing and completed plates', async () => {
  const Rules = await nativeRules()
  const d = { ...design, switches: [], decoySwitches: [], chargePlates: [{ at: [24, 12], radius: 2, seconds: 1 }, { at: [36, 12], radius: 2, seconds: 1 }] }
  const run = setup(Rules, d); const { hero, inspect, tick } = run
  tick(0); hero.pos.x = 25; tick(0.25)
  assert.equal(JSON.parse(hero.teachingCharge).plates[0].elapsed, 0.25, 'walking within the plate charges it')
  assert.equal(inspect('charge-0').ready, true)
  hero.pos.x = 26; tick(0.5); assert.equal(inspect('charge-0').ready, true, 'radius boundary is occupied')
  hero.pos.x = 26.01; tick(0.6)
  assert.equal(inspect('charge-0').ready, false)
  assert.equal(JSON.parse(hero.teachingCharge).plates[0].elapsed, 0, 'leaving resets unfinished charging')
  hero.pos.x = 24; tick(1)
  assert.equal(hero.wait(), undefined)
  assert.equal(JSON.parse(hero.teachingWait).seconds, 1)
  tick(1.5); assert.equal(hero.wait(), undefined)
  assert.match(inspect('charge-0').cards[0].status, /0.5/)
  tick(2); assert.equal(hero.wait(), 'done')
  assert.equal(inspect('charge-0').ready, false, 'a completed plate needs no further charging')
  assert.match(inspect('charge-0').cards[0].status, /已经点亮/)
  tick(10); assert.equal(JSON.parse(hero.teachingCharge).lit, 1, 'long waiting never charges another plate')
  hero.pos.x = 36; tick(11); tick(12)
  assert.equal(run.goals['charge-plate'], 'success')
  const dead = setup(Rules, d); dead.hero.health = 0; dead.tick(0); dead.tick(1)
  assert.equal(dead.inspect('charge-0').ready, false)
  assert.equal(JSON.parse(dead.hero.teachingCharge).lit, 0)
  const invalid = setup(Rules, d); invalid.hero.wait(0.5)
  assert.match(invalid.hero.teachingFailure, /整数/)
})

test('paused and rewound help uses displayed snapshots, stays read-only and resets on rerun', async () => {
  const Rules = await nativeRules()
  const d = { ...design, chargePlates: [{ at: [24, 12], radius: 2, seconds: 1 }] }
  const run = setup(Rules, d); run.tick(0)
  const snapshot = () => ({ pos: { ...run.hero.pos }, health: run.hero.health, teachingPressedCount: run.hero.teachingPressedCount, teachingCharge: run.hero.teachingCharge })
  const before = snapshot(); run.tick(0.5); const half = snapshot()
  run.hero.press(1); run.tick(1); run.hero.pos.x = 36; run.hero.press(2)
  const after = snapshot(); const completedState = JSON.stringify(run.rules.chargeState)
  const help = (frame, id) => {
    const original = JSON.stringify(frame)
    const result = describeObject(mapObjects(d, frame, run.world).find(o => o.id === id), d, frame, run.world)
    assert.equal(JSON.stringify(frame), original, 'inspection cannot mutate a displayed frame')
    assert.equal(JSON.stringify(run.rules.chargeState), completedState, 'inspection cannot mutate the finished simulation')
    return result
  }
  assert.equal(help(after, 'switch-2').ready, false)
  assert.equal(help(after, 'charge-0').ready, false)
  assert.equal(help(before, 'switch-1').ready, true)
  assert.equal(help(before, 'charge-0').ready, true)
  assert.match(help(half, 'charge-0').cards[0].status, /0.5/)
  assert.match(help(after, 'charge-0').text, /已经点亮/)
  const fresh = setup(Rules, d); fresh.tick(0)
  assert.equal(fresh.inspect('switch-1').ready, true)
  assert.equal(fresh.inspect('charge-0').ready, true)
  assert.equal(JSON.parse(fresh.hero.teachingCharge).lit, 0)
  fresh.hero.pos.x = 36
  assert.equal(fresh.hero.press(1), false, 'execution rechecks position after the prior help')
})
