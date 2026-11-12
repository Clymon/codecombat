// Per-run objects and stateful physical actions. No AST or required-syntax checks.
module.exports = class TeachingStrings {
  constructor (rules, hero, config) {
    this.rules = rules; this.hero = hero; this.config = config; this.world = rules.world
    const pick = list => list[this.world.rand.rand(list.length)]
    const mode = config.mode
    const runes = () => Array.from({ length: 3 }, () => pick(['火', '水', '土', '风'])).join('')
    let text
    if (mode === 'bridge') text = '[' + runes() + ']'
    if (mode === 'loom') text = pick(['咚嗒', '嗒咚', '咚啪', '啪嗒', '嗒啪', '啪咚'])
    if (mode === 'rescue') {
      const holes = Array(6).fill('石'); const count = 2 + this.world.rand.rand(2)
      const indices = [0, 1, 2, 3, 4, 5]
      for (let n = 0; n < count; n++) holes[indices.splice(this.world.rand.rand(indices.length), 1)[0]] = '人'
      text = holes.join('')
    }
    if (mode === 'purify') {
      const word = pick(['water', 'river', 'clean'])
      text = '  ' + word[0] + '毒' + word.slice(1, 3).toUpperCase() + '毒' + word.slice(3) + '  '
    }
    if (mode === 'dispatch') text = pick(['药品', '绳索', '粮食']) + '|' + (2 + this.world.rand.rand(4))
    const system = this; const nativeUnblock = hero.unblock
    if (nativeUnblock) hero.unblock = function (...args) { if (system.busy && this.currentPlan?.methodName === system.busy.name) return; return nativeUnblock.apply(this, args) }
    this.source = text
    this.state = { mode, text: '', read: false, complete: false, rescued: [], cargo: null, event: null, startedAt: this.world.age }
    hero.addTrackedProperties?.(['teachingStrings', 'string']); hero.keepTrackedProperty?.('teachingStrings')
    this.world.goalManager.setGoalState('string-mission', 'incomplete')
    const expose = (name, fn, planned) => {
      hero[name] = fn; hero.apiProperties = (hero.apiProperties || []).filter(p => p !== name); hero.apiOwnMethods = [...new Set([...(hero.apiOwnMethods || []), name])]
      if (planned) hero.plannifyMethod?.(name)
    }
    expose('readObject', name => {
      if (name !== config.object) throw new Error('找不到这个对象。点击地图中的装置查看准确名称。')
      this.near(config.approach)
      this.state.read = true; this.state.text = this.source; this.track()
      hero.teachingObservation = JSON.stringify({ name: 'readObject', value: this.source, text: '读到：' + this.source, at: this.world.age })
      hero.keepTrackedProperty?.('teachingObservation')
      return this.source
    })
    for (const name of ['buildBridge', 'playTune', 'rescue', 'purify', 'pack', 'deliver']) expose(name, (...args) => this.act(name, args), true)
    this.track()
  }

  near (at) {
    if (Math.hypot(this.hero.pos.x - at[0], this.hero.pos.y - at[1]) > 0.8) throw new Error(at === this.config.deliveryAt ? '先走到营地旗帜正下方一格，再卸货。' : '先走到左侧装置正下方紧邻的一格，再读取或操作。')
  }

  track () { this.hero.teachingStrings = JSON.stringify(this.state); this.hero.keepTrackedProperty?.('teachingStrings') }
  ready () { return this.state.complete }
  act (name, args) {
    const expectedAction = { bridge: 'buildBridge', loom: 'playTune', rescue: 'rescue', purify: 'purify', dispatch: 'pack' }[this.config.mode]
    if (name !== expectedAction && !(this.config.mode === 'dispatch' && name === 'deliver')) throw new Error('这个场景没有可执行该命令的装置。')
    this.near(name === 'deliver' ? this.config.deliveryAt : this.config.approach)
    if (!this.state.read) throw new Error('请先读取装置，查看这次的材料或订单。')
    if (this.rules.failed) return 'done'
    if (!this.busy) {
      let error = ''; let duration = 1.2
      const value = args[0]
      if (name === 'buildBridge' && value !== this.source.slice(1, 4)) error = '桥板与槽位不匹配：只安装方括号中间的三个符文，左右顺序要一致。'
      if (name === 'playTune') {
        const tune = this.source.repeat(3) + [...this.source].reverse().join('')
        duration = 2.8
        if (value !== tune) {
          const actual = typeof value === 'string' ? value : ''
          let n = 0; while (n < tune.length && actual[n] === tune[n]) n++
          error = `第${n + 1}拍不对：前三组重复原来的节拍，最后一组倒过来。`
          duration = Math.min(2.8, (n + 1) * 0.35)
        }
      }
      if (name === 'rescue') {
        if (!Number.isInteger(value) || value < 0 || value >= this.source.length) error = '吊索需要0到5的洞口位置；find 返回 -1 表示没找到，不能作为位置。'
        else if (this.source[value] !== '人') error = '吊索钩到岩石或空洞了。救完以后重新读取回声镜，寻找下一个“人”。'
      }
      if (name === 'purify' && value !== this.source.trim().replace(/毒/g, '').toUpperCase()) error = '水泵仍在报警：去掉两端空格和所有“毒”，并将字母全部改成大写。'
      if (name === 'pack') {
        const [item, count] = this.source.split('|')
        if (value !== item || args[1] !== Number(count)) error = '装载被退回：物品名称必须与订单一致，数量请用整数。'
        if (this.state.cargo) error = '补给车已经装好，请走到营地卸货，不要重复装车。'
      }
      if (name === 'deliver' && !this.state.cargo) error = '车上还没有物资，先到订单台装车。'
      this.busy = { name, value, args, error, startedAt: this.world.age, duration }
      this.state.event = { ...this.busy }
      this.track()
    }
    this.hero.setTargetPos?.(null); this.hero.intent = undefined
    if (this.hero.velocity) { this.hero.velocity.x = 0; this.hero.velocity.y = 0 }
    this.hero.rotation = Math.PI / 2; this.hero.keepTrackedProperty?.('rotation'); this.hero.setAction?.('idle')
    if (this.world.age + 1e-9 < this.busy.startedAt + this.busy.duration) return
    const event = this.busy; this.busy = null
    this.state.event = { ...event, finishedAt: this.world.age }
    if (event.error) { this.track(); this.rules.fail(this.hero, event.error); return 'done' }
    if (name === 'rescue') {
      this.state.rescued.push(event.value)
      this.source = this.source.slice(0, event.value) + '空' + this.source.slice(event.value + 1)
      this.state.text = this.source
      this.state.complete = !this.source.includes('人')
    } else if (name === 'pack') this.state.cargo = { item: event.value, count: event.args[1] }
    else this.state.complete = true
    if (name === 'deliver') this.state.cargo = null
    if (this.state.complete) this.world.goalManager.setGoalState('string-mission', 'success')
    this.track(); return 'done'
  }

  update () {
    if (this.rules.failed || this.state.complete) return
    const { x, y } = this.hero.pos
    if (this.config.mode === 'bridge' && x > 30 && x < 66 && Math.abs(y - 12) < 3) this.rules.fail(this.hero, '桥还没铺好，不能踏进断口。先在卷轴台修好桥。')
    if (this.config.mode === 'loom' && Math.hypot(x - 48, y - 12) < 6) this.rules.fail(this.hero, '石像还没有让路，继续前进会撞上它。先回鼓前敲出完整节拍。')
    if (this.config.mode === 'purify' && x > 40 && x < 65 && Math.abs(y - 12) < 3) this.rules.fail(this.hero, '水渠还在冒紫色毒泡，先修复净水泵，再通过。')
  }
}
