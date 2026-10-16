# 和Agent定制风格

复制src/themes/song-paper.css为新文件，例如my-desk.css，把config.local.json的theme设为my-desk。主题名只能是小写字母、数字和短横线。npm start读取本机配置；公开静态构建默认只用示例配置。

每个主题定义以下语义变量，并提供data-theme=dark值：

`--ground --surface --rail --text --muted --line --rule --accent --accent-hover --on-accent --soft --margin --ui-font --title-font --ease`

布局和交互集中在src/styles/layout.css与src/app.mjs；配色与字体留在主题文件。不要为换皮复制整份应用，也不要把个人项目的名字和地址写进主题。

提供song-paper和modern-ink两个示例。主题文件都是自主编写的CSS，不需要付费服务或设计技能运行时。

要求：普通文字对比度至少4.5:1，保留焦点；正文可缩放；字号16–22px；手机不横向溢出；prefers-reduced-motion保留清楚的状态反馈。新字体须核对再分发许可，优先本地字体或有明确许可的自托管资源。

## 给Agent的一个具体请求

“我喜欢宋韵黑红米纸色，但正文要清楚。先展示方案，再修改主题文件；保留搜索、并排、便笺和备份。说明改动并验证明暗、390px手机、键盘与刷新恢复。”
# Settings surface

Themes define `--settings-glass` (translucent dialog surface) and `--settings-scrim` (background dimming). Both light and dark values are required. Unsupported backdrop filtering and reduced-transparency preferences use the normal opaque `--surface`.
