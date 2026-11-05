// Presentation reads replayed evidence; it never issues hero commands or changes goals.
const portraits = {
  hero: { name: 'DeepSeek', role: '鲸鱼娘', image: '/teaching/assets/characters/deepseek.png' },
  mentor: { name: '梁文锋', role: '新手村导师', image: '/teaching/assets/characters/liang-wenfeng.png' },
  guard: { name: '门岗守卫', role: '村口值守', image: '/teaching/assets/characters/village-guard-v1.png' },
}

function introFor (design) {
  if (design.world?.chapterId !== 'starter-village') return []
  const lines = []
  if (design.index === 5) {
    lines.push({ speaker: 'mentor', text: '守卫只听得见近处的说话声。先走到门岗前，再试着和他打个招呼。' })
  } else if (design.mentor) {
    lines.push({ speaker: 'mentor', text: design.mentor.line })
  } else {
    const sectionLines = {
      1: '先看道路通向哪里。写几条命令，运行后看看英雄实际走到了哪儿。',
      2: '先观察眼前的情况，再决定下一步。改动一个数值，看看行动有没有变化。',
      3: '找找哪些动作会重复。先让一组动作跑通，再把它放进循环。',
      4: '每轮都要重新看一眼条件。想清楚它什么时候改变，英雄什么时候停下来。',
    }
    lines.push({ speaker: 'mentor', text: design.quest || sectionLines[design.section] })
  }
  return lines.filter(line => line.text)
}

function replayLines (design, hero, guards, now) {
  let speech = []
  try { speech = JSON.parse(hero?.teachingSpeechLog || '[]') } catch (_) {}
  if (!Array.isArray(speech)) speech = []
  const lines = speech.filter(e => typeof e.text === 'string' && Number.isFinite(e.time) && e.time <= now)
    .map((e, index) => ({ speaker: 'hero', text: e.text, time: e.time, key: `hero:${index}:${e.time}` }))
  for (const guard of guards) {
    if (!guard?.teachingGateMessage || !Number.isFinite(guard.teachingGateMessageAt) || guard.teachingGateMessageAt > now) continue
    lines.push({ speaker: 'guard', text: guard.teachingGateMessage, time: guard.teachingGateMessageAt, key: `guard:${guard.id}:${guard.teachingGateMessageAt}:${guard.teachingGateMessage}` })
  }
  return lines.sort((a, b) => a.time - b.time).slice(-20)
}

module.exports = { portraits, introFor, replayLines }
