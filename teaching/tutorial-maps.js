// New teaching chains remain hidden until explicitly opened by the teacher.
const originals = require('./adventure-maps')
const copy = n => JSON.parse(JSON.stringify(originals.find(d => d.index === n)))
const base = (index, section, name, extra) => ({ index, section, name, lessonOrder: index, revision: 1, prototype: true, checkpoints: [], gems: [], hazards: [], gates: [], torches: [], labels: [], exitStyle: 'stairs', exitDirection: [1, 0], maxActions: 90, tip: '展开“教学引导”，按步骤写代码并运行。也可以收起引导自己尝试。', ...extra })
const corridor = { size: [72, 40], start: [12, 12], exit: [48, 12], corridors: [[8, 12, 64, 12]], torches: [[8, 24], [58, 24]] }
const target = { id: '落单斥候', kind: 'enemy', at: [30, 12], health: 20, speed: 0, damage: 1, aggro: 0 }
module.exports = [
  base(26, 6, '攻击教学：击破第一扇牢门', {
    ...corridor,
    apis: ['attack'],
    knowledge: 'attack · 名字字符串 · 生命值',
    quest: '牢门挡住了通道。把门击破，再走到右侧楼梯。',
    description: '牢门有40点生命，每次 hero.attack("牢门") 造成20点伤害。先运行一次攻击，观察血条，再补充攻击和移动，击破门并到达楼梯。撞门会受伤；本关没有敌人。',
    starter: '# 先写一次攻击，点击“运行”，看牢门的血条。\n',
    adventure: { mode: 'rescue', actors: [{ id: '牢门', kind: 'door', at: [30, 12], health: 40 }] },
    goals: [{ id: 'break-door', name: '击破牢门（40 → 0）' }],
    tutorial: {
      title: '第一次使用 attack',
      steps: [
        { text: '输入下面这行并运行。英雄会走近牢门，挥剑一次。', code: 'hero.attack("牢门")', observe: '门的血条从40降到20。第一步只观察，还不会通关。', evidence: { kind: 'damaged', id: '牢门' } },
        { text: '在下一行再写一次相同攻击，重新运行。每次运行都会恢复地图。', observe: '两次攻击后牢门破碎，通道打开。', evidence: { kind: 'dead', id: '牢门' } },
        { text: '在两次攻击后写 hero.moveRight(2)，运行完整程序，从右侧楼梯离开。', observe: '过关后点击提交，进入救援挑战。', evidence: { kind: 'exit' } },
      ],
    },
    hints: ['目标名字用英文引号包住，写成 "牢门"。', '每次运行都从起点重来，请保留已经写好的两次攻击。'],
    solution: 'hero.attack("牢门")\nhero.attack("牢门")\nhero.moveRight(2)\n',
  }),
  { ...copy(23), index: 27, lessonOrder: 27, section: 6, name: '救援挑战：让弓箭手加入', apis: ['attack'], starter: '# 用刚学的攻击命令破门，救出弓箭手，再击败守卫。\n', tutorial: null },
  base(28, 7, '信号教学：走近后再点火', {
    size: [72, 60],
    start: [12, 12],
    exit: [48, 12],
    corridors: [[8, 12, 64, 12], [24, 12, 24, 40]],
    apis: [],
    knowledge: '发言的位置 · 完整动作组',
    quest: '侧路尽头有一座熄灭的信号台。把它点亮，再回主廊离开。',
    description: '先右走1格、上走2格，到信号台前说“点火”，再下走2格、右走2格到楼梯。在起点说话或口令不对都不会点亮。print 和 hero.say 都能发言。',
    starter: '# 先走到信号台前，再说“点火”。\n',
    adventure: { mode: 'signals', actors: [{ id: '信号台1', kind: 'signal', at: [24, 36], health: 1 }] },
    goals: [{ id: 'signal-1', name: '点亮信号台' }],
    tutorial: {
      title: '一句话要在正确的位置说',
      steps: [
        { text: '输入并运行下面的三行。注意英雄说话时站在哪里。', code: 'hero.moveRight()\nhero.moveUp(2)\nprint("点火")', observe: '英雄到台前发言后，火焰才亮起。', evidence: { kind: 'lit', id: '信号台1' } },
        { text: '接着写下走2格、右走2格，重新运行完整程序。', code: 'hero.moveDown(2)\nhero.moveRight(2)', observe: '下一关有三座台，把“上去、点火、回来、去下一台”放进for。', evidence: { kind: 'exit' } },
      ],
    },
    hints: ['相同发言在起点不会生效；先改变位置，再观察火焰。'],
    solution: 'hero.moveRight()\nhero.moveUp(2)\nprint("点火")\nhero.moveDown(2)\nhero.moveRight(2)\n',
  }),
  { ...copy(24), index: 29, lessonOrder: 29, section: 7, name: 'for挑战：点亮三座信号台', tutorial: null },
  base(30, 8, '观察教学：找到敌人再攻击', {
    ...corridor,
    apis: ['findNearestEnemy', 'attack'],
    knowledge: '返回值 · 变量 · attack(enemy)',
    quest: '通道里有一名落单斥候。这次用查找命令取得目标，不把敌人的名字写死。',
    description: '先右走1格。用 enemy = hero.findNearestEnemy() 保存查找结果，再用 hero.attack(enemy) 攻击。斥候20点生命，一次攻击即可击败。最后右走2格到楼梯。本关保证有敌人，下一关会出现空通道。',
    starter: 'hero.moveRight()\n# 查找敌人，把结果保存在 enemy 中，再攻击。\n',
    adventure: { mode: 'rescue', actors: [target] },
    goals: [{ id: 'defeat-guard', name: '击败落单斥候' }],
    tutorial: {
      title: 'enemy 保存的是找到的敌人',
      steps: [
        { text: '在已有移动语句后输入下面两行并运行。enemy不加引号。', code: 'enemy = hero.findNearestEnemy()\nhero.attack(enemy)', observe: '查找本身不攻击；下一行才让英雄向找到的敌人挥剑。', evidence: { kind: 'dead', id: '落单斥候' } },
        { text: '最后加 hero.moveRight(2)，重新运行，从楼梯离开。', observe: '没有敌人时查找结果是None；下一关练习先判断再攻击。', evidence: { kind: 'exit' } },
      ],
    },
    hints: ['"enemy" 是文字，enemy 才是变量里保存的目标。'],
    solution: 'hero.moveRight()\nenemy = hero.findNearestEnemy()\nhero.attack(enemy)\nhero.moveRight(2)\n',
  }),
  base(31, 8, '判断教学：没有敌人就不攻击', {
    ...corridor,
    apis: ['findNearestEnemy', 'attack'],
    knowledge: 'if enemy · None · 两种场景',
    quest: '通道有时有斥候，有时是空的。同一份程序都要安全通过。',
    description: '先右走1格，查找并保存enemy。只有找到敌人时才攻击；没有敌人就跳过攻击。最后右走2格到楼梯。两个场景必须使用同一份代码。',
    starter: 'hero.moveRight()\nenemy = hero.findNearestEnemy()\n# 用 if 判断有敌人才攻击。\n',
    adventure: { mode: 'rescue', actors: [target] },
    goals: [],
    scenarios: [true, false].map(present => ({ title: present ? '通道里有斥候' : '空通道，没有敌人', adventure: { mode: 'rescue', actors: present ? [target] : [] }, solution: 'hero.moveRight()\nenemy = hero.findNearestEnemy()\nif enemy:\n    hero.attack(enemy)\nhero.moveRight(2)\n' })),
    tutorial: {
      title: '用 if 避免攻击空目标',
      steps: [
        { text: '查找后加入下面两行。if行末写冒号，攻击行缩进4个空格。', code: 'if enemy:\n    hero.attack(enemy)', observe: '找到敌人时执行攻击；结果为None时跳过。', evidence: { kind: 'call', name: 'findNearestEnemy' } },
        { text: '最后写 hero.moveRight(2)，不要缩进。运行并提交后，继续验证空通道场景，不改代码。', observe: '无论有没有敌人，都要到达楼梯。', evidence: { kind: 'exit' } },
      ],
    },
    hints: ['最后的移动放在if外面，否则没有敌人时英雄不会离开。'],
  }),
  base(32, 8, '守营准备：等待与胜利条件', {
    ...copy(25),
    index: 32,
    lessonOrder: 32,
    section: 8,
    name: '守营准备：等待与胜利条件',
    scenarios: undefined,
    knowledge: 'wait · isVictory · 延迟增援',
    adventure: { mode: 'defend', camp: { at: [36, 12], health: 100 }, actors: [{ ...target, id: '迟到的斥候', at: [24, 24], spawnAt: 1, speed: 4, aggro: 100 }] },
    quest: '一名斥候稍后才会出现。先看看是否已经获胜，等待后再查找并击败它。',
    description: '输入 print(hero.isVictory())，观察开局结果False。hero.wait() 等待0.5秒；等待后重新查找，再用if确认有敌人并攻击。本关只有一名20点生命的敌人；击败后自动通关，不必走楼梯。',
    starter: '# 先显示是否已经获胜，再等待、查找、攻击。\n',
    tutorial: {
      title: '暂时没敌人，不等于已经获胜',
      steps: [
        { text: '先运行下面两行。isVictory返回是否已获胜；wait让游戏时间前进半秒。', code: 'print(hero.isVictory())\nhero.wait()', observe: '开局显示False。等待后才能看到稍后出现的敌人。', evidence: { kind: 'call', name: 'wait' } },
        { text: '在后面加查找和有敌人才攻击的代码，再运行。', code: 'enemy = hero.findNearestEnemy()\nif enemy:\n    hero.attack(enemy)', observe: '击败唯一敌人后自动过关。下一关把查找、判断和等待放进while。', evidence: { kind: 'victory' } },
      ],
    },
    hints: ['isVictory判断整场战斗是否已经结束，不是在问眼前有没有敌人。', '等待后重新查找目标。把攻击放在if里；这一关先不用循环。'],
    solution: 'print(hero.isVictory())\nhero.wait()\nenemy = hero.findNearestEnemy()\nif enemy:\n    hero.attack(enemy)\n',
  }),
  { ...copy(25), index: 33, lessonOrder: 33, section: 8, name: 'while挑战：守住分批增援', tutorial: null },
]
