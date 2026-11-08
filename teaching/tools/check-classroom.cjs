// Read-only deployment check. Run on the classroom server; never writes student data.
const os = require('node:os')
const { execFileSync } = require('node:child_process')
const path = require('node:path')
const base = process.argv[2]
console.log(JSON.stringify({ cpuCores: os.cpus().length, memoryGiB: Math.round(os.totalmem() / 2 ** 30), node: process.version, standaloneDefault: process.env.TEACHING_OFFLINE !== 'false', compressionConfiguredInThisShell: process.env.TEACHING_OFFLINE !== 'false' || !!process.env.COCO_FORCE_COMPRESSION || process.env.COCO_PROXY === 'true' }))
try {
  execFileSync(process.env.TEACHING_PYTHON || 'python3', ['-X', 'utf8', path.join(__dirname, 'check-learning.py'), '7'], { input: '# 中文\nstones=hero.take("补给箱")\nhero.give("出口机关",stones)\n', encoding: 'utf8', timeout: 10000, stdio: ['pipe', 'pipe', 'pipe'] })
  console.log('Python 校验：通过')
} catch (e) { console.log('Python 校验：失败', e.code || e.status, '请检查 TEACHING_PYTHON、Python 3 和脚本文件是否完整。'); process.exitCode = 1 }
async function request (url) {
  const start = Date.now()
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(20000), headers: { 'Accept-Encoding': 'gzip' } })
    const body = await res.arrayBuffer()
    return { status: res.status, ms: Date.now() - start, bytes: body.byteLength, encoding: res.headers.get('content-encoding') || 'none' }
  } catch { return { status: 0, ms: Date.now() - start } }
}
;(async () => {
  if (process.env.TEACHING_OFFLINE === 'false') {
    const upstream = process.env.COCO_PROXY_TARGET || 'https://direct.staging.codecombat.com'
    console.log('开发代理模式官网连通性:', await request(upstream))
  } else {
    console.log('独立课堂模式：不探测官网，检查本地资源包。')
    const fs = require('node:fs')
    const crypto = require('node:crypto')
    const zlib = require('node:zlib')
    const root = path.join(__dirname, '../vendor')
    const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json')))
    for (const [url, entry] of Object.entries(manifest.resources)) {
      const body = zlib.gunzipSync(fs.readFileSync(path.join(root, 'blobs', entry.hash + '.gz')))
      if (crypto.createHash('sha256').update(body).digest('hex') !== entry.hash) throw Error('资源校验失败: ' + url)
    }
    console.log('资源包完整性：通过，共', Object.keys(manifest.resources).length, '条资源映射')
  }
  if (!base) { console.log('可追加服务网址，测40个并发静态资源请求：node teaching/tools/check-classroom.cjs http://服务器地址:7778'); return }
  const asset = new URL('/teaching/assets/scenery/village-loading-gate-v2.jpg', base)
  const results = await Promise.all(Array.from({ length: 40 }, () => request(asset)))
  const times = results.map(r => r.ms).sort((a, b) => a - b)
  console.log('40个同时加载的静态请求:', { successes: results.filter(r => r.status === 200).length, failures: results.filter(r => r.status !== 200).length, p95Ms: times[37], slowestMs: times[39] })
  if (results.some(r => r.status !== 200)) process.exitCode = 1
  console.log('入口页面压缩:', await request(new URL('/teaching', base)))
})().catch(error => { console.error('课堂检查失败:', error.message); process.exitCode = 1 })
