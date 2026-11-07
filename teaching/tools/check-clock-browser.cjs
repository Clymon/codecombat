// Run against a disposable loopback classroom, never the teaching database.
// TEACHING_STATE_DIR must match that server. PLAYWRIGHT_MODULE and CHROME_EXECUTABLE
// may point to an existing Playwright installation and browser.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')
const assert = require('node:assert/strict'); const fs = require('node:fs'); const path = require('node:path')
const base = process.argv[2] || 'http://127.0.0.1:7781'; const address = new URL(base)
assert.equal(address.hostname, '127.0.0.1'); assert.notEqual(address.port, '7778')
assert.ok(process.env.TEACHING_STATE_DIR, 'Use the isolated server state directory')
assert.notEqual(path.resolve(process.env.TEACHING_STATE_DIR), path.resolve(__dirname, '../state'))
const designs = require('../map-designs'); const fixture = require('../test/progress-fixture.cjs')
const student = '99998884'
require('../classroom-state').updateMany(designs.map(d => `local-python-${String(d.index).padStart(2, '0')}`), 'open')
const poll = 'while not hero.isVictory():\n    enemy = hero.findNearestEnemy()\n    if enemy:\n        hero.attack(enemy)\n'
const cases = [
  ...[25, 33].flatMap(index => [0, 1].map(scene => ({ index, scene, label: `${index}-${scene}-poll`, code: poll, victory: true }))),
  { index: 25, scene: 0, label: 'explicit-wait', code: poll + '    else:\n        hero.wait(1)\n', victory: true },
  { index: 25, scene: 0, label: 'zero-wait', code: poll + '    else:\n        hero.wait(0)\n', victory: true },
  { index: 25, scene: 0, label: 'idle-spawns', code: 'pass', victory: false },
  { index: 25, scene: 0, label: 'empty-loop-spawns', code: 'while True:\n    pass', victory: false },
  ...[1, 3].map(seconds => ({ index: 32, scene: 0, label: `wait-${seconds}`, code: `print(hero.isVictory())\nhero.wait(${seconds})\nenemy = hero.findNearestEnemy()\nif enemy:\n    hero.attack(enemy)`, victory: true })),
]
const reports = []
;(async () => {
  const browser = await chromium.launch({ headless: true, ...(process.env.CHROME_EXECUTABLE ? { executablePath: process.env.CHROME_EXECUTABLE } : {}) })
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 950 } })
    let page = await context.newPage(); await page.goto(base + '/teaching')
    await page.locator('[name=studentId]').fill(student); await page.getByRole('button', { name: /进入课堂/ }).click()
    for (const c of cases.filter(c => !process.env.CLOCK_ONLY || process.env.CLOCK_ONLY.split(',').includes(c.label))) {
      console.log('Checking ' + c.label)
      await page.close(); page = await context.newPage()
      const slug = `local-python-${String(c.index).padStart(2, '0')}`; fixture(student, slug)
      const html = await (await page.request.get(base + '/teaching')).text()
      const formToken = html.match(/name="formToken" value="([0-9a-f]{64})"/)[1]
      const res = await page.request.post(base + '/teaching/scenario', { form: { formToken, slug, scene: String(c.scene) } }); assert.ok(res.ok())
      await page.goto(`${base}/play/level/${slug}?codeLanguage=python`)
      await page.getByRole('button', { name: '进入关卡', exact: true }).click({ timeout: 60000 })
      await page.waitForTimeout(2200)
      for (const selector of ['.ds-guide-skip', '.vn-close']) if (await page.locator(selector).isVisible()) await page.locator(selector).click()
      const code = c.code + '\n# clock regression ' + Date.now()
      await page.evaluate(() => {
        window.clockResult = null; window.clockWorld = null; window.clockProblems = []
        Backbone.Mediator.subscribe('god:goals-calculated', e => { if (!e.preload) window.clockResult = { status: e.overallStatus, goals: e.goalStates } }, window)
        Backbone.Mediator.subscribe('god:new-world-created', e => { window.clockWorld = e.world }, window)
        for (const kind of ['god:user-code-problem', 'god:non-user-code-problem']) Backbone.Mediator.subscribe(kind, e => window.clockProblems.push(e.problem?.message), window)
      })
      await page.locator('.ace.coco-view .ace_text-input').focus(); await page.keyboard.press('ControlOrMeta+A'); await page.keyboard.insertText(code)
      await page.waitForTimeout(350); await page.keyboard.press('Shift+Enter')
      await page.waitForFunction(expected => window.clockResult && window.clockWorld?.userCodeMap?.['Hero Placeholder']?.plan?.raw?.trim() === expected.trim(), code, { timeout: 60000 })
      const result = await page.evaluate(() => {
        const w = window.clockWorld; const hero = w.getThangByID('Hero Placeholder'); const frames = w.frames
        const spawns = {}
        for (const f of frames) {
          f.restoreStateForThang(hero)
          for (const a of JSON.parse(hero.teachingAdventure || '{}').actors || []) if (a.active && spawns[a.id] == null) spawns[a.id] = f.time
        }
        frames.at(-1).restoreState()
        return { ...window.clockResult, age: frames.at(-1).time, health: hero.health, issue: hero.teachingFailure, problems: window.clockProblems, spawns, wait: JSON.parse(hero.teachingWait || 'null'), adventure: JSON.parse(hero.teachingAdventure || '{}') }
      })
      reports.push({ label: c.label, ...result }); console.log(JSON.stringify(reports.at(-1)))
      assert.equal(result.problems.length, 0, c.label + ': interpreter must not freeze')
      assert.equal(result.status === 'success', c.victory, c.label + ': wrong outcome')
      const d = designs.find(d => d.index === c.index); const scene = d.scenarios?.[c.scene] || d
      for (const actor of scene.adventure.actors) assert.ok(Math.abs(result.spawns[actor.id] - actor.spawnAt) <= 0.11, `${c.label}: ${actor.id} must spawn on schedule, without depending on hero actions`)
      if (c.victory) { assert.equal(result.adventure.complete, true); assert.ok(result.adventure.actors.filter(a => a.kind === 'enemy').every(a => !a.alive)) }
    }
    for (const r of reports.filter(r => /^wait-\d/.test(r.label))) {
      assert.ok(Math.abs(r.wait.finishedAt - r.wait.startedAt - r.wait.seconds) <= 0.051, r.label + ': wait duration must match simulated time')
    }
  } finally {
    fs.writeFileSync('/tmp/classroom-clock-results.json', JSON.stringify(reports, null, 2)); await browser.close()
  }
})().catch(error => { console.error(error); process.exitCode = 1 })
