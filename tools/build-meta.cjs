// Renders the social share image (og.jpg) and the iPhone home-screen icon from meta.html.
// Run after build-images.cjs, since the share image uses a product photo.
const http = require("http");
const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");

const SITE_ROOT = path.resolve(__dirname, "..");
const TYPES = { ".html": "text/html", ".css": "text/css", ".webp": "image/webp", ".woff2": "font/woff2", ".svg": "image/svg+xml" };
const server = http.createServer((req, res) => {
  const p = decodeURIComponent(req.url.split("?")[0]);
  const file = p === "/" ? path.join(__dirname, "meta.html") : path.join(SITE_ROOT, path.normalize(p));
  if (!file.startsWith(SITE_ROOT)) { res.writeHead(403); return res.end(); }
  fs.readFile(file, (err, buf) => {
    if (err) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { "content-type": TYPES[path.extname(file)] || "application/octet-stream" });
    res.end(buf);
  });
});

(async () => {
  await new Promise(r => server.listen(0, "127.0.0.1", r));
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1200, height: 900 } });
  await page.goto(`http://127.0.0.1:${server.address().port}/`);
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(300);
  const out = path.join(SITE_ROOT, "docs", "assets", "img");
  await (await page.$("#og")).screenshot({ path: path.join(out, "og.jpg"), type: "jpeg", quality: 86 });
  await (await page.$("#icon")).screenshot({ path: path.join(out, "apple-touch-icon.png") });
  console.log("Wrote og.jpg and apple-touch-icon.png");
  await browser.close();
  server.close();
})().catch(e => { console.error(e); process.exit(1); });
