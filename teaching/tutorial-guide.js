function observed (e, hero) {
  if (!hero) return false
  let a = {}; let learning = {}
  try { a = JSON.parse(hero.teachingAdventure || '{}'); learning = JSON.parse(hero.teachingLearning || '{}') } catch (_) {}
  const actor = a.actors?.find(a => a.id === e.id)
  if (e.kind === 'damaged') return actor?.hp < actor?.maxHealth
  if (e.kind === 'dead') return actor?.alive === false
  if (e.kind === 'lit') return actor?.lit === true
  if (e.kind === 'call') return learning.calls?.[e.name] > 0
  if (e.kind === 'exit') return hero.teachingExitStartedAt >= 0
  if (e.kind === 'victory') return a.complete === true
  return false
}
function attachGuide (task, design) {
  const contract = design.learningContract
  if (contract) {
    const p = document.createElement('p'); p.className = 'teaching-code-rule'
    p.textContent = [...(contract.loops || []).map(l => `必须用 ${l} 实际重复动作`), contract.maxStatements ? `最多 ${contract.maxStatements} 行有效代码` : ''].filter(Boolean).join('；') || '按本关要求实际使用新命令。'
    task.firstChild.textContent += ' · ' + ((contract.loops || []).join(' / ') || '新命令') + (contract.maxStatements ? ` · ≤${contract.maxStatements}行` : '')
    task.insertBefore(p, task.children[1])
    if (contract.maxStatements) { const note = document.createElement('small'); note.textContent = '空行、注释不计；每条语句、循环头和else各计1行。换行写参数仍计1行；分号合并仍分开计。'; task.insertBefore(note, p.nextSibling) }
  }
  if (!design.tutorial) return () => {}
  task.open = true
  task.firstChild.textContent = '教学引导 · 可收起'
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
