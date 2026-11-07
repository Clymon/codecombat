// Migrated definitions are complete authoring data, never patches to old maps.
// The legacy path remains only until all levels have moved to level-definitions.
const fs = require('fs')
const path = require('path')
const definitionsDir = path.join(__dirname, 'level-definitions')
const migrated = fs.readdirSync(definitionsDir).filter(name => /^\d+\.json$/.test(name)).map(name => JSON.parse(fs.readFileSync(path.join(definitionsDir, name), 'utf8')))
const byIndex = new Map()
for (const design of migrated) {
  if (byIndex.has(design.index)) throw new Error(`Duplicate level definition: ${design.index}`)
  byIndex.set(design.index, design)
}
const legacy = require('./legacy-map-designs')
module.exports = legacy.map(design => structuredClone(byIndex.get(design.index) || design))
for (const design of migrated) {
  if (!legacy.some(old => old.index === design.index)) module.exports.push(structuredClone(design))
}
