import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { validateConfig, projectURL } from "../src/core.mjs";
export const ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
export function readConfig() {
  const file = path.join(
    ROOT,
    fs.existsSync(path.join(ROOT, "config.local.json"))
      ? "config.local.json"
      : "config.example.json",
  );
  const config = validateConfig(
    JSON.parse(fs.readFileSync(file, "utf8").replace(/^\uFEFF/, "")),
  );
  if (!fs.existsSync(path.join(ROOT, "src/themes", config.theme + ".css")))
    throw Error("主题文件不存在：" + config.theme);
  return config;
}
export function createServer(config = readConfig()) {
  config = validateConfig(config);
  const src = fs.realpathSync(path.join(ROOT, "src"));
  const server = http.createServer((req, res) => {
    const port = server.address().port,
      host = "127.0.0.1:" + port;
    if (![host, "localhost:" + port].includes(req.headers.host)) {
      res.writeHead(403);
      return res.end("Local access only");
    }
    if (!["GET", "HEAD"].includes(req.method)) {
      res.writeHead(405);
      return res.end();
    }
    const base = "http://" + host,
      origins = [
        ...new Set(config.projects.map((p) => projectURL(p.url, base).origin)),
      ];
    res.setHeader(
      "Content-Security-Policy",
      "default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; frame-src 'self' " +
        origins.join(" ") +
        "; base-uri 'none'; form-action 'self'; frame-ancestors 'none'",
    );
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "no-referrer");
    res.setHeader("Cache-Control", "no-store");
    let pathname;
    try {
      pathname = decodeURIComponent(new URL(req.url, base).pathname);
    } catch {
      res.writeHead(400);
      return res.end();
    }
    if (pathname === "/api/config") {
      res.setHeader("Content-Type", "application/json;charset=utf-8");
      return res.end(req.method === "HEAD" ? "" : JSON.stringify(config));
    }
    if (pathname === "/api/health") {
      res.setHeader("Content-Type", "application/json");
      return res.end(
        req.method === "HEAD"
          ? ""
          : JSON.stringify({ name: "yifang-workbench", version: "0.2.0" }),
      );
    }
    const relative = pathname === "/" ? "index.html" : pathname.slice(1);
    if (relative.startsWith("examples/"))
      res.setHeader(
        "Content-Security-Policy",
        res
          .getHeader("Content-Security-Policy")
          .replace("frame-ancestors 'none'", "frame-ancestors 'self'"),
      );
    if (
      !/^(?:index\.html|app\.mjs|core\.mjs|visual-desk\.mjs|customization\.mjs|customization-core\.mjs|styles\/[a-z0-9-]+\.css|themes\/[a-z0-9-]+\.css|examples\/[a-z0-9-]+\.(?:html|js|css))$/.test(
        relative,
      )
    ) {
      res.writeHead(404);
      return res.end("Not found");
    }
    try {
      const target = fs.realpathSync(path.join(src, relative));
      if (!target.startsWith(src + path.sep) || !fs.statSync(target).isFile())
        throw Error("outside source");
      const ext = path.extname(target);
      res.setHeader(
        "Content-Type",
        ({
          ".html": "text/html",
          ".css": "text/css",
          ".mjs": "text/javascript",
          ".js": "text/javascript",
        }[ext] || "text/plain") + ";charset=utf-8",
      );
      res.end(req.method === "HEAD" ? "" : fs.readFileSync(target));
    } catch {
      res.writeHead(404);
      res.end("Not found");
    }
  });
  return server;
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href
) {
  const port = Number(process.env.YIFANG_PORT || 4590);
  if (!Number.isInteger(port) || port < 1024 || port > 65535)
    throw Error("YIFANG_PORT必须是1024–65535");
  const server = createServer();
  server.listen(port, "127.0.0.1", () =>
    console.log("一方工作台：http://127.0.0.1:" + port + "\n按Ctrl+C停止"),
  );
  server.on("error", (e) => {
    console.error("未启动：" + e.message);
    process.exitCode = 1;
  });
  process.on("SIGINT", () => server.close(() => process.exit(0)));
}
