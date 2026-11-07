// Shared by read-only map help and the native simulation. No world mutation.
function atItemApproach (position, object) {
  return !!(position && object?.approach && object?.at) && Math.hypot(position.x - object.approach[0], position.y - object.approach[1]) < 1.1 && Math.hypot(position.x - object.at[0], position.y - object.at[1]) <= 12.5
}
module.exports = {
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
