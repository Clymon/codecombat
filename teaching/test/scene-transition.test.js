const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('fs')
const os = require('os')
const path = require('path')
const express = require('express')
const setup = require('../local-levels')
const classroom = require('../classroom-state')

async function withClassroom (run) {
  const previous = process.env.TEACHING_STATE_DIR
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'coco-transition-'))
  process.env.TEACHING_STATE_DIR = dir
  const app = express(); setup(app)
  const server = app.listen(0, '127.0.0.1')
  await new Promise(resolve => server.on('listening', resolve))
  const base = `http://127.0.0.1:${server.address().port}`
  try {
    const home = await fetch(`${base}/teaching`)
    const token = (await home.text()).match(/name="formToken" value="([0-9a-f]{64})"/)[1]
    const formCookie = home.headers.get('set-cookie').split(';')[0]
    const login = await fetch(`${base}/teaching/login`, { method: 'POST', redirect: 'manual', headers: { cookie: formCookie }, body: new URLSearchParams({ studentId: '99881100', formToken: token }) })
    const cookie = `${formCookie}; ${login.headers.get('set-cookie').split(';')[0]}`
    const get = url => fetch(base + url, { headers: { cookie } })
    const post = (url, body) => fetch(base + url, { method: 'POST', redirect: 'manual', headers: { cookie }, body: new URLSearchParams({ formToken: token, ...body }) })
    const save = (session, body) => fetch(`${base}/db/level.session/${session._id}`, { method: 'PUT', headers: { cookie, 'content-type': 'application/json' }, body: JSON.stringify(body) })
    classroom.setUnlocked('local-python-09', true)
    require('./progress-fixture.cjs')('99881100', 'local-python-09')
    await run({ get, post, save })
  } finally {
    await new Promise(resolve => server.close(resolve))
    if (previous === undefined) delete process.env.TEACHING_STATE_DIR
    else process.env.TEACHING_STATE_DIR = previous
    fs.rmSync(dir, { recursive: true, force: true })
  }
}

test('manual scene selection preserves code and rejects a stale map form and late save', async () => {
  await withClassroom(async ({ get, post, save }) => {
    const slug = 'local-python-09'
    const original = await (await get(`/db/level/${slug}/session`)).json()
    const code = 'if pathOpen("right"):\n    hero.moveRight()\n'
    await save(original, { code: { 'hero-placeholder': { plan: code } }, state: { complete: false } })
    const selected = await post('/teaching/scenario', { slug, scene: '1', sessionId: original._id })
    assert.equal(selected.status, 303)
    const current = await (await get(`/db/level/${slug}/session`)).json()
    assert.equal(current.teachingScene, 1)
    assert.notEqual(current._id, original._id)
    assert.equal(current.code['hero-placeholder'].plan, code)
    assert.equal(current.state.complete, false)
    assert.equal((await post('/teaching/scenario', { slug, scene: '0', sessionId: original._id })).status, 409)
    assert.equal((await save(original, { code: { 'hero-placeholder': { plan: 'wrong old code' } }, state: { complete: true, teachingVictoryCode: 'wrong old code' } })).status, 404)
    const after = await (await get(`/db/level/${slug}/session`)).json()
    assert.equal(after._id, current._id)
    assert.equal(after.teachingScene, 1)
    assert.equal(after.code['hero-placeholder'].plan, code)
    assert.equal(after.state.complete, false)
    const map = await (await get('/teaching')).text()
    assert.ok(map.includes(`name="sessionId" value="${current._id}"`), 'scene forms carry the current attempt identity')
  })
})

test('a first scene choice creates a runnable session and a fresh choice clears only transient feedback', async () => {
  await withClassroom(async ({ get, post, save }) => {
    const slug = 'local-python-09'
    assert.equal((await post('/teaching/scenario', { slug, scene: '1', sessionId: '' })).status, 303)
    const first = await (await get(`/db/level/${slug}/session`)).json()
    const level = await (await get(`/db/level/${slug}`)).json()
    assert.equal(first.teachingScene, 1)
    assert.equal(first.level.original, level.original)
    assert.equal(first.mapRevision, level.teachingMap.revision)
    const invalid = 'if :'
    const rejected = await (await save(first, { code: { 'hero-placeholder': { plan: invalid } }, state: { complete: true, teachingVictoryCode: invalid } })).json()
    assert.ok(rejected.learningFeedback)
    assert.equal((await post('/teaching/scenario', { slug, scene: '0', sessionId: first._id })).status, 303)
    const fresh = await (await get(`/db/level/${slug}/session`)).json()
    assert.equal(fresh.teachingScene, 0)
    assert.equal(fresh.learningFeedback, '')
    assert.equal(fresh.state.complete, false)
    assert.equal(fresh.code['hero-placeholder'].plan, invalid, 'switching does not discard an unfinished program')
  })
})
