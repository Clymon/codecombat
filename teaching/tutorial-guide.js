function observed (e, hero) {
  if (!hero) return false
  let a = {}; let learning = {}
  try { a = JSON.parse(hero.teachingAdventure || '{}'); learning = JSON.parse(hero.teachingLearning || '{}') } catch (_) {}
  const actor = a.actors?.find(a => a.id === e.id)
  if (e.kind === 'damaged') return actor?.hp < actor?.maxHealth
  if (e.kind === 'dead') return actor?.alive === false
  if (e.kind === 'lit') return actor?.lit === true
  if (e.kind === 'enemy-arrived') return a.actors?.some(a => a.kind === 'enemy' && a.active) === true
  if (e.kind === 'enemies-cleared') return a.actors?.filter(a => a.kind === 'enemy').every(a => !a.alive) === true
  if (e.kind === 'call') return learning.calls?.[e.name] > 0
  if (e.kind === 'exit') return hero.teachingExitStartedAt >= 0
  if (e.kind === 'victory') return a.complete === true
  return false
}
function attachGuide (task, design) {
  if (!design.tutorial) return () => {}
  task.open = false
  task.firstChild.textContent = '教学引导 · 点击查看'
  const block = document.createElement('section'); block.className = 'teaching-guide'
  const h = document.createElement('h4'); h.textContent = design.tutorial.title; block.append(h)
  const checks = design.tutorial.steps.map((step, i) => {
    const item = document.createElement('div'); const title = document.createElement('p'); const status = document.createElement('strong'); const text = document.createElement('span')
    status.textContent = `${i + 1}. `; text.textContent = step.text; title.append(status, text); item.append(title)
    if (step.code) { const pre = document.createElement('pre'); pre.textContent = step.code; item.append(pre) }
    const observation = document.createElement('p'); observation.className = 'guide-observe'; observation.textContent = step.observe; item.append(observation); block.append(item)
    return { status, evidence: step.evidence, i }
  })
  const mentor = task.querySelector('.teaching-mentor')
  task.insertBefore(block, mentor ? mentor.nextSibling : task.children[1])
  return hero => { for (const c of checks) { const done = observed(c.evidence, hero); c.status.textContent = done ? '✓ 已观察到 · ' : `${c.i + 1}. `; c.status.style.color = done ? '#a4e8b8' : '#ffe2a3' } }
}
module.exports = { attachGuide, observed }
