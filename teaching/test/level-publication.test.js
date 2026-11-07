const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { buildLevels } = require('../tools/build-levels')
const definitions = require('../map-designs')
function workspace (t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'teaching-publish-'))
  t.after(() => fs.rmSync(root, { recursive: true, force: true }))
  return { root, output: path.join(root, 'levels') }
}
function files (root) {
  return Object.fromEntries(fs.readdirSync(root, { recursive: true }).filter(name => fs.statSync(path.join(root, name)).isFile()).sort().map(name => [name, fs.readFileSync(path.join(root, name), 'utf8')]))
}

test('one deterministic generation publishes matching native scenes, catalog and private teacher references', t => {
  const { root, output } = workspace(t)
  const selection = definitions.filter(d => [13, 19].includes(d.index))
  buildLevels(output, { definitions: selection })
  const catalog = JSON.parse(fs.readFileSync(path.join(output, 'catalog.json')))
  const references = JSON.parse(fs.readFileSync(path.join(root, 'levels-teacher/references.json')))
  assert.deepEqual(catalog.map(entry => entry.slug), ['local-python-13', 'local-python-19'])
  assert.equal(references[0].source, '../level-definitions/13.json')
  assert.equal(references[0].scenes[0].code, selection[0].solution)
  for (const entry of references) {
    for (const scene of entry.scenes) {
      const level = JSON.parse(fs.readFileSync(path.join(output, 'scenarios', `${entry.slug}-${scene.scene}.json`)))
      assert.equal(level.name, entry.name)
      assert.equal(level.teachingMap.scenarioTitles[scene.scene], scene.title)
      assert.deepEqual(level.goals, scene.goals)
    }
  }
  const readable = fs.readFileSync(path.join(root, 'levels-teacher/README.md'), 'utf8')
  assert.ok(readable.includes(references[0].scenes[0].code.trim()))
  assert.match(readable, /\.\.\/level-definitions\/13.json/)
  for (const text of Object.values(files(output))) {
    assert.ok(!text.includes('"solution"'))
    assert.ok(!text.includes(JSON.stringify(selection[0].solution)))
  }
  const first = files(root)
  buildLevels(output, { definitions: selection })
  assert.deepEqual(files(root), first)
})

test('an invalid late scene leaves both published generations and the filesystem unchanged', t => {
  const { root, output } = workspace(t)
  const selection = definitions.filter(d => [13, 23].includes(d.index))
  buildLevels(output, { definitions: selection })
  const before = files(root)
  const invalid = structuredClone(selection)
  invalid[1].scenarios = [{}, { title: '无效出口', exit: [-1, 24] }]
  assert.throws(() => buildLevels(output, { definitions: invalid }), /Level 23, scene 1 .*无效出口.*field exit/)
  assert.deepEqual(files(root), before)
  assert.deepEqual(fs.readdirSync(root).sort(), ['levels', 'levels-teacher'])
})

for (const failure of ['staged-write', 'second-publish']) {
  test(`${failure} filesystem failure restores the complete previous generation`, t => {
    const { root, output } = workspace(t)
    const selection = definitions.filter(d => [13, 23].includes(d.index))
    buildLevels(output, { definitions: selection })
    const before = files(root)
    const changed = structuredClone(selection)
    changed[0].name = '新版本，不应部分发布'
    const obstruction = path.join(root, 'obstruction')
    fs.mkdirSync(obstruction)
    let writes = 0
    let triggered = false
    const fileSystem = {
      ...fs,
      writeFileSync (file, content) {
        if (failure === 'staged-write' && ++writes === 4) {
          triggered = true
          // Exercise a real EISDIR from the operating system after earlier writes.
          return fs.writeFileSync(obstruction, content)
        }
        return fs.writeFileSync(file, content)
      },
      renameSync (from, to) {
        if (failure === 'second-publish' && from.endsWith('/teacher') && to === `${output}-teacher`) {
          triggered = true
          // Student generation was already promoted; the second rename now fails.
          return fs.renameSync(from, path.join(obstruction, 'missing-parent', 'teacher'))
        }
        return fs.renameSync(from, to)
      },
    }
    assert.throws(() => buildLevels(output, { definitions: changed, fileSystem }), error => ['EISDIR', 'ENOENT'].includes(error.code))
    assert.equal(triggered, true)
    assert.deepEqual(files(root), before)
    assert.deepEqual(fs.readdirSync(root).sort(), ['levels', 'levels-teacher', 'obstruction'])
    buildLevels(output, { definitions: changed })
    assert.equal(JSON.parse(fs.readFileSync(path.join(output, 'local-python-13.json'))).name, changed[0].name)
    assert.equal(JSON.parse(fs.readFileSync(path.join(root, 'levels-teacher/references.json')))[0].name, changed[0].name)
  })
}

test('a generation replaces stale scenes and removed levels as a unit', t => {
  const { root, output } = workspace(t)
  buildLevels(output, { definitions: definitions.filter(d => [13, 19].includes(d.index)) })
  assert.ok(fs.existsSync(path.join(output, 'scenarios/local-python-19-2.json')))
  buildLevels(output, { definitions: definitions.filter(d => d.index === 13) })
  assert.equal(fs.existsSync(path.join(output, 'local-python-19.json')), false)
  assert.deepEqual(fs.readdirSync(path.join(output, 'scenarios')), ['local-python-13-0.json'])
  assert.equal(JSON.parse(fs.readFileSync(path.join(root, 'levels-teacher/references.json'))).length, 1)
})

test('a fresh runtime uses the last published catalog and release identities after an invalid authoring edit', t => {
  const { root, output } = workspace(t)
  const selection = definitions.filter(d => d.index === 13)
  buildLevels(output, { definitions: selection })
  const draft = structuredClone(selection)
  draft[0].index = 99
  draft[0].name = '尚未发布'
  draft[0].exit = [-1, 12]
  assert.throws(() => buildLevels(output, { definitions: draft }), /field exit/)
  // Launch the real runtime consumers against the published generation and a
  // changed authoring source, exactly as a service restart would encounter it.
  for (const name of ['level-access.js', 'classroom-state.js', 'curriculum.js', 'level-catalog.js', 'level-validation.js']) fs.copyFileSync(path.join(__dirname, '..', name), path.join(root, name))
  fs.writeFileSync(path.join(root, 'map-designs.js'), `module.exports = ${JSON.stringify(draft)}\n`)
  const { spawnSync } = require('node:child_process')
  const child = spawnSync(process.execPath, ['-e', `
    const { catalog } = require('./level-access')
    const classroom = require('./classroom-state')
    process.stdout.write(JSON.stringify({ catalog, releases: classroom.releases() }))
  `], { cwd: root, env: { ...process.env, TEACHING_STATE_DIR: path.join(root, 'state') }, encoding: 'utf8' })
  assert.equal(child.status, 0, child.stderr)
  const runtime = JSON.parse(child.stdout)
  assert.deepEqual(runtime.catalog.map(entry => entry.slug), ['local-python-13'])
  assert.equal(runtime.catalog[0].name, selection[0].name)
  assert.deepEqual(Object.keys(runtime.releases), ['local-python-13'])
})

test('published progress descriptors preserve cosmetic generations and detect changed gameplay without restarting', async t => {
  const { root, output } = workspace(t)
  const selection = structuredClone(definitions.filter(d => d.index === 4))
  buildLevels(output, { definitions: selection })
  // A small student artifact belongs to the same all-or-nothing generation.
  assert.ok(fs.statSync(path.join(output, 'progress.json')).size < 4096)
  const { createProgressReader } = require('../published-progress')
  const { createLearningProgress } = require('../learning-progress')
  const accounts = require('../student-accounts')
  const oldState = process.env.TEACHING_STATE_DIR
  process.env.TEACHING_STATE_DIR = path.join(root, 'state')
  t.after(() => { if (oldState === undefined) delete process.env.TEACHING_STATE_DIR; else process.env.TEACHING_STATE_DIR = oldState })
  const readLevel = (slug, scene = 0) => JSON.parse(fs.readFileSync(path.join(output, scene ? `scenarios/${slug}-${scene}.json` : `${slug}.json`)))
  readLevel.progressRevision = createProgressReader(output)
  const progress = createLearningProgress({ readLevel, levels: () => [readLevel('local-python-04')] })
  const studentId = '99881808'
  accounts.ensureStudent(studentId)
  const first = await progress.openSession(studentId, 'local-python-04')
  const code = 'hero.moveRight()'
  await progress.saveSession(studentId, first._id, { code: { 'hero-placeholder': { plan: code } }, state: { complete: true, teachingVictoryCode: code } })
  selection[0].description = '仅改文字的新一代'
  selection[0].revision += 1
  buildLevels(output, { definitions: selection })
  const cosmetic = (await progress.readProgress(studentId))['local-python-04']
  assert.equal(cosmetic.teachingComplete, true)
  assert.equal(cosmetic._id, first._id)
  selection[0].gates[0].password = '新口令'
  buildLevels(output, { definitions: selection })
  await assert.rejects(progress.saveSession(studentId, first._id, { playtime: 2 }), error => error.status === 409)
  const revised = (await progress.readProgress(studentId))['local-python-04']
  assert.equal(revised.teachingComplete, false)
  assert.equal(revised.code['hero-placeholder'].plan, code)
  assert.match(revised.revisionNotice, /重新验证/)
})
