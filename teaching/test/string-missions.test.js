const test = require('node:test'); const assert = require('node:assert/strict')
const Strings = require('../string-runtime'); const { definitions, tasks } = require('../string-missions')
const { compileLevels } = require('../tools/build-levels'); const { commandDocs } = require('../command-docs')
const { progressHint } = require('../progress-hint'); const room = require('../lesson-room')
function fixture (mode, seed = 1) {
  const design = definitions().find(d => d.stringMission.mode === mode)
  const goals = {}; const hero = { pos: { x: 24, y: 12 }, velocity: { x: 0, y: 0 }, health: 100, setAction () {}, setTargetPos () {} }
  const world = { age: 0, rand: { rand: n => { seed = (1664525 * seed + 1013904223) >>> 0; return Math.floor(seed / 4294967296 * n) } }, goalManager: { setGoalState: (key, value) => { goals[key] = value } } }
  const rules = { world, fail (h, message) { this.failed = true; h.teachingFailure = message; goals['stay-safe'] = 'failure' } }
  const system = new Strings(rules, hero, design.stringMission)
  const read = () => hero.readObject(design.stringMission.object)
  const act = (name, ...args) => { hero[name](...args); world.age += 4; assert.equal(hero[name](...args), 'done') }
  return { system, rules, hero, world, goals, design, read, act }
}
test('all five missions compile with distinct goals and help; no syntax contracts', () => {
  const levels = compileLevels(definitions()); assert.equal(levels.length, 5)
  for (const level of levels) {
    assert.ok(level.goals.some(g => g.id === 'string-mission'))
    assert.equal(level.teachingMap.learningContract, undefined)
    const docs = commandDocs(level.slug, level.teachingMap, 'python')
    for (const api of level.teachingMap.apis) assert.ok(docs.find(d => d.name === api)?.description)
  }
})
test('physical bridge, instrument and pool require actual repair and expose timed effects', () => {
  const variants = new Set()
  for (let seed = 1; seed <= 20; seed++) {
    for (const mode of ['bridge', 'loom', 'purify']) {
      const a = fixture(mode, seed * 7919); const text = a.read(); variants.add(text)
      const method = { bridge: 'buildBridge', loom: 'playTune', purify: 'purify' }[mode]
      const value = mode === 'bridge' ? text.slice(1, 4) : mode === 'loom' ? text.repeat(3) + [...text].reverse().join('') : text.trim().replace(/毒/g, '').toUpperCase()
      assert.equal(a.hero[method](value), undefined); assert.equal(a.system.ready(), false)
      assert.ok(JSON.parse(a.hero.teachingStrings).event.duration >= 1)
      a.world.age = 5; assert.equal(a.hero[method](value), 'done'); assert.equal(a.goals['string-mission'], 'success')
      assert.equal(a.system.ready(), true); assert.match(progressHint(a.design, a.hero, a.world).text, /法阵|走廊|水渠|对岸/)
      const bad = fixture(mode, seed * 7919); bad.read(); bad.act(method, '乱填'); assert.equal(bad.system.ready(), false); assert.equal(bad.goals['stay-safe'], 'failure')
      const skip = fixture(mode, seed * 7919); skip.hero.pos = { x: 48, y: 12 }; skip.system.update(); assert.equal(skip.goals['stay-safe'], 'failure')
    }
  }
  assert.ok(variants.size > 20)
})
test('rescue updates the observed scene and cannot reuse a stale or absent position', () => {
  for (let seed = 1; seed < 12; seed++) {
    const a = fixture('rescue', seed); let text = a.read(); const count = [...text].filter(c => c === '人').length
    assert.ok(count >= 2); let n = 0
    while (text.includes('人')) { const i = text.indexOf('人'); a.act('rescue', i); text = a.read(); assert.equal(text[i], '空'); n++ }
    assert.equal(n, count); assert.equal(a.system.ready(), true)
  }
  const stale = fixture('rescue'); const i = stale.read().indexOf('人'); stale.act('rescue', i); stale.act('rescue', i); assert.equal(stale.goals['stay-safe'], 'failure')
  const missing = fixture('rescue'); missing.read(); missing.act('rescue', -1); assert.match(missing.hero.teachingFailure, /-1/)
})
test('packing and delivery are separate physical stages; wrong type, wrong place and skipped pack fail', () => {
  const a = fixture('dispatch'); const [item, count] = a.read().split('|'); a.act('pack', item, Number(count))
  assert.equal(a.system.ready(), false); assert.equal(progressHint(a.design, a.hero, a.world).stage, 'delivery')
  assert.throws(() => a.hero.deliver(), /旗帜/)
  a.hero.pos = { x: 72, y: 24 }; a.act('deliver'); assert.equal(a.system.ready(), true); assert.equal(a.system.state.cargo, null)
  const wrong = fixture('dispatch'); const parts = wrong.read().split('|'); wrong.act('pack', ...parts); assert.equal(wrong.goals['stay-safe'], 'failure')
  const skip = fixture('dispatch'); skip.read(); skip.hero.pos = { x: 72, y: 24 }; skip.act('deliver'); assert.equal(skip.goals['stay-safe'], 'failure')
  const remote = fixture('bridge'); remote.hero.pos.x = 12; assert.throws(() => remote.read(), /紧邻/)
})
test('teacher publishes each new task explicitly; late joiners and hints follow current station', () => {
  const fs = require('node:fs'); const os = require('node:os'); const path = require('node:path')
  const old = process.env.TEACHING_STATE_DIR; const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'string-room-')); process.env.TEACHING_STATE_DIR = dir
  try {
    const teacher = { id: 'test', user: 'teacher' }; const command = data => room.command(teacher, { revision: room.load().revision, ...data })
    command({ action: 'start' }); room.join('99990001'); command({ action: 'resume' })
    for (const [task, value] of Object.entries(tasks)) {
      command({ action: 'assign', task, targets: 'all' }); const s = room.studentView('99990001'); assert.equal(s.next.detail.id, task)
      room.move('99990001', s.id, 'next'); command({ action: 'hint', targets: 'all', level: 2 }); assert.ok(room.studentView('99990001').hints.at(-1).text)
      room.record(s.id, '99990001', value.slug, { teachingComplete: true }); assert.equal(room.studentView('99990001').next, null)
      assert.equal(room.studentView('99990001').result.independent, false)
    }
    room.join('99990002'); assert.equal(room.studentView('99990002').task.id, 'dispatch')
  } finally { if (old === undefined) delete process.env.TEACHING_STATE_DIR; else process.env.TEACHING_STATE_DIR = old; fs.rmSync(dir, { recursive: true, force: true }) }
})
