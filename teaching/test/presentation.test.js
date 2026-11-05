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

test('teaching HUD keeps the hero selected when a guard or empty map is clicked', () => {
  const sandbox = { module: { exports: {} }, require: () => function () {} }
  vm.runInNewContext(require('coffee-script').compile(fs.readFileSync(path.join(__dirname, '../../app/views/play/level/LevelHUDView.coffee'), 'utf8')), sandbox)
  const view = Object.create(sandbox.module.exports.prototype)
  view.options = { level: { get: () => true } }
  const hero = { id: 'Hero Placeholder' }; view.thang = hero
  view.setThang({ id: 'Post Guard' }, {})
  assert.equal(view.thang, hero)
  view.setThang(null, null)
  assert.equal(view.thang, hero)
})

test('dialogue stays inside the map above playback after a viewport resize', () => {
  const { dom, mediator } = environment(); const saved = {}
  for (const [key, value] of Object.entries({ window: dom.window, document: dom.window.document, sessionStorage: dom.window.sessionStorage, Backbone: { Mediator: mediator } })) { saved[key] = global[key]; global[key] = value }
  let view
  try {
    const playback = document.createElement('div'); playback.id = 'playback-view'; document.body.append(playback)
    let bounds = { left: 0, top: 50, width: 960, height: 805, bottom: 855 }
    playback.getBoundingClientRect = () => ({ top: bounds.bottom - 45, height: 60 })
    view = new (require('../dialogue-view'))(document.getElementById('level-view'), { index: 5, gates: [], world: {} }, { normalCanvas: [{ getBoundingClientRect: () => bounds }] }, { autoIntro: false })
    for (const next of [bounds, { left: 0, top: 50, width: 768, height: 490, bottom: 540 }]) {
      bounds = next; window.dispatchEvent(new window.Event('resize'))
      const top = parseFloat(view.shell.style.top); const height = parseFloat(view.shell.style.height)
      assert.ok(top >= bounds.top)
      assert.ok(top + height <= bounds.bottom - 45)
      assert.equal(parseFloat(view.shell.style.width), bounds.width)
    }
  } finally {
    view?.destroy()
    for (const key of Object.keys(saved)) { if (saved[key] === undefined) delete global[key]; else global[key] = saved[key] }
    dom.window.close()
  }
})

test('conversation keeps hero left and listener right, highlights each turn, and clears the partner for monologue', () => {
  const { dom, mediator } = environment(); const saved = {}
  for (const [key, value] of Object.entries({ window: dom.window, document: dom.window.document, sessionStorage: dom.window.sessionStorage, Backbone: { Mediator: mediator } })) { saved[key] = global[key]; global[key] = value }
  let view
  try {
    view = new (require('../dialogue-view'))(document.getElementById('level-view'), { index: 5, gates: [], world: {} }, { normalCanvas: [{ getBoundingClientRect: () => ({ left: 0, top: 50, width: 700, height: 500, bottom: 550 }) }] }, { autoIntro: false })
    view.open([{ speaker: 'hero', partner: 'guard', text: '你好' }, { speaker: 'guard', text: '请报口令' }, { speaker: 'hero', text: '我先看看地图。', source: 'story' }], 'history')
    const heroSource = view.heroImage.src
    assert.equal(view.shell.dataset.side, 'left'); assert.equal(view.shell.dataset.paired, 'true')
    assert.equal(view.heroImage.classList.contains('is-speaking'), true)
    assert.equal(view.partnerImage.classList.contains('is-speaking'), false)
    assert.equal(view.partnerImage.dataset.character, 'guard')
    view.advance()
    assert.equal(view.shell.dataset.side, 'right'); assert.equal(view.heroImage.src, heroSource)
    assert.equal(view.heroImage.classList.contains('is-speaking'), false)
    assert.equal(view.partnerImage.classList.contains('is-speaking'), true)
    view.advance()
    assert.equal(view.partnerImage.hidden, true); assert.equal(view.partnerImage.hasAttribute('src'), false)
    assert.equal(view.shell.dataset.paired, 'false'); assert.equal(view.shell.dataset.side, 'left')
    view.open([{ speaker: 'mentor', text: '先试着运行。' }], 'history')
    assert.equal(view.partnerImage.dataset.character, 'mentor'); assert.equal(view.heroImage.src, heroSource)
  } finally {
    view?.destroy()
    for (const key of Object.keys(saved)) { if (saved[key] === undefined) delete global[key]; else global[key] = saved[key] }
    dom.window.close()
  }
})

test('a guard is the listener only for speech recorded at a post, not distant code output or a future reply', () => {
  const design = { gates: [{ approach: [24, 12] }] }
  const hero = { teachingSpeechLog: JSON.stringify([{ x: 12, y: 12, time: 1, text: '你好' }, { x: 24, y: 12, time: 3, text: '自己人' }]) }
  const guard = { id: 'Guard', teachingGateMessage: '通过', teachingGateMessageAt: 3 }
  assert.equal(replayLines(design, hero, [guard], 1)[0].partner, undefined)
  const reached = replayLines(design, hero, [guard], 3)
  assert.equal(reached[1].partner, 'guard'); assert.equal(reached[2].speaker, 'guard')
})
