// Complete authoring definitions are the only registry; filenames are identities.
const fs = require('fs')
const path = require('path')
const definitionsDir = path.join(__dirname, 'level-definitions')
module.exports = fs.readdirSync(definitionsDir).filter(name => /^\d+\.json$/.test(name)).sort((a, b) => parseInt(a) - parseInt(b)).map(name => {
  const design = JSON.parse(fs.readFileSync(path.join(definitionsDir, name), 'utf8'))
  if (name !== `${design.index}.json`) throw new Error(`Level ${design.index}, scene base, field index: identity must match level-definitions/${name}`)
  return design
})
