import {
  initialPreferences,
  validatePreferences,
  projectMetadata,
} from "./customization-core.mjs";
export const STATE_KEY = "yifang-workbench-state-v1";
export function stateKeyFor(config) {
  return config.storageNamespace
    ? STATE_KEY + ":" + config.storageNamespace
    : STATE_KEY;
}
export function projectURL(raw, base = "http://127.0.0.1:4590") {
  if (typeof raw !== "string" || raw.length > 2000 || !raw.trim())
    throw Error("项目地址无效");
  if (raw.startsWith("//") || raw.includes("\\"))
    throw Error("请使用完整HTTP地址或以单个/开头的本地地址");
  const url = new URL(raw, base);
  if (
    !["http:", "https:"].includes(url.protocol) ||
    url.username ||
    url.password
  )
    throw Error("仅接受不含账号密码的HTTP/HTTPS地址");
  if (!/^https?:\/\//.test(raw) && !raw.startsWith("/"))
    throw Error("相对地址必须以/开头");
  if (
    [...url.searchParams.keys()].some((k) =>
      /token|secret|password|api.?key|authorization/i.test(k),
    )
  )
    throw Error("不要把凭据放进项目URL");
  return url;
}
export function validateConfig(value) {
  if (!value || typeof value !== "object") throw Error("项目配置无效");
  if (
    value.storageNamespace !== undefined &&
    (typeof value.storageNamespace !== "string" ||
      !/^([a-z][a-z0-9-]{0,40})?$/.test(value.storageNamespace))
  )
    throw Error("存储命名空间无效");
  if (
    !value ||
    value.version !== 1 ||
    !Array.isArray(value.projects) ||
    value.projects.length > 24
  )
    throw Error("配置须为version 1，最多24个项目");
  const text = (s, max) => typeof s === "string" && s.trim() && s.length <= max;
  if (
    !text(value.title, 40) ||
    typeof value.subtitle !== "string" ||
    value.subtitle.length > 160 ||
    !/^[a-z][a-z0-9-]{0,40}$/.test(value.theme)
  )
    throw Error("工作台名称、说明或主题名称无效");
  const ids = new Set();
  const projects = value.projects.map((p) => {
    if (
      !p ||
      !/^[a-z][a-z0-9-]{0,40}$/.test(p.id) ||
      ids.has(p.id) ||
      !text(p.name, 60) ||
      typeof p.description !== "string" ||
      p.description.length > 300
    )
      throw Error("项目ID须唯一，名称和说明须有效");
    ids.add(p.id);
    projectURL(p.url);
    if (p.originalUrl !== undefined) projectURL(p.originalUrl);
    if (
      p.permissions !== undefined &&
      (!Array.isArray(p.permissions) ||
        new Set(p.permissions).size !== p.permissions.length ||
        p.permissions.some((x) => !["popups", "downloads"].includes(x)))
    )
      throw Error("项目权限只支持显式popups/downloads");
    return {
      id: p.id,
      name: p.name,
      description: p.description,
      url: p.url,
      icon: ["book", "grid", "file", "chat", "chart"].includes(p.icon)
        ? p.icon
        : "grid",
      ...projectMetadata(p),
      ...(p.originalUrl ? { originalUrl: p.originalUrl } : {}),
      ...(p.permissions ? { permissions: [...p.permissions] } : {}),
    };
  });
  return {
    version: 1,
    title: value.title,
    subtitle: value.subtitle,
    theme: value.theme,
    projects,
    ...(value.storageNamespace
      ? { storageNamespace: value.storageNamespace }
      : {}),
  };
}
export function initialState() {
  return {
    version: 1,
    note: "",
    recent: [],
    selection: [],
    direction: "horizontal",
    theme: "light",
    readingSize: 18,
    splitRatio: 50,
    tasks: [],
    preferences: initialPreferences(),
  };
}
export function validateState(v, ids) {
  const subset = (a) =>
    Array.isArray(a) &&
    a.length <= ids.length &&
    new Set(a).size === a.length &&
    a.every((id) => ids.includes(id));
  if (
    !v ||
    v.version !== 1 ||
    typeof v.note !== "string" ||
    v.note.length > 10000 ||
    !subset(v.selection) ||
    !subset(v.recent) ||
    !["horizontal", "vertical"].includes(v.direction) ||
    !["light", "dark", "system"].includes(v.theme) ||
    ![16, 18, 20, 22].includes(v.readingSize)
  )
    throw Error("不是有效的工作台备份");
  const ratio = v.splitRatio ?? 50;
  if (!Number.isInteger(ratio) || ratio < 25 || ratio > 75)
    throw Error("并排比例无效");
  const taskIds = new Set();
  const tasks = v.tasks ?? [];
  if (!Array.isArray(tasks) || tasks.length > 12) throw Error("任务记录无效");
  for (const t of tasks) {
    if (
      !t ||
      typeof t.id !== "string" ||
      !/^[a-z0-9-]{1,60}$/.test(t.id) ||
      taskIds.has(t.id) ||
      typeof t.title !== "string" ||
      !t.title.trim() ||
      t.title.length > 80 ||
      typeof t.next !== "string" ||
      t.next.length > 600 ||
      !subset(t.projects) ||
      !t.projects.length ||
      !["active", "paused", "done"].includes(t.status)
    )
      throw Error("任务记录无效");
    taskIds.add(t.id);
  }
  return {
    version: 1,
    note: v.note,
    recent: [...v.recent],
    selection: [...v.selection],
    direction: v.direction,
    theme: v.theme,
    readingSize: v.readingSize,
    splitRatio: ratio,
    tasks: tasks.map((t) => ({
      id: t.id,
      title: t.title,
      next: t.next,
      projects: [...t.projects],
      status: t.status,
    })),
    preferences: validatePreferences(v.preferences, ids),
  };
}
export function expectedMessage(event, frame, url) {
  return (
    event.source === frame.contentWindow &&
    (event.origin === url.origin ||
      (!frame.sandbox.contains("allow-same-origin") && event.origin === "null"))
  );
}
