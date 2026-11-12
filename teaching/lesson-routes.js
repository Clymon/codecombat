const express = require('express')
const path = require('node:path')
const auth = require('./teacher-auth')
const accounts = require('./student-accounts')
const room = require('./lesson-room')
const pages = require('./lesson-pages')
const { tasks } = require('./lesson-curriculum')
const { createLearningProgress, ProgressError } = require('./learning-progress')
const scoped = new Map()
const headers = { 'Cache-Control': 'no-store', 'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self'; frame-src 'self'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'", 'X-Frame-Options': 'DENY' }
const wrap = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next)
function teacher (req, res) {
  const value = auth.current(req)
  if (!value) { res.status(401).json({ message: '请先登录教师账号。', loginUrl: '/teaching/teacher/login' }); return null }
  return value
}
function student (req, res) {
  const value = accounts.currentStudent(req)
  if (!value) res.status(401).json({ message: '请先使用学号登录。' })
  return value
}
function classroomLifecycle (readLevel, roomId, review = false) {
  const key = roomId + (review ? ':review' : '')
  if (!scoped.has(key)) {
    if (scoped.size > 8) scoped.delete(scoped.keys().next().value)
    const lifecycle = createLearningProgress({
      readLevel,
      levels: () => Object.values(tasks).map(t => readLevel(t.slug)),
      store: room.store(roomId, review),
      requireAccess: (studentId, slug, operation) => {
        const current = room.load()
        if (current.id !== roomId) throw new ProgressError(409, { message: '课堂已经切换。请保留代码，回到本节课继续。' })
        if (operation === 'save') return
        if (review && room.reviewAllowed(studentId, slug)) return
        const access = room.access(studentId, slug)
        if (!access?.allowed) throw new ProgressError(403, { message: '请从本节课进入老师安排的任务。', mapUrl: '/teaching/room' })
      },
      prepareSave: body => {
        if (review) return body
        if (!room.load().paused && room.load().status === 'live') return body
        // Pausing blocks acceptance, not draft persistence.
        return { ...body, state: { ...body.state, complete: false }, submitted: false }
      },
      onSaved: (studentId, slug, session) => { if (!review) room.record(roomId, studentId, slug, session) },
    })
    scoped.set(key, lifecycle)
  }
  return scoped.get(key)
}
function install (app, { readLevel, freeLifecycle }) {
  app.use(['/teaching/room', '/teaching/teacher/lesson'], (req, res, next) => { res.set('Cache-Control', 'no-store'); next() })
  const json = express.json({ limit: '12kb' }); const form = express.urlencoded({ extended: false, limit: '3kb' })
  for (const name of ['lesson.css', 'lesson-page.js', 'lesson-cabin.css', 'lesson-cabin.js', 'lesson-drafts.js', 'lesson-hub.js']) app.get('/teaching/' + name, (req, res) => res.set('Cache-Control', 'no-cache').sendFile(path.join(__dirname, name)))
  app.get('/teaching/teacher/login', (req, res) => res.set(headers).type('html').send(pages.login(accounts.formToken(req, res), !!auth.config())))
  app.post('/teaching/teacher/login', form, wrap(async (req, res) => {
    if (!accounts.validForm(req)) return res.sendStatus(403)
    if (!await auth.login(req, res, req.body.user, req.body.password)) return res.status(401).set(headers).type('html').send(pages.login(accounts.formToken(req, res), !!auth.config(), '账号或密码不正确，或尝试过于频繁，请稍后再试。'))
    res.redirect(303, '/teaching/teacher/lesson')
  }))
  app.post('/teaching/teacher/logout', form, (req, res) => {
    if (!accounts.validForm(req)) return res.sendStatus(403)
    auth.logout(req, res); res.redirect(303, '/teaching/teacher/login')
  })
  app.get('/teaching/teacher/lesson', (req, res) => {
    if (!auth.current(req)) return res.redirect('/teaching/teacher/login')
    res.set(headers).type('html').send(pages.teacher(accounts.formToken(req, res)))
  })
  app.get('/teaching/teacher/lesson/state', (req, res) => {
    const t = teacher(req, res); if (!t) return
    const state = room.load()
    res.json({ ...state, controller: undefined, controlling: state.controller === t.id, assignments: (state.assignments || []).map(a => ({ ...a, title: tasks[a.task].title })), students: Object.entries(state.students).map(([id, p]) => ({ ...p, id, stage: tasks[p.task].stage, taskTitle: tasks[p.task].title, offeredTitle: tasks[p.offeredTask]?.title, mastered: !!p.results[p.task]?.independent, assisted: !!p.assisted[p.task] })) })
  })
  app.post('/teaching/teacher/lesson/command', json, (req, res, next) => {
    try {
      const t = teacher(req, res); if (!t) return
      if (!accounts.validForm(req)) return res.sendStatus(403)
      const state = room.command(t, req.body)
      res.json({ ok: true, revision: state.revision })
    } catch (e) { next(e) }
  })
  app.get('/teaching/teacher/lesson/code/:id', wrap(async (req, res) => {
    if (!teacher(req, res)) return
    const state = room.load(); const p = state.students[req.params.id]
    if (!p) return res.sendStatus(404)
    const progress = await classroomLifecycle(readLevel, state.id).readProgress(req.params.id)
    res.json({ title: tasks[p.task].title, code: progress[tasks[p.task].slug]?.code?.['hero-placeholder']?.plan || '' })
  }))
  app.get('/teaching/room', (req, res) => {
    const s = accounts.currentStudent(req); if (!s) return res.redirect('/teaching')
    room.join(s.studentId)
    res.set(headers).type('html').send(pages.student(accounts.formToken(req, res), s.studentId))
  })
  app.get('/teaching/room/state', (req, res) => {
    const s = student(req, res); if (!s) return
    room.join(s.studentId)
    res.json({ ...room.studentView(s.studentId), formToken: accounts.formToken(req, res) })
  })
  for (const route of ['move', 'ack', 'error', 'review']) {
    app.post('/teaching/room/' + route, json, (req, res, next) => {
      try {
        const s = student(req, res); if (!s) return
        if (!accounts.validForm(req)) return res.sendStatus(403)
        if (route === 'review') return res.json({ url: room.review(s.studentId, req.body.task) })
        if (route === 'move') return res.json({ url: room.move(s.studentId, req.body.roomId, req.body.action, req.body.assignmentId) })
        if (route === 'ack') room.acknowledge(s.studentId, req.body.roomId, req.body.hintId, req.body.kind)
        if (route === 'error') room.reportError(s.studentId, req.body.roomId, req.body.message)
        res.json({ ok: true })
      } catch (e) { next(e) }
    })
  }
  // A typed old URL is subject to the same classroom assignment as the portal.
  app.get(/^\/play\/level\/local-python-\d{2}$/, (req, res, next) => {
    const state = room.load(); if (state.status !== 'live') return next()
    const s = accounts.currentStudent(req); if (!s) return res.redirect('/teaching')
    room.join(s.studentId)
    const access = room.access(s.studentId, req.path.split('/').pop())
    if (!access?.allowed) return res.redirect('/teaching/room')
    next()
  })
  return {
    lifecycle (studentId, sessionId, slug) {
      const state = room.load()
      if (sessionId && Object.values(accounts.readProgress(studentId)).some(s => s._id === sessionId)) return freeLifecycle
      if (state.status === 'live') return classroomLifecycle(readLevel, state.id)
      if (room.reviewAllowed(studentId, slug)) return classroomLifecycle(readLevel, state.id, true)
      if (state.id && sessionId && Object.values(room.store(state.id, true).readProgress(studentId)).some(s => s._id === sessionId)) return classroomLifecycle(readLevel, state.id, true)
      // Keep draft saves from an ended lesson isolated from free practice.
      if (state.id && sessionId) {
        const saved = room.store(state.id).readProgress(studentId)
        if (Object.values(saved).some(s => s._id === sessionId)) return classroomLifecycle(readLevel, state.id)
      }
      return freeLifecycle
    },
    guard (req, res, slug) {
      const s = accounts.currentStudent(req); const state = room.load()
      if (s && room.reviewAllowed(s.studentId, slug)) return true
      if (state.status !== 'live') return null
      if (!s) { res.status(401).json({ message: '请先登录。' }); return false }
      room.join(s.studentId)
      if (room.access(s.studentId, slug)?.allowed) return true
      res.status(403).json({ message: '上课期间请从本节课进入当前任务。', mapUrl: '/teaching/room' }); return false
    },
    async continuation (req, res, commit) {
      const state = room.load()
      const s = accounts.currentStudent(req)
      const review = s && room.reviewAllowed(s.studentId, req.params.slug)
      if (state.status !== 'live' && !review) return false
      if (!s) { student(req, res); return true }
      if (commit && !accounts.validForm(req)) { res.sendStatus(403); return true }
      const lifecycle = classroomLifecycle(readLevel, state.id, review)
      const sessionId = commit ? req.body.sessionId : req.query.sessionId
      const session = await lifecycle.readSession(s.studentId, sessionId)
      if (session.level.original !== readLevel(req.params.slug)?.original) throw new ProgressError(409, { message: '关卡已经改变，请回到本节课。' })
      const view = room.studentView(s.studentId)
      if (state.paused && !review) { res.status(commit ? 409 : 200).json({ kind: 'waiting', label: '老师正在讲解', message: '现场和代码已保留，恢复练习后再继续。' }); return true }
      if (!session.state?.complete) { res.status(commit ? 409 : 200).json({ kind: 'retry', label: '返回修改', message: session.learningFeedback || '请先完成本场景并保存。' }); return true }
      if (!session.teachingComplete) {
        const next = await lifecycle.previewContinuation(s.studentId, req.params.slug, sessionId)
        if (commit) res.json(await lifecycle.continue(s.studentId, req.params.slug, sessionId))
        else res.json({ ...next, formToken: accounts.formToken(req, res) })
      } else if (commit) res.json({ url: '/teaching/room?completed=' + encodeURIComponent(req.params.slug) })
      else res.json({ kind: 'classroom', label: review ? '回小屋查看复习记录' : '回小屋领取下一项任务', message: view.next ? '当前任务已完成。回到本节课查看下一项安排。' : '本组任务已完成，可以复跑或等待老师安排。', formToken: accounts.formToken(req, res) })
      return true
    },
  }
}
module.exports = { install, auth, room, headers }
