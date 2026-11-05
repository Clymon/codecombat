#!/bin/bash
set -e
cd "$(dirname "$0")"
export PATH="$HOME/.nvm/versions/node/v22.22.3/bin:$PATH"
export TEACHING_OFFLINE=true
unset TEACHING_CAPTURE_RESOURCES
export COCO_PORT=7778
export COCO_BIND_HOST=127.0.0.1
printf '原创关卡入口：http://127.0.0.1:7778/teaching\n课堂运行不依赖外网。此启动脚本仅监听本机。\n'
exec node index.js
