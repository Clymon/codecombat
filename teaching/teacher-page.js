const { CLASS_NAME } = require('./student-accounts')
const escape = value => String(value).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch])
const styles = ':root{font-family:system-ui,-apple-system,"PingFang SC","Microsoft YaHei",sans-serif;color-scheme:light}*{box-sizing:border-box}body{margin:0;background:#f2f6f9;color:#193044}main{max-width:1120px;margin:auto;padding:38px 22px 70px}h1{font-size:clamp(28px,4vw,40px);margin:8px 0}h2{font-size:22px;margin:0 0 18px}.eyebrow{font-weight:750;color:#147e68}.intro,.note{color:#4a6172;line-height:1.65}.top{display:flex;justify-content:space-between;gap:20px;align-items:start}.back{color:#126e62;font-weight:700;text-decoration:none}.panel{background:#fff;border:1px solid #cad8e0;border-radius:16px;padding:24px;margin-top:25px;box-shadow:0 5px 20px #18364d0c}.release-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:14px}.release-card{border:1px solid #d1dfe6;border-radius:12px;padding:18px;background:#f9fbfc}.release-card h3{font-size:17px;margin:0 0 9px}.state{font-weight:700}.open{color:#137963}.locked{color:#a44c27}.release-card form{margin-top:14px}button{font:inherit;font-weight:750;background:#156b60;color:#fff;border:0;border-radius:9px;padding:10px 16px;cursor:pointer}button.close{background:#814b31}button:hover{filter:brightness(1.12)}.table-wrap{overflow:auto}table{border-collapse:collapse;width:100%;min-width:680px}th,td{padding:13px 12px;text-align:left;border-bottom:1px solid #e2eaf0;vertical-align:middle}th{background:#eff5f7;font-size:14px}td:first-child{font-weight:700}td a{color:#086b62}.badge{display:inline-block;padding:5px 10px;border-radius:999px;font-size:13px;font-weight:750;background:#e8edf1;color:#526370}.badge.done{background:#d8f4e8;color:#116b4f}.badge.started{background:#e4edff;color:#31579a}.count{font-size:17px;font-weight:700;margin:0 0 14px}.code{white-space:pre-wrap;overflow-wrap:anywhere;background:#122337;color:#edf6ff;border-radius:10px;padding:16px;font:14px/1.6 ui-monospace,SFMono-Regular,Consolas,monospace}.detail{display:grid;gap:16px}.detail article{border:1px solid #d7e3e9;border-radius:12px;padding:18px}.detail h3{margin:0 0 6px}.detail p{margin:5px 0}.empty{padding:28px;background:#f8fafb;border-radius:10px;color:#526370}@media(max-width:640px){main{padding:22px 14px}.top{display:block}.top .back{display:inline-block;margin-top:12px}.panel{padding:18px}}'
const shell = (title, content) => `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escape(title)} · 教师端</title><style>${styles}</style></head><body><main>${content}</main></body></html>`

function levelStatus (session) {
  if (!session) return ['未开始', '']
  if ((session.teachingComplete ?? session.state?.complete) === true) return ['已完成', 'done']
  const hasCode = Object.values(session.code || {}).some(item => String(item?.plan || '').split('\n').some(line => line.trim() && !line.trim().startsWith('#')))
  if (hasCode) return ['进行中', 'started']
  return ['已进入', 'started']
}
function timeText (value) {
  if (!value) return '暂无记录'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '暂无记录' : date.toLocaleString('zh-CN', { hour12: false })
}
function teacherPage ({ levels, students, releases, progressById, formToken }) {
  const cards = levels.map(level => {
    const open = releases[level.slug] === true
    return `<article class="release-card"><p>第 ${level.teachingMap.section || 1} 小节 · ${escape(level.teachingMap.knowledge || '顺序与移动')}</p><h3>${escape(level.name)}</h3><div class="state ${open ? 'open' : 'locked'}">${open ? '已开放' : '未开放'}</div><form method="post" action="/teaching/teacher/release"><input type="hidden" name="formToken" value="${formToken}"><input type="hidden" name="slug" value="${escape(level.slug)}"><input type="hidden" name="open" value="${open ? 'false' : 'true'}"><button class="${open ? 'close' : ''}" type="submit">${open ? '关闭此关' : '开放此关'}</button></form></article>`
  }).join('')
  const rows = students.map(student => {
    const progress = progressById[student.studentId] || {}
    const stamps = Object.values(progress).map(session => session.updatedAt || session.createdAt).filter(Boolean).sort()
    const cells = levels.map(level => { const [label, className] = levelStatus(progress[level.slug]); return `<td><span class="badge ${className}">${label}</span></td>` }).join('')
    return `<tr><td><a href="/teaching/teacher/student/${escape(student.studentId)}">${escape(student.studentId)}</a></td>${cells}<td>${escape(timeText(stamps.at(-1)))}</td></tr>`
  }).join('')
  const body = `<header class="top"><div><div class="eyebrow">${CLASS_NAME} · 本机教师端</div><h1>关卡发布与学生进度</h1><p class="intro">开放状态对全班生效。学生未登录时不能进入原创关卡；关卡关闭后，已保存的代码和进度仍保留。</p></div><a class="back" href="/teaching">学生入口 →</a></header>
  <section class="panel"><h2>发布关卡</h2><div class="release-grid">${cards}</div><p class="note">新安装默认只开放第一关。此教师页仅允许在运行服务的电脑上打开。</p></section>
  <section class="panel"><h2>学生进度</h2><p class="count">已创建账号：${students.length} 人</p>${students.length ? `<div class="table-wrap"><table><thead><tr><th>学号</th>${levels.map(level => `<th>${escape(level.name)}</th>`).join('')}<th>最后保存</th></tr></thead><tbody>${rows}</tbody></table></div>` : '<div class="empty">还没有学生创建账号。学生在入口首次输入学号后，这里会出现记录。</div>'}<p class="note">点击学号可查看各关完成状态和已保存代码。免密学号不能核验真实身份，数据仅供课堂过程观察。</p></section>`
  return shell('关卡发布与学生进度', body)
}
function studentPage ({ student, levels, progress }) {
  const cards = levels.map(level => {
    const session = progress[level.slug]
    const [label, className] = levelStatus(session)
    const code = session?.code?.['hero-placeholder']?.plan || Object.values(session?.code || {}).map(item => item?.plan).filter(Boolean).join('\n')
    return `<article><h3>${escape(level.name)} <span class="badge ${className}">${label}</span></h3><p>最后保存：${escape(timeText(session?.updatedAt || session?.createdAt))}</p><p>场景通过数：${Object.keys(session?.scenePasses || {}).length} / ${level.teachingMap.scenarioTitles?.length || 1}</p>${session?.learningFeedback ? `<p>${escape(session.learningFeedback)}</p>` : ''}<p>已保存代码：</p>${code ? `<pre class="code">${escape(code)}</pre>` : '<p class="note">尚未保存代码</p>'}${Object.entries(session?.scenePasses || {}).map(([scene, record]) => `<details><summary>${escape(level.teachingMap.scenarioTitles?.[scene] || '主场景')} · 已通过 ${escape(timeText(record.passedAt))}</summary><pre class="code">${escape(record.code)}</pre></details>`).join('')}</article>`
  }).join('')
  return shell(`${student.studentId} 的进度`, `<header class="top"><div><div class="eyebrow">${CLASS_NAME} · 学生进度</div><h1>学号 ${escape(student.studentId)}</h1></div><a class="back" href="/teaching/teacher">← 返回教师端</a></header><section class="panel detail">${cards}</section><p class="note">代码和完成状态来自本地服务保存的记录；学号免密不能核验操作者。</p>`)
}

module.exports = { teacherPage, studentPage }
