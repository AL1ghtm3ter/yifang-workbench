import {
  initialPreferences,
  validatePreferences,
  projectMetadata,
} from "./customization-core.mjs";
export const STATE_KEY = "yifang-workbench-state-v1";
export function openingMode(state, id) { return Object.hasOwn(state.openModes,id) ? state.openModes[id] : "embed"; }
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
      p.sourceType !== undefined &&
      !["live", "snapshot", "unknown"].includes(p.sourceType)
    )
      throw Error("来源类型无效");
    if (
      p.snapshotDate !== undefined &&
      (typeof p.snapshotDate !== "string" ||
        !/^\d{4}-\d{2}-\d{2}$/.test(p.snapshotDate) ||
        !Number.isFinite(Date.parse(p.snapshotDate)) ||
        new Date(p.snapshotDate).toISOString().slice(0, 10) !== p.snapshotDate)
    )
      throw Error("快照日期无效");
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
      ...(p.sourceType ? { sourceType: p.sourceType } : {}),
      ...(p.snapshotDate ? { snapshotDate: p.snapshotDate } : {}),
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
    desk: { name: "", inscription: "" },
    openModes: {},
    registry: [],
    archives: [],
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
  const desk = v.desk ?? { name: "", inscription: "" };
  if (
    !desk ||
    typeof desk.name !== "string" ||
    desk.name.length > 40 ||
    typeof desk.inscription !== "string" ||
    desk.inscription.length > 160
  )
    throw Error("题签无效");
  const openModes = v.openModes ?? {};
  if (
    !openModes ||
    typeof openModes !== "object" ||
    Array.isArray(openModes) ||
    Object.keys(openModes).some(
      (id) =>
        !ids.includes(id) || !["embed", "tab", "copy"].includes(openModes[id]),
    )
  )
    throw Error("打开方式无效");
  const registry = v.registry ?? [];
  if (
    !Array.isArray(registry) ||
    registry.length > 24 ||
    new Set(registry.map((p) => p?.id)).size !== registry.length ||
    registry.some(
      (p) =>
        !p ||
        !ids.includes(p.id) ||
        typeof p.name !== "string" ||
        p.name.length > 60,
    )
  )
    throw Error("登记快照无效");
  registry.forEach((p) => projectURL(p.url));
  const archives = v.archives ?? [];
  if (
    !Array.isArray(archives) ||
    archives.length > 3 ||
    archives.some(
      (a) =>
        !a ||
        typeof a.label !== "string" ||
        a.label.length > 80 ||
        typeof a.raw !== "string" ||
        a.raw.length > 100000 ||
        typeof a.createdAt !== "string" ||
        !Number.isFinite(Date.parse(a.createdAt)),
    )
  )
    throw Error("归档记录无效");
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
    if (
      t.links !== undefined &&
      (!Array.isArray(t.links) ||
        t.links.length > 1 ||
        t.links.some(
          (l) =>
            !l ||
            !t.projects.includes(l.projectId) ||
            typeof l.label !== "string" ||
            !l.label.trim() ||
            l.label.length > 60,
        ))
    )
      throw Error("停靠链接无效");
    for (const l of t.links ?? []) projectURL(l.url);
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
      ...(t.links
        ? {
            links: t.links.map((l) => ({
              projectId: l.projectId,
              label: l.label,
              url: l.url,
            })),
          }
        : {}),
    })),
    desk: { name: desk.name, inscription: desk.inscription },
    openModes: { ...openModes },
    registry: registry.map((p) => ({ id: p.id, name: p.name, url: p.url })),
    archives: archives.map((a) => ({
      label: a.label,
      createdAt: a.createdAt,
      raw: a.raw,
    })),
    preferences: validatePreferences(v.preferences, ids),
  };
}
export function recordIds(v) {
  const refs = [
    ...(v.selection ?? []),
    ...(v.recent ?? []),
    ...(v.preferences?.hidden ?? []),
    ...Object.keys(v.preferences?.metadata ?? {}),
    ...Object.keys(v.openModes ?? {}),
    ...(v.registry ?? []).map((p) => p.id),
    ...(v.tasks ?? []).flatMap((t) => t.projects ?? []),
    ...(v.preferences?.layouts ?? []).flatMap((l) => l.selection ?? []),
  ];
  if (
    refs.length > 1000 ||
    refs.some(
      (id) => typeof id !== "string" || !/^[a-z][a-z0-9-]{0,40}$/.test(id),
    )
  )
    throw Error("无法核对项目ID");
  return [...new Set(refs)];
}
export function migrateRecord(v, currentIds, mapping) {
  const all = [...new Set([...currentIds, ...recordIds(v)])],
    old = validateState(v, all);
  const missing = all.filter((id) => !currentIds.includes(id));
  if (
    missing.some(
      (id) =>
        !Object.hasOwn(mapping, id) ||
        (mapping[id] !== null && !currentIds.includes(mapping[id])),
    )
  )
    throw Error("请明确映射或归档每个旧项目");
  const targets = missing.map((id) => mapping[id]).filter(Boolean);
  if (
    new Set(targets).size !== targets.length ||
    targets.some((id) => recordIds(v).includes(id) && currentIds.includes(id))
  )
    throw Error("不能将多份个人记录隐式合并到同一项目");
  const move = (id) => (currentIds.includes(id) ? id : mapping[id]);
  const subset = (a) => [...new Set(a.map(move).filter(Boolean))];
  const next = structuredClone(old);
  next.selection = subset(old.selection);
  next.recent = subset(old.recent);
  next.preferences.hidden = subset(old.preferences.hidden);
  next.registry = [];
  next.openModes = {};
  next.preferences.metadata = {};
  for (const [id, value] of Object.entries(old.openModes))
    if (move(id)) next.openModes[move(id)] = value;
  for (const [id, value] of Object.entries(old.preferences.metadata))
    if (move(id)) next.preferences.metadata[move(id)] = value;
  next.tasks = old.tasks.flatMap((t) => {
    const projects = subset(t.projects);
    return projects.length
      ? [
          {
            ...t,
            projects,
            links: (t.links ?? [])
              .filter((l) => move(l.projectId))
              .map((l) => ({ ...l, projectId: move(l.projectId) })),
          },
        ]
      : [];
  });
  next.preferences.layouts = old.preferences.layouts.flatMap((l) => {
    const selection = subset(l.selection);
    return selection.length ? [{ ...l, selection }] : [];
  });
  // Preserve the entire pre-migration shell state as a bounded, downloadable archive.
  const raw = JSON.stringify({ ...old, archives: [] });
  if (raw.length > 100000 || old.archives.length >= 3)
    throw Error("归档已满或原记录过大，请先下载归档再核对");
  next.archives.push({
    label: "配置核对前记录",
    createdAt: new Date().toISOString(),
    raw,
  });
  return validateState(next, currentIds);
}
export function safeTaskLink(link, projects, base) {
  const p = projects.find((p) => p.id === link.projectId);
  if (!p) throw Error("停靠项目未登记");
  const url = projectURL(link.url, base),
    origins = [
      projectURL(p.url, base).origin,
      projectURL(p.originalUrl ?? p.url, base).origin,
    ];
  if (!origins.includes(url.origin))
    throw Error("停靠链接须属于关联项目的已登记来源");
  return url.href;
}
export function expectedMessage(event, frame, url) {
  return (
    event.source === frame.contentWindow &&
    (event.origin === url.origin ||
      (!frame.sandbox.contains("allow-same-origin") && event.origin === "null"))
  );
}
