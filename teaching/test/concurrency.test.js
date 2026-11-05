const test = require('node:test')
const assert = require('node:assert/strict')
const { record } = require('../scenario-progress')
const { check, serializeProgress } = require('../learning-checker')
const accounts = require('../student-accounts')

test('40 simultaneous victories leave the HTTP event loop responsive and all pass', async () => {
  let ticks = 0
  const timer = setInterval(() => ticks++, 10)
  try {
    const sessions = Array.from({ length: 40 }, () => ({ code: { 'hero-placeholder': { plan: 'steps = 2\nhero.moveRight(steps)' } }, state: {} }))
    await Promise.all(sessions.map(session => record(session, { teachingMap: { index: 7 } }, { state: { complete: true, teachingVictoryCode: session.code['hero-placeholder'].plan } })))
    assert.ok(ticks > 0, 'syntax checks must not block other students loading resources')
    assert.ok(sessions.every(s => s.teachingComplete && !s.learningFeedback))
  } finally { clearInterval(timer) }
})

test('missing Python is a server failure, while invalid student code retains actionable feedback', async () => {
  const old = process.env.TEACHING_PYTHON
  try {
    process.env.TEACHING_PYTHON = '/nonexistent/classroom-python'
    assert.match(await check(7, 'steps=2\nhero.moveRight(steps)'), /PYTHON_NOT_FOUND/)
  } finally { if (old === undefined) delete process.env.TEACHING_PYTHON; else process.env.TEACHING_PYTHON = old }
  assert.match(await check(7, 'hero.moveRight(2)'), /steps/)
  assert.equal(await check(7, '# 中文注释\nsteps=2\nhero.moveRight(steps)'), '')
})

test('same student writes and scene transitions wait for prior checks; other students continue', async () => {
  const original = accounts.currentStudent
  accounts.currentStudent = req => ({ studentId: req.owner })
  const events = []; let release
  const gate = new Promise(resolve => { release = resolve })
  const handler = serializeProgress(async req => { events.push(req.name); if (req.name === 'save') await gate })
  const run = req => new Promise((resolve, reject) => {
    const wrapped = serializeProgress(async () => resolve())
    handler(req, {}, reject)
    wrapped(req, {}, reject)
  })
  try {
    const first = run({ owner: '1', name: 'save' })
    const second = run({ owner: '1', name: 'next-scene' })
    await run({ owner: '2', name: 'other-student' })
    assert.deepEqual(events, ['save', 'other-student'])
    release(); await Promise.all([first, second])
    assert.deepEqual(events, ['save', 'other-student', 'next-scene'])
  } finally { release(); accounts.currentStudent = original }
})
