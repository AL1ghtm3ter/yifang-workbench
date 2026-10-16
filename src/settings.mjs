import { settingsSnapshot, withSettings } from "./customization-core.mjs";
export function mountSettings(api) {
  document.body.classList.add("settings-host");
  const holder = document.createElement("div"); holder.innerHTML = markup;
  const dialog = holder.firstElementChild; document.body.append(dialog);
  const $ = id => document.getElementById(id);
  const make = (tag, text) => { const node = document.createElement(tag); if (text !== undefined) node.textContent = text; return node; };
  let baseline = settingsSnapshot(api.state()), draft = structuredClone(baseline), opener = null;
  let previewing = false;
  const dirty = () => JSON.stringify(draft) !== JSON.stringify(baseline);
  function status(message) {
    $("demoSave").disabled = !dirty(); $("demoCancel").disabled = !dirty();
    $("demoStatus").textContent = message || (dirty() ? "有未保存的修改，正在预览。" : "设置与个人记录仅保存在当前浏览器。");
  }
  function appearance() {
    api.preview(draft); previewing = true;
    $("demoTheme").value = draft.theme; $("demoSize").value = draft.readingSize; $("demoDensity").value = draft.density;
  }
  function rows() {
    $("demoProjectRows").replaceChildren();
    const query = $("demoFilter").value.trim().toLowerCase();
    for (const project of api.config().projects.filter(p => (p.name + " " + (p.group || "")).toLowerCase().includes(query))) {
      const row = make("div"), copy = make("div"), label = make("label"), input = make("input"), text = make("span");
      row.className = "setting-row"; label.className = "visibility-control";
      copy.append(make("h3", project.name), make("p", project.group || "独立项目"));
      input.type = "checkbox"; input.checked = !draft.hidden.includes(project.id);
      input.setAttribute("aria-label", "显示" + project.name);
      text.textContent = input.checked ? "显示中" : "已隐藏";
      input.onchange = () => {
        draft.hidden = input.checked ? draft.hidden.filter(id => id !== project.id) : [...draft.hidden, project.id];
        text.textContent = input.checked ? "显示中" : "已隐藏"; count(); status();
      };
      label.append(input, text); row.append(copy, label); $("demoProjectRows").append(row);
    }
    if (!$("demoProjectRows").children.length) $("demoProjectRows").append(make("p", "没有匹配的项目，试试其他名称。"));
    count();
  }
  function count() {
    $("demoCount").textContent = `${api.config().projects.length - draft.hidden.length} 个显示 · ${draft.hidden.length} 个隐藏`;
    $("demoShowAll").disabled = draft.hidden.length === 0;
  }
  function open() {
    if (dialog.open) return;
    if (!dirty()) { baseline = settingsSnapshot(api.state()); draft = structuredClone(baseline); }
    opener = document.activeElement;
    rows(); appearance(); status(); dialog.showModal();
    document.body.classList.add("settings-open"); $("settingsButton").setAttribute("aria-expanded", "true");
    $("demoCloseSettings").focus({ preventScroll: true });
  }
  function close() {
    if (!dialog.open) return;
    dialog.close(); document.body.classList.remove("settings-open");
    $("settingsButton").setAttribute("aria-expanded", "false");
    if (previewing) { api.preview(null); previewing = false; }
    (opener?.isConnected ? opener : $("settingsButton")).focus({ preventScroll: true });
  }
  $("settingsButton").onclick = open;
  $("settingsButton").disabled = false;
  $("demoCloseSettings").onclick = close;
  dialog.addEventListener("cancel", event => { event.preventDefault(); close(); });
  dialog.addEventListener("click", event => {
    if (event.target !== dialog) return;
    const box = dialog.getBoundingClientRect();
    if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) close();
  });
  for (const button of dialog.querySelectorAll("[data-section]")) button.onclick = () => {
    for (const name of ["projects", "appearance", "data"]) $("demo-" + name).hidden = name !== button.dataset.section;
    for (const item of dialog.querySelectorAll("[data-section]")) {
      if (item === button) item.setAttribute("aria-current", "page"); else item.removeAttribute("aria-current");
    }
    $(button.dataset.section + "Heading").focus();
  };
  $("demoFilter").oninput = rows;
  $("demoShowAll").onclick = () => { draft.hidden = []; rows(); status(); $("demoFilter").focus(); };
  for (const [id, field] of [["demoTheme", "theme"], ["demoSize", "readingSize"], ["demoDensity", "density"]]) {
    $(id).onchange = () => { draft[field] = field === "readingSize" ? Number($(id).value) : $(id).value; appearance(); status(); };
  }
  $("demoCancel").onclick = () => { baseline = settingsSnapshot(api.state()); draft = structuredClone(baseline); appearance(); rows(); status("已取消，恢复到已保存的设置。"); };
  $("demoReset").onclick = () => { draft = { hidden: [], theme: "light", readingSize: 18, density: "comfortable" }; appearance(); rows(); status("默认显示偏好已预览，便笺和任务保持原样；保存后生效。"); };
  $("demoSave").onclick = () => {
    try {
      if (JSON.stringify(settingsSnapshot(api.state())) !== JSON.stringify(baseline)) throw Error("设置已在其他操作中变化，请取消修改后重试。");
      const next = withSettings(api.state(), draft, api.config().projects.map(p => p.id));
      api.commit(next);
      baseline = settingsSnapshot(api.state()); draft = structuredClone(baseline);
      rows(); status("设置已保存，刷新后仍会保留。");
    } catch (error) { $("demoStatus").textContent = error.message || "设置未保存，请先备份当前记录。"; }
  };
  $("settingsBackup").onclick = () => { close(); $("backupButton").click(); };
  return { open, refresh() { if (!dirty()) { baseline = settingsSnapshot(api.state()); draft = structuredClone(baseline); } } };
}
const markup = "    <dialog id=\"demoSettingsDialog\" class=\"settings-glass\" aria-labelledby=\"demoSettingsTitle\" aria-describedby=\"demoSettingsHint\">\n      <header class=\"glass-heading\"><div><h2 id=\"demoSettingsTitle\">设置</h2><p id=\"demoSettingsHint\">让书桌顺手一些 · 关闭后保留未保存的修改</p></div><button id=\"demoCloseSettings\" class=\"demo-secondary\" aria-label=\"关闭设置\">关闭 <kbd>Esc</kbd></button></header>\n    <section id=\"demoSettingsView\" class=\"settings-layout\" aria-label=\"工作台设置预览\">\n      <nav class=\"settings-sections\" aria-label=\"设置分类\">\n        <button data-section=\"projects\" aria-current=\"page\">项目显示</button>\n        <button data-section=\"appearance\">外观与阅读</button>\n        <button data-section=\"data\">数据与恢复</button>\n      </nav>\n      <div class=\"settings-content\">\n        <section id=\"demo-projects\" aria-labelledby=\"projectsHeading\">\n          <h2 id=\"projectsHeading\" tabindex=\"-1\">项目显示</h2>\n          <p class=\"setting-description\">隐藏后，项目从桌面和导航收起。内容与记录保留，随时可以在这里重新显示。</p>\n          <div class=\"settings-filter\"><input id=\"demoFilter\" type=\"search\" placeholder=\"查找项目…\" aria-label=\"查找项目\"><button id=\"demoShowAll\" class=\"demo-secondary\">全部显示</button></div>\n          <p id=\"demoCount\" class=\"setting-description\"></p><div id=\"demoProjectRows\"></div>\n        </section>\n        <section id=\"demo-appearance\" hidden aria-labelledby=\"appearanceHeading\">\n          <h2 id=\"appearanceHeading\" tabindex=\"-1\">外观与阅读</h2>\n          <p class=\"setting-description\">修改即时预览；保存后保留，取消则回到上次保存的样子。</p>\n          <div class=\"setting-row\"><div><label for=\"demoTheme\">明暗模式</label><p>跟随系统，或固定使用一种明暗。</p></div><select id=\"demoTheme\"><option value=\"system\">跟随系统</option><option value=\"light\">浅色</option><option value=\"dark\">深色</option></select></div>\n          <div class=\"setting-row\"><div><label for=\"demoSize\">阅读字号</label><p>用于正文与阅读区域。</p></div><select id=\"demoSize\"><option value=\"16\">16 px</option><option value=\"18\">18 px · 默认</option><option value=\"20\">20 px</option><option value=\"22\">22 px</option></select></div>\n          <div class=\"setting-row\"><div><label for=\"demoDensity\">列表间距</label><p>宽松便于阅读，紧凑容纳更多项目。</p></div><select id=\"demoDensity\"><option value=\"comfortable\">宽松</option><option value=\"compact\">紧凑</option></select></div>\n          <div class=\"settings-reading\"><h3>阅读预览</h3><p>资料各有归处，思路慢慢展开。把今天要做的事留在手边，也给下一步留一点空间。</p></div>\n        </section>\n        <section id=\"demo-data\" hidden aria-labelledby=\"dataHeading\">\n          <h2 id=\"dataHeading\" tabindex=\"-1\">数据与恢复</h2>\n          <div class=\"setting-row\"><div><h3>工作台记录</h3><p>便笺、任务、布局和设置保存在当前浏览器，备份包含这些个人记录。</p></div><span>本机保存</span></div>\n          <div class=\"setting-row\"><div><h3>备份与恢复</h3><p>正式便笺、任务和布局，继续由原来的备份与恢复管理。</p></div><button id=\"settingsBackup\" class=\"demo-secondary\">打开备份与恢复</button></div>\n          <div class=\"setting-row\"><div><h3>重新试用</h3><p>将显示偏好恢复为全部显示、浅色、18 px、宽松间距；保存后生效。</p></div><button id=\"demoReset\" class=\"demo-secondary\">恢复默认设置</button></div>\n        </section>\n      </div>\n    </section>\n    <footer id=\"demoSaveBar\" class=\"settings-save\"><p id=\"demoStatus\" role=\"status\" aria-live=\"polite\">尚未修改。</p><div><button id=\"demoCancel\" class=\"demo-secondary\" disabled>取消修改</button><button id=\"demoSave\" class=\"primary\" disabled>保存设置</button></div></footer>\n    </dialog>";
