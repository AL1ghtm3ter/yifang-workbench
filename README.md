# Yifang Workbench · 一方工作台

一个属于自己的本地工作台。项目各自运行，工作台提供入口、并排布局、主题、阅读节奏和个人便笺。

默认是米纸、墨黑与朱红的个人书桌，也可以和你自己的 Agent 一起调整成任何适合你的风格。

## 快速开始

需要 Node.js 22 或更新版本。没有运行时依赖，无需先安装 npm 包。

```sh
npm start
```

打开 `http://127.0.0.1:4590`，Ctrl+C 停止服务。只监听本机回环地址，不上传内容，不自带模型账户或调用 Agent API。

端口冲突时，Linux/macOS使用 `YIFANG_PORT=4591 npm start`；PowerShell使用 `$env:YIFANG_PORT=4591; npm start`。

## 把自己的项目接进来

复制 `config.example.json` 为 `config.local.json`。保留字段结构，替换项目内容：

```json
{
  "version": 1,
  "title": "我的书桌",
  "subtitle": "按自己的节奏。",
  "theme": "song-paper",
  "projects": [
    {
      "id": "my-notes",
      "name": "我的笔记",
      "description": "独立运行的笔记项目。",
      "url": "http://127.0.0.1:5555/",
      "icon": "book"
    }
  ]
}
```

先启动你自己的项目，再启动工作台。工作台不会复制项目源码、启动项目进程或代理认证。`config.local.json` 被Git忽略；不要在URL中写密码或令牌。修改配置后重启工作台。

详细说明：[项目接入](docs/INTEGRATION.md)、[主题定制](docs/THEMING.md)、[Agent定制流程](docs/AGENT-WORKFLOW.md)。

## 和你的 Agent 一起定制

把仓库交给你自己的编码 Agent，告诉它：

> 先阅读 AGENTS.md、PRODUCT.md 和 DESIGN.md。为我的工作台设计一种我喜欢的风格，在 src/themes/ 下新增主题，保留项目独立运行、键盘操作、主题协议和个人记录。我的偏好是……

界面中的“给 Agent 的说明”可以复制更完整的提示。它只生成供你复制的文字，不自动联系其他 Agent。

## 功能

新增[可视化案头](docs/VISUAL-DESK.md)：项目地图与连接说明、任务接续面板、布局缩略图，以及可拖动和键盘调整的双页阅读比例。

v0.2开发候选新增接入向导、分类/置顶、命名布局、风格预览与Agent交接包，使用方式见[定制工作流](docs/CUSTOMIZATION.md)。向导生成配置文件，由你保存并重启；不会自动改动独立项目。

- 配置驱动的项目入口、搜索和最近访问。
- 单项目、左右/上下并排、加入项目与铺满工作区。
- 保留已载入iframe实例；只在主动重载时重新初始化页面。
- 明暗主题、16–22px阅读字号、专注阅读与减少动态效果支持。
- 本机便笺，备份预览与明确确认恢复；异常原记录可导出。
- 跨页主题协议校验窗口来源与注册Origin；不把便笺或项目内容发送给子页面。
- 默认只附带两个独立示例，不包含任何真实使用者项目。

iframe嵌入可能被项目的CSP或X-Frame-Options阻止。工作台不能绕过这些设置，“原页”入口始终保留。

## 构建、测试与发布

```sh
npm test
npm run build
npm run check:public
npm run package
```

`dist/` 是可托管的静态输出，默认使用公开示例配置；**不会打包你的本机配置**。静态输出可由任意静态HTTP服务器托管，不支持直接双击file://运行。

`npm run package` 生成只含允许公开文件的源码包；Windows生成ZIP，Linux/macOS生成tar.gz。运行脚本和源码始终可编辑。发布前检查待提交文件，而不只依赖.gitignore。

个人记录属于浏览器Origin。更换端口或浏览器前先导出，恢复时按当前注册项目核验。移除项目后，旧备份中该项目的ID会被拒绝；先用旧配置导出保留记录，再决定如何迁移。

MIT License。Impeccable可作为可选设计工具自行安装；仓库不捆绑其技能或二进制。
