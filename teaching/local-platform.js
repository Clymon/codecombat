// Compatibility contract for the existing game client; identity stays local.
const crypto = require('node:crypto')
const express = require('express')
const accounts = require('./student-accounts')
const { enabled } = require('./offline-resources')
function userFor (req) {
  const student = accounts.currentStudent(req)
  if (!student) return null
  return {
    _id: crypto.createHash('sha256').update('classroom:' + student.studentId).digest('hex').slice(0, 24),
    anonymous: true,
    name: '课堂学生',
    preferredLanguage: 'zh-HANS',
    permissions: [],
    testGroupNumber: 0,
    country: 'china',
    geo: { country: 'CN', timeZone: 'Asia/Shanghai' },
    earned: { gems: 0, points: 0, items: [], heroes: [] },
    purchased: { gems: 0, items: [], heroes: [] },
    stats: {},
    products: [],
    experiments: {},
    volume: student.clientPreferences?.volume ?? 1,
  }
}
module.exports = function setup (app) {
  app.get('/favicon.ico', (req, res, next) => enabled() ? res.redirect('/images/favicon/favicon-coco/favicon.ico') : next())
  const guard = (req, res, next) => {
    if (!enabled()) return next('route')
    res.set('Cache-Control', 'no-store')
    const user = userFor(req)
    if (!user) return res.status(401).json({ message: '请先使用学号登录。' })
    req.classroomUser = user
    next()
  }
  app.get('/user-data', guard, (req, res) => {
    const config = { production: false, simulationThroughputRatio: 1, sessionSaveDelay: { registered: { min: 1, max: 3 }, anonymous: { min: 1, max: 3 } }, experimentProbabilities: {} }
    const json = value => JSON.stringify(value).replace(/</g, '\\u003c')
    res.type('application/javascript').send(`window.serverConfig=${json(config)};window.userObject=${json(req.classroomUser)};window.serverSession={};window.features={};window.me={get:function(k){return window.userObject[k];}};`)
  })
  app.get('/auth/whoami', guard, (req, res) => res.json(req.classroomUser))
  app.all('/db/user/:id', guard, express.json({ limit: '16kb' }), (req, res) => {
    if (req.params.id !== req.classroomUser._id) return res.sendStatus(403)
    // No privileges or official account state can be written through this adapter.
    if (!['GET', 'PUT', 'PATCH'].includes(req.method)) return res.sendStatus(405)
    if (req.method !== 'GET') {
      const origin = req.get('origin')
      if (origin && origin !== `${req.protocol}://${req.get('host')}`) return res.sendStatus(403)
      accounts.saveClientPreferences(accounts.currentStudent(req).studentId, req.body)
    }
    res.json(userFor(req))
  })
  app.get('/db/user/:id/achievements', guard, (req, res) => req.params.id === req.classroomUser._id ? res.json([]) : res.sendStatus(403))
  app.put('/db/user/:id/extra-provisions', guard, (req, res) => req.params.id === req.classroomUser._id ? res.json({ provisionType: 'local' }) : res.sendStatus(403))
  app.post('/db/user/:id/track/:activity/:count', guard, (req, res) => req.params.id === req.classroomUser._id ? res.json({}) : res.sendStatus(403))
  app.get('/db/user-credits/LEVEL_CHAT_BOT', guard, (req, res) => res.json({ creditsLeft: 0, duration: 'day', durationAmount: 1 }))
  app.get('/db/achievement', guard, (req, res) => res.json([]))
  app.get('/db/mandate', guard, (req, res) => res.json([]))
  app.get('/db/concept', guard, (req, res) => res.json([]))
}
module.exports.userFor = userFor
