const { HERO_SCALE } = require('./grid-space')
const knight = require('./common/knight.json')
const atlas = require('./assets/characters/deepseek-actions-v1.json')
const { DEEPSEEK_TYPE } = require('./local-type-ids')

function deepseekType () {
  const animations = Object.fromEntries(Object.entries(atlas.animations).map(([name, value]) => [name, { ...value, rasterSheet: `/teaching/assets/characters/${atlas.image}` }]))
  const directional = name => ({ animation: `${name}_right`, relatedActions: Object.fromEntries(['right', 'left', 'fore', 'back'].map(direction => [direction, { animation: `${name}_${direction}` }])) })
  return {
    ...JSON.parse(JSON.stringify(knight)),
    _id: DEEPSEEK_TYPE,
    original: DEEPSEEK_TYPE,
    name: 'DeepSeek Whale Girl',
    slug: 'teaching-deepseek',
    version: { major: 0, minor: 0 },
    scale: HERO_SCALE,
    rasterIcon: 'teaching/deepseek-portrait-v2.png',
    shortName: 'DeepSeek',
    rotationType: 'fixed',
    positions: { registration: { x: 0, y: 0 }, head: { x: 0, y: -210 }, mouth: { x: 0, y: -160 }, aboveHead: { x: 0, y: -250 } },
    raw: { shapes: {}, containers: {}, animations },
    actions: { idle: directional('idle'), move: directional('move'), attack: directional('attack'), say: directional('idle'), build: directional('idle'), cast: directional('idle'), hurt: { animation: 'hurt' }, die: { animation: 'die' } },
  }
}

function applyHero (level) {
  const hero = level?.thangs?.find(thang => thang.id === 'Hero Placeholder')
  if (hero) hero.thangType = DEEPSEEK_TYPE
  return level
}

module.exports = { DEEPSEEK_TYPE, deepseekType, applyHero }
