const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs'); const path = require('node:path')
const { JSDOM } = require('jsdom')
const { stepsFor, placeCard } = require('../onboarding-content')

test('all level/scenario guides use current map coordinates and leave source data untouched', () => {
  const root = path.join(__dirname, '../levels')
  const files = fs.readdirSync(root).filter(f => /^local-python-\d+.json$/.test(f)).map(f => path.join(root, f))
  files.push(...fs.readdirSync(path.join(root, 'scenarios')).filter(f => f.endsWith('.json')).map(f => path.join(root, 'scenarios', f)))
  assert.ok(files.length >= 47)
  for (const file of files) {
    const design = JSON.parse(fs.readFileSync(file)).teachingMap; const before = JSON.stringify(design)
    const steps = stepsFor(design)
    assert.deepEqual(steps.map(s => s.target), ['map', 'editor', 'run', 'submit'])
    assert.ok(steps.every(s => s.title && s.text && !s.text.includes('undefined')), file)
    const [x, y] = steps[0].point
    assert.ok(x >= 0 && x <= design.size[0] && y >= 0 && y <= design.size[1], file)
    for (const loop of design.learningContract?.loops || []) assert.ok(steps[1].note.includes(loop))
    assert.equal(JSON.stringify(design), before)
    if (design.index === 7) { assert.match(steps[1].code, /take/); assert.doesNotMatch(steps[1].code, /give|move/) }
    assert.equal(steps.filter(s => s.code).length, [4, 7].includes(design.index) ? 1 : 0, 'challenge guide does not disclose a full solution')
  }
})

test('callouts stay on screen and beside their highlight at classroom screen sizes', () => {
  for (const [width, height] of [[1280, 720], [1024, 900], [1440, 900]]) {
    for (const rect of [
      { left: width * 0.7, right: width - 8, top: 110, bottom: height - 130 },
      { left: 310, right: 384, top: 190, bottom: 276 },
      { left: width - 170, right: width - 20, top: height - 70, bottom: height - 20 },
    ]) {
      const p = placeCard(rect, 368, 320, { width, height })
      assert.ok(p.left >= 12 && p.top >= 12 && p.left + 368 <= width - 12 && p.top + 320 <= height - 12)
      assert.ok(p.left >= rect.right || p.left + 368 <= rect.left || p.top >= rect.bottom || p.top + 320 <= rect.top)
    }
  }
})

function withUI (fn) {
  const dom = new JSDOM('<div id="level-view"><details id="teaching-task" open><summary>任务日志</summary></details><div id="code-area"><div id="spell-view"><div class="ace_editor"></div></div></div><div id="goals-view"></div><div id="cast-button-view"><button class="cast-button">运行</button><button class="submit-button">提交</button></div></div><div id="level-loading-view"></div>', { url: 'http://localhost/teaching' })
  Object.defineProperty(dom.window, 'innerWidth', { value: 1280 })
  Object.defineProperty(dom.window, 'innerHeight', { value: 720 })
  const events = new Map(); const published = []
  const mediator = {
    subscribe: (key, fn) => { if (!events.has(key)) events.set(key, new Set()); events.get(key).add(fn) },
    unsubscribe: (key, fn) => { events.get(key)?.delete(fn); if (!events.get(key)?.size) events.delete(key) },
    publish: (key, data) => { published.push(key); for (const fn of events.get(key) || []) fn(data) },
  }
  const rect = (left, top, width, height) => ({ left, top, width, height, right: left + width, bottom: top + height })
  const surface = { playing: true, currentFrame: 0, world: { totalFrames: 500 }, normalCanvas: [{ getBoundingClientRect: () => rect(0, 50, 850, 380) }], camera: { canvasWidth: 850, canvasHeight: 380, worldToCanvas: () => ({ x: 340, y: 210 }) } }
  const saved = {}
  for (const [key, value] of Object.entries({ window: dom.window, document: dom.window.document, sessionStorage: dom.window.sessionStorage, Backbone: { Mediator: mediator } })) { saved[key] = global[key]; global[key] = value }
  document.querySelector('.ace_editor').getBoundingClientRect = () => rect(860, 100, 410, 460)
  document.querySelector('.cast-button').getBoundingClientRect = () => rect(870, 630, 180, 45)
  document.querySelector('.submit-button').getBoundingClientRect = () => rect(1060, 630, 180, 45)
  document.querySelector('#goals-view').getBoundingClientRect = () => rect(10, 60, 240, 100)
  try { fn({ surface, dom, events, mediator, published }) } finally { for (const key of Object.keys(saved)) { if (saved[key] === undefined) delete global[key]; else global[key] = saved[key] }; dom.window.close() }
}

test('guide waits for entry, pauses playback, skips/reopens, never runs code and disposes all listeners', () => withUI(({ surface, mediator, events, published }) => {
  const Guide = require('../onboarding-view'); const active = []
  const root = document.getElementById('level-view'); const task = document.getElementById('teaching-task')
  const design = { index: 4, slug: 'local-python-04', start: [12, 12], gates: [{ at: [36, 12] }] }
  const view = new Guide(root, design, surface, task, { setGuideActive: value => active.push(value) })
  assert.equal(view.active, false)
  mediator.publish('level:loading-view-unveiled')
  assert.equal(view.active, true); assert.equal(task.open, false)
  assert.equal(document.body.classList.contains('deepseek-guiding'), true)
  view.next.click(); assert.equal(view.index, 1); assert.match(view.card.textContent, /hero.moveRight\(\)/)
  view.back.click(); assert.equal(view.index, 0)
  document.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape' }))
  assert.equal(view.active, false); assert.equal(task.open, true)
  assert.equal(document.body.classList.contains('deepseek-guiding'), false)
  assert.equal(sessionStorage.getItem(view.seenKey), 'seen')
  assert.deepEqual(active, [true, false])
  assert.ok(!published.includes('tome:manual-cast'), 'guide never executes student code')
  view.toggle.click(); assert.equal(view.active, true)
  mediator.publish('tome:manual-cast', { realTime: false }); assert.equal(view.active, false)
  const seenKey = view.seenKey
  view.destroy(); assert.equal(events.size, 0); assert.equal(root.querySelector('.deepseek-guide'), null)
  const again = new Guide(root, design, surface, task)
  mediator.publish('level:loading-view-unveiled'); assert.equal(again.active, false)
  assert.equal(again.seenKey, seenKey); again.toggle.click(); assert.equal(again.active, true)
  again.destroy()
  const nextScene = new Guide(root, { ...design, scenarioIndex: 1 }, surface, task)
  mediator.publish('level:loading-view-unveiled'); assert.equal(nextScene.active, false); nextScene.destroy(); assert.equal(document.body.classList.contains('deepseek-guiding'), false)
}))

test('hidden submit points at goals and untrusted text remains literal', () => withUI(({ surface, mediator }) => {
  const Guide = require('../onboarding-view')
  const view = new Guide(document.getElementById('level-view'), { index: 99, quest: '<img src=x onerror=alert(1)>', exit: [12, 12] }, surface, document.getElementById('teaching-task'))
  mediator.publish('level:loading-view-unveiled')
  assert.equal(view.card.querySelector('.ds-guide-text img'), null)
  document.querySelector('.submit-button').remove()
  view.show(3)
  assert.match(view.card.querySelector('.ds-guide-text').textContent, /运行后会出现/)
  assert.equal(view.targetRect().left, 10)
  view.destroy()
}))

test('submit callout leaves the neighboring run button clickable', () => {
  const run = { left: 860, right: 1044, top: 365, bottom: 410 }
  const submit = { left: 1058, right: 1245, top: 365, bottom: 410 }
  const p = placeCard(submit, 368, 262, { width: 1280, height: 720 }, [run, submit])
  assert.ok(p.top + 262 <= run.top || p.top >= run.bottom || p.left + 368 <= run.left)
})

test('UI tour is once per browser; new concepts use one card and variants stay quiet', () => {
  const { GuideMemory } = require('../guide-memory'); const values = new Map(); const storage = { getItem: k => values.get(k), setItem: (k, v) => values.set(k, v) }
  const design = { index: 4, start: [12, 12], exit: [24, 12] }
  const first = new GuideMemory(design, storage); assert.equal(first.automaticSteps().length, 4); first.remember()
  assert.equal(new GuideMemory({ ...design, index: 1 }, storage).automaticSteps().length, 0)
  const skill = new GuideMemory({ ...design, index: 7 }, storage); assert.equal(skill.automaticSteps().length, 1); skill.remember()
  assert.equal(new GuideMemory({ ...design, index: 7, scenarioIndex: 1 }, storage).automaticSteps().length, 0)
  assert.equal(new GuideMemory({ ...design, index: 7 }, storage).automaticSteps().length, 0)
})
test('legacy seen guides prevent an extra full tour after upgrading', () => {
  const { GuideMemory } = require('../guide-memory')
  const legacy = { length: 1, key: () => 'deepseek-guide-v1:local-python-07:0', getItem: () => 'seen' }
  const values = new Map(); const storage = { getItem: k => values.get(k), setItem: (k, v) => values.set(k, v) }
  assert.equal(new GuideMemory({ index: 7, start: [12, 12] }, storage, legacy).automaticSteps().length, 0)
  assert.equal(new GuideMemory({ index: 7, start: [12, 12] }, storage).automaticSteps().length, 0, 'migrated history survives a new tab without legacy session storage')
})

test('tutorial instructions start collapsed and remain available on demand', () => withUI(() => {
  const { attachGuide } = require('../tutorial-guide')
  const task = document.getElementById('teaching-task')
  attachGuide(task, { tutorial: { title: '打破木门', steps: [{ text: '攻击木门', code: 'hero.attack("木门")', observe: '木门掉血', evidence: { kind: 'dead', id: 'door' } }] } })
  assert.equal(task.open, false)
  assert.match(task.querySelector('summary').textContent, /点击查看/)
  task.open = true; assert.match(task.textContent, /hero.attack/)
}))
