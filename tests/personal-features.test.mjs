import test from "node:test";
import assert from "node:assert/strict";
import {
  initialState,
  validateState,
  migrateRecord,
  safeTaskLink,
  validateConfig,
  openingMode,
} from "../src/core.mjs";
const ids = ["old", "stay"];
function old() {
  const s = initialState();
  s.note = "必须保留的笔记";
  s.registry = [
    { id: "old", name: "旧项目", url: "http://localhost:6000" },
    { id: "stay", name: "保留项目", url: "http://localhost:7000" },
  ];
  s.selection = ["old"];
  s.recent = ["old", "stay"];
  s.openModes = { old: "tab" };
  s.preferences.metadata = {
    old: { group: "研究", tags: ["资料"], pinned: true },
  };
  s.tasks = [
    {
      id: "task-1",
      title: "核对资料",
      next: "读第二页",
      status: "active",
      projects: ["old"],
      links: [
        {
          projectId: "old",
          label: "第二页",
          url: "http://localhost:6000/paper#two",
        },
      ],
    },
  ];
  s.preferences.layouts = [
    {
      id: "layout-1",
      name: "继续阅读",
      selection: ["old", "stay"],
      direction: "horizontal",
      readingSize: 18,
      splitRatio: 65,
    },
  ];
  return s;
}
test("explicit ID migration preserves task links, notes, layouts and archive", () => {
  const s = old(),
    next = migrateRecord(s, ["new", "stay"], { old: "new" });
  assert.equal(next.note, s.note);
  assert.deepEqual(next.tasks[0].projects, ["new"]);
  assert.equal(next.tasks[0].links[0].projectId, "new");
  assert.equal(next.preferences.layouts[0].splitRatio, 65);
  assert.equal(next.openModes.new, "tab");
  assert.equal(JSON.parse(next.archives[0].raw).tasks[0].projects[0], "old");
  assert.equal(s.tasks[0].projects[0], "old");
});
test("archiving removed projects preserves old record without live dangling refs", () => {
  const next = migrateRecord(old(), ["stay"], { old: null });
  assert.deepEqual(next.tasks, []);
  assert.deepEqual(next.preferences.layouts[0].selection, ["stay"]);
  assert.equal(JSON.parse(next.archives[0].raw).note, "必须保留的笔记");
  assert.throws(() => migrateRecord(old(), ["new", "stay"], {}));
  assert.throws(() => migrateRecord(old(), ["stay"], { old: "stay" }));
});
test("migration archive capacity is bounded and malformed records remain rejected", () => {
  const s = old();
  s.archives = Array.from({ length: 3 }, () => ({
    label: "保存",
    createdAt: new Date().toISOString(),
    raw: "{}",
  }));
  assert.throws(() => migrateRecord(s, ["stay"], { old: null }));
  assert.throws(() =>
    migrateRecord({ ...old(), note: 42 }, ["stay"], { old: null }),
  );
});
test("personal settings and links round-trip; invalid modes, identities and URLs rejected", () => {
  const s = old();
  s.desk = { name: "我的书房", inscription: "留一点自己的想法。" };
  assert.deepEqual(validateState(s, ids), s);
  for (const patch of [
    { openModes: { old: "execute" } },
    { desk: { name: "x".repeat(41), inscription: "" } },
    {
      tasks: [
        {
          ...s.tasks[0],
          links: [
            { projectId: "old", label: "坏链接", url: "javascript:alert(1)" },
          ],
        },
      ],
    },
  ])
    assert.throws(() => validateState({ ...s, ...patch }, ids));
});
test("task links only open explicitly registered project origins", () => {
  const projects = [
    {
      id: "old",
      url: "http://localhost:6000",
      originalUrl: "http://localhost:6001",
    },
  ];
  assert.equal(
    safeTaskLink(
      { projectId: "old", url: "http://localhost:6001/paper#two" },
      projects,
      "http://localhost:4591",
    ),
    "http://localhost:6001/paper#two",
  );
  assert.throws(() =>
    safeTaskLink(
      { projectId: "old", url: "https://unregistered.example/paper" },
      projects,
      "http://localhost:4591",
    ),
  );
  assert.throws(() =>
    safeTaskLink(
      { projectId: "old", url: "http://localhost:6000/?token=private" },
      projects,
      "http://localhost:4591",
    ),
  );
});
test("snapshot metadata is explicit and optional, not a health check", () => {
  const config = {
    version: 1,
    title: "桌面",
    subtitle: "",
    theme: "song-paper",
    projects: [
      {
        id: "old",
        name: "资料",
        description: "",
        url: "http://localhost:6000",
        sourceType: "snapshot",
        snapshotDate: "2026-09-29",
      },
    ],
  };
  assert.equal(validateConfig(config).projects[0].snapshotDate, "2026-09-29");
  assert.throws(() =>
    validateConfig({
      ...config,
      projects: [{ ...config.projects[0], sourceType: "healthy" }],
    }),
  );
});
