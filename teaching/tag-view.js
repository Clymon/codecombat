// Replay-derived opening phases; never depend on wall-clock time.
function tagPose (hero, now) {
  let state = {}
  try { state = JSON.parse(hero?.teachingTag || '{}') } catch (_) {}
  const progress = state.startedAt == null ? 0 : Math.max(0, Math.min(1, (now - state.startedAt) / (state.duration || 1.2)))
  return { progress, opening: progress > 0 && progress < 1, opened: state.openedAt != null && now >= state.openedAt, lid: Math.max(0, Math.min(1, (progress - 0.2) / 0.5)), paper: Math.max(0, Math.min(1, (progress - 0.65) / 0.35)) }
}
module.exports = { tagPose }
