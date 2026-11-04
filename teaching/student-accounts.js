// Local classroom accounts. A student number selects an account; it is not proof of identity.
const fs = require('fs')
const path = require('path')
const crypto = require('crypto')

const CLASS_NAME = '25软件1班'
const COOKIE_NAME = 'localStudentSession'
const SESSION_MS = 12 * 60 * 60 * 1000
const studentIdPattern = /^\d{4,20}$/
const tokenPattern = /^[0-9a-f]{64}$/
const root = () => path.resolve(process.env.TEACHING_STATE_DIR || path.join(__dirname, 'state'))
const accountFile = studentId => path.join(root(), 'students', `${studentId}.json`)
const progressFile = studentId => path.join(root(), 'progress', `${studentId}.json`)
const sessionFile = token => path.join(root(), 'student-sessions', `${crypto.createHash('sha256').update(token).digest('hex')}.json`)

function readJson (file) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')) } catch (error) {
    if (error.code === 'ENOENT') return null
    throw error
  }
}
function writeJson (file, value, exclusive = false) {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  if (exclusive) return fs.writeFileSync(file, JSON.stringify(value), { flag: 'wx', mode: 0o600 })
  const temp = `${file}.${process.pid}.${crypto.randomBytes(4).toString('hex')}.tmp`
  fs.writeFileSync(temp, JSON.stringify(value), { mode: 0o600 })
  fs.renameSync(temp, file)
}
function normalStudentId (value) {
  if (typeof value !== 'string') return null
  const id = value.trim()
  return studentIdPattern.test(id) ? id : null
}
function account (studentId) {
  if (!studentIdPattern.test(studentId || '')) return null
  const value = readJson(accountFile(studentId))
  return value?.studentId === studentId && value?.className === CLASS_NAME ? value : null
}
function ensureStudent (studentId) {
  if (normalStudentId(studentId) !== studentId) throw new TypeError('Invalid student number')
  const existing = account(studentId)
  if (existing) return existing
  const value = { studentId, className: CLASS_NAME, createdAt: new Date().toISOString() }
  try {
    writeJson(accountFile(studentId), value, true)
  } catch (error) {
    // A simultaneous first login may have created the same record; never overwrite it.
    if (error.code === 'EEXIST' && account(studentId)) return account(studentId)
    throw error
  }
  return value
}
function cookieToken (req) {
  const value = (req.headers.cookie || '').split(';').map(part => part.trim()).find(part => part.startsWith(`${COOKIE_NAME}=`))?.slice(COOKIE_NAME.length + 1)
  return tokenPattern.test(value || '') ? value : null
}
function currentStudent (req) {
  const token = cookieToken(req)
  if (!token) return null
  const file = sessionFile(token)
  const session = readJson(file)
  if (!session || !studentIdPattern.test(session.studentId || '')) return null
  if (session.expiresAt <= Date.now()) {
    fs.rmSync(file, { force: true })
    return null
  }
  return account(session.studentId)
}
function startSession (req, res, studentId) {
  const token = crypto.randomBytes(32).toString('hex')
  writeJson(sessionFile(token), { studentId, expiresAt: Date.now() + SESSION_MS }, true)
  res.cookie(COOKIE_NAME, token, { httpOnly: true, sameSite: 'lax', secure: req.secure, path: '/', maxAge: SESSION_MS })
}
function endSession (req, res) {
  const token = cookieToken(req)
  if (token) fs.rmSync(sessionFile(token), { force: true })
  res.clearCookie(COOKIE_NAME, { httpOnly: true, sameSite: 'lax', secure: req.secure, path: '/' })
}
function readProgress (studentId) { return readJson(progressFile(studentId)) || {} }
function saveProgress (studentId, value) { writeJson(progressFile(studentId), value) }
function registeredStudents () {
  const dir = path.join(root(), 'students')
  if (!fs.existsSync(dir)) return []
  return fs.readdirSync(dir).filter(name => /^\d{4,20}\.json$/.test(name)).map(name => account(name.slice(0, -5))).filter(Boolean).sort((a, b) => a.studentId.localeCompare(b.studentId))
}
const FORM_COOKIE_NAME = 'localTeachingForm'
function formToken (req, res) {
  const existing = (req.headers.cookie || '').split(';').map(part => part.trim()).find(part => part.startsWith(`${FORM_COOKIE_NAME}=`))?.slice(FORM_COOKIE_NAME.length + 1)
  if (tokenPattern.test(existing || '')) return existing
  const token = crypto.randomBytes(32).toString('hex')
  res.cookie(FORM_COOKIE_NAME, token, { httpOnly: true, sameSite: 'lax', secure: req.secure, path: '/teaching' })
  return token
}
function validForm (req) {
  const origin = req.get('origin')
  if (origin && origin !== 'null') {
    try { if (new URL(origin).host !== req.get('host')) return false } catch { return false }
  }
  const token = req.body?.formToken
  if (!tokenPattern.test(token || '')) return false
  const cookie = (req.headers.cookie || '').split(';').map(part => part.trim()).find(part => part.startsWith(`${FORM_COOKIE_NAME}=`))?.slice(FORM_COOKIE_NAME.length + 1)
  return tokenPattern.test(cookie || '') && crypto.timingSafeEqual(Buffer.from(token), Buffer.from(cookie))
}
function withoutLocalCookies (header = '') {
  return header.split(';').map(value => value.trim()).filter(value => !/^(localStudentSession|localTeaching|localTeachingForm)=/.test(value)).join('; ')
}

module.exports = { CLASS_NAME, COOKIE_NAME, normalStudentId, account, ensureStudent, currentStudent, startSession, endSession, readProgress, saveProgress, registeredStudents, formToken, validForm, withoutLocalCookies }
