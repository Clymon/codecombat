const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('fs')
const os = require('os')
const path = require('path')
const express = require('express')
const setup = require('../local-levels')
const classroom = require('../classroom-state')

async function withClassroom (run) {
  const old = process.env.TEACHING_STATE_DIR
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'coco-submission-'))
  process.env.TEACHING_STATE_DIR = dir
  const app = express(); setup(app)
  const server = app.listen(0, '127.0.0.1')
  await new Promise(resolve => server.on('listening', resolve))
  const base = `http://127.0.0.1:${server.address().port}`
  const login = async studentId => {
    const home = await fetch(base + '/teaching')
    const token = (await home.text()).match(/name="formToken" value="([0-9a-f]{64})"/)[1]
    const formCookie = home.headers.get('set-cookie').split(';')[0]
    const logged = await fetch(base + '/teaching/login', { method: 'POST', redirect: 'manual', headers: { cookie: formCookie }, body: new URLSearchParams({ studentId, formToken: token }) })
    const cookie = formCookie + '; ' + logged.headers.get('set-cookie').split(';')[0]
    return {
      get: url => fetch(base + url, { headers: { cookie } }),
      post: (url, body) => fetch(base + url, { method: 'POST', redirect: 'manual', headers: { cookie }, body: new URLSearchParams({ formToken: token, ...body }) }),
      save: (id, body) => fetch(base + '/db/level.session/' + id, { method: 'PUT', headers: { cookie, 'content-type': 'application/json' }, body: JSON.stringify(body) }),
    }
  }
  try { await run({ login }) } finally {
    await new Promise(resolve => server.close(resolve))
    if (old === undefined) delete process.env.TEACHING_STATE_DIR; else process.env.TEACHING_STATE_DIR = old
    fs.rmSync(dir, { recursive: true, force: true })
  }
}
const victory = code => ({ code: { 'hero-placeholder': { plan: code } }, state: { complete: true, teachingVictoryCode: code } })

test('retrying an accepted victory retains the same scene pass and teacher progress', async () => {
  await withClassroom(async ({ login }) => {
    const student = await login('99881401')
    const initial = await (await student.get('/db/level/local-python-04/session')).json()
    const body = victory('hero.moveRight()')
    const first = await (await student.save(initial._id, body)).json()
    assert.equal(first.teachingComplete, true)
    const repeated = await (await student.save(initial._id, body)).json()
    assert.deepEqual(repeated.scenePasses, first.scenePasses, 'a retry must not replace the accepted pass timestamp')
    assert.equal(repeated.teachingScene, 0)
    assert.equal(repeated.state.complete, true)
    const restored = await (await student.get('/db/level.session/' + initial._id)).json()
    assert.deepEqual(restored.scenePasses, first.scenePasses)
    const teacher = await (await student.get('/teaching/teacher/student/99881401')).text()
    const card = teacher.match(/<article>[\s\S]*?<\/article>/g).find(html => html.includes('<pre class="code">hero.moveRight()'))
    assert.match(card, /badge done">已完成/)
    assert.match(card, /场景通过数：1 \/ 1/)
  })
})

test('an old victory cannot mark already-saved new code as complete', async () => {
  await withClassroom(async ({ login }) => {
    const student = await login('99881402')
    const initial = await (await student.get('/db/level/local-python-04/session')).json()
    const code = 'hero.moveRight()\n# new edit'
    await student.save(initial._id, { code: { 'hero-placeholder': { plan: code } }, state: { complete: false } })
    const stale = await (await student.save(initial._id, { state: { complete: true, teachingVictoryCode: 'hero.moveRight()' } })).json()
    assert.equal(stale.state.complete, false)
    assert.equal(stale.teachingComplete, false)
    assert.deepEqual(stale.scenePasses, {})
    const next = await (await student.get('/teaching/continue/local-python-04?sessionId=' + initial._id)).json()
    assert.equal(next.kind, 'retry')
  })
})

test('scene passes require one program unless the level explicitly allows code changes', async () => {
  await withClassroom(async ({ login }) => {
    const student = await login('99881403')
    const slug = 'local-python-09'
    classroom.setUnlocked(slug, true)
    require('./progress-fixture.cjs')('99881403', slug)
    const first = await (await student.get(`/db/level/${slug}/session`)).json()
    const code = 'if pathOpen("right"):\n    hero.moveRight()'
    const partial = await (await student.save(first._id, victory(code))).json()
    assert.equal(partial.state.complete, true)
    assert.equal(partial.teachingComplete, false)
    await student.post('/teaching/continue/' + slug, { sessionId: first._id })
    const second = await (await student.get(`/db/level/${slug}/session`)).json()
    const complete = await (await student.save(second._id, victory(code))).json()
    assert.equal(complete.teachingComplete, true)
    const edited = await (await student.save(second._id, { code: { 'hero-placeholder': { plan: code + '\n# edited' } }, state: { complete: false } })).json()
    assert.equal(edited.teachingComplete, false)
    assert.deepEqual(edited.scenePasses, {})
    assert.equal((await student.save(first._id, victory(code))).status, 404)

    // This supported policy has no enabled production level today. Exercise it via the
    // public lifecycle with real temporary storage, without changing classroom definitions.
    const { createLearningProgress } = require('../learning-progress')
    const progress = createLearningProgress({
      readLevel: (id, scene) => {
        const level = setup.readLevel(id, scene)
        return level && id === slug ? { ...level, teachingMap: { ...level.teachingMap, allowCodeChanges: true } } : level
      },
      levels: () => [setup.readLevel(slug)],
    })
    const allowed = await progress.openSession('99881403', slug)
    const accepted = await progress.saveSession('99881403', allowed._id, victory('hero.moveRight()'))
    assert.equal(accepted.teachingComplete, false)
    await progress.selectScene('99881403', slug, 0, allowed._id)
    const other = await progress.openSession('99881403', slug)
    const both = await progress.saveSession('99881403', other._id, victory('hero.moveDown()'))
    assert.equal(both.teachingComplete, true)
    assert.equal(both.scenePasses[0].code, 'hero.moveDown()')
    assert.equal(both.scenePasses[1].code, 'hero.moveRight()')
    assert.equal((await progress.openSession('99881403', slug)).teachingComplete, true)
  })
})

test('a pending victory serializes scene changes while another student can save', async () => {
  await withClassroom(async ({ login }) => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'coco-check-gate-'))
    const executable = path.join(dir, 'checker')
    fs.writeFileSync(executable, '#!/bin/sh\ncat > "$TEACHING_TEST_GATE_DIR/started"\nwhile [ ! -f "$TEACHING_TEST_GATE_DIR/released" ]; do sleep 0.02; done\n', { mode: 0o700 })
    const oldPython = process.env.TEACHING_PYTHON; const oldGate = process.env.TEACHING_TEST_GATE_DIR
    process.env.TEACHING_PYTHON = executable; process.env.TEACHING_TEST_GATE_DIR = dir
    try {
      const alice = await login('99881404'); const bob = await login('99881405')
      const slug = 'local-python-09'
      classroom.setUnlocked(slug, true)
      require('./progress-fixture.cjs')('99881404', slug)
      const first = await (await alice.get(`/db/level/${slug}/session`)).json()
      const bobSession = await (await bob.get('/db/level/local-python-04/session')).json()
      const winning = alice.save(first._id, victory('hero.moveRight()'))
      const deadline = Date.now() + 5000
      while (!fs.existsSync(path.join(dir, 'started'))) {
        assert.ok(Date.now() < deadline, 'the external checker started')
        await new Promise(resolve => setTimeout(resolve, 10))
      }
      let switched = false
      const switching = alice.post('/teaching/scenario', { slug, scene: '1', sessionId: first._id }).then(response => { switched = true; return response })
      const savedBob = await (await bob.save(bobSession._id, { code: { 'hero-placeholder': { plan: '# Bob' } } })).json()
      assert.equal(savedBob.code['hero-placeholder'].plan, '# Bob')
      assert.equal(switched, false, 'scene change waits for this student’s pending victory')
      fs.writeFileSync(path.join(dir, 'released'), '')
      assert.equal((await (await winning).json()).state.complete, true)
      assert.equal((await switching).status, 303)
      const current = await (await alice.get(`/db/level/${slug}/session`)).json()
      assert.equal(current.teachingScene, 1)
      assert.equal(current.scenePasses[0].code, 'hero.moveRight()')
      assert.equal(current.state.complete, false)
      assert.equal((await alice.save(first._id, victory('hero.moveRight()'))).status, 404)
    } finally {
      fs.writeFileSync(path.join(dir, 'released'), '')
      if (oldPython === undefined) delete process.env.TEACHING_PYTHON; else process.env.TEACHING_PYTHON = oldPython
      if (oldGate === undefined) delete process.env.TEACHING_TEST_GATE_DIR; else process.env.TEACHING_TEST_GATE_DIR = oldGate
      fs.rmSync(dir, { recursive: true, force: true })
    }
  })
})
