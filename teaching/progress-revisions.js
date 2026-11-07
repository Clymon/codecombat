// Gameplay identity is independent of generated JSON layout and display revisions.
const crypto = require('crypto')
const presentation = new Set(['revision', 'name', 'title', 'description', 'tip', 'quest', 'starter', 'solution', 'goalLabel', 'safetyGoalLabel', 'checkpointLabels', 'torches', 'labels', 'exitMarker', 'inscriptions', 'hints', 'introBrief', 'knowledge', 'apis', 'visualTask', 'lessonOrder', 'section', 'optional', 'tutorial', 'prototype', 'hiddenByDefault', 'slug', 'scenarioIndex', 'scenarioTitles'])
function canonical (value) {
  if (Array.isArray(value)) return value.map(canonical)
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])]))
  return value
}
function identity (readLevel, slug) {
  const level = readLevel(slug)
  if (!level) return null
  const count = level.teachingMap.scenarioTitles?.length || 1
  const scenes = Array.from({ length: count }, (_, i) => {
    const map = readLevel(slug, i)?.teachingMap
    if (!map) throw new Error(`Missing gameplay scene: ${slug}/${i}`)
    const gameplay = Object.fromEntries(Object.entries(map).filter(([key]) => !presentation.has(key)))
    // The presence of a greeting enables a gate interaction; its wording is cosmetic.
    if (gameplay.gates) gameplay.gates = gameplay.gates.map(gate => ({ ...gate, greeting: !!gate.greeting }))
    return gameplay
  })
  // Bump rules only when shared gameplay behavior changes, never for structural refactors.
  return { policy: 1, rules: 1, hash: crypto.createHash('sha256').update(JSON.stringify(canonical(scenes))).digest('hex') }
}
function reconcile (session, level, current) {
  const previous = session.gameplayIdentity
  const changed = previous
    ? previous.policy !== current.policy || previous.rules !== current.rules || previous.hash !== current.hash
    : session.mapRevision !== level.teachingMap.revision
  if (changed) {
    const reason = previous ? '关卡的通关条件或场景内容已更新' : '旧记录缺少玩法标识，且地图修订不同，无法确认原通过结果仍有效'
    const message = `${reason}。请重新验证本关全部场景；账号、已保存代码和历史通过记录已保留。`
    session.revisionHistory ||= []
    session.revisionHistory.push({ mapRevision: session.mapRevision, gameplayIdentity: previous, scenePasses: session.scenePasses || {}, teachingComplete: session.teachingComplete ?? session.state?.complete ?? false, code: session.code, invalidatedAt: new Date().toISOString(), reason: message })
    session._id = `facebe${crypto.randomBytes(9).toString('hex')}`
    session.scenePasses = {}
    session.teachingComplete = false
    session.state = { complete: false, scripts: {} }
    session.teachingScene = Math.min(session.teachingScene || 0, (level.teachingMap.scenarioTitles?.length || 1) - 1)
    session.learningFeedback = ''
    session.revisionNotice = message
  } else if (!previous) {
    session.revisionNotice = '旧记录已按当前相同地图修订建立玩法标识，原通过记录和代码已保留。'
  }
  const updated = changed || !previous || session.mapRevision !== level.teachingMap.revision
  session.gameplayIdentity = current
  session.mapRevision = level.teachingMap.revision
  return updated
}
module.exports = { identity, reconcile }
