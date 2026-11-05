const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs'); const path = require('node:path'); const vm = require('node:vm')
const { JSDOM } = require('jsdom')
const { replayLines, introFor } = require('../dialogue-content')

test('dialogue exposes only code speech and guard responses already reached in the replay', () => {
  const hero = { teachingSpeechLog: JSON.stringify([{ time: 2, text: '你好' }, { time: 5, text: '<b>自己人</b>' }]) }
  const guard = { id: 'Post Guard', teachingGateMessage: '口令正确，请通行。', teachingGateMessageAt: 5 }
  assert.deepEqual(replayLines({}, hero, [guard], 1), [])
  assert.deepEqual(replayLines({}, hero, [guard], 3).map(l => l.text), ['你好'])
  assert.equal(replayLines({}, hero, [guard], 5).at(-1).speaker, 'guard')
  assert.deepEqual(replayLines({}, hero, [guard], 0), [], 'rewinding cannot reveal future dialogue')
  assert.deepEqual(replayLines({}, { teachingSpeechLog: 'bad json' }, [], 2), [])
  assert.deepEqual(introFor({ world: { chapterId: 'samples' } }), [])
})

function environment () {
  const dom = new JSDOM('<div id="level-view"></div><div id="level-loading-view"></div><div id="thang-hud"></div>', { url: 'http://localhost/teaching' })
  dom.window.matchMedia = () => ({ matches: true })
  const events = new Map()
  const mediator = { subscribe: (key, fn) => events.set(key, fn), unsubscribe: key => events.delete(key) }
  return { dom, events, mediator }
}

test('dialogue supports skip, literal text, replay reset, reopening and listener disposal', () => {
  const { dom, events, mediator } = environment()
  const saved = {}
  for (const [key, value] of Object.entries({ window: dom.window, document: dom.window.document, sessionStorage: dom.window.sessionStorage, Backbone: { Mediator: mediator } })) { saved[key] = global[key]; global[key] = value }
  try {
    const Dialogue = require('../dialogue-view')
    const design = { index: 5, slug: 'test-only', gates: [{ id: 'Post Guard' }], world: { chapterId: 'starter-village' } }
    const surface = { normalCanvas: [{ getBoundingClientRect: () => ({ left: 0, width: 700, bottom: 400 }) }] }
    const view = new Dialogue(document.getElementById('level-view'), design, surface)
    events.get('level:loading-view-unveiled')()
    assert.equal(view.mode, 'intro')
    view.closeButton.click()
    assert.equal(view.shell.hidden, true)
    const world = { age: 2, getThangByID: () => null }
    view.update({ teachingSpeechLog: JSON.stringify([{ time: 2, text: '<img src=x onerror=alert(1)>' }]) }, world)
    assert.equal(view.mode, 'runtime', 'skip intro does not disable responses')
    assert.equal(view.line.querySelector('img'), null)
    assert.match(view.line.textContent, /<img/)
    view.update({}, { ...world, age: 0 })
    assert.equal(view.shell.hidden, true)
    assert.equal(view.history.length, 0)
    view.toggle.click(); assert.equal(view.shell.hidden, false)
    view.destroy(); assert.equal(events.size, 0); assert.equal(document.querySelector('.village-dialogue'), null)
  } finally {
    for (const key of Object.keys(saved)) { if (saved[key] === undefined) delete global[key]; else global[key] = saved[key] }
    dom.window.close()
  }
})

test('native HUD displays rasterIcon portraits instead of an empty vector canvas', () => {
  const { dom } = environment(); const $ = require('jquery')(dom.window)
  const sandbox = { module: { exports: {} }, $, Backbone: {}, require: () => function () {} }
  const coffee = require('coffee-script')
  vm.runInNewContext(coffee.compile(fs.readFileSync(path.join(__dirname, '../../app/views/play/level/LevelHUDView.coffee'), 'utf8')), sandbox)
  const view = Object.create(sandbox.module.exports.prototype)
  view.$el = $('<div><div class="thang-canvas-wrapper"><canvas></canvas></div></div>'); view.thang = { team: 'humans' }
  const type = { isFullyLoaded: () => true, get: key => key === 'rasterIcon' ? 'teaching/deepseek-portrait-v2.png' : null, getPortraitURL: () => '/file/teaching/deepseek-portrait-v2.png', getHeroShortName: () => 'DeepSeek', getPortraitStage: () => { throw Error('Must not attempt vector portrait') } }
  view.createAvatar(type, { getLankOptions: () => ({}) })
  assert.equal(view.$el.find('img.avatar').attr('src'), '/file/teaching/deepseek-portrait-v2.png')
  assert.equal(view.$el.find('canvas').length, 0)
  dom.window.close()
})

test('UI tour suppresses duplicate intro and runtime popups, then restores real dialogue', () => {
  const { dom, events, mediator } = environment()
  const saved = {}
  for (const [key, value] of Object.entries({ window: dom.window, document: dom.window.document, sessionStorage: dom.window.sessionStorage, Backbone: { Mediator: mediator } })) { saved[key] = global[key]; global[key] = value }
  try {
    const Dialogue = require('../dialogue-view')
    const view = new Dialogue(document.getElementById('level-view'), { index: 5, gates: [], world: { chapterId: 'starter-village' } }, { normalCanvas: [{ getBoundingClientRect: () => ({ left: 0, width: 700, bottom: 400 }) }] }, { autoIntro: false })
    events.get('level:loading-view-unveiled')()
    assert.equal(view.shell.hidden, true)
    view.setGuideActive(true)
    view.update({ teachingSpeechLog: JSON.stringify([{ time: 1, text: '你好' }]) }, { age: 1, getThangByID: () => null })
    assert.equal(view.shell.hidden, true); assert.equal(view.toggle.hidden, true)
    view.setGuideActive(false)
    view.update({ teachingSpeechLog: JSON.stringify([{ time: 2, text: '自己人' }]) }, { age: 2, getThangByID: () => null })
    assert.equal(view.mode, 'runtime'); assert.equal(view.line.textContent, '自己人')
    view.destroy()
  } finally {
    for (const key of Object.keys(saved)) { if (saved[key] === undefined) delete global[key]; else global[key] = saved[key] }
    dom.window.close()
  }
})
