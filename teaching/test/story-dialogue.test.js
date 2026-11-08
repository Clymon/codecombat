const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs'); const path = require('node:path'); const vm = require('node:vm')
const { JSDOM } = require('jsdom')
const { storyLine, storyEvents, StoryMemory } = require('../story-dialogue')
const hero = data => ({ health: 100, teachingVisual: JSON.stringify(data) })

test('chatter reflects reached replay events only, never precomputed success or future damage', () => {
  const h = hero({ completedAt: 8, issueAt: 2, issue: '前面是石墙', hurtAt: 2 })
  assert.deepEqual(storyEvents({}, h, [], 1), [])
  assert.equal(storyEvents({}, h, [], 2)[0].kind, 'wall')
  assert.equal(storyEvents({}, h, [], 8)[0].kind, 'complete')
  assert.deepEqual(storyEvents({}, { ...hero({}), teachingExitReady: true }, [], 9), [], 'an unlocked exit is not a completed level')
  assert.deepEqual(storyEvents({}, { teachingVisual: 'broken', teachingAdventure: 'broken' }, [], 2), [])
  assert.deepEqual(storyEvents({}, hero({}), [{ teachingGateStatus: 'rejected', teachingGateMessageAt: 4 }], 3), [])
  assert.equal(storyEvents({}, hero({ issueAt: 2, issue: '碰到尖刺了', diedAt: 2 }), [], 2)[0].kind, 'spikes')
  assert.equal(storyEvents({}, hero({ issueAt: 2, issue: '牢门还没破，继续硬闯会撞伤。' }), [], 2)[0].kind, 'door')
})

test('each scene remembers seen lines across reruns/reloads, and different scenes remain independent', () => {
  const values = new Map(); const storage = { getItem: key => values.get(key), setItem: (key, value) => values.set(key, value) }
  const design = { index: 17, scenarioIndex: 0 }; const line = storyLine(design, 'wall', 2)
  const memory = new StoryMemory(design, storage)
  memory.remember(line)
  assert.equal(memory.has(storyLine(design, 'wall', 9)), true, 'a later timestamp is still the same reaction')
  assert.equal(new StoryMemory(design, storage).has(line), true)
  assert.equal(new StoryMemory({ ...design, scenarioIndex: 1 }, storage).has(line), false)
  assert.equal(memory.has(storyLine(design, 'complete', 10)), false, 'first actual completion may still celebrate')
  assert.equal(memory.shown.length, 1)
})

test('all 33 levels have short character lines; they never become code speech', () => {
  for (let index = 1; index <= 33; index++) {
    const line = storyLine({ index }, 'entry', null)
    assert.equal(line.source, 'story'); assert.equal(line.speaker, 'hero')
    assert.ok(line.text.length < 65); assert.ok(!line.text.includes('undefined'))
    assert.ok(storyLine({ index }, 'complete', 5).text)
  }
})

test('rules record exact successful and failed frames without altering goals or hero speech', () => {
  const Rules = vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../rules-system.js'), 'utf8'), { System: class {} })
  const h = { health: 100, pos: { x: 24, y: 12 }, teachingSpeechLog: '[{"text":"hello","time":1}]' }
  const goals = { 'reach-exit': 'incomplete', 'stay-safe': 'incomplete' }
  const world = { age: 1, goalManager: { getGoalState: id => goals[id] } }
  const rules = Object.assign(new Rules(), { world })
  rules.recordHeroVisual(h)
  assert.equal(JSON.parse(h.teachingVisual).completedAt, null)
  world.age = 2; h.teachingFailure = '前面是石墙'; rules.recordHeroVisual(h)
  assert.equal(JSON.parse(h.teachingVisual).issueAt, 2)
  world.age = 2.5; rules.recordHeroVisual(h); assert.equal(JSON.parse(h.teachingVisual).issueAt, 2)
  h.teachingFailure = ''; goals['reach-exit'] = 'success'; world.age = 3; rules.recordHeroVisual(h)
  assert.equal(JSON.parse(h.teachingVisual).completedAt, null, 'not successful until all required goals pass')
  goals['stay-safe'] = 'success'; world.age = 4; rules.recordHeroVisual(h)
  assert.equal(JSON.parse(h.teachingVisual).completedAt, 4)
  world.age = 5; rules.recordHeroVisual(h); assert.equal(JSON.parse(h.teachingVisual).completedAt, 4)
  assert.equal(h.teachingSpeechLog, '[{"text":"hello","time":1}]'); assert.equal(h.health, 100)
  assert.deepEqual(goals, { 'reach-exit': 'success', 'stay-safe': 'success' })
})

function ui (run, options = {}) {
  const dom = new JSDOM('<div id="level-view"></div><div id="level-loading-view"></div>', { url: 'http://localhost/teaching' })
  dom.window.matchMedia = () => ({ matches: true })
  const events = new Map(); const timers = new Map(); let timerId = 0
  const mediator = { subscribe: (key, fn) => events.set(key, fn), unsubscribe: key => events.delete(key) }
  const globals = { window: dom.window, document: dom.window.document, sessionStorage: dom.window.sessionStorage, Backbone: { Mediator: mediator }, setTimeout: (fn, delay) => { timers.set(++timerId, { fn, delay }); return timerId }, clearTimeout: id => timers.delete(id) }
  const saved = {}
  for (const [key, value] of Object.entries(globals)) { saved[key] = global[key]; global[key] = value }
  let view
  try {
    const View = require('../dialogue-view')
    view = new View(document.getElementById('level-view'), { index: 4, slug: 'test-story', gates: [] }, { normalCanvas: [{ getBoundingClientRect: () => ({ left: 0, width: 700, bottom: 400 }) }] }, { autoIntro: false, story: true, ...options })
    const frame = (age, data = {}) => view.update(hero(data), { age, getThangByID: () => null })
    run({ view, events, timers, frame })
  } finally {
    view?.destroy()
    for (const key of Object.keys(saved)) { if (saved[key] === undefined) delete global[key]; else global[key] = saved[key] }
    dom.window.close()
  }
}

test('entry waits behind onboarding, auto-closes, and never returns when running again', () => ui(({ view, events, timers }) => {
  events.get('level:set-time')({ time: 0 }) // Native startup, not a student scrub.
  events.get('level:loading-view-unveiled')(); view.setGuideActive(true); view.showEntry()
  assert.equal(view.shell.hidden, true)
  view.setGuideActive(false)
  assert.equal(view.mode, 'story'); assert.equal(view.currentEntry.kind, 'entry')
  assert.equal(view.shell.querySelector('.vn-role').textContent, '随行碎碎念')
  const dismiss = [...timers.values()].find(t => t.delay >= 5000)
  assert.ok(dismiss); dismiss.fn(); assert.equal(view.shell.hidden, true)
  events.get('tome:manual-cast')(); view.showEntry(); assert.equal(view.shell.hidden, true)
  view.destroy(); assert.equal(events.size, 0); assert.equal(timers.has(view.entryTimer), false); assert.equal(timers.has(view.dismissTimer), false)
}))

test('repeated wall contact and identical-code reruns are quiet; first completion speaks once', () => ui(({ view, events, frame }) => {
  events.get('level:loading-view-unveiled')(); events.get('tome:manual-cast')()
  frame(0); frame(2, { issue: '前面是石墙', issueAt: 2 })
  assert.equal(view.currentEntry.kind, 'wall'); assert.equal(view.mode, 'story')
  view.hide(); frame(2.1, { issue: '前面是石墙', issueAt: 2 }); assert.equal(view.shell.hidden, true)
  events.get('tome:manual-cast')(); frame(0); frame(2, { issue: '前面是石墙', issueAt: 2 })
  assert.equal(view.shell.hidden, true, 'rerun does not repeat the bump line')
  frame(6, { completedAt: 6 }); assert.equal(view.currentEntry.kind, 'complete')
  events.get('tome:manual-cast')(); frame(0); frame(6, { completedAt: 6 }); assert.equal(view.shell.hidden, true)
}))

test('scrubbing and rewinding do not replay chatter, close dismisses without suppressing student bubbles', () => ui(({ view, events, frame }) => {
  events.get('level:loading-view-unveiled')(); events.get('tome:manual-cast')()
  frame(0); events.get('level:set-time')(); frame(5, { completedAt: 5 })
  assert.equal(view.shell.hidden, true)
  events.get('tome:manual-cast')(); frame(0); frame(5, { completedAt: 5 })
  assert.equal(view.currentEntry.kind, 'complete')
  frame(1); assert.equal(view.shell.hidden, true)
  frame(5, { completedAt: 5 }); assert.equal(view.shell.hidden, true)
  view.toggle.click(); assert.match(view.line.textContent, /稳稳停住/)
  view.closeButton.click(); frame(6, { hurtAt: 6 }); assert.equal(view.shell.hidden, true)
}))

test('a first collision interrupts the entry line, and closing it does not mute a later first success', () => ui(({ view, events, frame }) => {
  events.get('level:loading-view-unveiled')(); view.showEntry(); frame(0)
  frame(1, { issue: '前面是石墙', issueAt: 1 }); assert.equal(view.currentEntry.kind, 'wall')
  view.closeButton.click(); assert.equal(view.muted, false)
  events.get('tome:manual-cast')(); frame(0); frame(5, { completedAt: 5 })
  assert.equal(view.currentEntry.kind, 'complete')
}))

test('native wall contact is recorded even when locomotion stops without a failure message', () => {
  const Rules = vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../rules-system.js'), 'utf8'), { System: class {} })
  const h = { pos: { x: 12, y: 12 }, health: 100 }
  const world = { age: 0 }; const rules = Object.assign(new Rules(), { world, walls: [{ x: 12, y: 18, halfWidth: 2, halfHeight: 2 }] })
  rules.recordHeroVisual(h); assert.equal(JSON.parse(h.teachingVisual).wallAt, null)
  world.age = 1; h.pos.y = 15; rules.recordHeroVisual(h)
  assert.equal(JSON.parse(h.teachingVisual).wallAt, 1)
  assert.equal(storyEvents({}, h, [], 1)[0].kind, 'wall')
  assert.equal(h.teachingFailure, undefined); assert.equal(h.health, 100)
  world.age = 2; rules.recordHeroVisual(h); assert.equal(JSON.parse(h.teachingVisual).wallAt, 1)
})

test('quiet entry does not chain dialogue after a guide, but gameplay reactions remain', () => ui(({ view, events, frame }) => {
  events.get('level:loading-view-unveiled')(); view.setGuideActive(true); view.setGuideActive(false); view.showEntry()
  assert.equal(view.shell.hidden, true)
  events.get('tome:manual-cast')(); frame(0); frame(2, { issue: '前面是石墙', issueAt: 2 })
  assert.equal(view.currentEntry.kind, 'wall')
}, { autoEntry: false }))
