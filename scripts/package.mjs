import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import cp from "node:child_process";
import crypto from "node:crypto";
import { ROOT } from "./server.mjs";
import { publicFiles } from "./public-files.mjs";
cp.execFileSync(
  process.execPath,
  [path.join(ROOT, "scripts/check-public.mjs")],
  { stdio: "inherit" },
);
const files = publicFiles(),
  temp = fs.mkdtempSync(path.join(os.tmpdir(), "yifang-package-")),
  stage = path.join(temp, "yifang-workbench"),
  release = path.join(ROOT, "release");
fs.mkdirSync(stage);
fs.mkdirSync(release, { recursive: true });
try {
  for (const file of files) {
    const to = path.join(stage, file);
    fs.mkdirSync(path.dirname(to), { recursive: true });
    fs.copyFileSync(path.join(ROOT, file), to);
  }
  let archive;
  if (process.platform === "win32") {
    archive = path.join(release, "yifang-workbench-0.2.0-source.zip");
    const quote = (s) => "'" + s.replaceAll("'", "''") + "'";
    cp.execFileSync(
      "powershell.exe",
      [
        "-NoProfile",
        "-Command",
        `Compress-Archive -LiteralPath ${quote(stage)} -DestinationPath ${quote(archive)} -Force`,
      ],
      { windowsHide: true, stdio: "inherit" },
    );
  } else {
    archive = path.join(release, "yifang-workbench-0.2.0-source.tar.gz");
    cp.execFileSync("tar", ["-czf", archive, "-C", temp, "yifang-workbench"]);
  }
  const manifest = {
    archive: path.basename(archive),
    files,
    sha256: crypto
      .createHash("sha256")
      .update(fs.readFileSync(archive))
      .digest("hex"),
  };
  fs.writeFileSync(
    path.join(release, "package-manifest.json"),
    JSON.stringify(manifest, null, 2),
  );
  console.log(
    JSON.stringify({ archive, files: files.length, sha256: manifest.sha256 }),
  );
} finally {
  const resolved = path.resolve(temp),
    tmp = path.resolve(os.tmpdir());
  if (
    resolved.startsWith(tmp + path.sep) &&
    path.basename(resolved).startsWith("yifang-package-")
  )
    fs.rmSync(resolved, { recursive: true, force: true });
  else throw Error("拒绝清理未知临时路径");
}
