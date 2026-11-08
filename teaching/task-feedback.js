// The cue and world highlights read the same replay state as the actual goals.
const { chargeState } = require('./charge-view')
const { itemFeedback } = require('./item-view')
function taskFeedback (d, hero, world) {
  if (hero?.teachingFailure?.includes('接地线，压下后短路')) return { title: '电路短路', status: '红板连着接地线；重新选择蓝色供电开关', target: null, observation: '' }
  if (d.chargePlates?.length) {
    const state = chargeState(hero)
    const interrupted = state.plates.some(p => !p.complete && p.interruptedAt >= 0)
    return { title: `石板：${state.lit} / ${d.chargePlates.length}`, status: state.complete ? '全部石板亮起，出口已开启' : state.occupied ? '当前石板充能中；亮起后去下一块' : interrupted ? '还有暗着的石板，停留1秒即可点亮' : '每块石板停留1秒，逐块接通出口', target: null, observation: '' }
  }
  if (d.inventory) {
    const state = itemFeedback(d, hero)
    try { state.observation = JSON.parse(hero?.teachingObservation || '{}').text || '' } catch (_) {}
    return state
  }
  const plates = d.switches?.length ? d.switches.map(s => s.at) : d.checkpoints || []
  const count = d.switches?.length ? hero?.teachingPressedCount || 0 : hero?.teachingCheckpointCount || 0
  const missingGem = (d.gems || []).find((at, i) => world.getThangByID(`Parcel ${i + 1}`)?.exists !== false)
  let title = ''; let status = ''; let target = d.exit
  if (d.powerCircuit) {
    title = d.switches?.length ? '启动开关，接通出口' : '踩亮石板，给出口供能'
    target = plates[count] || d.exit
    const atPlate = hero?.pos && Math.hypot(hero.pos.x - target[0], hero.pos.y - target[1]) < 1
    status = `${count} / ${plates.length} 已点亮 · ` + (count === plates.length ? '线路已接通，出口启动' : d.switches?.length && atPlate ? `按下脚下 ${d.switches[count].number} 号：hero.press(编号)` : '下一块石板正在闪光')
  } else if (d.index === 9) {
    title = '开放才取补给，最后向下撤离'
    status = d.sensor?.open?.right ? (missingGem ? '右侧有宝石，取回后返回岔口' : '补给已取得，去下方撤离点') : '门岗关闭，跳过取物，向下撤离'
    target = missingGem || d.exit
  } else if ([10, 11, 12].includes(d.index)) {
    title = d.index === 10 ? '选择开放路线，带宝石离开' : d.index === 11 ? '门开且没有尖刺，才走右路' : '读取徽章能量，选择对应通道'
    status = missingGem ? '守卫挡住的路不能通过；法阵是终点' : '宝石已取得，在法阵上停下'
    // Don't draw an answer arrow through a branch before the student observes it.
    target = null
  }
  let observation = ''
  try { observation = JSON.parse(hero?.teachingObservation || '{}').text || '' } catch (_) {}
  let learning = {}
  try { learning = JSON.parse(hero?.teachingLearning || '{}') } catch (_) {}
  const iterations = Math.max(0, ...Object.values(learning.iterations || {}))
  if (d.powerCircuit && iterations) observation = `for 第 ${iterations} 次执行${observation ? ' · ' + observation : ''}`
  if (hero?.teachingExitStartedAt >= 0) status = d.scenarioTitles?.length > 1 ? `场景 ${(d.scenarioIndex || 0) + 1} / ${d.scenarioTitles.length} 完成 · 提交后继续验证` : '任务完成，正在离开'
  return { title, status, target, observation }
}
function drawTaskFeedback (floor, fg, d, hero, world, camera, state) {
  const point = at => camera.worldToCanvas({ x: at[0], y: at[1] }); const z = 10 * camera.zoom
  if (d.powerCircuit) {
    const plates = d.switches?.length ? d.switches.map(s => s.at) : d.checkpoints || []
    const count = d.switches?.length ? hero?.teachingPressedCount || 0 : hero?.teachingCheckpointCount || 0
    const nodes = [d.start, ...plates, d.exit]
    for (let i = 1; i < nodes.length; i++) {
      const a = point([nodes[i - 1][0], nodes[i - 1][1] + 3]); const b = point([nodes[i][0], nodes[i][1] + 3]); const lit = count >= Math.min(i, plates.length)
      floor.setStrokeStyle(5).beginStroke('#272e30').moveTo(a.x, a.y).lineTo(b.x, b.y).endStroke()
      floor.setStrokeStyle(2).beginStroke(lit ? '#a7f6be' : '#817b67').moveTo(a.x, a.y).lineTo(b.x, b.y).endStroke()
      if (lit) { const t = ((world.age || 0) * 0.8) % 1; floor.beginFill('#edffe7').drawCircle(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t, 3).endFill() }
    }
  }
  if (d.powerCircuit) {
    const plates = d.switches?.length ? d.switches.map(s => s.at) : d.checkpoints || []
    const count = d.switches?.length ? hero?.teachingPressedCount || 0 : hero?.teachingCheckpointCount || 0
    plates.forEach((at, i) => {
      const a = point([at[0], at[1] + 3]); const b = point(at)
      floor.setStrokeStyle(2).beginStroke(i < count ? '#a7f6be' : '#817b67').moveTo(a.x, a.y).lineTo(b.x, b.y).endStroke()
    })
  }
  if (d.visualTask) {
    for (const gate of d.gates || []) {
      const open = world.getThangByID(gate.id)?.teachingGateStatus === 'open' || gate.openedAt != null
      const p = point(gate.at); const horizontal = gate.at[0] !== gate.approach[0]; const r = 3.5 * z
      const dx = horizontal ? 0 : r; const dy = horizontal ? r * camera.y2x : 0
      floor.setStrokeStyle(open ? 2 : 5).beginStroke(open ? '#9cdbbb' : '#ff8066').moveTo(p.x - dx, p.y - dy).lineTo(p.x + dx, p.y + dy).endStroke()
      if (!open) { floor.setStrokeStyle(3).beginStroke('#ffd0a5').moveTo(p.x - 4, p.y - 4).lineTo(p.x + 4, p.y + 4).moveTo(p.x - 4, p.y + 4).lineTo(p.x + 4, p.y - 4).endStroke() }
    }
  }
  if (state.target && hero?.teachingExitStartedAt < 0) {
    const p = point(state.target); const pulse = 1 + Math.sin((world.age || 0) * 4) * 0.12; const r = 3.6 * z * pulse
    floor.setStrokeStyle(2).beginStroke('#ffe28c').drawEllipse(p.x - r, p.y - r * camera.y2x, r * 2, r * 2 * camera.y2x).endStroke()
  }
}
module.exports = { taskFeedback, drawTaskFeedback }
