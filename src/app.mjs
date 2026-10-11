import {
  STATE_KEY,
  stateKeyFor,
  initialState,
  validateConfig,
  validateState,
  projectURL,
  expectedMessage,
} from "./core.mjs";
import { mountCustomization } from "./customization.mjs";
import { visibleProjects } from "./customization-core.mjs";
const $ = (id) => document.getElementById(id),
  media = matchMedia("(prefers-color-scheme:dark)"),
  frames = new Map();
let config,
  storageKey = STATE_KEY,
  ids = [],
  state = initialState(),
  lastRaw = null,
  protectedStorage = false,
  rawRecord = null,
  view = "home",
  focusId = null,
  tab = "overview",
  pendingImport = null,
  importBase = null,
  version = 0,
  transition,
  deskScroll = 0;
const el = (tag, text) => {
  const n = document.createElement(tag);
  if (text !== undefined) n.textContent = text;
  return n;
};
const restoreHooks = [];
function projectIcon(name) {
  const shapes = {
    book: '<path d="M12 5v16M12 5C8 2 4 3 2 4v15c3-1 7-1 10 2 3-3 7-3 10-2V4c-2-1-6-2-10 1z"/>',
    file: '<path d="M14 3H5v18h14V8zM14 3v5h5M8 12h8M8 16h6"/>',
    chart: '<path d="M3 3v18h18M7 16v-5M12 16V7M17 16V4"/>',
    chat: '<path d="M4 4h16v13H9l-5 4zM8 8h8M8 12h5"/>',
    grid: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
  };
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("aria-hidden", "true");
  svg.classList.add("project-icon");
  svg.innerHTML = shapes[name] || shapes.grid;
  return svg;
}
function readState() {
  try {
    lastRaw = localStorage.getItem(storageKey);
    if (lastRaw !== null) {
      rawRecord = lastRaw;
      state = validateState(JSON.parse(lastRaw), ids);
    }
  } catch {
    protectedStorage = true;
    $("noteStatus").textContent =
      "原记录无法读取或解析，已暂停覆盖。请先在备份窗口导出原始记录。";
  }
  $("exportRaw").hidden = rawRecord === null || !protectedStorage;
}
function persist() {
  if (protectedStorage) return false;
  try {
    if (localStorage.getItem(storageKey) !== lastRaw) {
      protectedStorage = true;
      $("noteStatus").textContent =
        "另一页面更新了记录，已暂停覆盖。先导出本次记录，再刷新。";
      return false;
    }
    const nextRaw = JSON.stringify(state);
    localStorage.setItem(storageKey, nextRaw);
    lastRaw = nextRaw;
    return true;
  } catch {
    $("noteStatus").textContent = "浏览器不允许保存，请导出本次记录。";
    return false;
  }
}
addEventListener("storage", (e) => {
  if (e.key === storageKey || e.key === null) {
    try {
      if (localStorage.getItem(storageKey) !== lastRaw) {
        protectedStorage = true;
        $("noteStatus").textContent =
          "另一页面更新了记录，已暂停覆盖。先导出再刷新。";
      }
    } catch {
      protectedStorage = true;
    }
  }
});
function motion(update) {
  const current = ++version;
  transition?.skipTransition();
  const commit = () => {
    if (current === version) update();
  };
  if (
    document.startViewTransition &&
    !matchMedia("(prefers-reduced-motion:reduce)").matches
  ) {
    transition = document.startViewTransition(commit);
    for (const promise of [
      transition.ready,
      transition.updateCallbackDone,
      transition.finished,
    ])
      promise.catch(() => {});
  } else commit();
}
function effectiveTheme() {
  return state.theme === "system"
    ? media.matches
      ? "dark"
      : "light"
    : state.theme;
}
function syncTheme() {
  document.documentElement.dataset.theme = effectiveTheme();
  $("themeButton").textContent =
    effectiveTheme() === "dark" ? "切换浅色" : "切换深色";
  for (const [id, f] of frames) {
    const url = projectURL(
      config.projects.find((p) => p.id === id).url,
      location.origin,
    );
    f.frame.contentWindow?.postMessage(
      {
        type: "yifang:theme",
        version: 1,
        theme: effectiveTheme(),
        readingSize: state.readingSize,
      },
      f.frame.sandbox.contains("allow-same-origin") ? url.origin : "*",
    );
  }
}
media.addEventListener("change", () => {
  if (state.theme === "system") syncTheme();
});
function typeSize() {
  document.documentElement.style.setProperty(
    "--reading-size",
    state.readingSize + "px",
  );
  $("typeSize").textContent = state.readingSize;
  $("typeMinus").disabled = state.readingSize === 16;
  $("typePlus").disabled = state.readingSize === 22;
  syncTheme();
}
function track() {
  const active = document.querySelector("[data-tab][aria-selected=true]"),
    line = document.querySelector(".tab-track");
  if (active) {
    line.style.width = active.offsetWidth + "px";
    line.style.transform = "translateX(" + active.offsetLeft + "px)";
  }
}
function reading() {
  const box = $("readingBody");
  box.replaceChildren();
  if (tab === "note") {
    box.append(
      el(
        "p",
        state.note ||
          "还没有便笺。把想到的内容留在右侧，它只存放在当前浏览器。",
      ),
    );
  } else if (tab === "about") {
    box.append(
      el(
        "p",
        "项目通过配置接入，保留自己的页面和服务。让你的 Agent 阅读 AGENTS.md 与 docs/INTEGRATION.md，就可以添加入口、主题和布局。",
      ),
    );
  } else {
    const p = config.projects.find((p) => p.id === state.recent[0]);
    box.append(
      el(
        "p",
        p
          ? "上次打开：" + p.name
          : "这里还没有上次的位置。先打开一个项目，工作台会记住你的入口。",
      ),
    );
    box.append(
      el("p", "资料各有归处，个人笔记留在桌面。你可以独显，也可以并排对照。"),
    );
  }
  for (const b of document.querySelectorAll("[data-tab]")) {
    const active = b.dataset.tab === tab;
    b.setAttribute("aria-selected", active);
    b.tabIndex = active ? 0 : -1;
    if (active) box.setAttribute("aria-labelledby", b.id);
  }
  track();
}
function refreshHome() {
  const p =
    config.projects.find((p) => p.id === state.recent[0]) || config.projects[0];
  $("continueButton").disabled = !p;
  $("continueButton").textContent = p ? "继续：" + p.name : "先接入一个项目";
  $("continueLabel").textContent = state.recent.length
    ? "来自本机最近记录"
    : "尚未记录最近位置";
  $("recentList").replaceChildren();
  for (const id of state.recent) {
    const p = config.projects.find((p) => p.id === id),
      row = el("div");
    row.className = "recent-row";
    const b = el("button", p.name);
    b.dataset.open = id;
    row.append(b, el("span", "打开项目"));
    $("recentList").append(row);
  }
  if (!state.recent.length)
    $("recentList").append(el("p", "进入项目后，这里会保留最近的位置。"));
  reading();
}
function projectFrame(p) {
  if (frames.has(p.id)) return frames.get(p.id);
  const url = projectURL(p.url, location.origin),
    pane = el("section");
  pane.className = "pane";
  const header = el("header");
  header.className = "pane-header";
  header.append(el("strong", p.name));
  const actions = el("div");
  actions.className = "pane-actions";
  const focus = el("button", "铺满");
  focus.dataset.focus = p.id;
  const reload = el("button", "重载");
  reload.dataset.reload = p.id;
  const link = el("a", "原页");
  link.href = projectURL(p.originalUrl ?? p.url, location.origin).href;
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  actions.append(focus, reload, link);
  header.append(actions);
  const hint = el("p", "页面独立运行；若不能嵌入，请打开原页。");
  hint.className = "pane-hint";
  const frame = el("iframe");
  frame.title = p.name;
  frame.referrerPolicy = "no-referrer";
  frame.sandbox =
    "allow-scripts allow-forms" +
    (url.origin !== location.origin ? " allow-same-origin" : "") +
    (p.permissions?.includes("popups") ? " allow-popups" : "") +
    (p.permissions?.includes("downloads") ? " allow-downloads" : "");
  frame.src = url.href;
  frame.addEventListener("load", syncTheme);
  pane.append(header, hint, frame);
  $("stage").append(pane);
  const entry = { pane, frame, focus };
  frames.set(p.id, entry);
  return entry;
}
function workspace() {
  for (const p of config.projects) {
    const visible = state.selection.includes(p.id);
    if (visible) projectFrame(p);
    if (frames.has(p.id)) {
      const f = frames.get(p.id);
      f.pane.hidden = !visible;
      f.pane.style.order = state.selection.indexOf(p.id);
    }
  }
  $("stage").dataset.count = state.selection.length;
  $("stage").classList.toggle("vertical", state.direction === "vertical");
  $("directionButton").textContent =
    state.direction === "horizontal" ? "切换上下排列" : "切换左右排列";
  $("addProject").replaceChildren();
  for (const p of config.projects.filter(
    (p) => !state.selection.includes(p.id),
  )) {
    const o = el("option", p.name);
    o.value = p.id;
    $("addProject").append(o);
  }
  $("appendProject").disabled = !$("addProject").options.length;
}
function render() {
  const home = view === "home";
  $("homeView").hidden = !home;
  $("workspaceView").hidden = home;
  $("viewTitle").textContent = home
    ? config.title
    : state.selection
        .map((id) => config.projects.find((p) => p.id === id).name)
        .join(" / ");
  $("breadcrumb").textContent = home ? "我的桌面" : "工作区";
  for (const b of document.querySelectorAll("[data-open]"))
    if (b.closest("#navigation")) {
      const active =
        !home &&
        state.selection.length === 1 &&
        state.selection[0] === b.dataset.open;
      if (active) b.setAttribute("aria-current", "page");
      else b.removeAttribute("aria-current");
    }
  const navHome = $("navigation").querySelector("[data-home]");
  if (home) navHome.setAttribute("aria-current", "page");
  else navHome.removeAttribute("aria-current");
  home ? refreshHome() : workspace();
}
function openProjects(selected, push = true) {
  if (!selected.length) return;
  focusId = null;
  document.body.classList.remove("pane-focused", "focus-reading");
  state.selection = [...selected];
  for (const id of selected)
    state.recent = [id, ...state.recent.filter((x) => x !== id)].slice(
      0,
      ids.length,
    );
  view = "workspace";
  persist();
  motion(() => {
    render();
    if (push) history.pushState(null, "", "#project/" + selected.join("+"));
  });
}
function home(push = true) {
  focusId = null;
  document.body.classList.remove("pane-focused", "focus-reading");
  view = "home";
  motion(() => {
    render();
    if (push) history.pushState(null, "", "#home");
  });
}
function route() {
  const token = location.hash.slice(1);
  if (token.startsWith("project/")) {
    const selection = token
      .slice(8)
      .split("+")
      .filter((id, i, a) => ids.includes(id) && a.indexOf(id) === i);
    if (selection.length) return openProjects(selection, false);
  }
  home(false);
}
function download(value, name) {
  const url = URL.createObjectURL(
      new Blob(
        [typeof value === "string" ? value : JSON.stringify(value, null, 2)],
        { type: "application/json" },
      ),
    ),
    a = el("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function search() {
  const q = $("searchQuery").value.trim().toLowerCase();
  $("searchResults").replaceChildren();
  const matches = visibleProjects(config.projects, state.preferences, q);
  for (const p of matches) {
    const b = el("button", p.name + " — " + p.description);
    b.dataset.open = p.id;
    $("searchResults").append(b);
  }
  if (!matches.length)
    $("searchResults").append(
      el("p", "没有匹配项目。尝试更短的关键词，或在配置中接入项目。"),
    );
}
function showSearch() {
  if (!$("searchDialog").open) $("searchDialog").showModal();
  search();
  $("searchQuery").focus();
}
document.addEventListener("click", (e) => {
  const b = e.target.closest("button");
  if (!b) return;
  if (b.dataset.open) {
    $("searchDialog").close();
    openProjects([b.dataset.open]);
  }
  if (b.hasAttribute("data-home")) home();
  if (b.dataset.close) $(b.dataset.close).close();
  if (b.dataset.tab) {
    tab = b.dataset.tab;
    reading();
  }
  if (b.dataset.reload) {
    const f = frames.get(b.dataset.reload);
    f.frame.src = f.frame.src;
  }
  if (b.dataset.focus) {
    focusId = focusId === b.dataset.focus ? null : b.dataset.focus;
    document.body.classList.toggle("pane-focused", !!focusId);
    for (const [id, f] of frames) {
      f.pane.classList.toggle("focused", id === focusId);
      f.focus.textContent = id === focusId ? "回到工作区" : "铺满";
    }
  }
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    const modal = document.querySelector("dialog:modal");
    if (modal) {
      e.preventDefault();
      modal.close();
      return;
    }
  }
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
    e.preventDefault();
    showSearch();
  }
  if (e.key === "Escape" && !document.querySelector("dialog:modal")) {
    if (focusId) {
      document.querySelector('[data-focus="' + focusId + '"]').click();
    } else if (document.body.classList.contains("focus-reading"))
      $("focusButton").click();
  }
});
for (const [i, b] of [...document.querySelectorAll("[data-tab]")].entries())
  b.addEventListener("keydown", (e) => {
    const tabs = [...document.querySelectorAll("[data-tab]")];
    if (["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)) {
      e.preventDefault();
      const n =
        e.key === "Home"
          ? 0
          : e.key === "End"
            ? tabs.length - 1
            : (i + (e.key === "ArrowRight" ? 1 : tabs.length - 1)) %
              tabs.length;
      tabs[n].focus();
      tabs[n].click();
    }
  });
addEventListener("message", (e) => {
  if (
    !e.data ||
    !["yifang:ready", "yifang:shortcut", "yifang:theme-request"].includes(
      e.data.type,
    ) ||
    e.data.version !== 1
  )
    return;
  for (const [id, f] of frames) {
    const p = config.projects.find((p) => p.id === id);
    if (expectedMessage(e, f.frame, projectURL(p.url, location.origin))) {
      if (e.data.type === "yifang:ready") syncTheme();
      if (
        e.data.type === "yifang:theme-request" &&
        ["light", "dark", "system"].includes(e.data.theme)
      ) {
        state.theme = e.data.theme;
        syncTheme();
        persist();
      }
      if (e.data.type === "yifang:shortcut" && typeof e.data.key === "string") {
        if (e.data.key === "Escape") {
          if (focusId)
            document.querySelector('[data-focus="' + focusId + '"]').click();
          else if (document.body.classList.contains("focus-reading"))
            $("focusButton").click();
        }
        if (
          e.data.key.toLowerCase() === "k" &&
          (e.data.ctrlKey === true || e.data.metaKey === true)
        )
          showSearch();
      }
    }
  }
});
$("searchButton").onclick = showSearch;
$("searchQuery").oninput = search;
$("homeButton").onclick = () => home();
$("continueButton").onclick = () => openProjects([state.recent[0] || ids[0]]);
$("directionButton").onclick = () => {
  state.direction =
    state.direction === "horizontal" ? "vertical" : "horizontal";
  workspace();
  persist();
};
$("appendProject").onclick = () => {
  if ($("addProject").value)
    openProjects([...state.selection, $("addProject").value]);
};
$("themeButton").onclick = () => {
  state.theme = effectiveTheme() === "dark" ? "light" : "dark";
  syncTheme();
  persist();
};
for (const [button, step] of [
  ["typeMinus", -2],
  ["typePlus", 2],
])
  $(button).onclick = () => {
    state.readingSize = Math.max(16, Math.min(22, state.readingSize + step));
    typeSize();
    persist();
  };
$("focusButton").onclick = () => {
  if (!document.body.classList.contains("focus-reading")) deskScroll = scrollY;
  motion(() => {
    const focused = document.body.classList.toggle("focus-reading");
    $("focusButton").textContent = focused ? "回到桌面" : "专注这一页";
    scrollTo(0, focused ? 0 : deskScroll);
  });
};
$("deskNote").oninput = () => {
  state.note = $("deskNote").value;
  if (persist()) $("noteStatus").textContent = "已留在这张桌面上。";
  if (tab === "note") reading();
};
$("combineButton").onclick = () => {
  $("combineChoices").replaceChildren();
  for (const p of config.projects) {
    const label = el("label"),
      input = el("input");
    input.type = "checkbox";
    input.value = p.id;
    input.checked = state.selection.includes(p.id);
    label.append(input, el("span", p.name));
    $("combineChoices").append(label);
  }
  $("combineError").textContent = "";
  $("combineDialog").showModal();
};
$("combineForm").onsubmit = (e) => {
  e.preventDefault();
  const selected = [
    ...document.querySelectorAll("#combineChoices input:checked"),
  ].map((x) => x.value);
  if (!selected.length) {
    $("combineError").textContent = "请至少选择一个项目。";
    return;
  }
  $("combineDialog").close();
  openProjects(selected);
};
$("agentGuide").onclick = () => $("guideDialog").showModal();
$("copyGuide").onclick = async () => {
  try {
    await navigator.clipboard.writeText($("agentPrompt").textContent);
    $("copyStatus").textContent = "已复制，交给你自己的 Agent 即可。";
  } catch {
    $("copyStatus").textContent = "浏览器未允许复制，请手动选择上面的文字。";
  }
};
$("backupButton").onclick = () => {
  pendingImport = null;
  $("confirmImport").disabled = true;
  $("backupPreview").textContent = "";
  $("backupDialog").showModal();
};
$("exportBackup").onclick = () =>
  download(state, "yifang-personal-backup.json");
$("exportRaw").onclick = () =>
  download(rawRecord, "yifang-unreadable-record.json");
$("backupFile").onchange = async (e) => {
  const file = e.target.files[0];
  e.target.value = "";
  pendingImport = null;
  $("confirmImport").disabled = true;
  if (!file) return;
  try {
    if (file.size > 500000) throw Error("文件过大");
    pendingImport = validateState(JSON.parse(await file.text()), ids);
    importBase = localStorage.getItem(storageKey);
    $("backupPreview").textContent =
      "将替换：便笺 " +
      pendingImport.note.length +
      " 字；最近项目 " +
      pendingImport.recent.length +
      " 个；布局 " +
      pendingImport.selection.length +
      " 个项目；命名模板 " +
      pendingImport.preferences.layouts.length +
      " 个。\n" +
      "主题与项目分类也会按备份替换。旧版备份缺少定制字段时，会恢复默认定制设置。\n导入不会写入任何子项目。";
    $("confirmImport").disabled = false;
  } catch (err) {
    $("backupPreview").textContent = "未导入：" + err.message;
  }
};
$("confirmImport").onclick = () => {
  if (!pendingImport) return;
  try {
    if (localStorage.getItem(storageKey) !== importBase)
      throw Error("记录已在另一页面变化，请重新选择备份预览");
    const raw = JSON.stringify(pendingImport);
    localStorage.setItem(storageKey, raw);
    state = pendingImport;
    lastRaw = raw;
    protectedStorage = false;
    rawRecord = null;
    pendingImport = null;
    $("confirmImport").disabled = true;
    $("exportRaw").hidden = true;
    $("deskNote").value = state.note;
    focusId = null;
    document.body.classList.remove("pane-focused", "focus-reading");
    for (const entry of frames.values()) {
      entry.pane.classList.remove("focused");
      entry.focus.textContent = "铺满";
    }
    $("focusButton").textContent = "专注这一页";
    view = state.selection.length ? "workspace" : "home";
    typeSize();
    render();
    history.replaceState(
      null,
      "",
      view === "home" ? "#home" : "#project/" + state.selection.join("+"),
    );
    $("backupPreview").textContent = "个人记录已恢复，子项目内容保持不变。";
    restoreHooks.forEach((run) => run());
  } catch (err) {
    $("backupPreview").textContent = "未恢复：" + err.message;
  }
};
new ResizeObserver(track).observe(document.querySelector(".reading-tabs"));
addEventListener("popstate", route);
try {
  let response = await fetch("/api/config");
  if (!response.ok) response = await fetch("/workbench.config.json");
  config = validateConfig(await response.json());
  storageKey = stateKeyFor(config);
  ids = config.projects.map((p) => p.id);
  $("themeSheet").href = "/themes/" + config.theme + ".css";
  document.title = config.title;
  $("brandTitle").textContent = config.title;
  $("subtitle").textContent = config.subtitle;
  $("projectCount").textContent = ids.length + " 个独立项目";
  $("navigation").replaceChildren();
  const homeNav = el("button", "我的桌面");
  homeNav.dataset.home = "";
  $("navigation").append(homeNav);
  for (const p of config.projects) {
    const b = el("button", p.name);
    b.dataset.open = p.id;
    $("navigation").append(b);
    const row = el("article");
    row.className = "project-row";
    const content = el("div");
    const projectHeading = el("h3", p.name);
    projectHeading.prepend(projectIcon(p.icon));
    content.append(projectHeading, el("p", p.description));
    const open = el("button", "进入 →");
    open.dataset.open = p.id;
    row.append(content, open);
    $("projectList").append(row);
  }
  if (!ids.length) {
    $("projectList").append(
      el(
        "p",
        "还没有项目。复制 config.example.json 为 config.local.json，让你的 Agent 按接入文档添加一个项目。",
      ),
    );
  }
  $("combineButton").disabled = !ids.length;
  readState();
  $("deskNote").value = state.note;
  typeSize();
  refreshHome();
  for (let i = 0; i + 1 < ids.length; i += 2) {
    const pair = ids.slice(i, i + 2),
      b = el(
        "button",
        pair
          .map((id) => config.projects.find((p) => p.id === id).name)
          .join("＋"),
      );
    b.onclick = () => openProjects(pair);
    $("quickCombinations").append(b);
  }
  $("agentPrompt").textContent =
    "请先阅读 AGENTS.md、PRODUCT.md、DESIGN.md 和 docs/INTEGRATION.md。\n我希望定制这个本地工作台的风格，并接入我自己的项目。\n保留项目独立运行、主题协议、键盘操作、个人记录与来源内容的边界。\n在 src/themes/ 下新增主题；在 config.local.json 中登记本机项目，不提交私人配置。\n改动后运行 npm test、npm run build、npm run check:public，并实际验证桌面、手机和刷新恢复。\n具体风格与项目地址：请向我确认。";
  $("today").textContent = new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    month: "long",
    day: "numeric",
    weekday: "long",
  }).format(new Date());
  mountCustomization({
    config: () => config,
    state: () => state,
    persist,
    validateConfig,
    projectURL,
    download,
    syncReading: typeSize,
    onRestore: (run) => restoreHooks.push(run),
    openLayout(layout) {
      state.direction = layout.direction;
      state.readingSize = layout.readingSize;
      typeSize();
      openProjects(layout.selection);
    },
  });
  route();
} catch (err) {
  $("fatal").hidden = false;
  $("fatal").textContent =
    "工作台未能启动：" +
    err.message +
    "\n请检查 config.local.json，再刷新页面。";
  $("combineButton").disabled = true;
}
