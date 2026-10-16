export function defaultDemoSettings() {
  return { version: 1, hidden: [], theme: "light", readingSize: 18, density: "comfortable" };
}
export function validateDemoSettings(value, ids) {
  if (!value || value.version !== 1 || !Array.isArray(value.hidden) ||
      value.hidden.some(id => typeof id !== "string" || !ids.includes(id)) ||
      new Set(value.hidden).size !== value.hidden.length ||
      !["light", "dark", "system"].includes(value.theme) ||
      ![16, 18, 20, 22].includes(value.readingSize) ||
      !["comfortable", "compact"].includes(value.density)) throw Error("演示记录无法读取，已暂停保存以保留原记录。");
  return { version: 1, hidden: [...value.hidden], theme: value.theme, readingSize: value.readingSize, density: value.density };
}
export function demoVisibleProjects(projects, settings) {
  return projects.filter(project => !settings.hidden.includes(project.id));
}

async function mount() {
  const $ = id => document.getElementById(id);
  const make = (tag, text) => {
    const node = document.createElement(tag);
    if (text !== undefined) node.textContent = text;
    return node;
  };
  const response = await fetch("/api/config");
  if (!response.ok) throw Error("项目清单未加载，请确认工作台服务运行后刷新。");
  const config = await response.json(), ids = config.projects.map(p => p.id);
  const key = "yifang-settings-demo-v1:" + (config.storageNamespace || "default");
  let saved = defaultDemoSettings(), lastRaw = null, protectedRecord = false;
  try {
    lastRaw = localStorage.getItem(key);
    if (lastRaw !== null) saved = validateDemoSettings(JSON.parse(lastRaw), ids);
  } catch (error) {
    protectedRecord = true;
    $("demoStatus").textContent = error.message || "浏览器不允许保存，仍可临时试用。";
  }
  let draft = structuredClone(saved), section = "projects", home = true, currentProject = null;
  let settingsReturnFocus = null;
  let animations = [];
  const projectFrames = new Map();
  function reveal(target) {
    animations.forEach(animation => animation.cancel());
    animations = [];
    if (matchMedia("(prefers-reduced-motion:reduce)").matches) return;
    animations.push(target.animate([
      { opacity: 0.45, transform: "translateX(36px)", clipPath: "inset(0 0 0 8%)" },
      { opacity: 1, transform: "translateX(0)", clipPath: "inset(0 0 0 0%)" }
    ], { duration: 420, easing: "cubic-bezier(0.16,1,0.3,1)" }));
    const active = document.querySelector('#demoNav [aria-current="page"], #demoSettings[aria-current="page"]');
    if (active) animations.push(active.animate([
      { transform: "scale(.94)" }, { transform: "scale(1.035)", offset: .55 }, { transform: "scale(1)" }
    ], { duration: 300, easing: "ease-out" }));
  }
  function syncNavigation() {
    const active = currentProject || "home";
    for (const button of document.querySelectorAll("[data-demo-view]")) {
      if (button.dataset.demoView === active) button.setAttribute("aria-current", "page");
      else button.removeAttribute("aria-current");
    }
    $("demoSettings").setAttribute("aria-expanded", String($("demoSettingsDialog").open));
    $("demoMobileProject").value = active;
  }
  const media = matchMedia("(prefers-color-scheme:dark)");
  function appearance() {
    document.documentElement.dataset.theme = draft.theme === "system" ? (media.matches ? "dark" : "light") : draft.theme;
    document.documentElement.style.setProperty("--reading-size", draft.readingSize + "px");
    document.body.dataset.density = draft.density;
    $("demoTheme").value = draft.theme;
    $("demoSize").value = draft.readingSize;
    $("demoDensity").value = draft.density;
  }
  function status(message) {
    const dirty = JSON.stringify(draft) !== JSON.stringify(saved);
    $("demoSave").disabled = !dirty || protectedRecord;
    $("demoCancel").disabled = !dirty;
    if (!protectedRecord) $("demoStatus").textContent = message || (dirty ? "有未保存的修改，正在预览。" : "尚未修改。");
  }
  function projectViews() {
    const visible = demoVisibleProjects(config.projects, draft);
    $("demoMobileProject").replaceChildren();
    for (const [id, name] of [["settings", "设置"], ["home", "我的桌面"], ...visible.map(p => [p.id, p.name])]) {
      const option = make("option", name); option.value = id; $("demoMobileProject").append(option);
    }
    $("demoNav").replaceChildren();
    const homeButton = make("button", "我的桌面");
    homeButton.dataset.demoView = "home";
    homeButton.onclick = () => showHome(true);
    $("demoNav").append(homeButton);
    for (const project of visible) {
      const link = make("button", project.name);
      link.dataset.demoView = project.id;
      link.onclick = () => showProject(project);
      $("demoNav").append(link);
    }
    $("demoHomeList").replaceChildren();
    for (const project of visible) {
      const row = make("article"), copy = make("div"), link = make("button", "进入项目"), hide = make("button", "隐藏");
      row.className = "project-row";
      copy.append(make("h3", project.name), make("p", project.description));
      link.className = "primary"; link.onclick = () => showProject(project);
      hide.className = "demo-tertiary";
      hide.setAttribute("aria-label", "隐藏" + project.name);
      hide.onclick = () => {
        draft.hidden.push(project.id); projectViews(); status("已隐藏“" + project.name + "”，可在项目显示中恢复。尚未保存。");
        $("demoManage").focus();
      };
      row.append(copy, link, hide); $("demoHomeList").append(row);
    }
    if (!visible.length) $("demoHomeList").append(make("p", "项目都已收起。点击“管理项目显示”，重新选择手边的项目。"));
    $("demoCount").textContent = `${visible.length} 个显示 · ${draft.hidden.length} 个隐藏`;
    const needle = $("demoFilter").value.trim().toLowerCase();
    $("demoProjectRows").replaceChildren();
    for (const project of config.projects.filter(p => (p.name + " " + p.group).toLowerCase().includes(needle))) {
      const row = make("div"), copy = make("div"), label = make("label"), input = make("input"), labelText = make("span");
      row.className = "setting-row";
      copy.append(make("h3", project.name), make("p", project.group || "独立项目"));
      input.type = "checkbox"; input.checked = !draft.hidden.includes(project.id);
      input.setAttribute("aria-label", "显示" + project.name);
      label.className = "visibility-control";
      labelText.textContent = input.checked ? "显示中" : "已隐藏";
      input.onchange = () => {
        draft.hidden = input.checked ? draft.hidden.filter(id => id !== project.id) : [...draft.hidden, project.id];
        projectViews(); status();
        const target = [...$("demoProjectRows").querySelectorAll("input")].find(n => n.getAttribute("aria-label") === "显示" + project.name);
        target?.focus();
      };
      label.append(input, labelText); row.append(copy, label); $("demoProjectRows").append(row);
    }
    if (!$("demoProjectRows").children.length) $("demoProjectRows").append(make("p", "没有匹配的项目，试试其他名称。"));
    $("demoShowAll").disabled = draft.hidden.length === 0;
    if (currentProject && draft.hidden.includes(currentProject)) showHome(true);
    syncNavigation();
  }
  function showHome(value) {
    if (!value) return openSettings();
    const changed = !home || currentProject !== null;
    home = true;
    currentProject = null;
    document.body.dataset.view = "home";
    $("demoWorkspaceView").hidden = true;
    $("demoHomeView").hidden = false;
    $("demoTitle").textContent = "手边，只留需要的。";
    $("demoSubtitle").textContent = "项目各自独立，在这里继续手边的事。";
    $("demoCrumb").textContent = "我的桌面 / 演示";
    $("demoHome").textContent = "打开设置";
    syncNavigation();
    if (changed) reveal($("demoHomeView"));
  }
  function openSettings() {
    const dialog = $("demoSettingsDialog");
    if (dialog.open) return;
    settingsReturnFocus = document.activeElement;
    dialog.showModal();
    document.body.classList.add("settings-open");
    syncNavigation();
    $("demoCloseSettings").focus({ preventScroll: true });
  }
  function closeSettings() {
    const dialog = $("demoSettingsDialog");
    if (!dialog.open) return;
    dialog.close();
    document.body.classList.remove("settings-open");
    syncNavigation();
    (settingsReturnFocus?.isConnected && settingsReturnFocus !== document.body ? settingsReturnFocus : $("demoSettings")).focus({ preventScroll: true });
  }
  function showProject(project) {
    if (currentProject === project.id) return;
    home = false; currentProject = project.id;
    document.body.dataset.view = "project";
    $("demoHomeView").hidden = true;
    $("demoWorkspaceView").hidden = false;
    $("demoTitle").textContent = project.name;
    $("demoSubtitle").textContent = project.description;
    $("demoCrumb").textContent = "工作区 / " + project.name;
    $("demoHome").textContent = "返回桌面";
    $("demoOriginal").href = project.originalUrl || project.url;
    let entry = projectFrames.get(project.id);
    if (!entry) {
      const frame = make("iframe");
      frame.title = project.name;
      frame.setAttribute("sandbox", ["allow-scripts", "allow-same-origin", "allow-forms", ...((project.permissions || []).includes("popups") ? ["allow-popups", "allow-popups-to-escape-sandbox"] : []), ...((project.permissions || []).includes("downloads") ? ["allow-downloads"] : [])].join(" "));
      frame.referrerPolicy = "no-referrer";
      entry = { frame, loaded: false };
      projectFrames.set(project.id, entry);
      frame.onload = () => {
        entry.loaded = true;
        if (currentProject === project.id) $("demoFrameStatus").textContent = "页面独立运行；若显示异常，可在新窗口打开。";
      };
      frame.src = project.url; $("demoFrameStage").append(frame);
    }
    for (const [id, item] of projectFrames) item.frame.hidden = id !== project.id;
    $("demoFrameStatus").textContent = entry.loaded ? "页面独立运行；若显示异常，可在新窗口打开。" : "正在载入页面；若无法显示，可在新窗口打开。";
    syncNavigation(); reveal($("demoWorkspaceView"));
  }
  function showSection(next) {
    const changed = section !== next;
    section = next; showHome(false);
    for (const name of ["projects", "appearance", "data"]) $("demo-" + name).hidden = name !== section;
    for (const button of document.querySelectorAll("[data-section]")) {
      if (button.dataset.section === section) button.setAttribute("aria-current", "page");
      else button.removeAttribute("aria-current");
    }
    $(section + "Heading").focus();
    if (changed) reveal($("demo-" + section));
  }
  for (const button of document.querySelectorAll("[data-section]")) button.onclick = () => showSection(button.dataset.section);
  $("demoHome").onclick = () => showHome(currentProject ? true : !home);
  $("demoSettings").onclick = () => showHome(false);
  $("demoCloseSettings").onclick = closeSettings;
  $("demoSettingsDialog").addEventListener("cancel", event => { event.preventDefault(); closeSettings(); });
  $("demoSettingsDialog").addEventListener("click", event => {
    if (event.target !== $("demoSettingsDialog")) return;
    const rect = event.target.getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) closeSettings();
  });
  $("demoMobileProject").onchange = event => {
    const id = event.target.value;
    if (id === "settings" || id === "home") showHome(id === "home");
    else {
      const project = config.projects.find(project => project.id === id);
      if (project) showProject(project);
    }
  };
  $("demoManage").onclick = () => showSection("projects");
  $("demoFilter").oninput = projectViews;
  $("demoShowAll").onclick = () => { draft.hidden = []; projectViews(); status(); $("demoFilter").focus(); };
  for (const [id, field] of [["demoTheme", "theme"], ["demoSize", "readingSize"], ["demoDensity", "density"]]) {
    $(id).onchange = () => { draft[field] = field === "readingSize" ? Number($(id).value) : $(id).value; appearance(); status(); };
  }
  $("demoCancel").onclick = () => { draft = structuredClone(saved); appearance(); projectViews(); status("已取消，恢复到上次保存的演示设置。"); };
  $("demoReset").onclick = () => { draft = defaultDemoSettings(); appearance(); projectViews(); status("默认值已预览，保存后保留。"); };
  $("demoSave").onclick = () => {
    try {
      if (protectedRecord || localStorage.getItem(key) !== lastRaw) {
        protectedRecord = true;
        throw Error("演示记录已在其他页面更新，已暂停保存。请刷新后继续。");
      }
      const next = validateDemoSettings(draft, ids), raw = JSON.stringify(next);
      localStorage.setItem(key, raw); lastRaw = raw; saved = next;
      status("演示设置已保存。刷新后仍会保留。");
    } catch (error) {
      $("demoStatus").textContent = error.message || "保存失败，可继续临时预览。";
      $("demoSave").disabled = protectedRecord;
    }
  };
  addEventListener("storage", event => {
    if (event.key === key || event.key === null) {
      protectedRecord = true; $("demoSave").disabled = true;
      $("demoStatus").textContent = "另一页面更新了演示记录，已暂停保存。请刷新后继续。";
    }
  });
  media.addEventListener("change", appearance);
  appearance(); projectViews(); status(lastRaw !== null ? "已载入上次保存的演示设置。" : undefined);
  showHome(true);
  openSettings();
  // Navigation changes the preview only; project content remains in its independent iframe.
}
if (typeof document !== "undefined") mount().catch(error => {
  const box = document.getElementById("demoError");
  box.hidden = false; box.textContent = error.message;
});
