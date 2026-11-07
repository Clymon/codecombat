// Public environment queries use global Python calls; actions remain on hero.
const GLOBAL_QUERIES = ['pathOpen', 'nextTileSafe', 'isVictory']
function rewriteEnvironmentQueries (ast) {
  if (!ast || typeof ast !== 'object') return ast
  // Respect Python variables, function definitions and parameters that shadow a name.
  function bindings (root) {
    const names = new Set()
    function scan (node) {
      if (!node || typeof node !== 'object') return
      if (/Function/.test(node.type || '') && node !== root) { if (node.id) names.add(node.id.name); return }
      if (node.type === 'VariableDeclarator' && node.id?.type === 'Identifier') names.add(node.id.name)
      if (node.type === 'AssignmentExpression' && node.left?.type === 'Identifier') names.add(node.left.name)
      for (const [key, value] of Object.entries(node)) {
        if (!['loc', 'range'].includes(key)) {
          if (Array.isArray(value)) value.forEach(scan)
          else if (value && typeof value === 'object') scan(value)
        }
      }
    }
    scan(root)
    for (const p of root.params || []) if (p.name) names.add(p.name)
    return names
  }
  function visit (node, scopes, parent, key) {
    if (!node || typeof node !== 'object') return node
    if (node.type === 'Program' || /Function/.test(node.type || '')) scopes = [...scopes, bindings(node)]
    const binding = (parent?.type === 'VariableDeclarator' && key === 'id') || (parent?.type === 'AssignmentExpression' && key === 'left') || (/Function/.test(parent?.type || '') && ['id', 'params'].includes(key))
    const property = (parent?.type === 'MemberExpression' && key === 'property' && !parent.computed) || (parent?.type === 'Property' && key === 'key' && !parent.computed)
    if (node.type === 'Identifier' && GLOBAL_QUERIES.includes(node.name) && !binding && !property && !scopes.some(s => s.has(node.name))) {
      return { type: 'MemberExpression', object: { type: 'Identifier', name: 'hero' }, property: { ...node }, computed: false, loc: node.loc, range: node.range }
    }
    for (const [k, v] of Object.entries(node)) {
      if (!['loc', 'range'].includes(k)) {
        if (Array.isArray(v)) node[k] = v.map(child => visit(child, scopes, node, k))
        else if (v && typeof v === 'object') node[k] = visit(v, scopes, node, k)
      }
    }
    return node
  }
  return visit(ast, [], null, '')
}
module.exports = { GLOBAL_QUERIES, rewriteEnvironmentQueries }
