// Instrument only the final local Python AST. Source and editor line numbers stay intact.
const contracts = require('./learning-contracts.json')
const member = name => ({ type: 'MemberExpression', object: { type: 'Identifier', name: 'hero' }, property: { type: 'Identifier', name }, computed: false })
const mark = (event, value) => ({ type: 'CallExpression', callee: member('__classroomTrace'), arguments: [event, value].map(value => ({ type: 'Literal', value })) })
const statement = expression => ({ type: 'ExpressionStatement', expression, userCode: false })
function instrumentLearning (ast, index) {
  if (!contracts[index] || !ast?.body || ast.classroomInstrumented) return ast
  ast.classroomInstrumented = true
  const statements = new Set(); const calls = []; const loops = []; const decisions = []; const loopInputs = []; const bindings = new Map()
  function inputs (node) {
    if (!node || typeof node !== 'object') return []
    if (node.type === 'Identifier') return bindings.get(node.name) || []
    const name = node.type === 'CallExpression' && ['hero', 'self'].includes(node.callee?.object?.name) ? node.callee.property.name : null
    return [...new Set([...(name ? [name] : []), ...(node.type === 'BinaryExpression' && node.operator === '-' ? ['subtract'] : []), ...Object.entries(node).filter(([k]) => !['loc', 'range', 'property'].includes(k)).flatMap(([, v]) => Array.isArray(v) ? v.flatMap(inputs) : inputs(v))])]
  }
  function visit (node, context = [], loopIDs = [], loopVariables = []) {
    if (!node || typeof node !== 'object') return node
    if (node.type === 'VariableDeclarator') bindings.set(node.id.name, inputs(node.init))
    if (node.type === 'AssignmentExpression' && node.left.type === 'Identifier') bindings.set(node.left.name, inputs(node.right))
    const decision = node.type === 'IfStatement' ? { id: 'if:' + node.range?.[0], inputs: inputs(node.test) } : null
    if (decision) decisions.push(decision)
    if (node.range && node.userCode !== false && /^(ExpressionStatement|VariableDeclaration|IfStatement|ForStatement|WhileStatement|ReturnStatement|BreakStatement|ContinueStatement|FunctionDeclaration|ThrowStatement)$/.test(node.type)) statements.add(node.range[0])
    if (node.type === 'IfStatement' && node.alternate && node.alternate.type !== 'IfStatement') statements.add('else:' + node.range?.[0])
    const kind = node.type === 'ForStatement' ? 'for' : node.type === 'WhileStatement' ? 'while' : null
    const id = kind ? kind + ':' + (node.range?.[0] ?? loops.length) : null
    if (kind) loops.push(kind)
    if (kind === 'for') loopInputs.push(...inputs(node.init))
    const variable = kind === 'for' ? node.body.body[0]?.declarations?.[0]?.id?.name : null
    for (const [key, value] of Object.entries(node)) {
      if (['loc', 'range'].includes(key)) continue
      const body = kind && key === 'body'
      const branch = node.type === 'IfStatement' && ['consequent', 'alternate'].includes(key)
      const ctx = body ? [...context, kind] : branch ? [...context, 'if'] : context
      const ids = body ? [...loopIDs, id] : loopIDs
      if (Array.isArray(value)) node[key] = value.map(child => visit(child, ctx, ids, variable ? [...loopVariables, variable] : loopVariables))
      else if (value && typeof value === 'object') node[key] = visit(value, ctx, ids, variable ? [...loopVariables, variable] : loopVariables)
    }
    if (decision) node.test = { type: 'SequenceExpression', expressions: [mark('decision', decision.id), node.test] }
    if (kind) {
      node.test = { type: 'SequenceExpression', expressions: [mark('check', id), node.test] }
      node.body.body.unshift(statement(mark('iteration', id)))
    }
    const callee = node.callee
    if (node.type === 'CallExpression' && callee?.type === 'MemberExpression' && ['hero', 'self'].includes(callee.object?.name)) {
      const name = callee.property.name || callee.property.value
      if (name === '__classroomTrace') return node
      calls.push({ name, context, variableTarget: node.arguments?.[0]?.type === 'Identifier', loopArgument: loopVariables.includes(node.arguments?.[0]?.name), valueInputs: inputs(node.arguments?.[1]) })
      return { type: 'SequenceExpression', expressions: [mark('call', JSON.stringify({ name, context, loops: loopIDs })), node], loc: node.loc, range: node.range }
    }
    return node
  }
  visit(ast)
  ast.body.unshift(statement(mark('source', JSON.stringify({ statements: statements.size, loops, calls, decisions, loopInputs }))))
  return ast
}
module.exports = { instrumentLearning }
