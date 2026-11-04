// Records each public scene against the exact saved Python source.
const crypto = require('crypto')
const { spawnSync } = require('child_process')
const path = require('path')
function source (session) { return session.code?.['hero-placeholder']?.plan || '' }
function record (session, level, body) {
  const code = source(session); const hash = crypto.createHash('sha256').update(code).digest('hex')
  const design = level.teachingMap; const count = design.scenarioTitles?.length || 1
  session.scenePasses ||= {}
  if (session.codeHash !== hash) {
    if (!design.allowCodeChanges) session.scenePasses = {}
    session.codeHash = hash
    session.state = { ...session.state, complete: false }
    session.teachingComplete = false
  }
  if (body.state?.complete === true && body.state?.teachingVictoryCode === code) {
    const checked = spawnSync('python3', [path.join(__dirname, 'tools/check-learning.py'), String(design.index)], { input: code, encoding: 'utf8', timeout: 3000, maxBuffer: 8192 })
    const error = checked.status === 0 ? '' : (checked.stdout?.trim() || '代码写法检查未完成，请重新提交并联系老师。')
    session.learningFeedback = error
    if (!error) {
      session.scenePasses[session.teachingScene || 0] = { hash, code, passedAt: new Date().toISOString() }
      session.state = { ...session.state, complete: true }
    } else session.state = { ...session.state, complete: false }
  }
  session.teachingComplete = Array.from({ length: count }, (_, i) => session.scenePasses[i]).every(Boolean)
}
module.exports = { record, source }
