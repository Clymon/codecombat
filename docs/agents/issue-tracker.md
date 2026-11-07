# Issue tracker

本项目使用 GitHub Issues： https://github.com/Clymon/codecombat 。由用户于 2026-11-07 选择。

- 工具：gh CLI。任务采用 ready-for-agent 标签。
- 阻塞关系：GitHub 原生 issue dependencies；描述保留编号便于离线阅读。
- 架构改进以 codex/architecture-integration 汇总，目标分支为现有教学分支 codex/original-teaching-levels。
- 实现提交使用 Refs #N；集成 PR 验证后标记 ready，并在 PR 中列出 Closes #N。PR 未合并前不宣称任务已关闭。
- 不关闭或修改源需求 issue。
- 外部 PR 作为请求入口：关闭。

实现审查固定点：0ab1a2e（包含原有未提交课堂改造的基线）。
