// Verify actual gameplay with alternative Python forms and missing/wrong interactions.
// Run against a loopback test server with a disposable TEACHING_STATE_DIR.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')
const assert = require('node:assert/strict'); const fs = require('node:fs'); const path = require('node:path')
const base = process.argv[2] || 'http://127.0.0.1:7781'; const output = process.argv[3] || '/tmp/outcome-alternatives'
assert.equal(new URL(base).hostname, '127.0.0.1'); assert.notEqual(new URL(base).port, '7778'); assert.ok(process.env.TEACHING_STATE_DIR)
assert.notEqual(path.resolve(process.env.TEACHING_STATE_DIR), path.resolve(__dirname, '../state'))
fs.mkdirSync(output, { recursive: true })
const rooms = 'hero.moveRight()\n' + Array(3).fill('hero.moveUp(2)\nhero.wait()\nhero.moveDown(2)\nhero.moveRight(2)').join('\n')
const signals = rooms.replaceAll('hero.wait()', 'print("点火")')
const manual = ns => ns.map((n, i) => `hero.moveRight(${i ? n - ns[i - 1] : n})\nhero.press(${n})`).join('\n')
const cases = [
  ['branches-without-if-open', 9, 0, 'pathOpen("right") and hero.moveRight()\npathOpen("right") and hero.moveLeft()\nhero.moveDown()', true],
  ['branches-without-if-closed', 9, 1, 'pathOpen("right") and hero.moveRight()\npathOpen("right") and hero.moveLeft()\nhero.moveDown()', true],
  ['rooms-unrolled', 13, 0, rooms, true, true],
  ['rooms-main-corridor-only', 13, 0, 'hero.moveRight(7)', false],
  ['switches-unrolled', 14, 0, Array(8).fill('x = 0').join('\n') + '\n' + manual([1, 2, 3]), true, true],
  ['switches-no-press', 14, 0, 'hero.moveRight(3)', false],
  ['switches-short-circuit', 15, 0, 'hero.moveRight()\nhero.press(1)', false],
  ['switches-even-unrolled', 15, 0, manual([2, 4, 6]), true],
  ['delivery-unrolled-short', 16, 0, 'hero.take("补给箱")\n' + Array(2).fill('hero.moveRight()\nhero.give("炉座", 1)').join('\n'), true],
  ['delivery-unrolled-too-short', 16, 1, 'hero.take("补给箱")\n' + Array(2).fill('hero.moveRight()\nhero.give("炉座", 1)').join('\n'), false],
  ['delivery-for-instead-of-while-no-speech', 17, 0, 'count = hero.take("补给箱")\nfor i in range(count):\n    hero.moveRight()\n    hero.give("炉座", 1)', true],
  ['empty-box-check-only', 18, 1, 'hero.take("补给箱")', true],
  ['empty-box-skipped', 18, 1, '# 没有打开箱子', false],
  ['beacon-for-instead-of-while', 19, 0, 'for i in range(2):\n    hero.wait()\n    hero.moveRight()', true],
  ['beacon-same-code-long-route', 19, 1, 'for i in range(2):\n    hero.wait()\n    hero.moveRight()', false],
  ['beacon-no-charging', 19, 0, 'hero.moveRight(2)', false],
  ['patrol-without-wait', 20, 0, 'while not hero.atBeacon():\n    if nextTileSafe():\n        hero.moveRight()', true],
  ['gate-and-charging-route', 21, 0, 'hero.moveRight()\nprint("自己人")\nhero.moveRight(2)\nfor i in range(2):\n    hero.moveUp()\n    hero.wait()', true],
  ['signals-unrolled', 29, 0, signals, true],
  ['named-target-accepted', 30, 0, 'hero.moveRight()\nhero.attack("落单斥候")\nhero.moveRight(2)', true],
  ['named-target-changed', 30, 1, 'hero.moveRight()\nhero.attack("落单斥候")\nhero.moveRight(2)', false],
  ['enemy-short-circuit', 31, 0, 'hero.moveRight()\nenemy = hero.findNearestEnemy()\nenemy and hero.attack(enemy)\nhero.moveRight(2)', true],
  ['empty-short-circuit', 31, 1, 'hero.moveRight()\nenemy = hero.findNearestEnemy()\nenemy and hero.attack(enemy)\nhero.moveRight(2)', true],
  ['late-enemy-without-query', 32, 0, 'hero.wait(4)\nhero.attack("迟到的斥候")', true],
  ['defense-without-victory-query', 25, 0, 'while True:\n    enemy = hero.findNearestEnemy()\n    if not enemy:\n        continue\n    hero.attack(enemy)', true],
]
;(async () => {
  const browser = await chromium.launch({ headless: true, ...(process.env.CHROME_EXECUTABLE ? { executablePath: process.env.CHROME_EXECUTABLE } : {}) }); const results = []
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 950 } }); const page = await context.newPage()
    await context.route('**/*', r => new URL(r.request().url()).origin === base ? r.continue() : r.abort())
    await page.goto(base + '/teaching'); const token = await page.locator('[name=formToken]').inputValue(); await page.locator('[name=studentId]').fill('99997782'); await page.getByRole('button', { name: /进入课堂/ }).click()
    for (const [name, index, scene, code, expected, submit] of cases.filter(c => !process.env.CASES || process.env.CASES.split(',').includes(c[0]))) {
      const result = { name, index, scene, expected }; const errors = []; const onError = e => errors.push(e.stack); page.on('pageerror', onError)
      try {
        const slug = 'local-python-' + String(index).padStart(2, '0')
        await page.goto('about:blank'); require('../test/progress-fixture.cjs')('99997782', slug); await context.request.post(base + '/teaching/scenario', { form: { slug, scene: String(scene), formToken: token } })
        await page.goto(base + '/play/level/' + slug + '?codeLanguage=python'); await page.getByRole('button', { name: '进入关卡', exact: true }).click({ timeout: 60000 }); await page.waitForTimeout(1800)
        for (const sel of ['.ds-guide-skip', '.vn-close']) if (await page.locator(sel).isVisible()) await page.locator(sel).click()
        await page.evaluate(() => { window.outcomeResult = null; window.outcomeWorld = null; Backbone.Mediator.subscribe('god:goals-calculated', e => { if (!e.preload) window.outcomeResult = { status: e.overallStatus, goals: e.goalStates } }, window); Backbone.Mediator.subscribe('god:new-world-created', e => { window.outcomeWorld = e.world }, window) })
        await page.locator('.ace.coco-view .ace_text-input').focus(); await page.keyboard.press('ControlOrMeta+A'); await page.keyboard.insertText(code); await page.waitForTimeout(300); await page.keyboard.press('Shift+Enter')
        await page.waitForFunction(code => window.outcomeResult && window.outcomeWorld?.userCodeMap?.['Hero Placeholder']?.plan?.raw?.trim() === code.trim(), code, { timeout: 45000 })
        result.actual = await page.evaluate(() => { const w = window.outcomeWorld; w.frames.at(-1).restoreState(); const h = w.getThangByID('Hero Placeholder'); return { ...window.outcomeResult, message: h.teachingFailure || '', charge: h.teachingCharge || '', inventory: h.teachingInventory || '' } })
        assert.equal(result.actual.status === 'success', expected)
        assert.doesNotMatch(result.actual.message, /最多.*行|必须.*(?:for|while)|请使用.*循环|放进.*循环.*不能/)
        await page.evaluate(() => Backbone.Mediator.publish('level:set-time', { ratio: 1 })); await page.waitForTimeout(600)
        if (submit) { await page.getByRole('button', { name: /^提交/ }).click(); await page.getByText(/本关已完成|本场景已通过|场景已完成|所有场景/).first().waitFor({ timeout: 60000 }); result.submitted = true }
        if ([13, 15, 19, 32].includes(index)) await page.screenshot({ path: path.join(output, name + '.png') })
      } catch (e) { result.error = e.stack; await page.screenshot({ path: path.join(output, name + '-error.png') }).catch(() => {}) }
      result.errors = errors; results.push(result); page.off('pageerror', onError); fs.writeFileSync(path.join(output, 'results.json'), JSON.stringify(results, null, 2)); console.log(JSON.stringify(result))
    }
    const failed = results.filter(r => r.error || r.errors.length).length; console.log(JSON.stringify({ cases: results.length, failed })); if (failed) process.exitCode = 1
  } finally { await browser.close() }
})().catch(e => { console.error(e.stack); process.exitCode = 1 })
