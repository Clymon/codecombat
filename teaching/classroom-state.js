// Class-wide release switches for the local original levels.
const fs = require('fs')
const path = require('path')
const crypto = require('crypto')

const file = () => path.resolve(process.env.TEACHING_STATE_DIR || path.join(__dirname, 'state'), 'classroom.json')
const defaults = Object.fromEntries(require('./map-designs').map(d => [`local-python-${String(d.index).padStart(2, '0')}`, d.index === 4]))

function releases () {
  try {
    const saved = JSON.parse(fs.readFileSync(file(), 'utf8'))
    return Object.fromEntries(Object.keys(defaults).map(slug => [slug, saved.releases?.[slug] === true]))
  } catch (error) {
    if (error.code === 'ENOENT') return { ...defaults }
    throw error
  }
}
function isUnlocked (slug) { return releases()[slug] === true }
function setUnlocked (slug, unlocked) {
  if (!Object.hasOwn(defaults, slug) || typeof unlocked !== 'boolean') throw new TypeError('Unknown level or release state')
  const next = { ...releases(), [slug]: unlocked }
  const target = file()
  fs.mkdirSync(path.dirname(target), { recursive: true })
  const temp = `${target}.${process.pid}.${crypto.randomBytes(4).toString('hex')}.tmp`
  fs.writeFileSync(temp, JSON.stringify({ releases: next, updatedAt: new Date().toISOString() }), { mode: 0o600 })
  fs.renameSync(temp, target)
  return next
}
function isTeacherLocal (req) {
  const address = req.socket?.remoteAddress
  const host = req.get('host') || ''
  return ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(address) && /^127\.0\.0\.1(?::\d+)?$/.test(host)
}

module.exports = { releases, isUnlocked, setUnlocked, isTeacherLocal }
