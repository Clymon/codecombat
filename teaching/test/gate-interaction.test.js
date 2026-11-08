const test = require('node:test')
const assert = require('node:assert/strict')
const { mapObjects, describeObject } = require('../map-inspection')
const gate = { id: 'Post', at: [36, 12], aside: [36, 24], approach: [24, 12], password: '自己人' }
const wall = { x: 30, y: 12, halfWidth: 2, halfHeight: 2 }
const design = { index: 5, start: [12, 12], apis: ['say'], gates: [gate], walls: [wall] }
function info (d, hero, actor) {
  const world = { getThangByID: () => actor }
  return describeObject(mapObjects(d, hero, world).find(o => o.kind === 'gate'), d, hero, world)
}
test('guard help refuses speech through masonry and explains what to change', () => {
  const hero = { pos: { x: 24, y: 12 } }
  const help = info(design, hero)
  assert.equal(help.ready, false)
  assert.match(help.cards.find(c => c.name === 'say').status, /隔.*墙/)
})

test('native delivered rules and help agree on guard position, walls and state', async () => {
  const fs = require('node:fs'); const os = require('node:os'); const path = require('node:path'); const vm = require('node:vm')
  const express = require('express'); const setup = require('../local-levels')
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'coco-gate-rules-')); const old = process.env.TEACHING_STATE_DIR
  process.env.TEACHING_STATE_DIR = dir
  const app = express(); setup(app); const server = app.listen(0, '127.0.0.1')
  await new Promise(resolve => server.on('listening', resolve))
  const base = `http://127.0.0.1:${server.address().port}`
  try {
    const page = await fetch(base + '/teaching'); const html = await page.text(); const formCookie = page.headers.get('set-cookie').split(';')[0]
    const token = html.match(/name="formToken" value="([0-9a-f]{64})"/)[1]
    const login = await fetch(base + '/teaching/login', { method: 'POST', redirect: 'manual', headers: { cookie: formCookie }, body: new URLSearchParams({ studentId: '99990009', formToken: token }) })
    const cookie = formCookie + '; ' + login.headers.get('set-cookie').split(';')[0]
    const response = await fetch(base + '/db/level.system/facadecccc00000000000001/version/0', { headers: { cookie } })
    assert.equal(response.status, 200)
    const native = await response.json()
    // Evaluate exactly what the native engine downloads, with no Node require.
    const Rules = vm.runInNewContext(native.code, { System: class {} })
    for (const scenario of [
      { name: 'near', x: 24, y: 12, ready: true },
      { name: 'approach edge', x: 25, y: 12, ready: true },
      { name: 'hearing edge', x: 23.5, y: 12, ready: true },
      { name: 'outside hearing', x: 23.49, y: 12, ready: false },
      { name: 'outside approach', x: 25.01, y: 12, ready: false },
      { name: 'wall', x: 24, y: 12, walls: [wall], ready: false, reason: /隔.*墙/ },
      { name: 'locked', x: 24, y: 12, locked: true, ready: false },
      { name: 'open', x: 24, y: 12, openedAt: 0, ready: false },
    ]) {
      const g = { ...gate, locked: scenario.locked, openedAt: scenario.openedAt }
      const d = { ...design, gates: [g], walls: scenario.walls || [] }
      const hero = { pos: { x: scenario.x, y: scenario.y } }; const guard = { pos: { x: 36, y: 12 }, teachingGateStatus: scenario.openedAt == null ? 'waiting' : 'open' }
      const before = JSON.stringify({ d, hero, guard })
      const help = info(d, hero, guard)
      assert.equal(help.ready, scenario.ready, scenario.name + ' help')
      assert.equal(JSON.stringify({ d, hero, guard }), before, 'help is read-only')
      const rules = Object.assign(new Rules(), { gates: [g], walls: d.walls, world: { age: 2, getThangByID: () => guard } })
      rules.receiveSpeech({ ...hero.pos, text: '自己人', time: 2 }, hero)
      assert.equal(g.openedAt === 2, scenario.ready, scenario.name + ' execution')
      if (scenario.reason) {
        assert.match(hero.teachingFailure, scenario.reason)
        assert.match(help.cards.find(c => c.name === 'say').status, scenario.reason)
      }
    }
  } finally {
    await new Promise(resolve => server.close(resolve))
    if (old === undefined) delete process.env.TEACHING_STATE_DIR; else process.env.TEACHING_STATE_DIR = old
    fs.rmSync(dir, { recursive: true, force: true })
  }
})

test('guard inspection follows displayed replay frames rather than a later opened gate', () => {
  const d = { ...design, walls: [], gates: [{ ...gate, openedAt: 5 }] }
  const hero = { pos: { x: 24, y: 12 } }
  const actor = { pos: { x: 36, y: 24 }, teachingGateStatus: 'open' }
  assert.match(info(d, hero, actor).text, /让开/)
  actor.pos = { x: 36, y: 12 }; actor.teachingGateStatus = 'waiting'
  const rewound = info(d, hero, actor)
  assert.equal(rewound.ready, true)
  assert.ok(rewound.cards.some(c => c.name === 'say'))
  assert.match(rewound.cards.find(c => c.name === 'say').status, /正确口令/)
  actor.teachingGateStatus = 'opening'
  assert.equal(info(d, hero, actor).ready, false)
  assert.match(info(d, hero, actor).text, /正在/)
})

test('map help uses native level wall geometry when the displayed design has no walls', () => {
  const { JSDOM } = require('jsdom')
  const dom = new JSDOM('<div id="level-view"><canvas></canvas></div>', { url: 'http://localhost/teaching' })
  const saved = {}; let view
  for (const [k, v] of Object.entries({ window: dom.window, document: dom.window.document, Backbone: { Mediator: { subscribe () {}, unsubscribe () {} } } })) { saved[k] = global[k]; global[k] = v }
  try {
    const canvas = document.querySelector('canvas')
    canvas.getBoundingClientRect = () => ({ left: 0, top: 0, right: 900, bottom: 600, width: 900, height: 600 })
    const camera = { zoom: 1, y2x: 1, worldToCanvas: p => ({ x: p.x * 10, y: 600 - p.y * 10 }) }
    const surface = { normalCanvas: [canvas], camera, options: { level: { get: key => key === 'systems' ? [{ original: 'facadecccc00000000000001', config: { walls: [wall] } }] : null } } }
    view = new (require('../map-inspector-view'))(document.querySelector('#level-view'), { ...design, walls: undefined }, surface)
    const hero = { pos: { x: 24, y: 12 } }; const world = { getThangByID: () => ({ pos: { x: 36, y: 12 }, teachingGateStatus: 'waiting' }) }
    const before = JSON.stringify(hero); const ink = new Proxy({}, { get: () => () => ink })
    view.update(hero, world, ink); view.open('gate-Post')
    assert.match(view.panel.querySelector('.mi-status').textContent, /隔.*墙/)
    assert.equal(JSON.stringify(hero), before)
  } finally {
    view?.destroy()
    for (const k of Object.keys(saved)) { if (saved[k] === undefined) delete global[k]; else global[k] = saved[k] }
    dom.window.close()
  }
})
