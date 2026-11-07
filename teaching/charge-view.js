// Visuals follow the independent plate states recorded by the simulation.
function chargeState (hero) {
  try { return JSON.parse(hero?.teachingCharge || 'null') || { plates: [], lit: 0, complete: false } } catch (_) { return { plates: [], lit: 0, complete: false } }
}
function runeProgress (plate, state) {
  return Math.max(0, Math.min(1, (state?.elapsed || 0) / plate.seconds))
}
function drawChargePlates (floor, g, d, hero, world, camera) {
  if (!d.chargePlates?.length) return []
  const state = chargeState(hero); const z = 10 * camera.zoom; const ys = camera.y2x
  const point = at => camera.worldToCanvas({ x: at[0], y: at[1] }); const labels = []
  const litColor = '#9effd4'; const activeColor = '#ffe19a'
  d.chargePlates.forEach((plate, i) => {
    const current = state.plates[i] || {}; const p = point(plate.at)
    const next = point(d.chargePlates[i + 1]?.at || d.exit)
    const r = 3.8 * z; const drop = current.occupied ? 0.3 * z : 0
    floor.setStrokeStyle(5).beginStroke('#333c37').moveTo(p.x, p.y + r * ys).lineTo(next.x, next.y + r * ys).endStroke()
    floor.setStrokeStyle(2).beginStroke(current.complete ? litColor : '#6e806b').moveTo(p.x, p.y + r * ys).lineTo(next.x, next.y + r * ys).endStroke()
    floor.setStrokeStyle(3).beginStroke('#978568').beginFill('#242c2d').moveTo(p.x - r, p.y).lineTo(p.x, p.y - r * ys).lineTo(p.x + r, p.y).lineTo(p.x, p.y + r * ys).closePath().endFill().endStroke()
    const inner = r * 0.78
    floor.setStrokeStyle(2).beginStroke(current.complete ? litColor : current.occupied ? activeColor : '#b4a37b').beginFill(current.complete ? '#365d4c' : '#4a514b').moveTo(p.x - inner, p.y + drop).lineTo(p.x, p.y - inner * ys + drop).lineTo(p.x + inner, p.y + drop).lineTo(p.x, p.y + inner * ys + drop).closePath().endFill().endStroke()
    // One wall-mounted rune per plate, connected to the slab below it.
    const rail = point(plate.railAt || [plate.at[0], plate.at[1] + 14]); const x = rail.x; const y = rail.y + 0.5 * z
    const radius = 1.35 * z; const width = radius * 2.8
    floor.setStrokeStyle(5).beginStroke('#484d43').moveTo(p.x, p.y).lineTo(x, y + radius * 1.6).endStroke()
    floor.setStrokeStyle(2).beginStroke(current.complete ? litColor : current.occupied ? activeColor : '#77816b').moveTo(p.x, p.y).lineTo(x, y + radius * 1.6).endStroke()
    g.setStrokeStyle(2).beginStroke('#9a896a').beginFill('#242c2d').drawRoundRect(x - width / 2, y - radius * 1.6, width, radius * 3.2, radius * 0.4).endFill().endStroke()
    const progress = runeProgress(plate, current); const lit = current.complete
    g.setStrokeStyle(2).beginStroke('#59605b').beginFill(lit ? '#244b40' : '#171e20').drawCircle(x, y, radius).endFill().endStroke()
    if (progress > 0) {
      const angle = -Math.PI / 2 + Math.PI * 2 * progress
      g.setStrokeStyle(3).beginStroke(lit ? litColor : activeColor).arc(x, y, radius, -Math.PI / 2, angle).endStroke()
      if (!lit) g.beginFill('#fff6cf').drawCircle(x + Math.cos(angle) * radius, y + Math.sin(angle) * radius, Math.max(2, z * 0.28)).endFill()
    }
    const rr = radius * 0.48
    g.setStrokeStyle(2).beginStroke(lit ? '#cbffe9' : '#68766d').moveTo(x, y - rr).lineTo(x - rr * 0.6, y).lineTo(x, y + rr).lineTo(x + rr * 0.6, y).closePath().endStroke()
    if (i > 0) g.setStrokeStyle(2).beginStroke(lit ? '#cbffe9' : '#68766d').moveTo(x - rr, y + (i === 2 ? rr * 0.5 : 0)).lineTo(x + rr, y - (i === 2 ? rr * 0.5 : 0)).endStroke()
    const broken = !lit && !current.occupied && current.interruptedAt >= 0 ? Math.max(0, 1 - (world.age - current.interruptedAt) / 0.8) : 0
    if (broken > 0) g.setStrokeStyle(2).beginStroke(`rgba(255,160,110,${broken})`).drawCircle(x, y, radius * (1.1 + (1 - broken) * 0.35)).endStroke()
    labels.push({ text: `${plate.seconds} 秒`, x, y: y - radius * 2.6, color: '#d7c6a0' })
  })
  return labels
}
module.exports = { chargeState, runeProgress, drawChargePlates }
