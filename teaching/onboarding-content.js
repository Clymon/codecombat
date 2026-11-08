// UI guidance only. Never contains a complete challenge solution or changes map data.
const briefs = {
  1: ['先找宝石，再离开', '蓝色石板和宝石在通道里。带上宝石，再走到楼梯；近路上的尖刺会扣血。'],
  2: ['走一格，点亮一块', '沿路有三块石板。每到一块就停留1秒，等圆环转满后再向前走。三块全亮后，出口开启。'],
  3: ['先观察巡逻路线', '下面有巡逻的食人魔。看看它走到哪里，再安排取宝石和撤离的路线。'],
  4: ['先走到守卫面前', '我在左边，守卫在右边。先走近他，停在他前面的一格；继续往守卫身上撞会扣血。'],
  5: ['到守卫身边再说话', '守卫堵住了通道。先走近，再试着说“你好”，看他的回应；信封上的口令在任务日志里。'],
  6: ['两名守卫，要分别交谈', '这里有两个门岗。先走到第一名守卫前，报对应口令；通过后再去找第二名守卫。'],
  7: ['打开箱子，领取这一批能量石', '补给箱就在身旁。先领取，看箱盖打开、物品进入背包；再送给右边的出口机关。'],
  8: ['先交维修材料，再送剩下的', '中间的维修机关要2块，右边的出口机关收剩余材料。每次交付后，核对背包数量的变化。'],
  9: ['补给站开放才取物，最后向下撤离', '看右侧守卫和宝石。开放时进去取物再回来，关闭时跳过；下方法阵是两个场景共同的终点。'],
  10: ['看路况，再选方向', '两条路只有一条开放。检查左路是否可走，用 if / else 选择行动。'],
  11: ['开着的路也可能有尖刺', '右路必须同时满足“能走”和“没有陷阱”。看清这两个条件，再选择右路或下路。'],
  12: ['领取金币，走付得起的通道', '先从左侧补给箱领钱。上路4枚、右路2枚、下路1枚；按任务优先级选择路线，到守卫面前真正交钱。'],
  13: ['用三块石板给出口供能', '石板之间的暗线连着法阵。把单步右移放进 for，每次循环点亮一块；三块全亮，法阵才启动。'],
  14: ['走到石板上，再按编号启动', '三块石板分别标着 1、2、3。每次移动后，用本轮编号启动脚下的石板。'],
  15: ['这次只启动偶数石板', '需要启动的是 2、4、6 号石板。观察编号的变化，让循环每次跳过一个数。'],
  16: ['给每座炉座装一块能量石', '先领物资，再逐个装填。背包每少一块，炉座就应多亮一座；只走过去不会亮。'],
  17: ['一边装填，一边记录余量', '领取能量石，每装一块就把remaining减1。把输出和画面上的背包数量对照。'],
  18: ['背包空了，程序也要停', '程序忘了更新remaining。修好后，有物品就装填，领取空箱时不移动。'],
  19: ['边走边检查是否到终点', '亮着的信标就是终点。每轮先检查是否到达；它可能就在脚下，不一定需要走。'],
  20: ['不安全时先等一等', '食人魔会经过前方道路。每轮重新看路况：安全才往前走，否则等待，再检查。'],
  21: ['先过门岗，再寻找信标', '先走近守卫并报口令，再穿过曲折走廊。后半段长度会变，移动时要持续检查终点。'],
  22: ['让追兵自己踩进陷阱', '上层的追兵发现你后会追来。利用道路和尖刺引开它，再从下层楼梯撤离。'],
  23: ['先救出弓箭手', '侧面牢门后关着弓箭手。先击破牢门，她会跟随并帮你攻击；击败重甲守卫后一起离开。'],
  24: ['重复点亮三座信号台', '每座台前都要走近、说“点火”、回到主廊。把这一组动作放进 for，再去下一座。'],
  25: ['敌人会一批一批赶来', '守住营火。每轮重新寻找敌人，有目标才攻击，没有就等一会儿；全部击败才算完成。'],
  26: ['这扇门可以打破', '牢门挡住了通道。试着攻击一次，观察血条；把它打破以后，再从右侧楼梯离开。'],
  28: ['走近信号台再点火', '侧路尽头的信号台还没亮。走到台前再说“点火”，看火焰是否亮起，然后回主廊离开。'],
  30: ['先查找，再攻击', '前面有一名斥候。用查找命令把目标存进变量，再把这个变量交给攻击命令。'],
  31: ['通道里不一定有敌人', '这关有“有斥候”和“空通道”两种场景。只有查到敌人时才攻击，无论有没有敌人都要离开。'],
  32: ['暂时没敌人，先等一等', '斥候稍后才出现。先试试等待和查找，观察敌人出现的时间；还没出现不代表已经获胜。'],
}
briefs[27] = briefs[23]; briefs[29] = briefs[24]; briefs[33] = briefs[25]

function mapTarget (design) {
  if (design.chargePlates?.length) return design.chargePlates[0].at
  if (design.inventory) return design.inventory.supply.at
  if ([7, 8, 12, 16, 18].includes(design.index) && design.inscriptions?.length) return [design.inscriptions[0].x, design.inscriptions[0].y]
  if (design.adventure?.mode === 'defend') return design.start
  if (design.gates?.length) return design.gates[0].at
  if (design.adventure?.actors?.length) return design.adventure.actors[0].at
  if (design.checkpoints?.length) return design.checkpoints[0]
  return design.exit || design.start
}

function stepsFor (design) {
  const brief = design.introBrief || briefs[design.index] || ['先看看本关要做什么', design.quest || design.description]
  let editorText = '在右边的编辑器写 Python。代码框下方的命令图标可以查看用法；不清楚任务时，展开地图左侧的“任务日志”。'
  if (design.index === 4) editorText = '在右边输入这一行，括号也要写。它会让我向右走一格。不要在输入法里把括号打成中文全角。'
  else if (design.tutorial) editorText = `本关练习：${design.knowledge}。地图左侧“教学引导”里有分步示范，可以展开照着试，再观察结果。`
  else if (design.knowledge) editorText = `本关练习：${design.knowledge}。在右边改代码；不记得命令时，点代码框下方对应的命令图标查看用法。`
  return [
    { id: 'map', title: brief[0], text: brief[1], point: mapTarget(design), pointKind: [7, 8, 12, 16, 18].includes(design.index) && design.inscriptions?.length ? 'label' : 'object', target: 'map' },
    { id: 'editor', title: '在这里写代码', text: editorText, note: '看实际结果是否完成任务，不限制必须使用哪种语句。', code: design.index === 4 ? 'hero.moveRight()' : design.index === 7 ? 'stones = hero.take("补给箱")' : null, target: 'editor' },
    { id: 'run', title: '点“运行”，看实际发生了什么', text: '点这里，或按 Shift + Enter，试跑你的代码。没达到目标就改代码再运行；每次重跑，地图会回到起点。', note: '点击真正的“运行”按钮会直接收起引导，不会替你改代码。', target: 'run' },
    { id: 'submit', title: '完成目标后，点“提交”', text: '先看地图左上角的目标是否全部完成，再点这里提交验证。通过后会出现下一关或下一场景的入口。', note: design.scenarioTitles?.length > 1 ? '这关有多个场景，要用同一份代码逐个通过。' : '随时可点“DeepSeek 带路”重看这些提示。', target: 'submit' },
  ]
}

// Prefer a position beside the highlighted target; keep the callout inside the viewport.
function placeCard (target, width, height, viewport, avoid = []) {
  const gap = 18; const edge = 12
  const candidates = [
    { left: target.right + gap, top: target.top, side: 'left' },
    { left: target.left - width - gap, top: target.top, side: 'right' },
    { left: target.left, top: target.bottom + gap, side: 'top' },
    { left: target.left, top: target.top - height - gap, side: 'bottom' },
  ].map(p => ({ ...p, left: Math.max(edge, Math.min(p.left, viewport.width - width - edge)), top: Math.max(edge, Math.min(p.top, viewport.height - height - edge)) }))
  const overlap = p => [target, ...avoid].reduce((area, rect) => area + Math.max(0, Math.min(p.left + width, rect.right) - Math.max(p.left, rect.left)) * Math.max(0, Math.min(p.top + height, rect.bottom) - Math.max(p.top, rect.top)), 0)
  return candidates.reduce((best, candidate) => overlap(candidate) < overlap(best) ? candidate : best)
}

module.exports = { stepsFor, placeCard }
