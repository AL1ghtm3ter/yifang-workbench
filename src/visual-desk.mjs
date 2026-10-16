import { safeTaskLink, openingMode } from "./core.mjs";
import { visibleProjects } from "./customization-core.mjs";
// Only shell records and explicitly registered project metadata are visualized.
export function mountVisualDesk(api) {
  const $ = (id) => document.getElementById(id);
  const node = (tag, text, cls) => {
    const n = document.createElement(tag);
    if (text !== undefined) n.textContent = text;
    if (cls) n.className = cls;
    return n;
  };
  const button = (text, run) => {
    const b = node("button", text);
    b.type = "button";
    b.onclick = run;
    return b;
  };
  const section = node("section", undefined, "visual-desk");
  section.id = "visualDesk";
  section.append(
    node("h2", "把手边的事看清楚"),
    node("p", "项目之间的联系、下一步与阅读空间，都在这里。", "visual-intro"),
  );
  const tabs = node("div", undefined, "visual-switch");
  const surfaces = {};
  let current = "map",
    editId = null,
    selectedProject = null;
  const labels = { map: "项目地图", tasks: "任务接续", layouts: "布局预览" };
  for (const [id, label] of Object.entries(labels)) {
    const b = button(label, () => {
      current = id;
      paintTabs();
      refresh();
    });
    b.dataset.visualTab = id;
    b.setAttribute("aria-controls", "visual-" + id);
    b.setAttribute("aria-expanded", String(id === current));
    tabs.append(b);
    const s = node("div", undefined, "visual-surface");
    s.id = "visual-" + id;
    s.hidden = id !== current;
    surfaces[id] = s;
  }
  section.append(tabs, ...Object.values(surfaces));
  document.querySelector("#homeView .columns").before(section);
  const notice = node("p", "", "visual-notice");
  notice.id = "visualNotice";
  notice.setAttribute("role", "status");
  section.append(notice);
  function save(message) {
    const ok = api.persist();
    notice.textContent = ok
      ? message
      : "本次修改尚未保存，请先检查个人记录备份。";
    return ok;
  }
  function paintTabs() {
    for (const b of tabs.children) {
      const active = b.dataset.visualTab === current;
      b.setAttribute("aria-expanded", String(active));
      b.classList.toggle("active", active);
    }
    for (const [id, s] of Object.entries(surfaces)) s.hidden = id !== current;
  }
  const evidence = new Map();
  const details = node("section", undefined, "connection-sheet");
  details.id = "connectionSheet";
  details.hidden = true;
  details.setAttribute("aria-labelledby", "connectionTitle");
  section.append(details);
  function inspect(id) {
    selectedProject = id;
    details.hidden = false;
    paintEvidence();
    details.querySelector("button").focus();
  }
  function paintEvidence() {
    if (!selectedProject) return;
    const p = api.config().projects.find((p) => p.id === selectedProject),
      e = evidence.get(p.id);
    details.replaceChildren();
    const top = node("div", undefined, "section-head");
    const heading = node("h3", p.name + " · 连接说明");
    heading.id = "connectionTitle";
    top.append(
      heading,
      button("收起", () => {
        details.hidden = true;
        section.querySelector('[data-inspect="' + p.id + '"]')?.focus();
      }),
    );
    details.append(top);
    const flow = node("ol", undefined, "connection-flow");
    for (const [title, description] of [
      ["已登记", "地址来自你的本机配置"],
      [
        "页面载入",
        e?.loaded ? "浏览器触发载入事件；不代表内容可用" : "本次会话尚未载入",
      ],
      [
        "协议响应",
        e?.ready
          ? "项目已回应工作台协议；不代表登录或业务成功"
          : "尚未收到就绪报告，状态未知",
      ],
    ]) {
      const item = node("li");
      item.append(node("strong", title), node("span", description));
      flow.append(item);
    }
    details.append(flow);
    const dl = node("dl", undefined, "connection-facts");
    for (const [term, value] of [
      ["接入地址", p.url],
      ["独立原页", p.originalUrl ?? p.url],
      ["来源说明", p.description],
      [
        "登记类型",
        {
          live: "实时服务（配置声明）",
          snapshot: "研究快照",
          unknown: "未知来源",
        }[p.sourceType ?? "unknown"],
      ],
      ["快照日期", p.snapshotDate ?? "未声明"],
      [
        "最后协议响应",
        e?.ready ? new Date(e.ready).toLocaleString("zh-CN") : "尚无证据",
      ],
    ]) {
      dl.append(node("dt", term), node("dd", value));
    }
    details.append(dl);
    details.append(
      node(
        "p",
        "快照基线以来源说明和原页为准。重试会重新载入页面，未保存的内容可能丢失。工作台不探测登录状态。",
      ),
    );
    const actions = node("div", undefined, "visual-actions");
    const a = node("a", "打开独立原页");
    a.href = p.originalUrl ?? p.url;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    actions.append(
      a,
      button("在工作区查看", () => api.openProjects([p.id], true, false)),
      button("重试载入", () => {
        const f = api.frames.get(p.id);
        if (!f) {
          api.openProjects([p.id], true, false);
          return;
        }
        evidence.delete(p.id);
        f.frame.src = f.frame.src;
        paintEvidence();
        notice.textContent = "已请求重新载入；独立项目中未保存的内容可能丢失。";
      }),
    );
    details.append(actions);
    const modeLabel = node("label", "默认打开方式"),
      mode = node("select");
    mode.id = "projectOpenMode";
    for (const [value, text] of [
      ["embed", "工作区嵌入"],
      ["tab", "独立新标签"],
      ["copy", "复制原页链接"],
    ]) {
      const o = node("option", text);
      o.value = value;
      mode.append(o);
    }
    mode.value = openingMode(api.state(),p.id);
    modeLabel.append(mode);
    details.append(
      modeLabel,
      button("保存打开方式", () => {
        const value = mode.value;
        api.checkpoint("修改打开方式");
        api.state().openModes[p.id] = value;
        save("默认打开方式已保存。");
      }),
    );
  }
  function paintMap() {
    const area = surfaces.map;
    area.replaceChildren();
    const root = node("div", undefined, "map-root");
    root.append(
      node("strong", api.config().title),
      node("span", "入口与阅读偏好 · 仅保存在本机"),
    );
    area.append(root);
    const branches = node("div", undefined, "project-branches");
    for (const p of visibleProjects(api.config().projects, api.state().preferences)) {
      const item = node("article", undefined, "map-project");
      item.append(node("h3", p.name), node("p", p.description));
      const e = evidence.get(p.id);
      item.append(
        node(
          "small",
          e?.ready
            ? "本次会话 · 协议已响应"
            : e?.loaded
              ? "本次会话 · 页面载入"
              : "已登记 · 尚未查看",
        ),
      );
      const actions = node("div", undefined, "visual-actions");
      const inspectButton = button("连接说明", () => inspect(p.id));
      inspectButton.dataset.inspect = p.id;
      actions.append(
        button("进入", () => api.openProjects([p.id])),
        inspectButton,
      );
      item.append(actions);
      branches.append(item);
    }
    area.append(branches);
    if (!visibleProjects(api.config().projects, api.state().preferences).length)
      area.append(node("p", "暂无显示的项目。可在设置中恢复显示或接入新项目。"));
  }
  const editor = node("form", undefined, "task-editor");
  editor.id = "taskEditor";
  editor.hidden = true;
  function field(labelText, id, tag, max) {
    const label = node("label", labelText),
      input = node(tag);
    input.id = id;
    input.maxLength = max;
    label.append(input);
    editor.append(label);
    return input;
  }
  const title = field("这件事叫什么", "taskTitle", "input", 80);
  title.required = true;
  const next = field("做到哪了，下一步做什么", "taskNext", "textarea", 600);
  next.rows = 3;
  const linkLabel = field("停靠位置名称（可选）", "taskLinkLabel", "input", 60);
  const linkURL = field(
    "材料页或论文页地址（可选，属于已登记项目）",
    "taskLinkURL",
    "input",
    2000,
  );
  const linkProjectLabel = node("label", "停靠链接所属项目"),
    linkProject = node("select");
  linkProject.id = "taskLinkProject";
  for (const p of api.config().projects) {
    const o = node("option", p.name);
    o.value = p.id;
    linkProject.append(o);
  }
  linkProjectLabel.append(linkProject);
  editor.append(linkProjectLabel);
  const choices = node("fieldset");
  choices.append(node("legend", "关联项目"));
  editor.append(choices);
  for (const p of api.config().projects) {
    const l = node("label", undefined, "checkline"),
      input = node("input");
    input.type = "checkbox";
    input.value = p.id;
    l.append(input, node("span", p.name));
    choices.append(l);
  }
  const statusLabel = node("label", "任务位置"),
    status = node("select");
  status.id = "taskState";
  for (const [value, text] of [
    ["active", "正在做"],
    ["paused", "稍后再做"],
    ["done", "我已完成"],
  ]) {
    const o = node("option", text);
    o.value = value;
    status.append(o);
  }
  statusLabel.append(status);
  editor.append(statusLabel);
  const formActions = node("div", undefined, "visual-actions"),
    submit = node("button", "保存这件事");
  submit.type = "submit";
  formActions.append(
    submit,
    button("取消", () => {
      editor.hidden = true;
      section.querySelector("#newTask").focus();
    }),
  );
  editor.append(formActions);
  function edit(task) {
    editId = task?.id ?? null;
    title.value = task?.title ?? "";
    next.value = task?.next ?? "";
    status.value = task?.status ?? "active";
    linkLabel.value = task?.links?.[0]?.label ?? "";
    linkURL.value = task?.links?.[0]?.url ?? "";
    linkProject.value =
      task?.links?.[0]?.projectId ??
      task?.projects?.[0] ??
      api.config().projects[0]?.id ??
      "";
    for (const input of choices.querySelectorAll("input"))
      input.checked = task
        ? task.projects.includes(input.value)
        : api.state().selection.includes(input.value);
    editor.hidden = false;
    title.focus();
  }
  editor.onsubmit = (e) => {
    e.preventDefault();
    const projects = [...choices.querySelectorAll("input:checked")].map(
      (i) => i.value,
    );
    if (!projects.length) {
      notice.textContent = "至少关联一个项目，再保存这件事。";
      return;
    }
    const tasks = api.state().tasks;
    if (!editId && tasks.length >= 12) {
      notice.textContent = "最多保留12件事，请先整理现有记录。";
      return;
    }
    const task = {
      id: editId ?? crypto.randomUUID(),
      title: title.value.trim(),
      next: next.value,
      projects,
      status: status.value,
    };
    try {
      if (linkURL.value.trim()) {
        const link = {
          projectId: linkProject.value,
          label: linkLabel.value.trim() || "停靠位置",
          url: linkURL.value.trim(),
        };
        if (!projects.includes(link.projectId))
          throw Error("请勾选停靠链接所属项目");
        link.url = safeTaskLink(link, api.config().projects, location.origin);
        task.links = [link];
      }
    } catch (err) {
      notice.textContent = err.message;
      return;
    }
    if (!task.title) return;
    api.checkpoint(editId ? "编辑任务" : "新增任务");
    const index = tasks.findIndex((t) => t.id === editId);
    if (index < 0) tasks.push(task);
    else tasks[index] = task;
    const ok = save("任务已留在这张桌面。");
    if (ok) editor.hidden = true;
    paintTasks();
  };
  function paintTasks() {
    const area = surfaces.tasks;
    area.replaceChildren();
    const newButton = button("记下下一步", () => edit());
    newButton.id = "newTask";
    newButton.disabled = !api.config().projects.length;
    area.append(newButton);
    const board = node("div", undefined, "task-board");
    for (const [value, label] of [
      ["active", "正在做"],
      ["paused", "稍后再做"],
      ["done", "我已完成"],
    ]) {
      const lane = node("section", undefined, "task-lane");
      lane.append(node("h3", label));
      const tasks = api.state().tasks.filter((t) => t.status === value);
      if (!tasks.length) lane.append(node("p", "还没有记录", "task-empty"));
      for (const t of tasks) {
        const entry = node("article", undefined, "task-entry");
        entry.append(
          node("h4", t.title),
          node("p", t.next || "留下一步，回来时更容易继续。"),
          node(
            "small",
            t.projects
              .map((id) => api.config().projects.find((p) => p.id === id).name)
              .join(" · "),
          ),
        );
        const actions = node("div", undefined, "visual-actions");
        for (const link of t.links ?? []) {
          try {
            const a = node("a", "停靠：" + link.label);
            a.href = safeTaskLink(link, api.config().projects, location.origin);
            a.target = "_blank";
            a.rel = "noopener noreferrer";
            actions.append(a);
          } catch {
            actions.append(node("span", "停靠来源已变化，请编辑链接。"));
          }
        }
        actions.append(
          button("继续这件事", () => api.openProjects(t.projects)),
          button("编辑", () => edit(t)),
          button("移除", () => {
            const index = api.state().tasks.findIndex((x) => x.id === t.id);
            api.checkpoint("移除任务");
            api.state().tasks = api.state().tasks.filter((x) => x.id !== t.id);
            save("已移除任务。");
            paintTasks();
            const undo = button("撤销移除", () => {
              if (
                api.state().tasks.length >= 12 ||
                api.state().tasks.some((x) => x.id === t.id)
              ) {
                notice.textContent = "任务已存在或记录已满，无法撤销。";
                return;
              }
              api.state().tasks.splice(index, 0, t);
              save("已恢复任务。");
              paintTasks();
            });
            notice.append(undo);
          }),
        );
        entry.append(actions);
        lane.append(entry);
      }
      board.append(lane);
    }
    area.append(board, editor);
  }
  function miniature(direction, count, ratio = 50) {
    const pic = node("div", undefined, "layout-mini " + direction);
    pic.setAttribute("aria-hidden", "true");
    pic.style.setProperty("--split", ratio + "%");
    for (let i = 0; i < Math.min(count, 4); i++) pic.append(node("span"));
    return pic;
  }
  function paintLayouts() {
    const area = surfaces.layouts;
    area.replaceChildren();
    area.append(
      node("p", "先看阅读空间，再打开项目。模板仍在「布局模板」中管理。"),
    );
    const gallery = node("div", undefined, "layout-gallery");
    const projects = api.config().projects;
    const visible = visibleProjects(projects, api.state().preferences);
    const defaults = [
      {
        name: "一页专注",
        selection: visible.slice(0, 1).map((p) => p.id),
        direction: "horizontal",
      },
      {
        name: "左右对照",
        selection: visible.slice(0, 2).map((p) => p.id),
        direction: "horizontal",
      },
      {
        name: "上下阅读",
        selection: projects.slice(0, 2).map((p) => p.id),
        direction: "vertical",
      },
    ];
    for (const l of [...defaults, ...api.state().preferences.layouts]) {
      if (l.selection.some(id => !visible.some(p => p.id === id))) continue;
      const b = button("", () => {
        api.state().direction = l.direction;
        api.state().splitRatio = l.splitRatio ?? 50;
        api.openProjects(l.selection, true, false);
      });
      b.className = "layout-choice";
      b.disabled = !l.selection.length;
      b.append(
        miniature(l.direction, l.selection.length, l.splitRatio),
        node("strong", l.name),
        node(
          "small",
          (l.selection.length > 4
            ? l.selection.length + "个项目 · 缩略图展示前4格 · "
            : "") +
            l.selection
              .map((id) => projects.find((p) => p.id === id).name)
              .join(" / ") || "尚无项目",
        ),
      );
      gallery.append(b);
    }
    area.append(gallery);
  }
  const stage = $("stage"),
    split = node("div", undefined, "split-handle");
  split.id = "splitHandle";
  split.tabIndex = 0;
  split.setAttribute("role", "separator");
  split.setAttribute("aria-orientation", "vertical");
  split.setAttribute("aria-label", "调整左右项目比例");
  split.setAttribute("aria-valuemin", "25");
  split.setAttribute("aria-valuemax", "75");
  stage.append(split);
  const controls = node("div", undefined, "split-controls");
  controls.id = "splitControls";
  controls.append(node("span", "阅读空间"));
  const output = node("output");
  output.id = "splitOutput";
  controls.append(
    output,
    button("平分", () => setRatio(50)),
  );
  document.querySelector(".workspace-tools").append(controls);
  function applyRatio() {
    const available =
      api.state().selection.length === 2 &&
      api.state().direction === "horizontal" &&
      !document.body.classList.contains("pane-focused");
    split.hidden = !available;
    controls.hidden = !available;
    stage.classList.toggle("adjustable", available);
    const r = api.state().splitRatio;
    stage.style.setProperty("--split", r + "%");
    split.setAttribute("aria-valuenow", String(r));
    split.setAttribute("aria-valuetext", r + "比" + (100 - r));
    output.textContent = r + " : " + (100 - r);
  }
  function setRatio(value, persist = true) {
    api.state().splitRatio = Math.max(25, Math.min(75, Math.round(value)));
    applyRatio();
    if (persist) save("阅读比例已保存。");
  }
  split.onkeydown = (e) => {
    if (["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)) {
      e.preventDefault();
      setRatio(
        e.key === "Home"
          ? 25
          : e.key === "End"
            ? 75
            : api.state().splitRatio + (e.key === "ArrowRight" ? 5 : -5),
      );
    }
  };
  let dragging = false;
  split.onpointerdown = (e) => {
    if (e.button !== 0) return;
    dragging = true;
    split.setPointerCapture(e.pointerId);
    stage.classList.add("resizing");
  };
  split.onpointermove = (e) => {
    if (dragging) {
      const rect = stage.getBoundingClientRect();
      setRatio(((e.clientX - rect.left) / rect.width) * 100, false);
    }
  };
  function finish() {
    if (dragging) {
      dragging = false;
      stage.classList.remove("resizing");
      save("阅读比例已保存。");
    }
  }
  split.onpointerup = finish;
  split.onpointercancel = finish;
  split.onlostpointercapture = finish;
  function refresh() {
    paintMap();
    paintTasks();
    paintLayouts();
    applyRatio();
    if (!details.hidden) paintEvidence();
    for (const [id, f] of api.frames) {
      if (!f.frame.dataset.visualObserved) {
        f.frame.dataset.visualObserved = "true";
        f.frame.addEventListener("load", () => {
          evidence.set(id, {
            ...evidence.get(id),
            loaded: Date.now(),
          });
          paintMap();
          if (!details.hidden) paintEvidence();
        });
        new MutationObserver(() => {
          evidence.delete(id);
          paintMap();
          if (!details.hidden) paintEvidence();
        }).observe(f.frame, { attributes: true, attributeFilter: ["src"] });
        const b = button("连接说明", () => {
          document.querySelector("#homeButton").click();
          inspect(id);
          details.scrollIntoView({ block: "nearest" });
        });
        f.pane.querySelector(".pane-actions").prepend(b);
      }
    }
  }
  const observer = new MutationObserver(applyRatio);
  observer.observe(document.body, {
    attributes: true,
    attributeFilter: ["class"],
  });
  refresh();
  return {
    refresh,
    ready(id) {
      evidence.set(id, { ...evidence.get(id), ready: Date.now() });
      paintMap();
      if (!details.hidden) paintEvidence();
    },
  };
}
