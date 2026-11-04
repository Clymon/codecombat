const test = require('node:test'); const assert = require('node:assert/strict')
const fs = require('fs'); const os = require('os'); const path = require('path'); const { spawnSync } = require('child_process')
const express = require('express'); const classroom = require('../classroom-state'); const setup = require('../local-levels'); const page = require('../account-page')
function isolated () {
  const old = process.env.TEACHING_STATE_DIR; const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'coco-visibility-')); process.env.TEACHING_STATE_DIR = dir
  return { dir, restore () { if (old === undefined) delete process.env.TEACHING_STATE_DIR; else process.env.TEACHING_STATE_DIR = old; fs.rmSync(dir, { recursive: true, force: true }) } }
}
test('visibility migrates old files, defaults samples to hidden, and persists across a fresh process', () => {
  const state = isolated()
  try {
    fs.writeFileSync(path.join(state.dir, 'classroom.json'), JSON.stringify({ releases: { 'local-python-04': true, 'local-python-22': true } }))
    assert.equal(classroom.isUnlocked('local-python-04'), true)
    assert.equal(classroom.isVisible('local-python-21'), true)
    assert.equal(classroom.isVisible('local-python-22'), false)
    assert.equal(classroom.isUnlocked('local-python-22'), false)
    classroom.setUnlocked('local-python-22', true); assert.equal(classroom.isVisible('local-python-22'), true)
    classroom.setVisible('local-python-22', false); assert.equal(classroom.isUnlocked('local-python-22'), false)
    classroom.setVisible('local-python-22', true); assert.equal(classroom.isUnlocked('local-python-22'), false)
    classroom.setVisible('local-python-22', false); classroom.setUnlocked('local-python-01', true)
    const fresh = spawnSync(process.execPath, ['-e', `const c=require(${JSON.stringify(path.resolve(__dirname, '../classroom-state'))});console.log(JSON.stringify({visibility:c.visibility(),releases:c.releases()}))`], { env: process.env, encoding: 'utf8' })
    assert.equal(fresh.status, 0, fresh.stderr)
    assert.deepEqual(JSON.parse(fresh.stdout), { visibility: classroom.visibility(), releases: classroom.releases() })
    assert.equal(classroom.isUnlocked('local-python-04'), true)
    assert.throws(() => classroom.setVisible('local-python-99', false)); assert.throws(() => classroom.setVisible('local-python-01', 'false'))
  } finally { state.restore() }
})
test('hidden cards, chapter links, recommendations and completion totals are absent from student HTML', () => {
  const levels = [setup.readLevel('local-python-04'), setup.readLevel('local-python-22')]
  const args = { student: { studentId: '99992222' }, levels, releases: { 'local-python-04': true, 'local-python-22': true }, visibility: { 'local-python-22': false }, progress: { 'local-python-22': { teachingComplete: true, learningFeedback: 'hidden feedback' } } }
  const html = page(args)
  assert.doesNotMatch(html, /local-python-22|互动样关|chapter-5|hidden feedback|教师管理/)
  assert.match(html, /<strong>0<\/strong> \/ 1 关已完成/)
  assert.match(page({ ...args, showTeacher: true }), /href="\/teaching\/teacher"/)
  const shown = page({ ...args, visibility: { 'local-python-22': true }, releases: {} })
  assert.match(shown, /chapter-5/); assert.match(shown, /等待老师开放/); assert.doesNotMatch(shown, /href="\/play\/level\/local-python-22/)
})
test('teacher hide/show protects APIs, retains saved work and skips hidden tasks when continuing', async () => {
  const state = isolated(); const app = express(); setup(app); const server = app.listen(0, '127.0.0.1'); await new Promise(resolve => server.on('listening', resolve)); const base = `http://127.0.0.1:${server.address().port}`
  try {
    const home = await fetch(base + '/teaching'); const html = await home.text(); const formCookie = home.headers.get('set-cookie').split(';')[0]; const token = html.match(/name="formToken" value="([0-9a-f]{64})"/)[1]
    let cookie = formCookie
    const post = (route, data, headers = {}) => fetch(base + route, { method: 'POST', redirect: 'manual', headers: { cookie, ...headers }, body: new URLSearchParams({ formToken: token, ...data }) })
    const login = await post('/teaching/login', { studentId: '99992222' }); cookie += '; ' + login.headers.get('set-cookie').split(';')[0]
    const get = route => fetch(base + route, { headers: { cookie } })
    const visibility = visible => post('/teaching/teacher/visibility', { slug: 'local-python-22', visible })
    assert.equal((await post('/teaching/teacher/visibility', { slug: 'local-python-22', visible: 'true', formToken: 'bad' })).status, 403)
    assert.equal((await post('/teaching/teacher/visibility', { slug: 'local-python-22', visible: 'true' }, { origin: 'https://other.example' })).status, 403)
    const foreignHostStatus = await new Promise((resolve, reject) => {
      const request = require('http').request(base + '/teaching/teacher/visibility', { method: 'POST', headers: { host: 'student.example', cookie, 'content-type': 'application/x-www-form-urlencoded' } }, response => { response.resume(); resolve(response.statusCode) })
      request.on('error', reject); request.end(new URLSearchParams({ formToken: token, slug: 'local-python-22', visible: 'true' }).toString())
    })
    assert.equal(foreignHostStatus, 403)
    assert.equal((await post('/teaching/teacher/visibility', { slug: 'local-python-99', visible: 'true' })).status, 400)
    assert.equal((await post('/teaching/teacher/visibility', { slug: 'local-python-22', visible: 'yes' })).status, 400)
    assert.equal((await post('/teaching/teacher/release', { slug: 'local-python-22', open: 'true' })).status, 303)
    const session = await (await get('/db/level/local-python-22/session')).json()
    const code = { 'hero-placeholder': { plan: 'hero.moveUp(2)' } }
    const save = () => fetch(base + '/db/level.session/' + session._id, { method: 'PUT', headers: { cookie, 'content-type': 'application/json' }, body: JSON.stringify({ code }) })
    assert.equal((await save()).status, 200)
    assert.equal((await visibility('false')).status, 303)
    const student = await (await get('/teaching')).text(); assert.doesNotMatch(student, /local-python-22|chapter-5/)
    const teacher = await (await get('/teaching/teacher')).text(); assert.match(teacher, /id="release-local-python-22"/); assert.match(teacher, /已隐藏 · 学生看不到/)
    for (const route of ['/db/level/local-python-22', '/db/level/local-python-22/session', '/db/level.session/' + session._id, '/teaching/continue/local-python-22?sessionId=' + session._id]) assert.equal((await get(route)).status, 403, route)
    assert.equal((await save()).status, 403)
    assert.equal((await post('/teaching/scenario', { slug: 'local-python-22', scene: '0' })).status, 403)
    assert.equal((await visibility('true')).status, 303)
    assert.match(await (await get('/teaching')).text(), /local-python-22/)
    assert.equal((await get('/db/level/local-python-22')).status, 403)
    await post('/teaching/teacher/release', { slug: 'local-python-22', open: 'true' })
    assert.deepEqual((await (await get('/db/level/local-python-22/session')).json()).code, code)
    classroom.setVisible('local-python-05', false); classroom.setUnlocked('local-python-01', true)
    const first = await (await get('/db/level/local-python-04/session')).json(); const plan = 'hero.moveRight()'
    await fetch(base + '/db/level.session/' + first._id, { method: 'PUT', headers: { cookie, 'content-type': 'application/json' }, body: JSON.stringify({ code: { 'hero-placeholder': { plan } }, state: { complete: true, teachingVictoryCode: plan } }) })
    const next = await (await get('/teaching/continue/local-python-04?sessionId=' + first._id)).json()
    assert.equal(next.slug, 'local-python-01'); assert.doesNotMatch(JSON.stringify(next), /local-python-05|报口令/)
  } finally { await new Promise(resolve => server.close(resolve)); state.restore() }
})
