// Transfers only mutate inventory. Rules projects goals after initialization:
// setting success inside a synchronous API can end the native world before other goals exist.
module.exports = class TeachingInventory {
  constructor (rules, hero, config, interactions = require('./interaction-rules')) {
    this.interactions = interactions
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

  fail (message) { this.rules.fail(this.hero, message); return 0 }
  take (name) {
    if (this.rules.failed) return 0
    const box = this.config.supply
    const availability = this.interactions.takeItems(this.hero.pos, box, { claimed: this.claimed }, String(name))
    if (!availability.ready) return this.fail(availability.message)
    this.claimed = true; this.bag = box.count
    this.event = { from: box.at, to: [this.hero.pos.x, this.hero.pos.y], count: box.count, at: this.rules.world.age, kind: 'take' }
    this.hero.teachingObservation = JSON.stringify({ text: `领取 ${box.count} ${this.config.unit}${this.config.item}，已放入背包` })
    this.snapshot()
    return box.count
  }

  give (name, amount) {
    if (this.rules.failed) return false
    const availability = this.interactions.giveItems(this.hero.pos, this.config, { claimed: this.claimed, bag: this.bag, receivers: this.receivers }, { name: String(name), amount })
    if (!availability.ready) return this.fail(availability.message)
    const receiver = this.receivers[availability.receiverIndex]
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
