// Final encounter design: success is determined by world state, never source shape.
module.exports = function applyOutcomes (designs) {
  const get = n => designs.find(d => d.index === n)
  const affected = [7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 24, 25, 29, 30, 31, 32, 33]
  for (const n of affected) {
    const d = get(n)
    d.revision = (d.revision || 1) + 1
    d.learningContract = null; d.singleStep = false; d.maxActions = 240
    d.tip = '点击地图对象查看交互方法。运行后观察机关、物品和生命值；左上角目标全部完成后提交。多场景关卡用同一份程序验证不同情况。'
    for (const s of d.scenarios || []) { s.singleStep = false; s.learningContract = null }
  }
  Object.assign(get(7), { description: '补给箱里是一批能量石，右侧出口机关需要整批物资。先取出，再向右走两格交给机关。箱子会打开，背包增加；交付后背包清空，出口启动。两批物资数量不同，同一份程序都要送对。', hints: ['点箱子可以查看领取命令；领取会返回这批物品的数量。', '把实际领取数量留下来，交付时再使用，就不用每换一箱都改数字。'] })
  Object.assign(get(8), { description: '这批能量石要分两处交付。右边第一格的维修机关固定收2块，第二格的出口机关收剩下的全部。先领取，修好中间机关，再把余量送到出口。两批物资不同，同一程序都要交对数量。', hints: ['每个机关旁标着需要的数量，背包会随交付减少。', '变量不会随背包自动改变；可以用领取数减去已交出的2块。'] })
  Object.assign(get(9), { description: '右侧补给站有时开放、有时关闭。开放时拿回宝石，再返回岔口；关闭时不要闯岗。最后从下方法阵撤离。漏拿宝石时法阵不启动，闯关闭的门岗会受伤。两个场景用同一份程序完成。', starter: '# 观察补给站的门岗和宝石，最后从下方撤离。\n' })
  Object.assign(get(10), { description: '左右两条通道只有一条放行。开放的通道里有宝石和撤离法阵，另一条有守卫拦截。带上宝石，在法阵上停下。两个场景开放方向不同，要让同一份程序都能找到通路。', hints: ['点击门岗，可以查看道路查询函数。', '把查询结果用于决定方向；不要连续闯两边。'] })
  Object.assign(get(11), { description: '右侧是近路，但门开着也可能有尖刺。门岗放行且路面安全时，走右路拿宝石离开；否则走下方撤离通道。三种场景使用同一份程序。', starter: '# 看守卫，也看尖刺；开着的门不一定安全。\n', hints: ['点击守卫和尖刺查看区别：放行与安全是两件事。', '可以把两个条件合起来，也可以分两次判断；看最终选路是否正确。'] })
  Object.assign(get(12), { description: '领取左侧箱子里的金币。上路通行费4枚，右路2枚，下路1枚；守卫按你的物资档位开放一条路。走到开放门岗前支付，再从身旁法阵撤离。4枚及以上走上路，2至3枚走右路，1枚走下路。同一程序完成四批物资。' })

  // Three side rooms: walking straight cannot energize the sealed exit.
  const chargeRoute = 'hero.moveRight()\nfor room in range(3):\n    hero.moveUp(2)\n    hero.wait()\n    hero.moveDown(2)\n    hero.moveRight(2)\n'
  Object.assign(get(13), {
    name: '第3节 · 点亮三间符文室',
    quest: '三间侧室各有一块暗石板。逐间充能，接通右侧出口。',
    description: '主廊上方有三间侧室，每间尽头的石板都要站稳1秒才会点亮。圆环未满就离开，这一块会熄灭；已经完成的会保留。三块全部亮起后，从右侧出口离开。走过主廊不会替侧室充能。',
    size: [108, 60],
    start: [12, 12],
    exit: [96, 12],
    exitStyle: 'portal',
    exitDirection: [1, 0],
    corridors: [[8, 12, 104, 12], ...[24, 48, 72].map(x => [x, 12, x, 40])],
    checkpoints: [],
    checkpointLabels: [],
    switches: [],
    gems: [],
    gates: [],
    hazards: [],
    labels: [],
    inscriptions: [],
    torches: [[8, 24], [96, 24]],
    apis: ['wait'],
    powerCircuit: false,
    chargePlates: [24, 48, 72].map(x => ({ at: [x, 36], radius: 2, seconds: 1 })),
    starter: '# 先尝试点亮第一间侧室，再考虑另外两间。\n',
    solution: chargeRoute,
    hints: ['先右走一格，再上走两格，到第一块石板上。看圆环是否转满。', '上去、等亮、下来、前往下一间，是三间侧室共有的动作。可以先写通一间，再用循环整理重复部分。'],
  })
  Object.assign(get(14), {
    name: '第3节 · 接通三个继电开关',
    quest: '按线路方向接通1、2、3号开关，让出口通电。',
    description: '三个编号开关串联着出口。走到闪光的开关上，用 press(编号) 压下它；接通后光会沿线路流向下一块。必须按电路顺序接通，直接走过去不会启动。全部亮起后在末端法阵停下。',
    starter: '# 先让1号开关接通，看电流流向哪里。\n',
    hints: ['位置和编号都要对应：站在1号上，才能压下1号。', '每次都要先移动再按开关。循环变量可以替你依次产生1、2、3；逐个写出动作也有效。'],
  })
  Object.assign(get(15), {
    name: '第3节 · 绕过短路开关【选做】',
    quest: '接通蓝色的2、4、6号开关，避开红色接地开关。',
    description: '六块编号板交错排列。蓝色的2、4、6号连接出口，要依次走到上面压下；红色的1、3、5号连着接地线，可以走过，但压下就会短路。看线路和颜色选择开关，全部接通后在6号法阵停下。',
    decoySwitches: [1, 3, 5].map(n => ({ number: n, at: [12 + 12 * n, 12] })),
    labels: [],
    inscriptions: [],
    safetyGoalLabel: '不误按接地板，不撞墙',
    starter: '# 红板可以走过，但不要压下。先接通第一块蓝板。\n',
    hints: ['press 会操作脚下编号板；走过不会触发。红色接地线和蓝色供电线用途不同。', '相邻蓝板相隔两格，编号也相差2。可以用步数参数移动，用循环整理这个规律。'],
  })
  Object.assign(get(16), { description: '补给箱中的能量石与沿路炉座一一对应。先领取整批物资，再逐座装填，每座1块。装入后炉火亮起、背包减少，全部装好后出口启动。物资与炉座数量有2、4、5三种变化，同一份程序都要完成。', hints: ['只走过炉座不会装填；点炉座查看交付命令。', '先数物资，再重复“走到下一座、装一块”，程序就能随这一批的数量变化。'] })
  Object.assign(get(17), { name: '第4节 · 把最后一块材料送出去', quest: '领取能量石，逐座点亮炉火，送完最后一块后离开。', description: '领取三块能量石，沿路每座炉座各装一块。背包里的石头减少，路边的炉火逐座亮起；最后一块交出后，出口启动。可以显示剩余数量帮助检查，但发言不是通关条件。', expectedSpeech: null, hints: ['实际背包会自动减少，你定义的 remaining 需要自己更新。', '当物资用完，就不用继续找下一座炉。先看背包和炉火，再检查程序。'] })
  Object.assign(get(18), { name: '第4节 · 别向空箱索要材料', quest: '修好装填程序：有货就送完，空箱也能完成检查并离开。', description: '已有程序会在材料用完后继续向前。先运行，看它在哪座炉前耗尽物资；修改后，要能送完一箱材料，也要能处理空箱。打开箱子才能确认这批有没有货。发言只供自己检查，不影响通关。', expectedSpeech: null, hints: ['先从背包耗尽的位置查错：程序记录的余量是否也变成了0？', '空箱不需要送货，但仍需打开确认，不能跳过检查。'] })
  for (const s of get(18).scenarios) s.expectedSpeech = null
  Object.assign(get(19), { name: '第4节 · 沿途充能，找到信标', quest: '沿途补亮暗石板，走到最后的信标。', description: '每块暗石板需要站稳1秒，点亮后电流沿路传向下一块。最后的信标是终点。路线长短会变；有时信标就在起点，没有暗石板。同一份程序要处理这三种情况。', apis: ['atBeacon', 'wait'], starter: '# 先看脚下是否已经是终点；途中暗板需要停留。\n', hints: ['先点亮脚下这块，再走向下一格。信标本身不需要充能。', '可以反复检查 hero.atBeacon()，不用猜道路有多长。'], powerCircuit: false })
  for (const [i, n] of [2, 4, 0].entries()) Object.assign(get(19).scenarios[i], { chargePlates: Array.from({ length: n }, (_, k) => ({ at: [12 + 12 * k, 12], radius: 2, seconds: 1 })), solution: 'while not hero.atBeacon():\n    hero.wait()\n    hero.moveRight()\n' })
  Object.assign(get(20), { description: '守卫会穿过前方通道，进入红色警戒圈会失败。安全时继续前进，危险时留在原地，最终到达信标。两种巡逻起始位置不同，同一程序都要安全。nextTileSafe() 会判断右边下一格的通行时机；等待时世界照常运行。', hints: ['看红圈怎样经过路口；它离开之后再通过。', '每次等待后路况可能已经变了，需要重新观察。等待多久、用哪种循环由你决定。'] })
  Object.assign(get(21), { name: '第4节 · 过门岗，修复信标路', quest: '通过门岗，沿上方通道点亮石板，修复尽头的信标。', description: '先到守卫面前报“自己人”，获得放行。沿主廊到最右侧拐角，再向上逐块充能：每块停留1秒，所有石板亮起后，终点信标恢复。上方石板有两块或三块，同一程序都要完成。', apis: ['atBeacon', 'wait'], starter: '# 先过门岗，再到右侧拐角，修好上方的信标路。\n', hints: ['守卫让开后再前进；没有放行时硬闯会受伤。', '每上走一格就给脚下石板充能。到达信标时也要补满最后一块。'], powerCircuit: false })
  get(21).scenarios.forEach((s, i) => Object.assign(s, { checkpoints: [[24, 12]], chargePlates: Array.from({ length: i + 2 }, (_, k) => ({ at: [48, 24 + 12 * k], railAt: [62, 24 + 12 * k], radius: 2, seconds: 1 })), solution: 'hero.moveRight()\nprint("自己人")\nhero.moveRight(2)\nwhile not hero.atBeacon():\n    hero.moveUp()\n    hero.wait()\n' }))
  for (const n of [24, 29]) Object.assign(get(n), { description: '三座信号台连着出口封印。走到每座台前说“点火”，火焰亮起后回主廊，再去下一座。重复点燃同一座不会代替其他台；在远处说话也无效。三座全亮后从右侧离开。', starter: '# 先点亮最近的信号台，再把同样的动作用于另外两座。\n', hints: ['主廊到台前两格，相邻侧路间两格。', '先完成一次“上去、点火、回来、去下一台”，再考虑怎样整理重复动作。'] })
  for (const n of [25, 33]) Object.assign(get(n), { description: '守住营火，击退分批赶来的所有敌人。通道入口的裂隙会先发红光，随后出现增援；暂时没有敌人不等于战斗结束。敌人倒下后还会有新目标，持续观察战场。英雄或营火生命降到0失败。两个场景的敌人数和间隔不同，同一程序都要守住；获胜后自动结束。', hints: ['旧目标倒下后不会自动变成新目标；观察查找结果是否更新。', '没有目标时不要攻击空对象。可以等待，也可以继续观察。', 'isVictory() 查询整场战斗是否结束。使用哪种循环不影响通关，关键是营火存活且增援全被击败。'] })
  const thirty = get(30); const original = thirty.adventure.actors[0]
  thirty.description = '路中央有一名哨兵挡着出口。击败它，再走到楼梯。两次巡查遇到的哨兵名字不同，同一份程序都要识别并处理当前目标。点敌人可查看攻击用法；查找函数会返回当前的敌人对象。'
  thirty.scenarios = ['落单斥候', '门廊哨兵'].map(id => ({ title: `遇到${id}`, adventure: { mode: 'rescue', actors: [{ ...original, id }] }, solution: thirty.solution }))
  thirty.goals = []; thirty.quest = '击败当前哨兵，从右侧楼梯离开。'
  thirty.tutorial.steps[0].evidence = { kind: 'enemies-cleared' }
  const thirtyOne = get(31)
  thirtyOne.scenarios.push({ ...thirtyOne.scenarios[0], title: '换岗了，遇到另一名哨兵', adventure: { mode: 'rescue', actors: [{ ...original, id: '门廊哨兵' }] } })
  thirtyOne.description = '这条通道可能有斥候、可能换成另一名哨兵，也可能是空的。有敌人时先清掉，空通道可以直接走；最后都要到楼梯。同一份程序完成三个场景。'
  thirtyOne.tutorial.steps[0].evidence = { kind: 'enemies-cleared' }
  get(32).tutorial.steps[0].evidence = { kind: 'enemy-arrived' }
  get(32).description = '营地开局是空的，但左侧裂隙很快会亮起红光，随后出现一名斥候。等它出现后击败它，保持营火存活。只看开局就离开无法守住营地。可以尝试等待后查找，也可以持续观察；击败后自动通关。'
  for (const n of affected) { const d = get(n); d.introBrief = [d.name.replace(/^第\d节 · /, ''), d.quest || d.description] }
}
