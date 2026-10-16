import test from "node:test";
import assert from "node:assert/strict";
import { defaultDemoSettings, validateDemoSettings, demoVisibleProjects } from "../src/examples/settings.js";

const projects = [{ id: "alpha", name: "Alpha" }, { id: "beta", name: "Beta" }];
test("demo hiding preserves the registry and can restore every project including an empty desk", () => {
  const before = structuredClone(projects), settings = defaultDemoSettings();
  settings.hidden = ["alpha"];
  assert.deepEqual(demoVisibleProjects(projects, settings).map(p => p.id), ["beta"]);
  settings.hidden.push("beta");
  assert.deepEqual(demoVisibleProjects(projects, settings), []);
  settings.hidden = [];
  assert.deepEqual(demoVisibleProjects(projects, settings), before);
  assert.deepEqual(projects, before);
});
test("demo save survives a JSON round-trip and rejects corrupt or foreign project preferences", () => {
  const value = { ...defaultDemoSettings(), hidden: ["beta"], theme: "system", readingSize: 22, density: "compact" };
  assert.deepEqual(validateDemoSettings(JSON.parse(JSON.stringify(value)), ["alpha", "beta"]), value);
  for (const patch of [{ hidden: ["foreign"] }, { hidden: ["alpha", "alpha"] }, { theme: "bad" }, { readingSize: 99 }, { density: "bad" }]) {
    assert.throws(() => validateDemoSettings({ ...value, ...patch }, ["alpha", "beta"]));
  }
});
