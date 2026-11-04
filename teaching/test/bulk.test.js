const test = require('node:test'); const assert = require('node:assert/strict')
const fs = require('fs'); const os = require('os'); const path = require('path'); const http = require('http'); const { spawnSync } = require('child_process')
const express = require('express'); const classroom = require('../classroom-state'); const setup = require('../local-levels')
const samples = [22, 23, 24, 25].map(n => `local-python-${n}`)
function isolated () {
  const old = process.env.TEACHING_STATE_DIR; const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'coco-bulk-')); process.env.TEACHING_STATE_DIR = dir
  return { dir, restore () { if (old === undefined) delete process.env.TEACHING_STATE_DIR; else process.env.TEACHING_STATE_DIR = old; fs.rmSync(dir, { recursive: true, force: true }) } }
}
test('bulk changes preserve unrelated choices and records, validate before saving, and survive restart', () => {
  const state = isolated(); const file = path.join(state.dir, 'classroom.json')
  try {
    classroom.setUnlocked('local-python-05', true)
    const record = path.join(state.dir, 'existing-progress.json'); fs.writeFileSync(record, '{"code":"saved work"}')
    const before = fs.readFileSync(file, 'utf8')
    for (const [slugs, operation] of [[[], 'hide'], [samples, 'remove'], [[...samples, 'local-python-99'], 'hide']]) {
      assert.throws(() => classroom.updateMany(slugs, operation)); assert.equal(fs.readFileSync(file, 'utf8'), before)
    }
    classroom.updateMany([...samples, samples[0]], 'open')
    for (const slug of samples) { assert.equal(classroom.isVisible(slug), true); assert.equal(classroom.isUnlocked(slug), true) }
    classroom.updateMany(samples, 'show')
    assert.equal(classroom.isUnlocked(samples[0]), true, 'showing an already open card does not close it')
    classroom.updateMany(samples, 'close')
    for (const slug of samples) { assert.equal(classroom.isVisible(slug), true); assert.equal(classroom.isUnlocked(slug), false) }
    classroom.updateMany(samples, 'hide'); classroom.updateMany(samples, 'show')
    for (const slug of samples) { assert.equal(classroom.isVisible(slug), true); assert.equal(classroom.isUnlocked(slug), false) }
    classroom.updateMany(samples, 'hide')
    const fresh = spawnSync(process.execPath, ['-e', `const c=require(${JSON.stringify(path.resolve(__dirname, '../classroom-state'))});console.log(JSON.stringify({visibility:c.visibility(),releases:c.releases()}))`], { env: process.env, encoding: 'utf8' })
    assert.equal(fresh.status, 0, fresh.stderr)
    assert.deepEqual(JSON.parse(fresh.stdout), { visibility: classroom.visibility(), releases: classroom.releases() })
    assert.equal(classroom.isUnlocked('local-python-05'), true)
    assert.equal(fs.readFileSync(record, 'utf8'), '{"code":"saved work"}')
  } finally { state.restore() }
})
test('bulk form accepts a selected group and all 25 levels, rejects invalid or cross-site changes', async () => {
  const state = isolated(); const app = express(); setup(app); const server = app.listen(0, '127.0.0.1'); await new Promise(resolve => server.on('listening', resolve)); const base = `http://127.0.0.1:${server.address().port}`
  try {
    const home = await fetch(base + '/teaching/teacher'); const html = await home.text()
    const cookie = home.headers.get('set-cookie').split(';')[0]; const token = html.match(/name="formToken" value="([0-9a-f]{64})"/)[1]
    assert.match(home.headers.get('content-security-policy'), /script-src 'self'/)
    assert.match(html, new RegExp(`全选 ${require('../map-designs').length} 关`)); assert.match(html, /data-select-section="5"/)
    const post = (slugs, operation, extra = {}, headers = {}) => {
      const body = new URLSearchParams({ formToken: token, operation, ...extra }); for (const slug of slugs) body.append('slugs', slug)
      return fetch(base + '/teaching/teacher/bulk', { method: 'POST', redirect: 'manual', headers: { cookie, ...headers }, body })
    }
    assert.equal((await post(samples, 'open', { formToken: 'bad' })).status, 403)
    assert.equal((await post(samples, 'open', {}, { origin: 'https://other.example' })).status, 403)
    for (const [slugs, operation] of [[[], 'hide'], [[...samples, 'local-python-99'], 'hide'], [samples, 'delete']]) assert.equal((await post(slugs, operation)).status, 400)
    assert.equal(fs.existsSync(path.join(state.dir, 'classroom.json')), false, 'invalid requests must not save partial state')
    for (const route of ['/teaching/teacher/bulk', '/teaching/teacher/controls.js']) {
      const status = await new Promise((resolve, reject) => {
        const req = http.request(base + route, { method: route.endsWith('.js') ? 'GET' : 'POST', headers: { host: 'student.example', cookie, 'content-type': 'application/x-www-form-urlencoded' } }, res => { res.resume(); resolve(res.statusCode) })
        req.on('error', reject); req.end(new URLSearchParams({ formToken: token, operation: 'open', slugs: samples[0] }).toString())
      }); assert.equal(status, 403)
    }
    const script = await fetch(base + '/teaching/teacher/controls.js'); assert.equal(script.status, 200); assert.match(await script.text(), /DOMContentLoaded/)
    const response = await post([...samples, samples[0]], 'open')
    assert.equal(response.status, 303); assert.equal(response.headers.get('location'), '/teaching/teacher?updated=open&count=4#bulk-controls')
    assert.match(await (await fetch(base + response.headers.get('location'))).text(), /已批量开放 4 关/)
    const all = Array.from({ length: require('../map-designs').length }, (_, i) => `local-python-${String(i + 1).padStart(2, '0')}`)
    assert.equal((await post(all, 'hide')).status, 303)
    assert.equal(all.every(slug => !classroom.isVisible(slug) && !classroom.isUnlocked(slug)), true)
    assert.equal((await post([samples[0]], 'show')).status, 303)
    assert.equal(classroom.isVisible(samples[0]), true); assert.equal(classroom.isUnlocked(samples[0]), false)
  } finally { await new Promise(resolve => server.close(resolve)); state.restore() }
})
