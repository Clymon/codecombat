const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs'); const path = require('node:path'); const vm = require('node:vm')
const coffee = require('coffee-script')
const { floorId } = require('../local-type-ids')
const { floorType } = require('../village-scenes')

test('native LankBoss resolves the correct full, cropped and empty floor art', () => {
  // Compile the real lookup method. Only its rendering/DOM dependencies are replaced.
  const sandbox = {
    module: { exports: {} },
    console,
    _: require('lodash'),
    SPRITE_RESOLUTION_FACTOR: 2,
    require: name => {
      if (name === 'core/CocoClass') return function () {}
      if (name === 'lib/surface/Lank') {
        return class {
          constructor (type) { this.type = type }
          setDebug () {}
        }
      }
      return {}
    },
  }
  vm.runInNewContext(coffee.compile(fs.readFileSync(path.join(__dirname, '../../app/lib/surface/LankBoss.coffee'), 'utf8')), sandbox)
  const boss = Object.create(sandbox.module.exports.prototype)
  const types = [floorId(3), floorId(3, 10, 12), floorId(3, 18, 11, 2, 6), floorId(3, 0, 0)].map(floorType)
  boss.options = { thangTypes: types.map(type => ({ get: key => type[key] })) }
  boss.lanks = {}; boss.createLankOptions = options => options; boss.listenTo = () => {}
  let selected; boss.addLank = lank => { selected = lank.type }
  for (const type of types) {
    boss.addThangToLanks({ id: `Floor ${type._id}`, spriteName: type.name })
    assert.equal(selected.get('_id'), type._id, 'each world floor must select its own clipping frame')
  }
})

test('full and cropped floor metadata are served locally with their raster images', async () => {
  const app = require('express')(); require('../local-levels')(app)
  const server = app.listen(0, '127.0.0.1'); await new Promise(resolve => server.on('listening', resolve))
  const base = `http://127.0.0.1:${server.address().port}`
  try {
    for (const id of [floorId(1), floorId(3, 18, 11, 2, 6), floorId(4, 0, 0)]) {
      for (const suffix of ['', '/version', '/version/0']) {
        const response = await fetch(`${base}/db/thang.type/${id}${suffix}`)
        assert.equal(response.status, 200)
        const type = await response.json(); assert.equal(type.original, id)
        assert.equal((await fetch(base + type.raw.animations.idle.rasterSheet)).status, 200)
      }
    }
    assert.equal((await fetch(`${base}/db/thang.type/${floorId(8)}/version`)).status, 404)
  } finally { await new Promise(resolve => server.close(resolve)) }
})
