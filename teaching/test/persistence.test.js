const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { spawnSync } = require('node:child_process')

// Every call starts a fresh process: no require cache or in-memory state survives.
test('accounts, saved code, scene passes and release switches survive process restarts', () => {
  const stateDir = fs.mkdtempSync(path.join(os.tmpdir(), 'coco-restart-'))
  const accountsPath = path.resolve(__dirname, '../student-accounts')
  const classroomPath = path.resolve(__dirname, '../classroom-state')
  const studentId = '00009999'
  const progress = {
    'local-python-09': {
      _id: 'facebe123456789012345678',
      teachingScene: 1,
      code: { 'hero-placeholder': { plan: 'if hero.pathOpen("right"):\n    hero.moveRight()' } },
      state: { complete: true },
      teachingComplete: true,
      scenePasses: { 0: { code: 'saved source', passedAt: '2026-11-04T12:00:00.000Z' }, 1: { code: 'saved source' } },
      updatedAt: '2026-11-04T12:01:00.000Z',
    },
  }
  function run (body, input = {}) {
    const result = spawnSync(process.execPath, ['-e', `
      const fs = require('node:fs')
      const accounts = require(${JSON.stringify(accountsPath)})
      const classroom = require(${JSON.stringify(classroomPath)})
      const input = JSON.parse(fs.readFileSync(0, 'utf8'))
      ${body}
    `], {
      cwd: os.tmpdir(),
      env: { ...process.env, TEACHING_STATE_DIR: stateDir },
      input: JSON.stringify(input),
      encoding: 'utf8',
      timeout: 10000,
    })
    assert.equal(result.status, 0, result.error?.message || result.stderr)
    return JSON.parse(result.stdout)
  }
  try {
    const first = run(`
      accounts.ensureStudent(input.studentId)
      accounts.saveProgress(input.studentId, input.progress)
      classroom.setUnlocked('local-python-01', true)
      classroom.setUnlocked('local-python-04', false)
      let cookie
      accounts.startSession({ secure: false }, { cookie(name, token) { cookie = name + '=' + token } }, input.studentId)
      console.log(JSON.stringify({ account: accounts.account(input.studentId), releases: classroom.releases(), cookie }))
    `, { studentId, progress })
    const restored = run(`
      // Logging in again must preserve the existing account and all saved work.
      accounts.ensureStudent(input.studentId)
      console.log(JSON.stringify({
        account: accounts.account(input.studentId),
        progress: accounts.readProgress(input.studentId),
        releases: classroom.releases(),
        currentStudent: accounts.currentStudent({ headers: { cookie: input.cookie } })
      }))
    `, { studentId, cookie: first.cookie })
    assert.deepEqual(restored.account, first.account)
    assert.deepEqual(restored.currentStudent, first.account)
    assert.deepEqual(restored.progress, progress)
    assert.deepEqual(restored.releases, first.releases)
    assert.equal(restored.releases['local-python-01'], true)
    assert.equal(restored.releases['local-python-04'], false)
    assert.equal(restored.releases['local-python-21'], false)
  } finally {
    fs.rmSync(stateDir, { recursive: true, force: true })
  }
})
