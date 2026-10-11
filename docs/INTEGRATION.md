# 接入独立项目

1. 在你自己的项目中启动HTTP服务，例如http://127.0.0.1:5555。
2. 在config.local.json的projects数组添加唯一id、名称、说明和url。
3. 重启工作台，验证进入、原页、并排、刷新及项目自己的登录流程。

最多24个项目。ID用小写字母、数字与短横线；名称最多60字，说明最多300字。地址仅接受HTTP/HTTPS或以单个/开头的同源示例地址，不接受账号密码或常见凭据参数。

## 边界

项目源码、存储、认证、服务生命周期属于项目。工作台不代理网络、不绕过嵌入限制、不改CSP、不上传数据。项目应在不同Origin（通常不同端口）独立运行。

同源示例被sandbox隔离为opaque origin，不授予allow-same-origin。异源项目使用allow-scripts、allow-forms、allow-same-origin；不允许顶层跳转或弹窗。若项目需要更复杂的权限，先在原页使用，再设计明确的接入契约。

## 可选主题协议 v1

子页面通知父页面：

```js
parent.postMessage({ type: "yifang:ready", version: 1 }, workbenchOrigin);
```

父页面发送：

```json
{ "type": "yifang:theme", "version": 1, "theme": "dark", "readingSize": 18 }
```

接收时必须同时校验event.source===parent、event.origin===workbenchOrigin、type、version和字段白名单。工作台Origin是注册时明确配置的工作台地址，不要对任意来源响应。

父页面同样校验注册iframe窗口和项目Origin。opaque示例只接受对应iframe窗口的null来源。广播仅包含主题和字号，不含便笺、备份或业务资料。示例桥接代码在src/examples/bridge.js。

若项目不实现协议，页面仍可独立打开。iframe load事件仅表示浏览器触发了载入事件，不能证明项目服务健康、内容可用或认证成功。
