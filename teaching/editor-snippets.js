// Small Python skeletons, not level solutions. Ace keeps placeholders editable.
/* eslint-disable no-template-curly-in-string */
module.exports = [
  ['if', 'if ${1:condition}:\n    ${2:pass}', '条件成立时执行'],
  ['elif', 'elif ${1:condition}:\n    ${2:pass}', '检查另一种条件'],
  ['else', 'else:\n    ${1:pass}', '其它情况'],
  ['for', 'for ${1:i} in range(${2:count}):\n    ${3:pass}', '重复指定次数'],
  ['while', 'while ${1:condition}:\n    ${2:pass}', '条件成立时重复'],
].map(([name, content, meta]) => ({ name, tabTrigger: name, content, meta, importance: 1 }))
