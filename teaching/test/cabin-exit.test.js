const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs'); const vm = require('node:vm'); const path = require('node:path')
function exitHarness (fetcher) {
  const data = new Map(); const storage = { getItem: k => data.get(k) || null, setItem: (k, v) => data.set(k, v), removeItem: k => data.delete(k) }
  let destination; const button = {}; const editor = { getValue: () => 'label = readTag("货箱封签")\n# 最新草稿' }
  const window = { localStorage: storage, sessionStorage: storage, location: { assign: url => { destination = url } } }
  const document = { querySelector: () => ({ env: { editor } }) }
  const sandbox = { module: { exports: {} }, require: n => require(path.resolve(__dirname, '..', n)), fetch: fetcher, window, document, setTimeout, clearTimeout, AbortController, URLSearchParams, console }
  vm.runInNewContext(fs.readFileSync(require.resolve('../lesson-game'), 'utf8'), sandbox)
  const game = Object.create(sandbox.module.exports.prototype)
  Object.assign(game, { slug: 'local-python-34', state: { studentId: '99990001', id: 'a'.repeat(24) }, sessionId: 'missing', shell: { querySelector: () => button }, call: { querySelector: () => button }, status () {} })
  return { game, window, data, destination: () => destination, editor }
}
test('expired native session does not trap the student outside the cabin', async () => {
  const h = exitHarness(async () => ({ ok: false, status: 404 }))
  await h.game.leave()
  assert.match(h.destination() || '', /^\/teaching\/room/, 'return must not depend on saving a dead session')
  assert.ok([...h.data.values()].some(s => s.includes('最新草稿')), 'keep a recoverable local draft')
})
test('network failure still returns to cabin', async () => {
  const h = exitHarness(async () => { throw new TypeError('Failed to fetch') })
  await h.game.leave()
  assert.match(h.destination() || '', /^\/teaching\/room/)
})
test('unresponsive saves time out and local storage denial still cannot block return', async () => {
  const h = exitHarness(() => new Promise(() => {}))
  const start = Date.now(); await h.game.leave()
  assert.ok(Date.now() - start < 3000)
  assert.equal(h.destination(), '/teaching/room?return=local-draft')
  const denied = exitHarness(async () => ({ ok: false }))
  for (const name of ['localStorage', 'sessionStorage']) denied.window[name] = { getItem () { throw Error('denied') }, setItem () { throw Error('denied') } }
  await denied.game.leave(); assert.equal(denied.destination(), '/teaching/room?return=unsaved')
})
test('local drafts stay per student and successful save clears only its own backup', async () => {
  const drafts = require('../lesson-drafts'); const h = exitHarness(async () => ({ ok: true }))
  drafts.save(h.window, '99990002', 'local-python-34', 'another student')
  await h.game.leave(); assert.equal(h.destination(), '/teaching/room?return=saved')
  assert.equal(drafts.read(h.window, '99990001', 'local-python-34'), undefined)
  assert.equal(drafts.read(h.window, '99990002', 'local-python-34').code, 'another student')
})
