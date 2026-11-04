#!/bin/bash
set -e
cd "$(dirname "$0")"
export PATH="$HOME/.nvm/versions/node/v22.22.3/bin:$PATH"
export COCO_PROXY=true
export COCO_PROXY_TARGET=https://codecombat.com
export COCO_PORT=7778
export COCO_BIND_HOST=127.0.0.1
printf '原创关卡入口：http://127.0.0.1:7778/teaching\n通用资源仍需联网。此入口仅限本机开发试用。\n'
exec node index.js
