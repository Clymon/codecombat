// Continue in classroom order, after the saved source passes this public scene.
function nextTask (levels, slug, session, releases) {
  const index = levels.findIndex(level => level.slug === slug); const level = levels[index]
  const pass = session?.scenePasses?.[session.teachingScene || 0]
  if (!level || !pass || session.state?.complete !== true || session.learningFeedback || pass.hash !== session.codeHash) {
    return { kind: 'retry', label: '返回修改', message: session?.learningFeedback || '本场景尚未完成保存和验收，请返回代码区重新运行并提交。' }
  }
  const titles = level.teachingMap.scenarioTitles || ['主场景']
  const scene = titles.findIndex((_, i) => !session.scenePasses[i])
  if (scene !== -1) return { kind: 'scene', slug, scene, label: '下一场景', message: `本场景已通过。接下来：${titles[scene]}。` }
  const next = levels[index + 1]
  if (!next || !!next.teachingMap.prototype !== !!level.teachingMap.prototype) return { kind: 'finished', label: '返回课堂', message: '本关已完成，你已到达这组关卡的终点。' }
  if (!releases[next.slug]) return { kind: 'waiting', label: '检查下一关是否开放', message: `本关已完成。下一关「${next.name}」尚未发布，请等待老师开放。` }
  return { kind: 'level', slug: next.slug, scene: 0, label: '下一关', message: `本关已完成。接下来：${next.name}。` }
}
module.exports = { nextTask }
