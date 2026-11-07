// Local Python loops cooperate with the simulated world, even without an action.
// Applied after learning instrumentation so invisible scheduling never counts as student code.
function instrumentClock (ast) {
  if (!ast?.body || ast.classroomClockInstrumented) return ast
  ast.classroomClockInstrumented = true
  let next = 0
  function visit (node) {
    if (!node || typeof node !== 'object') return
    for (const [key, value] of Object.entries(node)) {
      if (['loc', 'range'].includes(key)) continue
      if (Array.isArray(value)) value.forEach(visit)
      else if (value && typeof value === 'object') visit(value)
    }
    if (!['WhileStatement', 'ForStatement', 'DoWhileStatement'].includes(node.type)) return
    const tick = { type: 'CallExpression', callee: { type: 'MemberExpression', object: { type: 'Identifier', name: 'hero' }, property: { type: 'Identifier', name: '__classroomTick' }, computed: false }, arguments: [{ type: 'Literal', value: `loop:${next++}` }], userCode: false }
    node.test = { type: 'SequenceExpression', expressions: [tick, node.test || { type: 'Literal', value: true }] }
  }
  visit(ast)
  return ast
}
module.exports = { instrumentClock }
