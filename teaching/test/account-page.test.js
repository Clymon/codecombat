const test = require('node:test'); const assert = require('node:assert/strict')
const page = require('../account-page')
test('classroom theme keeps locked tasks inaccessible and all scene forms usable', () => {
  const levels = [{ slug: 'local-python-04', name: '训练营①：走到门岗', description: '描述', teachingMap: { section: 1, quest: '靠近门岗', scenarioTitles: ['主场景'] } }, { slug: 'local-python-09', name: '第2节 · 门开了才走', description: '描述', teachingMap: { section: 2, scenarioTitles: ['门岗放行', '门岗关闭'] } }]
  const html = page({ student: { studentId: '00001234' }, levels, releases: { 'local-python-04': true }, formToken: 'test', progress: { 'local-python-04': { teachingComplete: true } } })
  assert.match(html, /00001234/); assert.match(html, /再次挑战/); assert.match(html, /等待老师开放/)
  assert.doesNotMatch(html, /href="\/play\/level\/local-python-09/)
  const open = page({ student: { studentId: '<script>x</script>' }, levels, releases: { 'local-python-09': true }, formToken: 'test', progress: { 'local-python-04': { teachingComplete: true }, 'local-python-09': { scenePasses: { 0: {} } } } })
  assert.match(open, /&lt;script&gt;x&lt;\/script&gt;/); assert.doesNotMatch(open, /<script>/)
  assert.match(open, /name="scene" value="0"/); assert.match(open, /name="scene" value="1"/); assert.match(open, /✓ 门岗放行/)
  assert.match(open, /1 \/ 2/)
})
