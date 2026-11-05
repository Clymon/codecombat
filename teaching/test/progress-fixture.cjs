// Only for isolated integration tests whose subject begins midway through a course.
const accounts = require('../student-accounts')
const classroom = require('../classroom-state')
const crypto = require('node:crypto')
const { catalog, prerequisitesFor, visibleLevel } = require('../level-access')
module.exports = function completePrerequisites (studentId, slug) {
  if (!process.env.TEACHING_STATE_DIR) throw new Error('Fixture requires an isolated state directory')
  const deps = prerequisitesFor(catalog.filter(l => visibleLevel(l, classroom.visibility())))
  const progress = accounts.readProgress(studentId)
  function complete (current) {
    for (const predecessor of deps[current] || []) {
      complete(predecessor)
      progress[predecessor] = { _id: `facebe${crypto.randomBytes(9).toString('hex')}`, code: {}, teachingScene: 0, state: { complete: true }, mapRevision: catalog.find(l => l.slug === predecessor).teachingMap.revision, ...progress[predecessor], teachingComplete: true }
    }
  }
  complete(slug)
  accounts.saveProgress(studentId, progress)
}
