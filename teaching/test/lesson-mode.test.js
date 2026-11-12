const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const express = require('express')
const setup = require('../local-levels')
const auth = require('../teacher-auth')
const room = require('../lesson-room')
const accounts = require('../student-accounts')
const { course } = require('../lesson-curriculum')

test('remote teacher, ownership takeover, lesson isolation, hint delivery and pause acceptance', async () => {
  const old = process.env.TEACHING_STATE_DIR
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lesson-test-')); process.env.TEACHING_STATE_DIR = dir
  const app = express(); setup(app); const server = app.listen(0, '127.0.0.1'); await new Promise(resolve => server.once('listening', resolve))
  const base = `http://127.0.0.1:${server.address().port}`
  function client () {
    const cookies = new Map(); let token
    async function request (url, data, method) {
      const response = await fetch(base + url, { redirect: 'manual', method: method || (data ? 'POST' : 'GET'), headers: { cookie: [...cookies].map(([k, v]) => k + '=' + v).join('; '), ...(data ? { 'content-type': 'application/json' } : {}) }, ...(data ? { body: JSON.stringify({ formToken: token, ...data }) } : {}) })
      for (const c of response.headers.getSetCookie()) { const [k, v] = c.split(';')[0].split('='); cookies.set(k, v) }
      const text = await response.text(); const match = text.match(/(?:name="formToken" value|name="form-token" content)="([a-f0-9]+)"/); if (match) token = match[1]
      let body; try { body = JSON.parse(text) } catch { body = text }
      return { status: response.status, body, location: response.headers.get('location'), headers: response.headers }
    }
    async function form (url, data) {
      const response = await fetch(base + url, { method: 'POST', redirect: 'manual', headers: { cookie: [...cookies].map(([k, v]) => k + '=' + v).join('; ') }, body: new URLSearchParams({ ...data, formToken: token }) })
      for (const c of response.headers.getSetCookie()) { const [k, v] = c.split(';')[0].split('='); cookies.set(k, v) }
      return response
    }
    return { request, form }
  }
  try {
    await auth.configure('teacher', 'classroom-test-secret')
    const t = client(); const t2 = client(); const student = client()
    assert.equal((await t.request('/teaching/teacher')).location, '/teaching/teacher/login')
    await t.request('/teaching/teacher/login')
    assert.equal((await t.form('/teaching/teacher/login', { user: 'teacher', password: 'wrong' })).status, 401)
    assert.equal((await t.form('/teaching/teacher/login', { user: 'teacher', password: 'classroom-test-secret' })).status, 303)
    await t2.request('/teaching/teacher/login'); await t2.form('/teaching/teacher/login', { user: 'teacher', password: 'classroom-test-secret' })
    const command = async (actor, data) => actor.request('/teaching/teacher/lesson/command', { revision: room.load().revision, ...data })
    assert.equal((await command(t, { action: 'start' })).status, 200)
    const id = room.load().id
    assert.equal(room.load().gathered, true, 'new class assembles in the cabin')
    assert.equal((await command(t2, { action: 'resume' })).status, 409)
    assert.equal((await command(t2, { action: 'takeover' })).status, 200)
    assert.equal((await command(t, { action: 'resume' })).status, 409)
    assert.equal((await command(t2, { action: 'resume', formToken: 'bad' })).status, 403)
    await command(t2, { action: 'resume' })
    await student.request('/teaching'); await student.form('/teaching/login', { studentId: '99990101' })
    assert.equal((await student.request('/teaching')).location, '/teaching/room')
    assert.equal((await student.request('/teaching/free')).location, '/teaching/room')
    const view = (await student.request('/teaching/room/state')).body
    assert.equal(view.task.id, 'basic')
    const home = (await student.request('/teaching/room')).body
    assert.match(home, /cabin-canvas/)
    for (const panel of ['hub-task', 'hub-map', 'hub-notebook']) assert.ok(home.includes('id="' + panel + '"'))
    assert.deepEqual((await student.request('/teaching/room/exploration')).body.levels, [])
    assert.match(home, /DeepSeek 的温馨小屋/)
    assert.equal((await student.request('/teaching/lesson-cabin.js')).status, 200)
    assert.equal((await student.request('/teaching/lesson-cabin.css')).status, 200)
    assert.equal((await student.request('/db/level/local-python-05')).status, 403)
    assert.equal((await student.request('/db/level/local-python-35/session')).status, 403)
    const session = (await student.request('/db/level/local-python-34/session')).body
    assert.ok(session._id)
    const code = 'label = readTag("货箱封签")\nprint(label[0])\nhero.moveRight(2)'
    const win = () => student.request('/db/level.session/' + session._id, { code: { 'hero-placeholder': { plan: code } }, state: { complete: true, teachingVictoryCode: code } }, 'PUT')
    await command(t2, { action: 'gather' })
    assert.equal((await student.request('/teaching/room/state')).body.gathered, true)
    assert.equal((await student.request('/db/level/local-python-34/session')).status, 403, 'gather blocks fresh level entry')
    assert.equal((await student.request('/teaching/room/move', { roomId: id, action: 'independent' })).status, 409)
    const paused = await win(); assert.equal(paused.status, 200); assert.equal(paused.body.state.complete, false)
    assert.equal(paused.body.code['hero-placeholder'].plan, code, 'drafts save during a pause')
    await command(t2, { action: 'resume' })
    assert.equal(room.load().gathered, false)
    await command(t2, { action: 'pause' })
    assert.equal((await student.request('/db/level/local-python-34/session')).status, 200, 'ordinary pause retains the teaching scene')
    await command(t2, { action: 'resume' }); assert.equal((await win()).body.state.complete, true)
    assert.equal(room.load().students['99990101'].results.basic.complete, true)
    assert.equal((await student.request(`/teaching/continue/local-python-34?sessionId=${session._id}`)).body.kind, 'classroom')
    const returned = await student.form('/teaching/continue/local-python-34', { sessionId: session._id })
    assert.equal((await returned.json()).url, '/teaching/room?completed=local-python-34')
    assert.equal(room.load().students['99990101'].task, 'basic', 'returning home does not silently assign the next task')
    assert.equal((await student.request('/teaching/room/state')).body.next, null, 'one index mission ends here instead of automatically sending the same program to another level')
    await command(t2, { action: 'assign', task: 'independent', targets: ['99990101'] })
    assert.equal((await student.request('/teaching/room/state')).body.next.detail.id, 'independent')
    assert.equal((await student.request('/teaching/room/move', { roomId: id, action: 'next' })).status, 200)
    assert.equal(room.load().students['99990101'].task, 'independent')
    await command(t2, { action: 'hint', targets: ['99990101'], level: 3, text: '<script>not html</script>' })
    const hint = (await student.request('/teaching/room/state')).body.hints[0]
    assert.equal(hint.deliveredAt, null)
    await student.request('/teaching/room/ack', { roomId: id, hintId: hint.id, kind: 'delivered' })
    assert.ok(room.load().hints[0].deliveredAt); assert.equal(room.load().hints[0].seenAt, null)
    await student.request('/teaching/room/ack', { roomId: id, hintId: hint.id, kind: 'seen' })
    assert.ok(room.load().hints[0].seenAt)
    room.record(id, '99990101', 'local-python-35', { teachingComplete: true })
    assert.equal(room.load().students['99990101'].results.independent.independent, false)
    assert.equal(room.studentView('99990101').next, null)
    await command(t2, { action: 'assign', task: 'remedial', targets: ['99990101'] })
    await student.request('/teaching/room/move', { roomId: id, action: 'next' })
    room.record(id, '99990101', 'local-python-36', { teachingComplete: true })
    await command(t2, { action: 'assign', task: 'recheck', targets: ['99990101'] })
    await student.request('/teaching/room/move', { roomId: id, action: 'next' })
    room.record(id, '99990101', 'local-python-37', { teachingComplete: true })
    assert.equal(room.load().students['99990101'].results.recheck.independent, true)
    assert.deepEqual(accounts.readProgress('99990101'), {}, 'classroom never overwrites free-practice records')
    const persisted = JSON.parse(fs.readFileSync(path.join(dir, 'lesson-room.json')))
    assert.equal(persisted.students['99990101'].results.recheck.independent, true)
    await command(t2, { action: 'end' }); assert.equal(room.load().status, 'ended')
    const exploration = (await student.request('/teaching/room/exploration')).body
    assert.equal(exploration.available, true)
    assert.ok(exploration.levels.some(l => l.open))
    assert.ok(exploration.levels.every(l => !/^local-python-3[4-8]$/.test(l.slug)), 'class tasks stay off the free map')
    const embedded = await student.request('/teaching/free?embed=1')
    assert.equal(embedded.headers.get('x-frame-options'), 'SAMEORIGIN')
    assert.match(embedded.body, /cabin-map-embedded/)
    assert.equal((await student.request('/teaching/free')).headers.get('x-frame-options'), 'DENY')
    assert.equal((await student.request('/teaching/room/review', { roomId: id, task: 'challenge' })).status, 403)
    assert.equal((await student.request('/teaching/room/review', { roomId: id, task: 'basic' })).status, 200)
    const review = (await student.request('/db/level/local-python-34/session')).body
    assert.ok(review._id); assert.notEqual(review._id, session._id)
    assert.equal(review.state.complete, false)
    assert.equal(room.store(id).readProgress('99990101')['local-python-34'].teachingComplete, true)
    const { execFileSync } = require('node:child_process')
    const restarted = JSON.parse(execFileSync(process.execPath, ['-e', "console.log(JSON.stringify(require('./teaching/lesson-room').load()))"], { cwd: path.join(__dirname, '../..'), encoding: 'utf8' }))
    assert.equal(restarted.controller, persisted.controller)
    assert.ok(restarted.students['99990101'].results.recheck.independent)
    assert.ok(restarted.hints[0].seenAt)
    await command(t2, { action: 'start' }); assert.notEqual(room.load().id, id)
    assert.deepEqual(room.load().students, {}, 'new lesson does not inherit mastery')
    assert.equal(course.groups.length, 6)
  } finally { await new Promise(resolve => server.close(resolve)); if (old === undefined) delete process.env.TEACHING_STATE_DIR; else process.env.TEACHING_STATE_DIR = old; fs.rmSync(dir, { recursive: true, force: true }) }
})

test('teacher identity does not depend on local Host or remote IP', async () => {
  const old = process.env.TEACHING_STATE_DIR; const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'remote-teacher-')); process.env.TEACHING_STATE_DIR = dir
  try {
    await auth.configure('teacher', 'long-test-password')
    let cookie
    const req = { headers: {}, socket: { remoteAddress: '192.168.20.15' }, secure: false }
    assert.equal(await auth.login(req, { cookie: (name, value) => { cookie = name + '=' + value } }, 'teacher', 'long-test-password'), true)
    assert.equal(auth.current({ ...req, headers: { cookie } }).user, 'teacher')
    await auth.configure('teacher', 'a-new-long-password')
    assert.equal(auth.current({ ...req, headers: { cookie } }), null, 'password reset revokes existing sessions')
  } finally { if (old === undefined) delete process.env.TEACHING_STATE_DIR; else process.env.TEACHING_STATE_DIR = old; fs.rmSync(dir, { recursive: true, force: true }) }
})
