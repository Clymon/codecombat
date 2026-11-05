const test = require('node:test'); const assert = require('node:assert/strict')
const fs = require('fs'); const os = require('os'); const path = require('path'); const express = require('express')
const designs = require('../map-designs'); const { compareLevels } = require('../curriculum'); const setup = require('../local-levels'); const classroom = require('../classroom-state'); const { nextTask } = require('../continuation')
const levels = designs.map(d => setup.readLevel(`local-python-${String(d.index).padStart(2, '0')}`)).sort(compareLevels)
const slug = index => `local-python-${String(index).padStart(2, '0')}`
test('lesson ordering embeds tutorials while the main route skips optional challenges', () => {
  const formal = levels.filter(l => !l.teachingMap.prototype)
  assert.deepEqual(formal.map(l => l.teachingMap.index), [4, 5, 1, 2, 3, 6, 26, 27, 7, 8, 30, 9, 31, 10, 11, 12, 13, 28, 29, 14, 15, 16, 17, 18, 19, 32, 33, 20, 21])
  const releases = Object.fromEntries(levels.map(l => [l.slug, true]))
  for (const [from, to] of [[6, 26], [26, 7], [27, 7], [8, 30], [30, 9], [9, 31], [31, 10], [13, 28], [28, 29], [29, 14], [19, 32]]) {
    const level = levels.find(l => l.slug === slug(from))
    const session = { state: { complete: true }, codeHash: 'same-code', scenePasses: Object.fromEntries(level.teachingMap.scenarioTitles.map((_, i) => [i, { hash: 'same-code' }])) }
    assert.equal(nextTask(levels, slug(from), session, releases).slug, slug(to), `${from} → ${to}`)
    assert.equal(nextTask(levels, slug(from), session, { ...releases, [slug(to)]: false }).kind, 'waiting')
  }
  for (const d of designs.filter(d => d.tutorial)) {
    const level = levels.find(l => l.teachingMap.index === d.index)
    assert.equal(level.thangs.find(t => t.id === 'Hero Placeholder').components.find(c => c.original === '524b7b517fc0f6d51900000d').config.worldEndsAfter, 42, 'moving into a lesson must not truncate partial tutorial runs')
  }
})
test('teacher and student pages use four lesson groups; original hidden choices and saved code survive', async () => {
  const old = process.env.TEACHING_STATE_DIR; const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'coco-curriculum-')); process.env.TEACHING_STATE_DIR = dir
  const app = express(); setup(app); const server = app.listen(0, '127.0.0.1'); await new Promise(resolve => server.on('listening', resolve)); const base = `http://127.0.0.1:${server.address().port}`
  try {
    assert.ok(designs.filter(d => d.index >= 26).every(d => !classroom.isVisible(slug(d.index))))
    const home = await fetch(base + '/teaching/teacher'); const teacher = await home.text(); let cookie = home.headers.get('set-cookie').split(';')[0]; const token = teacher.match(/name="formToken" value="([0-9a-f]{64})"/)[1]
    assert.doesNotMatch(teacher, /data-select-section="[678]"/)
    for (const section of [1, 2, 3, 4]) assert.match(teacher, new RegExp(`data-select-section="${section}"`))
    for (const [id, section] of [[26, 1], [27, 1], [30, 2], [31, 2], [28, 3], [29, 3], [32, 4], [33, 4]]) assert.match(teacher, new RegExp(`value="${slug(id)}" form="bulk-controls" data-section="${section}"`))
    const post = (route, data) => fetch(base + route, { method: 'POST', redirect: 'manual', headers: { cookie }, body: new URLSearchParams({ formToken: token, ...data }) })
    const login = await post('/teaching/login', { studentId: '99994444' }); cookie += '; ' + login.headers.get('set-cookie').split(';')[0]
    const get = route => fetch(base + route, { headers: { cookie } })
    assert.doesNotMatch(await (await get('/teaching')).text(), /id="local-python-26"/)
    classroom.updateMany(levels.filter(l => !l.teachingMap.prototype).map(l => l.slug), 'open')
    const html = await (await get('/teaching')).text()
    assert.doesNotMatch(html, /chapter-[5678]|独立试玩组|攻击与救援教学|信号台与for教学|观察与守营教学/)
    for (const [section, ids] of [[1, [6, 26, 27]], [2, [8, 30, 9, 31, 10]], [3, [13, 28, 29, 14]], [4, [19, 32, 33, 20]]]) {
      const group = html.split(`aria-labelledby="chapter-title-${section}"`)[1].split('</section>')[0]
      let previous = -1
      for (const id of ids) { const current = group.indexOf(`id="${slug(id)}"`); assert.ok(current > previous, `section ${section}: ${id}`); previous = current }
    }
    require('./progress-fixture.cjs')('99994444', slug(26))
    const session = await (await get('/db/level/local-python-26/session')).json()
    const code = designs.find(d => d.index === 26).solution
    const save = await fetch(base + '/db/level.session/' + session._id, { method: 'PUT', headers: { cookie, 'content-type': 'application/json' }, body: JSON.stringify({ code: { 'hero-placeholder': { plan: code } }, state: { complete: true, teachingVictoryCode: code } }) }); assert.equal(save.status, 200)
    let next = await (await get(`/teaching/continue/local-python-26?sessionId=${session._id}`)).json(); assert.equal(next.slug, slug(7), 'optional challenge stays on a side branch')
    classroom.setVisible(slug(27), false)
    next = await (await get(`/teaching/continue/local-python-26?sessionId=${session._id}`)).json(); assert.equal(next.slug, slug(7), 'hidden challenge is skipped within the integrated route')
    const preserved = await (await get('/db/level/local-python-26/session')).json(); assert.equal(preserved.code['hero-placeholder'].plan, code); assert.equal(preserved.teachingComplete, true)
  } finally { await new Promise(resolve => server.close(resolve)); if (old === undefined) delete process.env.TEACHING_STATE_DIR; else process.env.TEACHING_STATE_DIR = old; fs.rmSync(dir, { recursive: true, force: true }) }
})
