const floor = require('./common/dungeon-floor.json')
const { floorId, floorShape } = require('./local-type-ids')
const areas = ['村口训练场', '岔路庭院', '机关工坊', '信标营地']

function floorType (id) {
  const shape = floorShape(id)
  if (!shape) return null
  const index = shape.section - 1
  const w = 512 * shape.width / 20; const h = 512 * shape.height / 17
  // World Y points up; cut excess texture from the top, retaining the original anchor.
  const top = 512 - (shape.bottom + shape.height) * 512 / 17
  const left = shape.left * 512 / 20
  const regX = 256 - left; const regY = 256 - top
  const empty = !shape.width || !shape.height
  return {
    ...JSON.parse(JSON.stringify(floor)),
    _id: id,
    original: id,
    slug: `village-floor-${id}`,
    version: { major: 0, minor: 0 },
    // Each clipping frame needs a unique name for native LankBoss lookup; teachingFloor enables one floor projection. Ground tiles cast no shadow onto themselves.
    name: `Village Floor ${id}`,
    teachingFloor: true,
    scale: 200 / 512,
    rotationType: 'fixed',
    shadow: 0,
    positions: { registration: { x: 0, y: 0 } },
    raw: {
      shapes: {},
      containers: {},
      animations: {
        idle: {
          rasterSheet: `/teaching/assets/scenery/${empty ? 'empty.png' : 'village-floors-v1.png'}`,
          rasterFrames: empty ? [[0, 0, 1, 1, 0, 0]] : [[(index % 2) * 512 + left, Math.floor(index / 2) * 512 + top, w, h, regX, regY]],
          bounds: empty ? [0, 0, 1, 1] : [-regX, -regY, w, h],
          framerate: 1,
        },
      },
    },
    actions: { idle: { animation: 'idle' } },
  }
}

function sceneryBounds (design) {
  const corridors = design.corridors
  // Texture stops inside the outer masonry. Extra floor behind a north/east wall
  // otherwise looks like a second walkable route in the original wall artwork.
  return [
    Math.max(0, Math.min(...corridors.flatMap(c => [c[0], c[2]])) - 6),
    Math.max(0, Math.min(...corridors.flatMap(c => [c[1], c[3]])) - 6),
    Math.min(design.size[0], Math.max(...corridors.flatMap(c => [c[0], c[2]])) + 6),
    Math.min(design.size[1], Math.max(...corridors.flatMap(c => [c[1], c[3]])) + 6),
  ]
}

function applyVillageScene (level) {
  const section = level?.teachingMap?.section
  if (!Number.isInteger(section) || section < 1 || section > 4) return level
  level.teachingMap.world.area = areas[section - 1]
  const [minX, minY, maxX, maxY] = sceneryBounds(level.teachingMap)
  for (const thang of level.thangs) {
    if (thang.thangType !== floor.original) continue
    const pos = thang.components.find(c => c.original === '524b75ad7fc0f6d519000001').config.pos
    const left = Math.min(20, Math.max(0, minX - (pos.x - 10)))
    const bottom = Math.min(17, Math.max(0, minY - (pos.y - 8.5)))
    const width = Math.max(0, Math.min(20 - left, maxX - (pos.x - 10 + left)))
    const height = Math.max(0, Math.min(17 - bottom, maxY - (pos.y - 8.5 + bottom)))
    thang.thangType = floorId(section, width, height, left, bottom)
  }
  return level
}

module.exports = { floorType, applyVillageScene, sceneryBounds, areas }
