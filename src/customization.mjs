import {
  THEMES,
  COLORS,
  initialPreferences,
  projectMetadata,
  visibleProjects,
  validateAppearance,
  agentHandoff,
  paletteIssues,
} from "./customization-core.mjs";
export function mountCustomization(api) {
  const $ = (id) => document.getElementById(id),
    make = (tag, text) => {
      const n = document.createElement(tag);
      if (text !== undefined) n.textContent = text;
      return n;
    };
  const panel = make("div");
  panel.className = "customization-tools";
  panel.innerHTML =
    '<button id="connectProject">接入项目</button><button id="layoutLibrary">布局模板</button><button id="appearanceButton">风格预览</button>';
  $("projectList").before(panel);
  const filters = make("div");
  filters.className = "project-filters";
  filters.innerHTML =
    '<input id="projectFilter" type="search" aria-label="筛选名称或标签" placeholder="找项目或标签…"><select id="projectGroup" aria-label="项目分组"><option value="">全部分组</option></select>';
  $("projectList").before(filters);
  const dialog = (id, title, markup) => {
    const d = make("dialog");
    d.id = id;
    d.setAttribute("aria-labelledby", id + "Title");
    d.innerHTML =
      '<header><h2 id="' +
      id +
      'Title">' +
      title +
      '</h2><button data-close="' +
      id +
      '">关闭</button></header>' +
      markup;
    document.body.append(d);
    return d;
  };
  const wizard = dialog(
    "projectWizard",
    "接入一个项目",
    '<p>填好信息后可打开原页试载，再生成配置。下载的配置需要保存为 config.local.json 并重启工作台；这里不会启动或修改项目服务。</p><form id="projectWizardForm"><label>唯一 ID<input name="id" required pattern="[a-z][a-z0-9-]{0,40}" maxlength="41" placeholder="my-project"></label><label>名称<input name="name" required maxlength="60"></label><label>地址<input name="url" required type="text" placeholder="http://127.0.0.1:5555/"></label><label>说明<input name="description" maxlength="300"></label><label>图标<select name="icon"><option value="book">阅读</option><option value="file">资料</option><option value="chart">数据</option><option value="chat">聊天</option><option value="grid">通用</option></select></label><label>分组<input name="group" maxlength="40"></label><label>标签（逗号分隔，最多8个）<input name="tags"></label><label class="checkline"><input name="pinned" type="checkbox">置顶项目</label><div class="button-row"><button type="button" id="trialProject">打开原页试载</button><button class="primary">生成配置预览</button></div></form><p id="wizardStatus" role="status"></p><pre id="configPreview" hidden></pre><button id="downloadConfig" disabled>下载配置</button>',
  );
  let pendingConfig = null;
  function candidate() {
    const form = $("projectWizardForm"),
      f = new FormData(form);
    if (!form.reportValidity()) throw Error("请完整填写项目信息");
    return {
      id: String(f.get("id")),
      name: String(f.get("name")).trim(),
      url: String(f.get("url")).trim(),
      description: String(f.get("description") || ""),
      icon: String(f.get("icon")),
      group: String(f.get("group") || ""),
      tags: String(f.get("tags") || "")
        .split(/[,，]/)
        .map((x) => x.trim())
        .filter(Boolean),
      pinned: f.get("pinned") === "on",
    };
  }
  function nextConfig() {
    const current = structuredClone(api.config());
    for (const p of current.projects) Object.assign(p, projectMeta(p.id));
    const p = candidate();
    return api.validateConfig({
      ...current,
      projects: [...current.projects, p],
    });
  }
  $("connectProject").onclick = () => {
    pendingConfig = null;
    $("configPreview").hidden = true;
    $("downloadConfig").disabled = true;
    $("wizardStatus").textContent = "";
    wizard.showModal();
  };
  $("projectWizardForm").addEventListener("input", () => {
    pendingConfig = null;
    $("downloadConfig").disabled = true;
    $("configPreview").hidden = true;
  });
  $("trialProject").onclick = () => {
    try {
      const config = nextConfig(),
        p = config.projects.at(-1);
      const opened = window.open(
        api.projectURL(p.url, location.origin).href,
        "_blank",
        "noopener,noreferrer",
      );
      $("wizardStatus").textContent =
        "已请求打开原页；请在新页确认服务和登录。此操作不证明页面能被嵌入。";
    } catch (e) {
      $("wizardStatus").textContent = e.message;
    }
  };
  $("projectWizardForm").onsubmit = (e) => {
    e.preventDefault();
    try {
      pendingConfig = nextConfig();
      $("configPreview").textContent = JSON.stringify(pendingConfig, null, 2);
      $("configPreview").hidden = false;
      $("downloadConfig").disabled = false;
      $("wizardStatus").textContent =
        "配置通过校验。下载后替换本机配置并重启工作台。";
    } catch (err) {
      $("wizardStatus").textContent = "未生成：" + err.message;
    }
  };
  $("downloadConfig").onclick = () => {
    if (pendingConfig) api.download(pendingConfig, "config.local.json");
  };
  const metadataDialog = dialog(
    "projectMetadataDialog",
    "项目分组与标签",
    '<form id="metadataForm"><label>分组<input name="group" maxlength="40"></label><label>标签（逗号分隔，最多8个）<input name="tags"></label><label class="checkline"><input name="pinned" type="checkbox">置顶</label><button class="primary">保存个人分类</button></form><p id="metadataStatus" role="status"></p>',
  );
  let metadataId;
  function prefs() {
    return api.state().preferences;
  }
  function projectMeta(id) {
    return Object.hasOwn(prefs().metadata, id)
      ? prefs().metadata[id]
      : projectMetadata(api.config().projects.find((p) => p.id === id));
  }
  function showMetadata(id) {
    metadataId = id;
    const m = projectMeta(id),
      form = $("metadataForm");
    form.elements.group.value = m.group;
    form.elements.tags.value = m.tags.join(", ");
    form.elements.pinned.checked = m.pinned;
    $("metadataStatus").textContent =
      "分类仅保存在本机个人记录，可通过备份导出。";
    metadataDialog.showModal();
  }
  function renderProjects() {
    const previous = $("projectGroup").value,
      groups = [
        ...new Set(
          api
            .config()
            .projects.map((p) => projectMeta(p.id).group)
            .filter(Boolean),
        ),
      ];
    $("projectGroup").replaceChildren();
    const all = make("option", "全部分组");
    all.value = "";
    $("projectGroup").append(all);
    for (const group of groups) {
      const o = make("option", group);
      o.value = group;
      $("projectGroup").append(o);
    }
    $("projectGroup").value = groups.includes(previous) ? previous : "";
    const visible = visibleProjects(
        api.config().projects,
        prefs(),
        $("projectFilter").value,
        $("projectGroup").value,
      ),
      shown = new Set(visible.map((p) => p.id));
    for (const p of api.config().projects) {
      const button = $("projectList").querySelector(
          '[data-open="' + p.id + '"]',
        ),
        row = button?.closest(".project-row");
      if (!row) continue;
      row.hidden = !shown.has(p.id);
      let labels = row.querySelector(".project-labels");
      if (!labels) {
        labels = make("div");
        labels.className = "project-labels";
        row.firstElementChild.append(labels);
      }
      labels.replaceChildren();
      const m = projectMeta(p.id);
      for (const label of [m.pinned ? "置顶" : "", m.group, ...m.tags].filter(
        Boolean,
      ))
        labels.append(make("span", label));
      if (!row.querySelector(".edit-metadata")) {
        row.classList.add("classified-project");
        const edit = make("button", "分类");
        edit.className = "edit-metadata";
        edit.setAttribute("aria-label", "编辑" + p.name + "分类");
        edit.onclick = () => showMetadata(p.id);
        row.append(edit);
      }
    }
    for (const p of visible) {
      const row = $("projectList")
        .querySelector('[data-open="' + p.id + '"]')
        ?.closest(".project-row");
      if (row) $("projectList").append(row);
    }
    let empty = $("projectFilterEmpty");
    if (!empty) {
      empty = make("p", "没有匹配项目。清空筛选或换一个分组。");
      empty.id = "projectFilterEmpty";
      $("projectList").after(empty);
    }
    empty.hidden = !!visible.length || !api.config().projects.length;
  }
  $("projectFilter").oninput = renderProjects;
  $("projectGroup").onchange = renderProjects;
  $("metadataForm").onsubmit = (e) => {
    e.preventDefault();
    try {
      const form = $("metadataForm");
      prefs().metadata[metadataId] = projectMetadata({
        group: form.elements.group.value,
        tags: form.elements.tags.value
          .split(/[,，]/)
          .map((x) => x.trim())
          .filter(Boolean),
        pinned: form.elements.pinned.checked,
      });
      const ok = api.persist();
      $("metadataStatus").textContent = ok
        ? "分类已保存。"
        : "分类仅在本次会话，记录未保存；请检查备份窗口。";
      renderProjects();
      if (ok) metadataDialog.close();
    } catch (err) {
      $("metadataStatus").textContent = err.message;
    }
  };
  const layouts = dialog(
    "layoutDialog",
    "我的布局模板",
    '<form id="layoutForm"><label>布局名称<input id="layoutName" required maxlength="40" placeholder="研究与资料并排"></label><p>选择要包含的项目：</p><div id="layoutChoices"></div><label>排列<select id="layoutDirection"><option value="horizontal">左右</option><option value="vertical">上下</option></select></label><button class="primary">保存模板</button></form><p id="layoutStatus" role="status"></p><div id="layoutList"></div>',
  );
  function renderLayouts() {
    $("layoutList").replaceChildren();
    for (const l of prefs().layouts) {
      const row = make("div");
      row.className = "layout-row";
      row.append(
        make("strong", l.name),
        make(
          "small",
          l.selection
            .map((id) => api.config().projects.find((p) => p.id === id).name)
            .join("＋"),
        ),
      );
      const open = make("button", "打开");
      open.onclick = () => {
        layouts.close();
        api.openLayout(l);
      };
      const rename = make("button", "重命名");
      rename.onclick = () => {
        const label = make("input");
        label.value = l.name;
        label.maxLength = 40;
        label.setAttribute("aria-label", "布局新名称");
        const form = make("form"),
          save = make("button", "保存"),
          cancel = make("button", "取消");
        cancel.type = "button";
        cancel.onclick = () => renderLayouts();
        save.type = "submit";
        form.append(label, save, cancel);
        form.onsubmit = (e) => {
          e.preventDefault();
          const name = label.value.trim();
          if (
            !name ||
            prefs().layouts.some((x) => x.id !== l.id && x.name === name)
          ) {
            $("layoutStatus").textContent = "名称不能为空或与其他模板相同";
            return;
          }
          l.name = name;
          const ok = api.persist();
          $("layoutStatus").textContent = ok ? "名称已保存" : "未保存到浏览器";
          renderLayouts();
        };
        row.replaceChildren(form);
        label.focus();
      };
      const remove = make("button", "删除");
      remove.onclick = () => {
        if (confirm("删除布局“" + l.name + "”？项目与便笺不受影响。")) {
          prefs().layouts = prefs().layouts.filter((x) => x.id !== l.id);
          const ok = api.persist();
          $("layoutStatus").textContent = ok
            ? "模板已删除"
            : "删除仅在本次会话，未保存到浏览器";
          renderLayouts();
        }
      };
      row.append(open, rename, remove);
      $("layoutList").append(row);
    }
    if (!prefs().layouts.length)
      $("layoutList").append(make("p", "还没有模板，选择项目后保存一个。"));
  }
  $("layoutLibrary").onclick = () => {
    $("layoutChoices").replaceChildren();
    for (const p of api.config().projects) {
      const label = make("label"),
        input = make("input");
      label.className = "checkline";
      input.type = "checkbox";
      input.value = p.id;
      input.checked = api.state().selection.includes(p.id);
      label.append(input, make("span", p.name));
      $("layoutChoices").append(label);
    }
    $("layoutDirection").value = api.state().direction;
    $("layoutStatus").textContent = "";
    renderLayouts();
    layouts.showModal();
  };
  $("layoutForm").onsubmit = (e) => {
    e.preventDefault();
    const name = $("layoutName").value.trim(),
      selection = [
        ...document.querySelectorAll("#layoutChoices input:checked"),
      ].map((x) => x.value);
    if (
      !name ||
      !selection.length ||
      prefs().layouts.length >= 12 ||
      prefs().layouts.some((l) => l.name === name)
    ) {
      $("layoutStatus").textContent =
        "需选择项目、填写唯一名称，最多保存12个模板。";
      return;
    }
    prefs().layouts.push({
      id:
        crypto.randomUUID?.() ??
        "layout-" +
          Date.now().toString(36) +
          "-" +
          Math.random().toString(36).slice(2, 10),
      name,
      selection,
      direction: $("layoutDirection").value,
      readingSize: api.state().readingSize,
    });
    const ok = api.persist();
    $("layoutStatus").textContent = ok
      ? "模板已保存"
      : "模板仅在本次会话，未保存到浏览器";
    $("layoutName").value = "";
    renderLayouts();
  };
  const appearance = dialog(
    "appearanceDialog",
    "风格预览",
    '<p>预览不会保存。确认后应用；关闭或取消会还原。自定义配色仅应用于浅色模式。</p><form id="appearanceForm"><label>主题<select id="appearanceTheme"><option value="">沿用项目配置主题</option><option value="song-paper">宋韵米纸</option><option value="modern-ink">清爽墨蓝</option></select></label><label>密度<select id="appearanceDensity"><option value="comfortable">舒适</option><option value="compact">紧凑</option></select></label><label>阅读字号<input id="appearanceSize" type="range" min="16" max="22" step="2"><output id="appearanceSizeLabel"></output></label><div id="colorFields"></div><button type="button" id="resetAppearance">还原为主题默认</button><p id="appearanceStatus" role="status"></p><div class="button-row"><button class="primary" id="applyAppearance">确认应用</button><button type="button" id="cancelAppearance">取消预览</button></div></form>',
  );
  let draft = null,
    draftSize = 18;
  function applyAppearance(
    value = prefs().appearance,
    size = api.state().readingSize,
  ) {
    $("themeSheet").href =
      "/themes/" + (value.themeName ?? api.config().theme) + ".css";
    document.body.dataset.density = value.density;
    for (const key of COLORS) {
      document.documentElement.style.removeProperty("--" + key);
      if (
        document.documentElement.dataset.theme !== "dark" &&
        value.colors[key]
      )
        document.documentElement.style.setProperty(
          "--" + key,
          value.colors[key],
        );
    }
    document.documentElement.style.setProperty("--reading-size", size + "px");
  }
  let colorCheckVersion = 0;
  const paletteCache = new Map();
  async function checkColors() {
    const version = ++colorCheckVersion;
    const target = structuredClone(draft ?? prefs().appearance);
    $("applyAppearance").disabled = true;
    $("appearanceStatus").textContent = "正在核验最终浅色配色…";
    try {
      const theme = target.themeName ?? api.config().theme;
      if (!paletteCache.has(theme)) {
        const response = await fetch("/themes/" + theme + ".css");
        if (!response.ok) throw Error("无法读取主题颜色");
        const css = await response.text(),
          root = css.match(/:root\s*\{([^}]+)\}/)?.[1];
        if (!root) throw Error("无法读取浅色主题变量");
        const palette = {};
        for (const match of root.matchAll(/--([a-z-]+)\s*:\s*([^;]+);/g))
          palette[match[1]] = match[2].trim();
        paletteCache.set(theme, palette);
      }
      const issues = paletteIssues({
        ...paletteCache.get(theme),
        ...target.colors,
      });
      if (version !== colorCheckVersion || !appearance.open) return false;
      const ok = !issues.length;
      for (const input of document.querySelectorAll(
        "#colorFields [data-color]",
      )) {
        const value =
          target.colors[input.dataset.color] ??
          paletteCache.get(theme)[input.dataset.color];
        if (/^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(value))
          input.value =
            value.length === 4
              ? "#" +
                value
                  .slice(1)
                  .split("")
                  .map((c) => c + c)
                  .join("")
              : value;
      }
      $("applyAppearance").disabled = !ok;
      $("appearanceStatus").textContent = ok
        ? "最终浅色配色符合4.5:1要求，包括正文、次要文字和强调色。"
        : "配色对比度不足：" + issues.join("、");
      return ok;
    } catch (error) {
      if (version === colorCheckVersion && appearance.open)
        $("appearanceStatus").textContent = error.message;
      return false;
    }
  }
  function colorInputs() {
    $("colorFields").replaceChildren();
    const defaults = getComputedStyle(document.documentElement);
    for (const key of COLORS) {
      const label = make(
          "label",
          {
            ground: "米纸底色",
            surface: "纸面底色",
            text: "正文颜色",
            muted: "次要文字",
            accent: "操作强调色",
          }[key],
        ),
        input = make("input");
      input.type = "color";
      input.dataset.color = key;
      input.value =
        draft.colors[key] ?? defaults.getPropertyValue("--" + key).trim();
      input.oninput = () => {
        draft.colors[key] = input.value;
        applyAppearance(draft, draftSize);
        checkColors();
      };
      label.append(input);
      $("colorFields").append(label);
    }
  }
  $("appearanceButton").onclick = () => {
    draft = structuredClone(prefs().appearance);
    draftSize = api.state().readingSize;
    $("appearanceTheme").value = draft.themeName ?? "";
    $("appearanceDensity").value = draft.density;
    $("appearanceSize").value = draftSize;
    $("appearanceSizeLabel").textContent = draftSize;
    colorInputs();
    appearance.showModal();
    checkColors();
  };
  $("appearanceTheme").onchange = () => {
    draft.themeName = $("appearanceTheme").value || null;
    draft.colors = {};
    applyAppearance(draft, draftSize);
    $("themeSheet").addEventListener(
      "load",
      () => {
        if (appearance.open) {
          colorInputs();
          checkColors();
        }
      },
      { once: true },
    );
  };
  $("appearanceDensity").onchange = () => {
    draft.density = $("appearanceDensity").value;
    applyAppearance(draft, draftSize);
  };
  $("appearanceSize").oninput = () => {
    draftSize = Number($("appearanceSize").value);
    $("appearanceSizeLabel").textContent = draftSize;
    applyAppearance(draft, draftSize);
  };
  $("resetAppearance").onclick = () => {
    draft = { themeName: draft.themeName, density: "comfortable", colors: {} };
    draftSize = 18;
    $("appearanceDensity").value = "comfortable";
    $("appearanceSize").value = 18;
    $("appearanceSizeLabel").textContent = 18;
    applyAppearance(draft, draftSize);
    colorInputs();
    checkColors();
  };
  $("appearanceForm").onsubmit = async (e) => {
    e.preventDefault();
    if (!(await checkColors())) return;
    prefs().appearance = validateAppearance(draft);
    api.state().readingSize = draftSize;
    const ok = api.persist();
    api.syncReading();
    draft = null;
    appearance.close();
    $("noteStatus").textContent = ok
      ? "风格已保存；个人记录保持不变。"
      : "风格仅在本次会话，未保存到浏览器。";
  };
  $("cancelAppearance").onclick = () => appearance.close();
  appearance.addEventListener("close", () => {
    colorCheckVersion++;
    draft = null;
    applyAppearance();
    $("appearanceButton").focus();
  });
  new MutationObserver(() =>
    applyAppearance(
      appearance.open && draft ? draft : prefs().appearance,
      appearance.open ? draftSize : api.state().readingSize,
    ),
  ).observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-theme"],
  });
  const agentArea = make("section");
  agentArea.innerHTML =
    '<label>想交给 Agent 的定制要求<textarea id="agentBrief" maxlength="2000" placeholder="只写风格和布局偏好，不填私人地址或凭据。"></textarea></label><p>输入的要求会原样导出；项目真实名称、地址和便笺默认不包含。</p><button id="previewAgentPack">生成交接包预览</button><pre id="agentPackPreview" hidden></pre><button id="downloadAgentPack" disabled>下载交接包</button>';
  $("guideDialog").append(agentArea);
  let pack = null;
  $("agentBrief").value = prefs().brief;
  function invalidateAgentPack() {
    pack = null;
    $("downloadAgentPack").disabled = true;
    $("agentPackPreview").hidden = true;
  }
  $("agentBrief").oninput = invalidateAgentPack;
  $("agentGuide").addEventListener("click", () => {
    $("agentBrief").value = prefs().brief;
    invalidateAgentPack();
  });
  $("previewAgentPack").onclick = () => {
    prefs().brief = $("agentBrief").value;
    pack = agentHandoff(api.config(), api.state());
    $("agentPackPreview").textContent = JSON.stringify(pack, null, 2);
    $("agentPackPreview").hidden = false;
    $("downloadAgentPack").disabled = false;
    api.persist();
  };
  $("downloadAgentPack").onclick = () => {
    if (!pack) return;
    if (
      JSON.stringify(pack) !==
      JSON.stringify(agentHandoff(api.config(), api.state()))
    ) {
      invalidateAgentPack();
      $("copyStatus").textContent = "定制设置已变化，请重新生成交接包预览。";
      return;
    }
    api.download(pack, "yifang-agent-handoff.json");
  };
  api.onRestore(() => {
    draft = null;
    applyAppearance();
    renderProjects();
    $("agentBrief").value = prefs().brief;
    invalidateAgentPack();
  });
  applyAppearance();
  renderProjects();
}
