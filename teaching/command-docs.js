// Chinese documentation for the commands implemented by our local Python maps.
// Keep this independent of the renderer so every published API can be checked.
const { GLOBAL_QUERIES } = require('./environment-api')
const moves = { moveRight: '右', moveLeft: '左', moveUp: '上', moveDown: '下' }
const method = (name, description, example, args = [], returns) => ({
  name,
  type: 'function',
  owner: 'this',
  description,
  example: { python: example },
  args,
  ...(returns ? { returns } : {}),
  hideGrantedBy: true,
  teachingCommand: true,
  snippets: { python: { tab: name, code: `hero.${name}(${args.filter(a => !a.optional).map((a, i) => '${' + (i + 1) + ':' + a.example + '}').join(', ')})` } },
})
const arg = (name, type, description, example, optional = false) => ({ name, type, description, example, optional })
const result = (type, description) => ({ type, description })

function commandDocs (slug, design, language) {
  if (!/^local-python-\d{2}$/.test(slug || '') || !design || language !== 'python') return []
  const docs = {}
  for (const [name, direction] of Object.entries(moves)) {
    docs[name] = method(name,
      `让英雄向画面${direction}方移动。括号留空走 **1 格**；填整数表示走几格。每格以地面的粗砖缝为界，英雄从一格中心走到下一格中心，走完才执行下一行。\n\n${design.singleStep ? '**本关每次只能走 1 格**，请用循环完成重复移动。' : '例如填 `2` 就连续走 2 格。'}移动不会自动绕开墙、尖刺或守卫，硬闯可能受伤。`,
      design.singleStep ? `hero.${name}()` : `hero.${name}()  # 走1格\nhero.${name}(2)  # 走2格`,
      [arg('steps', 'number', design.singleStep ? '步数：本关省略或填整数1。' : '步数：填正整数，也可以填保存了正整数的变量；省略时为1。', '1', true)])
  }
  docs.say = method('say',
    '让英雄把内容说出来，显示在头顶气泡中。**文字加引号，变量不加引号**。说完才继续执行下一行。\n\n报门岗口令时，先站到守卫正前方紧邻的一格；不能隔墙交谈。点亮信号台要走到台前。站得远时说话不会开门或启动机关。',
    'hero.say("你好")\nnumber = 3\nhero.say(number)',
    [arg('message', 'string / number', '要说的文字或数字；变量会读出它当前保存的值。', '"你好"')])
  docs.pathOpen = method('pathOpen',
    '查看指定方向的门岗是否放行。**只检查，不会移动英雄，也不会替你开门。**\n\n它不检查尖刺或巡逻；需要判断危险时，再使用本关提供的 `hero.nextTileSafe()`。',
    'open_right = hero.pathOpen("right")',
    [arg('direction', 'string', '方向必须加引号："right"右、"left"左、"up"上、"down"下。只查询本关任务中提供的方向。', '"right"')],
    result('boolean', '`True` 表示该方向放行；`False` 表示未放行。可用于 `if` 判断。'))
  docs.take = method('take',
    '站在补给箱前，打开箱子并把整批物品装进背包。**返回真正领取的数量**，可以存入变量。同一个箱子只能领取一次；空箱返回0。离开领取位置后不能隔空取物。',
    'stones = hero.take("补给箱")', [arg('name', 'string', '箱子名字，要加英文引号。', '"补给箱"')], result('number', '本次领取的物品数量；实际背包同时增加。'))
  docs.give = method('give',
    '先走到收货人或机关前，再交出指定数量的物品。**背包会实际减少，但保存数量的变量不会自动改变。**数量不足、目标错误、位置不对都不会交付成功；每处收齐后不要重复交付。',
    design.index === 12 ? 'hero.give("守卫", 4)' : design.index >= 16 ? 'hero.give("炉座", 1)' : 'hero.give("出口机关", stones)',
    [arg('name', 'string', '地图上的收货人或机关名称，要加英文引号。多个炉座都用"炉座"，只交给当前面前的那一座。', JSON.stringify(design.inventory?.receivers?.[0]?.name || '目标名称')), arg('amount', 'number', '要交出的正整数数量，可以填写变量；不加引号。', '1')])
  docs.pathLength = method('pathLength',
    '读取本场景路牌上给出的**路程格数**，括号里不用填内容。可以先存入变量，再决定走几次。\n\n这是路牌上的数，英雄走动后它**不会自动减1**；记录剩余格数的变量需要自己更新。',
    'length = hero.pathLength()', [], result('number', '路牌给出的非负整数，例如0、2或4。0表示不需要前进。'))
  docs.openTag = method('openTag', '走到货箱正下方紧邻的一格，转向货箱并拆封，取下纸签带在身上。开盖和取签约需1.2秒，动作结束才执行下一行。已经打开的货箱不会重复拆封。', 'hero.openTag("货箱封签")', [arg('name', 'string', '货箱名称。', '"货箱封签"')])
  docs.readTag = method('readTag', '读取已拆封货箱上的完整文字。先用 hero.openTag 拆封；拆开后可在任意位置读取。读取不移动英雄，也不会自动取出字符；使用索引取得任务要求的字符后再发言。', 'label = readTag("货箱封签")', [arg('name', 'string', '封签名称。', '"货箱封签"')], result('string', '封签的完整文字，例如 东-药品-07。'))
  docs.readSignal = method('readSignal',
    '读取当前场景石刻或徽章上的**能量数值**，括号里不用填内容。读数不会移动英雄，也不会自动选择通道。',
    'score = hero.readSignal()', [], result('number', '本场景给定的整数，可与任务中的门槛比较，例如 `score >= 80`。'))
  docs.atBeacon = method('atBeacon',
    '检查英雄**现在是否站在信标终点**，括号里不用填内容。检测不会移动英雄。\n\n在循环条件中重新调用，才能得到移动后的结果；起点就在信标上时，第一次检测就会得到 `True`。',
    'arrived = hero.atBeacon()', [], result('boolean', '已到信标为 `True`，尚未到达为 `False`；`not hero.atBeacon()` 表示“还没到”。'))
  docs.nextTileSafe = method('nextTileSafe',
    '检查**从当前位置向右走1格的路程**是否会遇到尖刺或巡逻守卫。括号里不用填方向；它始终检查右边，不随人物朝向改变。\n\n这不是门岗开关检测，也不会帮英雄移动。巡逻会变化，等待后要重新检查。',
    'safe = hero.nextTileSafe()', [], result('boolean', '`True` 表示这一段没有检测到上述危险；`False` 表示暂时不能安全右行。'))
  docs.press = method('press',
    '按下英雄**脚下的编号开关**。先走到对应石板，再把编号填进括号；编号可以用循环变量。\n\n站错位置、填错编号或顺序不对，本次运行会失败。调用它不会替英雄走到开关旁。',
    'hero.press(1)  # 已站在1号开关上时使用',
    [arg('number', 'number', '要按的开关编号，填整数，不加引号。必须符合本关要求的顺序。', '1')])
  docs.wait = method('wait',
    '让英雄暂停行动，按**整数秒**等待后执行下一行。省略参数时等待 **1 秒**，`hero.wait(1)` 等待1秒。\n\n等待期间，刷怪、巡逻、敌人攻击和营火受伤都照常发生。while中没有行动的分支也会继续推进游戏，不需要用wait来“启动”时间。等待后要重新检查路况或寻找敌人。',
    'hero.wait()  # 等1秒\nhero.wait(3)  # 等3秒',
    [arg('seconds', 'number', '等待的游戏秒数，填0到30之间的整数，不支持小数。省略为1；0表示不主动停顿。', '1', true)])
  if (design.chargePlates?.length) {
    docs.wait.description += `\n\n本关有${design.chargePlates.length}块石板，每块需停留${design.chargePlates[0].seconds}秒。踩亮当前这块，再走向下一块。已点亮的石板保持点亮；在同一块上等更久不能替其他石板充能。按真实停留时间计，不按wait调用次数计。`
    docs.wait.example.python = 'hero.wait()  # 在脚下石板停留1秒'
    docs.wait.snippets.python.code = 'hero.wait()'
  }
  const rescue = design.adventure?.mode === 'rescue'
  docs.attack = method('attack',
    '对指定的敌人或牢门攻击**一次**。离得远时会先走近；一次挥剑造成20点伤害，目标可能需要多次攻击。\n\n可以传入带引号的对象名字，也可以传入找到的敌人变量。不要攻击 `None`、友方或已经倒下的目标。',
    rescue ? 'hero.attack("牢门")  # 攻击一次' : 'enemy = hero.findNearestEnemy()\nif enemy:\n    hero.attack(enemy)',
    [arg('target', 'string / object', rescue ? '填写地图中的准确名字（加引号），或传入hero.findNearestEnemy()得到的敌人变量（不加引号）。' : '通常填找到的敌人变量enemy，不要写成字符串"enemy"；先用if enemy:确认存在目标。', rescue ? '"牢门"' : 'enemy')])
  docs.findNearestEnemy = method('findNearestEnemy',
    '寻找**当前可见、距离最近的活着的敌人**，括号里不用填内容。不会自动攻击，也不会返回牢门或友军。\n\n把结果保存在变量里；敌人倒下或新一波出现后，需要再次调用。旧变量不会自动换成新敌人。',
    'enemy = hero.findNearestEnemy()', [], result('object / None', '找到时返回敌人对象，可传给 `hero.attack(enemy)`；没找到时返回 `None`。用 `if enemy:` 判断是否找到了。'))
  docs.isVictory = method('isVictory',
    '检查守营任务是否已经**击败全部增援**，括号里不用填内容。它只检查结果，不会让英雄自动战斗。\n\n暂时没有敌人不代表已经获胜，后面可能还有增援。`not hero.isVictory()` 表示“还没获胜”。',
    'finished = hero.isVictory()', [], result('boolean', '守营目标完成为 `True`，尚未完成为 `False`。可放在while条件中反复检查。'))
  docs.readObject = method('readObject', '读取指定装置本次的文字。**先走到装置正下方一格**，名称必须完全一致。返回字符串，不会自动执行后续动作。救援后重新读取会得到更新的回声图。', `text = hero.readObject("${design.stringMission?.object || '回声镜'}")`, [arg('name', 'string', '地图装置的名字。', `"${design.stringMission?.object || '回声镜'}"`)], result('string', '本次现场文字；保存到变量中处理。'))
  docs.buildBridge = method('buildBridge', '在卷轴台安装三个符文桥板。参数是卷轴方括号内的文字；动作完成后桥板升起，才能过桥。', 'hero.buildBridge(runes)', [arg('runes', 'string', '三块符文，按卷轴顺序。', 'runes')])
  docs.playTune = method('playTune', '站在回声鼓下方敲一段完整节拍。参数每个字对应一拍；胸口灯随节拍亮起，敲错那一拍会变红。', 'hero.playTune(tune)', [arg('tune', 'string', '三遍原节拍，再接一遍倒序节拍。', 'tune')])
  docs.rescue = method('rescue', '在回声镜旁控制吊索，把指定矿洞的矿工拉回。位置从0开始；必须确实有人。救完重新读取回声图。', 'hero.rescue(position)', [arg('position', 'number', '回声图中“人”的位置，0到5。不能传-1。', 'position')])
  docs.purify = method('purify', '在净水泵旁写入清理后的识别码。水色变蓝后才可以穿过水渠。', 'hero.purify(clean)', [arg('clean', 'string', '去两端空格、删除所有“毒”、统一为大写后的文字。', 'clean')])
  docs.pack = method('pack', '在订单台装车。物品和数量来自本次订单；必须同时正确。装车后还要走到营地卸货。', 'hero.pack(item, amount)', [arg('item', 'string', '订单中的物品名称。', 'item'), arg('amount', 'number', '整数数量；拆开的文字要先用int转换。', 'amount')])
  docs.deliver = method('deliver', '走到营地旗帜正下方一格，卸下已装好的补给。括号留空；不能远程送达，也不能空车交货。', 'hero.deliver()')
  const print = {
    name: 'print',
    displayName: 'print(message)',
    type: 'snippet',
    owner: 'snippets',
    hideGrantedBy: true,
    teachingCommand: true,
    description: '在本训练营中，`print(...)` 会让英雄**用头顶气泡说出内容**，与 `hero.say(...)` 一样。文字加引号，变量不加引号；不用写 `hero.print(...)`。\n\n报门岗口令要站到守卫正前方紧邻的一格；点亮信号台要走到台前。普通Python中的print通常输出到控制台；这里是游戏的专门适配。',
    example: { python: 'print("你好")\nnumber = 3\nprint(number)' },
    // Ace placeholders must remain literal text until inserted into the editor.
    // eslint-disable-next-line no-template-curly-in-string
    snippets: { python: { tab: 'print', code: 'print(${1:"你好"})' } },
  }
  return [...new Set([...Object.keys(moves), 'say', ...(design.apis || [])])].map(name => {
    if (!docs[name]) throw new Error(`Missing teaching command documentation: ${name}`)
    const doc = docs[name]
    doc.teachingScope = GLOBAL_QUERIES.includes(name) ? 'global' : ['take', 'give', 'press', 'openTag', 'readObject', 'buildBridge', 'playTune', 'rescue', 'purify', 'pack', 'deliver'].includes(name) ? 'nearby' : name === 'attack' ? 'target' : 'hero'
    const labels = { global: '环境查询 · 随时可调用', nearby: '近距离交互 · 先走到目标位置', target: '指定目标 · 自动靠近后攻击', hero: '英雄动作或感知' }
    doc.description = `**${labels[doc.teachingScope]}**\n\n${doc.description}`
    for (const globalName of GLOBAL_QUERIES) {
      doc.description = doc.description.replaceAll(`hero.${globalName}(`, `${globalName}(`)
      doc.example.python = doc.example.python.replaceAll(`hero.${globalName}(`, `${globalName}(`)
    }
    if (doc.teachingScope === 'global') {
      doc.type = 'snippet'; doc.owner = 'snippets'
      doc.displayName = `${name}(${doc.args.map(a => a.name).join(', ')})`
      doc.snippets.python.code = doc.snippets.python.code.replace(`hero.${name}`, name)
    }
    return doc
  }).concat({ ...print, teachingScope: 'global' })
}

module.exports = { commandDocs }
