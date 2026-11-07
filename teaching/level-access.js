const { compareLevels, defaultVisible } = require('./curriculum')
const catalog = require('./level-catalog').compileCatalog().map(entry => entry.catalog)
const visibleLevel = (level, visibility) => visibility[level.slug] ?? defaultVisible(level.teachingMap)

// The main route never requires an optional challenge. Side paths start at the
// preceding lesson in their own section; teacher trials are independent entries.
function prerequisitesFor (levels) {
  const result = {}; let main
  const previousInSection = new Map()
  for (const level of [...levels].sort(compareLevels)) {
    const d = level.teachingMap
    if (d.prototype) { result[level.slug] = []; continue }
    const previous = d.optional ? previousInSection.get(d.section) : main
    result[level.slug] = previous ? [previous.slug] : []
    previousInSection.set(d.section, level)
    if (!d.optional) main = level
  }
  return result
}
function completed (level, session) {
  if (typeof session?.teachingComplete === 'boolean') return session.teachingComplete
  const titles = level.teachingMap.scenarioTitles || []
  if (titles.length > 1) return titles.every((_, i) => !!session?.scenePasses?.[i])
  return session?.state?.complete === true
}
function accessFor (levels, { progress = {}, releases = {}, visibility = {} } = {}) {
  const visible = levels.filter(l => visibleLevel(l, visibility))
  const prerequisites = prerequisitesFor(visible)
  const bySlug = new Map(levels.map(l => [l.slug, l]))
  return Object.fromEntries(levels.map(level => {
    const required = prerequisites[level.slug] || []
    const missing = required.filter(slug => !completed(bySlug.get(slug), progress[slug]))
    const reason = !visibleLevel(level, visibility) ? 'hidden' : releases[level.slug] !== true ? 'unreleased' : missing.length ? 'prerequisite' : 'open'
    const message = reason === 'hidden' ? '此关尚未显示，请返回地图。' : reason === 'unreleased' ? '此关尚未开放，请等待老师发布。' : reason === 'prerequisite' ? `先完成「${missing.map(slug => bySlug.get(slug).name).join('」「')}」的全部场景，才能进入本关。` : ''
    return [level.slug, { open: reason === 'open', reason, message, prerequisites: required, missing }]
  }))
}
module.exports = { prerequisitesFor, accessFor, completed, visibleLevel, catalog }
