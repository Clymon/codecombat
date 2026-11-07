const test = require('node:test')
const assert = require('node:assert/strict')
const { mapObjects, describeObject } = require('../map-inspection')
async function nativeRules () {
  const fs = require('node:fs'); const os = require('node:os'); const path = require('node:path'); const vm = require('node:vm')
  const express = require('express'); const configure = require('../local-levels')
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'coco-combat-signal-')); const old = process.env.TEACHING_STATE_DIR
  process.env.TEACHING_STATE_DIR = dir
  const app = express(); configure(app); const server = app.listen(0, '127.0.0.1')
  await new Promise(resolve => server.on('listening', resolve))
  const base = `http://127.0.0.1:${server.address().port}`
  try {
    const page = await fetch(base + '/teaching'); const html = await page.text(); const formCookie = page.headers.get('set-cookie').split(';')[0]
    const token = html.match(/name="formToken" value="([0-9a-f]{64})"/)[1]
    const login = await fetch(base + '/teaching/login', { method: 'POST', redirect: 'manual', headers: { cookie: formCookie }, body: new URLSearchParams({ studentId: '99990012', formToken: token }) })
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
function setup (Rules, mode = 'rescue') {
  const actors = mode === 'signals'
    ? [{ id: '信号甲', kind: 'signal', at: [24, 12] }, { id: '信号乙', kind: 'signal', at: [48, 12] }]
    : [{ id: '敌甲', kind: 'enemy', at: [36, 12], health: 20, speed: 0, aggro: 0 }, { id: '敌乙', kind: 'enemy', at: [60, 12], health: 40, speed: 0, aggro: 0 }, { id: '牢门', kind: 'door', at: [36, 36], health: 40 }, { id: '友军', kind: 'ally', at: [60, 36], health: 100, speed: 0, releaseBy: '牢门' }]
  const d = { index: 25, start: [12, 12], exit: [84, 48], apis: ['attack', 'findNearestEnemy', 'pathOpen', 'nextTileSafe', 'readSignal', 'pathLength', 'atBeacon', 'isVictory'], adventure: { mode, actors, camp: { at: [12, 36], health: 100 } } }
  const hero = { id: 'Hero Placeholder', pos: { x: 12, y: 12 }, health: 100, maxSpeed: 12, say () {}, setTargetPos (pos) { this.targetPos = pos } }
  const thangs = actors.map(a => ({ id: a.id, pos: { x: a.at[0], y: a.at[1] } }))
  const goals = {}
  const world = { age: 0, dt: 0.05, getThangByID: id => id === hero.id ? hero : thangs.find(a => a.id === id), goalManager: { setGoalState: (id, state) => { goals[id] = state }, getGoalState: id => goals[id] } }
  const rules = Object.assign(new Rules(), { world, exit: d.exit, bounds: { x1: 0, y1: 0, x2: 96, y2: 60 }, walls: [], hazards: [], noGems: true, adventureConfig: structuredClone(d.adventure), maxActions: 100, sensor: { open: { right: true }, length: 4, signal: 80 } })
  hero.world = world; rules.start()
  const inspect = (id, frame = hero) => describeObject(mapObjects(d, frame, world).find(o => o.id === id), d, frame, world)
  const tick = () => { world.age += world.dt; rules.updateRules() }
  const attack = target => {
    for (let i = 0; i < 200; i++) { const done = hero.attack(target) === 'done'; tick(); if (done) return }
    assert.fail('attack did not finish')
  }
  return { d, hero, world, rules, inspect, tick, attack, goals }
}

function clickEnemy (run, id) {
  const { JSDOM } = require('jsdom')
  const dom = new JSDOM('<div id="level-view"><canvas></canvas></div>', { url: 'http://localhost/teaching' })
  const saved = { window: global.window, document: global.document, Backbone: global.Backbone }
  global.window = dom.window; global.document = dom.window.document
  global.Backbone = { Mediator: { subscribe () {}, unsubscribe () {} } }
  let view
  try {
    const root = document.querySelector('#level-view'); const canvas = root.querySelector('canvas')
    canvas.getBoundingClientRect = () => ({ left: 0, top: 0, right: 960, bottom: 600, width: 960, height: 600 })
    const camera = { zoom: 1, y2x: 1, canvasWidth: 960, canvasHeight: 600, worldToCanvas: p => ({ x: p.x * 10, y: 600 - p.y * 10 }) }
    const ink = new Proxy({}, { get: () => () => ink })
    view = new (require('../map-inspector-view'))(root, run.d, { normalCanvas: [canvas], camera })
    view.update(run.hero, run.world, ink)
    const object = mapObjects(run.d, run.hero, run.world).find(o => o.id === id)
    const before = JSON.stringify({ position: run.hero.pos, adventure: run.hero.teachingAdventure, age: run.world.age })
    canvas.dispatchEvent(new window.MouseEvent('click', { bubbles: true, clientX: object.at[0] * 10, clientY: 600 - object.at[1] * 10 - 40 }))
    assert.equal(view.selected, id)
    assert.equal(view.panel.hidden, false)
    assert.equal(JSON.stringify({ position: run.hero.pos, adventure: run.hero.teachingAdventure, age: run.world.age }), before)
  } finally {
    view?.destroy(); dom.window.close()
    for (const [key, value] of Object.entries(saved)) { if (value === undefined) delete global[key]; else global[key] = value }
  }
}

test('downloaded native attacks and map help agree on explicit, dead and friendly targets', async () => {
  const Rules = await nativeRules()
  const run = setup(Rules)
  assert.match(run.inspect('actor-敌甲').cards[0].status, /自动走近/)
  const selected = run.hero.findNearestEnemy()
  clickEnemy(run, 'actor-敌乙')
  run.attack(selected)
  assert.ok(run.hero.pos.x > 12, 'a remote code target is automatically approached')
  assert.equal(run.world.getThangByID('敌甲').health, 0)
  assert.equal(run.world.getThangByID('敌乙').health, 40, 'inspecting another enemy never selects the code target')
  const dead = run.inspect('actor-敌甲')
  assert.equal(dead.ready, false)
  run.attack(selected)
  assert.equal(run.hero.teachingFailure, dead.cards[0].status)
  assert.equal(run.world.getThangByID('敌乙').health, 40, 'stale code target cannot redirect to a living enemy')
  const friendly = setup(Rules)
  assert.equal(friendly.inspect('actor-友军').ready, false)
  friendly.attack('友军')
  assert.match(friendly.hero.teachingFailure, /友方/)
  for (const x of [29.49, 29.5, 29.51]) {
    const edge = setup(Rules); edge.hero.pos.x = x
    const help = edge.inspect('actor-敌甲')
    assert.equal(help.ready, true, 'distance never blocks an eligible auto-approach attack')
    assert.match(help.cards[0].status, x < 29.5 ? /自动走近/ : /攻击距离/)
    edge.hero.attack('敌甲')
    assert.equal(edge.hero.action, x < 29.5 ? 'move' : 'attack')
  }
  for (const x of [37.99, 38, 38.01]) {
    const moving = setup(Rules); moving.hero.pos.x = 30
    moving.hero.attack('敌甲')
    moving.world.getThangByID('敌甲').pos.x = x
    moving.world.age = 0.3; moving.hero.attack('敌甲')
    assert.equal(moving.world.getThangByID('敌甲').health, x <= 38 ? 0 : 20, 'a moving target is rechecked at the unchanged hit radius')
  }
  const interrupted = setup(Rules); interrupted.hero.pos.x = 30
  interrupted.hero.attack('敌甲')
  interrupted.rules.hazards = [[36, 12]]; interrupted.tick()
  assert.equal(interrupted.hero.attack('敌甲'), undefined, 'losing the target does not shorten an already-started swing')
  interrupted.world.age = 0.7
  assert.equal(interrupted.hero.attack('敌甲'), 'done')
  assert.equal(interrupted.hero.maxSpeed, 12)
  assert.match(interrupted.hero.teachingFailure, /重新寻找/)
  assert.equal(interrupted.rules.failed, undefined, 'a target lost during an in-flight swing ends that action without failing the run')
  assert.equal(interrupted.world.getThangByID('敌乙').health, 40)
  const door = setup(Rules); door.hero.pos = { x: 24, y: 36 }; door.attack('牢门')
  assert.equal(door.world.getThangByID('牢门').health, 20)
})

test('downloaded native signals and help share proximity, spoken phrase and completed state', async () => {
  const Rules = await nativeRules()
  for (const x of [19.99, 20, 20.01]) {
    const run = setup(Rules, 'signals'); run.hero.pos.x = x
    const help = run.inspect('actor-信号甲')
    assert.equal(help.ready, x >= 20)
    run.hero.say('点火'); run.tick()
    assert.equal(JSON.parse(run.hero.teachingAdventure).actors[0].lit, x >= 20)
    if (x < 20) assert.equal(run.hero.teachingFailure, help.cards[0].status)
  }
  const run = setup(Rules, 'signals'); run.hero.pos.x = 24
  assert.match(run.inspect('actor-信号甲').cards[0].status, /口令/)
  run.hero.say('出发'); run.tick()
  assert.match(run.hero.teachingFailure, /没有回应/)
  assert.equal(run.goals['signal-1'], undefined)
  run.inspect('actor-信号乙')
  run.hero.say('点火'); run.tick()
  assert.equal(run.goals['signal-1'], 'success')
  assert.equal(run.goals['signal-2'], undefined, 'map inspection does not select the speech recipient')
  const done = run.inspect('actor-信号甲')
  assert.equal(done.ready, false)
  assert.match(done.cards[0].status, /已经点亮/)
  const litAt = JSON.parse(run.hero.teachingAdventure).actors[0].litAt
  run.hero.say('点火'); run.tick()
  assert.equal(JSON.parse(run.hero.teachingAdventure).actors[0].litAt, litAt, 'repeat speech cannot ignite twice')
})

test('replay help uses serialized actor positions and state without reading a future live target', async () => {
  const Rules = await nativeRules()
  const run = setup(Rules); run.hero.pos.x = 30
  const before = { pos: { ...run.hero.pos }, teachingAdventure: run.hero.teachingAdventure }
  run.world.getThangByID('敌甲').pos.x = 48
  run.tick(); run.attack('敌甲')
  const after = { pos: { ...run.hero.pos }, teachingAdventure: run.hero.teachingAdventure }
  const original = JSON.stringify({ before, after, current: run.hero.teachingAdventure })
  assert.equal(run.inspect('actor-敌甲', after).ready, false)
  assert.deepEqual(mapObjects(run.d, before, run.world).find(o => o.id === 'actor-敌甲').at, [36, 12])
  assert.match(run.inspect('actor-敌甲', before).cards[0].status, /攻击距离/)
  assert.equal(run.inspect('actor-敌甲', after).ready, false)
  assert.equal(JSON.stringify({ before, after, current: run.hero.teachingAdventure }), original)
  const signals = setup(Rules, 'signals'); signals.hero.pos.x = 24
  const unlit = { pos: { ...signals.hero.pos }, teachingAdventure: signals.hero.teachingAdventure }
  signals.hero.say('点火'); signals.tick()
  assert.equal(signals.inspect('actor-信号甲').ready, false)
  assert.equal(signals.inspect('actor-信号甲', unlit).ready, true)
  assert.equal(signals.inspect('actor-信号甲').ready, false)
  assert.equal(setup(Rules).inspect('actor-敌甲').ready, true, 'rerun starts fresh')
})

test('native global and hero queries are available at a distance and help never promises movement', async () => {
  const Rules = await nativeRules()
  const run = setup(Rules, 'defend')
  const heroHelp = run.inspect('hero')
  assert.match(heroHelp.cards.find(c => c.name === 'atBeacon').condition, /不会移动/)
  assert.match(heroHelp.cards.find(c => c.name === 'findNearestEnemy').condition, /不会移动/)
  assert.match(run.inspect('environment').cards.find(c => c.name === 'print').condition, /说话/)
  for (const card of run.inspect('environment').cards.filter(c => c.name !== 'print')) assert.match(card.condition, /不会移动/)
  const before = JSON.stringify({ pos: run.hero.pos, targetPos: run.hero.targetPos, action: run.hero.action, intent: run.hero.intent, age: run.world.age })
  run.inspect('actor-敌乙')
  assert.equal(run.hero.findNearestEnemy().id, '敌甲')
  assert.equal(run.hero.pathOpen('right'), true)
  assert.equal(run.hero.pathOpen('left'), false)
  assert.equal(run.hero.nextTileSafe(), true)
  assert.equal(run.hero.readSignal(), 80)
  assert.equal(run.hero.pathLength(), 4)
  assert.equal(run.hero.atBeacon(), false)
  assert.equal(run.hero.isVictory(), false)
  assert.throws(() => run.hero.pathOpen('north'), /方向请用/)
  assert.equal(JSON.stringify({ pos: run.hero.pos, targetPos: run.hero.targetPos, action: run.hero.action, intent: run.hero.intent, age: run.world.age }), before)
  run.hero.pos = { x: 84, y: 48 }
  assert.equal(run.hero.atBeacon(), true)
})
