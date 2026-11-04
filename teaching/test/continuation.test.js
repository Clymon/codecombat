const test = require('node:test'); const assert = require('node:assert/strict'); const fs = require('fs'); const os = require('os'); const path = require('path'); const vm = require('vm'); const express = require('express')
const setup = require('../local-levels'); const classroom = require('../classroom-state')
const Rules = vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../rules-system.js'), 'utf8'), { System: class {constructor (world, config) { this.world = world; Object.assign(this, config) }} })
test('sentries have a distinct model and face heroes approaching from either axis and after stepping aside', () => {
  const gate = { id: 'Sentry', at: [36, 12], approach: [24, 12], aside: [36, 24] }
  const hero = { pos: { x: 24, y: 12 } }; const tracked = []; const guard = { pos: { x: 36, y: 12 }, rotation: 0, keepTrackedProperty: p => tracked.push(p) }
  const w = { age: 0, dt: 0.05, getThangByID: () => guard, goalManager: { setGoalState () {} } }
  const rules = new Rules(w, { gates: [gate] })
  for (let i = 0; i < 12; i++)rules.updateGates(hero)
  assert.ok(Math.abs(Math.cos(guard.rotation) + 1) < 0.001, 'turn left toward visitor')
  hero.pos = { x: 36, y: 36 }; for (let i = 0; i < 12; i++)rules.updateGates(hero)
  assert.ok(Math.abs(Math.sin(guard.rotation) - 1) < 0.001, 'turn up toward visitor')
  gate.openedAt = 0; w.age = 2; hero.pos = { x: 48, y: 12 }
  for (let i = 0; i < 12; i++)rules.updateGates(hero)
  assert.equal(guard.pos.y, 24); assert.equal(guard.teachingGateStatus, 'open')
  assert.ok(Math.abs(guard.rotation + Math.PI / 4) < 0.001, 'watch visitor after moving aside')
  assert.ok(tracked.includes('rotation'))
  for (const file of fs.readdirSync(path.join(__dirname, '../levels/scenarios'))) {
    const level = JSON.parse(fs.readFileSync(path.join(__dirname, '../levels/scenarios', file)))
    for (const g of level.teachingMap.gates || []) assert.equal(level.thangs.find(t => t.id === g.id).thangType, '529e680ac423d4e83b000001')
  }
})
test('vertical patrol turns along its trajectory including phase reversal', () => {
  const g = { id: 'Patrol', x: 36, y: 24, axis: 'y', amplitude: 12, radius: 5, speed: 0.7, phase: Math.PI }
  const hero = { pos: { x: 12, y: 12 } }; const guard = { pos: { x: 36, y: 24 } }; const w = { age: 0, dt: 0.05, getThangByID: id => id === 'Hero Placeholder' ? hero : guard, goalManager: { setGoalState () {}, getGoalState () {} } }
  const r = new Rules(w, { guard: g })
  r.update(); assert.ok(Math.abs(guard.rotation + Math.PI / 2) < 0.001)
  w.age = Math.PI / 0.7; for (let i = 0; i < 12; i++)r.update()
  assert.ok(Math.abs(Math.sin(guard.rotation) - 1) < 0.001)
})
test('continue respects teaching order, saved scene checks, release locks, CSRF and stale-page isolation', async () => {
  const old = process.env.TEACHING_STATE_DIR; const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'coco-next-')); process.env.TEACHING_STATE_DIR = dir
  const app = express(); setup(app); const server = app.listen(0, '127.0.0.1'); await new Promise(resolve => server.on('listening', resolve)); const base = `http://127.0.0.1:${server.address().port}`
  try {
    const home = await fetch(`${base}/teaching`); const html = await home.text(); const fc = home.headers.get('set-cookie').split(';')[0]; const token = html.match(/name="formToken" value="([0-9a-f]{64})"/)[1]
    const registered = await fetch(`${base}/teaching/login`, { method: 'POST', redirect: 'manual', headers: { cookie: fc }, body: new URLSearchParams({ studentId: '99995555', formToken: token }) })
    const cookie = fc + '; ' + registered.headers.get('set-cookie').split(';')[0]
    const get = async url => fetch(base + url, { headers: { cookie } })
    const enter = async slug => (await get(`/db/level/${slug}/session`)).json()
    const win = async (s, code) => fetch(`${base}/db/level.session/${s._id}`, { method: 'PUT', headers: { cookie, 'content-type': 'application/json' }, body: JSON.stringify({ code: { 'hero-placeholder': { plan: code } }, state: { complete: true, teachingVictoryCode: code } }) })
    const peek = async (slug, s) => (await get(`/teaching/continue/${slug}?sessionId=${s._id}`)).json()
    const next = (slug, s, formToken = token) => fetch(`${base}/teaching/continue/${slug}`, { method: 'POST', headers: { cookie }, body: new URLSearchParams({ sessionId: s._id, formToken }) })
    let s = await enter('local-python-04')
    assert.equal((await peek('local-python-04', s)).kind, 'retry')
    await win(s, 'hero.moveRight()')
    assert.equal((await peek('local-python-04', s)).kind, 'waiting')
    assert.equal((await next('local-python-04', s)).status, 409)
    classroom.setUnlocked('local-python-05', true)
    assert.equal((await peek('local-python-04', s)).slug, 'local-python-05', '04 precedes 05, not numeric 01')
    assert.equal((await next('local-python-04', s, 'bad')).status, 403)
    assert.match((await (await next('local-python-04', s)).json()).url, /local-python-05/)
    for (const slug of ['local-python-07', 'local-python-09', 'local-python-10', 'local-python-21'])classroom.setUnlocked(slug, true)
    const seven = await enter('local-python-07'); await win(seven, 'steps = 2\nhero.moveRight(steps)')
    assert.equal((await peek('local-python-07', seven)).kind, 'scene')
    await win(seven, 'hero.moveRight(2)')
    assert.equal((await peek('local-python-07', seven)).kind, 'retry', 'a previously passed variable scene does not bypass current-source validation')
    s = await enter('local-python-09'); await win(s, 'hero.moveRight()')
    assert.equal((await peek('local-python-09', s)).kind, 'retry', 'reject wrong target construct even after game success')
    const code = 'if hero.pathOpen("right"):\n    hero.moveRight()'
    await win(s, code); const preview = await peek('local-python-09', s)
    assert.equal(preview.kind, 'scene'); assert.equal(preview.scene, 1)
    assert.match((await (await next('local-python-09', s)).json()).url, /local-python-09/)
    const second = await enter('local-python-09'); assert.notEqual(second._id, s._id); assert.equal(second.teachingScene, 1); assert.equal(second.code['hero-placeholder'].plan, code)
    assert.equal((await next('local-python-09', s)).status, 409)
    await win(second, code); assert.equal((await peek('local-python-09', second)).slug, 'local-python-10')
    classroom.setUnlocked('local-python-10', false)
    assert.equal((await next('local-python-09', second)).status, 409, 'release rechecked after preview')
    let last = await enter('local-python-21'); const final = 'hero.moveRight()\nprint("自己人")\nfor i in range(2):\n    hero.moveRight()\nwhile not hero.atBeacon():\n    hero.moveUp()'
    await win(last, final); await next('local-python-21', last); last = await enter('local-python-21'); await win(last, final)
    assert.equal((await peek('local-python-21', last)).kind, 'finished')
  } finally { await new Promise(resolve => server.close(resolve)); if (old === undefined) delete process.env.TEACHING_STATE_DIR; else process.env.TEACHING_STATE_DIR = old; fs.rmSync(dir, { recursive: true, force: true }) }
})
