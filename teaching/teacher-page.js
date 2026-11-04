const { CLASS_NAME } = require('./student-accounts')
const escape = value => String(value).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch])
const styles = ':root{font-family:system-ui,-apple-system,"PingFang SC","Microsoft YaHei",sans-serif;color-scheme:light}*{box-sizing:border-box}body{margin:0;background:#f2f6f9;color:#193044}main{max-width:1120px;margin:auto;padding:38px 22px 70px}h1{font-size:clamp(28px,4vw,40px);margin:8px 0}h2{font-size:22px;margin:0 0 18px}.eyebrow{font-weight:750;color:#147e68}.intro,.note{color:#4a6172;line-height:1.65}.top{display:flex;justify-content:space-between;gap:20px;align-items:start}.back{color:#126e62;font-weight:700;text-decoration:none}.panel{background:#fff;border:1px solid #cad8e0;border-radius:16px;padding:24px;margin-top:25px;box-shadow:0 5px 20px #18364d0c}.release-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:14px}.release-card{border:1px solid #d1dfe6;border-radius:12px;padding:18px;background:#f9fbfc}.release-card h3{font-size:17px;margin:0 0 9px}.state{font-weight:700}.open{color:#137963}.locked{color:#a44c27}.release-card form{margin-top:14px}.release-card{scroll-margin-top:24px}.release-card.selected{border:2px solid #147e68;background:#effaf4}.select-level{display:flex;align-items:center;gap:8px;cursor:pointer;color:#4a6172;font-size:14px}.select-level input,.group-picks input{width:18px;height:18px;accent-color:#147e68}.bulk-controls{background:#f1f7f7;border:1px solid #b4d5cb;padding:18px;border-radius:12px;scroll-margin-top:20px}.selection-heading,.bulk-actions{display:flex;gap:10px;align-items:center;flex-wrap:wrap}.bulk-controls .secondary{background:#dfe8ec;color:#294454}.bulk-controls button:disabled{opacity:.45;cursor:not-allowed}.group-picks{border:0;margin:16px 0;padding:0;display:flex;gap:18px;flex-wrap:wrap}.group-picks legend{font-size:14px;color:#4a6172;margin-bottom:8px}.group-picks label{display:flex;gap:7px;align-items:center;cursor:pointer}.bulk-controls .note{margin-bottom:0;font-size:14px}.notice{padding:14px;background:#d8f4e8;color:#116b4f;border-radius:9px;font-weight:700}.release-actions{display:flex;gap:10px;flex-wrap:wrap}.release-actions .secondary{background:#dfe8ec;color:#294454}button{font:inherit;font-weight:750;background:#156b60;color:#fff;border:0;border-radius:9px;padding:10px 16px;cursor:pointer}button.close{background:#814b31}button:hover{filter:brightness(1.12)}.table-wrap{overflow:auto}table{border-collapse:collapse;width:100%;min-width:680px}th,td{padding:13px 12px;text-align:left;border-bottom:1px solid #e2eaf0;vertical-align:middle}th{background:#eff5f7;font-size:14px}td:first-child{font-weight:700}td a{color:#086b62}.badge{display:inline-block;padding:5px 10px;border-radius:999px;font-size:13px;font-weight:750;background:#e8edf1;color:#526370}.badge.done{background:#d8f4e8;color:#116b4f}.badge.started{background:#e4edff;color:#31579a}.count{font-size:17px;font-weight:700;margin:0 0 14px}.code{white-space:pre-wrap;overflow-wrap:anywhere;background:#122337;color:#edf6ff;border-radius:10px;padding:16px;font:14px/1.6 ui-monospace,SFMono-Regular,Consolas,monospace}.detail{display:grid;gap:16px}.detail article{border:1px solid #d7e3e9;border-radius:12px;padding:18px}.detail h3{margin:0 0 6px}.detail p{margin:5px 0}.empty{padding:28px;background:#f8fafb;border-radius:10px;color:#526370}@media(max-width:640px){main{padding:22px 14px}.top{display:block}.top .back{display:inline-block;margin-top:12px}.panel{padding:18px}}'
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
function teacherPage ({ levels, students, releases, visibility = {}, progressById, formToken, notice = '' }) {
  const sections = [...new Set(levels.map(level => level.teachingMap.section || 1))]
  const bulk = `<form id="bulk-controls" class="bulk-controls" method="post" action="/teaching/teacher/bulk">
    ${notice ? `<p class="notice" role="status">${escape(notice)}</p>` : ''}
    <input type="hidden" name="formToken" value="${escape(formToken)}">
    <div class="selection-heading"><strong><span id="selected-count" aria-live="polite">0</span> 关已选</strong><button class="secondary" type="button" data-select-all>全选 ${levels.length} 关</button><button class="secondary" type="button" data-clear-selection>清空选择</button></div>
    <fieldset class="group-picks"><legend>按组选择</legend>${sections.map(section => `<label><input type="checkbox" data-select-section="${section}">${levels.filter(l => (l.teachingMap.section || 1) === section).every(l => l.teachingMap.prototype) ? ({ 6: '攻击与救援教学', 7: '信号台与for教学', 8: '观察与守营教学' }[section] || '互动样关') : `第 ${section} 小节`}</label>`).join('')}</fieldset>
    <div class="bulk-actions"><button name="operation" value="hide" class="close" type="submit">批量隐藏</button><button name="operation" value="show" class="secondary" type="submit">批量显示</button><button name="operation" value="open" type="submit">批量开放</button><button name="operation" value="close" class="secondary" type="submit">批量关闭</button></div>
    <p class="note">显示只恢复卡片；开放会同时显示并允许进入。隐藏会同时关闭，所有操作都保留学习记录。</p>
  </form>`
  const cards = levels.map(level => {
    const visible = visibility[level.slug] !== false && (visibility[level.slug] === true || !level.teachingMap.prototype)
    const open = visible && releases[level.slug] === true
    const state = !visible ? '已隐藏 · 学生看不到' : open ? '已显示 · 可以进入' : '已显示 · 未开放'
    const fields = `<input type="hidden" name="formToken" value="${escape(formToken)}"><input type="hidden" name="slug" value="${escape(level.slug)}">`
    return `<article class="release-card" id="release-${escape(level.slug)}"><label class="select-level"><input type="checkbox" name="slugs" value="${escape(level.slug)}" form="bulk-controls" data-section="${level.teachingMap.section || 1}" aria-label="选择 ${escape(level.name)}">选择此关</label><p>${level.teachingMap.prototype ? ({ 6: '攻击与救援教学', 7: '信号台与for教学', 8: '观察与守营教学' }[level.teachingMap.section] || '互动样关') : `第 ${level.teachingMap.section || 1} 小节`} · ${escape(level.teachingMap.knowledge || '顺序与移动')}</p><h3>${escape(level.name)}</h3><div class="state ${open ? 'open' : 'locked'}">${state}</div><div class="release-actions">
      ${visible ? `<form method="post" action="/teaching/teacher/release">${fields}<input type="hidden" name="open" value="${open ? 'false' : 'true'}"><button class="${open ? 'close' : ''}" type="submit">${open ? '关闭此关' : '开放此关'}</button></form>` : ''}
      <form method="post" action="/teaching/teacher/visibility">${fields}<input type="hidden" name="visible" value="${visible ? 'false' : 'true'}"><button class="${visible ? 'secondary' : ''}" type="submit">${visible ? '隐藏此关' : '显示到学生页'}</button></form>
    </div>${!visible ? '<p class="note">显示后仍为未开放；需要时再点“开放此关”。</p>' : ''}</article>`
  }).join('')
  const rows = students.map(student => {
    const progress = progressById[student.studentId] || {}
    const stamps = Object.values(progress).map(session => session.updatedAt || session.createdAt).filter(Boolean).sort()
    const cells = levels.map(level => { const [label, className] = levelStatus(progress[level.slug]); return `<td><span class="badge ${className}">${label}</span></td>` }).join('')
    return `<tr><td><a href="/teaching/teacher/student/${escape(student.studentId)}">${escape(student.studentId)}</a></td>${cells}<td>${escape(timeText(stamps.at(-1)))}</td></tr>`
  }).join('')
  const body = `<header class="top"><div><div class="eyebrow">${CLASS_NAME} · 本机教师端</div><h1>关卡发布与学生进度</h1><p class="intro">隐藏：学生页不出现；显示但未开放：只能看到卡片；开放：可以进入。设置对全班生效，隐藏或关闭都保留已保存代码和学习进度。</p></div><a class="back" href="/teaching">学生入口 →</a></header>
  <section class="panel"><h2>显示与开放</h2>${bulk}<p class="note">测试关卡默认隐藏。${levels.some(l => l.teachingMap.prototype) ? `<a href="#release-${escape(levels.find(l => l.teachingMap.prototype).slug)}">跳到互动样关 ↓</a>` : ''}</p><div class="release-grid">${cards}</div><p><a class="back" href="#bulk-controls">↑ 返回批量操作</a></p><p class="note">新安装默认只开放第一关。此教师页仅允许在运行服务的电脑上打开。</p></section>
  <section class="panel"><h2>学生进度</h2><p class="count">已创建账号：${students.length} 人</p>${students.length ? `<div class="table-wrap"><table><thead><tr><th>学号</th>${levels.map(level => `<th>${escape(level.name)}</th>`).join('')}<th>最后保存</th></tr></thead><tbody>${rows}</tbody></table></div>` : '<div class="empty">还没有学生创建账号。学生在入口首次输入学号后，这里会出现记录。</div>'}<p class="note">点击学号可查看各关完成状态和已保存代码。免密学号不能核验真实身份，数据仅供课堂过程观察。</p></section>`
  return shell('关卡发布与学生进度', body + '<script src="/teaching/teacher/controls.js" defer></script>')
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
