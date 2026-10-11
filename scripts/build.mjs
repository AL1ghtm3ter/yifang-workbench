import fs from "node:fs";
import path from "node:path";
import { ROOT } from "./server.mjs";
import { validateConfig } from "../src/core.mjs";
const src = path.join(ROOT, "src"),
  dist = path.join(ROOT, "dist");
fs.mkdirSync(dist, { recursive: true });
function copy(dir, target) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isSymbolicLink()) throw Error("构建拒绝符号链接");
    const from = path.join(dir, entry.name),
      to = path.join(target, entry.name);
    if (entry.isDirectory()) {
      fs.mkdirSync(to, { recursive: true });
      copy(from, to);
    } else if (entry.isFile()) fs.copyFileSync(from, to);
  }
}
copy(src, dist);
const config = validateConfig(
  JSON.parse(fs.readFileSync(path.join(ROOT, "config.example.json"), "utf8")),
);
fs.writeFileSync(
  path.join(dist, "workbench.config.json"),
  JSON.stringify(config, null, 2),
);
console.log(
  "已构建dist，仅使用公开示例配置。可用静态服务器托管；npm start使用本机配置。",
);
