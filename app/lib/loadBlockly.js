// Text-only Python lessons should not download the block editor.
let pending
module.exports = function loadBlockly () {
  if (!pending) {
    pending = import(/* webpackChunkName: "blockly-editor" */ './blocklyBundle')
      .then(module => module.default || module)
      .catch(error => { pending = null; throw error })
  }
  return pending
}
