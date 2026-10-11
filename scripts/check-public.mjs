import fs from "node:fs";
import path from "node:path";
import { ROOT } from "./server.mjs";
import { publicFiles } from "./public-files.mjs";
const files = publicFiles(),
  rules = [
    [/[A-Z]:[\\/](?:Users|Agent)/i, "本机绝对路径"],
    [
      /sk-[a-zA-Z0-9_-]{25,}|gh[pousr]_[a-zA-Z0-9]{20,}|AKIA[A-Z0-9]{16}/,
      "疑似凭据",
    ],
    [/https?:\/\/[^/\s]+\.chatgpt\.site/i, "私人托管地址"],
  ];
let findings = [];
for (const file of files) {
  const content = fs.readFileSync(path.join(ROOT, file), "utf8");
  for (const [rule, reason] of rules)
    if (rule.test(content)) findings.push({ file, reason });
}
if (findings.length) {
  console.error(JSON.stringify({ passed: false, findings }, null, 2));
  process.exitCode = 1;
} else
  console.log(
    JSON.stringify({
      passed: true,
      files: files.length,
      scope:
        "explicit public source allowlist; no local config, runtime, user projects or screenshots",
    }),
  );
