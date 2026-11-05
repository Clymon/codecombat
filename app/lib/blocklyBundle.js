const Blockly = require('blockly')
const blocklyUtils = require('core/blocklyUtils')
const { codeToBlocks, prepareBlockIntelligence } = require('./code-to-blocks')
blocklyUtils.registerBlocklyTheme()
module.exports = { Blockly, blocklyUtils, codeToBlocks, prepareBlockIntelligence }
