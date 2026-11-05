# 独立课堂部署与断网验收

2026-11-05 起，默认运行方式为独立课堂：学生只连接自己的服务器，运行自制关卡不需要访问 CodeCombat。无需官方账号。首次安装 Node/npm 依赖和构建工具仍属于部署准备，需要预先安装；这里保证的是构建完成后的课堂运行。

## 已本地化的内容

- 学号登录、代码、完成记录、教师隐藏/开放状态：仍用原来的 TEACHING_STATE_DIR，默认 teaching/state/。无需迁移或重建账号。
- 原生客户端启动接口 `/user-data`、`/auth/whoami`：本地生成只用于游戏客户端的身份，不调用官方身份系统，不给予官方权限。
- 课堂不使用的官方成就、赛事、商城权益、AI 额度：提供明确的空/停用状态，原生客户端不会因等待这些服务而卡住。
- 守卫/敌人/盟友、通用组件与系统、运行和交互音效：从 teaching/vendor/ 读取；DeepSeek 和自制地面等继续使用 teaching/assets/。
- 字体：课堂仅用仓库内的字体，去掉课堂 CloudFront 字体请求。
- 默认不安装原有的兜底官网代理，缺失资源返回本地错误。浏览器课堂页的 CSP 同时限制跨站资源/连接。

资源包含 **245 条 URL 映射、233 个去重内容文件，gzip 文件合计 4,335,181 字节（约 4.34 MB）**。每条记录有来源及 SHA-256；它是发布必需内容，不是浏览器缓存或临时下载目录。完整署名与压缩方式见 [vendor/README.md](vendor/README.md)。另有明确记录的界面音效替代：上游已经不存在的旧提示音复用本地成对音效/按钮声；不改变游戏行为。

## 已有服务器升级

在原仓库、原分支拉取；保持原有 TEACHING_STATE_DIR、监听地址、端口和服务管理方式。不要删除 teaching/state/，不要复制本次隔离测试的数据。

```sh
git pull --ff-only
node --max-old-space-size=8192 node_modules/webpack/bin/webpack.js
node teaching/tools/check-classroom.cjs
```

使用 Node 22。构建成功后用原方式重启服务，学生刷新页面。必须部署 teaching/vendor/，只拷贝 public_coco/ 不够。默认已启用独立课堂；建议在服务配置中明确设置 TEACHING_OFFLINE=true，并移除 TEACHING_CAPTURE_RESOURCES。旧 COCO_PROXY=true 不会重新启用官网代理。只有显式 TEACHING_OFFLINE=false 才会回到上游开发模式，课堂服务器不要使用该值。

macOS 的 start-teaching.command 已切换为独立模式并清除采集标记，仍只绑定 127.0.0.1。机房继续使用既有局域网地址；没有改变教师仅限服务器本机管理的访问规则。

服务启动后可运行只读检查：

```sh
node teaching/tools/check-classroom.cjs http://127.0.0.1:7778
```

检查 Python 语法校验、每个资源内容哈希和 40 个并发静态请求，不访问官网。**40 个静态请求并不等于 40 个学生浏览器同时进关、运行和提交。** 远端服务器与本机不连通，本次没有代替远端执行更新。

## 开发者断网复验

另开临时端口并指定独立状态目录；只在该目录开放全部关卡，不能用真实班级目录。下面示例使用 /tmp/coco-offline-check-state。

```sh
TEACHING_STATE_DIR=/tmp/coco-offline-check-state node -e 'const c=require("./teaching/classroom-state"); for(const d of require("./teaching/map-designs")) c.setUnlocked("local-python-"+String(d.index).padStart(2,"0"),true)'
TEACHING_STATE_DIR=/tmp/coco-offline-check-state COCO_PORT=7781 TEACHING_OFFLINE=true node -r ./teaching/tools/deny-external.cjs index.js
```

先确保 TEACHING_CAPTURE_RESOURCES 未设置。`deny-external.cjs` 是测试用 Node 预加载脚本，会拒绝非回环地址的 TCP 连接，不改变机器防火墙。

另一个终端准备 Playwright 和 Chromium，然后运行：

```sh
node teaching/tools/check-offline-browser.cjs http://127.0.0.1:7781 /tmp/classroom-offline-check
ONLY=4,7,17,23,25 SUBMIT=true node teaching/tools/check-offline-browser.cjs http://127.0.0.1:7781 /tmp/classroom-offline-submit
```

可用 PLAYWRIGHT_MODULE 和 CHROME_EXECUTABLE 指向已有开发环境的包和浏览器。工具只接受回环测试端口，禁止默认正式端口7778；创建9999开头测试账号。使用新浏览器上下文、禁用浏览器缓存与 Service Worker，只允许访问测试服务器；记录各关真实引擎计算出的目标结果。运行检查会拖动回放到末尾以节省检查时间，提交检查通过真正的“提交”按钮完成，不伪造胜利记录。缺件、脚本错误、外联或目标失败均返回非零退出状态。

## 新增角色或机制后更新资源包

仅在开发机临时服务上设置 TEACHING_CAPTURE_RESOURCES=true。浏览器跑完整关卡检查，补齐运行才请求的资源，再运行：

```sh
node teaching/tools/prepare-offline-media.cjs http://127.0.0.1:7781
```

采集器只允许公共组件、系统、类型与静态资源路径，始终不发送任何浏览器 Cookie；不收录 /user-data、账号、成绩、官方 Level 或本地学生代码。媒体工具补齐元数据里的备用音效与随机界面音效。停止采集服务，移除采集标记，重新开启禁止外联的服务并完整复验后，才能提交新的资源包。

## 本轮验收证据

本机 Chrome/Node22，隔离端口7781；服务器禁止外联，浏览器禁止外联、缓存关闭。

- 33关、52场景全部加载并执行参考程序成功；零缺失资源、零浏览器脚本错误、零外联请求；未访问官方关卡。
- 顺序、变量、while、破门救援、守营共5关7场景实际提交成功。
- 教师页面批量隐藏/开放两关，学生入口同步变化；能查看已提交代码。
- 服务实际重启后，原学生代码、完成状态和开放配置保留；相关4个状态文件的哈希未变。
- 114项自动测试通过；前端构建成功，仍有上游警告。新增代码 lint 与提交钩子另行检查。
- 本机52场景“切换场景到进入关卡按钮点击完成”的中位数约1.23秒，范围1.11—2.36秒。此口径含场景切换，不是网络通用基准，也不能当作远端40人的时延承诺。
- 只读并发检查40/40静态请求成功。仍需在实际机房确认40名学生的网络带宽、浏览器与操作体验。

逐场景证据见 [断网验收记录](reports/offline-2026-11-05.json)。
