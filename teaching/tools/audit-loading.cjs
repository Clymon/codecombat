/* Run ONLY against a disposable classroom server with its own TEACHING_STATE_DIR.
 * Usage: node teaching/tools/audit-loading.cjs http://127.0.0.1:7781 /tmp/loading-audit
 * Optional: PLAYWRIGHT_MODULE, CHROME_EXECUTABLE, AUDIT_STUDENT (9999-prefixed test ID).
 * Measures page-target CDP transfers, not worker-internal transfers or server traffic.
 */
const fs = require('node:fs')
const path = require('node:path')
const assert = require('node:assert/strict')
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')
const base = new URL(process.argv[2] || 'http://127.0.0.1:7781')
assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(base.hostname), 'Use an isolated loopback server')
assert.ok(base.port && base.port !== '7778', 'Do not audit the live classroom port')
const student = process.env.AUDIT_STUDENT || '99996667'
assert.match(student, /^9999\d{4,12}$/, 'Use a disposable test student')
const out = path.resolve(process.argv[3] || '/tmp/classroom-loading-audit')
const forbidden = /blockly|stripe\.com|google-analytics|googletagmanager|connect\.facebook|analytics\.log/
function resource (url) {
  const u = new URL(url)
  // Never store query parameters, session IDs, student IDs or auth headers.
  return (u.origin === base.origin ? '' : u.origin) + u.pathname
    .replace(/(\/db\/(?:user|level\.session)\/)[^/]+/, '$1<id>')
}
async function main () {
  fs.mkdirSync(out, { recursive: true })
  const browser = await chromium.launch({ headless: true, ...(process.env.CHROME_EXECUTABLE ? { executablePath: process.env.CHROME_EXECUTABLE } : {}) })
  try {
    const context = await browser.newContext({ viewport: { width: 1280, height: 720 } })
    const page = await context.newPage()
    await page.goto(new URL('/teaching', base).href)
    await page.locator('[name=studentId]').fill(student)
    await page.getByRole('button', { name: /进入课堂/ }).click()
    await page.waitForURL('**/teaching')
    const cdp = await context.newCDPSession(page)
    await cdp.send('Network.enable')
    let rows = new Map()
    cdp.on('Network.requestWillBeSent', e => rows.set(e.requestId, { resource: resource(e.request.url), start: e.timestamp, type: e.type }))
    cdp.on('Network.responseReceived', e => Object.assign(rows.get(e.requestId) || {}, { status: e.response.status, mime: e.response.mimeType, cached: !!(e.response.fromDiskCache || e.response.fromServiceWorker) }))
    cdp.on('Network.loadingFinished', e => {
      const row = rows.get(e.requestId)
      if (row) Object.assign(row, { bytes: e.encodedDataLength, ms: Math.round((e.timestamp - row.start) * 1000) })
    })
    cdp.on('Network.loadingFailed', e => Object.assign(rows.get(e.requestId) || {}, { error: e.errorText }))
    for (const phase of ['cold', 'warm']) {
      rows = new Map()
      await cdp.send('Network.setCacheDisabled', { cacheDisabled: phase === 'cold' })
      const start = Date.now()
      await page.goto(new URL('/play/level/local-python-04?codeLanguage=python', base).href)
      await page.getByRole('button', { name: '进入关卡', exact: true }).waitFor({ timeout: 60000 })
      const readyMs = Date.now() - start
      // The enter button can appear before scenery/character atlases finish.
      await page.waitForTimeout(6000)
      const requests = Array.from(rows.values()).map(({ start, ...row }) => row)
      const report = { phase, readyMs, observationMs: Date.now() - start, settleMs: 6000, bytes: requests.reduce((sum, r) => sum + (r.bytes || 0), 0), requests }
      fs.writeFileSync(path.join(out, phase + '.json'), JSON.stringify(report, null, 2) + '\n')
      await page.screenshot({ path: path.join(out, phase + '.png') })
      console.log(JSON.stringify({ phase, readyMs, requests: requests.length, bytes: report.bytes }))
      assert.deepEqual(requests.filter(r => forbidden.test(r.resource)).map(r => r.resource), [], 'Text classroom must not load payment, trackers or Blockly')
      assert.deepEqual(requests.filter(r => r.error || r.status >= 400).map(r => ({ resource: r.resource, status: r.status, error: r.error })), [], 'Unexpected resource failures')
      await page.goto('about:blank')
    }
  } finally { await browser.close() }
}
main().catch(error => { console.error(error.message); process.exitCode = 1 })
