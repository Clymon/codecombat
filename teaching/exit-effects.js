// Presentation only: never move the simulated hero or change a Python sensor result.
const durations = { stairs: 1.8, portal: 1.6, beacon: 1.6, marker: 0.7, camp: 0.7, post: 0 }
const clamp = value => Math.max(0, Math.min(1, value))
const smooth = value => { const t = clamp(value); return t * t * (3 - 2 * t) }
function exitPose (design, startedAt, age) {
  const style = design.exitStyle || 'stairs'
  const duration = durations[style] || 0
  const idle = { active: false, progress: 0, dx: 0, dy: 0, sink: 0, scale: 1, alpha: 1 }
  if (!(startedAt >= 0) || age < startedAt || !duration) return idle
  const progress = clamp((age - startedAt) / duration)
  const t = smooth(progress)
  const direction = design.exitDirection || [1, 0]
  if (style === 'stairs') return { active: true, progress, dx: direction[0] * 3.8 * t, dy: direction[1] * 3.8 * t, sink: 2.4 * t, scale: 1 - 0.46 * t, alpha: 1 - smooth((progress - 0.3) / 0.6) }
  if (style === 'portal' || style === 'beacon') return { active: true, progress, dx: 0, dy: 0, sink: -1.8 * Math.sin(progress * Math.PI), scale: 1 - 0.75 * t, alpha: 1 - smooth((progress - 0.25) / 0.6) }
  return { ...idle, active: true, progress }
}
module.exports = { durations, exitPose }
