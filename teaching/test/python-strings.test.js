const test = require('node:test'); const assert = require('node:assert/strict'); const fs = require('node:fs'); const vm = require('node:vm')
const esper = require('../../bower_components/esper.js/esper.js'); const scope = { esper, console }; scope.self = scope
vm.runInNewContext(fs.readFileSync(require.resolve('../../bower_components/esper.js/esper-plugin-lang-python.js'), 'utf8'), scope)
const { rewritePythonStrings } = require('../python-strings'); const { instrumentClock } = require('../execution-clock')
function run (code, input = '') { const out = []; const engine = esper({ language: 'python' }); engine.addGlobal('hero', { read: () => input, say: x => out.push(x) }); const ast = rewritePythonStrings(esper.languages.python.parser(code)); engine.loadAST(ast); engine.runSync(); return { out, ast } }
test('native Python operations match CPython for lesson examples and edge cases', () => {
  const expressions = ['"火水" * 3', '3 * "火水"', '"火" * 0', '"火" * -2', '6 * 7', '"火水"[::-1]', '"石人石人".count("人")', '"aaa".count("aa")', '"abc".count("")', '"abc".find("z")', '"abcabc".find("bc",2)', '"abc".index("b")', '" 人 " .strip()', '"xyhelloyx".strip("xy")', '"  hi  ".lstrip()', '"  hi  ".rstrip()', '" a毒b毒 ".strip().replace("毒", "").upper()', '"ABC".lower()', '"aaaa".replace("aa","x",1)', '"ab".replace("","-")', '"hello".startswith("he")', '"hello".endswith("lo")', '"人" in "石人石"', '"人" not in "石石"']
  const code = expressions.map(e => 'hero.say(' + e + ')').join('\n')
  const actual = run(code).out
  const python = 'import json\nprint(json.dumps([' + expressions.join(',') + '],ensure_ascii=False))'
  const expected = JSON.parse(require('node:child_process').execFileSync('python3', ['-c', python], { encoding: 'utf8' }))
  assert.deepEqual(actual, expected)
  assert.deepEqual(run('text=hero.read()\nhero.say(text.strip().replace("毒", "").upper())', '  w毒At毒er  ').out, ['WATER'])
  assert.deepEqual(run('text=hero.read()\nhero.say(text*3+text[::-1])', '火水').out, ['火水火水火水水火'])
})
test('errors stay errors; normalization is idempotent and helper loops do not consume world time', () => {
  assert.throws(() => run('hero.say("x" * 1.5)'), /整数/)
  assert.throws(() => run('hero.say("x".index("y"))'), /ValueError/)
  const { ast } = run('hero.say("x" * 3)'); const before = JSON.stringify(ast); rewritePythonStrings(ast); assert.equal(JSON.stringify(ast), before)
  instrumentClock(ast); assert.ok(!JSON.stringify(ast).includes('__classroomTick'))
})
