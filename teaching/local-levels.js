// Original local teaching overlay. This only handles our namespace, never official levels.
const fs = require('fs')
const path = require('path')
const express = require('express')
const accounts = require('./student-accounts')
const { createLearningProgress, ProgressError } = require('./learning-progress')
const { decorateLevel } = require('./story-cast')
const { DEEPSEEK_TYPE, deepseekType, applyHero } = require('./hero-types')
const { FLOOR_PREFIX } = require('./local-type-ids')
const { floorType, applyVillageScene } = require('./village-scenes')
const accountPage = require('./account-page')
const classroom = require('./classroom-state')
const { catalog, accessFor } = require('./level-access')
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
function requireUnlocked (res, slug, progress) {
  const access = accessFor(catalog, { progress, releases: classroom.releases(), visibility: classroom.visibility() })[slug]
  if (access?.open) return true
  res.status(403).set('Cache-Control', 'no-store').json({ message: access?.message || '此关不可进入，请返回地图。', reason: access?.reason, prerequisites: access?.missing, mapUrl: `/teaching?level=${slug}` })
  return false
}
module.exports = function setupLocalLevels (app, options = {}) {
  const readLevel = options.readLevel || module.exports.readLevel
  for (const portrait of ['deepseek-icon.png', 'deepseek-portrait-v2.png']) app.get(`/file/teaching/${portrait}`, (req, res) => res.set('Cache-Control', 'no-cache').sendFile(path.join(__dirname, 'assets/characters/deepseek.png')))
  app.use('/teaching/assets', express.static(path.join(__dirname, 'assets'), { dotfiles: 'deny', maxAge: 0, index: false }))
  for (const suffix of ['', '/version', '/version/0']) app.get(`/db/thang.type/${DEEPSEEK_TYPE}${suffix}`, (req, res) => res.set('Cache-Control', 'no-cache').json(deepseekType()))
  app.get(new RegExp(`^/db/thang\\.type/(${FLOOR_PREFIX}[0-9a-f]{10})(?:/version(?:/0)?)?$`), (req, res) => {
    const type = floorType(req.params[0])
    if (!type) return res.sendStatus(404)
    res.set('Cache-Control', 'no-cache').json(type)
  })
  const formParser = express.urlencoded({ extended: false, limit: '2kb' })
  const levels = () => catalog.map(entry => readLevel(entry.slug)).sort(compareLevels)
  const progressLifecycle = createLearningProgress({ readLevel, levels })
  const handleProgress = handler => (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next)
  const htmlHeaders = { 'Cache-Control': 'no-store', 'Content-Security-Policy': "default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'", 'X-Frame-Options': 'DENY', 'Referrer-Policy': 'no-referrer' }
  const render = async (res, student, error = '', status = 200) => {
    return res.status(status).set(htmlHeaders).type('html').send(accountPage({ student, levels: levels(), progress: student ? await progressLifecycle.readProgress(student.studentId) : {}, releases: classroom.releases(), visibility: classroom.visibility(), showTeacher: classroom.isTeacherLocal(res.req), error, formToken: accounts.formToken(res.req, res) }))
  }
  const teacherOnly = (req, res) => {
    if (classroom.isTeacherLocal(req)) return true
    res.status(403).set('Cache-Control', 'no-store').type('text').send('教师端仅可在运行服务的电脑上打开。')
    return false
  }
  app.get('/teaching/teacher', handleProgress(async (req, res) => {
    if (!teacherOnly(req, res)) return
    const students = accounts.registeredStudents()
    const progressById = Object.fromEntries(await Promise.all(students.map(async student => [student.studentId, await progressLifecycle.readProgress(student.studentId)])))
    const count = Number(req.query.count); const actions = { hide: '隐藏', show: '显示', open: '开放', close: '关闭' }
    const notice = typeof req.query.updated === 'string' && Object.hasOwn(actions, req.query.updated) && Number.isInteger(count) && count > 0 && count <= levels().length ? `已批量${actions[req.query.updated]} ${count} 关。` : ''
    res.set(htmlHeaders).type('html').send(teacherPage.teacherPage({ levels: levels(), students, releases: classroom.releases(), visibility: classroom.visibility(), progressById, notice, formToken: accounts.formToken(req, res) }))
  }))
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
  app.get('/teaching/teacher/student/:studentId', handleProgress(async (req, res) => {
    if (!teacherOnly(req, res)) return
    const student = accounts.account(req.params.studentId)
    if (!student) return res.sendStatus(404)
    res.set(htmlHeaders).type('html').send(teacherPage.studentPage({ student, levels: levels(), progress: await progressLifecycle.readProgress(student.studentId) }))
  }))
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
  // Preview is read-only; each transition rechecks access and the attempt identity.
  app.get('/teaching/continue/:slug', handleProgress(async (req, res) => {
    const student = requireStudent(req, res)
    if (!student) return
    const next = await progressLifecycle.previewContinuation(student.studentId, req.params.slug, req.query.sessionId)
    res.set('Cache-Control', 'no-store').json({ ...next, formToken: accounts.formToken(req, res) })
  }))
  app.post('/teaching/continue/:slug', formParser, handleProgress(async (req, res) => {
    const student = requireStudent(req, res)
    if (!student) return
    if (!accounts.validForm(req)) return res.sendStatus(403)
    const result = await progressLifecycle.continue(student.studentId, req.params.slug, req.body?.sessionId)
    res.set('Cache-Control', 'no-store').json(result)
  }))
  app.post('/teaching/scenario', formParser, handleProgress(async (req, res) => {
    const student = requireStudent(req, res)
    if (!student) return
    if (!accounts.validForm(req)) return res.sendStatus(403)
    const result = await progressLifecycle.selectScene(student.studentId, req.body?.slug, Number(req.body?.scene), req.body?.sessionId)
    res.redirect(303, result.url)
  }))
  app.get('/teaching/world-map.js', (req, res) => {
    res.set('Cache-Control', 'no-cache').type('js').send(fs.readFileSync(path.join(__dirname, 'world-map-client.js'), 'utf8'))
  })
  app.get('/teaching/classroom.css', (req, res) => {
    res.set('Cache-Control', 'no-cache').type('css').send(fs.readFileSync(path.join(__dirname, 'classroom.css'), 'utf8'))
  })
  app.get('/teaching', handleProgress(async (req, res) => {
    await render(res, accounts.currentStudent(req))
  }))
  // Retired local route: never send old signup submissions to the upstream proxy.
  app.all('/teaching/register', (req, res) => {
    res.status(410).set('Cache-Control', 'no-store').type('text').send('请在课堂登录页直接输入学号。')
  })
  app.post('/teaching/login', formParser, handleProgress(async (req, res) => {
    if (!accounts.validForm(req)) return res.sendStatus(403)
    const studentId = accounts.normalStudentId(req.body?.studentId)
    if (!studentId) return render(res, null, '学号须为4—20位数字，请检查后重试。', 400)
    accounts.ensureStudent(studentId)
    accounts.startSession(req, res, studentId)
    res.redirect(303, '/teaching')
  }))
  app.post('/teaching/logout', formParser, (req, res) => {
    if (!accounts.validForm(req)) return res.sendStatus(403)
    accounts.endSession(req, res)
    res.redirect(303, '/teaching')
  })
  app.get('/db/level/:slug', handleProgress(async (req, res, next) => {
    const level = readLevel(req.params.slug)
    if (!level) return next()
    if (!requireStudent(req, res)) return
    const student = accounts.currentStudent(req)
    const progress = await progressLifecycle.readProgress(student.studentId)
    if (!requireUnlocked(res, level.slug, progress)) return
    const scene = progress[level.slug]?.teachingScene || 0
    res.set('Cache-Control', 'no-store').json(readLevel(level.slug, scene) || level)
  }))
  app.get('/db/level.system/facadecccc00000000000001/version/0', (req, res) => {
    if (!requireStudent(req, res)) return
    const code = fs.readFileSync(path.join(__dirname, 'interaction-rules.js'), 'utf8').replace('module.exports =', 'const TeachingInteractions =') + '\n' + fs.readFileSync(path.join(__dirname, 'item-runtime.js'), 'utf8').replace('module.exports =', 'const TeachingInventory =') + '\n' + fs.readFileSync(path.join(__dirname, 'learning-runtime.js'), 'utf8').replace('module.exports =', 'const TeachingLearning =') + '\n' + fs.readFileSync(path.join(__dirname, 'adventure-runtime.js'), 'utf8').replace('module.exports =', 'const TeachingAdventure =') + '\n' + fs.readFileSync(path.join(__dirname, 'rules-system.js'), 'utf8')
    res.json({ _id: 'facadecccc00000000000001', original: 'facadecccc00000000000001', name: 'TeachingRules', codeLanguage: 'javascript', code, js: code, version: { major: 0, minor: 0 }, dependencies: [], configSchema: { type: 'object', properties: { learningContract: { type: ['object', 'null'] }, adventureConfig: { type: ['object', 'null'] }, walls: { type: 'array', default: [] }, bounds: { type: 'object' }, guard: { type: ['object', 'null'] }, checkpoints: { type: 'array' }, exit: { type: 'array' }, hazards: { type: 'array' }, gates: { type: 'array' }, noGems: { type: 'boolean' }, requireFinished: { type: 'boolean' }, exitStyle: { type: 'string' }, exitDirection: { type: 'array' }, exitDuration: { type: 'number' }, sensor: { type: 'object' }, switches: { type: 'array' }, singleStep: { type: 'boolean' }, maxActions: { type: 'number' }, expectedSpeech: { type: ['array', 'null'] } } } })
  })
  app.get('/db/level/:slug/session', handleProgress(async (req, res, next) => {
    const level = readLevel(req.params.slug)
    if (!level) return next()
    const student = requireStudent(req, res)
    if (!student) return
    sendSession(res, await progressLifecycle.openSession(student.studentId, level.slug))
  }))
  // Never forward local session writes to the official backend; isolate by student account.
  app.use('/db/level.session/:id', express.json({ limit: '1mb', type: req => sessionPattern.test(req.params.id) && req.is('application/json') }), handleProgress(async (req, res, next) => {
    if (!sessionPattern.test(req.params.id)) return next()
    const student = requireStudent(req, res)
    if (!student) return
    let session
    if (['PUT', 'PATCH', 'POST'].includes(req.method) && req.path === '/') {
      session = await progressLifecycle.saveSession(student.studentId, req.params.id, req.body)
    } else if (req.method === 'GET') {
      session = await progressLifecycle.readSession(student.studentId, req.params.id)
    } else return res.status(405).json({ message: 'Unsupported local session operation.' })
    sendSession(res, session)
  }))
  app.use((error, req, res, next) => {
    if (error instanceof accounts.PersistenceError) return res.status(503).set('Cache-Control', 'no-store').json({ message: error.message, retryable: true })
    if (!(error instanceof ProgressError)) return next(error)
    res.status(error.status).set('Cache-Control', 'no-store').json(error.detail)
  })
}
module.exports.readLevel = readLevel
