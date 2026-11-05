// Developer acceptance check: use a disposable TEACHING_STATE_DIR and a loopback server.
// Open all test levels in that disposable classroom before running. Never use live data.
// Server: node -r ./teaching/tools/deny-external.cjs index.js (capture flag unset).
// Browser network is restricted to the test server; disk cache and service workers are disabled.
// PLAYWRIGHT_MODULE / CHROME_EXECUTABLE select an existing development browser installation.
// Optional ONLY=4,7,17,23,25 SUBMIT=true adds real submission checks for these representative levels.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')
const fs = require('fs'); const designs = require('../map-designs')
const fallback = { 1: 'hero.moveUp()\nhero.moveRight(2)\nhero.moveDown()\n', 2: 'hero.moveRight(4)\n', 3: 'hero.moveUp(2)\nhero.moveRight(3)\nhero.moveDown(2)\nhero.moveRight()\n' }
const base = process.argv[2] || 'http://127.0.0.1:7781'
const assert = require('node:assert/strict'); const path = require('node:path')
const address = new URL(base); assert.equal(address.hostname, '127.0.0.1'); assert.ok(address.port && address.port !== '7778', 'Use an isolated server')
const output = path.resolve(process.argv[3] || '/tmp/classroom-offline-check'); fs.mkdirSync(output, { recursive: true })
assert.match(process.env.AUDIT_STUDENT || '99997777', /^9999\d{4,12}$/);
(async () => {
  const browser = await chromium.launch({ ...(process.env.CHROME_EXECUTABLE ? { executablePath: process.env.CHROME_EXECUTABLE } : {}), headless: true }); const results = []; try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, serviceWorkers: 'block' }); const page = await context.newPage(); await context.route('**/*', route => new URL(route.request().url()).origin === base ? route.continue() : route.abort())
    let errors = []; let failed = []; let outside = []; page.on('websocket', socket => { const u = new URL(socket.url()); if (u.hostname !== address.hostname || u.port !== address.port)outside.push(socket.url()) }); page.on('console', message => { if (message.type() === 'error' && /Content Security Policy/.test(message.text()))errors.push(message.text()) }); page.on('pageerror', e => errors.push(e.message)); page.on('response', r => { if (r.status() >= 400)failed.push({ url: new URL(r.url()).pathname, status: r.status() }) }); context.on('request', r => { if (new URL(r.url()).origin !== base)outside.push(r.url()) })
    await page.goto(base + '/teaching'); const token = await page.locator('[name=formToken]').inputValue(); await page.locator('[name=studentId]').fill(process.env.AUDIT_STUDENT || '99997777'); await page.getByRole('button', { name: /进入课堂/ }).click(); await page.waitForURL('**/teaching'); const cdp = await context.newCDPSession(page); await cdp.send('Network.enable'); await cdp.send('Network.setCacheDisabled', { cacheDisabled: true })
    for (const d of designs) {
      if (process.env.ONLY && !process.env.ONLY.split(',').includes(String(d.index))) continue; for (let scene = 0; scene < (d.scenarios?.length || 1); scene++) {
        errors = []; failed = []; outside = []; const slug = 'local-python-' + String(d.index).padStart(2, '0'); const result = { slug, scene }; const start = Date.now(); try {
          await page.goto('about:blank'); await context.request.post(base + '/teaching/scenario', { form: { slug, scene: String(scene), formToken: token } })
          await page.goto(base + '/play/level/' + slug + '?codeLanguage=python'); await page.getByRole('button', { name: '进入关卡', exact: true }).click({ timeout: 60000 }); result.loadMs = Date.now() - start
          await page.waitForTimeout(1500); const skip = page.locator('.ds-guide-skip'); if (await skip.isVisible()) await skip.click()
          const code = d.scenarios?.[scene]?.solution || d.solution || fallback[d.index]; if (!code) throw Error('Missing reference solution'); await page.locator('.ace.coco-view').click(); await page.locator('.ace.coco-view .ace_text-input').focus(); await page.keyboard.press('ControlOrMeta+A'); await page.keyboard.insertText(code)
          await page.evaluate(() => { window.__offlineGoals = null; window.Backbone.Mediator.subscribe('god:goals-calculated', e => { if (!e.preload)window.__offlineGoals = { status: e.overallStatus, goals: e.goalStates } }, window) })
          await page.keyboard.press('Shift+Enter'); await page.waitForFunction(() => window.__offlineGoals !== null, {}, { timeout: 30000 }); result.goals = await page.evaluate(() => window.__offlineGoals); await page.waitForTimeout(800); await page.evaluate(() => window.Backbone.Mediator.publish('level:set-time', { ratio: 1 })); await page.waitForTimeout(800)
          if (process.env.SUBMIT === 'true' && [4, 7, 17, 23, 25].includes(d.index)) { await page.getByRole('button', { name: /^提交/ }).click(); await page.getByText(/本关已完成|本场景已通过|场景已完成|所有场景/).first().waitFor({ timeout: 60000 }); result.submitted = true; await page.screenshot({ path: output + '/verified-' + d.index + '-' + scene + '.png' }) }
        } catch (e) { result.error = e.message; await page.screenshot({ path: output + '/failure-' + d.index + '-' + scene + '.png' }).catch(() => {}) }
        Object.assign(result, { errors, failed, outside }); results.push(result); fs.writeFileSync(path.join(output, (process.env.REPORT || 'scenes') + '.json'), JSON.stringify(results, null, 2)); console.log(JSON.stringify(result))
      }
    }
    const bad = results.filter(r => r.error || r.goals?.status !== 'success' || r.errors.length || r.failed.length || r.outside.length); console.log(JSON.stringify({ scenes: results.length, failed: bad.length })); if (bad.length)process.exitCode = 1
  } finally { await browser.close() }
})().catch(e => { console.error(e.stack); process.exitCode = 1 })
