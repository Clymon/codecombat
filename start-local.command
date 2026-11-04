#!/bin/bash
set -e
cd "$(dirname "$0")"
export PATH="$HOME/.nvm/versions/node/v22.22.3/bin:$PATH"
export COCO_PROXY=true
export COCO_PROXY_TARGET=https://codecombat.com
export COCO_PORT=7777
export COCO_BIND_HOST=127.0.0.1
printf 'CodeCombat local development: http://127.0.0.1:7777/play
Requires internet access to official CodeCombat level services.
'
exec node index.js
