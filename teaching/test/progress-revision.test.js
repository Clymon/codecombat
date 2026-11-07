const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const accounts = require('../student-accounts')
const setup = require('../local-levels')
const { createLearningProgress } = require('../learning-progress')
const slug = 'local-python-04'
const studentId = '99881501'
const victory = code => ({ code: { 'hero-placeholder': { plan: code } }, state: { complete: true, teachingVictoryCode: code } })
async function withProgress (run) {
  const old = process.env.TEACHING_STATE_DIR
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'coco-revision-'))
  process.env.TEACHING_STATE_DIR = dir
  const scenes = [setup.readLevel(slug)]
  const readLevel = (id, scene = 0) => id === slug ? structuredClone(scenes[scene] || null) : setup.readLevel(id, scene)
  const create = () => createLearningProgress({ readLevel, levels: () => scenes.slice(0, 1) })
  accounts.ensureStudent(studentId)
  try { await run({ progress: create(), scenes, create, readLevel, dir }) } finally {
    if (old === undefined) delete process.env.TEACHING_STATE_DIR; else process.env.TEACHING_STATE_DIR = old
    fs.rmSync(dir, { recursive: true, force: true })
  }
}

test('cosmetic revision and reordered JSON retain accepted passes after restart', async () => {
  await withProgress(async ({ progress, scenes, create }) => {
    const first = await progress.openSession(studentId, slug)
    const passed = await progress.saveSession(studentId, first._id, victory('hero.moveRight()'))
    const map = scenes[0].teachingMap
    map.revision += 1
    map.name = '新标题'; map.description = '新版提示'; map.torches = [[1, 2]]
    map.gates[0].greeting = '重新措辞的招呼'
    scenes[0].teachingMap = Object.fromEntries(Object.entries(map).reverse())
    const restored = await create().openSession(studentId, slug)
    assert.equal(restored.teachingComplete, true)
    assert.deepEqual(restored.scenePasses, passed.scenePasses)
    assert.equal(restored._id, first._id)
  })
})

test('save detects changed gameplay without reopening and rejects the old victory and code', async () => {
  await withProgress(async ({ progress, scenes, create }) => {
    const first = await progress.openSession(studentId, slug)
    const passed = await progress.saveSession(studentId, first._id, victory('hero.moveRight()'))
    scenes[0].teachingMap.exit = [48, 12] // Content changes even when revision is forgotten.
    await assert.rejects(progress.saveSession(studentId, first._id, victory('# stale overwrite')), error => error.status === 409 && /重新验证/.test(error.message))
    const current = await create().openSession(studentId, slug)
    assert.notEqual(current._id, first._id)
    assert.equal(current.code['hero-placeholder'].plan, 'hero.moveRight()')
    assert.deepEqual(current.scenePasses, {})
    assert.equal(current.teachingComplete, false)
    assert.deepEqual(current.revisionHistory[0].scenePasses, passed.scenePasses)
    assert.match(current.revisionNotice, /全部场景/)
    assert.equal(accounts.account(studentId).studentId, studentId)
  })
})

test('teacher and student HTTP views reconcile revisions before a level is reopened', async () => {
  await withProgress(async ({ progress, scenes, readLevel }) => {
    const express = require('express')
    const app = express(); setup(app, { readLevel })
    const server = app.listen(0, '127.0.0.1')
    await new Promise(resolve => server.on('listening', resolve))
    const base = `http://127.0.0.1:${server.address().port}`
    try {
      const home = await fetch(base + '/teaching')
      const token = (await home.text()).match(/name="formToken" value="([0-9a-f]{64})"/)[1]
      const formCookie = home.headers.get('set-cookie').split(';')[0]
      const login = await fetch(base + '/teaching/login', { method: 'POST', redirect: 'manual', headers: { cookie: formCookie }, body: new URLSearchParams({ studentId, formToken: token }) })
      const cookie = formCookie + '; ' + login.headers.get('set-cookie').split(';')[0]
      const first = await progress.openSession(studentId, slug)
      await progress.saveSession(studentId, first._id, victory('hero.moveRight()'))
      scenes[0].teachingMap.gates[0].password = '新口令'
      const teacher = await (await fetch(base + `/teaching/teacher/student/${studentId}`)).text()
      const card = teacher.match(/<article>[\s\S]*?<\/article>/g).find(html => html.includes('hero.moveRight()'))
      assert.match(card, /重新验证本关全部场景/)
      assert.match(card, /场景通过数：0 \/ 1/)
      assert.doesNotMatch(card, /badge done">已完成/)
      const student = await (await fetch(base + '/teaching', { headers: { cookie } })).text()
      assert.match(student, /重新验证本关全部场景/)
      const stale = await fetch(base + '/db/level.session/' + first._id, { method: 'PUT', headers: { cookie, 'content-type': 'application/json' }, body: JSON.stringify(victory('# old page')) })
      assert.equal(stale.status, 404)
      const current = await (await fetch(base + `/db/level/${slug}/session`, { headers: { cookie } })).json()
      assert.equal(current.code['hero-placeholder'].plan, 'hero.moveRight()')
    } finally { await new Promise(resolve => server.close(resolve)) }
  })
})

for (const operation of ['readSession', 'previewContinuation', 'continue', 'selectScene']) {
  test(`${operation} reconciles gameplay and rejects stale attempt identity`, async () => {
    await withProgress(async ({ progress, scenes }) => {
      const first = await progress.openSession(studentId, slug)
      await progress.saveSession(studentId, first._id, victory('hero.moveRight()'))
      scenes[0].teachingMap.gates[0].password = '改过的口令'
      const args = operation === 'readSession' ? [first._id] : operation === 'selectScene' ? [slug, 0, first._id] : [slug, first._id]
      await assert.rejects(progress[operation](studentId, ...args), error => error.status === 409 && /重新验证/.test(error.message))
      const current = await progress.openSession(studentId, slug)
      assert.equal(current.teachingComplete, false)
      assert.equal(current.code['hero-placeholder'].plan, 'hero.moveRight()')
    })
  })
}

test('legacy JSON with unchanged revision preserves passes and completion, including state-only records', async () => {
  await withProgress(async ({ progress, scenes, dir, create }) => {
    const legacy = { _id: 'facebe111111111111111111', mapRevision: scenes[0].teachingMap.revision, teachingScene: 0, state: { complete: true }, code: { 'hero-placeholder': { plan: 'hero.moveRight()' } }, scenePasses: { 0: { hash: 'old-hash', code: 'hero.moveRight()', passedAt: '2025-01-01T00:00:00Z' } } }
    fs.mkdirSync(path.join(dir, 'progress'), { recursive: true })
    fs.writeFileSync(path.join(dir, 'progress', studentId + '.json'), JSON.stringify({ [slug]: legacy }))
    const migrated = await progress.openSession(studentId, slug)
    assert.equal(migrated.state.complete, true)
    assert.equal(migrated._id, legacy._id)
    assert.deepEqual(migrated.scenePasses, legacy.scenePasses)
    assert.match(migrated.revisionNotice, /相同地图修订/)
    assert.deepEqual((await create().openSession(studentId, slug)).scenePasses, legacy.scenePasses)
    delete legacy.scenePasses
    fs.writeFileSync(path.join(dir, 'progress', studentId + '.json'), JSON.stringify({ [slug]: legacy }))
    const oldest = await progress.openSession(studentId, slug)
    assert.equal(oldest.state.complete, true)
    assert.equal(oldest.code['hero-placeholder'].plan, 'hero.moveRight()')
  })
})

test('legacy unknown revision archives records and explains conservative retry without losing account or code', async () => {
  await withProgress(async ({ progress, dir }) => {
    const legacy = { _id: 'facebe111111111111111111', teachingScene: 0, state: { complete: true }, code: { 'hero-placeholder': { plan: 'hero.moveRight()' } }, scenePasses: { 0: { code: 'hero.moveRight()', passedAt: '2025-01-01T00:00:00Z' } } }
    fs.mkdirSync(path.join(dir, 'progress'), { recursive: true })
    fs.writeFileSync(path.join(dir, 'progress', studentId + '.json'), JSON.stringify({ [slug]: legacy }))
    const current = await progress.openSession(studentId, slug)
    assert.equal(current.teachingComplete, false)
    assert.deepEqual(current.revisionHistory[0].scenePasses, legacy.scenePasses)
    assert.deepEqual(current.code, legacy.code)
    assert.match(current.revisionNotice, /无法确认/)
    assert.equal(accounts.account(studentId).studentId, studentId)
  })
})

test('secondary scene target names are gameplay even with an unchanged revision', async () => {
  await withProgress(async ({ progress, scenes }) => {
    scenes[0].teachingMap.scenarioTitles = ['主场景', '练习场景']
    scenes.push(structuredClone(scenes[0]))
    scenes[1].teachingMap.inventory = { supply: { name: '补给箱', count: 3 } }
    const first = await progress.openSession(studentId, slug)
    const partial = await progress.saveSession(studentId, first._id, victory('hero.moveRight()'))
    assert.equal(partial.teachingComplete, false)
    scenes[1].teachingMap.inventory.supply.name = '货箱'
    const current = await progress.openSession(studentId, slug)
    assert.deepEqual(current.scenePasses, {})
    assert.deepEqual(current.revisionHistory[0].scenePasses, partial.scenePasses)
    assert.notEqual(current._id, first._id)
  })
})

test('successful revalidation clears the retry notice while retaining the historical evidence', async () => {
  await withProgress(async ({ progress, scenes }) => {
    const first = await progress.openSession(studentId, slug)
    await progress.saveSession(studentId, first._id, victory('hero.moveRight()'))
    scenes[0].teachingMap.exit = [48, 12]
    const current = await progress.openSession(studentId, slug)
    const next = await progress.previewContinuation(studentId, slug, current._id)
    assert.match(next.message, /重新验证本关全部场景/)
    const passed = await progress.saveSession(studentId, current._id, victory('hero.moveRight(3)'))
    assert.equal(passed.teachingComplete, true)
    assert.equal(passed.revisionNotice, '')
    assert.equal(passed.revisionHistory.length, 1)
  })
})

test('a content change during the external checker rejects its late result and preserves saved code', async () => {
  await withProgress(async ({ progress, scenes, dir }) => {
    const first = await progress.openSession(studentId, slug)
    await progress.saveSession(studentId, first._id, { code: { 'hero-placeholder': { plan: '# saved before run' } } })
    const executable = path.join(dir, 'checker')
    fs.writeFileSync(executable, '#!/bin/sh\ncat > "$TEACHING_TEST_GATE_DIR/started"\nwhile [ ! -f "$TEACHING_TEST_GATE_DIR/released" ]; do sleep 0.02; done\n', { mode: 0o700 })
    const oldPython = process.env.TEACHING_PYTHON; const oldGate = process.env.TEACHING_TEST_GATE_DIR
    process.env.TEACHING_PYTHON = executable; process.env.TEACHING_TEST_GATE_DIR = dir
    try {
      const saving = progress.saveSession(studentId, first._id, victory('hero.moveRight()'))
      const rejected = assert.rejects(saving, error => error.status === 409)
      const deadline = Date.now() + 5000
      while (!fs.existsSync(path.join(dir, 'started'))) {
        assert.ok(Date.now() < deadline, 'the external checker started')
        await new Promise(resolve => setTimeout(resolve, 10))
      }
      scenes[0].teachingMap.exit = [48, 12]
      fs.writeFileSync(path.join(dir, 'released'), '')
      await rejected
      const current = await progress.openSession(studentId, slug)
      assert.equal(current.code['hero-placeholder'].plan, '# saved before run')
      assert.equal(current.teachingComplete, false)
    } finally {
      fs.writeFileSync(path.join(dir, 'released'), '')
      if (oldPython === undefined) delete process.env.TEACHING_PYTHON; else process.env.TEACHING_PYTHON = oldPython
      if (oldGate === undefined) delete process.env.TEACHING_TEST_GATE_DIR; else process.env.TEACHING_TEST_GATE_DIR = oldGate
    }
  })
})
