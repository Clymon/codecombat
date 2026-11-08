const test = require('node:test'); const assert = require('node:assert/strict'); const fs = require('node:fs'); const vm = require('node:vm'); const path = require('node:path')
const esper = require('../../bower_components/esper.js/esper.js'); const scope = { esper, console }; scope.self = scope
vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../../bower_components/esper.js/esper-plugin-lang-python.js'), 'utf8'), scope)
const { rewriteEnvironmentQueries } = require('../environment-api'); const { instrumentLearning } = require('../learning-trace')
const parse = code => esper.languages.python.parser(code)
function run (code, hero) { const engine = esper({ language: 'python' }); engine.addGlobal('hero', hero); engine.loadAST(rewriteEnvironmentQueries(parse(code))); engine.runSync() }
test('environment globals delegate to live queries, including a function reference', () => {
  const out = []; const hero = { pathOpen: d => d === 'right', nextTileSafe: () => false, isVictory: () => true, say: x => out.push(x) }
  run('check = pathOpen\nhero.say(check("right"))\nhero.say(nextTileSafe())\nhero.say(isVictory())', hero)
  assert.deepEqual(out, [true, false, true])
})
test('student definitions and local parameters shadow globals normally', () => {
  const out = []; const hero = { pathOpen: () => { throw Error('shadowed') }, say: x => out.push(x) }
  run('def pathOpen(value):\n    return value\nhero.say(pathOpen(7))', hero)
  run('def check(isVictory):\n    return isVictory\nhero.say(check(9))', hero)
  assert.deepEqual(out, [7, 9])
})
test('normalization is idempotent and no syntax-shape gate is injected', () => {
  const ast = rewriteEnvironmentQueries(parse('if pathOpen("right"):\n    hero.moveRight()\nelse:\n    hero.moveDown()'))
  const before = JSON.stringify(ast); rewriteEnvironmentQueries(ast); assert.equal(JSON.stringify(ast), before)
  instrumentLearning(ast, 10)
  assert.equal(JSON.stringify(ast), before)
})
