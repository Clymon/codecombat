const test = require('node:test'); const assert = require('node:assert/strict'); const fs = require('fs'); const path = require('path'); const vm = require('vm')
const { commandDocs } = require('../command-docs'); const designs = require('../map-designs'); const coffee = require('coffee-script')
test('every published command in all 42 scenes has Chinese help, correct function type and a Python example', () => {
  let count = 0; const names = new Set()
  for (const design of designs) {
    for (const scene of design.scenarios || [{}]) {
      const slug = `local-python-${String(design.index).padStart(2, '0')}`
      const docs = commandDocs(slug, { ...design, ...scene }, 'python')
      const expected = ['moveRight', 'moveLeft', 'moveUp', 'moveDown', 'say', ...(design.apis || [])]
      for (const name of expected) {
        const doc = docs.find(doc => doc.name === name); names.add(name)
        assert.ok(doc, `${slug}: ${name}`); assert.equal(doc.type, 'function'); assert.equal(doc.owner, 'this')
        assert.match(doc.description, /[\u4e00-\u9fff]/); assert.ok(doc.example.python.trim())
        for (const argument of doc.args) { assert.ok(argument.description); assert.ok(argument.example) }
      }
      assert.equal(docs.length, expected.length + 1)
      assert.equal(docs.at(-1).name, 'print'); assert.equal(docs.at(-1).type, 'snippet')
      assert.match(docs.at(-1).snippets.python.code, /^print\(/)
      if (design.singleStep) {
        assert.match(docs[0].description, /每次只能走 1 格/)
        assert.doesNotMatch(docs[0].example.python, /\(2\)/)
      }
      count++
    }
  }
  assert.equal(count, designs.reduce((sum, d) => sum + (d.scenarios?.length || 1), 0)); assert.equal(names.size, 15)
})
test('help distinguishes sensors from actions and preserves local behavior boundaries', () => {
  const doc = name => commandDocs('local-python-25', { apis: [name], adventure: { mode: 'defend' } }, 'python').find(d => d.name === name)
  for (const name of ['pathOpen', 'pathLength', 'readSignal', 'atBeacon', 'nextTileSafe', 'findNearestEnemy', 'isVictory']) assert.ok(doc(name).returns.description)
  assert.match(doc('wait').description, /0.5 秒/); assert.equal(doc('wait').args.length, 0)
  assert.match(doc('nextTileSafe').description, /始终检查右边/)
  assert.match(doc('pathLength').description, /不会自动减1/)
  assert.match(doc('findNearestEnemy').returns.description, /None/)
  assert.match(doc('attack').example.python, /if enemy:/)
  assert.match(doc('isVictory').description, /后面可能还有增援/)
  assert.deepEqual(commandDocs('official-level', {}, 'python'), [])
  assert.deepEqual(commandDocs('local-python-25', {}, 'javascript'), [])
  assert.throws(() => commandDocs('local-python-99', { apis: ['undocumentedNewCommand'] }, 'python'), /Missing teaching command/)
})
test('native command palette receives local help instead of missing or official equipment descriptions', () => {
  const sandbox = {
    module: { exports: {} },
    console,
    _: require('lodash'),
    Backbone: { Mediator: { publish () {} } },
    require: name => {
      if (name === 'views/core/CocoView') return class {}
      if (name === 'teaching/command-docs') return { commandDocs }
      return {}
    },
  }
  vm.runInNewContext(coffee.compile(fs.readFileSync(path.join(__dirname, '../../app/views/play/level/tome/SpellPaletteView.coffee'), 'utf8'), { bare: true }), sandbox)
  let organized
  const context = {
    thang: { id: 'Hero Placeholder' },
    options: { programmable: true, language: 'python', level: { get: key => ({ slug: 'local-python-25', teachingMap: designs.find(d => d.index === 25) }[key]) } },
    supermodel: { getModels: () => [{ get: () => [{ name: 'attack', description: 'official equipment' }, { name: 'wait', codeLanguages: ['javascript'] }] }] },
    organizePalette: (storage, docs, excluded) => { organized = { docs, excluded } },
  }
  sandbox.module.exports.prototype.createPalette.call(context)
  assert.match(organized.docs.__attack[0].description, /攻击\*\*一次/)
  assert.equal(organized.docs.__wait[0].type, 'function'); assert.equal(organized.excluded.__wait, undefined)
  assert.equal(organized.docs.__isVictory[0].args.length, 0)
  assert.equal(organized.docs.__print[0].owner, 'snippets')
})
