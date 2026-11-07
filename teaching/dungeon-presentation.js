// World text is reserved for numeric information, never route instructions.
module.exports = function present (designs) {
  const quests = {
    1: '带回宝石，找到离开地牢的楼梯。石板上有黯淡的符文；近路上的尖刺并没有收回。',
    2: '沿路三块石板连着出口。每到一块，停留1秒点亮它；三块全亮后从楼梯离开。',
    3: '食人魔在下面巡逻。宝石散落在旧通道里，寻找一条能带着宝石安全离开的路。',
    4: '营地的守卫在前面等你。走近他，在他面前停下。',
    5: '把信送进营地。信封背面写着“自己人”。守卫堵住了唯一通道；不清楚他的意思时，可以走近说“你好”。',
    6: '把信送到上层。信封有两道批注：“西岗：自己人；北岗：送信人”。两名守卫各守一处关口。',
    7: '地图残页记着这段长廊的距离。把距离记在一个变量里，走到另一端的楼梯；换一张残页时，只改记录的数字。',
    8: '勘路员的记录写着整段路有多长、已经走了多远。你站在他停下的地方，算出剩下的路，再去找楼梯。',
    9: '右侧补给站开放时，取回宝石再返回；关闭时跳过。最后从下方的法阵撤离。',
    10: '岔路口只有一条路开放。观察守卫站在哪一边，让程序根据左边的路况选择通道。',
    11: '守卫让开不代表路上没有陷阱。右路既要开放，也要没有尖刺；只要有一项不满足，就走下方通道。',
    12: '遗迹的三道通道按徽章能量分级。石碑记录当前能量，各门刻着允许的范围。读取数值，选择能通过的那一道。',
    16: '每次探索的长廊长度都不同，入口石刻会留下距离。读出距离后，让循环带你到楼梯。',
    17: '你负责勘查前方三格。每走过一格，就报出还剩几格；同伴应依次听到2、1、0。',
    18: '同伴留下的勘路程序忘了更新剩余距离，一直往前走。先观察这个错误，再修好它；如果已到终点，就不该再迈步。',
    13: '踩亮三块供能石板，接通通往出口的线路。每次循环走一格，灯就多亮一盏。',
    14: '石板刻着1、2、3，终点法阵的三盏灯都熄灭了。按顺序启动石板，唤醒法阵。',
    15: '地面的偶数石板连着传送法阵。让编号每次增加2，启动2、4、6号石板。',
    19: '找到亮着的传送信标。它有时就在脚下，有时藏在走廊尽头。',
    20: '食人魔来回经过必经之路。观察它的节奏，等路安全了再继续前进，到达信标。',
    21: '穿过门岗，沿曲折走廊找到信标。信封背面写着“自己人”；走廊上段的长度每次可能不同。',
  }
  const descriptions = {
    4: '让英雄走到守卫面前停下。一条 hero.moveRight() 向右走一格。守卫会挡路，但不会攻击你。',
    5: '到守卫面前说对口令，让他让开，再到楼梯处停下。print("文字") 和 hero.say("文字") 都能发言。可以先说“你好”听他回应；信封中的口令也可直接使用。不要在远处喊话。',
    6: '经过两名守卫，取回沿路两颗宝石，到上层楼梯处停下。每位守卫只听得到在他面前说的话。允许使用带步数的移动命令；路线由你观察和尝试。',
    13: '三块供能石板连着出口法阵。用 for 和 range(3) 重复三次单步右移，每踩亮一块就接通一段线路。三块全亮后，最后一格的法阵启动。只需循环头和移动两行；不能用步数参数代替循环。',
    21: '到门岗报口令，守卫让开后用 for 重复两次单步右移，到走廊拐角；再用 while 检测信标，每轮向上走一格直到到达。两个上行距离场景使用同一份代码。',
  }
  for (const d of designs) {
    if (d.index >= 9 && d.index <= 16) { d.revision = Math.max(3, d.revision || 0); d.visualTask = true }
    if (quests[d.index]) d.quest = quests[d.index]
    if (descriptions[d.index]) d.description = descriptions[d.index]
    d.description = d.description.replace(/检查点/g, '符文石板').replace(/按编号经过/g, '依次踩过').replace(/三个蓝圈/g, '三块符文石板').replace(/黄色信标/g, '发光信标').replace(/牌上的分数/g, '石碑上的分数')
    d.tip = '观察道路、守卫和机关。先运行一小段代码看结果；需要语法帮助时展开任务日志。'
    if (d.index === 12) { d.name = '第2节 · 按徽章能量选择通道【选做】'; d.description = d.description.replaceAll('分数', '徽章能量').replaceAll(' 分', ' 点').replaceAll('60分', '60点'); for (const scene of d.scenarios)scene.title = scene.title.replace('分数', '徽章能量') }
    if (d.index === 4) { d.goalLabel = '抵达守卫面前'; d.gates[0].greeting = '来得正好！下一趟帮我送封信。'; d.starter = '# 走近守卫，在他面前停下。\n' }
    if (d.index === 5) { d.starter = '# 把信送进营地，找到楼梯。\n'; d.hints = ['守卫听不到远处的喊话。先走近，也可以用 print("你好") 打个招呼。', '信封背面的文字是口令。文字要放在英文引号里。', '守卫让到一旁后，再沿通道前进；楼梯是这一关的终点。'] }
    if (d.index === 6) { d.starter = '# 观察两处门岗和道路，试着把信送到上层。\n'; d.hints = ['任务日志里的信封批注分别对应两个守卫。', '可以先写到第一处门岗的程序，运行后观察，再补下一段。', '石墙会挡住移动。根据走廊方向决定在哪里拐弯。'] }
    if (d.index === 21)d.starter = '# 穿过门岗，沿走廊找到信标。\n'
    if ([10, 11, 12].includes(d.index)) d.description += ' 取到开放路线上的宝石后，在法阵上停下。'
    if ([14, 15].includes(d.index)) d.description += ' 最后一个编号石板位于法阵中央；全部按对后法阵会启动。'
    if ([17, 18].includes(d.index)) d.description += ' 带勾形记号的石板是终点，完成后英雄留在原处，便于核对输出。'
    // Old label fields are removed, not merely hidden by CSS.
    for (const scene of [d, ...(d.scenarios || [])]) {
      scene.inscriptions = []
      if ([13, 14, 15, 16].includes(d.index)) scene.powerCircuit = true
      if ([7, 8, 12, 16, 18].includes(d.index)) scene.inscriptions = (scene.labels || []).map(l => ({ ...l, text: l.text.replace('到出口 ', '').replace('通行分数 ', '').replace('剩余 ', '') }))
      if (d.index === 15) scene.inscriptions = [1, 3, 5].map(n => ({ text: String(n), x: 12 + n * 12, y: 12 }))
      scene.labels = []
      scene.exitStyle = d.index === 4 ? 'post' : [19, 20, 21].includes(d.index) ? 'beacon' : [9, 10, 11, 12, 13, 14, 15, 16].includes(d.index) ? 'portal' : [17, 18].includes(d.index) ? 'marker' : 'stairs'
      scene.exitDirection = d.index === 1 ? [0, -1] : d.index === 6 ? [0, 1] : [1, 0]
    }
  }
}
