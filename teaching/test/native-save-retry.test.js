const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const coffee = require('coffee-script')
const Backbone = require('backbone')
const { JSDOM } = require('jsdom')
const root = path.resolve(__dirname, '../..')

function classroom () {
  const dom = new JSDOM('<body><textarea id="editor"></textarea></body>')
  const requests = []
  const Model = Backbone.Model.extend({ idAttribute: '_id', sync (method, model, options) { requests.push({ model, options, patch: JSON.parse(JSON.stringify(options.attrs)) }) } })
  const session = new Model({ _id: 'facebe123456789012345678', creator: 'student', code: {}, codeLanguage: 'text' })
  const sandbox = {
    module: { exports: {} },
    window: dom.window,
    document: dom.window.document,
    application: { isProduction: false },
    _: require('lodash'),
    console,
    Backbone: { Mediator: { publish () {} } },
    require (name) {
      if (name === './Bus') return function Bus () {}
      if (name === 'models/LevelSession') return Model
      if (name === 'core/auth') return { me: { id: 'student' } }
      if (name === 'core/store') return { watch: () => () => {} }
      if (name === 'lodash-4/debounce') return require('lodash-4/debounce')
      if (name === './TeachingSaveStatus') return require('../../app/lib/TeachingSaveStatus')
      return {}
    },
  }
  vm.runInNewContext(coffee.compile(fs.readFileSync(path.join(root, 'app/lib/LevelBus.coffee'), 'utf8')), sandbox)
  const LevelBus = sandbox.module.exports
  const bus = new LevelBus()
  bus.session = session
  function edit (source) {
    dom.window.document.querySelector('#editor').value = source
    bus.onSpellChanged({ spell: { level: { isType: () => false, get: () => 'local-python-04' }, spellKey: 'hero-placeholder/plan', getSource: () => source } })
    bus.saveSession.flush()
  }
  return { dom, requests, session, bus, edit, close () { bus.saveSession.cancel(); dom.window.close() } }
}

test('native autosave failure keeps editor code and offers retry with newer edits; only success clears warning', () => {
  const ui = classroom()
  try {
    ui.edit('hero.moveRight()')
    assert.equal(ui.requests.length, 1)
    ui.requests[0].options.error({ status: 503 })
    assert.match(ui.dom.window.document.body.textContent, /保存失败/)
    assert.equal(ui.dom.window.document.querySelector('#editor').value, 'hero.moveRight()')
    // Edit while the outage is visible. The next failed attempt must not discard either edit.
    ui.edit('hero.moveRight()\n# latest edit')
    ui.requests[1].options.error({ status: 503 })
    ui.dom.window.document.querySelector('[data-teaching-save-retry]').click()
    assert.equal(ui.requests[2].patch.code['hero-placeholder'].plan, 'hero.moveRight()\n# latest edit')
    assert.match(ui.dom.window.document.body.textContent, /保存/)
    ui.requests[2].options.success({})
    assert.equal(ui.dom.window.document.querySelector('[data-teaching-save-notice]'), null)
    assert.equal(ui.dom.window.document.querySelector('#editor').value, 'hero.moveRight()\n# latest edit')
  } finally { ui.close() }
})

test('native victory submission reports network failure in Chinese and retries without navigation or losing code', async () => {
  const dom = new JSDOM('<body><p class="local-save-notice"></p><button id="continue-button"></button></body>')
  const requests = []
  let offline = true
  const sandbox = {
    module: { exports: {} },
    require: () => class {},
    fetch: async (url, options) => {
      requests.push({ url, options })
      if (offline) throw Error('Failed to fetch')
      return { ok: true, json: async () => url.startsWith('/teaching/') ? { kind: 'waiting', label: '等待教师开放', message: '本关已完成' } : {} }
    },
  }
  vm.runInNewContext(fs.readFileSync(path.join(root, 'app/views/play/level/modal/HeroVictoryModal.js'), 'utf8'), sandbox)
  const view = Object.create(sandbox.module.exports.prototype)
  const source = 'hero.moveRight()\n# keep this editor source'
  view.session = new Backbone.Model({ code: { 'hero-placeholder': { plan: source } }, state: { complete: true, teachingVictoryCode: source } })
  view.session.id = 'facebe123456789012345678'
  view.level = new Backbone.Model({ slug: 'local-python-04' })
  view.$ = require('jquery')(dom.window)
  try {
    await view.prepareTeachingContinuation()
    assert.match(dom.window.document.querySelector('.local-save-notice').textContent, /保存失败/)
    assert.equal(dom.window.document.querySelector('#continue-button').textContent, '重试保存')
    assert.equal(view.teachingNext, null)
    assert.equal(view.session.get('code')['hero-placeholder'].plan, source)
    offline = false
    await view.onClickContinue()
    assert.equal(JSON.parse(requests[1].options.body).code['hero-placeholder'].plan, source)
    assert.equal(view.teachingNext.kind, 'waiting')
    assert.equal(dom.window.document.querySelector('.local-save-notice').textContent, '本关已完成')
  } finally { dom.window.close() }
})

test('edits made while autosave is pending wait and persist after the first acknowledgement', () => {
  const ui = classroom()
  try {
    ui.edit('hero.moveRight()')
    ui.edit('hero.moveRight()\n# typed while request pending')
    assert.equal(ui.requests.length, 1, 'one pending native request at a time')
    ui.requests[0].options.success({ code: { 'hero-placeholder': { plan: 'hero.moveRight()' } } })
    ui.bus.saveSession.flush()
    assert.equal(ui.requests.length, 2)
    assert.equal(ui.requests[1].patch.code['hero-placeholder'].plan, 'hero.moveRight()\n# typed while request pending')
    assert.equal(ui.session.get('code')['hero-placeholder'].plan, 'hero.moveRight()\n# typed while request pending')
    ui.requests[1].options.success({})
  } finally { ui.close() }
})
