// Test-only Node preload: reject outgoing TCP connections except loopback.
// Start an isolated server with: node -r ./teaching/tools/deny-external.cjs index.js
const net = require('node:net')
const original = net.Socket.prototype.connect
net.Socket.prototype.connect = function (...args) {
  const normalized = Array.isArray(args[0]) ? args[0] : args
  const options = normalized[0]
  const host = options && typeof options === 'object' ? options.host || options.hostname : typeof normalized[1] === 'string' ? normalized[1] : undefined
  if (host && !['127.0.0.1', 'localhost', '::1'].includes(host)) {
    console.error('[offline-egress] blocked', host)
    throw Error('Offline test forbids external connections')
  }
  return original.apply(this, args)
}
