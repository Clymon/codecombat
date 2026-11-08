// Native-engine acceptance; use an isolated classroom and disposable test records.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')
const assert = require('node:assert/strict'); const fs = require('node:fs'); const path = require('node:path')
const base = process.argv[2] || 'http://127.0.0.1:7781'; const address = new URL(base)
assert.equal(address.hostname, '127.0.0.1'); assert.notEqual(address.port, '7778')
assert.ok(process.env.TEACHING_STATE_DIR, 'Use the isolated server state directory')
assert.notEqual(path.resolve(process.env.TEACHING_STATE_DIR), path.resolve(__dirname, '../state'))
const student = '99998883'; const slug = 'local-python-02'
require('../classroom-state').updateMany([slug], 'open')
const fixture = require('../test/progress-fixture.cjs')
const cases = [
  ['pass', 'hero.moveRight(4)', false, 0],
  ['one-long-wait', 'hero.moveRight()\nhero.wait(3)\nhero.moveRight(3)', false, 1],
  ['full', Array(3).fill('hero.moveRight()\nhero.wait()').join('\n') + '\nhero.moveRight()', true, 3],
  ['for-loop', 'for step in range(3):\n    hero.moveRight()\n    hero.wait()\nhero.moveRight()', true, 3],
  ['short-loop', 'for step in range(2):\n    hero.moveRight()\n    hero.wait()\nhero.moveRight(2)', false, 2],
  ['skip-middle', 'hero.moveRight()\nhero.wait()\nhero.moveRight(2)\nhero.wait()\nhero.moveRight()', false, 2],
  ['fractional-wait', 'hero.moveRight()\nhero.wait(0.5)\nhero.moveRight(3)', false, 0],
  ['idle-on-plate', 'hero.moveRight()', false, 1],
  ['wait-at-start', 'hero.wait(3)\nhero.moveRight(4)', false, 0],
]
const reports = []
;(async () => {
  const browser = await chromium.launch({ headless: true, ...(process.env.CHROME_EXECUTABLE ? { executablePath: process.env.CHROME_EXECUTABLE } : {}) })
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 950 } })
    let page = await context.newPage(); await page.goto(base + '/teaching')
    await page.locator('[name=studentId]').fill(student); await page.getByRole('button', { name: /进入课堂/ }).click(); fixture(student, slug)
    for (const [label, code, victory, maxLit] of cases.filter(c => !process.env.CHARGE_ONLY || process.env.CHARGE_ONLY.split(',').includes(c[0]))) {
      console.log('Checking ' + label)
      await page.close(); page = await context.newPage()
      await page.goto(`${base}/play/level/${slug}?codeLanguage=python`)
      await page.getByRole('button', { name: '进入关卡', exact: true }).click({ timeout: 60000 }); await page.waitForTimeout(1800)
      for (const s of ['.ds-guide-skip', '.vn-close']) if (await page.locator(s).isVisible()) await page.locator(s).click()
      await page.evaluate(() => {
        window.chargeResult = null; window.chargeWorld = null; window.chargeProblems = []
        Backbone.Mediator.subscribe('god:goals-calculated', e => { if (!e.preload) window.chargeResult = { status: e.overallStatus, goals: e.goalStates } }, window)
        Backbone.Mediator.subscribe('god:new-world-created', e => { window.chargeWorld = e.world }, window)
        for (const k of ['god:user-code-problem', 'god:non-user-code-problem']) Backbone.Mediator.subscribe(k, e => window.chargeProblems.push(e.problem?.message), window)
      })
      await page.locator('.ace.coco-view .ace_text-input').focus(); await page.keyboard.press('ControlOrMeta+A'); await page.keyboard.insertText(code)
      await page.waitForTimeout(300); await page.keyboard.press('Shift+Enter')
      await page.waitForFunction(code => window.chargeResult && window.chargeWorld?.userCodeMap?.['Hero Placeholder']?.plan?.raw?.trim() === code.trim(), code, { timeout: 60000 })
      const result = await page.evaluate(() => {
        const w = window.chargeWorld; const h = w.getThangByID('Hero Placeholder'); const samples = []
        for (const f of w.frames) {
          f.restoreStateForThang(h); const state = JSON.parse(h.teachingCharge || 'null')
          if (state) samples.push({ time: f.time, x: h.pos.x, y: h.pos.y, wait: h.teachingWait, ...state })
        }
        w.frames.at(-1).restoreState()
        return { ...window.chargeResult, samples, final: JSON.parse(h.teachingCharge || 'null'), ready: !!h.teachingExitReady, issue: h.teachingFailure, problems: window.chargeProblems }
      })
      reports.push({ label, ...result }); console.log(JSON.stringify({ label, status: result.status, final: result.final, issue: result.issue }))
      assert.equal(result.problems.length, 0); assert.equal(result.status === 'success', victory, label)
      assert.equal(Math.max(...result.samples.map(s => s.lit)), maxLit, label + ' lit')
      assert.ok(result.samples.some(s => s.plates.some(p => p.elapsed > 0 && p.elapsed < 1)), label + ' must show partial ring')
      assert.equal(result.samples[0].lit, 0, 'a new run starts with all plates dark')
      for (const [index, plate] of result.final.plates.entries()) {
        if (plate.complete) {
          assert.ok(Math.abs(plate.completedAt - plate.startedAt - 1) <= 0.051, label + ' each plate needs one second')
          assert.ok(result.samples.filter(s => s.time > plate.completedAt + 0.05).every(s => s.plates[index].complete), label + ' lit plates stay lit')
        }
      }
      if (label === 'fractional-wait') assert.match(result.issue, /整数/)
      if (label === 'pass') assert.ok(result.final.plates.every(p => p.elapsed === 0 && p.interruptedAt > 0))
      if (label === 'idle-on-plate') { assert.equal(result.ready, false); assert.equal(result.final.plates[0].complete, true) }
      if (label === 'one-long-wait') {
        assert.deepEqual(result.final.plates.map(p => p.complete), [true, false, false])
        const holding = result.samples.filter(s => { const w = JSON.parse(s.wait || 'null'); return w && w.finishedAt == null && s.time > w.startedAt + 0.1 })
        assert.ok(holding.length); assert.ok(holding.every(s => Math.abs(s.x - 24) < 0.1), 'wait must stop residual movement')
      }
      if (label === 'skip-middle') assert.deepEqual(result.final.plates.map(p => p.complete), [true, false, true])
      if (label === 'full') {
        const t = result.samples.find(s => s.plates[0].complete && s.plates[1].elapsed > 0.35 && s.plates[1].elapsed < 0.6).time
        await page.evaluate(time => { Backbone.Mediator.publish('level:set-playing', { playing: false }); Backbone.Mediator.publish('level:set-time', { time, scrubDuration: 0 }) }, t)
        await page.waitForTimeout(600)
        if (await page.locator('.vn-close').isVisible()) await page.locator('.vn-close').click()
        await page.screenshot({ path: '/tmp/charge-mid.png' })
      }
    }
    console.log(`${reports.length} charge cases passed`)
  } finally { fs.writeFileSync('/tmp/charge-browser-results.json', JSON.stringify(reports, null, 2)); await browser.close() }
})().catch(error => { console.error(error); process.exitCode = 1 })
