export const THEMES = ["song-paper", "modern-ink"];
export const COLORS = ["ground", "surface", "text", "muted", "accent"];
export function paletteIssues(palette) {
  const pairs = [
    ["text", "ground"],
    ["text", "surface"],
    ["text", "rail"],
    ["muted", "ground"],
    ["muted", "surface"],
    ["muted", "soft"],
    ["muted", "margin"],
    ["accent", "ground"],
    ["accent", "surface"],
    ["accent", "rail"],
    ["on-accent", "accent"],
  ];
  const hex = (value) => {
    if (
      typeof value !== "string" ||
      !/^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(value)
    )
      throw Error("主题颜色须能核验为十六进制值");
    return value.length === 4
      ? "#" +
          value
            .slice(1)
            .split("")
            .map((c) => c + c)
            .join("")
      : value;
  };
  return pairs
    .filter(([a, b]) => contrast(hex(palette[a]), hex(palette[b])) < 4.5)
    .map(([a, b]) => a + "/" + b);
}
export function initialPreferences() {
  return {
    metadata: {},
    layouts: [],
    appearance: { themeName: null, density: "comfortable", colors: {} },
    brief: "",
  };
}
const plain = (v) => v && typeof v === "object" && !Array.isArray(v);
const string = (v, n) => typeof v === "string" && v.length <= n;
export function projectMetadata(v = {}) {
  if (
    !plain(v) ||
    !string(v.group ?? "", 40) ||
    !Array.isArray(v.tags ?? []) ||
    (v.tags ?? []).length > 8 ||
    (v.tags ?? []).some((t) => !string(t, 24) || !t.trim()) ||
    typeof (v.pinned ?? false) !== "boolean"
  )
    throw Error("分组、标签或置顶字段无效");
  return {
    group: (v.group ?? "").trim(),
    tags: [...new Set((v.tags ?? []).map((t) => t.trim()))],
    pinned: v.pinned ?? false,
  };
}
export function validateAppearance(v) {
  if (
    !plain(v) ||
    !(v.themeName === null || THEMES.includes(v.themeName)) ||
    !["comfortable", "compact"].includes(v.density) ||
    !plain(v.colors) ||
    Object.keys(v.colors).some(
      (k) => !COLORS.includes(k) || !/^#[0-9a-f]{6}$/i.test(v.colors[k]),
    )
  )
    throw Error("主题、密度或配色配置无效");
  return {
    themeName: v.themeName,
    density: v.density,
    colors: { ...v.colors },
  };
}
export function validatePreferences(v, ids) {
  if (v === undefined) return initialPreferences();
  if (
    !plain(v) ||
    !plain(v.metadata) ||
    Object.keys(v.metadata).some((id) => !ids.includes(id)) ||
    !Array.isArray(v.layouts) ||
    v.layouts.length > 12 ||
    !string(v.brief, 2000)
  )
    throw Error("定制记录无效");
  const metadata = {};
  for (const id of Object.keys(v.metadata))
    metadata[id] = projectMetadata(v.metadata[id]);
  const seen = new Set(),
    layouts = v.layouts.map((l) => {
      if (
        !plain(l) ||
        !string(l.id, 60) ||
        !l.id ||
        seen.has(l.id) ||
        !string(l.name, 40) ||
        !l.name.trim() ||
        !Array.isArray(l.selection) ||
        !l.selection.length ||
        new Set(l.selection).size !== l.selection.length ||
        l.selection.some((id) => !ids.includes(id)) ||
        !["horizontal", "vertical"].includes(l.direction) ||
        ![16, 18, 20, 22].includes(l.readingSize)
      )
        throw Error("布局模板无效");
      seen.add(l.id);
      return {
        id: l.id,
        name: l.name,
        selection: [...l.selection],
        direction: l.direction,
        readingSize: l.readingSize,
      };
    });
  return {
    metadata,
    layouts,
    appearance: validateAppearance(v.appearance),
    brief: v.brief,
  };
}
export function visibleProjects(projects, prefs, query = "", group = "") {
  const needle = query.trim().toLowerCase();
  return projects
    .filter((p) => {
      const m = Object.hasOwn(prefs.metadata, p.id)
        ? prefs.metadata[p.id]
        : projectMetadata(p);
      return (
        (!group || m.group === group) &&
        (!needle ||
          [p.name, p.description, m.group, ...m.tags]
            .join(" ")
            .toLowerCase()
            .includes(needle))
      );
    })
    .sort(
      (a, b) =>
        Number(
          (Object.hasOwn(prefs.metadata, b.id)
            ? prefs.metadata[b.id]
            : projectMetadata(b)
          ).pinned,
        ) -
        Number(
          (Object.hasOwn(prefs.metadata, a.id)
            ? prefs.metadata[a.id]
            : projectMetadata(a)
          ).pinned,
        ),
    );
}
export function agentHandoff(config, state) {
  return {
    format: "yifang-agent-brief",
    version: 1,
    preferences: {
      ...state.preferences.appearance,
      readingSize: state.readingSize,
    },
    request: state.preferences.brief,
    projects: config.projects.map((p, i) => ({
      slot: i + 1,
      name: "项目 " + (i + 1),
      url: "请在本机填写",
      requiredCapabilities: ["independent-service", "optional-theme-v1"],
    })),
    layout: state.selection.map(
      (id) => config.projects.findIndex((p) => p.id === id) + 1,
    ),
    direction: state.direction,
    instructions: [
      "阅读AGENTS.md、PRODUCT.md、DESIGN.md与docs/INTEGRATION.md",
      "只修改工作台外壳与主题，不复制私人项目",
      "先展示可点击预览，确认后实现",
      "运行npm test、npm run build、npm run check:public，并检查键盘、手机和刷新恢复",
    ],
    excluded: [
      "notes",
      "real-project-names",
      "urls",
      "source-paths",
      "credentials",
    ],
  };
}
export function contrast(hexA, hexB) {
  const l = (hex) => {
    const a = hex
      .slice(1)
      .match(/../g)
      .map((x) => parseInt(x, 16) / 255)
      .map((x) => (x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4));
    return a[0] * 0.2126 + a[1] * 0.7152 + a[2] * 0.0722;
  };
  const a = l(hexA),
    b = l(hexB);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}
