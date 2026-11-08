// Validate resolved authoring scenes before any native generation or publication.
function invalid (level, scene, field, reason) {
  throw new Error(`Level ${level}, scene ${scene}, field ${field}: ${reason}`)
}
function validateScene (d, scene) {
  const fail = (field, reason) => invalid(d.index, `${scene} (${d.title || '主场景'})`, field, reason)
  const list = (value, field, required = false) => {
    if (value == null && !required) return []
    if (!Array.isArray(value)) fail(field, 'expected an array')
    return value
  }
  const point = (value, field, bounded = true) => {
    if (!Array.isArray(value) || value.length !== 2 || !value.every(Number.isFinite)) fail(field, 'expected two finite coordinates')
    if (bounded && value.some((v, axis) => v < 0 || v > d.size[axis])) fail(field, 'coordinate outside map bounds')
  }
  point(d.size, 'size', false)
  if (d.size.some(n => n <= 0)) fail('size', 'dimensions must be positive')
  point(d.start, 'start')
  point(d.exit, 'exit')
  for (const field of ['checkpoints', 'gems', 'hazards', 'torches']) {
    list(d[field], field, ['checkpoints', 'gems', 'torches'].includes(field)).forEach((p, i) => point(p, `${field}[${i}]`, field !== 'torches'))
  }
  list(d.corridors, 'corridors', true).forEach((p, i) => {
    if (!Array.isArray(p) || p.length !== 4 || !p.every(Number.isFinite)) fail(`corridors[${i}]`, 'expected four finite coordinates')
    // Carving corridors and decorative geometry may extend beyond the map.
  })
  const ids = new Set(['Hero Placeholder', ...(d.adventure?.camp ? ['营火'] : [])])
  const identity = (value, field, seen = ids) => {
    if (typeof value !== 'string' || !value.trim()) fail(field, 'missing object identity')
    if (seen.has(value)) fail(field, `duplicate object identity ${value}`)
    seen.add(value)
  }
  if (d.guard) {
    identity(d.guard.id, 'guard.id')
    point([d.guard.x, d.guard.y], 'guard')
  }
  list(d.gates, 'gates').forEach((gate, i) => {
    identity(gate?.id, `gates[${i}].id`)
    for (const field of ['at', 'aside', 'approach']) point(gate[field], `gates[${i}].${field}`)
  })
  const switches = new Set()
  for (const field of ['switches', 'decoySwitches', 'chargePlates']) {
    const positions = new Set()
    list(d[field], field).forEach((device, i) => {
      point(device?.at, `${field}[${i}].at`)
      identity(device.at.join(','), `${field}[${i}].at`, positions)
      if (field !== 'chargePlates') {
        if (!Number.isSafeInteger(device.number)) fail(`${field}[${i}].number`, 'expected an integer switch identity')
        identity(String(device.number), `${field}[${i}].number`, switches)
      }
    })
  }
  if (d.inventory) {
    const supply = d.inventory.supply
    if (!supply || typeof supply.name !== 'string' || !supply.name) fail('inventory.supply.name', 'missing supply identity')
    point(supply.at, 'inventory.supply.at')
    point(supply.approach, 'inventory.supply.approach')
    const receivers = new Set()
    list(d.inventory.receivers, 'inventory.receivers', true).forEach((receiver, i) => {
      if (typeof receiver?.name !== 'string' || !receiver.name) fail(`inventory.receivers[${i}].name`, 'missing receiver identity')
      point(receiver.at, `inventory.receivers[${i}].at`)
      identity(receiver.at.join(','), `inventory.receivers[${i}].at`, receivers)
      point(receiver.approach, `inventory.receivers[${i}].approach`)
    })
  }
  const goalIDs = new Set(['stay-safe', 'reach-exit', ...(d.gems.length ? ['collect-parcels'] : []), ...(d.inventory ? ['take-supplies', 'deliver-supplies'] : []), ...(d.switches?.length ? ['press-switches'] : []), ...(d.chargePlates?.length ? ['charge-plate'] : []), ...(d.expectedSpeech ? ['show-values'] : []), ...(d.gates || []).filter(g => !g.locked).map(g => `gate-${g.id}`), ...d.checkpoints.map((_, i) => `checkpoint-${i + 1}`)])
  list(d.goals, 'goals').forEach((goal, i) => identity(goal?.id, `goals[${i}].id`, goalIDs))
  if (typeof d.solution !== 'string' || !d.solution.trim()) fail('solution', 'missing teacher reference program')
  const actors = list(d.adventure?.actors, 'adventure.actors', !!d.adventure)
  actors.forEach((actor, i) => {
    identity(actor?.id, `adventure.actors[${i}].id`)
    point(actor.at, `adventure.actors[${i}].at`)
    if (!['enemy', 'ally', 'door', 'signal'].includes(actor.kind)) fail(`adventure.actors[${i}].kind`, 'unknown actor kind')
  })
  if (d.adventure?.camp) point(d.adventure.camp.at, 'adventure.camp.at')
  actors.forEach((actor, i) => {
    if (actor.releaseBy !== undefined && !actors.some(target => target.id === actor.releaseBy && target.kind === 'door')) fail(`adventure.actors[${i}].releaseBy`, `missing door reference ${actor.releaseBy}`)
  })
  for (const [i, step] of (d.tutorial?.steps || []).entries()) {
    if (step.evidence?.id !== undefined && !actors.some(actor => actor.id === step.evidence.id)) fail(`tutorial.steps[${i}].evidence.id`, `missing actor reference ${step.evidence.id}`)
  }
}
module.exports = { validateScene, invalid }
