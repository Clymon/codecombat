// Pure presentation, derived only from recorded state. No timers, goals or commands.
function companionPose (hero, guards, now) {
  const visual = JSON.parse(hero?.teachingVisual || '{}')
  const adventure = JSON.parse(hero?.teachingAdventure || 'null')
  const recent = (at, duration) => Number.isFinite(at) && at >= 0 && now >= at && now - at < duration
  if (hero?.health <= 0) return { frame: 1, lift: 0, rotation: -8, alpha: 0.8, mood: 'surprised' }
  if (recent(visual.hurtAt, 0.8)) return { frame: 1, lift: 2, rotation: Math.sin((now - visual.hurtAt) * 30) * 9, alpha: 1, mood: 'surprised' }
  const departure = hero?.teachingExitStartedAt
  const event = adventure?.events?.filter(e => ['ignite', 'rescue', 'victory'].includes(e.kind) && recent(e.at, 1.2)).sort((a, b) => b.at - a.at)[0]
  const gate = guards.find(g => ['opening', 'open'].includes(g?.teachingGateStatus) && recent(g.teachingGateMessageAt, 1.4))
  const celebrateAt = recent(departure, 2) ? departure : event?.at ?? gate?.teachingGateMessageAt
  if (Number.isFinite(celebrateAt)) {
    const t = now - celebrateAt
    return { frame: 2, lift: Math.max(0, Math.sin(Math.min(t / 1.2, 1) * Math.PI)) * 12, rotation: Math.sin(t * 7) * 5, alpha: 1, mood: 'cheer' }
  }
  return { frame: 0, lift: 1.5 * Math.sin(now * 2), rotation: 0, alpha: 1, mood: 'calm' }
}
module.exports = { companionPose }
