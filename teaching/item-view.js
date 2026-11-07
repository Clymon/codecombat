function itemState (d, hero) {
  if (!d.inventory) return null
  try { return JSON.parse(hero?.teachingInventory || 'null') || { claimed: false, bag: 0, receivers: d.inventory.receivers } } catch (_) { return null }
}
function itemFeedback (d, hero) {
  const state = itemState(d, hero)
  if (!state) return null
  const pending = state.receivers.find(r => !r.delivered)
  const target = !state.claimed ? d.inventory.supply.approach : pending?.approach || d.exit
  const title = `${d.inventory.item}背包：${state.bag} ${d.inventory.unit}`
  const status = !state.claimed ? '打开身旁的补给箱，领取物品' : pending ? `${pending.name}还需要 ${pending.amount} ${d.inventory.unit}，走近后交付` : '物品已交齐，出口启动'
  return { title, status, target, observation: '' }
}
function drawItems (g, foreground, d, hero, world, camera) {
  const state = itemState(d, hero)
  if (!state) return []
  const point = at => camera.worldToCanvas({ x: at[0], y: at[1] }); const z = 10 * camera.zoom; const labels = []
  const box = d.inventory.supply; const p = point(box.at); const w = 3.4 * z; const h = 2.2 * z
  // Hinged wooden chest, shown empty after the real transfer.
  g.setStrokeStyle(2).beginStroke('#302317').beginFill('#865531').drawRoundRect(p.x - w, p.y - h, w * 2, h * 1.5, 3).endFill().endStroke()
  g.beginFill('#cba362').drawRect(p.x - w * 0.75, p.y - h, w * 0.17, h * 1.5).drawRect(p.x + w * 0.58, p.y - h, w * 0.17, h * 1.5).endFill()
  g.setStrokeStyle(2).beginStroke('#d7ad68').beginFill(state.claimed ? '#3b281c' : '#a37440').drawRoundRect(p.x - w, p.y - h * (state.claimed ? 2 : 1.2), w * 2, h * (state.claimed ? 1 : 0.45), 3).endFill().endStroke()
  if (!state.claimed) for (let i = 0; i < Math.min(box.count, 6); i++) { g.beginFill(d.inventory.item === '金币' ? '#ffcf55' : '#75e4ea').drawCircle(p.x + (i - (Math.min(box.count, 6) - 1) / 2) * z * 0.75, p.y - h * 1.5, z * 0.28).endFill() }
  labels.push({ text: `${box.name}\n${state.claimed ? '已领完' : box.count + d.inventory.unit}`, x: p.x, y: p.y - h * 2.5, color: '#ffe4aa' })
  state.receivers.forEach((r, i) => {
    const q = point(r.at); const lit = r.delivered
    if (r.kind !== 'npc') {
      const radius = 2.8 * z
      // An iron bowl on a stone base: empty sockets remain visible before filling.
      g.beginFill('#171614').drawEllipse(q.x - radius * 1.2, q.y, radius * 2.4, z * 1.4).endFill()
      g.setStrokeStyle(2).beginStroke('#352b24').beginFill('#68645a').drawRoundRect(q.x - radius, q.y - z, radius * 2, z * 2, z * 0.3).endFill().endStroke()
      g.beginFill('#403c35').drawRect(q.x - radius * 0.75, q.y + z * 0.65, z * 0.5, z * 0.65).drawRect(q.x + radius * 0.58, q.y + z * 0.65, z * 0.5, z * 0.65).endFill()
      g.setStrokeStyle(3).beginStroke(lit ? '#b6d1af' : '#c2a176').beginFill('#181d20').drawEllipse(q.x - radius, q.y - z * 1.7, radius * 2, z * 2).endFill().endStroke()
      for (let n = 0; n < Math.min(r.amount, 6); n++) {
        const x = q.x + (n - (Math.min(r.amount, 6) - 1) / 2) * z * 0.8
        g.setStrokeStyle(1).beginStroke('#739ba0').beginFill(lit ? '#7de9ee' : '#070d10').moveTo(x, q.y - z * 1.15).lineTo(x + z * 0.3, q.y - z * 0.65).lineTo(x, q.y - z * 0.25).lineTo(x - z * 0.3, q.y - z * 0.65).closePath().endFill().endStroke()
      }
      if (lit && r.name === '炉座') {
        const flicker = Math.sin(world.age * 8 + i * 2) * z * 0.22
        g.beginFill('#268f9e').moveTo(q.x - z, q.y - z).bezierCurveTo(q.x - z * 1.3, q.y - z * 2.2, q.x + flicker, q.y - z * 2.8, q.x - z * 0.2, q.y - z * 3.7).bezierCurveTo(q.x + z * 1.8, q.y - z * 2.4, q.x + z, q.y - z * 1.8, q.x + z, q.y - z).closePath().endFill()
        g.beginFill('#bcfff2').moveTo(q.x - z * 0.4, q.y - z).quadraticCurveTo(q.x - z * 0.5, q.y - z * 1.7, q.x + flicker, q.y - z * 2.4).quadraticCurveTo(q.x + z * 0.8, q.y - z * 1.5, q.x + z * 0.4, q.y - z).closePath().endFill()
      }
      const to = point(i < state.receivers.length - 1 ? state.receivers[i + 1].at : d.exit)
      g.setStrokeStyle(2).beginStroke(lit ? '#abffc7' : '#736a58').moveTo(q.x, q.y + 2.5 * z).lineTo(to.x, to.y + 2.5 * z).endStroke()
    }
    labels.push({ text: `${r.name}${r.name === '炉座' ? i + 1 : ''}\n${lit ? '已交齐' : '需' + r.amount + d.inventory.unit}`, x: q.x, y: q.y - (r.kind === 'npc' ? 10 : r.name === '炉座' ? 6 : 4) * z, color: lit ? '#baffcb' : '#ffe4aa' })
  })
  const e = state.event; const t = e ? (world.age - e.at) / 0.7 : -1
  if (e?.count > 0 && t >= 0 && t <= 1) {
    const a = point(e.from); const b = point(e.to)
    for (let n = 0; n < Math.min(e.count, 5); n++) {
      const u = Math.max(0, Math.min(1, t * 1.25 - n * 0.06))
      foreground.beginFill(d.inventory.item === '金币' ? '#ffdc67' : '#8efaff').drawCircle(a.x + (b.x - a.x) * u + n * 2, a.y + (b.y - a.y) * u - Math.sin(u * Math.PI) * 5 * z, Math.max(3, z * 0.4)).endFill()
    }
  }
  return labels
}
module.exports = { itemState, itemFeedback, drawItems }
