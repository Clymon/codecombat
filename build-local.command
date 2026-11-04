#!/bin/bash
set -e
cd "$(dirname "$0")"
export PATH="$HOME/.nvm/versions/node/v22.22.3/bin:$PATH"
npm install --legacy-peer-deps --no-audit --no-fund --package-lock=false
./node_modules/.bin/bower install --config.interactive=false
node setup-aether.js
if [ ! -e node_modules/ajv-keywords/node_modules/ajv ]; then
  mkdir -p node_modules/ajv-keywords/node_modules
  ln -s ../../schema-utils/node_modules/ajv node_modules/ajv-keywords/node_modules/ajv
fi
node --max-old-space-size=8192 node_modules/webpack/bin/webpack.js
