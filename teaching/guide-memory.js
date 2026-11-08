const { stepsFor } = require('./onboarding-content')
const key = 'deepseek-guide-v2:learned'
// Track concepts across levels and variants, rather than reopening the same tour per scene.
const concepts = {
  1: ['move'],
  2: ['move', 'wait'],
  3: ['move'],
  4: ['move'],
  5: ['say'],
  6: ['say'],
  7: ['inventory', 'variable'],
  8: ['inventory', 'subtract'],
  9: ['if'],
  10: ['if', 'else'],
  11: ['if', 'and'],
  12: ['inventory', 'elif'],
  13: ['for'],
  14: ['for', 'press'],
  15: ['for', 'range-step'],
  16: ['for', 'inventory'],
  17: ['while'],
  18: ['while'],
  19: ['while', 'beacon'],
  20: ['while', 'wait'],
  21: ['say', 'for', 'while'],
  22: ['lure'],
  23: ['attack'],
  24: ['for', 'say'],
  25: ['while', 'target', 'victory'],
  26: ['attack'],
  27: ['attack'],
  28: ['say'],
  29: ['for', 'say'],
  30: ['target'],
  31: ['if', 'target'],
  32: ['wait', 'victory'],
  33: ['while', 'target', 'victory'],
}
class GuideMemory {
  constructor (design, storage, legacy) {
    this.design = design; this.storage = storage
    let saved = []
    try { saved = JSON.parse(storage?.getItem(key) || '[]') } catch (_) {}
    this.seen = new Set(Array.isArray(saved) ? saved.filter(x => typeof x === 'string') : [])
    // Existing learners should not be forced through a new full tour after this update.
    try {
      for (let i = 0; i < legacy?.length; i++) {
        const oldKey = legacy.key(i); const match = /^deepseek-guide-v1:(?:local-python-)?(\d+):\d+$/.exec(oldKey)
        if (match && legacy.getItem(oldKey) === 'seen') { this.seen.add('ui'); for (const c of concepts[Number(match[1])] || []) this.seen.add(c) }
      }
    } catch (_) {}
    // Persist migrated history even when this level needs no automatic prompt.
    try { if (this.seen.size) storage?.setItem(key, JSON.stringify([...this.seen])) } catch (_) {}
  }

  automaticSteps () {
    const steps = stepsFor(this.design)
    if (!this.seen.has('ui')) return steps
    if (!(concepts[this.design.index] || []).some(c => !this.seen.has(c))) return []
    return [{ ...steps[0], title: '新技能：' + (this.design.knowledge || steps[0].title), code: steps[1].code, note: steps[1].note }]
  }

  remember () {
    this.seen.add('ui')
    for (const c of concepts[this.design.index] || []) this.seen.add(c)
    try { this.storage?.setItem(key, JSON.stringify([...this.seen])) } catch (_) {}
  }
}
module.exports = { GuideMemory }
