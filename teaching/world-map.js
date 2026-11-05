const { prerequisitesFor } = require('./level-access')
const { renderAmbience } = require('./world-ambience')
// Stable geography: hiding or reopening a lesson never moves the other landmarks.
const regions = [
  { section: 1, name: '村口训练场', subtitle: '门岗 · 宝藏 · 初次交战', label: [245, 395] },
  { section: 2, name: '岔路庭院', subtitle: '观察 · 变量 · 条件判断', label: [275, 135] },
  { section: 3, name: '机关工坊', subtitle: '机关 · for · 重复行动', label: [750, 160] },
  { section: 4, name: '信标营地', subtitle: '信标 · while · 守住营地', label: [785, 420] },
]
const positions = {
  4: [145, 470],
  5: [215, 445],
  1: [290, 460],
  2: [365, 490],
  3: [330, 545],
  6: [255, 550],
  26: [185, 530],
  27: [140, 570],
  7: [205, 265],
  8: [255, 215],
  30: [315, 180],
  9: [375, 215],
  31: [390, 270],
  10: [315, 290],
  11: [215, 320],
  12: [285, 350],
  13: [605, 235],
  28: [680, 235],
  29: [755, 220],
  14: [825, 270],
  15: [880, 325],
  16: [740, 310],
  17: [635, 465],
  18: [705, 460],
  19: [775, 480],
  32: [845, 495],
  33: [815, 550],
  20: [915, 575],
  21: [730, 570],
}
const isComplete = session => session?.teachingComplete ?? session?.state?.complete ?? false
const indexOf = level => level.teachingMap.index || Number(level.slug.slice(-2))
const titleOf = level => level.name.replace(/^训练营[①②③④⑤⑥]：|^第\d+节 · /g, '').replace('【选做】', '')
function routeFor (levels) {
  const nodes = levels.filter(l => positions[indexOf(l)] && !l.teachingMap.prototype)
  const prerequisites = prerequisitesFor(nodes)
  const bySlug = new Map(nodes.map(l => [l.slug, l]))
  const edges = nodes.flatMap(to => prerequisites[to.slug].map(slug => ({ from: bySlug.get(slug), to, branch: !!to.teachingMap.optional })))
  return { nodes, edges }
}
function renderMap ({ levels, progress, releases, access = {}, next, numbers, escapeHtml: e }) {
  const { nodes, edges } = routeFor(levels)
  const visibleRegions = regions.filter(r => nodes.some(l => l.teachingMap.section === r.section))
  const point = l => positions[indexOf(l)]
  const road = ({ from, to, branch }) => {
    const [x1, y1] = point(from); const [x2, y2] = point(to)
    let d = `M ${x1} ${y1} L ${x2} ${y2}`
    if (from.teachingMap.section === 1 && to.teachingMap.section === 2) d = `M ${x1} ${y1} C 85 480, 95 320, ${x2} ${y2}`
    if (from.teachingMap.section === 2 && to.teachingMap.section === 3) d = `M ${x1} ${y1} C 425 280, 470 155, ${x2} ${y2}`
    if (from.teachingMap.section === 3 && to.teachingMap.section === 4) d = `M ${x1} ${y1} C 690 340, 575 360, ${x2} ${y2}`
    const lit = isComplete(progress[from.slug]); const done = lit && isComplete(progress[to.slug])
    return `<path class="map-road ${branch ? 'branch-road' : ''} ${done ? 'walked' : lit && releases[to.slug] ? 'available-road' : ''}" d="${d}"/>`
  }
  return `<section class="world-map" aria-label="新手村地图"><div class="map-toolbar"><p>点击地点查看任务，再进入关卡。</p><div><button type="button" data-map-home>定位下一站</button><button type="button" data-map-zoom="out" aria-label="缩小地图">−</button><button type="button" data-map-zoom="in" aria-label="放大地图">＋</button></div></div>
  <nav class="region-nav" aria-label="地图区域">${visibleRegions.map(r => `<a href="#chapter-${r.section}" data-region="${r.section}">${r.name}</a>`).join('')}${levels.some(l => l.teachingMap.prototype) ? '<a href="#chapter-5" data-region="5">独立试炼区</a>' : ''}</nav>
  <div class="map-viewport" tabindex="0" aria-label="可滚动的新手村地图"><div class="map-canvas" data-next="${e(next?.slug || '')}">
    <img class="map-art" src="/teaching/assets/scenery/starter-village-map-v1.jpg" width="1536" height="1024" alt="新手村鸟瞰：左下村口训练场、左上岔路庭院、右上机关工坊、右下信标营地，由桥梁相连" fetchpriority="high">
    ${renderAmbience()}
    <svg class="map-roads" viewBox="0 0 1000 666.667" aria-hidden="true">${edges.map(road).join('')}</svg>
    ${visibleRegions.map(r => `<a class="map-region-label" href="#chapter-${r.section}" data-region="${r.section}" style="left:${r.label[0] / 10}%;top:${r.label[1] * 0.15}%"><strong>${r.section} · ${r.name}</strong><small>${r.subtitle}</small></a>`).join('')}
    ${nodes.map(l => {
      const [x, y] = point(l); const done = isComplete(progress[l.slug]); const open = releases[l.slug] === true
      const state = done ? '已完成' : open ? '可进入' : access[l.slug]?.reason === 'prerequisite' ? '待解锁' : '未开放'; const n = numbers.get(l.slug) + 1
      return `<a class="map-node ${done ? 'completed' : open ? 'unlocked' : 'locked'} ${l.teachingMap.optional ? 'side-node' : ''} ${next?.slug === l.slug ? 'next-node' : ''}" href="#${e(l.slug)}" data-level="${e(l.slug)}" data-section="${l.teachingMap.section}" style="left:${x / 10}%;top:${y * 0.15}%" aria-label="${n} ${e(titleOf(l))}，${state}${l.teachingMap.tutorial ? '，教学引导' : ''}${l.teachingMap.optional ? '，选做支路' : ''}" title="${e(titleOf(l))} · ${state}${access[l.slug]?.message ? `：${e(access[l.slug].message)}` : ''}">${next?.slug === l.slug ? '<img class="map-traveler" src="/teaching/assets/characters/deepseek.png" alt="下一站">' : ''}<span class="node-disc">${String(n).padStart(2, '0')}</span>${done ? '<span class="node-completion" aria-hidden="true">✓</span>' : ''}${l.teachingMap.tutorial ? '<span class="node-guide" aria-hidden="true">学</span>' : ''}<span class="node-tooltip">${e(titleOf(l))}<small>${state}</small></span></a>`
    }).join('')}
  </div></div><div class="map-legend"><span><i class="legend-done"></i>已完成</span><span><i class="legend-open"></i>可进入</span><span><i class="legend-locked"></i>待解锁 / 未开放</span><span>虚线：选做支路</span><span>学：新技能引导</span></div><p class="map-footnote">先完成前置关卡，再进入下一关；老师未开放的关卡仍需等待。小屏幕可横向滚动地图。</p>
  ${levels.some(l => l.teachingMap.prototype) ? `<nav class="trial-nav" aria-label="独立试炼区"><strong>独立试炼区</strong>${levels.filter(l => l.teachingMap.prototype).map(l => `<a href="#${e(l.slug)}" data-level="${e(l.slug)}">${e(titleOf(l))}<small>${isComplete(progress[l.slug]) ? '已完成' : releases[l.slug] ? '可进入' : access[l.slug]?.reason === 'prerequisite' ? '待解锁' : '未开放'}</small></a>`).join('')}</nav>` : ''}</section>`
}
module.exports = { regions, positions, routeFor, renderMap, isComplete, titleOf }
