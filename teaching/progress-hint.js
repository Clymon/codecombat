const { taskFeedback } = require('./task-feedback')
const parse = value => { try { return JSON.parse(value || '{}') } catch (_) { return {} } }
const near = (hero, at) => hero?.pos && at && Math.hypot(hero.pos.x - at[0], hero.pos.y - at[1]) < 1
// Read only the displayed frame: the engine's final victory may already be known.
function progressHint (design, hero, world) {
  if (!hero?.pos) return { stage: 'loading', title: '正在读取现场', text: '关卡载入后，这里会根据人物的位置和已完成的事情给出提示。' }
  if (hero.teachingFailure) return { stage: 'error', title: '先处理这次遇到的问题', text: hero.teachingFailure + ' 对照当前执行行修改代码，再运行观察。' }
  if (hero.teachingExitStartedAt >= 0 && world.age >= hero.teachingExitStartedAt) return { stage: 'done', title: '现场任务已完成', text: '程序已完成送达。点击“提交”保存验收结果，然后回小屋。' }
  if (design.stringMission) return require('./string-view').stringHint(design, hero)
  const tag = design.sensor?.tag
  if (tag) {
    const opened = parse(hero.teachingTag); const reading = parse(hero.teachingObservation)
    if (tag.requiresOpen && opened.openedAt == null) {
      if (opened.startedAt != null) return { stage: 'opening', title: '正在拆封', text: '人物正在开盖、取下纸签。这条动作结束后，程序才会执行下一行，不用额外加 wait。' }
      if (!near(hero, [tag.at[0], tag.at[1] - 12])) return { stage: 'approach', title: '先走到货箱前', text: '找到仍封着的货箱，走到它正下方紧邻的一格。移动不会自动拆封。', objectId: 'tag' }
      return { stage: 'open', title: '已经站到货箱前了', text: '在接下来的代码中拆封。运行时观察人物转身、开盖和取签。', code: `hero.openTag("${tag.name}")`, objectId: 'tag' }
    }
    if (reading.name !== 'readTag') return { stage: 'read', title: '纸签已经拿到了', text: '把纸签上的完整文字读到变量中，再处理其中的字符。', code: `label = readTag("${tag.name}")`, objectId: 'tag' }
    const gate = (design.gates || []).find(g => !['open', 'opening'].includes(world.getThangByID(g.id)?.teachingGateStatus))
    if (gate) {
      const first = gate.tagAnswer === 'first'; const place = first ? '区域岗' : '尾号岗'
      const observed = `这次读到：${reading.value}。`
      if (!near(hero, gate.approach)) return { stage: 'walk-' + gate.id, title: `前往${place}`, text: `${observed}走到${place}守卫正前方紧邻的一格，再发言。${first ? '' : '区域岗已经放行；这次核对的是最后一个字符，不能沿用上一句首字。'}`, objectId: 'gate-' + gate.id }
      return { stage: 'say-' + gate.id, title: `${place}正在等你回答`, text: `${observed}${first ? '从保存的字符串取第一个字符，位置从0开始。' : '从保存的字符串取最后一个字符；负索引从末尾倒数。'}用 print 或 hero.say 报给面前的守卫。`, objectId: 'gate-' + gate.id }
    }
    return { stage: 'deliver', title: '两个核验口都已放行', text: '带着纸签走到亮起的法阵中央。只得到守卫放行还不算送达。', objectId: 'exit' }
  }
  const feedback = taskFeedback(design, hero, world)
  return { stage: 'task', title: feedback.title || '下一步做什么', text: [feedback.status || design.quest || design.description, feedback.observation].filter(Boolean).join('。') }
}
module.exports = { progressHint }
