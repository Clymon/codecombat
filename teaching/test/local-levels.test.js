const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('fs')
const path = require('path')
const os = require('os')
const vm = require('vm')
const express = require('express')
const setup = require('../local-levels')
const accounts = require('../student-accounts')
const classroom = require('../classroom-state')
const { rewritePrintAsHeroSay } = require('../print-to-say')
const { visibleSpeech, MAX_VISIBLE } = require('../speech-stack')
const Rules = vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../rules-system.js'), 'utf8'), { System: class {constructor (world, config) { this.world = world; Object.assign(this, config) }} })
function world (x, y, guard) {
  const hero = { pos: { x, y } }
  const goals = {}
  return { age: 0, hero, goals, getThangByID: id => id === 'Hero Placeholder' ? hero : guard, goalManager: { getGoalState: id => goals[id], setGoalState: (id, status) => { goals[id] = status } } }
}
test('local Python print calls become hero speech without changing other console calls', () => {
  const generated = { type: 'CallExpression', callee: { type: 'MemberExpression', object: { type: 'Identifier', name: 'console' }, property: { type: 'Identifier', name: 'log' } }, arguments: [{ type: 'Literal', value: '你好' }] }
  const studentConsole = { type: 'CallExpression', callee: { type: 'MemberExpression', object: { type: 'Identifier', name: 'console', range: [0, 7] }, property: { type: 'Identifier', name: 'log' }, range: [0, 11] }, arguments: [] }
  const ast = { type: 'Program', body: [{ type: 'WhileStatement', body: { type: 'BlockStatement', body: [{ type: 'ExpressionStatement', expression: generated }] } }, { type: 'ExpressionStatement', expression: studentConsole }] }
  rewritePrintAsHeroSay(ast)
  assert.equal(generated.callee.object.name, 'hero')
  assert.equal(generated.callee.property.name, 'say')
  assert.equal(studentConsole.callee.object.name, 'console')
})
test('hero speech retains repeated messages and displays at most four with timed fading', () => {
  const w = world(12, 12)
  w.hero.world = w
  w.hero.say = function (value) { this.sayMessage = String(value); return 'done' }
  const rules = new Rules(w, {})
  rules.start()
  for (let i = 0; i < 6; i++) { w.age = i; w.hero.say('重复') }
  const log = JSON.parse(w.hero.teachingSpeechLog)
  assert.equal(log.length, MAX_VISIBLE)
  assert.deepEqual(log.map(m => m.time), [2, 3, 4, 5])
  assert.equal(visibleSpeech(w.hero.teachingSpeechLog, 5.1).length, MAX_VISIBLE)
  assert.equal(visibleSpeech(w.hero.teachingSpeechLog, 10.3).length, 0)
  assert.ok(visibleSpeech(w.hero.teachingSpeechLog, 5.1).at(-1).alpha < 1)
  w.hero.currentPlan = { methodName: 'say' }
  w.hero.say('重复')
  assert.equal(JSON.parse(w.hero.teachingSpeechLog).length, MAX_VISIBLE)
  assert.equal(JSON.parse(w.hero.teachingSpeechLog).at(-1).time, 5)
})
test('visible wall contact fails; failure cannot become success later', () => {
  const w = world(12, 24)
  const r = new Rules(w, { walls: [{ x: 24, y: 12, halfWidth: 2, halfHeight: 2 }] })
  r.update(); assert.equal(w.goals['stay-safe'], undefined)
  w.hero.pos = { x: 21.2, y: 12 }; r.update(); assert.equal(w.goals['stay-safe'], 'failure')
  w.hero.pos = { x: 12, y: 24 }; w.goals['collect-parcels'] = 'success'; r.update(); assert.equal(w.goals['stay-safe'], 'failure')
  const outside = world(-1, 12); new Rules(outside, {}).update(); assert.equal(outside.goals['stay-safe'], 'failure')
})
test('an unreachable movement target fails after actual movement is blocked', () => {
  const w = world(14, 12); w.hero.targetPos = { x: 24, y: 12 }
  const r = new Rules(w, {})
  for (let i = 0; i < 14; i++)r.update()
  assert.equal(w.goals['stay-safe'], 'failure')
})
test('patrol warning radius and motion use the same values as the map overlay', () => {
  const patrol = { id: 'Dungeon Guard', x: 30, y: 12, amplitude: 6, radius: 8, speed: 1.2 }
  const guard = { pos: { x: 30, y: 12 } }
  const w = world(30, 12, guard); new Rules(w, { guard: patrol }).update(); assert.equal(w.goals['stay-safe'], 'failure')
  const safe = world(30, 36, { pos: { x: 30, y: 12 } }); const r = new Rules(safe, { guard: patrol })
  safe.age = 1; r.update(); assert.notEqual(safe.getThangByID(patrol.id).pos.x, 30)
  assert.equal(safe.goals['stay-safe'], undefined)
  safe.goals['collect-parcels'] = 'success'; r.update(); assert.equal(safe.goals['stay-safe'], 'success')
  const boundary = world(38, 12, { pos: { x: 30, y: 12 } }); new Rules(boundary, { guard: patrol }).update()
  assert.notEqual(boundary.goals['stay-safe'], 'failure')
})
test('all reference routes stay clear of the exact wall geometry used in the native map', () => {
  const routes = [[[12, 12], [12, 24], [36, 24], [36, 12]], [[12, 12], [60, 12]], [[12, 12], [12, 36], [48, 36], [48, 12], [60, 12]]]
  for (let n = 1; n <= 3; n++) {
    const level = setup.readLevel(`local-python-0${n}`)
    const config = level.systems.find(s => s.original === 'facadecccc00000000000001').config
    const path = routes[n - 1]
    for (let i = 1; i < path.length; i++) {
      const [x, y] = path[i - 1]; const [tx, ty] = path[i]; const steps = Math.hypot(tx - x, ty - y) * 4
      for (let step = 0; step <= steps; step++) {
        const w = world(x + (tx - x) * step / steps, y + (ty - y) * step / steps)
        new Rules(w, { walls: config.walls, bounds: config.bounds }).update()
        assert.notEqual(w.goals['stay-safe'], 'failure', `${level.slug}: ${w.hero.pos.x},${w.hero.pos.y}`)
      }
    }
    for (const wall of config.walls) {
      assert.ok(level.thangs.some(t => t.id === `Masonry ${wall.x}-${wall.y}`))
    }
    assert.equal(level.teachingMap.guard?.radius, config.guard?.radius)
  }
})
test('collecting gems is insufficient: visit checkpoints and stop at the exit', () => {
  const w = world(12, 12); const r = new Rules(w, { checkpoints: [[12, 24]], exit: [36, 12] })
  w.goals['collect-parcels'] = 'success'; r.update()
  assert.equal(w.goals['reach-exit'], 'incomplete'); assert.notEqual(w.goals['stay-safe'], 'success')
  w.hero.pos = { x: 36, y: 12 }; r.update(); assert.equal(w.goals['reach-exit'], 'incomplete')
  w.hero.pos = { x: 12, y: 24 }; r.update(); assert.equal(w.goals['checkpoint-1'], 'success')
  assert.equal(w.goals['reach-exit'], 'incomplete')
  w.hero.pos = { x: 36, y: 12 }; w.hero.targetPos = { x: 48, y: 12 }; r.update(); assert.equal(w.goals['reach-exit'], 'incomplete')
  w.hero.targetPos = { x: 36, y: 12 }; r.update(); assert.equal(w.goals['reach-exit'], 'success'); assert.equal(w.goals['stay-safe'], 'success')
})
test('spikes cause failure at the visible hazard position', () => {
  const w = world(24, 12); new Rules(w, { hazards: [[24, 12]], exit: [36, 12] }).update()
  assert.equal(w.goals['stay-safe'], 'failure'); assert.match(w.hero.teachingFailure, /尖刺/)
})
test('student-number first login, repeat login, isolated progress and upstream passthrough', async () => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'coco-students-'))
  const previousDir = process.env.TEACHING_STATE_DIR
  process.env.TEACHING_STATE_DIR = dataDir
  assert.equal(classroom.isUnlocked('local-python-04'), true)
  assert.equal(classroom.isUnlocked('local-python-01'), false)
  classroom.setUnlocked('local-python-01', true)
  const app = express(); setup(app); app.use((req, res) => {
    if (req.method === 'PUT') {
      let raw = ''; req.on('data', chunk => { raw += chunk }); req.on('end', () => res.status(418).send(raw))
    } else res.status(418).send('upstream untouched')
  })
  const server = app.listen(0, '127.0.0.1'); await new Promise(resolve => server.on('listening', resolve))
  const base = `http://127.0.0.1:${server.address().port}`
  try {
    const homeResponse = await fetch(`${base}/teaching`)
    const home = await homeResponse.text()
    const formCookie = homeResponse.headers.get('set-cookie').split(';')[0]
    const token = home.match(/name="formToken" value="([0-9a-f]{64})"/)[1]
    const form = (route, studentId, extra = {}) => fetch(`${base}${route}`, { method: 'POST', redirect: 'manual', body: new URLSearchParams({ studentId, formToken: token }), ...extra, headers: { cookie: formCookie, ...extra.headers } })
    const release = (slug, open, extra = {}) => fetch(`${base}/teaching/teacher/release`, { method: 'POST', redirect: 'manual', body: new URLSearchParams({ slug, open: String(open), formToken: token }), ...extra, headers: { cookie: formCookie, ...extra.headers } })
    assert.match(home, /25软件1班/); assert.doesNotMatch(home, /创建账号|teaching\/register/); assert.match(home, /进入课堂/); assert.doesNotMatch(home, /type="password"/)
    assert.equal((await fetch(`${base}/db/level/local-python-01`)).status, 401)
    assert.equal((await fetch(`${base}/db/level.system/facadecccc00000000000001/version/0`)).status, 401)
    assert.equal(classroom.isTeacherLocal({ socket: { remoteAddress: '192.168.1.2' }, get: () => `127.0.0.1:${server.address().port}` }), false)
    assert.equal(classroom.isTeacherLocal({ socket: { remoteAddress: '127.0.0.1' }, get: () => `student.example:${server.address().port}` }), false)
    assert.equal(Object.keys(classroom.releases()).length, require('../map-designs').length)
    assert.equal(classroom.releases()['local-python-04'], true)
    assert.equal(classroom.releases()['local-python-21'], false)
    assert.equal((await form('/teaching/login', 'abc')).status, 400)
    assert.equal((await form('/teaching/login', '20250001', { headers: { origin: 'https://elsewhere.example' } })).status, 403)
    assert.equal((await fetch(`${base}/teaching/login`, { method: 'POST', body: new URLSearchParams({ studentId: '20250001' }) })).status, 403)
    assert.equal(accounts.account('20250001'), null)
    assert.equal((await form('/teaching/register', '20259998')).status, 410)
    assert.equal(accounts.account('20259998'), null)
    const registration = await form('/teaching/login', '20250001')
    assert.equal(registration.status, 303)
    const setCookie = registration.headers.get('set-cookie')
    assert.match(setCookie, /HttpOnly/); assert.match(setCookie, /SameSite=Lax/)
    const cookie = setCookie.split(';')[0]
    const firstRecord = accounts.account('20250001')
    assert.equal((await form('/teaching/login', '20250001')).status, 303)
    assert.deepEqual(accounts.account('20250001'), firstRecord)
    assert.equal(accounts.registeredStudents().length, 1)
    const style = await fetch(`${base}/teaching/classroom.css`)
    assert.equal(style.status, 200); assert.match(style.headers.get('content-type'), /text\/css/)
    assert.match(homeResponse.headers.get('content-security-policy'), /img-src 'self'/)
    assert.equal(accounts.account('20250001').className, '25软件1班')
    const loggedIn = await (await fetch(`${base}/teaching`, { headers: { cookie } })).text()
    assert.match(loggedIn, /当前学号：<strong>20250001/)
    const secondRegistration = await form('/teaching/login', '20250002')
    const secondCookie = secondRegistration.headers.get('set-cookie').split(';')[0]
    const teacherInitial = await (await fetch(`${base}/teaching/teacher`)).text()
    assert.match(teacherInitial, /已创建账号：2 人/)
    assert.match(teacherInitial, /20250001/)
    assert.match(teacherInitial, /未开放/)
    assert.equal((await fetch(`${base}/db/level/local-python-02`, { headers: { cookie } })).status, 403)
    assert.equal((await release('local-python-02', true, { headers: { origin: 'https://elsewhere.example' } })).status, 403)
    assert.equal((await release('local-python-99', true)).status, 400)
    assert.equal((await release('local-python-02', true)).status, 303)
    assert.equal(classroom.isUnlocked('local-python-02'), true)
    assert.equal((await fetch(`${base}/db/level/local-python-02`, { headers: { cookie } })).status, 403, 'teacher release does not bypass prerequisites')
    require('./progress-fixture.cjs')('20250001', 'local-python-02')
    require('./progress-fixture.cjs')('20250002', 'local-python-01')
    assert.equal((await fetch(`${base}/db/level/local-python-02`, { headers: { cookie } })).status, 200)
    const first = await fetch(`${base}/db/level/local-python-01/session`, { headers: { cookie } })
    const a = await first.json()
    const second = await fetch(`${base}/db/level/local-python-01/session`, { headers: { cookie: secondCookie } })
    const b = await second.json()
    assert.notEqual(a._id, b._id)
    assert.equal((await fetch(`${base}/db/level.session/${a._id}`, { headers: { cookie: secondCookie } })).status, 404)
    const code = { 'hero-placeholder': { plan: 'hero.moveUp()\n# <script>alert(1)</script>\n' } }
    assert.equal((await fetch(`${base}/db/level.session/${a._id}`, { method: 'PUT', headers: { cookie, 'content-type': 'application/json' }, body: JSON.stringify({ code, creator: 'cannot-change' }) })).status, 200)
    const restored = await (await fetch(`${base}/db/level/local-python-01/session`, { headers: { cookie } })).json()
    assert.deepEqual(restored.code, code); assert.equal(restored.creator, undefined)
    const detail = await (await fetch(`${base}/teaching/teacher/student/20250001`)).text()
    assert.match(detail, /hero.moveUp\(\)/)
    assert.match(detail, /&lt;script&gt;/)
    assert.doesNotMatch(detail, /<script>/)
    assert.match(detail, /进行中/)
    assert.equal((await fetch(`${base}/teaching/teacher/student/20259999`)).status, 404)
    assert.deepEqual((await (await fetch(`${base}/db/level/local-python-01/session`, { headers: { cookie: secondCookie } })).json()).code, {})
    assert.equal((await release('local-python-09', true)).status, 303)
    require('./progress-fixture.cjs')('20250001', 'local-python-09')
    const nine = await (await fetch(`${base}/db/level/local-python-09/session`, { headers: { cookie } })).json()
    const sceneCode = { 'hero-placeholder': { plan: 'if hero.pathOpen("right"):\n    hero.moveRight()\n' } }
    await fetch(`${base}/db/level.session/${nine._id}`, { method: 'PUT', headers: { cookie, 'content-type': 'application/json' }, body: JSON.stringify({ code: sceneCode, state: { complete: true, teachingVictoryCode: sceneCode['hero-placeholder'].plan } }) })
    const choose = (scene, formToken = token) => fetch(`${base}/teaching/scenario`, { method: 'POST', redirect: 'manual', headers: { cookie: `${formCookie}; ${cookie}` }, body: new URLSearchParams({ slug: 'local-python-09', scene: String(scene), sessionId: nine._id, formToken }) })
    assert.equal((await choose(1, 'bad')).status, 403)
    assert.equal((await choose(99)).status, 400)
    assert.equal((await choose(1)).status, 303)
    const swapped = await (await fetch(`${base}/db/level/local-python-09/session`, { headers: { cookie } })).json()
    assert.notEqual(swapped._id, nine._id); assert.deepEqual(swapped.code, sceneCode); assert.equal(swapped.teachingScene, 1)
    assert.equal(swapped.scenePasses[0].code, sceneCode['hero-placeholder'].plan)
    assert.equal((await fetch(`${base}/db/level.session/${nine._id}`, { method: 'PUT', headers: { cookie, 'content-type': 'application/json' }, body: JSON.stringify({ state: { complete: true } }) })).status, 404)
    const closed = await (await fetch(`${base}/db/level/local-python-09`, { headers: { cookie } })).json()
    assert.equal(closed.teachingMap.scenarioIndex, 1); assert.equal(closed.teachingMap.sensor.open.right, false)
    assert.equal((await release('local-python-09', false)).status, 303)
    assert.equal((await choose(0)).status, 403)
    assert.equal((await release('local-python-01', false)).status, 303)
    assert.equal((await fetch(`${base}/db/level/local-python-01`, { headers: { cookie } })).status, 403)
    assert.equal((await fetch(`${base}/db/level/local-python-01/session`, { headers: { cookie } })).status, 403)
    assert.equal((await fetch(`${base}/db/level.session/${a._id}`, { headers: { cookie } })).status, 403)
    const lockedHome = await (await fetch(`${base}/teaching`, { headers: { cookie } })).text()
    assert.match(lockedHome, /等待老师开放/)
    assert.equal((await release('local-python-01', true)).status, 303)
    assert.equal((await form('/teaching/logout', '', { headers: { cookie: `${formCookie}; ${cookie}` } })).status, 303)
    assert.equal((await fetch(`${base}/db/level/local-python-01/session`, { headers: { cookie } })).status, 401)
    const relogin = await form('/teaching/login', '20250001')
    const newCookie = relogin.headers.get('set-cookie').split(';')[0]
    assert.notEqual(newCookie, cookie)
    assert.deepEqual((await (await fetch(`${base}/db/level/local-python-01/session`, { headers: { cookie: newCookie } })).json()).code, code)
    assert.equal((await fetch(`${base}/db/level/dungeons-of-kithgard`)).status, 418)
    assert.equal((await fetch(`${base}/db/level.session/012345678901234567890123`)).status, 418)
    const officialBody = '{}'
    const untouched = await fetch(`${base}/db/level.session/012345678901234567890123`, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: officialBody })
    assert.equal(untouched.status, 418); assert.equal(await untouched.text(), officialBody)
    assert.equal((await fetch(`${base}/db/level/local-python-99`)).status, 418)
    assert.equal(accounts.withoutLocalCookies('official=keep; localStudentSession=secret; localTeaching=old; localTeachingForm=form'), 'official=keep')
  } finally {
    await new Promise(resolve => server.close(resolve))
    if (previousDir === undefined) delete process.env.TEACHING_STATE_DIR
    else process.env.TEACHING_STATE_DIR = previousDir
    fs.rmSync(dataDir, { recursive: true, force: true })
  }
})

test('gate hears speech only at its post, moves aside and allows completion only after code ends', () => {
  const gate = { id: 'Post', at: [36, 12], aside: [36, 24], approach: [24, 12], password: '自己人' }
  const guard = { pos: { x: 36, y: 12 } }
  const w = world(12, 12, guard)
  w.hero.world = w; w.hero.say = function (text) { this.sayMessage = text; return 'done' }
  const r = new Rules(w, { gates: [gate], noGems: true, exit: [48, 12], requireFinished: true })
  r.start(); r.update()
  w.hero.say('自己人'); assert.equal(gate.openedAt, undefined)
  w.hero.pos = { x: 24, y: 12 }; w.hero.say('错误'); assert.equal(gate.openedAt, undefined)
  w.hero.say('自己人'); assert.equal(gate.openedAt, 0)
  w.age = 0.3; r.update(); assert.ok(guard.pos.y > 12 && guard.pos.y < 24)
  w.age = 1.1; r.update(); assert.equal(guard.pos.y, 24); assert.equal(w.goals['gate-Post'], 'success')
  w.hero.pos = { x: 48, y: 12 }; r.update(); assert.equal(w.goals['reach-exit'], 'incomplete')
  w.hero.plansAreFinished = true; r.update(); assert.equal(w.goals['reach-exit'], 'success')
})
test('rushing a closed post is blocked without damage, and another post cannot use its password', () => {
  const gate = { id: 'Post', at: [36, 12], aside: [36, 24], approach: [24, 12], password: '自己人' }
  const w = world(34, 12, { pos: { x: 36, y: 12 } })
  const r = new Rules(w, { gates: [gate], noGems: true, exit: [48, 12] })
  r.update(); assert.equal(w.goals['stay-safe'], 'failure'); assert.equal(w.hero.pos.x, 24)
  assert.match(w.hero.teachingFailure, /守卫/)
  r.receiveSpeech({ x: 60, y: 24, text: '自己人', time: 1 }, w.hero); assert.equal(gate.openedAt, undefined)
})
test('new lesson maps expose tasks without teacher solutions and have valid 24-character IDs', () => {
  for (const index of [4, 5, 6]) {
    const level = setup.readLevel(`local-python-0${index}`)
    assert.equal(level._id.length, 24)
    assert.equal(level.teachingMap.solution, undefined)
    assert.ok(level.goals.some(g => g.id === 'reach-exit'))
    if (index !== 6) assert.ok(!level.goals.some(g => g.id === 'collect-parcels'))
  }
})

test('password replies distinguish a mistake, retry, and visible passage opening', () => {
  const gate = { id: 'Post', at: [36, 12], aside: [36, 24], approach: [24, 12], password: '自己人' }
  const guard = { pos: { x: 36, y: 12 } }; const w = world(24, 12, guard)
  const r = new Rules(w, { gates: [gate], noGems: true, exit: [48, 12] })
  r.update(); assert.match(guard.teachingGateMessage, /请报口令/)
  r.receiveSpeech({ x: 24, y: 12, text: '出发', time: 0 }, w.hero)
  assert.equal(guard.teachingGateStatus, 'rejected'); assert.match(guard.teachingGateMessage, /口令不对/); assert.equal(gate.openedAt, undefined)
  r.receiveSpeech({ x: 24, y: 12, text: '自己人', time: 0 }, w.hero)
  assert.match(guard.teachingGateMessage, /请通行/); assert.equal(guard.teachingGateStatus, 'opening')
  w.age = 0.5; r.update(); assert.equal(guard.pos.y, 18)
  w.age = 1.1; r.update(); assert.equal(guard.teachingGateStatus, 'open'); assert.equal(guard.pos.y, 24)
})
test('rushing from the approach never starts movement; rushing from far stops at the post', () => {
  const gate = { id: 'Post', at: [36, 12], aside: [36, 24], approach: [24, 12], password: '自己人' }
  const guard = { pos: { x: 36, y: 12 } }; const w = world(24, 12, guard); let movements = 0
  w.hero.moveRight = () => { movements++; return 'done' }
  const r = new Rules(w, { gates: [gate], noGems: true, exit: [48, 12] }); r.start(); w.hero.moveRight()
  assert.equal(movements, 0); assert.equal(w.hero.pos.x, 24); assert.equal(w.goals['stay-safe'], 'failure'); assert.match(guard.teachingGateMessage, /站住/)
  const far = world(12, 12, { pos: { x: 36, y: 12 } }); let actualSteps
  far.hero.moveRight = n => { actualSteps = n; return 'done' }
  const rr = new Rules(far, { gates: [{ ...gate }], noGems: true, exit: [48, 12] }); rr.start(); far.hero.moveRight(3)
  assert.equal(actualSteps, 1); far.hero.pos.x = 24; rr.update(); assert.equal(far.goals['stay-safe'], 'failure'); assert.equal(far.hero.pos.x, 24)
})

test('greeting discovers a password locally without unlocking; a correct reply still required', () => {
  const gate = { id: 'Post', at: [36, 12], aside: [36, 24], approach: [24, 12], password: '自己人' }
  const guard = { pos: { x: 36, y: 12 } }; const w = world(12, 12, guard)
  const r = new Rules(w, { gates: [gate], noGems: true, exit: [48, 12] })
  r.update(); r.receiveSpeech({ x: 12, y: 12, text: '你好', time: 0 }, w.hero)
  assert.equal(gate.openedAt, undefined); assert.equal(guard.teachingGateMessage, '')
  w.hero.pos.x = 24; r.receiveSpeech({ x: 24, y: 12, text: '你好', time: 0 }, w.hero)
  assert.match(guard.teachingGateMessage, /自己人/); assert.equal(gate.openedAt, undefined)
  assert.equal(w.hero.teachingFailure, ''); assert.notEqual(w.goals['stay-safe'], 'failure')
  r.receiveSpeech({ x: 24, y: 12, text: '自己人', time: 1 }, w.hero)
  assert.equal(gate.openedAt, 1)
})
test('exit seals reflect unmet goals and opening time changes only when actually unlocked', () => {
  const w = world(36, 12); const r = new Rules(w, { checkpoints: [[24, 12]], exit: [36, 12], noGems: true, requireFinished: true })
  r.update(); assert.equal(w.hero.teachingExitReady, false); assert.equal(w.hero.teachingExitOpenedAt, -1)
  assert.match(w.hero.teachingFailure, /封印/); assert.notEqual(w.goals['reach-exit'], 'success')
  w.hero.pos.x = 24; w.age = 2; r.update()
  assert.equal(w.hero.teachingExitReady, true); assert.equal(w.hero.teachingExitOpenedAt, 2); assert.equal(w.hero.teachingFailure, '')
  w.age = 3; r.update(); assert.equal(w.hero.teachingExitOpenedAt, 2)
  w.hero.pos.x = 36; w.hero.plansAreFinished = true; r.update(); assert.equal(w.goals['reach-exit'], 'success')
})

test('Python boolean speech uses True and False in the new victory-condition tutorial', () => {
  const w = world(12, 12); w.hero.world = w; w.hero.say = function (v) { this.sayMessage = String(v); return 'done' }
  const rules = new Rules(w, {}); rules.start(); w.hero.say(false); w.age = 1; w.hero.say(true)
  assert.deepEqual(JSON.parse(w.hero.teachingSpeechLog).map(e => e.text), ['False', 'True'])
})
