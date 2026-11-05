const test = require('node:test')
const assert = require('node:assert/strict')
const { catalog, accessFor, prerequisitesFor } = require('../level-access')
const page = require('../account-page')
const id = n => `local-python-${String(n).padStart(2, '0')}`
const releases = Object.fromEntries(catalog.map(l => [l.slug, true]))
const visibility = { ...releases }
const fs = require('node:fs'); const os = require('node:os'); const path = require('node:path'); const express = require('express')
const setup = require('../local-levels'); const classroom = require('../classroom-state')
test('personal prerequisites distinguish main route, side quests, hidden tasks and teacher locks', () => {
  const deps = prerequisitesFor(catalog)
  for (const [to, from] of [[5, 4], [7, 26], [27, 26], [13, 10], [12, 11], [16, 14], [33, 32], [21, 20]]) assert.deepEqual(deps[id(to)], [id(from)])
  assert.deepEqual(deps[id(4)], []); assert.deepEqual(deps[id(22)], [])
  let access = accessFor(catalog, { releases, visibility })
  assert.equal(access[id(4)].open, true)
  assert.equal(access[id(5)].reason, 'prerequisite')
  access = accessFor(catalog, { releases, visibility, progress: { [id(4)]: { teachingComplete: true } } })
  assert.equal(access[id(5)].open, true)
  assert.equal(access[id(1)].open, false)
  assert.equal(accessFor(catalog, { releases, visibility: { ...visibility, [id(26)]: false } })[id(7)].prerequisites[0], id(6))
  assert.equal(accessFor(catalog, { releases: { ...releases, [id(26)]: false }, visibility })[id(7)].prerequisites[0], id(26))
  assert.equal(accessFor(catalog, { releases: { ...releases, [id(5)]: false }, visibility, progress: { [id(4)]: { teachingComplete: true } } })[id(5)].reason, 'unreleased')
})
test('passing only one scene or an invalidated solution never unlocks the next task', () => {
  const progress = { [id(7)]: { state: { complete: true }, scenePasses: { 0: {} } } }
  assert.equal(accessFor(catalog, { releases, visibility, progress })[id(8)].open, false)
  progress[id(7)].scenePasses[1] = {}
  assert.equal(accessFor(catalog, { releases, visibility, progress })[id(8)].open, true)
  progress[id(7)].teachingComplete = false
  assert.equal(accessFor(catalog, { releases, visibility, progress })[id(8)].open, false)
})
test('student numbers stay consecutive when hidden lessons are omitted; locked cards name the prerequisite', () => {
  const html = page({ student: { studentId: '1234' }, levels: catalog, releases, visibility: { ...visibility, [id(5)]: false, [id(26)]: false } })
  const numbers = [...html.matchAll(/class="level-number">(\d+)/g)].map(m => Number(m[1]))
  assert.deepEqual(numbers, numbers.map((_, i) => i + 1))
  assert.doesNotMatch(html, /id="local-python-05"|id="local-python-26"/)
  assert.match(html, /先完成「训练营①：走到门岗」/)
  assert.doesNotMatch(html, /href="\/play\/level\/local-python-01/)
})

test('saved completion unlocks only that student; direct APIs, scene forms and stale saves cannot bypass prerequisites', async () => {
  const old = process.env.TEACHING_STATE_DIR
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'coco-dependencies-')); process.env.TEACHING_STATE_DIR = dir
  const app = express(); setup(app); const server = app.listen(0, '127.0.0.1')
  await new Promise(resolve => server.on('listening', resolve))
  const base = `http://127.0.0.1:${server.address().port}`
  try {
    classroom.updateMany(catalog.map(l => l.slug), 'open')
    const home = await fetch(base + '/teaching'); const html = await home.text()
    const formCookie = home.headers.get('set-cookie').split(';')[0]
    const formToken = html.match(/name="formToken" value="([0-9a-f]{64})"/)[1]
    async function login (studentId) {
      const response = await fetch(base + '/teaching/login', { method: 'POST', redirect: 'manual', headers: { cookie: formCookie }, body: new URLSearchParams({ studentId, formToken }) })
      return formCookie + '; ' + response.headers.get('set-cookie').split(';')[0]
    }
    const a = await login('99110001'); const b = await login('99110002')
    const get = (route, cookie = a) => fetch(base + route, { headers: { cookie } })
    const enter = n => get(`/db/level/${id(n)}/session`)
    const save = (session, code, complete) => fetch(base + '/db/level.session/' + session._id, { method: 'PUT', headers: { cookie: a, 'content-type': 'application/json' }, body: JSON.stringify({ code: { 'hero-placeholder': { plan: code } }, state: { complete, teachingVictoryCode: code } }) })
    assert.equal((await enter(5)).status, 403)
    const blocked = await get('/db/level/' + id(13)); assert.equal(blocked.status, 403)
    assert.equal((await blocked.json()).reason, 'prerequisite')
    assert.equal((await fetch(base + '/teaching/scenario', { method: 'POST', headers: { cookie: a }, body: new URLSearchParams({ formToken, slug: id(5), scene: '0' }) })).status, 403)
    const first = await (await enter(4)).json()
    assert.equal((await save(first, 'hero.moveRight()', true)).status, 200)
    const fifth = await enter(5); assert.equal(fifth.status, 200); const later = await fifth.json()
    assert.equal((await get(`/db/level/${id(5)}/session`, b)).status, 403)
    assert.equal((await get(`/teaching/continue/${id(4)}?sessionId=${first._id}`)).status, 200)
    await save(first, 'hero.moveRight(2)', false)
    assert.equal((await get('/db/level.session/' + later._id)).status, 403)
    assert.equal((await save(later, 'print("自己人")', true)).status, 403)
    assert.equal((await enter(5)).status, 403)
  } finally {
    await new Promise(resolve => server.close(resolve))
    if (old === undefined) delete process.env.TEACHING_STATE_DIR; else process.env.TEACHING_STATE_DIR = old
    fs.rmSync(dir, { recursive: true, force: true })
  }
})
