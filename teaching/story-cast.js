// Chapter/cast policy. Character art never changes lesson mechanics or release state.
const chapter = { id: 'starter-village', name: '新手村', sections: [1, 2, 3, 4], hero: 'deepseek', mentor: 'liang-wenfeng', story: 'light' }
const heroes = [
  ['deepseek', 'DeepSeek 鲸鱼娘'], ['gpt', 'GPT 娘'], ['claude', 'Claude 娘'], ['glm', 'GLM 娘'],
  ['kimi', 'Kimi 娘'], ['seed', 'Seed 娘'], ['grok', 'Grok 娘'], ['qwen', 'Qwen 娘'], ['gemini', 'Gemini 娘'], ['doubao', '豆包娘'],
].map(([id, name]) => ({ id, name, unlocked: id === chapter.hero, image: `/teaching/assets/characters/${id}.png` }))
const npcs = [
  { id: 'liang-wenfeng', name: '梁文锋', role: '新手村导师', active: true, image: '/teaching/assets/characters/liang-wenfeng.png' },
  { id: 'liang-wufeng', name: '梁武峰', active: false, variantOf: 'liang-wenfeng', role: '虚构武将版／玩梗分身', image: '/teaching/assets/npcs/liang-wufeng.png', artStatus: 'portrait-draft' },
  { id: 'jensen-huang', image: '/teaching/assets/npcs/jensen-huang.png', artStatus: 'portrait-draft', name: '黄仁勋', active: false, role: '后续工坊人物' },
  { id: 'lisa-su', image: '/teaching/assets/npcs/lisa-su.png', artStatus: 'portrait-draft', name: '苏妈（苏姿丰）', active: false, role: '后续工坊人物' },
  { id: 'elon-musk', image: '/teaching/assets/npcs/elon-musk.png', artStatus: 'portrait-draft', name: '马斯克', active: false, role: '后续探索人物' },
  { id: 'sam-altman', image: '/teaching/assets/npcs/sam-altman.png', artStatus: 'portrait-draft', name: '奥特曼', active: false, role: '后续公会人物' },
  { id: 'dario-amodei', image: '/teaching/assets/npcs/dario-amodei.png', artStatus: 'portrait-draft', name: 'Dario Amodei', active: false, role: '后续研究馆人物' },
]
const mentorLines = {
  4: '先走到守卫前的空地。写一条移动命令，运行看看走了多远。',
  7: '先打开补给箱，把领取数量保存在变量里。送到机关前，再把这批物品交出去。',
  13: '先点亮一间侧室，再观察另外两间有什么相同。可以把重复动作整理成循环。',
  17: '每装一块能量石，就把剩余数量减一。核对背包和输出，看看它们什么时候变成0。',
  26: '先攻击一次，看看门还剩多少血。第二次攻击后，通道才会打开。',
  28: '站到信号台旁再说“点火”。这句话在起点说可不管用。',
  30: '先找到敌人，把结果放进 enemy；再用它指定攻击目标。',
  31: '这次通道也可能是空的。先判断有没有敌人，再决定是否攻击。',
  32: '眼前没有敌人，还不能收工。先等一下，再查找一次。',
}
const heroId = () => chapter.hero // Never accept query strings, saved profiles or client-selected skins.
function decorateLevel (level) {
  if (!level) return level
  const formal = chapter.sections.includes(level.teachingMap.section)
  level.teachingMap.world = { chapterId: formal ? chapter.id : 'samples', chapterName: formal ? chapter.name : '互动样关', heroId: heroId(), story: chapter.story }
  if (chapter.sections.includes(level.teachingMap.section) && mentorLines[level.teachingMap.index]) {
    level.teachingMap.mentor = { ...npcs[0], line: mentorLines[level.teachingMap.index] }
  }
  return level
}
module.exports = { chapter, heroes, npcs, heroId, decorateLevel }
