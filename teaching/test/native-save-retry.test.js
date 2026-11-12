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
  const notifications = []
  const modelSandbox = {
    module: { exports: {} },
    Backbone,
    _: require('lodash'),
    tv4: require('tv4'),
    document: dom.window.document,
    application: { testing: true },
    console,
    $: require('jquery')(dom.window),
    noty: options => notifications.push(options.text),
    require: name => name === 'core/storage' ? { remove () {} } : {},
  }
  vm.runInNewContext(fs.readFileSync(path.join(root, 'app/models/CocoModel.js'), 'utf8'), modelSandbox)
  // Use the actual native model save/error wrapper, with transport replaced only
  // at Backbone's network boundary (no fake save callbacks hiding generic toasts).
  class Model extends modelSandbox.module.exports {
    static className = 'LevelSession'
    static schema = {}
    sync (method, model, options) { requests.push({ model, options, patch: JSON.parse(JSON.stringify(options.attrs || model.toJSON())) }) }
  }
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
  return { dom, requests, notifications, session, bus, edit, close () { bus.saveSession.cancel(); modelSandbox.module.exports.pollAchievements.cancel?.(); dom.window.close() } }
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
    require: name => name === 'lib/TeachingSaveStatus' ? require('../../app/lib/TeachingSaveStatus') : class {},
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
  const $ = require('jquery')(dom.window)
  view.$ = selector => $(dom.window.document.body).find(selector)
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

test('handled local save failures show only Chinese recovery; unrelated model errors retain their generic notice', () => {
  const ui = classroom()
  try {
    ui.edit('hero.moveRight()')
    ui.requests[0].options.error({ status: 503, statusText: 'Service Unavailable', responseText: '{"message":"failure"}' })
    assert.match(ui.dom.window.document.body.textContent, /保存失败/)
    assert.deepEqual(ui.notifications, [])
    ui.session.save({ playtime: 1 }) // Not the handled local autosave path.
    ui.requests[1].options.error({ status: 500, statusText: 'Internal Server Error' })
    assert.equal(ui.notifications.length, 1)
    assert.match(ui.notifications[0], /Error saving/)
  } finally { ui.close() }
})

for (const status of [401, 403, 404, 409]) {
  test(`native autosave ${status} retains current code and offers recovery instead of retrying a dead session`, () => {
    const ui = classroom()
    try {
      ui.edit('hero.moveRight()')
      ui.requests[0].options.error({ status, responseJSON: { message: '当前会话无法保存。' } })
      const warning = ui.dom.window.document.querySelector('[data-teaching-save-notice]')
      assert.match(warning.textContent, /复制代码/)
      assert.equal(ui.dom.window.getComputedStyle(ui.dom.window.document.querySelector('[data-teaching-save-retry]')).display, 'none')
      const link = ui.dom.window.document.querySelector('[data-teaching-save-recover]')
      assert.equal(link.getAttribute('href'), '/teaching')
      assert.equal(link.target, '_blank')
      ui.edit('hero.moveRight()\n# keep typing while recovering')
      assert.equal(ui.requests.length, 1)
      assert.match(ui.session.get('code')['hero-placeholder'].plan, /keep typing/)
      assert.deepEqual(ui.notifications, [])
    } finally { ui.close() }
  })
}

test('offline native autosave releases the pending request and retries the latest source without a generic toast', () => {
  const ui = classroom()
  try {
    ui.edit('hero.moveRight()')
    ui.requests[0].options.error({ status: 0 })
    assert.match(ui.dom.window.document.body.textContent, /保存失败/)
    assert.deepEqual(ui.notifications, [])
    ui.edit('hero.moveRight()\n# newest offline edit')
    assert.equal(ui.requests.length, 2)
    assert.match(ui.requests[1].patch.code['hero-placeholder'].plan, /newest offline edit/)
    ui.requests[1].options.success({})
    assert.equal(ui.dom.window.document.querySelector('[data-teaching-save-notice]'), null)
  } finally { ui.close() }
})

for (const status of [401, 404, 409]) {
  test(`victory submission ${status} returns to the unchanged editor and provides a new-tab recovery path`, async () => {
    const dom = new JSDOM('<body><p class="local-save-notice"></p><button id="continue-button"></button></body>')
    let requests = 0
    let closed = false
    const sandbox = {
      module: { exports: {} },
      require: name => name === 'lib/TeachingSaveStatus' ? require('../../app/lib/TeachingSaveStatus') : class {},
      fetch: async () => { requests++; return { ok: false, status, json: async () => ({ message: '当前会话已失效。' }) } },
    }
    vm.runInNewContext(fs.readFileSync(path.join(root, 'app/views/play/level/modal/HeroVictoryModal.js'), 'utf8'), sandbox)
    const view = Object.create(sandbox.module.exports.prototype)
    view.session = new Backbone.Model({ code: { 'hero-placeholder': { plan: '# preserve current editor source' } } })
    view.session.id = 'facebe123456789012345678'
    view.level = new Backbone.Model({ slug: 'local-python-04' })
    const $ = require('jquery')(dom.window)
    view.$ = selector => $(dom.window.document.body).find(selector)
    view.hide = () => { closed = true }
    try {
      await view.prepareTeachingContinuation()
      assert.match(dom.window.document.querySelector('.local-save-notice').textContent, /复制代码/)
      assert.equal(dom.window.document.querySelector('.local-save-notice a').target, '_blank')
      assert.doesNotMatch(dom.window.document.querySelector('#continue-button').textContent, /重试/)
      await view.onClickContinue()
      assert.equal(closed, true)
      assert.equal(requests, 1)
      assert.equal(view.session.get('code')['hero-placeholder'].plan, '# preserve current editor source')
    } finally { dom.window.close() }
  })
}

test('classroom autosave recovery offers cabin return without the legacy copy-and-new-tab blocker', () => {
  const ui = classroom(); let returned = false
  ui.dom.window.teachingReturnToCabin = () => { returned = true }
  try {
    ui.edit('# unsaved code'); ui.requests[0].options.error({ status: 404 })
    const link = ui.dom.window.document.querySelector('[data-teaching-save-recover]')
    assert.equal(link.textContent, '回小屋'); assert.equal(link.target, '')
    link.click(); assert.equal(returned, true)
    assert.doesNotMatch(ui.dom.window.document.body.textContent, /新标签页/)
  } finally { ui.close() }
})

test('classroom victory failure and a still-pending save both allow cabin return', async () => {
  for (const pending of [false, true]) {
    const dom = new JSDOM('<body><p class="local-save-notice"></p><button id="continue-button"></button></body>')
    let returned = false
    const sandbox = { module: { exports: {} }, window: { teachingReturnToCabin: () => { returned = true } }, require: name => name === 'lib/TeachingSaveStatus' ? require('../../app/lib/TeachingSaveStatus') : class {}, fetch: async () => pending ? new Promise(() => {}) : { ok: false, status: 404, json: async () => ({}) } }
    vm.runInNewContext(fs.readFileSync(path.join(root, 'app/views/play/level/modal/HeroVictoryModal.js'), 'utf8'), sandbox)
    const view = Object.create(sandbox.module.exports.prototype)
    view.session = new Backbone.Model({ code: {}, state: {} }); view.session.id = 'gone'
    view.level = new Backbone.Model({ slug: 'local-python-34' })
    const $ = require('jquery')(dom.window); view.$ = selector => $(dom.window.document.body).find(selector)
    try {
      const preparing = view.prepareTeachingContinuation()
      if (pending) view.$('[data-cabin-return]').trigger('click')
      else { await preparing; assert.equal(view.$('#continue-button').text(), '回小屋'); await view.continueTeaching() }
      assert.equal(returned, true)
    } finally { dom.window.close() }
  }
})

test('whole free levels return to the cabin, while scenes and teacher pauses retain their continuation', async () => {
  for (const [kind, paused, expected] of [['level', false, 'cabin'], ['finished', false, 'cabin'], ['waiting', false, 'cabin'], ['scene', false, 'scene'], ['waiting', true, 'waiting']]) {
    const dom = new JSDOM('<body><p class="local-save-notice"></p><button id="continue-button"></button></body>')
    let returned = false
    const sandbox = { module: { exports: {} }, window: { teachingClassroomPaused: paused, teachingReturnToCabin: () => { returned = true } }, require: name => name === 'lib/TeachingSaveStatus' ? require('../../app/lib/TeachingSaveStatus') : class {}, fetch: async () => ({ ok: true, json: async () => ({ kind, label: '继续', message: '状态' }) }) }
    vm.runInNewContext(fs.readFileSync(path.join(root, 'app/views/play/level/modal/HeroVictoryModal.js'), 'utf8'), sandbox)
    const view = Object.create(sandbox.module.exports.prototype)
    view.session = new Backbone.Model({ code: {}, state: { complete: true } }); view.session.id = 'saved'
    view.level = new Backbone.Model({ slug: 'local-python-01' })
    const $ = require('jquery')(dom.window); view.$ = selector => $(dom.window.document.body).find(selector)
    try {
      await view.prepareTeachingContinuation()
      assert.equal(view.teachingNext.kind, expected)
      if (expected === 'cabin') { await view.continueTeaching(); assert.equal(returned, true) }
    } finally { dom.window.close() }
  }
})
