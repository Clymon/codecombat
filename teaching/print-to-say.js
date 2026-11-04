// The Python parser lowers print(...) to an unlocated console.log(...) call.
// Rewrite only those generated calls in our local levels, preserving the
// student's source, line numbers, and all other CodeCombat levels.
function isGeneratedPrint (node) {
  const callee = node?.callee
  return node?.type === 'CallExpression' && !callee?.range &&
    callee?.type === 'MemberExpression' &&
    callee.object?.type === 'Identifier' && callee.object.name === 'console' &&
    callee.property?.type === 'Identifier' && callee.property.name === 'log'
}

function isPythonTuple (node) {
  return node?.type === 'CallExpression' &&
    node.callee?.property?.name === 'tuple' &&
    node.callee.object?.property?.name === 'objects' &&
    node.callee.object.object?.name === '__pythonRuntime'
}

function rewritePrintAsHeroSay (ast) {
  const seen = new WeakSet()
  function visit (node) {
    if (!node || typeof node !== 'object' || seen.has(node)) return
    seen.add(node)
    if (isGeneratedPrint(node)) {
      let value = node.arguments[0] || { type: 'Literal', value: ' ' }
      if (isPythonTuple(value)) {
        value = {
          type: 'CallExpression',
          callee: {
            type: 'MemberExpression',
            object: { type: 'ArrayExpression', elements: value.arguments },
            property: { type: 'Identifier', name: 'join' },
            computed: false,
          },
          arguments: [{ type: 'Literal', value: ' ' }],
        }
      }
      node.callee = {
        type: 'MemberExpression',
        object: { type: 'Identifier', name: 'hero' },
        property: { type: 'Identifier', name: 'say' },
        computed: false,
      }
      node.arguments = [value]
    }
    for (const value of Object.values(node)) {
      if (Array.isArray(value)) value.forEach(visit)
      else if (value && typeof value === 'object') visit(value)
    }
  }
  visit(ast)
  return ast
}

module.exports = { rewritePrintAsHeroSay }
