const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('fs'); const os = require('os'); const path = require('path'); const express = require('express')
const cast = require('../story-cast'); const hero = require('../hero-types'); const setup = require('../local-levels'); const classroom = require('../classroom-state'); const accounts = require('../student-accounts')

test('starter village permits only DeepSeek and only Liang as named mentor, without changing game mechanics', () => {
  assert.deepEqual(cast.heroes.filter(h => h.unlocked).map(h => h.id), ['deepseek'])
  assert.deepEqual(cast.npcs.filter(n => n.active).map(n => n.id), ['liang-wenfeng'])
  assert.deepEqual(hero.deepseekType().components, require('../common/knight.json').components)
  for (const file of fs.readdirSync(path.join(__dirname, '../levels')).filter(f => /^local-python-\d+.json$/.test(f))) {
    const original = JSON.parse(fs.readFileSync(path.join(__dirname, '../levels', file)))
    const served = setup.readLevel(original.slug)
    assert.equal(served.teachingMap.revision, original.teachingMap.revision)
    assert.deepEqual(served.systems, original.systems)
    assert.deepEqual(served.goals, original.goals)
    assert.deepEqual(served.thangs.map(t => t.components), original.thangs.map(t => t.components))
    assert.equal(served.thangs.find(t => t.id === 'Hero Placeholder').thangType, hero.DEEPSEEK_TYPE)
    if (served.teachingMap.section <= 4) {
      assert.equal(served.teachingMap.world.chapterName, '新手村')
      assert.equal(served.teachingMap.world.heroId, 'deepseek')
      if (served.teachingMap.mentor) assert.equal(served.teachingMap.mentor.id, 'liang-wenfeng')
    }
  }
})

test('query/profile/session hero choices cannot unlock a character or overwrite existing progress', async () => {
  const old = process.env.TEACHING_STATE_DIR; const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'coco-village-')); process.env.TEACHING_STATE_DIR = dir
  const app = express(); setup(app); const server = app.listen(0, '127.0.0.1'); await new Promise(resolve => server.on('listening', resolve)); const base = `http://127.0.0.1:${server.address().port}`
  try {
    classroom.setUnlocked('local-python-04', true)
    const first = await fetch(base + '/teaching'); const html = await first.text(); let cookie = first.headers.get('set-cookie').split(';')[0]; const token = html.match(/name="formToken" value="([0-9a-f]{64})"/)[1]
    const login = await fetch(base + '/teaching/login', { method: 'POST', redirect: 'manual', headers: { cookie }, body: new URLSearchParams({ studentId: '99996666', formToken: token, hero: 'gpt' }) }); cookie += '; ' + login.headers.get('set-cookie').split(';')[0]
    const get = route => fetch(base + route, { headers: { cookie } })
    const session = await (await get('/db/level/local-python-04/session')).json()
    const code = 'hero.moveRight()\nhero.moveRight()\n'
    const save = await fetch(base + '/db/level.session/' + session._id, { method: 'PUT', headers: { cookie, 'content-type': 'application/json' }, body: JSON.stringify({ code: { 'hero-placeholder': { plan: code } }, heroConfig: { thangType: 'gpt' } }) }); assert.equal(save.status, 200)
    const level = await (await get('/db/level/local-python-04?hero=gpt&avatar=claude')).json()
    assert.equal(level.thangs.find(t => t.id === 'Hero Placeholder').thangType, hero.DEEPSEEK_TYPE)
    assert.equal(accounts.readProgress('99996666')['local-python-04'].code['hero-placeholder'].plan, code)
    assert.equal(accounts.readProgress('99996666')['local-python-04'].heroConfig, undefined)
    const page = await (await get('/teaching')).text(); assert.match(page, /第一章：新手村/); assert.equal((page.match(/<strong>待解锁<\/strong>/g) || []).length, 9)
    for (const url of [`/db/thang.type/${hero.DEEPSEEK_TYPE}/version`, '/teaching/assets/characters/deepseek.png', '/teaching/assets/characters/liang-wenfeng.png', '/file/teaching/deepseek-icon.png']) assert.equal((await get(url)).status, 200)
  } finally { await new Promise(resolve => server.close(resolve)); if (old === undefined) delete process.env.TEACHING_STATE_DIR; else process.env.TEACHING_STATE_DIR = old; fs.rmSync(dir, { recursive: true, force: true }) }
})
