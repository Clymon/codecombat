// Local art IDs are shared by the browser loader and the local API.
const DEEPSEEK_TYPE = 'facec0000000000000000001'
const FLOOR_PREFIX = 'facec000000000'
const floorId = (section, width = 20, height = 17, left = 0, bottom = 0) => FLOOR_PREFIX + [section, left, bottom, width, height].map(v => v.toString(16).padStart(2, '0')).join('')
function floorShape (id) {
  if (typeof id !== 'string' || !id.startsWith(FLOOR_PREFIX) || !/^[0-9a-f]{24}$/.test(id)) return null
  const [section, left, bottom, width, height] = id.slice(FLOOR_PREFIX.length).match(/../g).map(v => parseInt(v, 16))
  return section >= 1 && section <= 4 && left >= 0 && bottom >= 0 && width >= 0 && height >= 0 && left + width <= 20 && bottom + height <= 17 ? { section, width, height, left, bottom } : null
}
const FLOOR_TYPES = [1, 2, 3, 4].map(section => floorId(section))
const isLocalType = id => id === DEEPSEEK_TYPE || !!floorShape(id)
module.exports = { DEEPSEEK_TYPE, FLOOR_PREFIX, FLOOR_TYPES, floorId, floorShape, isLocalType }
