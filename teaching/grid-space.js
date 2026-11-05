// One programming step is one cell. World units are not texture pixels.
const CELL_SIZE = 12
const HERO_SCALE = 0.32
function cellsFor (design) {
  const cells = []
  for (let x = 0; x <= design.size[0]; x += CELL_SIZE) {
    for (let y = 0; y <= design.size[1]; y += CELL_SIZE) {
      if (design.corridors.some(([x1, y1, x2, y2]) => {
        const px = Math.max(Math.min(x1, x2), Math.min(x, Math.max(x1, x2)))
        const py = Math.max(Math.min(y1, y2), Math.min(y, Math.max(y1, y2)))
        return Math.hypot(x - px, y - py) <= 5
      })) cells.push({ x, y, width: design.size[0], height: design.size[1] })
    }
  }
  return cells
}
function drawGrid (g, cells, hero, camera) {
  const half = CELL_SIZE / 2
  const polygon = (cell, inset, stroke, fill, weight) => {
    const r = half - inset
    const points = [[-r, -r], [r, -r], [r, r], [-r, r]].map(([dx, dy]) => camera.worldToCanvas({ x: Math.max(0, Math.min(cell.width, cell.x + dx)), y: Math.max(0, Math.min(cell.height, cell.y + dy)) }))
    g.setStrokeStyle(weight).beginStroke(stroke).beginFill(fill).moveTo(points[0].x, points[0].y)
    for (const p of points.slice(1)) g.lineTo(p.x, p.y)
    g.closePath().endFill().endStroke()
  }
  for (const cell of cells) {
    const alternate = (cell.x / CELL_SIZE + cell.y / CELL_SIZE) % 2
    // Dark grout and a light inner edge read as paving, not a floating debug grid.
    polygon(cell, 0, '#50412d', alternate ? 'rgba(74,50,24,0.10)' : 'rgba(255,233,179,0.08)', 2.5)
    polygon(cell, 0.18, 'rgba(255,231,174,0.60)', 'rgba(0,0,0,0)', 1)
  }
  if (hero?.pos && hero.health > 0 && !(hero.teachingExitStartedAt >= 0)) {
    const x = Math.round(hero.pos.x / CELL_SIZE) * CELL_SIZE; const y = Math.round(hero.pos.y / CELL_SIZE) * CELL_SIZE
    const cell = cells.find(c => c.x === x && c.y === y)
    if (cell) polygon(cell, 0.35, '#8ed7d4', 'rgba(94,202,207,0.10)', 2)
  }
}
module.exports = { CELL_SIZE, HERO_SCALE, cellsFor, drawGrid }
