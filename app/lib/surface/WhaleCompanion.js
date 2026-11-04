const createjs = require('lib/createjs-parts')
const { companionPose } = require('teaching/companion-reactions')

// A small spectator waits at the starting point, in the actor plane, behind the playable hero.
// It has no collision, health, speech or influence on level results.
module.exports = class WhaleCompanion {
  constructor (surface, design) {
    this.surface = surface; this.design = design
    this.layer = new createjs.Container()
    this.layer.mouseEnabled = this.layer.mouseChildren = false
    this.image = new Image()
    this.image.src = '/teaching/assets/scenery/whale-companion-v1.png'
    this.sprite = new createjs.Bitmap(this.image)
    this.sprite.regX = 128; this.sprite.regY = 232
    this.layer.addChild(this.sprite)
  }

  update (hero, world, camera) {
    if (!this.image.complete || !this.image.naturalWidth) return
    const start = this.design.start
    if (!start) return
    const pose = companionPose(hero, (this.design.gates || []).map(g => world.getThangByID(g.id)), world.age)
    const p = camera.worldToCanvas({ x: start[0] - 1.5, y: start[1] })
    this.sprite.sourceRect = new createjs.Rectangle(pose.frame * 256, 0, 256, 256)
    this.sprite.x = p.x; this.sprite.y = p.y - pose.lift * camera.zoom
    this.sprite.scaleX = this.sprite.scaleY = 0.16 * camera.zoom
    this.sprite.rotation = pose.rotation; this.sprite.alpha = pose.alpha
    const stage = this.surface.webGLStage
    const obstacles = this.surface.lankBoss.layerAdapters.Obstacle.container
    if (this.layer.parent !== stage) stage.addChildAt(this.layer, stage.getChildIndex(obstacles) + 1)
    this.layer.scaleX = camera.canvasScaleFactorX; this.layer.scaleY = camera.canvasScaleFactorY
  }
}
