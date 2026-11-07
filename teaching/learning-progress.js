// Owns complete scene transitions; HTTP callers supply identity and intent only.
const crypto = require('crypto')
const accounts = require('./student-accounts')
const classroom = require('./classroom-state')
const { accessFor, catalog } = require('./level-access')
const { nextTask } = require('./continuation')

class ProgressError extends Error {
  constructor (status, detail) {
    super(detail.message || '无法更改学习进度。')
    this.status = status
    this.detail = detail
  }
}

function createSession (level, scene) {
  return { _id: `facebe${crypto.randomBytes(9).toString('hex')}`, creator: 'local-teaching-preview', team: 'humans', codeLanguage: 'python', level: { original: level.original, majorVersion: 0 }, state: { complete: false, scripts: {} }, code: {}, permissions: [{ target: 'public', access: 'write' }], teachingScene: scene, mapRevision: level.teachingMap.revision, createdAt: new Date().toISOString() }
}

function createLearningProgress ({ readLevel, levels }) {
  function requireAccess (progress, slug) {
    const access = accessFor(catalog, { progress, releases: classroom.releases(), visibility: classroom.visibility() })[slug]
    if (!access?.open) throw new ProgressError(403, { message: access?.message || '此关不可进入，请返回地图。', reason: access?.reason, prerequisites: access?.missing, mapUrl: `/teaching?level=${slug}` })
  }

  function requireCurrentSession (session, sessionId) {
    if (!session || session._id !== sessionId) throw new ProgressError(409, { message: '这个页面的场景已改变，请刷新后继续。' })
  }

  function transition (studentId, progress, slug, scene) {
    const level = readLevel(slug, scene)
    if (!level) throw new ProgressError(400, { message: '场景不存在，请返回地图重新选择。' })
    const session = progress[slug]
    if (session) {
      // Never let a late save from the previous page write into this attempt.
      session._id = `facebe${crypto.randomBytes(9).toString('hex')}`
      session.teachingScene = scene
      session.state = { complete: false, scripts: {} }
      session.learningFeedback = ''
    } else progress[slug] = createSession(level, scene)
    accounts.saveProgress(studentId, progress)
    return progress[slug]
  }

  function continuation (studentId, slug, sessionId) {
    if (!readLevel(slug)) throw new ProgressError(404, { message: '关卡不存在，请返回地图。' })
    const progress = accounts.readProgress(studentId)
    requireAccess(progress, slug)
    const session = progress[slug]
    requireCurrentSession(session, sessionId)
    let next = nextTask(levels().filter(level => classroom.isVisible(level.slug)), slug, session, classroom.releases())
    if (next.kind === 'level') {
      const access = accessFor(catalog, { progress, releases: classroom.releases(), visibility: classroom.visibility() })[next.slug]
      if (!access?.open) next = { kind: 'waiting', label: '检查解锁条件', message: access?.message || '下一关尚不可进入。' }
    }
    return { progress, next }
  }

  return {
    openSession (studentId, slug) {
      const level = readLevel(slug)
      if (!level) throw new ProgressError(404, { message: '关卡不存在，请返回地图。' })
      const progress = accounts.readProgress(studentId)
      requireAccess(progress, slug)
      if (!progress[slug]) {
        progress[slug] = createSession(level, 0)
        accounts.saveProgress(studentId, progress)
      }
      return { session: progress[slug], progress }
    },
    previewContinuation (studentId, slug, sessionId) {
      return continuation(studentId, slug, sessionId).next
    },
    continue (studentId, slug, sessionId) {
      const { progress, next } = continuation(studentId, slug, sessionId)
      if (!['scene', 'level'].includes(next.kind)) throw new ProgressError(409, next)
      let scene = next.scene
      if (next.kind === 'level' && progress[next.slug]) {
        const titles = readLevel(next.slug).teachingMap.scenarioTitles || ['主场景']
        scene = Math.max(0, titles.findIndex((_, i) => !progress[next.slug].scenePasses?.[i]))
      }
      transition(studentId, progress, next.slug, scene)
      return { url: `/play/level/${next.slug}?codeLanguage=python` }
    },
    selectScene (studentId, slug, scene, sessionId) {
      if (!readLevel(slug, scene)) throw new ProgressError(400, { message: '场景不存在，请返回地图重新选择。' })
      const progress = accounts.readProgress(studentId)
      requireAccess(progress, slug)
      if (progress[slug] || sessionId) requireCurrentSession(progress[slug], sessionId)
      transition(studentId, progress, slug, scene)
      return { url: `/play/level/${slug}?codeLanguage=python` }
    },
  }
}

module.exports = { createLearningProgress, ProgressError }
