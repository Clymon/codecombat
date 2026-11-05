// Original teaching levels. Generic engine IDs are from MIT-licensed editor defaults.
const fs = require('fs')
const path = require('path')
const dir = path.join(__dirname, '..')
const { durations } = require('../exit-effects')
const { CELL_SIZE } = require('../grid-space')
const common = name => JSON.parse(fs.readFileSync(path.join(dir, 'common', `${name}.json`)))
const ids = { physical: '524b75ad7fc0f6d519000001', exists: '524b4150ff92f1f4f8000024', programmable: '524b7b5a7fc0f6d51900000e', plans: '524b7b517fc0f6d51900000d', simple: '524b7b427fc0f6d51900000b' }
const systemIDs = ['528112c00268d018e3000008', '5280f83b8ae1581b66000001', '5281146f0268d018e3000014', '528110f30268d018e3000001', '52810ffa33e01a6e86000012', '528114b20268d018e3000017', '528105f833e01a6e86000007', '528113240268d018e300000c', '528112530268d018e3000007', '52810f4933e01a6e8600000c', '528115040268d018e300001b', '5280dc4d251616c907000001', '528111b30268d018e3000004', '528114e60268d018e300001a', '528114040268d018e3000011', '52ae4f02a4dcd4415200000b', '52e953e81b2028d102000004', '52f1354370fb890000000005']
function engineComponent (original, config = {}) { return { original, majorVersion: 0, config } }
function entity (type, id, x, y, overrides = []) {
  const model = common(type)
  return { thangType: model.original, id, components: [engineComponent(ids.exists), engineComponent(ids.physical, { pos: { x, y, z: ((model.components || []).find(c => c.original === ids.physical)?.config?.pos?.z ?? 1) } }), ...overrides] }
}
function onCorridor (x, y, corridors, margin = 5) {
  return corridors.some(([x1, y1, x2, y2]) => {
    const nearX = Math.max(Math.min(x, Math.max(x1, x2)), Math.min(x1, x2))
    const nearY = Math.max(Math.min(y, Math.max(y1, y2)), Math.min(y1, y2))
    return Math.hypot(x - nearX, y - nearY) <= margin
  })
}
function make (design) {
  const { index, name, description, gems: positions, corridors, size: [width, height] } = design
  const slug = `local-python-${String(index).padStart(2, '0')}`
  const id = `facade${String(index).padStart(18, '0')}`
  const hero = entity('knight', 'Hero Placeholder', ...design.start, [
    engineComponent(ids.simple, { allowsArguments: true, allowsSimpleMoveArguments: true }),
    engineComponent(ids.programmable, { programmableProperties: ['moveRight', 'moveLeft', 'moveUp', 'moveDown', 'say', ...(design.apis || [])], programmableMethods: { plan: { name: 'plan', source: '// Write movement commands here.\n', languages: { python: design.starter || '# 观察地图，在下面写移动命令。\n' }, permissions: { read: [], readwrite: ['humans'] } } } }),
    engineComponent(ids.plans, { worldEndsAfter: design.adventure ? 42 : (durations[design.exitStyle] || 0) + 1.7 }),
    engineComponent('524b7bab7fc0f6d519000017', { maxHealth: 100 }),
    engineComponent('524b7b8c7fc0f6d519000013', { maxSpeed: 12 }),
  ])
  const thangs = []
  const walls = []
  for (let x = 10; x < width; x += 20) {
    for (let y = 8.5; y < height; y += 17) {
      thangs.push(entity('dungeon-floor', `Floor ${x}-${y}`, x, y))
    }
  }
  // Carve corridors out of solid masonry; the rendered walls and collision rules
  // come from the same geometry, so there are no invisible danger rectangles.
  for (let x = 2; x < width; x += 4) {
    for (let y = 2; y < height; y += 4) {
      if (onCorridor(x, y, corridors)) continue
      thangs.push(entity('dungeon-wall', `Masonry ${x}-${y}`, x, y))
      walls.push({ x, y, halfWidth: 2, halfHeight: 2 })
    }
  }
  for (const [x, y] of design.torches) thangs.push(entity('torch', `Torch ${x}-${y}`, x, y))
  if (design.guard) {
    const g = design.guard
    thangs.push(entity('ogre-m', g.id, g.x, g.y, [engineComponent('524b7b8c7fc0f6d519000013', { maxSpeed: 0 }), engineComponent('524b7ba57fc0f6d519000016', { attackDamage: 0, attackRange: 0 })]))
  }
  for (const [x, y] of design.hazards || []) {
    const spikes = entity('spike-walls', `Spikes ${x}-${y}`, x, y, [
      engineComponent('524b7ba57fc0f6d519000016', { attackDamage: 0, attackRange: 0 }),
      engineComponent('52a399b98537a70000000003', { scaleFactorX: 1.7, scaleFactorY: 4.4, quickScale: true }),
    ])
    const spikeBody = spikes.components.find(c => c.original === ids.physical).config
    spikeBody.rotation = Math.PI / 2
    // The north-facing art has an inset root. Compensate its registration after
    // vertical scaling so the visible roots sit at the XY hazard centre.
    spikeBody.pos.z = -1.3
    thangs.push(spikes)
  }
  for (const gate of design.gates || []) {
    const sentry = entity('soldier-m', gate.id, ...gate.at, [
      engineComponent('524b7b8c7fc0f6d519000013', { maxSpeed: 0 }),
      engineComponent('52a399b98537a70000000003', { scaleFactorX: 1.8, scaleFactorY: 1.8, quickScale: true }),
      engineComponent('524b7ba57fc0f6d519000016', { attackDamage: 0, attackRange: 0 }),
    ])
    sentry.components.find(c => c.original === ids.physical).config.rotation = Math.atan2(gate.approach[1] - gate.at[1], gate.approach[0] - gate.at[0])
    thangs.push(sentry)
  }
  for (const actor of design.adventure?.actors || []) {
    const type = { enemy: 'ogre-m', ally: 'archer-f', door: 'dungeon-door', signal: 'torch' }[actor.kind]
    thangs.push(entity(type, actor.id, ...actor.at, [
      engineComponent(ids.exists, { stateless: false }),
      ...(actor.kind !== 'signal' ? [engineComponent('524b7bab7fc0f6d519000017', { maxHealth: actor.health, health: actor.health })] : []),
      ...(['enemy', 'ally'].includes(actor.kind) ? [engineComponent('524b7b8c7fc0f6d519000013', { maxSpeed: 0 }), engineComponent('524b7ba57fc0f6d519000016', { attackDamage: 0, attackRange: 0 })] : []),
      ...(['enemy', 'ally', 'signal'].includes(actor.kind) ? [engineComponent('52a399b98537a70000000003', { scaleFactorX: actor.kind === 'signal' ? 2.8 : actor.kind === 'ally' ? 2 : 1.5, scaleFactorY: actor.kind === 'signal' ? 2.8 : actor.kind === 'ally' ? 2 : 1.5, quickScale: true })] : []),
      engineComponent('524b7b857fc0f6d519000012', { collisionCategory: 'none', collisionType: 'static' }),
    ]))
  }
  if (design.adventure?.camp) thangs.push(entity('torch', '营火', ...design.adventure.camp.at, [engineComponent('52a399b98537a70000000003', { scaleFactorX: 3, scaleFactorY: 3, quickScale: true })]))
  thangs.push(hero)
  positions.forEach(([x, y], n) => thangs.push(entity('gem', `Parcel ${n + 1}`, x, y)))
  const systems = systemIDs.map(original => engineComponent(original))
  systems.find(s => s.original === '5280f83b8ae1581b66000001').config = { lifespan: 40, frameRate: 20, randomSeed: 'zero' }
  systems.find(s => s.original === '528113240268d018e300000c').config = { simpleMoveDistance: CELL_SIZE, ...(index >= 7 ? { simpleMoveSnapPoints: Array.from({ length: Math.floor(width / 12) + 1 }, (_, x) => Array.from({ length: Math.floor(height / 12) + 1 }, (_, y) => ({ x: x * 12, y: y * 12 }))).flat(), simpleMoveSnapThreshold: 2.5 } : {}) }
  systems.find(s => s.original === '528114e60268d018e300001a').config = { showCoordinates: false, showGrid: false, preventZoomToHero: true, showPaths: 'never', showTargetMark: false }
  systems.push(engineComponent('facadecccc00000000000001', { learningContract: design.learningContract || null, ...(design.adventure ? { adventureConfig: { ...design.adventure, guided: !!design.tutorial } } : {}), walls, bounds: { x1: 0, y1: 0, x2: width, y2: height }, guard: design.guard || null, checkpoints: design.checkpoints, exit: design.exit, hazards: design.hazards, gates: design.gates || [], noGems: positions.length === 0, requireFinished: true, exitStyle: design.exitStyle, exitDirection: design.exitDirection, exitDuration: durations[design.exitStyle] || 0, sensor: design.sensor || {}, switches: design.switches || [], singleStep: !!design.singleStep, maxActions: design.maxActions || 30, expectedSpeech: design.expectedSpeech || null }))
  const { solution, scenarios, ...publicDesign } = design
  const level = { _id: id, original: id, slug, name, description, loadingTip: design.tip, type: 'hero', product: 'codecombat', version: { major: 0, minor: 0, isLatestMajor: true, isLatestMinor: true }, permissions: [{ target: 'public', access: 'read' }], thangs, systems, goals: [{ id: 'stay-safe', saveThangs: ['Hero Placeholder'], name: design.safetyGoalLabel || (design.guard ? '避开巡逻警戒圈' : design.gates?.length ? '不闯关闭的门岗' : design.hazards?.length ? '避开尖刺和石墙' : '不撞石墙'), worldEndsAfter: 1 }, { id: 'collect-parcels', name: `收集全部${positions.length}颗宝石`, collectThangs: { who: ['humans'], targets: positions.map((_, n) => `Parcel ${n + 1}`) }, worldEndsAfter: 1 }], documentation: { generalArticles: [], specificArticles: [{ name: '本关任务', body: description }] }, scripts: [{ id: 'Local Camera', channel: 'god:new-world-created', noteChain: [{ name: 'View', script: { duration: 0.01 }, playback: { playing: true } }] }], teachingMap: publicDesign, victory: {}, campaign: 'local-teaching', concepts: ['basic_syntax'], i18n: {}, releasePhase: 'internalRelease', aiChatKind: 'none' }
  level.goals.push(...(design.goals || []).map(g => ({ ...g, worldEndsAfter: 1 })))
  if (!positions.length) level.goals = level.goals.filter(g => g.id !== 'collect-parcels')
  if (design.switches?.length) level.goals.push({ id: 'press-switches', name: '按顺序点亮指定开关', worldEndsAfter: 1 })
  if (design.expectedSpeech) level.goals.push({ id: 'show-values', name: '显示每轮减少后的值', worldEndsAfter: 1 })
  level.goals.push(...(design.gates || []).filter(g => !g.locked).map(g => ({ id: `gate-${g.id}`, name: '获得守卫放行', worldEndsAfter: 1 })))
  level.goals.push(...design.checkpoints.map((p, n) => ({ id: `checkpoint-${n + 1}`, name: (design.gates || []).some(g => g.approach[0] === p[0] && g.approach[1] === p[1]) ? '抵达门岗' : `唤醒石板 ${n + 1}`, worldEndsAfter: 1 })), { id: 'reach-exit', name: design.goalLabel || ({ stairs: '完成沿路任务，从楼梯离开', portal: '启动法阵并传送', beacon: '到达信标并传送', marker: '在终点石板停下', camp: '留在安全位置' }[design.exitStyle]) || '到达终点', worldEndsAfter: 1 })
  return level
}
fs.mkdirSync(path.join(dir, 'levels', 'scenarios'), { recursive: true })
for (const design of require('../map-designs')) {
  const scenes = design.scenarios || [{}]
  scenes.forEach((scene, sceneIndex) => {
    const level = make({ ...design, ...scene })
    level.teachingMap.scenarioIndex = sceneIndex
    level.teachingMap.scenarioTitles = scenes.map((s, i) => s.title || '主场景')
    level.teachingMap.slug = level.slug
    if (sceneIndex === 0) fs.writeFileSync(path.join(dir, 'levels', `${level.slug}.json`), JSON.stringify(level, null, 2) + '\n')
    fs.writeFileSync(path.join(dir, 'levels', 'scenarios', `${level.slug}-${sceneIndex}.json`), JSON.stringify(level, null, 2) + '\n')
  })
}
module.exports = { onCorridor }
