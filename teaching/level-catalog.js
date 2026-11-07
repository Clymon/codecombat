const { validateScene, invalid } = require('./level-validation')
// Compile authoring data once into the shared views used by native generation,
// level selection and teacher QA. An explicit scene field replaces the entire
// field (including arrays/objects/null); omitted fields inherit from the level.
function publicMap (design) {
  const { solution, scenarios, ...map } = design
  return structuredClone(map)
}
function compileCatalog (definitions = require('./map-designs')) {
  const seen = new Set()
  return [...definitions].sort((a, b) => a.index - b.index).map(input => {
    const design = structuredClone(input)
    if (!Number.isSafeInteger(design.index) || design.index < 1) invalid(design.index, 'base', 'index', 'expected a positive integer identity')
    if (seen.has(design.index)) invalid(design.index, 'base', 'index', 'duplicate level identity')
    seen.add(design.index)
    const slug = `local-python-${String(design.index).padStart(2, '0')}`
    const variants = design.scenarios ?? [{}]
    if (!Array.isArray(variants) || !variants.length) invalid(design.index, 'base', 'scenarios', 'expected at least one scene')
    const scenarioTitles = variants.map((scene, index) => {
      if (!scene || typeof scene !== 'object' || Array.isArray(scene)) invalid(design.index, index, 'scenarios', 'expected a scene object')
      return scene.title || '主场景'
    })
    const scenes = variants.map((variant, scenarioIndex) => {
      if (variant.index !== undefined && variant.index !== design.index) invalid(design.index, scenarioIndex, 'index', 'a scene cannot replace its level identity')
      const { scenarios, ...resolved } = structuredClone({ ...design, ...variant })
      validateScene(resolved, scenarioIndex)
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
