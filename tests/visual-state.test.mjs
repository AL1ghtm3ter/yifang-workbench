import test from "node:test";
import assert from "node:assert/strict";
import { initialState, validateState } from "../src/core.mjs";
test("old records migrate to an empty task board and equal split", () => {
  const old = initialState();
  delete old.tasks;
  delete old.splitRatio;
  const s = validateState(old, ["one", "two"]);
  assert.deepEqual(s.tasks, []);
  assert.equal(s.splitRatio, 50);
});
test("task and ratio round-trip without accepting foreign projects or malformed state", () => {
  const s = initialState();
  s.splitRatio = 65;
  s.tasks = [
    {
      id: "task-1",
      title: "材料核对",
      next: "读第二页",
      projects: ["one", "two"],
      status: "active",
    },
  ];
  assert.deepEqual(validateState(s, ["one", "two"]), s);
  for (const change of [
    { splitRatio: 100 },
    { splitRatio: 25.5 },
    { tasks: [{ ...s.tasks[0], projects: ["other"] }] },
    { tasks: [s.tasks[0], s.tasks[0]] },
    { tasks: [{ ...s.tasks[0], status: "unknown" }] },
  ])
    assert.throws(() => validateState({ ...s, ...change }, ["one", "two"]));
});
