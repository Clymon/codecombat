// Immutable, content-addressed public engine/art pack. Never cache user APIs.
const fs = require('node:fs')
const path = require('node:path')
const crypto = require('node:crypto')
const zlib = require('node:zlib')
const https = require('node:https')
const directory = path.join(__dirname, 'vendor')
const manifestPath = path.join(directory, 'manifest.json')
const manifest = fs.existsSync(manifestPath) ? JSON.parse(fs.readFileSync(manifestPath)) : { version: 1, resources: {} }
const buffers = new Map()
const pending = new Map()
const mediaAliases = require('./offline-media-aliases.json')
const enabled = () => process.env.TEACHING_OFFLINE !== 'false'
function key (value) {
  const url = new URL(value, 'http://local.invalid')
  if (url.origin !== 'http://local.invalid') return null
  url.searchParams.delete('_'); url.searchParams.delete('cacheEdge'); url.searchParams.sort()
  return url.pathname + url.search
}
function allowed (value) {
  return /^\/(?:db\/(?:thang\.type|level\.component|level\.system)\/|file\/|javascripts\/|images\/|fonts\/|sounds\/)/.test(value || '')
}
function fetchResource (resource) {
  // Only used during explicit resource-pack preparation. Normal serving never connects.
  return new Promise((resolve, reject) => {
    const source = new URL(resource, 'https://direct.staging.codecombat.com')
    const request = https.get(source, { headers: { 'Accept-Encoding': 'identity' } }, response => {
      if (response.statusCode !== 200) { response.resume(); reject(Error(`Resource HTTP ${response.statusCode}: ${resource}`)); return }
      const chunks = []; let length = 0
      response.on('data', chunk => { length += chunk.length; if (length > 32 * 1024 * 1024) response.destroy(Error('Resource exceeds 32 MB')); else chunks.push(chunk) })
      response.on('error', reject)
      response.on('end', () => resolve({ body: Buffer.concat(chunks), type: response.headers['content-type'] || 'application/octet-stream', source: source.href }))
    })
    request.setTimeout(25000, () => request.destroy(Error('Resource download timed out')))
    request.on('error', reject)
  })
}
async function capture (resource) {
  if (!allowed(resource)) throw Error('Not a public engine resource')
  if (pending.has(resource)) return pending.get(resource)
  const operation = (async () => {
    const result = await fetchResource(resource)
    const hash = crypto.createHash('sha256').update(result.body).digest('hex')
    fs.mkdirSync(path.join(directory, 'blobs'), { recursive: true })
    const file = path.join(directory, 'blobs', hash + '.gz')
    if (!fs.existsSync(file)) fs.writeFileSync(file, zlib.gzipSync(result.body, { level: 9 }))
    manifest.resources[resource] = { hash, bytes: result.body.length, type: result.type, source: result.source }
    fs.writeFileSync(manifestPath + '.tmp', JSON.stringify(manifest, null, 2) + '\n')
    fs.renameSync(manifestPath + '.tmp', manifestPath)
    buffers.set(hash, result.body)
    return manifest.resources[resource]
  })()
  pending.set(resource, operation)
  try { return await operation } finally { pending.delete(resource) }
}
function middleware (req, res, next) {
  if (!enabled()) return next()
  const requested = key(req.originalUrl)
  const resource = mediaAliases[requested] || requested
  const send = entry => {
    if (!buffers.has(entry.hash)) buffers.set(entry.hash, zlib.gunzipSync(fs.readFileSync(path.join(directory, 'blobs', entry.hash + '.gz'))))
    res.set({ 'Content-Type': entry.type, 'Cache-Control': 'public, max-age=0, must-revalidate', 'X-Teaching-Resource': entry.hash }).send(buffers.get(entry.hash))
  }
  if (req.method === 'GET' && allowed(resource)) {
    if (manifest.resources[resource]) return send(manifest.resources[resource])
    if (process.env.TEACHING_CAPTURE_RESOURCES === 'true') return capture(resource).then(send).catch(error => { console.error('[teaching-resource]', error.message); res.status(502).json({ message: '通用资源下载失败', resource }) })
  }
  // No fall-through to the original catch-all upstream proxy.
  res.status(404).set('Cache-Control', 'no-store').json({ message: '本地课堂未提供这个资源或接口。', resource: resource || req.path })
}
module.exports = { enabled, key, allowed, middleware }
