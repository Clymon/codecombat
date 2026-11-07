// Shared by read-only map help and the native simulation. No world mutation.
module.exports = {
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
