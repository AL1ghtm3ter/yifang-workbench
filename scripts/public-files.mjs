import fs from "node:fs";
import path from "node:path";
import { ROOT } from "./server.mjs";
const rootFiles = [
    "package.json",
    ".gitignore",
    "README.md",
    "LICENSE",
    "AGENTS.md",
    "PRODUCT.md",
    "DESIGN.md",
    "CONTRIBUTING.md",
    "config.example.json",
  ],
  directories = ["src", "scripts", "tests", "docs", ".github"];
export function publicFiles() {
  const files = [];
  function collect(relative) {
    const absolute = path.join(ROOT, relative),
      stat = fs.lstatSync(absolute);
    if (stat.isSymbolicLink()) throw Error("公开包拒绝符号链接：" + relative);
    if (stat.isDirectory()) {
      for (const item of fs.readdirSync(absolute))
        collect(path.join(relative, item));
    } else if (stat.isFile()) {
      if (
        /(?:\.local\.json|\.(?:log|db|sqlite\w*|png|jpg|webm|zip|exe)|^\.env)$/i.test(
          relative,
        )
      )
        throw Error("公开白名单中发现不允许的文件：" + relative);
      files.push(relative.replaceAll("\\", "/"));
    }
  }
  for (const file of rootFiles) collect(file);
  for (const dir of directories) collect(dir);
  return files.sort();
}
