const parse = value => { try { return JSON.parse(value || '{}') } catch (_) { return {} } }
function stringHint (d, hero) {
  const s = parse(hero?.teachingStrings); const c = d.stringMission
  if (!s.read) return { stage: 'read-object', title: '先观察现场装置', text: `走到左侧${c.object}正下方一格。读取的是本次现场信息，每次可能不同。`, code: `text = hero.readObject("${c.object}")`, objectId: 'string-object' }
  if (s.complete) return { stage: 'deliver', title: '装置任务已完成', text: c.finish, objectId: 'exit' }
  if (s.cargo) return { stage: 'delivery', title: '物资已装车，还没有送到营地', text: `沿走廊到右侧旗帜正下方；车上是${s.cargo.count}份${s.cargo.item}。`, code: 'hero.deliver()', objectId: 'string-delivery' }
  return { stage: c.mode, title: c.object, text: `读到：${s.text}。${c.help}`, objectId: 'string-object' }
}
function drawStrings (g, ground, d, hero, world, camera) {
  const c = d.stringMission; if (!c) return []
  const s = parse(hero?.teachingStrings); const e = s.event; const labels = []; const z = camera.zoom
  const at = (x, y) => camera.worldToCanvas({ x, y })
  const p = at(...c.at); const time = world.age || 0
  const progress = e ? Math.max(0, Math.min(1, (time - e.startedAt) / e.duration)) : 0
  const label = (text, p, color = '#f6e5bd', offset = -52 * z) => labels.push({ text, x: p.x, y: p.y + offset, color, lineWidth: 240, lineHeight: 19 })
  const box = (p, w, h, color) => g.setStrokeStyle(2).beginStroke('#dacda9').beginFill(color).drawRoundRect(p.x - w / 2, p.y - h, w, h, 3).endFill().endStroke()
  // All missions have a recognisable, differently shaped interaction prop.
  if (c.mode === 'loom') {
    g.beginFill('#a55537').drawEllipse(p.x - 24 * z, p.y - 24 * z, 48 * z, 26 * z).endFill()
    g.setStrokeStyle(3).beginStroke('#f0d292').beginFill('#e3bb72').drawEllipse(p.x - 24 * z, p.y - 35 * z, 48 * z, 23 * z).endFill().endStroke()
  } else if (c.mode === 'rescue') {
    box(p, 42 * z, 38 * z, '#345867'); g.beginFill('#81e6cb').drawCircle(p.x, p.y - 23 * z, 12 * z).endFill()
  } else if (c.mode === 'purify') {
    box(p, 36 * z, 45 * z, '#527e76'); g.setStrokeStyle(5 * z).beginStroke('#abc5ad').moveTo(p.x, p.y - 45 * z).lineTo(p.x + 22 * z, p.y - 45 * z).lineTo(p.x + 22 * z, p.y - 20 * z).endStroke()
  } else {
    box(p, 43 * z, 30 * z, '#825936'); g.beginFill('#f3dfa3').drawRect(p.x - 17 * z, p.y - 39 * z, 34 * z, 20 * z).endFill()
  }
  label(c.object, p)
  if (s.read) label('“' + s.text + '”', p, '#9feddd', -79 * z)
  if (e && e.finishedAt == null && progress < 1) g.setStrokeStyle(3).beginStroke('#ffcf68').arc(p.x, p.y - 20 * z, 30 * z, time * 4, time * 4 + Math.PI * 1.6).endStroke()
  if (c.mode === 'bridge') {
    for (let i = 0; i < 3; i++) {
      const q = at(36 + i * 12, 12); const lit = s.complete || (e?.name === 'buildBridge' && !e.error && progress > (i + 1) / 3)
      ground.beginFill('#111921').drawEllipse(q.x - 40 * z, q.y - 22 * z, 80 * z, 44 * z).endFill()
      if (lit) { ground.setStrokeStyle(3).beginStroke('#b0b6a7').beginFill('#74847b').drawRoundRect(q.x - 38 * z, q.y - 17 * z, 76 * z, 34 * z, 3).endFill().endStroke(); label(s.text?.[i + 1] || '', q, '#b1faee', -8 * z) } else { ground.setStrokeStyle(2).beginStroke('#edbc74').moveTo(q.x - 24 * z, q.y - 14 * z).lineTo(q.x + 24 * z, q.y + 14 * z).endStroke() }
    }
  }
  if (c.mode === 'loom') {
    const lift = s.complete ? 1 : (e?.name === 'playTune' && !e.error ? Math.max(0, (progress - 0.8) / 0.2) : 0)
    const q = at(48, 12 + 12 * lift)
    box(q, 52 * z, 76 * z, '#666e75'); box({ x: q.x, y: q.y - 72 * z }, 38 * z, 33 * z, '#90978f')
    // Carved face, shoulders, arms and feet make a guardian rather than a panel.
    g.beginFill('#424c54').drawRect(q.x - 36 * z, q.y - 68 * z, 12 * z, 51 * z).drawRect(q.x + 24 * z, q.y - 68 * z, 12 * z, 51 * z).drawRect(q.x - 23 * z, q.y - 5 * z, 17 * z, 12 * z).drawRect(q.x + 6 * z, q.y - 5 * z, 17 * z, 12 * z).endFill()
    g.beginFill(s.complete ? '#b4ffe2' : '#27333a').drawRect(q.x - 12 * z, q.y - 91 * z, 7 * z, 4 * z).drawRect(q.x + 5 * z, q.y - 91 * z, 7 * z, 4 * z).endFill()
    g.setStrokeStyle(2 * z).beginStroke('#c5ccbb').moveTo(q.x - 8 * z, q.y - 81 * z).lineTo(q.x + 8 * z, q.y - 81 * z).endStroke()
    for (let i = 0; i < 8; i++) {
      const hit = e?.name === 'playTune' && (s.complete || progress * e.duration >= i * 0.35)
      const wrong = hit && e.error && progress === 1 && i === Math.round(e.duration / 0.35) - 1
      g.beginFill(wrong ? '#ff625a' : hit ? '#ffe486' : '#323f45').drawCircle(q.x + (i % 4 - 1.5) * 12 * z, q.y - (56 - Math.floor(i / 4) * 15) * z, 4 * z).endFill()
    }
    label(s.complete ? '石像让路了' : '●●  ●●  ●●  ↶', q, '#ffe199', -125 * z)
    if (e?.name === 'playTune' && progress < 1) ground.setStrokeStyle(2).beginStroke('#eac665').drawEllipse(p.x - 45 * z * progress, p.y - 20 * z * progress, 90 * z * progress, 40 * z * progress).endStroke()
  }
  if (c.mode === 'rescue') {
    for (let i = 0; i < 6; i++) {
      let q = at(36 + i * 12, 36); const saved = (s.rescued || []).includes(i)
      ground.beginFill('#14191f').drawEllipse(q.x - 30 * z, q.y - 14 * z, 60 * z, 28 * z).endFill()
      label(String(i), q, '#b5ae9e', 12 * z)
      const rescuing = e?.name === 'rescue' && e.value === i && !e.error
      if (rescuing && !saved) {
        const from = at(24, 18); g.setStrokeStyle(2).beginStroke('#d7c7a1').moveTo(from.x, from.y - 40 * z).lineTo(q.x, q.y - 20 * z).endStroke()
        q = { x: q.x + (from.x - q.x) * progress, y: q.y + (from.y - q.y) * progress }
      }
      if (saved) q = at(12 + (s.rescued.indexOf(i) % 3) * 8, 36)
      if (saved || s.text?.[i] === '人') {
        g.beginFill('#e3bb8d').drawCircle(q.x, q.y - 25 * z, 6 * z).endFill()
        g.beginFill('#edaa4e').drawRect(q.x - 7 * z, q.y - 19 * z, 14 * z, 15 * z).endFill()
        g.setStrokeStyle(3 * z).beginStroke('#ddd0a1').moveTo(q.x - 6 * z, q.y - 17 * z).lineTo(q.x - 12 * z, q.y - 23 * z + Math.sin(time * 5 + i) * 4 * z).moveTo(q.x + 6 * z, q.y - 17 * z).lineTo(q.x + 12 * z, q.y - 23 * z).endStroke()
      }
    }
    if (s.read) label(`已救回 ${(s.rescued || []).length} 人`, at(60, 54), '#a5ecc8', 0)
  }
  if (c.mode === 'purify') {
    const clean = s.complete || (e?.name === 'purify' && !e.error && progress > 0.5)
    const q = at(54, 12)
    ground.setStrokeStyle(4 * z).beginStroke('#7f8c7d').beginFill(clean ? '#368fbb' : '#663f86').drawRoundRect(q.x - 80 * z, q.y - 25 * z, 160 * z, 50 * z, 8).endFill().endStroke()
    for (let i = 0; i < 8; i++) {
      const x = q.x + (i * 19 - 67) * z; const y = q.y + Math.sin(time * 2 + i) * 8 * z
      ground.setStrokeStyle(1).beginStroke(clean ? '#a3e7ef' : '#b482dc').drawCircle(x, y, (2 + (time + i) % 4) * z).endStroke()
      if (clean && i % 3 === 0) ground.beginFill('#f6c45d').drawEllipse(x, y, 13 * z, 5 * z).endFill()
    }
  }
  if (c.mode === 'dispatch') {
    const dest = at(...c.receiver)
    g.setStrokeStyle(3 * z).beginStroke('#ddbd7e').moveTo(dest.x, dest.y).lineTo(dest.x, dest.y - 70 * z).endStroke()
    g.beginFill('#75b9a3').moveTo(dest.x, dest.y - 70 * z).lineTo(dest.x + 36 * z, dest.y - 55 * z).lineTo(dest.x, dest.y - 40 * z).closePath().endFill()
    label('营地', dest, '#b1ecd2', -93 * z)
    const q = s.complete ? dest : s.cargo ? at(hero.pos.x - 5, hero.pos.y) : at(24, 36)
    box(q, 48 * z, 25 * z, '#9b6639'); g.beginFill('#302e2e').drawCircle(q.x - 17 * z, q.y, 7 * z).drawCircle(q.x + 17 * z, q.y, 7 * z).endFill()
    if (s.cargo || s.complete) {
      const count = s.cargo?.count || Number(s.text?.split('|')[1] || 0)
      for (let i = 0; i < count; i++)g.beginFill('#c0a15b').drawRect(q.x - 21 * z + i * 8 * z, q.y - 35 * z, 7 * z, 12 * z).endFill()
      label(s.complete ? '物资已卸下' : `${s.cargo.item} × ${count}`, q, '#f8d489', -60 * z)
    }
  }
  return labels
}
module.exports = { stringHint, drawStrings }
