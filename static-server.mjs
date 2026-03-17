import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const distDir = path.join(__dirname, "dist");
const indexPath = path.join(distDir, "index.html");
const port = Number(process.env.PORT || 3000);

const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
};

function getContentType(filePath) {
  return contentTypes[path.extname(filePath).toLowerCase()] || "application/octet-stream";
}

function resolveAssetPath(urlPath) {
  const safePath = path.normalize(urlPath).replace(/^(\.\.[/\\])+/, "");
  return path.join(distDir, safePath);
}

if (!existsSync(indexPath)) {
  console.error("Build output not found. Run `npm run build` before starting the server.");
  process.exit(1);
}

createServer(async (req, res) => {
  try {
    const requestUrl = new URL(req.url || "/", `http://${req.headers.host}`);
    const pathname = decodeURIComponent(requestUrl.pathname);
    const requestedPath = pathname === "/" ? indexPath : resolveAssetPath(pathname);
    const shouldServeAsset = requestedPath.startsWith(distDir) && existsSync(requestedPath);
    const filePath = shouldServeAsset ? requestedPath : indexPath;
    const body = await readFile(filePath);

    res.writeHead(200, {
      "Content-Type": getContentType(filePath),
      "Cache-Control": filePath === indexPath ? "no-cache" : "public, max-age=31536000, immutable",
    });
    res.end(body);
  } catch (error) {
    res.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Failed to serve application.");
  }
}).listen(port, "0.0.0.0", () => {
  console.log(`Static frontend listening on port ${port}`);
});
