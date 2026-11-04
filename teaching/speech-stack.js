const MAX_VISIBLE = 4
const LIFETIME = 5.2
const FADE_IN = 0.18
const FADE_OUT = 0.7

function visibleSpeech (serialized, now) {
  let events
  try { events = JSON.parse(serialized || '[]') } catch (_) { return [] }
  if (!Array.isArray(events)) return []
  return events.filter(event => {
    const elapsed = now - event.time
    return typeof event.text === 'string' && Number.isFinite(event.time) && elapsed >= 0 && elapsed < LIFETIME
  }).slice(-MAX_VISIBLE).map(event => {
    const elapsed = now - event.time
    return {
      text: event.text,
      alpha: Math.max(0, Math.min(1, elapsed / FADE_IN, (LIFETIME - elapsed) / FADE_OUT)),
    }
  })
}

module.exports = { visibleSpeech, MAX_VISIBLE, LIFETIME }
