// A classroom group is a teaching unit, not a world-map chapter.
const strings = require('./string-missions')
const tasks = {
  ...strings.tasks,
  basic: { slug: 'local-python-34', title: '封签运送：通过两个核验口', stage: '字符串索引 · 完整任务', goal: '区域首字和编号末位', sceneCount: 1 },
  independent: { slug: 'local-python-35', title: '独立巩固：北侧仓道送件', stage: '按需独立巩固', goal: '区域首字和编号末位', sceneCount: 1 },
  remedial: { slug: 'local-python-36', title: '辅助练习：看字符位置完成送件', stage: '按需补救', goal: '区域首字和编号末位', sceneCount: 1 },
  recheck: { slug: 'local-python-37', title: '独立复验：换条仓道送件', stage: '按需独立复验', goal: '区域首字和编号末位', sceneCount: 1 },
  challenge: { slug: 'local-python-38', title: '索引复习：双岗送件', stage: '按需复习', goal: '区域首字和编号末位', sceneCount: 1 },
}
const course = { id: 'string-index', title: '字符串工坊 · 从封签到营地补给', groups: [{ id: 'index', title: '索引：两个核验口', tasks: { basic: tasks.basic, remedial: tasks.remedial } }, ...Object.entries(strings.tasks).map(([id, task]) => ({ id, title: task.stage, tasks: { [id]: task } }))] }
function hints (taskId) {
  const specific = strings.hints(taskId); if (specific) return specific
  const t = tasks[taskId]; if (!t) return []
  return [
    { level: 1, target: 'tag', text: '先走到货箱正下方一格拆封。区域岗需要开头的字，尾号岗需要最后一个字符；分别走到两名守卫面前发言。' },
    { level: 2, target: 'editor', text: '用 hero.openTag("货箱封签") 拆封，再把 readTag("货箱封签") 的结果保存为 label。第一个字符的位置是0，最后一个字符可以用-1；两次发言中间需要走到另一名守卫前。' },
    { level: 3, target: 'editor', text: '将这两句分别放到对应守卫面前的发言位置，不要站在同一个地方连说两句。', code: 'print(label[0])  # 区域岗面前\nprint(label[-1])  # 尾号岗面前' },
  ]
}
function definitions () {
  return Object.entries(tasks).filter(([id]) => !strings.tasks[id]).map(([id, t], offset) => {
    const upper = ['independent', 'recheck'].includes(id)
    const baseY = upper ? 36 : 12
    const otherY = upper ? 12 : 36
    const chestX = id === 'recheck' ? 36 : 24
    const beforeRead = `hero.moveRight(${(chestX - 12) / 12})\nhero.openTag("货箱封签")\nlabel = readTag("货箱封签")\n`
    const afterRead = `hero.moveRight(${(48 - chestX) / 12})\n`
    const instructions = `先到${upper ? '上面' : '下面'}的区域岗报首字，再到${upper ? '下面' : '上面'}的尾号岗报末位。两个守卫都放行后，到右侧法阵交货。这是一项完整任务，中途不用提交或换关。`
    const guard = (name, at, approach, answer) => ({ id: name, name: answer === 'first' ? '区域岗守卫' : '尾号岗守卫', goalLabel: answer === 'first' ? '区域岗：报出封签首字' : '尾号岗：报出封签末位', at, aside: [at[0], at[1] + 12], approach, password: '', answers: [], tagAnswer: answer, greeting: answer === 'first' ? '这是区域核验口，请报封签开头的区域字。' : '这是尾号核验口，请报封签最后一位。' })
    return {
      index: 34 + offset,
      section: 5,
      prototype: true,
      hiddenByDefault: true,
      lessonOrder: 100 + offset,
      revision: 3,
      name: t.title,
      knowledge: '字符串索引 · 读取信息 · 发言',
      quest: `找到货箱，走到箱子正下方一格拆封。${instructions}`,
      description: `先走到货箱正下方一格，用 hero.openTag("货箱封签") 打开货箱并取下纸签，再用 readTag("货箱封签") 把封签文字保存下来。${instructions}每次运行的封签可能不同。地图点击只查看对象和命令，不会替你执行操作。`,
      tip: '观察箱子开盖和纸签展开，再读取文字；两个核验口看的是封签的不同位置。',
      size: [108, 72],
      start: [12, baseY],
      exit: [96, otherY],
      corridors: [[12, baseY, 72, baseY], [chestX, baseY, chestX, baseY + 12], [60, baseY, 60, baseY + 12], [72, 12, 72, 36], [72, otherY, 102, otherY], [84, otherY, 84, otherY + 12]],
      checkpoints: [],
      gems: [],
      hazards: [],
      torches: [[8, 40], [72, 60]],
      labels: [],
      exitStyle: 'portal',
      exitDirection: [1, 0],
      apis: ['openTag', 'readTag'],
      maxActions: 60,
      allowCodeChanges: true,
      hints: [],
      classroomTask: id,
      starter: id === 'basic' || id === 'remedial' ? '# 先走到货箱下方，运行后观察拆封。\nhero.moveRight()\nhero.openTag("货箱封签")\nlabel = readTag("货箱封签")\n# 再走到守卫面前，说出他要求的字符，最后送到法阵。\n' : '# 找到货箱，拆封并读取文字。\n# 观察核验口的要求，写出这次的送货路线。\n',
      scenarios: [{
        title: '两个核验口',
        sensor: { tag: { name: '货箱封签', at: [chestX, baseY + 12], requiresOpen: true, randomized: true, showIndices: id === 'remedial', regions: ['东', '南', '西', '北', '林', '海'], suffixes: ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'], items: ['药品', '工具', '防雨布', '绳索', '饮用水', '粮食'] } },
        inscriptions: [{ x: chestX, y: baseY + 19, text: '待拆封' }],
        gates: [guard('Region Guard', [60, baseY], [48, baseY], 'first'), guard('Number Guard', [84, otherY], [72, otherY], 'last')],
        solution: beforeRead + afterRead + `print(label[0])\nhero.moveRight(2)\nhero.${upper ? 'moveDown' : 'moveUp'}(2)\nprint(label[-1])\nhero.moveRight(2)\n`,
      }],
    }
  }).concat(strings.definitions())
}
module.exports = { course, tasks, hints, definitions }
