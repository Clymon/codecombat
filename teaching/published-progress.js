// Small semantic companion to immutable native files in one published generation.
const fs = require('fs')
const path = require('path')
const revisions = require('./progress-revisions')
function createProgressReader (directory) {
  const file = path.join(directory, 'progress.json')
  let stamp
  let generation
  return slug => {
    let stat
    try { stat = fs.statSync(file, { bigint: true }) } catch (error) {
      if (error.code !== 'ENOENT') throw error
      stamp = undefined; generation = undefined
      return null // Pre-descriptor publications use live native scene inspection.
    }
    // Directory publication replaces the inode. Nanosecond times also detect
    // in-place descriptor writes; never key this by displayed map revision.
    const current = [stat.dev, stat.ino, stat.size, stat.mtimeNs, stat.ctimeNs].join(':')
    if (current !== stamp) {
      const next = JSON.parse(fs.readFileSync(file, 'utf8'))
      if (next.format !== 1 || !next.levels) throw new Error('Invalid published progress generation; rebuild levels before restarting')
      generation = next.levels
      stamp = current
    }
    const level = generation[slug]
    return level && { ...level, identity: { ...level.identity, rules: revisions.rules } }
  }
}
module.exports = { createProgressReader }
