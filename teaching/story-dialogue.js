// Decorative lines never call hero.say or enter the student's speech/goal records.
const openings = {
  1: '宝石会闪，尖刺也会闪。希望我们今天能分清这两种闪。',
  2: '这条走廊可真长。我的小短腿先交给你安排了。',
  3: '下面那位一直在巡逻……我先把钢盆戴稳。',
  4: '第一天出门就遇上门岗。别紧张，我看起来应该挺像个好人的吧？',
  5: '信拿好了。守卫看着有点严肃，待会儿你替我想想怎么开口。',
  6: '一封信，两道门。今天的送信路线还挺讲究。',
  7: '地图上居然标了距离。这回终于不用靠我的腿长估算了。',
  8: '前面的路已经有人走过一段了。让我看看，还剩多少。',
  9: '那边的守卫时不时就拦路。我可不想用脑袋试门开没开。',
  10: '又是岔路口。我的直觉说两边都想看看，但钢盆说要谨慎。',
  11: '路口开着也不一定安全。上次那些尖刺，我可还记得。',
  12: '三道门，三种要求。看来今天光靠礼貌还不够。',
  13: '这些石板长得一模一样。该不会是在考验我的记性吧。',
  14: '石板还编了号。行，至少不用给它们挨个起名字。',
  15: '这排编号隔一个才算数。它们还挺有自己的规矩。',
  16: '又是一条长廊。先看看路牌，这次可别拿上次的距离凑数。',
  17: '我负责走，你负责记还剩几格。别让我一激动走过头了。',
  18: '这份勘路记录怎么越看越像一张健身计划……它真的会停吗？',
  19: '前面有光。我们要找的信标，应该就藏在这段路上。',
  20: '巡逻的又来了。没关系，我们不赶这一两秒。',
  21: '门岗、弯路、信标，都见过了。今天把它们串起来走一趟。',
  22: '那家伙跑得挺凶。硬拼不一定行，我们得动动脑子。',
  23: '牢房里还有人！先把她带出来，我可不想一个人打那身重甲。',
  24: '三座信号台都黑着。等我们过去，这条路就该亮起来了。',
  25: '营火还热着，可不能让他们给踩灭了。小鲸鱼，往后站。',
  26: '门锁得挺结实。幸好今天带的饭勺，不只会盛饭。',
  28: '那座台怎么不亮？走近看看，说不定只是缺个人喊一声。',
  30: '前面那个看起来不像来送信的。先看清楚，别打错人。',
  31: '这一段有时候有人，有时候没人。我先瞧瞧，饭勺不急着挥。',
  32: '营地暂时很安静。安静归安静，现在收拾东西好像还早了点。',
}
openings[27] = openings[23]; openings[29] = openings[24]; openings[33] = openings[25]

const endings = {
  1: '宝石带上了，人也好好的。今天这趟，值！',
  4: '稳稳停住！钢盆没磕着，第一步还挺像那么回事。',
  5: '他让开了！看来有时候，一句对的话比一把大饭勺管用。',
  6: '信送到了。两道门岗都记住我这只钢盆了吧。',
  17: '二、一、零。正好走完，脚底板表示满意。',
  18: '这次停住了！我的腿终于不用无限加班了。',
  19: '找到信标了。亮光就在眼前，这回不用再多走一步。',
  21: '绕了这么一大圈，还是走出来了。新手村这几条路，我记住了。',
  26: '门开了，饭勺也没断。嗯，质量不错。',
  27: '有人一起走，连这条地牢都没那么阴森了。',
  28: '亮了！回头看一眼，这盏灯是我们点的。',
  29: '三盏都亮了。回去的时候，小鲸鱼也不会迷路了。',
  32: '原来只是来得晚。等一等，还真没白等。',
  33: '营火守住了。现在可以坐下烤烤手了吧？',
}
const reactions = {
  wall: ['碰壁了', '嘶……钢盆护住了头，没护住鼻子。这面墙比我倔。'],
  gate: ['被拦住了', '好好好，我停。我是来送信的，不是来拆门岗的。'],
  door: ['门还没开', '哎哟，门没让路，我倒先撞上了。饭勺，还是得你出场。'],
  spikes: ['踩到尖刺', '这地面也太扎脚了……下次可不能把亮尖尖当装饰。'],
  hurt: ['受伤了', '哎，别敲我的钢盆！这可是我的正经装备。'],
  down: ['暂时倒下', '我先躺一小会儿。别慌，咱们把刚才那段路想清楚。'],
  seal: ['出口还没开', '出口就在这儿，可封印还亮着。肯定有什么被我们落下了。'],
  reject: ['口令不对', '他摇头了。刚才那句话，大概不是他想听的。'],
  far: ['离得太远', '好像没听见……我的嗓门还没大到能隔着整条走廊聊天。'],
  ignite: ['点亮信号', '亮起来了！嗯，这一下看着就很有成就感。'],
  rescue: ['救出同伴', '出来啦！跟紧我们，剩下这段路一起走。'],
  break: ['击破牢门', '咔嚓！门终于撑不住了。饭勺今天立大功。'],
}

function storyLine (design, kind, time) {
  const [label, text] = kind === 'entry'
    ? ['出发前', openings[design.index] || '钢盆戴好，饭勺带好。走吧，看看前面有什么。']
    : kind === 'complete' ? ['顺利完成', endings[design.index] || '这段路算是认熟了。走，下一站！'] : reactions[kind]
  return { speaker: 'hero', source: 'story', kind, label, text, time, key: `story:${kind}` }
}
function read (value) { try { return JSON.parse(value || '{}') || {} } catch (_) { return {} } }
function storyEvents (design, hero, guards, now) {
  if (!hero) return []
  const v = read(hero.teachingVisual); const a = read(hero.teachingAdventure)
  const reached = at => Number.isFinite(at) && at >= 0 && at <= now
  const events = []
  const add = (kind, at) => { if (reached(at)) events.push(storyLine(design, kind, at)) }
  if (reached(v.completedAt)) { add('complete', v.completedAt); return events }
  const issue = typeof v.issue === 'string' ? v.issue : ''
  if (reached(v.issueAt)) {
    if (/尖刺/.test(issue)) add('spikes', v.issueAt)
    else if (/牢门.*(硬闯|撞伤)/.test(issue)) add('door', v.issueAt)
    else if (/守卫.*(拦住|挡住)/.test(issue)) add('gate', v.issueAt)
    else if (/墙|被挡住|硬闯/.test(issue)) add('wall', v.issueAt)
    else if (/封印/.test(issue)) add('seal', v.issueAt)
    else if (/太远/.test(issue)) add('far', v.issueAt)
  }
  if (!events.length && reached(v.wallAt)) add('wall', v.wallAt)
  if (!events.length && reached(v.diedAt)) add('down', v.diedAt)
  if (!events.length && reached(v.hurtAt)) add('hurt', v.hurtAt)
  for (const g of guards) if (g?.teachingGateStatus === 'rejected') add('reject', g.teachingGateMessageAt)
  for (const e of Array.isArray(a.events) ? a.events : []) if (['ignite', 'rescue', 'break'].includes(e.kind)) add(e.kind, e.at)
  return events.sort((a, b) => b.time - a.time)
}

class StoryMemory {
  constructor (design, storage) {
    this.storage = storage; this.key = `deepseek-story-v1:${design.slug || design.index}:${design.scenarioIndex || 0}`
    let saved = []
    try { saved = JSON.parse(storage?.getItem(this.key) || '[]') } catch (_) {}
    this.seen = new Set(Array.isArray(saved) ? saved.filter(s => typeof s === 'string') : [])
    this.shown = []
  }

  has (line) { return this.seen.has(line.key) }
  remember (line, shown = true) {
    this.seen.add(line.key)
    if (shown) this.shown.push(line)
    try { this.storage?.setItem(this.key, JSON.stringify([...this.seen])) } catch (_) {}
  }
}
module.exports = { storyLine, storyEvents, StoryMemory }
