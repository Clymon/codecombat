# CodeCombat 本机教学试跑

2026-11-03。源码来自 https://github.com/codecombat/codecombat ，浅克隆至本目录。

本次目标：按官方开发代理方式启动前端并试跑公开入门关。当前仓库不包含可独立离线运行的完整后端与官网关卡数据库；开发代理需要联网，不等于已完成学校内网独立部署。

## 环境与安装记录

- 本机macOS Apple Silicon；使用现有Node 22.22.3 / npm 10.9.8（项目声明22.22.1 / 10.9.4）。
- 默认shell在本目录可能选择Homebrew Node 26；启动脚本固定使用本机已有Node 22。
- 原package-lock缺少部分跨平台可选项，npm ci失败；直接install遇到peer依赖冲突。使用npm install --legacy-peer-deps --package-lock=false安装，保留上游锁文件。
- start-local.command为本次增加的启动入口，端口7777、只监听127.0.0.1，代理至官方codecombat.com。
- server.js增加监听地址参数，默认限定本机；server_setup.js增加changeOrigin，并将上游TLS证书校验设为true。未修改关卡、付费权限或账户。

## 启动

首次构建完成后，双击start-local.command，或在本目录执行./start-local.command。

访问 http://127.0.0.1:7777/play 。如果本次会话中服务已经启动，无需重复启动。

本地端口只处理前端/开发请求，关卡和账号请求按官方开发方案发送到CodeCombat服务。已有官方关卡仍适用官网访问权限。

## 官方说明

- https://github.com/codecombat/codecombat/wiki/Dev-Setup:-General-Information
- README.md 与 LICENSE-LEVELS.md

已实际启动在127.0.0.1:7777。浏览器打开/play/level/dungeons-of-kithgard（中文标题“英雄觉醒”），选择开始后确认编辑器为Python，输入三条移动命令并点击运行，页面显示“目标：成功”，避开尖刺与收集宝石两项均完成。未注册或登录账号。截图和校验记录见local-checks/。

推荐入口：http://127.0.0.1:7777/play/level/dungeons-of-kithgard

当前服务在本次终端会话运行；退出终端/重启电脑后，重新运行start-local.command。不需重新构建。若端口被占用，不要同时启动两份；用lsof -nP -iTCP:7777 -sTCP:LISTEN查看。

## 构建兼容修复

npm安装后的ajv-keywords 5依赖AJV 8，但根项目直接依赖AJV 6。已将node_modules/ajv-keywords/node_modules/ajv链接到项目内schema-utils所用的AJV 8，保留根AJV 6供旧依赖使用。该链接仅在node_modules内，重新安装后可用build-local.command恢复。

首次Bower安装曾遇到GitHub TLS连接中断，重试成功。实际构建按Bower→setup-aether.js→Webpack顺序进行；Webpack使用Node 22和8GiB堆上限。

浏览器首次进入关卡发现旧console-browserify在Webpack eval块中发生assert重复声明；已将webpack.development.config.js的devtool从eval改为false，保留代码功能，关闭此开发调试打包方式。修复后完整Webpack构建成功（上游旧样式/组件警告仍存在）。

## Fork与上游

本地项目现已连接用户fork：origin为https://github.com/Clymon/codecombat.git，upstream为https://github.com/codecombat/codecombat.git。接入时两边HEAD均为f17db9c2e4dfaa4e120e433131eb4a3a34b89d6d。教学平台源码、原创关卡和启动脚本统一维护在codex/original-teaching-levels分支。后续开发分支使用codex/前缀。


## 原创关卡本地试跑（新增）

现增加teaching/本地关卡覆盖层，21关、37个场景的地图、目标与附加规则由本地文件提供，不再依赖官方Level数据。双击start-teaching.command后打开http://127.0.0.1:7778/teaching；原7777官方代理不变。入口现支持固定「25软件1班」的学号直接登录（首次自动建立学习记录）和按学号保存进度；本机教师页在http://127.0.0.1:7778/teaching/teacher，可查看进度并逐关发布。这只是本机试运行，学号本身不能证明身份，也没有正式名册限制，不能把127.0.0.1发给学生使用。详细范围和修改方法见teaching/README.md。通用组件/素材及部分基础服务仍联网，不是完整离线后端。当前分支codex/original-teaching-levels。


## 版本内容与运行数据

教学分支包含21关37场景、学号登录与进度持久化、教师发布、连续闯关、门岗与巡逻、发言气泡、终点演出和地刺显示。最近一次自动检查36项通过；Webpack构建成功（573项上游警告）。详细验收范围见teaching/README.md。

学生数据在teaching/state/，不包含在Git或npm包中；重启继续使用同一数据目录。local-checks/及teaching/checks/是本地浏览器验收留档，也不随版本发布。构建产物不入库，克隆后按上述脚本构建。
