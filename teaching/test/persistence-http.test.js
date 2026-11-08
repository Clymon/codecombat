const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { fork } = require('node:child_process')
const fixture = path.join(__dirname, 'persistence-server.cjs')

async function start (dir) {
  const child = fork(fixture, [], { env: { ...process.env, TEACHING_STATE_DIR: dir }, stdio: ['ignore', 'ignore', 'pipe', 'ipc'] })
  let errors = ''
  child.stderr.on('data', chunk => { errors += chunk })
  const base = await new Promise((resolve, reject) => {
    child.once('message', port => resolve(`http://127.0.0.1:${port}`))
    child.once('error', reject)
    child.once('exit', code => reject(Error(`server exited ${code}: ${errors}`)))
  })
  return { base, stop: () => new Promise(resolve => { child.once('exit', resolve); child.send('stop') }) }
}
async function login (server, studentId) {
  const home = await fetch(server.base + '/teaching')
  const token = (await home.text()).match(/name="formToken" value="([0-9a-f]{64})"/)[1]
  const formCookie = home.headers.get('set-cookie').split(';')[0]
  const response = await fetch(server.base + '/teaching/login', { method: 'POST', redirect: 'manual', headers: { cookie: formCookie }, body: new URLSearchParams({ studentId, formToken: token }) })
  assert.equal(response.status, 303)
  const cookie = formCookie + '; ' + response.headers.get('set-cookie').split(';')[0]
  return {
    get: url => fetch(server.base + url, { headers: { cookie } }),
    post: (url, body) => fetch(server.base + url, { method: 'POST', redirect: 'manual', headers: { cookie }, body: new URLSearchParams({ formToken: token, ...body }) }),
    save: (id, body) => fetch(server.base + '/db/level.session/' + id, { method: 'PUT', headers: { cookie, 'content-type': 'application/json' }, body: JSON.stringify(body) }),
  }
}
const victory = code => ({ code: { 'hero-placeholder': { plan: code } }, state: { complete: true, teachingVictoryCode: code } })

test('failed HTTP save retains the old file and returns a Chinese retry instruction; retry persists', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'coco-write-failure-'))
  const server = await start(dir)
  try {
    const student = await login(server, '99881601')
    const initial = await (await student.get('/db/level/local-python-04/session')).json()
    assert.equal((await student.save(initial._id, victory('hero.moveRight()'))).status, 200)
    const file = path.join(dir, 'progress/99881601.json')
    const old = fs.readFileSync(file, 'utf8')
    fs.chmodSync(path.dirname(file), 0o555)
    const failed = await student.save(initial._id, { code: { 'hero-placeholder': { plan: '# unsaved edit' } }, state: { complete: false } })
    assert.equal(failed.status, 503)
    assert.match((await failed.json()).message, /保存失败.*重试/)
    assert.equal(fs.readFileSync(file, 'utf8'), old)
    const restored = await (await student.get('/db/level.session/' + initial._id)).json()
    assert.equal(restored.code['hero-placeholder'].plan, 'hero.moveRight()')
    assert.equal(restored.teachingComplete, true)
    fs.chmodSync(path.dirname(file), 0o755)
    const retried = await student.save(initial._id, { code: { 'hero-placeholder': { plan: '# unsaved edit' } }, state: { complete: false } })
    assert.equal(retried.status, 200)
    assert.equal((await retried.json()).code['hero-placeholder'].plan, '# unsaved edit')
  } finally {
    fs.chmodSync(path.join(dir, 'progress'), 0o755)
    await server.stop()
    fs.rmSync(dir, { recursive: true, force: true })
  }
})

test('a stopped and restarted HTTP server restores code, accepted passes and current scene', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'coco-http-restart-'))
  let server = await start(dir)
  try {
    const student = await login(server, '99881602')
    // Establish prerequisite history only in this isolated fixture; all tested changes use HTTP.
    const old = process.env.TEACHING_STATE_DIR
    process.env.TEACHING_STATE_DIR = dir
    try { require('./progress-fixture.cjs')('99881602', 'local-python-09') } finally {
      if (old === undefined) delete process.env.TEACHING_STATE_DIR; else process.env.TEACHING_STATE_DIR = old
    }
    assert.equal((await student.post('/teaching/teacher/release', { slug: 'local-python-09', open: 'true' })).status, 303)
    const initial = await (await student.get('/db/level/local-python-09/session')).json()
    const code = 'if hero.pathOpen("right"):\n    hero.moveRight()'
    const savedResponse = await student.save(initial._id, victory(code))
    assert.equal(savedResponse.status, 200)
    const saved = await savedResponse.json()
    assert.equal(saved.state.complete, true)
    assert.equal((await student.post('/teaching/continue/local-python-09', { sessionId: initial._id })).status, 200)
    const current = await (await student.get('/db/level/local-python-09/session')).json()
    assert.equal(current.teachingScene, 1)
    await server.stop()
    server = await start(dir)
    const returning = await login(server, '99881602')
    const restored = await (await returning.get('/db/level/local-python-09/session')).json()
    assert.equal(restored._id, current._id)
    assert.equal(restored.teachingScene, 1)
    assert.equal(restored.code['hero-placeholder'].plan, code)
    assert.deepEqual(restored.scenePasses, saved.scenePasses)
    assert.equal(restored.state.complete, false)
    assert.equal(restored.teachingComplete, false)
    const teacher = await (await returning.get('/teaching/teacher/student/99881602')).text()
    assert.match(teacher, /场景通过数：1 \/ 2/)
    assert.equal((await returning.save(initial._id, victory(code))).status, 404)
  } finally { await server.stop(); fs.rmSync(dir, { recursive: true, force: true }) }
})

test('40 students repeatedly save and submit concurrently without exchanging code or passes', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'coco-40-students-'))
  const server = await start(dir)
  try {
    const students = await Promise.all(Array.from({ length: 40 }, async (_, index) => {
      const id = String(99881700 + index)
      const client = await login(server, id)
      const response = await client.get('/db/level/local-python-04/session')
      assert.equal(response.status, 200)
      return { client, id, session: await response.json(), code: `hero.moveRight()\n# student ${id}` }
    }))
    assert.equal(new Set(students.map(student => student.session._id)).size, 40)
    for (let round = 0; round < 3; round++) {
      await Promise.all(students.map(async ({ client, session, code }) => {
        const response = await client.save(session._id, round === 0 ? { code: victory(code).code } : victory(code))
        assert.equal(response.status, 200)
        const saved = await response.json()
        assert.equal(saved.code['hero-placeholder'].plan, code)
        if (round > 0) assert.equal(saved.teachingComplete, true)
      }))
    }
    await Promise.all(students.map(async ({ client, session, code }, index) => {
      const restored = await (await client.get('/db/level.session/' + session._id)).json()
      assert.equal(restored.code['hero-placeholder'].plan, code)
      assert.equal(restored.scenePasses[0].code, code)
      assert.equal(restored.teachingComplete, true)
      assert.equal((await client.get('/db/level.session/' + students[(index + 1) % 40].session._id)).status, 404)
    }))
  } finally { await server.stop(); fs.rmSync(dir, { recursive: true, force: true }) }
})

test('same-revision legacy state-only completion survives metadata autosave and a real process restart', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'coco-legacy-restart-'))
  const slug = 'local-python-04'
  const id = 'facebe111111111111111111'
  const code = 'hero.moveRight()'
  fs.mkdirSync(path.join(dir, 'progress'))
  fs.writeFileSync(path.join(dir, 'progress/99881603.json'), JSON.stringify({
    [slug]: {
      _id: id,
      mapRevision: require('../levels/local-python-04.json').teachingMap.revision,
      state: { complete: true },
      code: { 'hero-placeholder': { plan: code } },
    },
  }))
  let server = await start(dir)
  try {
    const student = await login(server, '99881603')
    const save = await student.save(id, { playtime: 1 })
    assert.equal(save.status, 200)
    assert.equal((await save.json()).teachingComplete, true)
    await server.stop()
    server = await start(dir)
    const returning = await login(server, '99881603')
    const restored = await (await returning.get('/db/level/' + slug + '/session')).json()
    assert.equal(restored._id, id)
    assert.equal(restored.state.complete, true)
    assert.equal(restored.teachingComplete, true)
    assert.equal(restored.scenePasses[0].code, code)
    const teacher = await (await returning.get('/teaching/teacher/student/99881603')).text()
    assert.match(teacher, /场景通过数：1 \/ 1/)
    const forged = await returning.save(id, { code: { 'hero-placeholder': { plan: '# different source' } }, state: { complete: true, teachingVictoryCode: code } })
    assert.equal(forged.status, 200)
    const changed = await forged.json()
    assert.equal(changed.teachingComplete, false)
    assert.equal(changed.state.complete, false)
  } finally { await server.stop(); fs.rmSync(dir, { recursive: true, force: true }) }
})
