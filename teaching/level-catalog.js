// Compile authoring data once into the shared views used by native generation,
// level selection and teacher QA. An explicit scene field replaces the entire
// field (including arrays/objects/null); omitted fields inherit from the level.
function publicMap (design) {
  const { solution, scenarios, ...map } = design
  return structuredClone(map)
}
function compileCatalog (definitions = require('./map-designs')) {
  const seen = new Set()
  return definitions.map(input => {
    const design = structuredClone(input)
    if (seen.has(design.index)) throw new Error(`Duplicate level definition: ${design.index}`)
    seen.add(design.index)
    const slug = `local-python-${String(design.index).padStart(2, '0')}`
    const variants = design.scenarios || [{}]
    const scenarioTitles = variants.map(scene => scene.title || '主场景')
    const scenes = variants.map((variant, scenarioIndex) => {
      const { scenarios, ...resolved } = structuredClone({ ...design, ...variant })
      return { design: resolved, teachingMap: { ...publicMap(resolved), scenarioIndex, scenarioTitles: [...scenarioTitles], slug } }
    })
    return {
      design,
      slug,
      scenes,
      catalog: { slug, name: design.name, teachingMap: { ...publicMap(design), scenarioTitles } },
      references: scenes.map(({ design: scene }, index) => ({ scene: index, title: scenarioTitles[index], code: scene.solution })),
    }
  })
}
module.exports = { compileCatalog }
