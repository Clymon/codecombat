// Persist class-wide visibility and release switches without touching learning records.
const fs = require('fs')
const path = require('path')
const crypto = require('crypto')
const { catalog } = require('./level-access')
const { defaultVisible } = require('./curriculum')
const file = () => path.resolve(process.env.TEACHING_STATE_DIR || path.join(__dirname, 'state'), 'classroom.json')
const defaults = Object.fromEntries(catalog.map(level => [level.slug, level.teachingMap.index === 4]))
const visibleDefaults = Object.fromEntries(catalog.map(level => [level.slug, defaultVisible(level.teachingMap)]))

function read () {
  let saved
  try { saved = JSON.parse(fs.readFileSync(file(), 'utf8')) } catch (error) {
    if (error.code !== 'ENOENT') throw error
  }
  const visibility = Object.fromEntries(Object.keys(defaults).map(slug => [slug, typeof saved?.visibility?.[slug] === 'boolean' ? saved.visibility[slug] : visibleDefaults[slug]]))
  const releases = Object.fromEntries(Object.keys(defaults).map(slug => [slug, visibility[slug] && (saved ? saved.releases?.[slug] === true : defaults[slug])]))
  return { ...saved, visibility, releases }
}
function save (state) {
  const target = file()
  fs.mkdirSync(path.dirname(target), { recursive: true })
  const temp = `${target}.${process.pid}.${crypto.randomBytes(4).toString('hex')}.tmp`
  fs.writeFileSync(temp, JSON.stringify({ ...state, updatedAt: new Date().toISOString() }), { mode: 0o600 })
  fs.renameSync(temp, target)
}
function validate (slug, value) {
  if (!Object.hasOwn(defaults, slug) || typeof value !== 'boolean') throw new TypeError('Unknown level or publication state')
}
function releases () { return read().releases }
function visibility () { return read().visibility }
function isUnlocked (slug) { return releases()[slug] === true }
function isVisible (slug) { return visibility()[slug] === true }
function setUnlocked (slug, unlocked) {
  validate(slug, unlocked)
  const state = read()
  if (unlocked) state.visibility[slug] = true
  state.releases[slug] = unlocked
  save(state)
  return state.releases
}
function setVisible (slug, visible) {
  validate(slug, visible)
  const state = read()
  // Showing a hidden task reveals a locked card; entering it needs an explicit release.
  if (!visible || !state.visibility[slug]) state.releases[slug] = false
  state.visibility[slug] = visible
  save(state)
  return state.visibility
}
function updateMany (slugs, operation) {
  if (!Array.isArray(slugs) || !slugs.length || slugs.length > Object.keys(defaults).length || !['hide', 'show', 'open', 'close'].includes(operation)) throw new TypeError('Invalid bulk operation')
  for (const slug of slugs) validate(slug, true)
  const state = read()
  for (const slug of new Set(slugs)) {
    if (operation === 'hide') { state.visibility[slug] = false; state.releases[slug] = false }
    if (operation === 'show') { if (!state.visibility[slug]) state.releases[slug] = false; state.visibility[slug] = true }
    if (operation === 'open') { state.visibility[slug] = true; state.releases[slug] = true }
    if (operation === 'close') state.releases[slug] = false
  }
  save(state)
  return state
}
function isTeacherLocal (req) {
  const address = req.socket?.remoteAddress
  const host = req.get('host') || ''
  return ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(address) && /^127\.0\.0\.1(?::\d+)?$/.test(host)
}
module.exports = { releases, visibility, isUnlocked, isVisible, setUnlocked, setVisible, updateMany, isTeacherLocal }
