# Changelog

## 2026-10-16 — Settings and desktop launcher repair

- Added approved frosted-glass settings, reversible project visibility, and distinct action and navigation states.
- Preserved notes, tasks, history, layouts, custom colors and old backup compatibility.
- Desktop launcher now validates the live server root, PID, executable and script before reuse or stop, and repairs stale PID records after service updates.
- Added reproducible Windows launcher build and installation checks. Local configuration and runtime artifacts stay outside the public source package.

## 0.2.0 — 开发候选

- 可视化案头：项目地图与连接证据、任务接续三列面板、布局缩略图。
- 双项目左右比例：拖动分隔线、键盘5%步进、平分、刷新及模板保存。
- 本机任务记录支持关联项目、编辑状态、继续工作、移除与撤销；纳入备份验证与恢复预览。

- 项目接入向导：地址/ID校验、原页试载、配置预览与下载。
- 项目分组、标签、置顶及标签搜索。
- 命名布局模板：保存、打开、重命名、删除。
- 主题/密度/字号/配色预览；取消还原、确认保存、文字对比度检查。
- Agent定制交接包预览与导出，默认排除真实项目名、URL与便笺。
- 兼容v0.1配置与个人记录，新增定制设置纳入备份。

## 0.1.0

独立本地外壳、项目注册与并排、主题消息、个人便笺、备份预览与冲突保护；MIT首个公开版本。
