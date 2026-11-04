// Runs inside the world worker. Never executes student Python on the server.
module.exports = class TeachingLearning {
  constructor (rules, hero, contract) {
    this.rules = rules; this.hero = hero; this.contract = contract
    this.zeroScene = contract.allowZero && (rules.exit && hero.pos ? Math.hypot(hero.pos.x - rules.exit[0], hero.pos.y - rules.exit[1]) < 1 : rules.sensor?.length === 0)
    this.checks = {}; this.iterations = {}; this.calls = {}; this.loopActions = {}
    hero.__classroomTrace = (event, payload) => this.record(event, payload)
    hero.apiOwnMethods = [...(hero.apiOwnMethods || []), '__classroomTrace']
    hero.apiProperties = (hero.apiProperties || []).filter(p => p !== '__classroomTrace')
    hero.addTrackedProperties?.(['teachingLearning', 'string']); hero.keepTrackedProperty?.('teachingLearning')
    this.snapshot()
  }

  fail (message) { this.rules.fail(this.hero, message); return false }
  record (event, payload) {
    event = String(event); payload = String(payload)
    if (this.rules.failed) return
    if (event === 'source') {
      this.source = JSON.parse(payload)
      const max = this.contract.maxStatements
      if (max && this.source.statements > max) return this.fail(`本关最多 ${max} 行有效代码，你写了 ${this.source.statements} 行。空行和注释不计；一行写多条语句仍分别计数。请把重复动作放进循环。`)
      for (const [name, required] of Object.entries(this.contract.inside || {})) {
        if (!this.source.calls.some(c => c.name === name && required.split(',').every(kind => c.context.includes(kind)))) return this.fail(`本关需要把 ${name} 写在 ${required.replace(',', ' 和 ')} 内。请补上对应语句再运行。`)
      }
      if (this.contract.attackVariable && !this.source.calls.some(c => c.name === 'attack' && c.variableTarget)) return this.fail('把找到的敌人变量交给 attack，例如 hero.attack(enemy)，enemy 不加引号。')
      for (const loop of this.contract.loops || []) if (!this.source.loops.includes(loop)) return this.fail(`本关练习 ${loop}：请用 ${loop} 循环完成重复动作。`)
    }
    if (event === 'check') this.checks[payload] = (this.checks[payload] || 0) + 1
    if (event === 'iteration') this.iterations[payload] = (this.iterations[payload] || 0) + 1
    if (event === 'call') {
      const call = JSON.parse(payload); const required = this.contract.inside?.[call.name]?.split(',') || []
      for (const kind of required) if (!call.context.includes(kind)) return this.fail(`请把 ${call.name} 放进 ${kind === 'if' ? 'if 的有敌人分支' : kind + ' 循环'}。现在它在外面执行，不能作为本关的解法。`)
      this.calls[call.name] = (this.calls[call.name] || 0) + 1
      for (const id of call.loops) this.loopActions[id] = (this.loopActions[id] || 0) + 1
    }
    this.snapshot()
  }

  accept () {
    if (!this.source) return this.fail('本次没有读到 Python 学习检查结果，请重新运行。')
    for (const name of this.contract.calls || []) if (!this.calls[name]) return this.fail(`请实际运行 ${name}，观察它的结果后再完成任务。`)
    for (const kind of this.contract.loops || []) {
      const zero = this.zeroScene
      const checked = Object.keys(this.checks).filter(id => id.startsWith(kind + ':'))
      if (!checked.some(id => zero || (this.iterations[id] >= 2 && this.loopActions[id] >= 2))) return this.fail(`还没有用 ${kind} 重复执行动作。循环必须实际运行；写在不会执行的分支里不算。`)
    }
    return !this.rules.failed
  }

  snapshot () { this.hero.teachingLearning = JSON.stringify({ statements: this.source?.statements, calls: this.calls, iterations: this.iterations }) }
}
