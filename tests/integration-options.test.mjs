import test from "node:test";
import assert from "node:assert/strict";
import { validateConfig, stateKeyFor, STATE_KEY } from "../src/core.mjs";
const config = {
  version: 1,
  title: "桌面",
  subtitle: "",
  theme: "song-paper",
  projects: [
    {
      id: "one",
      name: "独立项目",
      description: "",
      url: "http://127.0.0.1:5555/",
    },
  ],
};
test("profiles isolate personal storage without changing the old default key", () => {
  assert.equal(stateKeyFor(validateConfig(config)), STATE_KEY);
  assert.equal(
    stateKeyFor(validateConfig({ ...config, storageNamespace: "personal" })),
    STATE_KEY + ":personal",
  );
  assert.throws(() =>
    validateConfig({ ...config, storageNamespace: "../other" }),
  );
});
test("original page URL is validated independently", () => {
  const p = {
    ...config.projects[0],
    originalUrl: "http://localhost:5555/original",
  };
  assert.equal(
    validateConfig({ ...config, projects: [p] }).projects[0].originalUrl,
    p.originalUrl,
  );
  assert.throws(() =>
    validateConfig({
      ...config,
      projects: [{ ...p, originalUrl: "javascript:alert(1)" }],
    }),
  );
});
test("iframe permissions are explicit, bounded and optional", () => {
  assert.equal(validateConfig(config).projects[0].permissions, undefined);
  assert.deepEqual(
    validateConfig({
      ...config,
      projects: [
        { ...config.projects[0], permissions: ["popups", "downloads"] },
      ],
    }).projects[0].permissions,
    ["popups", "downloads"],
  );
  for (const permissions of [
    ["top-navigation"],
    ["scripts"],
    ["downloads", "downloads"],
    "all",
  ])
    assert.throws(() =>
      validateConfig({
        ...config,
        projects: [{ ...config.projects[0], permissions }],
      }),
    );
});
