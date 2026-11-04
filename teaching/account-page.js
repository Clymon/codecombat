const { CLASS_NAME } = require('./student-accounts')
const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch])
const chapters = [
  { title: '门岗与宝藏', knowledge: '顺序执行 · 输出 · 参数', mark: 'Ⅰ' },
  { title: '岔路与选择', knowledge: '变量 · 运算 · 条件判断', mark: 'Ⅱ' },
  { title: '机关长廊', knowledge: 'for · range · 循环变量', mark: 'Ⅲ' },
  { title: '寻找信标', knowledge: 'while · 停止条件 · 综合运用', mark: 'Ⅳ' },
]
const complete = session => session?.teachingComplete ?? session?.state?.complete ?? false
const playUrl = level => `/play/level/${escapeHtml(level.slug)}?codeLanguage=python`
const hiddenToken = token => `<input type="hidden" name="formToken" value="${escapeHtml(token)}">`
function levelCard (level, index, { progress, releases, formToken }) {
  const d = level.teachingMap; const session = progress[level.slug]; const open = releases[level.slug] === true; const done = complete(session)
  const titles = d.scenarioTitles || []; const passed = Object.keys(session?.scenePasses || {}).length
  const state = done ? '已完成' : open ? (session ? '进行中' : '可进入') : '未开放'
  return `<article class="level-card ${open ? 'unlocked' : 'locked'} ${done ? 'completed' : ''}" id="${escapeHtml(level.slug)}">
    <div class="card-top"><span class="level-number">${String(index + 1).padStart(2, '0')}</span><span class="status ${done ? 'done' : open ? 'available' : ''}">${done ? '✓ ' : !open ? '◇ ' : ''}${state}</span>${d.optional ? '<span class="optional">选做</span>' : ''}</div>
    <h3>${escapeHtml(level.name.replace(/^训练营[①②③④⑤⑥]：|^第\d+节 · /g, '').replace('【选做】', ''))}</h3>
    <p class="knowledge">${escapeHtml(d.knowledge || '顺序执行与移动')}</p>
    ${open ? `<p class="quest">${escapeHtml(d.quest || level.description)}</p>` : ''}
    ${session?.learningFeedback ? `<p class="error" role="status">${escapeHtml(session.learningFeedback)}</p>` : ''}
    <div class="card-bottom">${open ? `<a class="button ${done ? 'quiet' : ''}" href="${playUrl(level)}">${done ? '再次挑战' : session ? '继续关卡' : '进入关卡'} <span aria-hidden="true">→</span></a>` : '<span class="locked-label">等待老师开放</span>'}</div>
    ${open && titles.length > 1 ? `<details class="scenes"><summary>场景进度 <strong>${passed} / ${titles.length}</strong><span aria-hidden="true">＋</span></summary><p>${d.allowCodeChanges ? '按题目要求改数据，完成每个场景。' : '同一份代码通过所有场景；改代码后需重新验证。'}</p><div class="scene-list">${titles.map((title, scene) => `<form method="post" action="/teaching/scenario">${hiddenToken(formToken)}<input type="hidden" name="slug" value="${escapeHtml(level.slug)}"><input type="hidden" name="scene" value="${scene}"><button class="scene-button" type="submit">${session?.scenePasses?.[scene] ? '✓ ' : ''}${escapeHtml(title)} <span aria-hidden="true">→</span></button></form>`).join('')}</div></details>` : ''}
  </article>`
}
module.exports = function accountPage ({ student, levels = [], progress = {}, releases = {}, error = '', formToken = '' }) {
  const footer = `<footer>Python 课堂 · ${CLASS_NAME}<span>游戏通用美术：<a href="https://codecombat.com/legal">CodeCombat</a> · CC BY 4.0</span></footer>`
  const brand = '<a class="brand" href="/teaching"><span class="brand-mark" aria-hidden="true">Py</span><span>Python 闯关<small>地下城训练营</small></span></a>'
  let content
  if (!student) {
    content = `<div class="masthead">${brand}<span class="class-tag">${CLASS_NAME}</span></div>
    <main class="login-layout" id="main">
      <section class="welcome"><p class="eyebrow">你的代码，就是英雄的下一步</p><h1>走进地牢，<br>写下你的冒险。</h1><p class="welcome-copy">用 Python 探路、通过门岗、解开机关。<br>观察每一步，找到自己的通关方法。</p>
        <div class="hero-scene" aria-hidden="true"><div class="hero-glow"></div><img src="/images/pages/play/level/modal/victory_hero.png" alt=""><div class="hero-plinth"></div><span class="scene-caption">顺序 · 判断 · 循环</span></div>
      </section>
      <section class="login-panel parchment" aria-labelledby="login-title"><p class="paper-eyebrow">${CLASS_NAME} · 冒险者入口</p><h2 id="login-title">准备好出发了吗？</h2><p class="login-description">输入自己的学号，继续你的冒险。</p>
        ${error ? `<p class="error" role="alert">${escapeHtml(error)}</p>` : ''}
        <form method="post" action="/teaching/login">${hiddenToken(formToken)}<label for="login-id">学号</label><input id="login-id" name="studentId" type="text" inputmode="numeric" autocomplete="username" pattern="[0-9]{4,20}" minlength="4" maxlength="20" required placeholder="请输入学号" aria-describedby="login-hint"><p class="field-hint" id="login-hint">无需密码。请使用本人学号，保存每一次进步。</p><button class="button primary" type="submit">进入课堂 <span aria-hidden="true">→</span></button></form>
        <p class="login-footnote">第一次进入也直接登录，学习记录会自动保存。</p>
      </section>
    </main>${footer}`
  } else {
    const open = levels.filter(l => releases[l.slug] === true); const next = open.find(l => !complete(progress[l.slug])) || open[0]
    const count = levels.filter(l => complete(progress[l.slug])).length
    content = `<header class="masthead">${brand}<div class="identity"><span>当前学号：<strong>${escapeHtml(student.studentId)}</strong></span><form method="post" action="/teaching/logout">${hiddenToken(formToken)}<button class="logout" type="submit">退出登录</button></form></div></header>
      <main class="campaign" id="main"><section class="campaign-banner"><div><p class="eyebrow">${CLASS_NAME} · 地下城训练营</p><h1>你的冒险，从这里继续。</h1><p>用代码让英雄行动。每过一关，继续挑战下一项任务。</p><div class="journey-count"><strong>${count}</strong> / ${levels.length} 关已完成 <span>· ${open.length} 关已开放</span></div></div><div class="next-stop"><span class="eyebrow">${next ? '下一站' : '任务准备中'}</span><h2>${next ? escapeHtml(next.name.replace(/^训练营[①②③④⑤⑥]：|^第\d+节 · /g, '')) : '等待老师开放关卡'}</h2>${next ? `<a class="button primary" href="${playUrl(next)}">${progress[next.slug] ? '继续冒险' : '开始冒险'} <span aria-hidden="true">→</span></a>` : '<p>老师开放后，刷新此页即可进入。</p>'}</div></section>
      <nav class="chapter-nav" aria-label="教学阶段">${chapters.map((c, i) => `<a href="#chapter-${i + 1}"><b>${c.mark}</b><span>${c.title}</span></a>`).join('')}</nav>
      ${chapters.map((c, i) => { const group = levels.filter(l => (l.teachingMap.section || 1) === i + 1); return `<section class="chapter" id="chapter-${i + 1}" aria-labelledby="chapter-title-${i + 1}"><header class="chapter-heading"><span class="chapter-seal" aria-hidden="true">${c.mark}</span><div><p>第 ${i + 1} 小节 · ${escapeHtml(c.knowledge)}</p><h2 id="chapter-title-${i + 1}">${c.title}</h2></div><span class="chapter-progress">${group.filter(l => complete(progress[l.slug])).length} / ${group.length} 已完成</span></header><div class="level-grid">${group.map(l => levelCard(l, levels.indexOf(l), { progress, releases, formToken })).join('')}</div></section>` }).join('')}
      </main>${footer}`
  }
  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${CLASS_NAME} · Python闯关</title><link rel="stylesheet" href="/teaching/classroom.css"></head><body class="${student ? 'campaign-page' : 'login-page'}"><a class="skip" href="#main">跳到主要内容</a>${content}</body></html>`
}
