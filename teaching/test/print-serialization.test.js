const test = require('node:test'); const assert = require('node:assert/strict'); const fs = require('fs'); const path = require('path'); const vm = require('vm')
const coffee = require('coffee-script')
const adapter = require('../print-to-say')
function loadGod () {
  const file = path.join(__dirname, '../../app/lib/God.coffee')
  const sandbox = { module: { exports: {} }, require: name => name === 'teaching/print-to-say' ? adapter : name === 'core/CocoClass' ? class {} : {}, console }
  vm.runInNewContext(coffee.compile(fs.readFileSync(file, 'utf8'), { bare: true }), sandbox)
  return sandbox.module.exports
}
function printAST () { return { type: 'Program', body: [{ type: 'ExpressionStatement', expression: { type: 'CallExpression', callee: { type: 'MemberExpression', object: { type: 'Identifier', name: 'console' }, property: { type: 'Identifier', name: 'log' } }, arguments: [{ type: 'Literal', value: '自己人' }] } }] } }
test('world serialization repairs a fresh lint AST on the first local Python run', () => {
  const God = loadGod()
  const aether = { ast: printAST(), serialize () { return { ast: this.ast, originalOptions: { language: 'python' } } } }
  // Spell.transpile applies the adapter, but a subsequent direct lint transpile replaces the AST.
  adapter.rewritePrintAsHeroSay(aether.ast)
  aether.ast = printAST()
  const spells = { hero: { name: 'plan', thang: { thang: { id: 'Hero Placeholder' }, aether } } }
  const result = God.prototype.getUserCodeMap.call({ level: { slug: 'local-python-05' } }, spells)
  assert.equal(result['Hero Placeholder'].plan.ast.body[0].expression.callee.object.name, 'hero')
  assert.equal(result['Hero Placeholder'].plan.ast.body[0].expression.callee.property.name, 'say')
  const again = God.prototype.getUserCodeMap.call({ level: { slug: 'local-python-05' } }, spells)
  assert.equal(again['Hero Placeholder'].plan.ast.body[0].expression.callee.property.name, 'say')
})
test('world serialization leaves official Python and local JavaScript console output intact', () => {
  const God = loadGod()
  for (const [slug, language] of [['official-level', 'python'], ['local-python-05', 'javascript']]) {
    const ast = printAST(); const spells = { hero: { name: 'plan', thang: { thang: { id: 'Hero Placeholder' }, aether: { serialize: () => ({ ast, originalOptions: { language } }) } } } }
    const result = God.prototype.getUserCodeMap.call({ level: { slug } }, spells)
    assert.equal(result['Hero Placeholder'].plan.ast.body[0].expression.callee.object.name, 'console')
  }
})

test('lint worker updating raw text must not leave the old executable AST on the next run', () => {
  const God = loadGod(); const oldSource = 'for number in range(1, 4):\n    hero.moveRight()\n    hero.press(number)'; const newSource = 'hero.moveRight()\nhero.press(1)'
  const aether = { raw: oldSource, ast: { compiledSource: oldSource }, transpile (source) { this.raw = source; this.ast = { compiledSource: source } }, serialize () { return { raw: this.raw, ast: this.ast, originalOptions: { language: 'python' } } } }
  // SpellView's worker reply updates raw/probs, but does not return an executable AST.
  aether.raw = newSource
  const spells = { hero: { name: 'plan', source: newSource, thang: { thang: { id: 'Hero Placeholder' }, aether } } }
  const result = God.prototype.getUserCodeMap.call({ level: { slug: 'local-python-14' } }, spells)['Hero Placeholder'].plan
  assert.equal(result.ast.compiledSource, newSource)
  assert.equal(result.raw, newSource)
})
