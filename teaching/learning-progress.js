// Owns progress reads and writes as complete, per-student operations.
const crypto = require('crypto')
const accounts = require('./student-accounts')
const classroom = require('./classroom-state')
const { accessFor, catalog } = require('./level-access')
const { nextTask } = require('./continuation')
const { record } = require('./scenario-progress')
const revisions = require('./progress-revisions')

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

function createLearningProgress ({ readLevel, levels, store = accounts, requireAccess: customAccess, prepareSave = body => body, onSaved = () => {} }) {
  function revision (slug) {
    const published = readLevel.progressRevision?.(slug)
    if (published) return published
    // Mutable/custom readers retain live scene inspection, including while the
    // external checker runs. No cached identity is inferred for an unknown source.
    const level = readLevel(slug)
    return level && { ...level, identity: revisions.identity(readLevel, slug) }
  }
  // Only this module coordinates progress operations. Route callers cannot omit the queue.
  const pending = new Map()
  function serialized (studentId, operation) {
    const previous = pending.get(studentId) || Promise.resolve()
    const result = previous.catch(() => {}).then(operation)
    pending.set(studentId, result)
    const settled = () => { if (pending.get(studentId) === result) pending.delete(studentId) }
    result.then(settled, settled)
    return result
  }

  function loadProgress (studentId) {
    const progress = store.readProgress(studentId)
    let changed = false
    for (const [slug, session] of Object.entries(progress)) {
      const level = revision(slug)
      if (level) changed = revisions.reconcile(session, level, level.identity) || changed
    }
    if (changed) store.saveProgress(studentId, progress)
    return progress
  }

  function attempt (studentId, sessionId, operation = 'open') {
    const progress = store.readProgress(studentId)
    const entry = Object.entries(progress).find(([, session]) => session._id === sessionId)
    if (!entry) throw new ProgressError(404, { message: 'Local session not found for this browser.' })
    const [slug] = entry
    const current = loadProgress(studentId)
    const session = current[slug]
    requireCurrentSession(session, sessionId)
    requireAccess(studentId, current, slug, operation)
    return { progress: current, slug, session }
  }
  function requireAccess (studentId, progress, slug, operation = 'open') {
    if (customAccess) return customAccess(studentId, slug, operation)
    const access = accessFor(catalog, { progress, releases: classroom.releases(), visibility: classroom.visibility() })[slug]
    if (!access?.open) throw new ProgressError(403, { message: access?.message || '此关不可进入，请返回地图。', reason: access?.reason, prerequisites: access?.missing, mapUrl: `/teaching?level=${slug}` })
  }

  function requireCurrentSession (session, sessionId) {
    if (!session || session._id !== sessionId) throw new ProgressError(409, { message: session?.revisionNotice || '这个页面的场景已改变，请刷新后继续。' })
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
    } else progress[slug] = { ...createSession(level, scene), gameplayIdentity: revision(slug).identity }
    store.saveProgress(studentId, progress)
    return progress[slug]
  }

  function continuation (studentId, slug, sessionId) {
    if (!readLevel(slug)) throw new ProgressError(404, { message: '关卡不存在，请返回地图。' })
    const progress = loadProgress(studentId)
    requireAccess(studentId, progress, slug)
    const session = progress[slug]
    requireCurrentSession(session, sessionId)
    let next = nextTask(customAccess ? levels() : levels().filter(level => classroom.isVisible(level.slug)), slug, session, classroom.releases())
    if (next.kind === 'level') {
      const access = accessFor(catalog, { progress, releases: classroom.releases(), visibility: classroom.visibility() })[next.slug]
      if (!access?.open) next = { kind: 'waiting', label: '检查解锁条件', message: access?.message || '下一关尚不可进入。' }
    }
    return { progress, next }
  }

  const operations = {
    readProgress (studentId) {
      // A detached view: callers receive no writable handle to stored progress.
      return structuredClone(loadProgress(studentId))
    },
    openSession (studentId, slug) {
      const level = readLevel(slug)
      if (!level) throw new ProgressError(404, { message: '关卡不存在，请返回地图。' })
      const progress = loadProgress(studentId)
      requireAccess(studentId, progress, slug)
      if (!progress[slug]) {
        progress[slug] = { ...createSession(level, 0), gameplayIdentity: revision(slug).identity }
        store.saveProgress(studentId, progress)
      }
      const session = progress[slug]
      if (revisions.reconcile(session, level, revision(slug).identity)) store.saveProgress(studentId, progress)
      return session
    },
    readSession (studentId, sessionId) {
      return attempt(studentId, sessionId).session
    },
    async saveSession (studentId, sessionId, body = {}) {
      const { slug, session } = attempt(studentId, sessionId, 'save')
      body = prepareSave(body)
      const code = body.code?.['hero-placeholder']?.plan
      if (code !== undefined && typeof code !== 'string') throw new ProgressError(400, { message: '代码格式无效，请刷新编辑器后重试。' })
      for (const key of ['code', 'state', 'codeLanguage', 'submittedCode', 'submitted', 'playtime', 'levelName', 'levelID', 'changed', 'codeConcepts']) {
        if (Object.hasOwn(body, key)) session[key] = body[key]
      }
      await record(session, readLevel(slug), body)
      if (body.state?.complete && prepareSave(body).state?.complete === false) {
        const prior = store.readProgress(studentId)[slug]
        session.scenePasses = prior?.scenePasses || {}
        session.codeHash = prior?.codeHash
        await record(session, readLevel(slug), { ...body, state: { ...body.state, complete: false } })
      }
      // Content can change while the Python checker is running. Reconcile disk first,
      // so an old result (or code) cannot overwrite the current attempt.
      const current = loadProgress(studentId)
      requireCurrentSession(current[slug], sessionId)
      session.mapRevision = current[slug].mapRevision
      current[slug] = session
      if (session.teachingComplete) session.revisionNotice = ''
      session.updatedAt = new Date().toISOString()
      store.saveProgress(studentId, current)
      onSaved(studentId, slug, session)
      return session
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
      const progress = loadProgress(studentId)
      requireAccess(studentId, progress, slug)
      if (progress[slug] || sessionId) requireCurrentSession(progress[slug], sessionId)
      transition(studentId, progress, slug, scene)
      return { url: `/play/level/${slug}?codeLanguage=python` }
    },
  }
  return Object.fromEntries(Object.entries(operations).map(([name, operation]) => [name, (studentId, ...args) => serialized(studentId, () => operation(studentId, ...args))]))
}

module.exports = { createLearningProgress, ProgressError }
