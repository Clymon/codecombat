/* global fetch */
// The cabin owns destination selection; the map never navigates the student itself.
;(function () {
  const $ = s => document.querySelector(s)
  if (!$('#hub-task')) return
  let state; let selected; let exploration; let loadedFor; let focusBefore
  const panels = { task: $('#hub-task'), map: $('#hub-map'), notebook: $('#hub-notebook') }
  $('#notebook-review').appendChild($('#review-tasks'))
  function close () { for (const p of Object.values(panels)) if (p.open) p.close() }
  async function loadMap () {
    try {
      const response = await fetch('/teaching/room/exploration', { cache: 'no-store' })
      if (!response.ok) throw Error('地图暂时没有加载成功，请关闭后再试。')
      exploration = await response.json()
      if (!state || state.status === 'live' || !exploration.available) { $('#hub-map-frame').hidden = true; $('#hub-map-status').textContent = '正在上课，请先完成任务板上的课堂任务。课堂结束后可以自由选关。'; return }
      $('#hub-map-status').textContent = '选择地图上的关卡，查看详情，再点“选择这关”。回到任务板确认后出发。'
      const frame = $('#hub-map-frame'); frame.hidden = false
      if (!frame.getAttribute('src')) frame.src = '/teaching/free?embed=1'
      if (selected) selected = exploration.levels.find(l => l.slug === selected.slug && l.open)
      renderFree(); updateSummary()
    } catch (e) { $('#hub-map-status').textContent = e.message }
  }
  function open (name) {
    const panel = panels[name]; if (!panel) return
    focusBefore = document.activeElement; close(); panel.showModal()
    if (name === 'map') loadMap()
  }
  function renderFree () {
    $('#free-task').hidden = state?.status === 'live' || !selected
    if (!selected) return
    $('#free-title').textContent = selected.title
    $('#free-description').textContent = selected.description
    $('#free-progress').textContent = selected.complete ? '这关已经完成，可以重新挑战。' : `场景进度：${selected.passed} / ${selected.scenes} 已通过。`
    $('#free-enter').disabled = !selected.open
  }
  function updateSummary () {
    if (!state) return
    const live = state.status === 'live'; const ready = live && !state.paused && !state.gathered
    $('#cabin-task').hidden = !live
    $('#task-choose-map').hidden = live || !!selected
    $('#hub-progress').textContent = live ? `本节练习：${state.groupTitle}。${state.progress?.length ? '已完成：' + state.progress.map(p => p.title).join('、') + '。' : '每站完成后回小屋；下一站由老师安排，读当前任务板再出发。'}` : '自由练习从地图选关；课堂任务由老师发布。'
    $('#notebook-progress').textContent = state.progress?.length ? state.progress.map(p => `${p.title}：${p.independent ? '独立完成' : p.assisted ? '借助提示完成' : '已完成'}`).join('；') : '还没有本节课的完成记录。任务通过验收后会记在这里。'
    window.lessonCabin?.navigation({ enabled: !live || ready, selected: !!selected, label: live ? ready ? '查看任务 →' : '小屋集合' : selected ? '准备出发 →' : '先去地图选关', action: () => open(live || selected ? 'task' : 'map') })
    renderFree()
  }
  document.querySelectorAll('[data-hub-open]').forEach(b => { b.onclick = () => open(b.dataset.hubOpen) })
  document.querySelectorAll('[data-hub-close]').forEach(b => { b.onclick = () => { close(); focusBefore?.focus() } })
  for (const panel of Object.values(panels)) panel.addEventListener('click', e => { if (e.target === panel) { const r = panel.getBoundingClientRect(); if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) close() } })
  window.addEventListener('message', async event => {
    if (event.origin !== location.origin || event.source !== $('#hub-map-frame').contentWindow || event.data?.type !== 'cabin-map-select') return
    if (!state || state.status === 'live') return
    await loadMap()
    if (state.status === 'live') return
    const level = exploration?.levels?.find(l => l.slug === event.data.slug && l.open)
    if (!level) { $('#hub-map-status').textContent = '这关暂不可进入，请选择已开放的关卡。'; return }
    selected = level; updateSummary(); open('task')
  })
  $('#free-enter').onclick = () => { if (selected?.open && state?.status !== 'live') window.lessonNavigate(`/play/level/${selected.slug}?codeLanguage=python`) }
  window.lessonHub = {
    open,
    close,
    update (value) {
      state = value
      if (state.status === 'live') { selected = null; $('#hub-map-frame').hidden = true; $('#hub-map-frame').removeAttribute('src'); $('#hub-map-status').textContent = '正在上课，请先完成老师发布的任务。课堂结束后地图会开放。' }
      updateSummary()
      const key = state.id + ':' + state.status
      if (key !== loadedFor) {
        loadedFor = key
        const slug = new URLSearchParams(location.search).get('level')
        if (state.status !== 'live' && /^local-python-\d{2}$/.test(slug || '')) loadMap().then(() => { selected = exploration?.levels?.find(l => l.slug === slug && l.open); updateSummary(); open(selected ? 'task' : 'map') })
      }
    },
  }
})()
