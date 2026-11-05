# 通用编辑器资源索引

这些JSON来自CodeCombat关卡编辑器公开使用的通用ThangType（角色、地板、墙、石像、宝石）及组件接口，读取日期2026-11-03。没有从官方Level接口导出地图、题面、胜负脚本或关卡配置。

获取路径：`https://codecombat.com/db/thang.type/<slug>?project=original,name,components,kind`；调试用组件为`/db/level.component/<original>/version/0`，系统为`/db/level.system/<original>/version/0`。

- 程序组件：CodeCombat贡献者，MIT。
- 通用美术与音效：CodeCombat贡献者，CC BY 4.0；本目录保留最初的引用和配置；2026-11-05起运行所需通用资源已经收录到 `../vendor/`，默认不再使用开发代理。
- 授权依据：https://codecombat.com/legal
- 上游代码：https://github.com/codecombat/codecombat

`tools/build-levels.js`使用通用角色资源的默认组件信息，独立生成本项目原创地图、题面、目标与摆放位置。采样的组件JSON用于实现时核对接口；本目录本身不是离线资源包；现用离线包见 `../vendor/README.md`。

2026-11-04新增：`soldier-m.json` 引用官方通用 Soldier M（`529e680ac423d4e83b000001`），用于门岗卫兵；与玩家Knight模型区分。仅保存original/name/components/kind，外观资源沿用上游授权和代理加载。

2026-11-04新增：`archer-f.json`，官方通用Archer F（`529ab1a24b67a988ad000002`），用于原创救援样关的友方弓手；来源为上述公开ThangType接口，沿用CC BY 4.0署名。
