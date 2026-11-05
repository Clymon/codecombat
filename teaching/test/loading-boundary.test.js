const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const pug = require('pug')
const coffee = require('coffee-script')
const root = path.resolve(__dirname, '../..')

test('classroom entry omits analytics and establishes mode before async app startup', () => {
  const render = teachingMode => pug.renderFile(path.join(root, 'app/templates/static/teaching.static.pug'), {
    teachingMode,
    shaTag: 'test',
    chunkPaths: {},
    viewName: 'main',
    me: { getProduct: () => 'codecombat', useGoogleAnalytics: () => true },
  })
  const classroom = render(true)
  assert.doesNotMatch(classroom, /googletagmanager|google-analytics|connect.facebook|hm.baidu|datadoghq/)
  assert.ok(classroom.indexOf('window.localTeaching = true') < classroom.indexOf('/javascripts/app.js'))
  const ordinary = render(false)
  assert.match(ordinary, /googletagmanager/)
  assert.match(ordinary, /connect.facebook/)
  assert.doesNotMatch(ordinary, /window.localTeaching/)
})

function spellModule (loader) {
  const sandbox = {
    module: { exports: {} },
    console: { error () {} },
    require (name) {
      if (/^(blockly|core\/blocklyUtils|lib\/code-to-blocks)$/.test(name)) throw Error('Eager Blockly dependency: ' + name)
      if (name === 'lib/loadBlockly') return loader
      if (name === 'lib/aceContainer') return { require: () => ({}) }
      if (name === 'core/auth') return { me: {} }
      return function () {}
    },
  }
  vm.runInNewContext(coffee.compile(fs.readFileSync(path.join(root, 'app/views/play/level/tome/SpellView.coffee'), 'utf8')), sandbox)
  return sandbox.module.exports.prototype
}
const bundle = { Blockly: {}, blocklyUtils: {}, codeToBlocks () {}, prepareBlockIntelligence () {} }
const flush = () => new Promise(resolve => setImmediate(resolve))

test('text editor import defers Blockly; requesting blocks waits for the bundle and palette', async () => {
  let calls = 0; let finish
  const prototype = spellModule(() => { calls++; return new Promise(resolve => { finish = resolve }) })
  assert.equal(calls, 0)
  const view = Object.create(prototype)
  view.addBlockly(); view.addBlockly()
  assert.equal(calls, 1, 'concurrent palette/editor setup must not create duplicate workspaces')
  assert.equal(view.awaitingBlockly, undefined)
  finish(bundle); await flush()
  assert.equal(view.loadingBlockly, false)
  assert.equal(view.awaitingBlockly, true, 'bundle is ready, but command palette must arrive before inject')
})

test('switching back to text while Blockly loads cancels deferred workspace creation', async () => {
  let finish
  const view = Object.create(spellModule(() => new Promise(resolve => { finish = resolve })))
  view.addBlockly()
  view.onToggleBlocks({ blocks: false })
  finish(bundle); await flush()
  assert.equal(view.loadingBlockly, false)
  assert.equal(view.awaitingBlockly, false)
  assert.equal(view.blocklyActive, undefined)
})

test('Blockly network failure leaves text editor alive and can be retried', async () => {
  let calls = 0; let message
  const view = Object.create(spellModule(() => { calls++; return Promise.reject(Error('offline')) }))
  view.$ = () => ({ text: value => { message = value } })
  view.addBlockly(); await flush()
  assert.equal(view.loadingBlockly, false)
  assert.match(message, /加载失败/)
  view.addBlockly(); await flush()
  assert.equal(calls, 2)
})
