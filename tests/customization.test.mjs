import test from "node:test";
import assert from "node:assert/strict";
import { initialState, validateState, validateConfig } from "../src/core.mjs";
import {
  initialPreferences,
  validatePreferences,
  validateAppearance,
  visibleProjects,
  agentHandoff,
  contrast,
  paletteIssues,
} from "../src/customization-core.mjs";
const projects = [
  {
    id: "writing",
    name: "写作",
    description: "文章",
    url: "http://127.0.0.1:5555",
    group: "日常",
    tags: ["文稿"],
    pinned: false,
  },
  {
    id: "reading",
    name: "阅读",
    description: "资料",
    url: "http://127.0.0.1:5556",
    group: "研究",
    tags: ["论文"],
    pinned: true,
  },
];
test("v0.1 state migrates without losing note, recents or layout", () => {
  const old = {
      version: 1,
      note: "保留内容",
      recent: ["writing"],
      selection: ["reading"],
      direction: "vertical",
      theme: "dark",
      readingSize: 20,
    },
    before = JSON.stringify(old),
    next = validateState(old, ["writing", "reading"]);
  assert.equal(next.note, old.note);
  assert.deepEqual(next.selection, old.selection);
  assert.deepEqual(next.preferences, initialPreferences());
  assert.equal(JSON.stringify(old), before);
});
test("groups, tags and pinning participate in filtering and order", () => {
  const prefs = initialPreferences();
  assert.deepEqual(
    visibleProjects(projects, prefs).map((p) => p.id),
    ["reading", "writing"],
  );
  assert.equal(visibleProjects(projects, prefs, "论文")[0].id, "reading");
  assert.equal(visibleProjects(projects, prefs, "", "日常")[0].id, "writing");
  prefs.metadata.writing = { group: "开发", tags: ["稿件"], pinned: true };
  assert.equal(visibleProjects(projects, prefs, "稿件")[0].id, "writing");
});
test("prototype property names do not become inherited metadata", () => {
  const p = { ...projects[0], id: "constructor" };
  assert.equal(visibleProjects([p], initialPreferences(), "文章").length, 1);
});
test("invalid metadata and stale layout project IDs are rejected", () => {
  const base = initialPreferences();
  assert.throws(() =>
    validatePreferences(
      {
        ...base,
        metadata: { unknown: { group: "", tags: [], pinned: false } },
      },
      ["writing"],
    ),
  );
  assert.throws(() =>
    validatePreferences(
      {
        ...base,
        layouts: [
          {
            id: "one",
            name: "布局",
            selection: ["missing"],
            direction: "horizontal",
            readingSize: 18,
          },
        ],
      },
      ["writing"],
    ),
  );
  assert.throws(() =>
    validatePreferences(
      {
        ...base,
        metadata: {
          writing: { group: "", tags: Array(9).fill("tag"), pinned: false },
        },
      },
      ["writing"],
    ),
  );
});
test("valid customization round-trips within backup", () => {
  const state = initialState();
  state.preferences.layouts = [
    {
      id: "one",
      name: "并排",
      selection: ["reading", "writing"],
      direction: "vertical",
      readingSize: 20,
    },
  ];
  state.preferences.appearance = {
    themeName: "modern-ink",
    density: "compact",
    colors: { text: "#111111" },
  };
  assert.deepEqual(
    validateState(JSON.parse(JSON.stringify(state)), ["writing", "reading"]),
    state,
  );
});
test("theme overrides only allow known colors and bundled theme identifiers", () => {
  assert.throws(() =>
    validateAppearance({
      themeName: "../private",
      density: "compact",
      colors: {},
    }),
  );
  assert.throws(() =>
    validateAppearance({
      themeName: null,
      density: "compact",
      colors: { text: "url(https://example.com)" },
    }),
  );
  assert.throws(() =>
    validateAppearance({
      themeName: null,
      density: "compact",
      colors: { unknown: "#111111" },
    }),
  );
  assert.equal(contrast("#000000", "#ffffff"), 21);
});
test("agent handoff omits real project names, addresses and notes", () => {
  const config = {
      projects: projects.map((p) => ({
        ...p,
        name: "PRIVATE-PROJECT-" + p.id,
      })),
      theme: "song-paper",
    },
    state = initialState();
  state.note = "PRIVATE-NOTE";
  state.selection = ["reading"];
  const json = JSON.stringify(agentHandoff(config, state));
  assert.ok(!json.includes("PRIVATE-NOTE"));
  assert.ok(!json.includes("5555"));
  assert.ok(!json.includes("PRIVATE-PROJECT-"));
  assert.deepEqual(agentHandoff(config, state).layout, [2]);
});
test("wizard metadata survives config validation; credentials are still denied", () => {
  const config = {
    version: 1,
    title: "桌面",
    subtitle: "",
    theme: "song-paper",
    projects,
  };
  assert.equal(validateConfig(config).projects[1].tags[0], "论文");
  assert.throws(() =>
    validateConfig({
      ...config,
      projects: [{ ...projects[0], url: "http://user:pass@localhost:5555" }],
    }),
  );
});
test("palette guard validates light colors even when current UI is dark", () => {
  const palette = {
    ground: "#f4efdf",
    surface: "#fbf7ed",
    rail: "#ebe3d2",
    soft: "#eee2d3",
    margin: "#f0e7d4",
    text: "#25221d",
    muted: "#574f43",
    accent: "#a43226",
    "on-accent": "#fff",
  };
  assert.deepEqual(paletteIssues(palette), []);
  assert.ok(
    paletteIssues({ ...palette, text: palette.ground }).includes("text/ground"),
  );
  assert.ok(
    paletteIssues({ ...palette, accent: palette.ground }).includes(
      "accent/ground",
    ),
  );
  assert.throws(() => paletteIssues({ ...palette, text: "currentColor" }));
});
