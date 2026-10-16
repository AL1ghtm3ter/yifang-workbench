import test from "node:test";
import assert from "node:assert/strict";
import { initialState, validateState, migrateRecord } from "../src/core.mjs";
import { settingsSnapshot, withSettings, visibleProjects } from "../src/customization-core.mjs";

const projects = [ { id: "alpha", name: "Alpha", description: "writing" }, { id: "beta", name: "Beta", description: "reading" } ];
const ids = projects.map(p => p.id);
test("saved settings round-trip while preserving notes, task references, history, layouts and colors", () => {
  const state = initialState();
  state.note = "keep note"; state.recent = ["alpha", "beta"]; state.selection = ["alpha"];
  state.tasks = [{ id: "one", title: "Keep task", next: "next", projects: ["alpha"], status: "active" }];
  state.preferences.layouts = [{ id: "layout", name: "Keep layout", selection: ["alpha", "beta"], direction: "horizontal", readingSize: 18 }];
  state.preferences.appearance.colors = { accent: "#a43226" };
  const before = structuredClone(state), draft = { hidden: ["alpha"], theme: "system", readingSize: 20, density: "compact" };
  const next = validateState(JSON.parse(JSON.stringify(withSettings(state, draft, ids))), ids);
  assert.deepEqual(settingsSnapshot(next), draft);
  for (const field of ["note", "tasks", "recent", "selection"]) assert.deepEqual(next[field], state[field]);
  assert.deepEqual(next.preferences.layouts, state.preferences.layouts);
  assert.deepEqual(next.preferences.appearance.colors, state.preferences.appearance.colors);
  assert.deepEqual(state, before);
  assert.deepEqual(visibleProjects(projects, next.preferences).map(p => p.id), ["beta"]);
  assert.deepEqual(visibleProjects(projects, next.preferences, "Alpha"), []);
  const restored = withSettings(next, { ...draft, hidden: [] }, ids);
  assert.deepEqual(visibleProjects(projects, restored.preferences).map(p => p.id), ids);
});
test("old backups default to visible, malformed settings are rejected, all projects may be hidden", () => {
  const state = initialState(); delete state.preferences.hidden;
  assert.deepEqual(validateState(state, ids).preferences.hidden, []);
  for (const patch of [{ hidden: ["foreign"] }, { hidden: ["alpha", "alpha"] }, { hidden: undefined }, { theme: "invalid" }, { readingSize: 99 }, { density: "invalid" }]) {
    assert.throws(() => withSettings(initialState(), { hidden: [], theme: "light", readingSize: 18, density: "comfortable", ...patch }, ids));
  }
  assert.deepEqual(visibleProjects(projects, withSettings(initialState(), { hidden: ids, theme: "light", readingSize: 18, density: "comfortable" }, ids).preferences), []);
});
test("registry migration remaps visibility and preserves an archive", () => {
  const state = initialState(); state.preferences.hidden = ["alpha"];
  const moved = migrateRecord(state, ["beta"], { alpha: "beta" });
  assert.deepEqual(moved.preferences.hidden, ["beta"]);
  assert.equal(moved.archives.length, 1);
});
