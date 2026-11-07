// Transfers only mutate inventory. Rules projects goals after initialization:
// setting success inside a synchronous API can end the native world before other goals exist.
module.exports = class TeachingInventory {
  constructor (rules, hero, config) {
    this.rules = rules; this.hero = hero; this.config = config; this.bag = 0; this.claimed = false
    this.receivers = config.receivers.map(r => ({ ...r, delivered: false }))
    for (const [name, fn] of Object.entries({ take: name => this.take(name), give: (name, amount) => this.give(name, amount) })) {
      hero[name] = fn
      hero.apiOwnMethods = [...(hero.apiOwnMethods || []), name]
      hero.apiProperties = (hero.apiProperties || []).filter(p => p !== name)
    }
    hero.addTrackedProperties?.(['teachingInventory', 'string'])
    hero.keepTrackedProperty?.('teachingInventory')
    this.snapshot()
  }

  near (object) {
    const h = this.hero.pos
    return Math.hypot(h.x - object.approach[0], h.y - object.approach[1]) < 1.1 && Math.hypot(h.x - object.at[0], h.y - object.at[1]) <= 12.5
  }

  fail (message) { this.rules.fail(this.hero, message); return 0 }
  take (name) {
    if (this.rules.failed) return 0
    const box = this.config.supply
    if (String(name) !== box.name) return this.fail(`这里没有“${name}”。箱子名是“${box.name}”，名字要加引号。`)
    if (!this.near(box)) return this.fail('离补给箱太远了。走到箱子前面那一格，再领取物品。')
    if (this.claimed) return this.fail('补给箱已经空了，不能重复领取。用第一次领取时保存的数量。')
    this.claimed = true; this.bag = box.count
    this.event = { from: box.at, to: [this.hero.pos.x, this.hero.pos.y], count: box.count, at: this.rules.world.age, kind: 'take' }
    this.hero.teachingObservation = JSON.stringify({ text: `领取 ${box.count} ${this.config.unit}${this.config.item}，已放入背包` })
    this.snapshot()
    return box.count
  }

  give (name, amount) {
    if (this.rules.failed) return false
    const options = this.receivers.filter(r => r.name === String(name))
    if (!options.length) return this.fail(`这里没有“${name}”。请使用地图上收货人或机关的名字。`)
    const receiver = options.find(r => this.near(r))
    if (!receiver) return this.fail(`还没有走到${name}前。先走到它对应的那一格，再交出物品。`)
    if (receiver.delivered) return this.fail('这里已经收齐物品，不用再交一次。请去下一个位置。')
    if (!this.claimed) return this.fail('背包是空的。先从补给箱领取物品。')
    if (!Number.isInteger(amount) || amount <= 0) return this.fail('交出的数量必须是大于0的整数，不要加引号。')
    if (amount > this.bag) return this.fail(`背包只有 ${this.bag} ${this.config.unit}${this.config.item}，不能交出 ${amount}。检查减法或循环里的剩余数量。`)
    if (amount !== receiver.amount) return this.fail(`${name}需要 ${receiver.amount} ${this.config.unit}${this.config.item}，这次交了 ${amount}。请重新计算数量。`)
    this.bag -= amount; receiver.delivered = true
    this.event = { from: [this.hero.pos.x, this.hero.pos.y], to: receiver.at, count: amount, at: this.rules.world.age, kind: 'give' }
    this.hero.teachingObservation = JSON.stringify({ text: `交出 ${amount} ${this.config.unit}，背包还剩 ${this.bag} ${this.config.unit}${this.config.item}` })
    this.snapshot()
    return true
  }

  ready () { return this.claimed && this.receivers.every(r => r.delivered) }
  snapshot () {
    this.hero.teachingInventory = JSON.stringify({ item: this.config.item, unit: this.config.unit, bag: this.bag, claimed: this.claimed, receivers: this.receivers, event: this.event })
  }
}
