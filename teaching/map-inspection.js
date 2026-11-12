const interactions = require('./interaction-rules')
const { commandDocs } = require('./command-docs')
const parse = (value, fallback) => { try { return JSON.parse(value || 'null') || fallback } catch (_) { return fallback } }
function mapObjects (d, hero, world) {
  const objects = [{ id: 'environment', kind: 'environment', name: '环境与全局函数', at: d.start }]
  if (d.stringMission) { objects.push({ id: 'string-object', kind: 'string', name: d.stringMission.object, at: d.stringMission.at, approach: d.stringMission.approach }); if (d.stringMission.mode === 'dispatch') objects.push({ id: 'string-delivery', kind: 'string', name: '营地', at: d.stringMission.receiver, approach: d.stringMission.deliveryAt }) }
  if (d.sensor?.tag) objects.push({ id: 'tag', kind: 'tag', ...d.sensor.tag })
  objects.push({ id: 'hero', kind: 'hero', name: 'DeepSeek', at: hero?.pos ? [hero.pos.x, hero.pos.y] : d.start, tall: true })
  for (const [i, plate] of (d.chargePlates || []).entries()) objects.push({ id: `charge-${i}`, kind: 'charge', name: `充能石板 ${i + 1}`, ...plate, index: i, rail: true })
  for (const sw of [...(d.switches || []), ...(d.decoySwitches || []).map(s => ({ ...s, decoy: true }))]) objects.push({ id: `switch-${sw.number}`, kind: 'switch', name: `${sw.number} 号开关`, ...sw })
  for (const [i, gate] of (d.gates || []).entries()) {
    const actor = world?.getThangByID(gate.id)
    objects.push({ ...gate, id: `gate-${gate.id}`, kind: 'gate', name: gate.name || ((d.gates || []).length > 1 ? `门岗守卫 ${i + 1}` : '门岗守卫'), at: actor?.pos ? [actor.pos.x, actor.pos.y] : gate.at, tall: true, openedAt: actor ? undefined : gate.openedAt, opening: actor?.teachingGateStatus === 'opening', open: actor ? ['open', 'opening'].includes(actor.teachingGateStatus) : gate.openedAt != null })
  }
  if (d.inventory) {
    objects.push({ ...d.inventory.supply, id: 'supply', kind: 'supply', tall: true })
    d.inventory.receivers.forEach((r, i) => objects.push({ ...r, id: `receiver-${i}`, kind: 'receiver', index: i, tall: true }))
  }
  const adventure = parse(hero?.teachingAdventure, { actors: [] })
  for (const actor of d.adventure?.actors || []) {
    const state = adventure.actors.find(a => a.id === actor.id)
    if ((state && !state.active) || (!state && (actor.spawnAt || 0) > (world?.age || 0))) {
      if (!objects.some(o => o.kind === 'spawn' && o.at[0] === actor.at[0] && o.at[1] === actor.at[1])) objects.push({ id: `spawn-${actor.id}`, kind: 'spawn', name: '增援裂隙', at: actor.at })
      continue
    }
    const thang = world?.getThangByID(actor.id)
    objects.push({ ...actor, id: `actor-${actor.id}`, target: actor.id, kind: actor.kind, name: actor.name || actor.id, at: state?.at || (thang?.pos ? [thang.pos.x, thang.pos.y] : actor.at), tall: true, state })
  }
  if (d.guard) {
    const g = world?.getThangByID(d.guard.id)
    objects.push({ id: 'patrol', kind: 'patrol', name: '巡逻守卫', at: g?.pos ? [g.pos.x, g.pos.y] : [d.guard.x, d.guard.y], tall: true })
  }
  for (const [i, at] of (d.hazards || []).entries()) objects.push({ id: `hazard-${i}`, kind: 'hazard', name: '尖刺', at })
  for (const [i, at] of (d.gems || []).entries()) if (world?.getThangByID(`Parcel ${i + 1}`)?.exists !== false) objects.push({ id: `gem-${i}`, kind: 'gem', name: '宝石', at })
  for (const [i, at] of (d.checkpoints || []).entries()) if (!(d.gates || []).some(g => g.approach?.[0] === at[0] && g.approach?.[1] === at[1])) objects.push({ id: `checkpoint-${i}`, kind: 'checkpoint', name: `石板 ${i + 1}`, at })
  if (d.exit) objects.push({ id: 'exit', kind: 'exit', name: d.exitStyle === 'portal' ? '传送法阵' : d.exitStyle === 'beacon' ? '信标' : d.exitStyle === 'post' ? '到岗位置' : '出口', at: d.exit })
  return objects
}
function describeObject (object, d, hero, world) {
  const docs = commandDocs(d.slug || `local-python-${String(d.index).padStart(2, '0')}`, d, 'python')
  const byName = name => docs.find(doc => doc.name === name)
  const cards = []; let text = ''; let approach = object.approach || object.at; let ready = true
  const add = (name, code, condition, status) => { const doc = byName(name); if (doc) cards.push({ name, code, condition, status, scope: doc.teachingScope, description: doc.description, returns: doc.returns?.description || '' }) }
  const addQuery = (name, code) => {
    const availability = interactions.query(name)
    add(name, code, availability.message, availability.ready ? '无需靠近对象；查询不改变代码目标' : availability.message)
  }
  switch (object.kind) {
    case 'string':
      text = d.stringMission.brief
      for (const name of d.apis || []) add(name, byName(name)?.example.python || '', '在所点装置正下方紧邻一格操作', '点击只查看说明，不会执行代码')
      break
    case 'environment':
      text = '全局函数不需要 hero. 前缀。环境查询返回信息，位置相关的查询以英雄为参照；print 用来输出。'
      for (const doc of docs.filter(doc => doc.teachingScope === 'global')) {
        if (doc.name === 'print') add(doc.name, doc.example.python.split('\n')[0], '任意位置可以说话；守卫只能听见近处的发言', '输出内容；不属于环境查询')
        else addQuery(doc.name, doc.example.python.split('\n')[0])
      }
      approach = null
      break
    case 'tag':
      {
        const reading = parse(hero?.teachingObservation, {})
        const unpacked = parse(hero?.teachingTag, {}).openedAt != null
        text = object.randomized ? reading.name === 'readTag' ? `本次封签：${reading.value}。重新运行会换新货箱，请让程序从读到的文字里取值。` : unpacked ? '纸签已取下，带在主角身上。用 readTag("货箱封签") 读取纸签文字。' : '封签还没有拆开，事先看不到内容。走到货箱正下方一格，用 hero.openTag("货箱封签") 拆封，再用 readTag 读取文字。每次运行可能不同。' : `封签：${object.text}。读到的是整串文字，请按任务取出需要的字符。`
      }
      if (object.requiresOpen) add('openTag', `hero.openTag("${object.name}")`, '走到货箱正下方紧邻的一格', '近距离拆封 · 动作结束再继续')
      addQuery('readTag', `label = readTag("${object.name}")`)
      approach = object.requiresOpen ? [object.at[0], object.at[1] - 12] : null
      break
    case 'hero':
      text = '移动、等待和感知由英雄执行。代码里的 hero 表示主角。'
      for (const name of ['moveRight', 'moveLeft', 'moveUp', 'moveDown', 'wait', 'say']) add(name, byName(name)?.example.python.split('\n')[0], name === 'say' ? '可以随时发言；对方需要在听得到的位置' : '可直接调用；移动会受墙体与危险影响', '英雄动作或感知')
      for (const name of ['findNearestEnemy', 'atBeacon', 'pathLength', 'readSignal']) addQuery(name, byName(name)?.example.python.split('\n')[0])
      approach = null
      break
    case 'charge': {
      const state = parse(hero?.teachingCharge, { plates: [] }).plates[object.index]
      const availability = interactions.chargePlate(hero?.pos, object, state, hero?.health)
      ready = availability.ready
      text = availability.complete ? availability.message : `站在这块石板上停留${object.seconds}秒，圆环转满后点亮。没有单独的“充能函数”。`
      add('wait', 'hero.wait()', '等待可以随时调用；给此石板充能必须站在它上面', availability.message)
      break
    }
    case 'switch': {
      const availability = interactions.pressSwitch(hero?.pos, d.switches, d.decoySwitches, hero?.teachingPressedCount || 0, object.number)
      ready = availability.ready
      text = object.decoy ? '红色接地板：走过安全，压下会短路。旁边的蓝色开关才接着出口。' : availability.status === 'complete' ? availability.message : '走到这块编号开关上，再压下它。接通后电流流向下一块；顺序由地面线路决定。'
      add('press', `hero.press(${object.number})`, object.decoy ? '这是接地板，不应启动；走过不会触发' : '必须站在这块开关上，并符合开关顺序', availability.message)
      break
    }
    case 'supply': {
      const state = parse(hero?.teachingInventory, {})
      const availability = interactions.takeItems(hero?.pos, object, state, object.name)
      ready = availability.ready
      text = state.claimed ? '这个箱子已领取，不能重复领取。' : '走到箱子前领取物品；返回实际领取数量，可以存进变量。'
      add('take', `count = hero.take(${JSON.stringify(object.name)})`, '站在箱子正前方的格子；同一箱只能领取一次', availability.message)
      break
    }
    case 'receiver': {
      const state = parse(hero?.teachingInventory, { claimed: false, bag: 0, receivers: d.inventory.receivers })
      const availability = interactions.giveItems(hero?.pos, d.inventory, state, { name: object.name, receiverIndex: object.index })
      ready = availability.ready
      text = state.receivers?.[object.index]?.delivered ? '这里已交齐物品，去下一个位置或出口。' : `需要${object.amount}${d.inventory.unit}${d.inventory.item}。示例中的 amount 要替换为你的数量变量或数值。`
      add('give', `hero.give(${JSON.stringify(object.name)}, amount)`, '先到收货位置，背包里要有足够物品', availability.message)
      break
    }
    case 'gate': {
      const availability = interactions.gateSpeech(hero?.pos, object, d.walls || [])
      ready = availability.ready
      text = object.opening ? '守卫正在让开，等通道腾出后再通过。' : object.open ? '守卫已经让开，可以通过。' : object.locked ? '此门岗关闭，不能靠攻击或口令强行打开。' : '先走到守卫正前方再说话。发言由附近的守卫听见，不由鼠标选择决定。'
      if (object.answers && !object.open) text = object.greeting
      for (const direction of Object.keys(d.sensor?.open || {})) addQuery('pathOpen', `opened = pathOpen(${JSON.stringify(direction)})`)
      if (!object.locked && !object.open) add('say', 'hero.say("你好")', '到守卫正前方紧邻的一格，且中间不能隔墙', availability.message)
      break
    }
    case 'spawn':
      text = '增援会从裂隙中出现。红光转亮时敌人即将到达；不需要走上去，也没有启动刷怪的函数。'
      addQuery('findNearestEnemy', 'enemy = hero.findNearestEnemy()')
      addQuery('isVictory', 'finished = isVictory()')
      break
    case 'enemy': case 'door': case 'ally': {
      const target = { ...object, ...object.state, id: object.target, at: object.at, active: object.state?.active ?? true, alive: object.state?.alive ?? true }
      const availability = interactions.attackTarget(hero?.pos, [target], object.target)
      ready = availability.ready
      text = ready ? '攻击需要在代码中指定目标。英雄会自动走近后攻击；道路必须能够到达目标。' : availability.message
      if (object.kind === 'ally') { text += '按照关卡目标解救或护送；没有单独的救援函数。'; break }
      add('attack', `hero.attack(${JSON.stringify(object.target)})`, '在代码里填写目标名字（加引号），或查找到的敌人对象', availability.message)
      if (object.kind === 'enemy') addQuery('findNearestEnemy', 'enemy = hero.findNearestEnemy()')
      break
    }
    case 'signal': {
      const signal = { ...object, ...object.state, id: object.target, at: object.at, active: object.state?.active ?? true, alive: object.state?.alive ?? true }
      const availability = interactions.signalSpeech(hero?.pos, [signal], { targetId: object.target })
      ready = availability.ready
      text = availability.status === 'complete' ? availability.message : '靠近信号台后说出关卡要求的口令。'
      add('say', 'hero.say("口令")', '走到台前；把示例文字换成实际口令', availability.message)
      break
    }
    case 'patrol':
      text = '这名守卫是巡逻障碍，进入警戒范围会失败。'
      addQuery('nextTileSafe', 'safe = nextTileSafe()')
      break
    case 'hazard': text = '尖刺是危险地形，碰到会受伤或死亡，没有可以关闭它的函数。观察路线绕开。'; break
    case 'gem': text = '走到宝石处会自动拾取，不需要 take()；take 用于补给箱。'; break
    case 'checkpoint': text = '走到这块石板会自动触发，不需要调用 press()；press 只用于编号开关。'; break
    case 'exit':
      text = hero?.teachingExitReady ? '出口已开启。完成最后一段移动，到出口停下。' : '完成地图左上角的任务后，这里才会开启；没有直接开门或跳关函数。'
      addQuery('atBeacon', 'arrived = hero.atBeacon()')
      addQuery('isVictory', 'finished = isVictory()')
      break
  }
  return { id: object.id, name: object.name, text, cards, approach, ready }
}
function hitObject (objects, x, y, camera) {
  const z = 10 * camera.zoom; let best; let score = Infinity
  for (const o of objects.filter(o => o.kind !== 'environment')) {
    const p = camera.worldToCanvas({ x: o.at[0], y: o.at[1] })
    const centers = o.tall ? [{ x: p.x, y: p.y - 4 * z }] : [p]
    if (o.rail) { const r = camera.worldToCanvas({ x: (o.railAt || [o.at[0], o.at[1] + 14])[0], y: (o.railAt || [o.at[0], o.at[1] + 14])[1] }); centers.push({ x: r.x, y: r.y + 0.5 * z }) }
    for (const c of centers) {
      const dx = (x - c.x) / (o.tall ? 3.3 * z : 4.2 * z); const dy = (y - c.y) / (o.tall ? 5 * z : 3.2 * z)
      const d = dx * dx + dy * dy
      if (d <= 1 && d < score) { score = d; best = o }
    }
  }
  return best || objects[0]
}
module.exports = { mapObjects, describeObject, hitObject }
