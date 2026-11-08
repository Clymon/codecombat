// Real HTTP process used only with an explicitly temporary state directory.
const assert = require('node:assert/strict')
const os = require('node:os')
const path = require('node:path')
assert.ok(path.resolve(process.env.TEACHING_STATE_DIR).startsWith(path.resolve(os.tmpdir()) + path.sep))
const app = require('express')()
require('../local-levels')(app)
const server = app.listen(0, '127.0.0.1', () => process.send(server.address().port))
process.on('message', message => { if (message === 'stop') server.close(() => process.exit(0)) })
