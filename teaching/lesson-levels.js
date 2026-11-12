const { definitions } = require('./lesson-curriculum')
const { compileCatalog } = require('./level-catalog')
const { compileLevels } = require('./tools/build-levels')
const designs = definitions()
const native = compileLevels(designs)
module.exports = { catalog: compileCatalog(designs).map(e => e.catalog), read: (slug, scene = 0) => { const value = native.find(l => l.slug === slug && l.teachingMap.scenarioIndex === scene); return value ? structuredClone(value) : null } }
