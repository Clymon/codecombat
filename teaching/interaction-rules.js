// Shared by read-only map help and the native simulation. No world mutation.
function atItemApproach (position, object) {
  return !!(position && object?.approach && object?.at) && Math.hypot(position.x - object.approach[0], position.y - object.approach[1]) < 1.1 && Math.hypot(position.x - object.at[0], position.y - object.at[1]) <= 12.5
}
module.exports = {
  query (name, request = {}) {
    if (name === 'pathOpen' && Object.hasOwn(request, 'args') && !['left', 'right', 'up', 'down'].includes(request.args[0])) return { ready: false, status: 'direction', message: '方向请用带引号的 "left"、"right"、"up" 或 "down"。' }
    const detail = {
      pathOpen: '只查询指定方向是否放行，不会替守卫开门。',
      nextTileSafe: '以英雄当前位置为参照检查右方下一格；巡逻不会暂停。',
      findNearestEnemy: '只返回当前可见的最近活敌人；鼠标不会选定查询结果，未找到时返回 None。',
      isVictory: '查询整场战斗是否完成；暂时没有敌人不代表增援结束。',
      atBeacon: '检查英雄当前是否到达信标。',
      pathLength: '读取路牌给出的格数，不随英雄移动而递减。',
      readSignal: '读取本场景的能量数值。',
    }[name] || ''
    return { ready: true, status: 'query', message: `随时可查询，不会移动英雄。${detail}` }
  },
  signalSpeech (position, actors, request = {}) {
    const nearby = actor => !!position && Math.hypot(position.x - actor.at[0], position.y - actor.at[1]) <= 4
    const targetIndex = actors.findIndex(actor => actor.kind === 'signal' && (request.targetId != null ? actor.id === request.targetId : nearby(actor)))
    const signal = actors[targetIndex]
    const result = (ready, status, message) => ({ ready, status, message, targetIndex })
    if (signal && (!signal.active || !signal.alive)) return result(false, 'inactive', '这个信号台当前不可用。查看当前地图中的信号台。')
    if (signal?.lit) return result(false, 'complete', '这个信号台已经点亮，不用重复报口令。前往下一个未点亮的信号台。')
    if (!signal || !nearby(signal)) return result(false, 'far', '这里离信号台太远。走到台前再说“点火”。')
    if (!Object.hasOwn(request, 'text')) return result(true, 'needs-phrase', '已靠近信号台；还需要说出关卡要求的正确口令。')
    if (request.text !== '点火') return result(false, 'phrase', '信号台没有回应。石台上的口令是“点火”。')
    return result(true, 'ready', '位置与口令满足，可以点亮信号台。')
  },
  attackTarget (position, actors, input) {
    const id = typeof input === 'string' ? input : input?.id
    const targetIndex = actors.findIndex(actor => actor.id === id)
    const target = actors[targetIndex]
    const result = (ready, status, message, inRange = false, canHit = false) => ({ ready, status, message, targetIndex, inRange, canHit })
    if (!id) return result(false, 'missing', '没有攻击目标。先寻找敌人，用 if 确认有目标，再 attack(enemy)。')
    if (!target) return result(false, 'missing', `找不到“${id}”。检查对象名字、引号和大小写。`)
    if (!['enemy', 'door'].includes(target.kind)) return result(false, 'friendly', '这是友方或信号台，不能攻击。')
    if (!target.active || !target.alive) return result(false, 'inactive', '这个目标已经不在战场上了。把寻找敌人的语句放进循环，每轮重新寻找。')
    const separation = position ? Math.hypot(position.x - target.at[0], position.y - target.at[1]) : Infinity
    const inRange = separation <= 6.5
    return result(true, inRange ? 'ready' : 'approach', inRange ? '已在攻击距离内；在代码里指定此目标后攻击。' : '调用后会自动走近；道路必须能够到达目标。', inRange, separation <= 8)
  },
  chargePlate (position, plate, state = {}, health = 100) {
    const occupied = !!position && Math.hypot(position.x - plate.at[0], position.y - plate.at[1]) <= plate.radius && health > 0
    const complete = !!state.complete
    const remaining = Math.max(0, plate.seconds - (state.elapsed || 0))
    const result = (ready, status, message) => ({ ready, status, message, occupied, complete, remaining })
    if (complete) return result(false, 'complete', '这块已经点亮。去其他暗着的石板；完成状态会保留。')
    if (health <= 0) return result(false, 'inactive', '英雄已倒下，不能继续充能。修改代码后重新运行。')
    if (!occupied) return result(false, 'far', '当前未站在这块石板上；先走到石板上，持续停留直到点亮。')
    return result(true, 'charging', `当前已站在石板上；还需持续停留 ${Number(remaining.toFixed(2))} 秒。离开会清空未完成的充能。`)
  },
  pressSwitch (position, switches = [], decoys = [], pressedCount = 0, number) {
    const on = sw => !!position && Math.hypot(position.x - sw.at[0], position.y - sw.at[1]) <= 1
    const result = (ready, status, message, lethal = false) => ({ ready, status, message, lethal })
    const decoy = decoys.find(sw => sw.number === number)
    if (decoy && on(decoy)) return result(false, 'danger', `${number}号红板连着接地线，压下后短路了。可以走过红板，只启动连着蓝色供电线的开关。`, true)
    const next = switches[pressedCount]
    if (!next) return result(false, 'complete', '所有开关已经启动，不用再按。请到出口。')
    const index = switches.findIndex(sw => sw.number === number)
    if (index >= 0 && index < pressedCount) return result(false, 'complete', `${number} 号开关已经启动，不用再按。下一块是 ${next.number} 号。`)
    if (number !== next.number || !on(next)) return result(false, number !== next.number ? 'order' : 'far', `现在要启动 ${next.number} 号开关。先站到那块石板上，再用 hero.press(${next.number})。`)
    return result(true, 'ready', '位置和顺序满足，可以启动这块开关。')
  },
  takeItems (position, supply, state, name) {
    const result = (ready, status, message) => ({ ready, status, message })
    if (!supply || name !== supply.name) return result(false, 'missing', `这里没有“${name}”。${supply ? `箱子名是“${supply.name}”，名字要加引号。` : '先找到地图上的补给箱。'}`)
    if (!atItemApproach(position, supply)) return result(false, 'far', '离补给箱太远了。走到箱子前面那一格，再领取物品。')
    if (state.claimed) return result(false, 'claimed', '补给箱已经空了，不能重复领取。用第一次领取时保存的数量。')
    return result(true, 'ready', '当前位置可以领取；返回实际领取数量，箱子只能领取一次。')
  },
  giveItems (position, config, state, request) {
    const receivers = state.receivers || config.receivers
    const options = receivers.map((receiver, index) => ({ receiver, index })).filter(entry => entry.receiver.name === request.name)
    const target = request.receiverIndex == null ? options.find(entry => atItemApproach(position, entry.receiver)) : options.find(entry => entry.index === request.receiverIndex)
    const result = (ready, status, message) => ({ ready, status, message, receiverIndex: target?.index })
    if (!options.length || (request.receiverIndex != null && !target)) return result(false, 'missing', `这里没有“${request.name}”。请使用地图上收货人或机关的名字。`)
    if (!target || !atItemApproach(position, target.receiver)) return result(false, 'far', `还没有走到${request.name}前。先走到它对应的那一格，再交出物品。`)
    const receiver = target.receiver
    if (receiver.delivered) return result(false, 'delivered', '这里已经收齐物品，不用再交一次。请去下一个位置。')
    if (!state.claimed) return result(false, 'unclaimed', '背包是空的。先从补给箱领取物品。')
    const shortage = amount => `背包只有 ${state.bag} ${config.unit}${config.item}，不能交出 ${amount}。检查减法或循环里的剩余数量。`
    if (!Object.hasOwn(request, 'amount')) {
      if (state.bag < receiver.amount) return result(false, 'shortage', shortage(receiver.amount))
      return result(false, 'needs-amount', `位置满足；还需在代码里填写数量，这里需要 ${receiver.amount} ${config.unit}${config.item}。`)
    }
    const amount = request.amount
    if (!Number.isInteger(amount) || amount <= 0) return result(false, 'amount', '交出的数量必须是大于0的整数，不要加引号。')
    if (amount > state.bag) return result(false, 'shortage', shortage(amount))
    if (amount !== receiver.amount) return result(false, 'mismatch', `${request.name}需要 ${receiver.amount} ${config.unit}${config.item}，这次交了 ${amount}。请重新计算数量。`)
    return result(true, 'ready', '位置、背包和数量满足，可以交付。')
  },
  gateSpeech (position, gate, walls = []) {
    const result = (canHear, ready, status, message) => ({ canHear, ready, status, message })
    if (!position || !gate?.at || !gate?.approach) return result(false, false, 'missing', '还没有看到守卫的位置。')
    const dx = gate.at[0] - position.x; const dy = gate.at[1] - position.y
    const distance = Math.hypot(dx, dy)
    const atPost = Math.hypot(position.x - gate.approach[0], position.y - gate.approach[1]) <= 1
    let canHear = atPost && distance <= 12.5
    let blocked = false
    if (canHear) {
      for (let i = 1; i < Math.ceil(distance); i++) {
        const t = i / Math.ceil(distance); const x = position.x + dx * t; const y = position.y + dy * t
        if (walls.some(w => Math.abs(x - w.x) < w.halfWidth && Math.abs(y - w.y) < w.halfHeight)) { blocked = true; canHear = false; break }
      }
    }
    if (gate.open || gate.openedAt != null) return result(canHear, false, 'open', '守卫正在或已经让开，不用重复报口令。')
    if (gate.locked) return result(canHear, false, 'locked', '此门岗关闭，不能靠攻击或口令强行打开。')
    if (blocked) return result(false, false, 'blocked', '中间隔着墙，绕到守卫正前方再说话。')
    if (!canHear) return result(false, false, 'far', '先走到守卫正前方紧邻的一格，再说话。')
    return result(true, true, 'ready', '当前已到对话位置；还需要说出正确口令。')
  },
}
