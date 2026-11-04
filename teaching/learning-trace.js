// Instrument only the final local Python AST. Source and editor line numbers stay intact.
const contracts = require('./learning-contracts.json')
const member = name => ({ type: 'MemberExpression', object: { type: 'Identifier', name: 'hero' }, property: { type: 'Identifier', name }, computed: false })
const mark = (event, value) => ({ type: 'CallExpression', callee: member('__classroomTrace'), arguments: [event, value].map(value => ({ type: 'Literal', value })) })
const statement = expression => ({ type: 'ExpressionStatement', expression, userCode: false })
function instrumentLearning (ast, index) {
  if (!contracts[index] || !ast?.body || ast.classroomInstrumented) return ast
  ast.classroomInstrumented = true
  const statements = new Set(); const calls = []; const loops = []
  function visit (node, context = [], loopIDs = []) {
    if (!node || typeof node !== 'object') return node
    if (node.range && node.userCode !== false && /^(ExpressionStatement|VariableDeclaration|IfStatement|ForStatement|WhileStatement|ReturnStatement|BreakStatement|ContinueStatement|FunctionDeclaration|ThrowStatement)$/.test(node.type)) statements.add(node.range[0])
    if (node.type === 'IfStatement' && node.alternate && node.alternate.type !== 'IfStatement') statements.add('else:' + node.range?.[0])
    const kind = node.type === 'ForStatement' ? 'for' : node.type === 'WhileStatement' ? 'while' : null
    const id = kind ? kind + ':' + (node.range?.[0] ?? loops.length) : null
    if (kind) loops.push(kind)
    for (const [key, value] of Object.entries(node)) {
      if (['loc', 'range'].includes(key)) continue
      const body = kind && key === 'body'
      const branch = node.type === 'IfStatement' && ['consequent', 'alternate'].includes(key)
      const ctx = body ? [...context, kind] : branch ? [...context, 'if'] : context
      const ids = body ? [...loopIDs, id] : loopIDs
      if (Array.isArray(value)) node[key] = value.map(child => visit(child, ctx, ids))
      else if (value && typeof value === 'object') node[key] = visit(value, ctx, ids)
    }
    if (kind) {
      node.test = { type: 'SequenceExpression', expressions: [mark('check', id), node.test] }
      node.body.body.unshift(statement(mark('iteration', id)))
    }
    const callee = node.callee
    if (node.type === 'CallExpression' && callee?.type === 'MemberExpression' && ['hero', 'self'].includes(callee.object?.name)) {
      const name = callee.property.name || callee.property.value
      if (name === '__classroomTrace') return node
      calls.push({ name, context, variableTarget: node.arguments?.[0]?.type === 'Identifier' })
      return { type: 'SequenceExpression', expressions: [mark('call', JSON.stringify({ name, context, loops: loopIDs })), node], loc: node.loc, range: node.range }
    }
    return node
  }
  visit(ast)
  ast.body.unshift(statement(mark('source', JSON.stringify({ statements: statements.size, loops, calls }))))
  return ast
}
module.exports = { instrumentLearning }
