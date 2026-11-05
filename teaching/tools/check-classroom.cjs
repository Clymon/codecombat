// Read-only deployment check. Run on the classroom server; never writes student data.
const os = require('node:os')
const { execFileSync } = require('node:child_process')
const path = require('node:path')
const base = process.argv[2]
console.log(JSON.stringify({ cpuCores: os.cpus().length, memoryGiB: Math.round(os.totalmem() / 2 ** 30), node: process.version, compressionConfiguredInThisShell: !!process.env.COCO_FORCE_COMPRESSION || process.env.COCO_PROXY === 'true' }))
try {
  execFileSync(process.env.TEACHING_PYTHON || 'python3', ['-X', 'utf8', path.join(__dirname, 'check-learning.py'), '7'], { input: '# 中文\nsteps=2\nhero.moveRight(steps)\n', encoding: 'utf8', timeout: 10000, stdio: ['pipe', 'pipe', 'pipe'] })
  console.log('Python 校验：通过')
} catch (e) { console.log('Python 校验：失败', e.code || e.status, '请检查 TEACHING_PYTHON、Python 3 和脚本文件是否完整。') }
async function request (url) {
  const start = Date.now()
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(20000), headers: { 'Accept-Encoding': 'gzip' } })
    const body = await res.arrayBuffer()
    return { status: res.status, ms: Date.now() - start, bytes: body.byteLength, encoding: res.headers.get('content-encoding') || 'none' }
  } catch { return { status: 0, ms: Date.now() - start } }
}
;(async () => {
  const upstream = process.env.COCO_PROXY_TARGET || 'https://codecombat.com'
  console.log('官网连通性（仅首页，不能代表全部素材）:', await request(upstream))
  if (!base) { console.log('可追加服务网址，测40个并发静态资源请求：node teaching/tools/check-classroom.cjs http://服务器地址:7778'); return }
  const asset = new URL('/teaching/assets/scenery/village-loading-gate-v2.jpg', base)
  const results = await Promise.all(Array.from({ length: 40 }, () => request(asset)))
  const times = results.map(r => r.ms).sort((a, b) => a - b)
  console.log('40个同时加载的静态请求:', { successes: results.filter(r => r.status === 200).length, failures: results.filter(r => r.status !== 200).length, p95Ms: times[37], slowestMs: times[39] })
  console.log('入口页面压缩:', await request(new URL('/teaching', base)))
})().catch(() => { process.exitCode = 1 })
