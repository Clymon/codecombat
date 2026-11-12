// Configure on the server. Passwords are never printed or stored as plaintext.
const readline = require('node:readline/promises')
const { stdin, stdout } = require('node:process')
const { Writable } = require('node:stream')
let secret = false
const output = new Writable({ write (chunk, encoding, callback) { if (!secret) stdout.write(chunk); callback() } })
const rl = readline.createInterface({ input: stdin, output, terminal: !!stdin.isTTY })
;(async () => {
  try {
    const user = await rl.question('教师账号（3—40位字母/数字/_/-）：')
    stdout.write('教师密码（至少10位，输入不显示）：'); secret = true
    const password = await rl.question(''); secret = false; stdout.write('\n')
    stdout.write('再次输入密码：'); secret = true
    const confirmation = await rl.question(''); secret = false; stdout.write('\n')
    if (password !== confirmation) throw new Error('两次密码不一致，未保存。')
    await require('../teacher-auth').configure(user.trim(), password)
    stdout.write('教师账号已保存；旧教师登录会话已失效。可从其他电脑通过服务器地址访问 /teaching/teacher/login。\n')
  } catch (e) { secret = false; console.error(e.message); process.exitCode = 1 } finally { rl.close() }
})()
