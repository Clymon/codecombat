const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const vm = require('node:vm')
const crypto = require('node:crypto')
const zlib = require('node:zlib')
const express = require('express')
const resources = require('../offline-resources')

test('resource identity preserves projections but excludes cache busters and private APIs', () => {
  assert.equal(resources.key('/db/thang.type/a?_=123&project=name&cacheEdge=true'), '/db/thang.type/a?project=name')
  assert.equal(resources.key('https://other.invalid/file/x'), null)
  for (const value of ['/auth/whoami', '/user-data', '/db/user/123', '/db/level.session/123', '/db/level/official', '/teaching/login']) assert.equal(resources.allowed(value), false)
  assert.equal(resources.allowed('/db/level.component/123/version/0'), true)
})

test('bundled resources are complete, content-addressed and restricted to public engine/art', () => {
  const root = path.join(__dirname, '../vendor')
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json')))
  assert.ok(Object.keys(manifest.resources).length > 30)
  for (const [alias, target] of Object.entries(require('../offline-media-aliases.json'))) {
    assert.ok(resources.allowed(alias))
    assert.ok(manifest.resources[target], target)
    assert.equal(path.extname(alias), path.extname(target), 'fallback keeps the supported audio format')
  }
  for (const [key, entry] of Object.entries(manifest.resources)) {
    assert.ok(resources.allowed(key), key)
    assert.match(entry.hash, /^[a-f0-9]{64}$/)
    assert.equal(new URL(entry.source).origin, 'https://direct.staging.codecombat.com')
    const body = zlib.gunzipSync(fs.readFileSync(path.join(root, 'blobs', entry.hash + '.gz')))
    assert.equal(body.length, entry.bytes, key)
    assert.equal(crypto.createHash('sha256').update(body).digest('hex'), entry.hash, key)
  }
})

test('local bootstrap, preferences and missing resources never fall through to upstream', async () => {
  const oldState = process.env.TEACHING_STATE_DIR
  const oldMode = process.env.TEACHING_OFFLINE
  const oldCapture = process.env.TEACHING_CAPTURE_RESOURCES
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'offline-classroom-'))
  process.env.TEACHING_STATE_DIR = dir
  delete process.env.TEACHING_OFFLINE; delete process.env.TEACHING_CAPTURE_RESOURCES
  const app = express()
  require('../local-levels')(app)
  require('../local-platform')(app)
  app.use(resources.middleware)
  let upstream = 0
  app.use((req, res) => { upstream++; res.sendStatus(599) })
  const server = app.listen(0, '127.0.0.1')
  await new Promise(resolve => server.on('listening', resolve))
  const base = `http://127.0.0.1:${server.address().port}`
  try {
    assert.equal((await fetch(base + '/user-data')).status, 401)
    const home = await fetch(base + '/teaching')
    const html = await home.text()
    const formCookie = home.headers.get('set-cookie').split(';')[0]
    const token = html.match(/name="formToken" value="([a-f0-9]{64})"/)[1]
    const login = await fetch(base + '/teaching/login', { method: 'POST', redirect: 'manual', headers: { cookie: formCookie }, body: new URLSearchParams({ studentId: '99998888', formToken: token }) })
    const cookie = formCookie + '; ' + login.headers.get('set-cookie').split(';')[0]
    const get = url => fetch(base + url, { headers: { cookie } })
    const boot = await get('/user-data')
    assert.equal(boot.headers.get('cache-control'), 'no-store')
    const sandbox = { window: {} }
    vm.runInNewContext(await boot.text(), sandbox)
    const user = sandbox.window.userObject
    assert.match(user._id, /^[a-f0-9]{24}$/)
    assert.equal(user.preferredLanguage, 'zh-HANS')
    assert.equal((await (await get('/auth/whoami')).json())._id, user._id)
    assert.equal((await get('/db/user/another')).status, 403)
    const patch = await fetch(base + '/db/user/' + user._id, { method: 'PUT', headers: { cookie, 'content-type': 'application/json' }, body: JSON.stringify({ volume: 0, permissions: ['admin'], earned: { gems: 9999 } }) })
    assert.equal(patch.status, 200)
    const saved = await (await get('/auth/whoami')).json()
    assert.equal(saved.volume, 0); assert.deepEqual(saved.permissions, []); assert.equal(saved.earned.gems, 0)
    assert.deepEqual(await (await get('/db/achievement?related=anything')).json(), [])
    for (const url of ['/db/user/another/private', '/file/missing-test-resource.png', '/not-provided']) {
      const response = await get(url)
      assert.equal(response.status, 404)
      assert.match((await response.json()).message, /本地课堂/)
    }
    const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, '../vendor/manifest.json')))
    const resource = Object.keys(manifest.resources)[0]
    const served = await get(resource)
    assert.equal(served.status, 200)
    assert.equal(served.headers.get('x-teaching-resource'), manifest.resources[resource].hash)
    const ids = ['529e7aecc423d4e83b000004', '52aa3b9eccbd588d4d000003', '52aa608b20fccb0000000005', '53fa25f25bc220000052c2be']
    for (const ordered of [ids, [...ids].reverse()]) {
      const response = await get('/db/thang.type/names?' + ordered.map(id => 'ids%5B%5D=' + id).join('&'))
      assert.equal(response.status, 200)
      const records = await response.json()
      assert.deepEqual(records.map(r => r.original).sort(), [...ids].sort())
      assert.ok(records.every(r => r.name && r.components))
    }
    assert.equal((await get('/db/thang.type/names?ids%5B%5D=000000000000000000000000')).status, 404)
    assert.equal(upstream, 0)
  } finally {
    await new Promise(resolve => server.close(resolve))
    for (const [key, value] of Object.entries({ TEACHING_STATE_DIR: oldState, TEACHING_OFFLINE: oldMode, TEACHING_CAPTURE_RESOURCES: oldCapture })) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value
    }
    fs.rmSync(dir, { recursive: true, force: true })
  }
})
