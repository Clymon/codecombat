const test = require('node:test'); const assert = require('node:assert/strict'); const { JSDOM } = require('jsdom')
const designs = require('../map-designs'); const { mapObjects, describeObject, hitObject } = require('../map-inspection')
const get = n => { const d = designs.find(d => d.index === n); return { ...d, ...d.scenarios?.[0], slug: 'local-python-' + String(n).padStart(2, '0') } }
const world = { age: 0, getThangByID: () => null }
test('objects expose specific target calls and actual approach-distance rules', () => {
  const d = get(7); const hero = { pos: { x: 0, y: 0 } }; const objects = mapObjects(d, hero, world)
  const box = objects.find(o => o.kind === 'supply'); const far = describeObject(box, d, hero, world)
  assert.match(far.cards[0].code, /hero.take\("补给箱"\)/); assert.equal(far.ready, false)
  hero.pos = { x: box.approach[0], y: box.approach[1] }; assert.equal(describeObject(box, d, hero, world).ready, true)
  const receiver = objects.find(o => o.kind === 'receiver'); assert.match(describeObject(receiver, d, hero, world).cards[0].code, /hero.give\("出口机关", amount\)/)
})
test('charge plates describe the positional effect of wait, not a fictional activation API', () => {
  const d = get(2); const hero = { pos: { x: 12, y: 12 } }; const object = mapObjects(d, hero, world).find(o => o.kind === 'charge')
  const info = describeObject(object, d, hero, world); assert.equal(info.cards[0].code, 'hero.wait()'); assert.equal(info.ready, false)
  hero.pos = { x: 24, y: 12 }; assert.equal(describeObject(object, d, hero, world).ready, true)
})
test('global help is limited to this level and passive items do not invent commands', () => {
  const d = get(9); const hero = { pos: { x: 0, y: 0 } }
  const global = describeObject(mapObjects(d, hero, world)[0], d, hero, world)
  assert.ok(global.cards.some(c => c.code.includes('pathOpen(') && !c.code.includes('hero.pathOpen')))
  assert.ok(!global.cards.some(c => c.name === 'isVictory'))
  const gem = mapObjects(get(1), hero, world).find(o => o.kind === 'gem'); assert.equal(describeObject(gem, get(1), hero, world).cards.length, 0)
})
test('future enemy spawns are not revealed by object inspection', () => {
  const d = get(25); assert.ok(!mapObjects(d, { pos: { x: 36, y: 12 } }, world).some(o => o.kind === 'enemy'))
})
test('map clicking opens read-only help; inserting code does not cast or mutate the world', () => {
  const dom = new JSDOM('<div id="level-view"><canvas></canvas><div class="ace coco-view"></div></div>', { url: 'http://localhost/teaching' })
  const saved = {}; const events = new Map()
  for (const [k, v] of Object.entries({ window: dom.window, document: dom.window.document, Backbone: { Mediator: { subscribe: (k, f) => events.set(k, f), unsubscribe: k => events.delete(k) } } })) { saved[k] = global[k]; global[k] = v }
  let view
  try {
    const root = document.querySelector('#level-view'); const canvas = document.querySelector('canvas'); canvas.getBoundingClientRect = () => ({ left: 0, top: 0, right: 900, bottom: 600, width: 900, height: 600 })
    const camera = { zoom: 1, y2x: 1, canvasWidth: 900, canvasHeight: 600, worldToCanvas: p => ({ x: p.x * 10, y: 600 - p.y * 10 }) }
    const surface = { normalCanvas: [canvas], camera }; const hero = { pos: { x: 12, y: 12 } }; const original = JSON.stringify(hero)
    const ink = new Proxy({}, { get: () => () => ink })
    view = new (require('../map-inspector-view'))(root, get(2), surface); view.update(hero, world, ink)
    const selected = hitObject(mapObjects(get(2), hero, world), 240, 480, camera); assert.equal(selected.kind, 'charge')
    canvas.dispatchEvent(new window.MouseEvent('click', { bubbles: true, clientX: 240, clientY: 480 }))
    assert.equal(view.panel.hidden, false); assert.equal(view.selected, 'charge-0'); assert.match(view.panel.textContent, /当前未站在/)
    const insertions = []; root.querySelector('.ace').env = { editor: { getCursorPosition: () => ({ row: 0 }), session: { getLine: () => '' }, moveCursorTo () {}, insert: code => insertions.push(code), focus () {} } }
    view.panel.querySelector('article button').click(); assert.deepEqual(insertions, ['hero.wait()']); assert.equal(view.panel.hidden, true)
    assert.equal(JSON.stringify(hero), original)
    view.open('hero'); events.get('tome:manual-cast')(); assert.equal(view.panel.hidden, true)
    view.destroy(); view = null; assert.equal(events.size, 0)
  } finally { view?.destroy(); for (const k of Object.keys(saved)) { if (saved[k] === undefined) delete global[k]; else global[k] = saved[k] } dom.window.close() }
})
