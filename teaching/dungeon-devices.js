// Ground props are rendered below actors. Only light and departure sparks are foreground.
const { exitPose } = require('./exit-effects')
function drawDungeonDevices (g, d, hero, world, camera, foreground) {
  const z = 10 * camera.zoom; const ys = camera.y2x
  const point = at => camera.worldToCanvas({ x: at[0], y: at[1] })
  const diamond = (p, r, color, fill) => g.setStrokeStyle(2).beginStroke(color).beginFill(fill)
    .moveTo(p.x, p.y - r * ys).lineTo(p.x + r, p.y).lineTo(p.x, p.y + r * ys).lineTo(p.x - r, p.y).closePath().endFill().endStroke()
  // A dark iron socket makes the full three-metre hazard footprint readable.
  // Points and damage still share d.hazards; this adds no new collision area.
  for (const at of d.hazards || []) {
    const p = point(at); const r = 3 * z
    g.setStrokeStyle(2).beginStroke('#b16d4d').beginFill('#252623')
      .drawEllipse(p.x - r, p.y - r * ys, 2 * r, 2 * r * ys).endFill().endStroke()
    for (const [dx, dy] of [[-2, 0], [2, 0], [0, -2], [0, 2]]) { g.beginFill('#c48b62').drawCircle(p.x + dx * z, p.y + dy * z * ys, Math.max(2, z * 0.15)).endFill() }
  }
  const plates = (d.checkpoints || []).filter(at => !(d.gates || []).some(g => g.approach[0] === at[0] && g.approach[1] === at[1]))
  for (const at of plates) {
    const n = d.checkpoints.indexOf(at); const lit = (hero?.teachingCheckpointCount || 0) > n; const p = point(at); const r = 2 * z
    diamond(p, r, '#24261f', '#5b5847')
    diamond({ x: p.x, y: p.y + (lit ? 3 : 0) }, r * 0.7, lit ? '#99dcb2' : '#9b8963', lit ? '#36614c' : '#403e33')
    g.setStrokeStyle(2).beginStroke(lit ? '#aaf6c8' : '#b6a477').moveTo(p.x - r * 0.3, p.y).lineTo(p.x, p.y - r * 0.24).lineTo(p.x + r * 0.3, p.y).endStroke()
  }
  for (let i = 0; i < (d.switches || []).length; i++) {
    const p = point(d.switches[i].at); const r = 2.3 * z; const lit = (hero?.teachingPressedCount || 0) > i
    diamond(p, r, '#252820', '#7d7156')
    diamond({ x: p.x, y: p.y + 3 }, r * 0.78, lit ? '#a9e8bd' : '#7bcddd', lit ? '#315e48' : '#464437')
    for (const side of [-1, 1])g.beginFill(lit ? '#b9ffd4' : '#201f1b').drawCircle(p.x + side * r * 0.7, p.y, 2.5).endFill()
  }
  for (const sw of d.decoySwitches || []) {
    const p = point(sw.at); const r = 2.3 * z
    diamond(p, r, '#db6e61', '#55342e')
    g.setStrokeStyle(3).beginStroke('#ff9e82').moveTo(p.x - r * 0.4, p.y - r * 0.25).lineTo(p.x + r * 0.4, p.y + r * 0.25).moveTo(p.x + r * 0.4, p.y - r * 0.25).lineTo(p.x - r * 0.4, p.y + r * 0.25).endStroke()
    // A broken red branch ends in a ground symbol, outside the blue exit circuit.
    const end = point([sw.at[0], sw.at[1] - 6])
    g.setStrokeStyle(2).beginStroke('#d87865').moveTo(p.x, p.y).lineTo(end.x, end.y).endStroke()
    for (let i = 0; i < 3; i++) g.setStrokeStyle(2).beginStroke('#d87865').moveTo(end.x - (10 - i * 3) * camera.zoom, end.y + i * 4).lineTo(end.x + (10 - i * 3) * camera.zoom, end.y + i * 4).endStroke()
  }
  if (d.exitStyle === 'post') return
  const p = point(d.exit); const ready = !!hero?.teachingExitReady; const age = world.age || 0
  const pose = exitPose(d, hero?.teachingExitStartedAt, age)
  const opening = ready ? Math.min(1, Math.max(0, (age - (hero?.teachingExitOpenedAt ?? age)) / 0.7)) : 0
  const light = ready ? '#a8f0dd' : '#ac9674'
  if (d.exitStyle === 'stairs') {
    const dir = d.exitDirection || [1, 0]; const side = [-dir[1], dir[0]]
    // Local u follows the corridor; the entrance lip is exactly at the stopping tile.
    const q = (u, v, depth = 0) => { const pt = point([d.exit[0] + dir[0] * u + side[0] * v, d.exit[1] + dir[1] * u + side[1] * v]); return { x: pt.x, y: pt.y + depth * z } }
    const polygon = (pts, fill, stroke = '#39362d', width = 1) => { g.setStrokeStyle(width).beginStroke(stroke).beginFill(fill).moveTo(pts[0].x, pts[0].y); for (const pt of pts.slice(1))g.lineTo(pt.x, pt.y); g.closePath().endFill().endStroke() }
    polygon([q(-1.2, -3.2), q(5.2, -3.2), q(5.2, 3.2), q(-1.2, 3.2)], '#98866a', '#302c25', 2)
    polygon([q(-0.6, -2.5), q(4.6, -2.5), q(4.6, 2.5), q(-0.6, 2.5)], '#121919')
    // Each tread has a lit nose and a darker riser; perspective and shading indicate down.
    for (let i = 5; i >= 0; i--) {
      const u = -0.5 + i * 0.8; const depth = i * 0.22; const shade = ['#c0ad87', '#aa9876', '#8b8066', '#6c6855', '#4a5046', '#303c36'][i]
      polygon([q(u, -2.35, depth), q(u + 0.75, -2.35, depth), q(u + 0.75, 2.35, depth), q(u, 2.35, depth)], shade, '#222922')
      const a = q(u, -2.35, depth); const b = q(u, 2.35, depth)
      g.setStrokeStyle(2).beginStroke(i < 2 ? '#e2cc9c' : '#9b967a').moveTo(a.x, a.y).lineTo(b.x, b.y).endStroke()
    }
    // The two jambs follow the opening instead of lying across the hero's body.
    for (const v of [-3, 3])polygon([q(-1, v - 0.22), q(5, v - 0.22), q(5, v + 0.22), q(-1, v + 0.22)], '#b5a17d', '#514a39')
    const a = q(-0.95, -2.6); const b = q(-0.95, 2.6)
    g.setStrokeStyle(3).beginStroke(light).moveTo(a.x, a.y).lineTo(b.x, b.y).endStroke()
    if (opening < 1) {
      for (let v = -2; v <= 2; v += 1) { const a = q(-0.5, v); const b = q(4.1 * (1 - opening), v); g.setStrokeStyle(2).beginStroke('#acac97').moveTo(a.x, a.y).lineTo(b.x, b.y).endStroke() }
    }
  } else if (['portal', 'beacon'].includes(d.exitStyle)) {
    const r = 3.6 * z; const pulse = 1 + Math.sin(age * 2.5) * 0.035
    g.setStrokeStyle(4).beginStroke('#716e59').beginFill('#253b38').drawEllipse(p.x - r, p.y - r * ys, r * 2, r * 2 * ys).endFill().endStroke()
    for (const k of [0.77, 1])g.setStrokeStyle(k === 1 ? 3 : 2).beginStroke(ready ? '#a9f6e3' : '#807967').drawEllipse(p.x - r * k * pulse, p.y - r * ys * k * pulse, r * 2 * k * pulse, r * 2 * ys * k * pulse).endStroke()
    for (let i = 0; i < 8; i++) {
      const a = i * Math.PI / 4; const rx = Math.cos(a); const ry = Math.sin(a)
      const x = p.x + rx * r * 0.88; const y = p.y + ry * r * 0.88 * ys
      g.setStrokeStyle(2).beginStroke(light).moveTo(x - ry * 3, y + rx * 3 * ys).lineTo(x + ry * 3, y - rx * 3 * ys).endStroke()
    }
    // A standing crystal distinguishes a transport circle from an ordinary floor switch.
    if (d.exitStyle === 'beacon') {
      const c = { x: p.x - 3.8 * z, y: p.y - 2 * z }
      diamond(c, 0.75 * z, light, ready ? '#83d8c6' : '#7f8c79')
    }
    if (foreground && pose.active && pose.progress < 1) {
      const fade = Math.sin(pose.progress * Math.PI)
      foreground.setStrokeStyle(2).beginStroke(`rgba(182,255,229,${fade * 0.9})`).drawEllipse(p.x - r * pose.progress, p.y - r * ys * pose.progress, r * 2 * pose.progress, r * 2 * ys * pose.progress).endStroke()
      for (let i = 0; i < 10; i++) {
        const a = i * 2.4 + pose.progress * 2; const x = p.x + Math.cos(a) * r * 0.7; const y = p.y - Math.sin(pose.progress * Math.PI) * z * (1 + i % 4) + Math.sin(a) * r * ys * 0.6
        foreground.beginFill(`rgba(190,255,234,${fade})`).drawCircle(x, y, 2 + i % 2).endFill()
      }
    }
  } else {
    // A shield-shaped landing marker means "remain here"; no fake exit or disappearance.
    diamond(p, 3.1 * z, ready ? '#b9d8ab' : '#a79870', '#4c4c39')
    const r = 1.2 * z
    g.setStrokeStyle(3).beginStroke(ready ? '#d1f4b8' : '#c5b17b').moveTo(p.x - r, p.y - r * 0.3 * ys).lineTo(p.x, p.y + r * 0.7 * ys).lineTo(p.x + r, p.y - r * 0.8 * ys).endStroke()
    if (pose.active) { const r = (2.8 + pose.progress) * z; g.setStrokeStyle(2).beginStroke(`rgba(203,241,161,${1 - pose.progress})`).drawEllipse(p.x - r, p.y - r * ys, 2 * r, 2 * r * ys).endStroke() }
  }
  const sockets = []
  for (const at of plates)sockets.push((hero?.teachingCheckpointCount || 0) > d.checkpoints.indexOf(at))
  for (let i = 0; i < (d.switches || []).length; i++)sockets.push((hero?.teachingPressedCount || 0) > i)
  for (let i = 0; i < (d.gems || []).length; i++) { const gem = world.getThangByID(`Parcel ${i + 1}`); sockets.push(ready || (!!gem && gem.exists === false)) }
  for (const gate of d.gates || []) if (!gate.locked)sockets.push(world.getThangByID(gate.id)?.teachingGateStatus === 'open')
  sockets.forEach((lit, i) => {
    const x = p.x + (i - (sockets.length - 1) / 2) * 10; const y = p.y + 4.2 * z * ys
    g.setStrokeStyle(2).beginStroke('#83775e').beginFill(lit ? '#a7f6be' : '#252a22').drawCircle(x, y, 3).endFill().endStroke()
  })
}
module.exports = { drawDungeonDevices }
