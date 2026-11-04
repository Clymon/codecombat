// Checkbox selection only. Publication changes still use protected server-side forms.
document.addEventListener('DOMContentLoaded', () => {
  const boxes = [...document.querySelectorAll('input[name="slugs"][form="bulk-controls"]')]
  const groups = [...document.querySelectorAll('[data-select-section]')]
  const form = document.getElementById('bulk-controls')
  if (!form) return
  const update = () => {
    const count = boxes.filter(box => box.checked).length
    document.getElementById('selected-count').textContent = String(count)
    form.querySelectorAll('button[name="operation"]').forEach(button => { button.disabled = count === 0 })
    for (const group of groups) {
      const members = boxes.filter(box => box.dataset.section === group.dataset.selectSection)
      const selected = members.filter(box => box.checked).length
      group.checked = members.length > 0 && selected === members.length
      group.indeterminate = selected > 0 && selected < members.length
    }
    for (const box of boxes) box.closest('.release-card').classList.toggle('selected', box.checked)
  }
  for (const box of boxes) box.addEventListener('change', update)
  for (const group of groups) {
    group.addEventListener('change', () => {
      for (const box of boxes) if (box.dataset.section === group.dataset.selectSection) box.checked = group.checked
      update()
    })
  }
  form.querySelector('[data-select-all]').addEventListener('click', () => { boxes.forEach(box => { box.checked = true }); update() })
  form.querySelector('[data-clear-selection]').addEventListener('click', () => { boxes.forEach(box => { box.checked = false }); update() })
  update()
})
