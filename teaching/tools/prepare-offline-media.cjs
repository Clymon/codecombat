// After visiting all classroom levels with TEACHING_CAPTURE_RESOURCES=true,
// include alternate/random sounds referenced by the frozen public type metadata.
const fs = require('node:fs')
const path = require('node:path')
const zlib = require('node:zlib')
const assert = require('node:assert/strict')
const base = new URL(process.argv[2] || 'http://127.0.0.1:7781')
assert.equal(base.hostname, '127.0.0.1')
assert.notEqual(base.port, '7778')
const root = path.resolve(__dirname, '..')
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'vendor/manifest.json')))
const aliases = require('../offline-media-aliases.json')
const wanted = new Set()
function scan (value) {
  if (typeof value === 'string' && /^db\/thang\.type\/.*\.(mp3|ogg|png|jpg|jpeg|webp|svg)$/.test(value)) wanted.add('/file/' + value)
  else if (value && typeof value === 'object') for (const child of Object.values(value)) scan(child)
}
for (const [key, entry] of Object.entries(manifest.resources)) {
  if (key.startsWith('/db/thang.type/') && !key.startsWith('/db/thang.type/names')) {
    scan(JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(root, 'vendor/blobs', entry.hash + '.gz')))))
  }
}
const names = new Set(['full-screen-start', 'full-screen-end', 'goals-expand', 'goals-collapse', 'coin_1', 'victory', 'level_loaded', 'game-menu-open', 'game-menu-close', 'menu-button-click', 'playback-play', 'playback-pause', 'playback-scrub-start', 'playback-scrub-end', 'real-time-playback-start', 'real-time-playback-end', 'loading-view-unveil', 'cast', 'cast-end', 'error_appear', 'spell-palette-entry-pin', 'spell-palette-entry-unpin'])
for (let i = 0; i < 4; i++) names.add('spell-palette-entry-open-' + i)
for (let i = 1; i <= 2; i++) names.add('ident_' + i)
for (let i = 0; i < 3; i++) names.add('playback-scrub-slide-forward-' + i)
for (const name of names) for (const ext of ['mp3', 'ogg']) wanted.add(`/file/interface/${name}.${ext}`)
for (const name of ['music-menu', 'music_real_time_0', 'music_real_time_1', 'music_real_time_2']) for (const ext of ['mp3', 'ogg']) wanted.add(`/file/music/${name}.${ext}`)
const queue = [...new Set([...wanted].map(resource => aliases[resource] || resource))].filter(resource => !manifest.resources[resource] && !fs.existsSync(path.join(root, '../public_coco', resource)))
async function main () {
  const errors = []
  await Promise.all(Array.from({ length: 6 }, async () => {
    while (queue.length) {
      const resource = queue.shift()
      try {
        const response = await fetch(new URL(resource, base), { signal: AbortSignal.timeout(30000) })
        if (!response.ok) throw Error('HTTP ' + response.status)
        await response.arrayBuffer()
      } catch (error) { errors.push({ resource, error: error.message }) }
    }
  }))
  console.log(JSON.stringify({ referenced: wanted.size, errors }, null, 2))
  if (errors.length) process.exitCode = 1
}
main().catch(error => { console.error(error.message); process.exitCode = 1 })
