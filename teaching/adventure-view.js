// Effects are derived exclusively from the current replay frame.
function drawAdventure (g, ground, design, hero, world, camera, surface) {
  if (!design.adventure) return []
  const state = JSON.parse(hero?.teachingAdventure || 'null')
  if (!state) return []
  const labels = []; const z = camera.zoom
  const at = p => camera.worldToCanvas({ x: p[0], y: p[1] })
  const label = (text, p, color = '#fff3d5', offset = 0) => labels.push({ text, x: p.x, y: p.y + offset, color })
  const health = (p, value, max, color) => {
    g.setStrokeStyle(1).beginStroke('#dfd0ae').beginFill('#241819').drawRoundRect(p.x - 29, p.y - 7, 58, 7, 2).endFill().endStroke()
    g.beginFill(color).drawRect(p.x - 28, p.y - 6, 56 * Math.max(0, value / max), 5).endFill()
  }
  for (const a of state.actors) {
    const p = at(a.at); const t = world.getThangByID(a.id); const lank = surface.lankBoss.lanks[a.id]
    // Frame-driven alpha also restores hidden reinforcements when scrubbing backwards.
    if (lank?.sprite) {
      const alpha = a.kind === 'signal' ? (a.lit ? 1 : 0) : !a.active ? 0 : a.kind === 'door' && !a.alive ? 0 : 1
      lank.sprite.alpha = alpha
      if (lank.healthBar) lank.healthBar.alpha = 0
    }
    if (a.kind === 'signal') {
      ground.setStrokeStyle(2).beginStroke(a.lit ? '#ffd36d' : '#7d897e').beginFill('#343738').drawEllipse(p.x - 20 * z, p.y - 8 * z, 40 * z, 16 * z).endFill().endStroke()
      if (a.lit) ground.beginFill('rgba(255,181,57,0.18)').drawEllipse(p.x - 35 * z, p.y - 14 * z, 70 * z, 28 * z).endFill()
      else g.setStrokeStyle(3).beginStroke('#a3a093').moveTo(p.x - 12 * z, p.y - 12 * z).lineTo(p.x, p.y - 4 * z).lineTo(p.x + 12 * z, p.y - 12 * z).endStroke()
      continue
    }
    if (!a.active) {
      if (a.spawnAt - world.age < 1.2 && a.spawnAt > world.age) ground.setStrokeStyle(2).beginStroke('#ef885f').drawEllipse(p.x - 21 * z, p.y - 9 * z, 42 * z, 18 * z).endStroke()
      continue
    }
    if (!a.alive) {
      if (a.kind === 'door') {
        ground.setStrokeStyle(5 * z).beginStroke('#aa8253')
        for (let i = 0; i < 5; i++) ground.moveTo(p.x - 18 * z + i * 8 * z, p.y + (i % 2 ? 4 : -5) * z).lineTo(p.x - 5 * z + i * 6 * z, p.y + (i % 2 ? -6 : 5) * z)
        ground.endStroke()
      }
      continue
    }
    const head = { x: p.x, y: p.y - (a.kind === 'door' ? 52 : 100) * z }
    health(head, a.hp, a.maxHealth, a.kind === 'ally' ? '#6ee2b0' : a.kind === 'door' ? '#f4bf66' : '#f16f64')
    label(`${a.id}  ${a.hp}`, head, a.kind === 'ally' ? '#9ff0c5' : '#ffe0c3', -23)
    if (a.alerted && state.mode === 'lure') label('!', head, '#ffba52', -46)
    if (t && a.released) ground.setStrokeStyle(2).beginStroke('#65ddb7').drawEllipse(p.x - 11 * z, p.y - 5 * z, 22 * z, 10 * z).endStroke()
  }
  if (state.camp) {
    const p = at(state.camp.at)
    health({ x: p.x, y: p.y + 20 }, state.camp.hp, state.camp.health, '#ffca68')
    label(`营火 ${state.camp.hp}`, p, '#ffe1a1', 26)
    const defeated = state.actors.filter(a => !a.alive).length
    label(state.complete ? '营地守住了！' : `击退 ${defeated} / ${state.actors.length}`, { x: camera.canvasWidth / 2, y: 72 }, state.complete ? '#a0f3c4' : '#ffe3aa')
  }
  for (const e of state.events) {
    const elapsed = world.age - e.at
    if (elapsed < 0) continue
    const from = at(e.from); const to = at(e.to)
    if (e.kind === 'arrow' && elapsed < 0.25) {
      const t = elapsed / 0.25; const x = from.x + (to.x - from.x) * t; const y = from.y + (to.y - from.y) * t - 30 * z
      const angle = Math.atan2(to.y - from.y, to.x - from.x)
      g.setStrokeStyle(2).beginStroke('#fff2b7').moveTo(x - Math.cos(angle) * 15, y - Math.sin(angle) * 15).lineTo(x, y).endStroke()
      g.beginFill('#eee7cf').moveTo(x, y).lineTo(x - Math.cos(angle - 0.5) * 7, y - Math.sin(angle - 0.5) * 7).lineTo(x - Math.cos(angle + 0.5) * 7, y - Math.sin(angle + 0.5) * 7).closePath().endFill()
    }
    if (e.kind === 'swing' && elapsed < 0.4) {
      const angle = Math.atan2(to.y - from.y, to.x - from.x)
      g.setStrokeStyle(4).beginStroke(`rgba(255,237,172,${1 - elapsed / 0.4})`).arc(from.x, from.y - 24 * z, 26 * z, angle - 0.9 + elapsed * 3, angle + 0.4 + elapsed * 3).endStroke()
    }
    if (e.kind === 'warning' && elapsed < 0.3) ground.setStrokeStyle(2).beginStroke('#ef6651').drawEllipse(to.x - 17 * z, to.y - 7 * z, 34 * z, 14 * z).endStroke()
    if (['hit', 'trap'].includes(e.kind) && elapsed < 0.75) {
      label(`−${e.amount}`, { x: to.x + 22, y: to.y - 35 * z - elapsed * 25 }, '#ff9580')
      if (elapsed < 0.2) g.setStrokeStyle(3).beginStroke('#ffd2a2').drawCircle(to.x, to.y - 20 * z, 8 + elapsed * 40).endStroke()
    }
    if (['rescue', 'ignite', 'victory'].includes(e.kind) && elapsed < 1.2) {
      const radius = 12 + elapsed * 35
      ground.setStrokeStyle(2).beginStroke(`rgba(246,216,125,${1 - elapsed / 1.2})`).drawEllipse(to.x - radius, to.y - radius * 0.4, radius * 2, radius * 0.8).endStroke()
    }
  }
  return labels
}
module.exports = { drawAdventure }
