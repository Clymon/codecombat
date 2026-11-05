# 自制关卡的通用运行资源包

来源：CodeCombat 公开通用关卡编辑器资源与客户端引擎接口。采集日期：2026-11-05。这里只包含本项目原创关卡使用的通用 ThangType、Components、Systems、音效与图片；不含官网 Level 地图、题面、关卡脚本、账号、Cookie、成绩或学生代码。

- 通用客户端组件与系统代码：CodeCombat 贡献者，MIT，见仓库 LICENSE。
- 通用美术、精灵、音乐、音效：CodeCombat 贡献者，CC BY 4.0。
- 授权与署名依据：[CodeCombat Legal](https://codecombat.com/legal)，[CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)。课堂入口页已有 CodeCombat 美术署名链接。
- `manifest.json` 逐项记录原始来源 URL、内容类型、原始字节数与 SHA-256；`blobs/<SHA-256>.gz` 是无损 gzip 压缩的原始响应，同内容只保存一份。JSON 元数据保持原有作者及版本信息。
- 少量官方界面提示音的旧 URL 已返回 404；`../offline-media-aliases.json` 明确列出本地替代关系，重用对应成对音效或通用按钮声，不向外网寻找替代。原始音频未改编。这不改变角色动作、危险判定或学习目标。

运行时资源包只读，启动后按需解压并在服务进程中共享，HTTP 使用 ETag 重新验证缓存，更新包后不会强制保留旧资源一小时。正常服务不下载资源。更新包需要在独立测试目录下显式设置 TEACHING_CAPTURE_RESOURCES=true，使用课堂完整验收与媒体补齐工具；正式服务不得保留采集标记。操作步骤见 ../OFFLINE.md。
