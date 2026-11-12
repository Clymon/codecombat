/* global fetch */
;(function () {
  const $ = selector => document.querySelector(selector)
  const teacher = document.body.dataset.role === 'teacher'; const selected = new Set()
  let state; let pending = false; let navigating = false; let connectionOkay = false
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])
  const phaseName = { present: '呈现任务', explain: '短讲示范', practice: '动手练习', review: '总结迁移' }
  const api = teacher ? '/teaching/teacher/lesson' : '/teaching/room'
  const notice = message => { $('#notice').textContent = message }
  async function post (path, data = {}) {
    const response = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...data, roomId: state?.id, revision: state?.revision, formToken: $('meta[name=form-token]').content }) })
    const result = await response.json(); if (!response.ok) throw new Error(result.message || '操作失败，请重试。'); return result
  }
  async function leaveTo (url) {
    if (navigating) return
    if (!connectionOkay) return notice('正在重新连接课堂，请稍等再出发。')
    navigating = true
    window.lessonHub?.close()
    await window.lessonCabin?.depart()
    if (state?.status === 'live' && state.gathered) { navigating = false; window.lessonCabin?.update(state); return notice('老师正在集合，请先留在小屋。') }
    window.lessonHub?.close()
    location.assign(url)
  }
  async function act (path, data) {
    if (pending) return
    pending = true
    try { const result = await post(path, data); notice('已完成'); if (result.url) await leaveTo(result.url); else await refresh() } catch (e) { notice(e.message); await refresh() } finally { pending = false }
  }
  function renderTeacher () {
    $('#room-status').textContent = state.status === 'live' ? `${phaseName[state.phase]} · ${state.gathered ? '已召集回小屋' : state.paused ? '原地暂停' : '正在练习'} · ${state.controlling ? '本设备控制' : '本设备仅查看'}` : state.status === 'ended' ? '本节课已结束，记录已保存。可以开始新的课堂。' : '尚未开课'
    document.querySelectorAll('[data-action]').forEach(b => { b.disabled = b.dataset.action === 'start' ? state.status === 'live' : b.dataset.action === 'takeover' ? state.status !== 'live' || state.controlling : state.status !== 'live' || !state.controlling })
    document.querySelectorAll('[data-assign],#send-hint,#hint-all').forEach(b => { b.disabled = !state.controlling || state.status !== 'live' })
    const students = state.students || []; const counts = {}
    for (const p of students) counts[p.stage] = (counts[p.stage] || 0) + 1
    const masters = students.filter(p => p.mastered).length
    $('#counts').innerHTML = `<span>当前任务已完成 ${students.filter(p => p.results?.[p.task]?.complete).length} / ${students.length}</span><span>当前任务独立完成 ${masters} / ${students.length}</span>` + Object.entries(counts).map(([label, n]) => `<span>${esc(label)} ${n}人</span>`).join('')
    $('#students').innerHTML = students.map(p => `<tr><td><input type="checkbox" data-student="${esc(p.id)}" aria-label="选择${esc(p.id)}" ${selected.has(p.id) ? 'checked' : ''}></td><td>${esc(p.id)}</td><td>${esc(p.stage)}${p.offeredTask ? ' · 有新安排待进入' : ''}</td><td>${p.mastered ? '独立完成' : p.pending ? '待补验收' : p.results?.[p.task]?.complete ? '任务已完成' : p.assisted ? '已获操作帮助' : '正在完成任务'}</td><td>${esc(p.lastError || '暂无报错记录')}</td><td><button data-code="${esc(p.id)}">查看</button></td></tr>`).join('') || '<tr><td colspan="6">等待学生登录并进入本节课。</td></tr>'
    const errors = {}; for (const p of students) if (p.lastError) errors[p.lastError] = (errors[p.lastError] || 0) + 1
    $('#hint-history').innerHTML = '<h3>共同卡点</h3>' + (Object.entries(errors).map(([err, n]) => `<p>${n}人：${esc(err)}</p>`).join('') || '<p>暂无已报告的错误。</p>') + '<h3>最近发送</h3>' + (state.hints || []).slice(-20).reverse().map(h => `<p>${esc(h.studentId)} · ${h.level}级 · ${h.seenAt ? '学生已查看' : h.deliveredAt ? '已送达' : '待送达'} · ${esc(h.text)}</p>`).join('')
  }
  async function renderStudent () {
    $('#lesson-title').textContent = state.title
    $('#lesson-status').textContent = state.status === 'live' ? `${phaseName[state.phase]} · ${state.gathered ? '老师正在集合，请留在小屋一起听讲。' : state.paused ? '老师正在讲解，先一起看这里。' : '任务已发布，从门口出发吧。'}` : state.status === 'ended' ? '今天的任务告一段落，欢迎回家。可以复习已完成的任务。' : '等待老师开启课堂，不用反复刷新。'
    const freeLink = document.querySelector('header a[href="/teaching/free"]'); if (freeLink) freeLink.hidden = state.status === 'live'
    const shownTask = state.offeredTask || (state.result?.complete ? state.next?.detail : null) || state.task
    $('#task-title').textContent = shownTask?.title || '还没有新的任务'
    $('#task-description').textContent = shownTask?.brief || (shownTask ? '先找到货箱并拆封，再读取封签。到区域岗报开头的字，到尾号岗报最后一个字符；两处都放行后，把封签送到法阵。' : '')
    $('#enter').hidden = state.status !== 'live' || !state.task || state.gathered || !!state.offeredTask || !!(state.result?.complete && state.next)
    if (state.task) { $('#enter').href = `/play/level/${state.task.slug}?codeLanguage=python`; $('#enter').textContent = state.paused ? '进入现场 · 暂停中' : '出发 · 继续当前任务' }
    $('#next-task').hidden = state.status !== 'live' || !state.next
    $('#next-task').textContent = state.next ? '确认任务，出发' : ''; $('#next-task').disabled = state.paused
    $('#skip-basic').hidden = true; $('#skip-basic').disabled = state.paused
    $('#need-help').hidden = state.status !== 'live' || !['basic', 'independent', 'recheck'].includes(state.task?.id); $('#need-help').disabled = state.paused
    $('#result').textContent = (state.result?.complete && state.next ? `上一项「${state.task.title}」：` : '') + (state.result?.independent ? '已独立完成。' : state.result?.complete ? '已完成。' + (state.result.assisted ? '使用过操作提示，后面还有一次独立尝试。' : '') : state.pending ? '可以先跟上课堂，独立验收待补。' : '')
    $('#review-tasks').innerHTML = (state.reviewTasks || []).map(t => `<button data-review="${esc(t.id)}">复习：${esc(t.title)}</button>`).join('')
    $('#student-hints').hidden = !state.hints.length
    $('#hints').innerHTML = state.hints.map(h => `<article class="hint"><p>${esc(h.text)}</p>${h.code ? `<pre>${esc(h.code)}</pre>` : ''}<button data-seen="${h.id}">${h.seenAt ? '已查看 · 可以重看' : '我已查看'}</button></article>`).join('')
    const drafts = window.CabinDrafts.list(window, state.studentId)
    $('#cabin-drafts').hidden = !drafts.length
    const signature = drafts.map(d => d.slug + d.savedAt).join(':')
    if ($('#draft-list').dataset.version !== signature) {
      $('#draft-list').dataset.version = signature
      $('#draft-list').innerHTML = drafts.map(d => `<details><summary>${esc(d.slug)} · ${esc(new Date(d.savedAt).toLocaleString())} · 展开代码</summary><pre>${esc(d.code)}</pre></details>`).join('')
    }
    const returned = new URLSearchParams(location.search).get('return')
    if (returned === 'local-draft') notice('服务器未能保存，已回到小屋。代码草稿已保留在本机，可在“学习记录”中查看。')
    if (returned === 'unsaved' || returned === 'editor-unavailable') notice('已回到小屋。这次未能保存代码，也未能在浏览器中保留草稿。')
    window.lessonCabin?.update(state)
    window.lessonHub?.update(state)
    for (const h of state.hints.filter(h => !h.deliveredAt)) await post('/teaching/room/ack', { hintId: h.id, kind: 'delivered' })
  }
  async function refresh () {
    try {
      const response = await fetch(api + '/state', { cache: 'no-store' })
      if (response.status === 401) { location.assign(teacher ? '/teaching/teacher/login' : '/teaching'); return }
      if (!response.ok) throw new Error('暂时无法同步课堂，请检查连接。')
      state = await response.json(); if (!connectionOkay) notice(''); connectionOkay = true; if (teacher) renderTeacher(); else await renderStudent()
    } catch (e) { connectionOkay = false; notice(e.message); window.lessonCabin?.offline() }
  }
  document.addEventListener('change', event => { const id = event.target.dataset.student; if (id) event.target.checked ? selected.add(id) : selected.delete(id) })
  document.addEventListener('click', async event => {
    const entry = event.target.closest('#enter')
    if (entry) { event.preventDefault(); if (state && !state.gathered) await leaveTo(entry.href); return }
    const b = event.target.closest('button'); if (!b || b.disabled) return
    if (b.dataset.action) return act(api + '/command', { action: b.dataset.action, phase: b.dataset.phase })
    if (b.dataset.assign) return act(api + '/command', { action: 'assign', task: b.dataset.assign, targets: [...selected] })
    if (b.id === 'select-all') { state.students.forEach(p => selected.add(p.id)); return renderTeacher() }
    if (b.id === 'clear') { selected.clear(); return renderTeacher() }
    if (['send-hint', 'hint-all'].includes(b.id)) return act(api + '/command', { action: 'hint', targets: b.id === 'hint-all' ? 'all' : [...selected], level: Number($('#hint-level').value), text: $('#hint-text').value, code: $('#hint-code').value })
    if (b.dataset.code) {
      try { const r = await fetch(api + '/code/' + b.dataset.code); const data = await r.json(); if (!r.ok) throw new Error(data.message); $('#code-title').textContent = b.dataset.code + ' · ' + data.title; $('#student-code').textContent = data.code || '尚未保存代码'; $('#code-dialog').showModal() } catch (e) { notice(e.message) }
    }
    if (b.id === 'close-code') $('#code-dialog').close()
    if (b.dataset.review) return act('/teaching/room/review', { task: b.dataset.review })
    if (b.dataset.seen) return act('/teaching/room/ack', { hintId: b.dataset.seen, kind: 'seen' })
    if (['next-task', 'skip-basic', 'need-help'].includes(b.id)) return act('/teaching/room/move', { action: b.id === 'skip-basic' ? 'independent' : b.id === 'need-help' ? 'help' : 'next' })
  })
  window.lessonNavigate = leaveTo
  async function poll () { await refresh(); setTimeout(poll, 1500) }
  poll()
})()
