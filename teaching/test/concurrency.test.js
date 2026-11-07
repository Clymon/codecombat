const test = require('node:test')
const assert = require('node:assert/strict')
const { record } = require('../scenario-progress')
const { check } = require('../learning-checker')

test('40 simultaneous victories leave the HTTP event loop responsive and all pass', async () => {
  let ticks = 0
  const timer = setInterval(() => ticks++, 10)
  try {
    const sessions = Array.from({ length: 40 }, () => ({ code: { 'hero-placeholder': { plan: 'stones = hero.take("补给箱")\nhero.moveRight(2)\nhero.give("出口机关", stones)' } }, state: {} }))
    await Promise.all(sessions.map(session => record(session, { teachingMap: { index: 7 } }, { state: { complete: true, teachingVictoryCode: session.code['hero-placeholder'].plan } })))
    assert.ok(ticks > 0, 'syntax checks must not block other students loading resources')
    assert.ok(sessions.every(s => s.teachingComplete && !s.learningFeedback))
  } finally { clearInterval(timer) }
})

test('missing Python is a server failure, while invalid student code retains actionable feedback', async () => {
  const old = process.env.TEACHING_PYTHON
  try {
    process.env.TEACHING_PYTHON = '/nonexistent/classroom-python'
    assert.match(await check(7, 'stones=hero.take("补给箱")\nhero.give("出口机关",stones)'), /PYTHON_NOT_FOUND/)
  } finally { if (old === undefined) delete process.env.TEACHING_PYTHON; else process.env.TEACHING_PYTHON = old }
  assert.match(await check(7, 'if :'), /解析/)
  assert.equal(await check(7, '# 中文注释\nstones=hero.take("补给箱")\nhero.give("出口机关",stones)'), '')
})
