import { recordIds } from "./core.mjs";
export function mountPersonalDesk(api) {
  const node = (tag, text) => {
    const n = document.createElement(tag);
    if (text !== undefined) n.textContent = text;
    return n;
  };
  const button = (text, run) => {
    const b = node("button", text);
    b.type = "button";
    b.onclick = run;
    return b;
  };
  const section = node("section");
  section.id = "personalDesk";
  section.className = "personal-desk";
  const toggle = button("桌面与记录", () => {
    section.hidden = !section.hidden;
    toggle.setAttribute("aria-expanded", String(!section.hidden));
    if (!section.hidden) {
      refresh();
      section.scrollIntoView({ block: "start" });
    }
  });
  toggle.id = "personalDeskButton";
  toggle.setAttribute("aria-controls", "personalDesk");
  toggle.setAttribute("aria-expanded", "false");
  document.querySelector(".visual-switch").append(toggle);
  section.hidden = true;
  document.querySelector("#visualDesk").append(section);
  section.append(node("h3", "桌面与记录"));
  const message = node("p");
  message.id = "personalStatus";
  message.setAttribute("role", "status");
  const form = node("form");
  form.id = "deskForm";
  form.className = "task-editor";
  const nameLabel = node("label", "桌面称谓（留空使用默认）"),
    name = node("input");
  name.id = "deskName";
  name.maxLength = 40;
  nameLabel.append(name);
  const inscriptionLabel = node("label", "案头题签（留空使用默认）"),
    inscription = node("input");
  inscription.id = "deskInscription";
  inscription.maxLength = 160;
  inscriptionLabel.append(inscription);
  const submit = node("button", "保存题签");
  submit.type = "submit";
  form.append(nameLabel, inscriptionLabel, submit);
  form.onsubmit = (e) => {
    e.preventDefault();
    api.checkpoint("修改个人题签");
    api.state().desk = {
      name: name.value.trim(),
      inscription: inscription.value.trim(),
    };
    const ok = api.persist();
    message.textContent = ok
      ? "题签已保存。"
      : "未保存，请先核对或导出原记录。";
    applyDesk();
  };
  section.append(form);
  const history = node("div");
  history.className = "personal-history";
  const undo = button("撤销上一步", () => {
    message.textContent = api.undoChange()
      ? "已撤销，独立项目不受影响。"
      : "记录已变化或保存被保护，未执行撤销。";
    refresh();
  });
  undo.id = "undoChange";
  const undoLabel = node("span");
  undoLabel.id = "undoLabel";
  history.append(undo, undoLabel);
  section.append(history);
  const quickUndo = button("撤销上一步", () => {
    message.textContent = api.undoChange()
      ? "已撤销。"
      : "记录已有后续变化，未覆盖。";
    refresh();
  });
  quickUndo.id = "quickUndo";
  quickUndo.hidden = true;
  document.querySelector(".visual-switch").after(quickUndo);
  const migration = node("section");
  migration.id = "migrationPanel";
  section.append(migration);
  const inputLabel = node("label", "核对另一份旧备份"),
    input = node("input");
  input.id = "migrationFile";
  input.type = "file";
  input.accept = ".json,application/json";
  inputLabel.append(input);
  section.append(inputLabel);
  input.onchange = async () => {
    const file = input.files[0];
    if (!file) return;
    try {
      if (file.size > 500000) throw Error("备份过大");
      api.setPending(JSON.parse(await file.text()));
      migrationPaint();
      message.textContent = "尚未替换记录。逐项核对，再预览确认。";
    } catch (e) {
      message.textContent = "不能核对：" + e.message;
    }
  };
  const archiveArea = node("section");
  archiveArea.id = "archiveList";
  section.append(archiveArea, message);
  let mappings = {},
    draft = null;
  function applyDesk() {
    const s = api.state().desk,
      c = api.config();
    document.title = s.name || c.title;
    document.getElementById("brandTitle").textContent = s.name || c.title;
    if (document.getElementById("homeView").hidden === false)
      document.getElementById("viewTitle").textContent = s.name || c.title;
    document.getElementById("subtitle").textContent =
      s.inscription || c.subtitle;
  }
  function migrationPaint() {
    migration.replaceChildren();
    const pending = api.pending();
    if (!pending) {
      migration.append(
        node(
          "p",
          "当前没有待核对的旧记录。下次配置改名、换ID或移除时，旧记录会受保护。",
        ),
      );
      return;
    }
    migration.append(
      node("h4", "配置变化核对"),
      node(
        "p",
        "确认将替换当前工作台记录，独立项目不受影响。核对前记录会留作归档。",
      ),
    );
    const projects = api.config().projects,
      missing = recordIds(pending).filter(
        (id) => !projects.some((p) => p.id === id),
      );
    mappings = {};
    draft = null;
    const oldNames = new Map(
      (pending.registry ?? []).map((p) => [p.id, p.name]),
    );
    for (const id of missing) {
      const label = node(
          "label",
          "旧项目：" + (oldNames.get(id) || id) + " (" + id + ")",
        ),
        select = node("select");
      select.dataset.migration = id;
      const placeholder = node("option", "请选择映射或归档");
      placeholder.value = "";
      select.append(placeholder);
      const archive = node("option", "保留在归档");
      archive.value = "archive";
      select.append(archive);
      for (const p of projects) {
        const option = node("option", "映射到 " + p.name);
        option.value = p.id;
        select.append(option);
      }
      select.onchange = () => {
        if (!select.value) delete mappings[id];
        else mappings[id] = select.value === "archive" ? null : select.value;
        draft = null;
        confirm.disabled = true;
        preview.textContent = "";
      };
      label.append(select);
      migration.append(label);
    }
    const changes = node("ul");
    for (const old of pending.registry ?? []) {
      const now = projects.find((p) => p.id === old.id);
      if (now && (now.name !== old.name || now.url !== old.url))
        changes.append(
          node(
            "li",
            old.name +
              " → " +
              now.name +
              "：名称或接入地址已改变；停靠链接保留原地址，打开时仍需匹配来源。",
          ),
        );
    }
    for (const p of projects)
      if (!(pending.registry ?? []).some((old) => old.id === p.id))
        changes.append(node("li", "当前登记：" + p.name));
    migration.append(changes);
    const preview = node("p");
    preview.id = "migrationPreview";
    preview.setAttribute("role", "status");
    const confirm = button("确认核对并保存归档", () => {
      try {
        if (!draft) throw Error("请先预览");
        api.commitMigration(mappings);
        draft = null;
        message.textContent = "核对完成。原记录可在下方下载。";
        refresh();
      } catch (e) {
        message.textContent = "未替换：" + e.message;
      }
    });
    confirm.id = "confirmMigration";
    confirm.disabled = true;
    const previewButton = button("预览核对结果", () => {
      try {
        draft = api.migrationPreview(mappings);
        preview.textContent =
          "确认后保留：" +
          draft.tasks.length +
          "件任务、" +
          draft.preferences.layouts.length +
          "个布局、" +
          draft.note.length +
          "字便笺；原记录将归档。";
        confirm.disabled = false;
      } catch (e) {
        draft = null;
        confirm.disabled = true;
        preview.textContent = "未核对：" + e.message;
      }
    });
    previewButton.id = "previewMigration";
    migration.append(
      previewButton,
      preview,
      confirm,
      button("下载待核对原记录", () =>
        api.download(api.pending(), "yifang-before-migration.json"),
      ),
    );
  }
  function refresh() {
    applyDesk();
    if (document.activeElement !== name) name.value = api.state().desk.name;
    if (document.activeElement !== inscription)
      inscription.value = api.state().desk.inscription;
    const last = api.undoStack().at(-1);
    undo.disabled =
      !last || !last.after || last.after !== JSON.stringify(api.state());
    quickUndo.hidden = undo.disabled;
    quickUndo.textContent = last ? "撤销：" + last.label : "撤销上一步";
    undoLabel.textContent = last ? "最近操作：" + last.label : "";
    migrationPaint();
    archiveArea.replaceChildren(node("h4", "核对前归档"));
    for (const [i, a] of api.state().archives.entries()) {
      const row = node("div");
      row.append(
        node(
          "span",
          a.label + " · " + new Date(a.createdAt).toLocaleString("zh-CN"),
        ),
        button("下载归档", () =>
          api.download(a.raw, "yifang-archive-" + (i + 1) + ".json"),
        ),
        button("移除本机归档", () => {
          if (!confirm("归档移除后只能通过已下载文件找回。确认移除？")) return;
          api.checkpoint("移除归档");
          api.state().archives.splice(i, 1);
          api.persist();
          refresh();
        }),
      );
      archiveArea.append(row);
    }
    if (!api.state().archives.length)
      archiveArea.append(node("p", "还没有归档。归档只包含你的工作台记录。"));
  }
  refresh();
  return {
    refresh,
    notify(text) {
      message.textContent = text;
      document.getElementById("visualNotice").textContent = text;
    },
  };
}
