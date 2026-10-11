import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import {
  validateConfig,
  projectURL,
  initialState,
  validateState,
  expectedMessage,
} from "../src/core.mjs";
import { createServer } from "../scripts/server.mjs";
const config = JSON.parse(
  fs.readFileSync(new URL("../config.example.json", import.meta.url), "utf8"),
);
test("registry accepts independent projects and rejects duplicate or dangerous entries", () => {
  assert.equal(validateConfig(config).projects.length, 2);
  assert.throws(() =>
    validateConfig({
      ...config,
      projects: [config.projects[0], config.projects[0]],
    }),
  );
  for (const url of [
    "javascript:alert(1)",
    "file:///etc/passwd",
    "https://user:pass@example.com",
    "//example.com",
    "https://example.com/?token=abc",
  ])
    assert.throws(() => projectURL(url));
  assert.equal(projectURL("http://localhost:5555").port, "5555");
});
test("backup validation rejects unknown IDs and excessive notes without mutating input", () => {
  const state = initialState(),
    original = JSON.stringify(state);
  validateState(
    state,
    config.projects.map((p) => p.id),
  );
  assert.equal(JSON.stringify(state), original);
  assert.throws(() =>
    validateState({ ...state, selection: ["unregistered"] }, []),
  );
  assert.throws(() => validateState({ ...state, note: "x".repeat(10001) }, []));
  assert.throws(() => validateState({ ...state, readingSize: 99 }, []));
});
test("project messaging requires matching window and declared origin", () => {
  const contentWindow = {},
    frame = { contentWindow, sandbox: { contains: () => true } },
    url = new URL("http://localhost:5555");
  assert.equal(
    expectedMessage({ source: contentWindow, origin: url.origin }, frame, url),
    true,
  );
  assert.equal(
    expectedMessage({ source: {}, origin: url.origin }, frame, url),
    false,
  );
  assert.equal(
    expectedMessage(
      { source: contentWindow, origin: "http://evil.test" },
      frame,
      url,
    ),
    false,
  );
  assert.equal(
    expectedMessage({ source: contentWindow, origin: "null" }, frame, url),
    false,
  );
});
test("local server protects config, private paths, host and HTTP methods", async (t) => {
  const server = createServer(config);
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  t.after(() => new Promise((r) => server.close(r)));
  const base = "http://127.0.0.1:" + server.address().port;
  assert.equal((await fetch(base + "/api/config")).status, 200);
  assert.equal((await fetch(base + "/config.local.json")).status, 404);
  assert.equal((await fetch(base + "/../package.json")).status, 404);
  assert.equal((await fetch(base + "/", { method: "POST" })).status, 405);
  const foreign = await new Promise((resolve, reject) => {
    const request = http.get(
      base + "/",
      { headers: { host: "evil.test" } },
      (response) => {
        response.resume();
        resolve(response.statusCode);
      },
    );
    request.on("error", reject);
  });
  assert.equal(foreign, 403);
  const res = await fetch(base + "/");
  assert.match(
    res.headers.get("content-security-policy"),
    /frame-ancestors 'none'/,
  );
  assert.equal(res.headers.get("referrer-policy"), "no-referrer");
  assert.match(
    (await fetch(base + "/examples/reading.html")).headers.get(
      "content-security-policy",
    ),
    /frame-ancestors 'self'/,
  );
});
