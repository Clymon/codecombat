// Python parses student source without executing it. Keep work off the HTTP event loop.
const { execFile } = require('child_process')
const path = require('path')
const limit = 2
let active = 0
const queue = []
function pump () {
  while (active < limit && queue.length) { active++; queue.shift()() }
}
function check (index, code) {
  if (queue.length >= 120) return Promise.resolve('提交人数较多，校验正在排队，请稍后重新提交。')
  return new Promise(resolve => {
    queue.push(() => {
      const child = execFile(process.env.TEACHING_PYTHON || 'python3', ['-X', 'utf8', path.join(__dirname, 'tools/check-learning.py'), String(index)], { encoding: 'utf8', timeout: 10000, maxBuffer: 8192 }, (error, stdout) => {
        let message = ''
        if (error) {
          if (error.code === 1 && stdout.trim()) message = stdout.trim()
          else {
            const reason = error.code === 'ENOENT' ? 'PYTHON_NOT_FOUND' : error.killed ? 'CHECK_TIMEOUT' : 'CHECK_FAILED'
            console.error(`[teaching-check] level=${index} reason=${reason} code=${error.code || 'unknown'}`)
            message = `服务器未能完成代码检查（${reason}），请老师检查服务环境后重新提交。`
          }
        }
        active--; resolve(message); pump()
      })
      // execFile reports spawn failures in its callback; stdin may close first.
      child.stdin.on('error', () => {})
      child.stdin.end(code)
    })
    pump()
  })
}
module.exports = { check }
