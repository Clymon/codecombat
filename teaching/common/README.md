# 通用编辑器资源索引

这些JSON来自CodeCombat关卡编辑器公开使用的通用ThangType（角色、地板、墙、石像、宝石）及组件接口，读取日期2026-11-03。没有从官方Level接口导出地图、题面、胜负脚本或关卡配置。

获取路径：`https://codecombat.com/db/thang.type/<slug>?project=original,name,components,kind`；调试用组件为`/db/level.component/<original>/version/0`，系统为`/db/level.system/<original>/version/0`。

- 程序组件：CodeCombat贡献者，MIT。
- 通用美术与音效：CodeCombat贡献者，CC BY 4.0；本目录仅含引用和配置，实际画面/音效仍通过开发代理加载。
- 授权依据：https://codecombat.com/legal
- 上游代码：https://github.com/codecombat/codecombat

`tools/build-levels.js`使用通用角色资源的默认组件信息，独立生成本项目原创地图、题面、目标与摆放位置。采样的组件JSON用于实现时核对接口；不是离线资源包。

2026-11-04新增：`soldier-m.json` 引用官方通用 Soldier M（`529e680ac423d4e83b000001`），用于门岗卫兵；与玩家Knight模型区分。仅保存original/name/components/kind，外观资源沿用上游授权和代理加载。
