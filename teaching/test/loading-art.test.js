const test = require('node:test')
const assert = require('node:assert/strict')
const { JSDOM } = require('jsdom')
const { art, fallback, chooseArt, selectLoadingArt, bindArtFallback, storageKey } = require('../loading-art')

test('all four loading scenes are reachable, excluding the immediately previous scene', () => {
  assert.equal(art.length, 4)
  assert.equal(new Set(art.map(a => a.src)).size, 4)
  for (const previous of [null, 'old-scene', ...art.map(a => a.id)]) {
    const reached = new Set(Array.from({ length: 120 }, (_, i) => chooseArt(previous, () => i / 120).id))
    assert.equal(reached.has(previous), false)
    assert.equal(reached.size, art.some(a => a.id === previous) ? 3 : 4)
  }
})

test('a new loading screen remembers the last image, without storing anything in student progress', () => {
  const saved = global.sessionStorage
  const data = new Map([[storageKey, 'gate']])
  global.sessionStorage = { getItem: key => data.get(key), setItem: (key, value) => data.set(key, value) }
  try {
    let previous = 'gate'
    for (let i = 0; i < 30; i++) {
      const image = selectLoadingArt()
      assert.notEqual(image.id, previous)
      assert.equal(data.get(storageKey), image.id)
      previous = image.id
    }
    assert.equal(data.size, 1)
  } finally { if (saved === undefined) delete global.sessionStorage; else global.sessionStorage = saved }
})

test('loading still works and avoids repeats when browser storage is unavailable', () => {
  const saved = global.sessionStorage
  global.sessionStorage = { getItem: () => { throw Error('blocked') }, setItem: () => { throw Error('blocked') } }
  try {
    const first = selectLoadingArt(); const second = selectLoadingArt()
    assert.ok(art.includes(first)); assert.ok(art.includes(second)); assert.notEqual(first.id, second.id)
  } finally { if (saved === undefined) delete global.sessionStorage; else global.sessionStorage = saved }
})

test('a failed image falls back once and does not block or loop when both files fail', () => {
  const dom = new JSDOM('<img src="/missing.jpg"><button>进入关卡</button>')
  const image = dom.window.document.querySelector('img')
  const dispose = bindArtFallback(image)
  image.dispatchEvent(new dom.window.Event('error'))
  assert.equal(image.getAttribute('src'), fallback)
  image.dispatchEvent(new dom.window.Event('error'))
  assert.equal(image.style.visibility, 'hidden')
  assert.equal(dom.window.document.querySelector('button').disabled, false)
  dispose(); image.src = '/other.jpg'; image.style.visibility = 'visible'
  image.dispatchEvent(new dom.window.Event('error'))
  assert.equal(image.getAttribute('src'), '/other.jpg'); assert.equal(image.style.visibility, 'visible')
  dom.window.close()
})
