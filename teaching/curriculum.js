// Pedagogical position is independent of stable level IDs and publication state.
const chapters = [
  { title: '门岗与宝藏', knowledge: '顺序执行 · 输出 · 参数 · 攻击', mark: 'Ⅰ' },
  { title: '岔路与选择', knowledge: '变量 · 运算 · 条件判断', mark: 'Ⅱ' },
  { title: '机关长廊', knowledge: 'for · range · 重复动作组', mark: 'Ⅲ' },
  { title: '寻找信标', knowledge: 'while · 停止条件 · 守营', mark: 'Ⅳ' },
  { title: '互动样关', knowledge: '备选场景 · 教师按需试用', mark: '试玩', prototype: true },
]
const defaultVisible = design => !design.prototype && !design.hiddenByDefault
const order = level => {
  const design = level.teachingMap || level
  return design.lessonOrder ?? ({ 1: 3, 2: 4, 3: 5 }[design.index] ?? design.index)
}
const compareLevels = (a, b) => order(a) - order(b)
const sectionLabel = section => section === 5 ? '互动样关（备选）' : `第 ${section} 小节 · ${chapters[section - 1].title}`
module.exports = { chapters, defaultVisible, compareLevels, sectionLabel }
