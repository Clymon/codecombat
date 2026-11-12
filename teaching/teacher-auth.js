// Teacher identity is independent of student numbers and network location.
const crypto = require('node:crypto')
const fs = require('node:fs')
const path = require('node:path')
const { promisify } = require('node:util')
const scrypt = promisify(crypto.scrypt)
const accounts = require('./student-accounts')
const root = () => path.resolve(process.env.TEACHING_STATE_DIR || path.join(__dirname, 'state'))
const COOKIE = 'localTeacherSession'
const read = file => { try { return JSON.parse(fs.readFileSync(file, 'utf8')) } catch (e) { if (e.code === 'ENOENT') return null; throw e } }
const config = () => read(path.join(root(), 'teacher-auth.json'))
const digest = value => crypto.createHash('sha256').update(value).digest('hex')
function token (req) {
  const value = (req.headers.cookie || '').split(';').map(x => x.trim()).find(x => x.startsWith(COOKIE + '='))?.slice(COOKIE.length + 1)
  return /^[a-f0-9]{64}$/.test(value || '') ? value : null
}
function current (req) {
  const value = token(req); if (!value) return null
  const session = read(path.join(root(), 'teacher-sessions', digest(value) + '.json'))
  const settings = config()
  return session && session.expiresAt > Date.now() && settings?.generation === session.generation ? { id: digest(value), user: session.user } : null
}
const attempts = new Map()
async function login (req, res, user, password) {
  const settings = config(); if (!settings) return false
  const address = req.socket?.remoteAddress || 'unknown'; const now = Date.now()
  const prior = attempts.get(address)
  const count = prior?.until > now ? prior.count : 0
  if (count >= 10) return false
  if (attempts.size > 2000) for (const [key, entry] of attempts) if (entry.until < now) attempts.delete(key)
  attempts.set(address, { count: count + 1, until: now + 60000 })
  if (typeof password !== 'string' || password.length > 200 || typeof user !== 'string') return false
  const actual = await scrypt(password, settings.salt, 64)
  const expected = Buffer.from(settings.hash, 'hex')
  if (actual.length !== expected.length || !crypto.timingSafeEqual(actual, expected) || user !== settings.user) return false
  attempts.delete(address)
  const value = crypto.randomBytes(32).toString('hex')
  const dir = path.join(root(), 'teacher-sessions'); fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(path.join(dir, digest(value) + '.json'), JSON.stringify({ user, generation: settings.generation, expiresAt: now + 12 * 3600000 }), { mode: 0o600, flag: 'wx' })
  res.cookie(COOKIE, value, { httpOnly: true, sameSite: 'strict', secure: req.secure, path: '/teaching', maxAge: 12 * 3600000 })
  return true
}
function logout (req, res) {
  const value = token(req)
  if (value) fs.rmSync(path.join(root(), 'teacher-sessions', digest(value) + '.json'), { force: true })
  res.clearCookie(COOKIE, { path: '/teaching', httpOnly: true, sameSite: 'strict', secure: req.secure })
}
async function configure (user, password) {
  if (!/^[a-zA-Z0-9_-]{3,40}$/.test(user) || typeof password !== 'string' || password.length < 10 || password.length > 200) throw new Error('教师账号需3—40位字母、数字、下划线或短横线；密码需10—200位。')
  const salt = crypto.randomBytes(32).toString('hex'); const hash = (await scrypt(password, salt, 64)).toString('hex')
  fs.mkdirSync(root(), { recursive: true })
  const file = path.join(root(), 'teacher-auth.json'); const tmp = file + '.' + crypto.randomBytes(8).toString('hex') + '.tmp'
  fs.writeFileSync(tmp, JSON.stringify({ user, salt, hash, generation: crypto.randomBytes(16).toString('hex') }), { mode: 0o600 }); fs.renameSync(tmp, file)
}
module.exports = { config, current, login, logout, configure, validForm: accounts.validForm }
