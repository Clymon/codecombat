// Pose selection is a pure function of replay state, never wall-clock time.
function directionFor (rotation = 0) {
  const angle = Math.atan2(Math.sin(rotation), Math.cos(rotation))
  if (angle >= Math.PI / 4 && angle < 3 * Math.PI / 4) return 'back'
  if (angle <= -Math.PI / 4 && angle > -3 * Math.PI / 4) return 'fore'
  return Math.abs(angle) >= 3 * Math.PI / 4 ? 'left' : 'right'
}

function heroPose (hero, now) {
  let state = {}
  try { state = JSON.parse(hero?.teachingVisual || '{}') } catch (_) {}
  const direction = directionFor(hero?.rotation)
  const elapsed = Math.max(0, now - (state.since ?? now))
  if (hero?.health <= 0) return { action: 'die', frame: Math.min(3, Math.floor(Math.max(0, now - (state.diedAt ?? now)) / 0.16)) }
  if (state.hurtAt != null && now >= state.hurtAt && now - state.hurtAt < 0.4) return { action: 'hurt', frame: Math.min(3, Math.floor((now - state.hurtAt) * 10)) }
  if (state.action === 'attack') {
    // The runtime applies damage at .25 s and finishes the swing at .65 s.
    return { action: `attack_${direction}`, frame: elapsed < 0.12 ? 0 : elapsed < 0.25 ? 1 : elapsed < 0.43 ? 2 : 3 }
  }
  if (state.action === 'move') return { action: `move_${direction}`, frame: Math.floor(elapsed * 8) % 4 }
  return { action: `idle_${direction}`, frame: 0 }
}

function applyHeroFrame (lank, hero, now) {
  if (!lank?.sprite?.spriteSheet || !hero) return
  const pose = heroPose(hero, now)
  const sprite = lank.sprite
  // Use the native sprite so walls, shadows, speech and exits retain their layering.
  if (!lank.actions?.[pose.action] || !sprite._gotoAndStop) return
  sprite.gotoAndStop(pose.action)
  const animation = sprite.spriteSheet.getAnimation(sprite.spriteSheetPrefix + pose.action)
  if (!animation?.frames?.length || animation.frames[0] === 0 || sprite.usePlaceholders) return
  sprite._gotoAndStop(animation.frames[Math.min(pose.frame, animation.frames.length - 1)])
  sprite.currentAnimation = pose.action
  sprite.currentAnimationFrame = pose.frame
  lank.updateScale(true)
  sprite.rotation = 0
}

module.exports = { directionFor, heroPose, applyHeroFrame }
