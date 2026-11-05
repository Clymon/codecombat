// Original local teaching overlay. This only handles our namespace, never official levels.
const fs = require('fs')
const path = require('path')
const crypto = require('crypto')
const express = require('express')
const accounts = require('./student-accounts')
const { decorateLevel } = require('./story-cast')
const { DEEPSEEK_TYPE, deepseekType, applyHero } = require('./hero-types')
const { FLOOR_PREFIX } = require('./local-type-ids')
const { floorType, applyVillageScene } = require('./village-scenes')
const accountPage = require('./account-page')
const classroom = require('./classroom-state')
const teacherPage = require('./teacher-page')
const { compareLevels } = require('./curriculum')
const levelsDir = path.join(__dirname, 'levels')
const slugPattern = /^local-python-\d{2}$/
const sessionPattern = /^facebe[0-9a-f]{18}$/
function readLevel (slug, scene = 0) {
  if (!slugPattern.test(slug)) return null
  if (!Number.isInteger(scene) || scene < 0 || scene > 20) return null
  const file = scene ? path.join(levelsDir, 'scenarios', `${slug}-${scene}.json`) : path.join(levelsDir, `${slug}.json`)
  return fs.existsSync(file) ? applyVillageScene(applyHero(decorateLevel(JSON.parse(fs.readFileSync(file, 'utf8'))))) : null
}
function newSession (level, scene = 0) {
  return { _id: `facebe${crypto.randomBytes(9).toString('hex')}`, creator: 'local-teaching-preview', team: 'humans', codeLanguage: 'python', level: { original: level.original, majorVersion: 0 }, state: { complete: false, scripts: {} }, code: {}, permissions: [{ target: 'public', access: 'write' }], teachingScene: scene, mapRevision: level.teachingMap.revision, createdAt: new Date().toISOString() }
}
function sendSession (res, session) {
  const result = { ...session }
  // The native client supplies its own editability tag; ownership is cookie-based.
  delete result.creator
  return res.set('Cache-Control', 'no-store').json(result)
}
function requireStudent (req, res) {
  const student = accounts.currentStudent(req)
  if (!student) res.status(401).set('Cache-Control', 'no-store').json({ message: '请先使用学号登录。', loginUrl: '/teaching' })
  return student
}
function requireUnlocked (res, slug) {
  if (classroom.isUnlocked(slug)) return true
  res.status(403).set('Cache-Control', 'no-store').json({ message: '此关尚未开放，请等待老师发布。' })
  return false
}
module.exports = function setupLocalLevels (app) {
  for (const portrait of ['deepseek-icon.png', 'deepseek-portrait-v2.png']) app.get(`/file/teaching/${portrait}`, (req, res) => res.set('Cache-Control', 'no-cache').sendFile(path.join(__dirname, 'assets/characters/deepseek.png')))
  app.use('/teaching/assets', express.static(path.join(__dirname, 'assets'), { dotfiles: 'deny', maxAge: 0, index: false }))
  for (const suffix of ['', '/version', '/version/0']) app.get(`/db/thang.type/${DEEPSEEK_TYPE}${suffix}`, (req, res) => res.set('Cache-Control', 'no-cache').json(deepseekType()))
  app.get(new RegExp(`^/db/thang\\.type/(${FLOOR_PREFIX}[0-9a-f]{10})(?:/version(?:/0)?)?$`), (req, res) => {
    const type = floorType(req.params[0])
    if (!type) return res.sendStatus(404)
    res.set('Cache-Control', 'no-cache').json(type)
  })
  const formParser = express.urlencoded({ extended: false, limit: '2kb' })
  const levels = () => fs.readdirSync(levelsDir).filter(f => /^local-python-\d{2}\.json$/.test(f)).map(f => readLevel(f.slice(0, -5))).sort(compareLevels)
  const htmlHeaders = { 'Cache-Control': 'no-store', 'Content-Security-Policy': "default-src 'none'; style-src 'self' 'unsafe-inline'; img-src 'self'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'", 'X-Frame-Options': 'DENY', 'Referrer-Policy': 'no-referrer' }
  const render = (res, student, error = '', status = 200) => {
    return res.status(status).set(htmlHeaders).type('html').send(accountPage({ student, levels: levels(), progress: student ? accounts.readProgress(student.studentId) : {}, releases: classroom.releases(), visibility: classroom.visibility(), showTeacher: classroom.isTeacherLocal(res.req), error, formToken: accounts.formToken(res.req, res) }))
  }
  const teacherOnly = (req, res) => {
    if (classroom.isTeacherLocal(req)) return true
    res.status(403).set('Cache-Control', 'no-store').type('text').send('教师端仅可在运行服务的电脑上打开。')
    return false
  }
  app.get('/teaching/teacher', (req, res) => {
    if (!teacherOnly(req, res)) return
    const students = accounts.registeredStudents()
    const progressById = Object.fromEntries(students.map(student => [student.studentId, accounts.readProgress(student.studentId)]))
    const count = Number(req.query.count); const actions = { hide: '隐藏', show: '显示', open: '开放', close: '关闭' }
    const notice = typeof req.query.updated === 'string' && Object.hasOwn(actions, req.query.updated) && Number.isInteger(count) && count > 0 && count <= levels().length ? `已批量${actions[req.query.updated]} ${count} 关。` : ''
    res.set({ ...htmlHeaders, 'Content-Security-Policy': htmlHeaders['Content-Security-Policy'] + "; script-src 'self'" }).type('html').send(teacherPage.teacherPage({ levels: levels(), students, releases: classroom.releases(), visibility: classroom.visibility(), progressById, notice, formToken: accounts.formToken(req, res) }))
  })
  app.get('/teaching/teacher/controls.js', (req, res) => {
    if (!teacherOnly(req, res)) return
    res.set('Cache-Control', 'no-cache').type('application/javascript').send(fs.readFileSync(path.join(__dirname, 'teacher-controls.js'), 'utf8'))
  })
  app.post('/teaching/teacher/bulk', formParser, (req, res) => {
    if (!teacherOnly(req, res)) return
    if (!accounts.validForm(req)) return res.sendStatus(403)
    const values = typeof req.body?.slugs === 'string' ? [req.body.slugs] : req.body?.slugs
    const operation = req.body?.operation
    if (!Array.isArray(values) || !values.length || values.length > levels().length || !values.every(slug => typeof slug === 'string' && readLevel(slug)) || !['hide', 'show', 'open', 'close'].includes(operation)) return res.status(400).type('text').send('请先勾选有效关卡，再选择批量操作。')
    const slugs = [...new Set(values)]
    classroom.updateMany(slugs, operation)
    res.redirect(303, `/teaching/teacher?updated=${operation}&count=${slugs.length}#bulk-controls`)
  })
  app.get('/teaching/teacher/student/:studentId', (req, res) => {
    if (!teacherOnly(req, res)) return
    const student = accounts.account(req.params.studentId)
    if (!student) return res.sendStatus(404)
    res.set(htmlHeaders).type('html').send(teacherPage.studentPage({ student, levels: levels(), progress: accounts.readProgress(student.studentId) }))
  })
  app.post('/teaching/teacher/release', formParser, (req, res) => {
    if (!teacherOnly(req, res)) return
    if (!accounts.validForm(req)) return res.sendStatus(403)
    const slug = req.body?.slug
    if (!readLevel(slug) || !['true', 'false'].includes(req.body?.open)) return res.sendStatus(400)
    classroom.setUnlocked(slug, req.body.open === 'true')
    res.redirect(303, `/teaching/teacher#release-${slug}`)
  })
  app.post('/teaching/teacher/visibility', formParser, (req, res) => {
    if (!teacherOnly(req, res)) return
    if (!accounts.validForm(req)) return res.sendStatus(403)
    const slug = req.body?.slug
    if (!readLevel(slug) || !['true', 'false'].includes(req.body?.visible)) return res.sendStatus(400)
    classroom.setVisible(slug, req.body.visible === 'true')
    res.redirect(303, `/teaching/teacher#release-${slug}`)
  })
  // Read-only preview, then a CSRF-protected transition. Never bypass teacher releases.
  const continuation = (req, res) => {
    const student = requireStudent(req, res)
    if (!student) return null
    const slug = req.params.slug; const level = readLevel(slug)
    if (!level) { res.sendStatus(404); return null }
    if (!requireUnlocked(res, slug)) return null
    const progress = accounts.readProgress(student.studentId); const session = progress[slug]
    const sessionId = req.method === 'GET' ? req.query.sessionId : req.body?.sessionId
    if (!session || session._id !== sessionId) { res.status(409).json({ message: '这个页面的场景已改变，请刷新后继续。' }); return null }
    const next = require('./continuation').nextTask(levels().filter(level => classroom.isVisible(level.slug)), slug, session, classroom.releases())
    return { student, progress, next }
  }
  app.get('/teaching/continue/:slug', (req, res) => {
    const state = continuation(req, res)
    if (state) res.set('Cache-Control', 'no-store').json({ ...state.next, formToken: accounts.formToken(req, res) })
  })
  app.post('/teaching/continue/:slug', formParser, (req, res) => {
    if (!accounts.validForm(req)) return res.sendStatus(403)
    const state = continuation(req, res)
    if (!state) return
    const { student, progress, next } = state
    if (!['scene', 'level'].includes(next.kind)) return res.status(409).json(next)
    let session = progress[next.slug]
    // Resume the first remaining scene of the next level, keeping its saved code.
    if (next.kind === 'level' && session) {
      const titles = readLevel(next.slug).teachingMap.scenarioTitles || ['主场景']
      next.scene = Math.max(0, titles.findIndex((_, i) => !session.scenePasses?.[i]))
    }
    if (!session) session = progress[next.slug] = newSession(readLevel(next.slug, next.scene), next.scene)
    else {
      session.teachingScene = next.scene
      session._id = `facebe${crypto.randomBytes(9).toString('hex')}`
      session.state = { complete: false, scripts: {} }
    }
    accounts.saveProgress(student.studentId, progress)
    res.set('Cache-Control', 'no-store').json({ url: `/play/level/${next.slug}?codeLanguage=python` })
  })
  app.post('/teaching/scenario', formParser, (req, res) => {
    const student = requireStudent(req, res)
    if (!student) return
    if (!accounts.validForm(req)) return res.sendStatus(403)
    const slug = req.body?.slug; const scene = Number(req.body?.scene)
    if (!readLevel(slug, scene)) return res.status(400).end()
    if (!requireUnlocked(res, slug)) return
    const progress = accounts.readProgress(student.studentId)
    const session = progress[slug]
    if (session) {
      session.teachingScene = scene
      // Rotate the ID so a late save from the old scene cannot credit the new one.
      session._id = `facebe${crypto.randomBytes(9).toString('hex')}`
      session.state = { complete: false, scripts: {} }
      accounts.saveProgress(student.studentId, progress)
    } else {
      progress[slug] = newSession(readLevel(slug, scene), scene)
      accounts.saveProgress(student.studentId, progress)
    }
    res.redirect(303, `/play/level/${slug}?codeLanguage=python`)
  })
  app.get('/teaching/classroom.css', (req, res) => {
    res.set('Cache-Control', 'no-cache').type('css').send(fs.readFileSync(path.join(__dirname, 'classroom.css'), 'utf8'))
  })
  app.get('/teaching', (req, res) => {
    render(res, accounts.currentStudent(req))
  })
  // Retired local route: never send old signup submissions to the upstream proxy.
  app.all('/teaching/register', (req, res) => {
    res.status(410).set('Cache-Control', 'no-store').type('text').send('请在课堂登录页直接输入学号。')
  })
  app.post('/teaching/login', formParser, (req, res) => {
    if (!accounts.validForm(req)) return res.sendStatus(403)
    const studentId = accounts.normalStudentId(req.body?.studentId)
    if (!studentId) return render(res, null, '学号须为4—20位数字，请检查后重试。', 400)
    accounts.ensureStudent(studentId)
    accounts.startSession(req, res, studentId)
    res.redirect(303, '/teaching')
  })
  app.post('/teaching/logout', formParser, (req, res) => {
    if (!accounts.validForm(req)) return res.sendStatus(403)
    accounts.endSession(req, res)
    res.redirect(303, '/teaching')
  })
  app.get('/db/level/:slug', (req, res, next) => {
    const level = readLevel(req.params.slug)
    if (!level) return next()
    if (!requireStudent(req, res)) return
    if (!requireUnlocked(res, level.slug)) return
    const student = accounts.currentStudent(req)
    const scene = accounts.readProgress(student.studentId)[level.slug]?.teachingScene || 0
    res.set('Cache-Control', 'no-store').json(readLevel(level.slug, scene) || level)
  })
  app.get('/db/level.system/facadecccc00000000000001/version/0', (req, res) => {
    if (!requireStudent(req, res)) return
    const code = fs.readFileSync(path.join(__dirname, 'learning-runtime.js'), 'utf8').replace('module.exports =', 'const TeachingLearning =') + '\n' + fs.readFileSync(path.join(__dirname, 'adventure-runtime.js'), 'utf8').replace('module.exports =', 'const TeachingAdventure =') + '\n' + fs.readFileSync(path.join(__dirname, 'rules-system.js'), 'utf8')
    res.json({ _id: 'facadecccc00000000000001', original: 'facadecccc00000000000001', name: 'TeachingRules', codeLanguage: 'javascript', code, js: code, version: { major: 0, minor: 0 }, dependencies: [], configSchema: { type: 'object', properties: { learningContract: { type: ['object', 'null'] }, adventureConfig: { type: ['object', 'null'] }, walls: { type: 'array', default: [] }, bounds: { type: 'object' }, guard: { type: ['object', 'null'] }, checkpoints: { type: 'array' }, exit: { type: 'array' }, hazards: { type: 'array' }, gates: { type: 'array' }, noGems: { type: 'boolean' }, requireFinished: { type: 'boolean' }, exitStyle: { type: 'string' }, exitDirection: { type: 'array' }, exitDuration: { type: 'number' }, sensor: { type: 'object' }, switches: { type: 'array' }, singleStep: { type: 'boolean' }, maxActions: { type: 'number' }, expectedSpeech: { type: ['array', 'null'] } } } })
  })
  app.get('/db/level/:slug/session', (req, res, next) => {
    const level = readLevel(req.params.slug)
    if (!level) return next()
    const student = requireStudent(req, res)
    if (!student) return
    if (!requireUnlocked(res, level.slug)) return
    const owner = student.studentId; const state = accounts.readProgress(owner)
    if (!state[level.slug]) {
      state[level.slug] = newSession(level)
      accounts.saveProgress(owner, state)
    }
    if (state[level.slug].mapRevision !== level.teachingMap?.revision) {
      state[level.slug].state = { complete: false, scripts: {} }
      state[level.slug].mapRevision = level.teachingMap?.revision
      state[level.slug].scenePasses = {}
      state[level.slug].teachingComplete = false
      accounts.saveProgress(owner, state)
    }
    sendSession(res, state[level.slug])
  })
  // Never forward local session writes to the official backend; isolate by student account.
  app.use('/db/level.session/:id', express.json({ limit: '1mb', type: req => sessionPattern.test(req.params.id) && req.is('application/json') }), (req, res, next) => {
    if (!sessionPattern.test(req.params.id)) return next()
    const student = requireStudent(req, res)
    if (!student) return
    const owner = student.studentId; const state = accounts.readProgress(owner)
    const entry = Object.entries(state).find(([, session]) => session._id === req.params.id)
    if (!entry) return res.status(404).json({ message: 'Local session not found for this browser.' })
    const [slug, session] = entry
    if (!requireUnlocked(res, slug)) return
    if (['PUT', 'PATCH', 'POST'].includes(req.method) && req.path === '/') {
      for (const key of ['code', 'state', 'codeLanguage', 'submittedCode', 'submitted', 'playtime', 'levelName', 'levelID', 'changed', 'codeConcepts']) {
        if (req.body && Object.hasOwn(req.body, key)) session[key] = req.body[key]
      }
      require('./scenario-progress').record(session, readLevel(slug), req.body)
      session.updatedAt = new Date().toISOString()
      accounts.saveProgress(owner, state)
    } else if (req.method !== 'GET') return res.status(405).json({ message: 'Unsupported local session operation.' })
    sendSession(res, session)
  })
}
module.exports.readLevel = readLevel
