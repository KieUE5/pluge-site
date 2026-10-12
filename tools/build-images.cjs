// Renders every product image from the blank photos in ./blanks.
// Usage: npm run build-images [-- <output dir>]
const http = require("http");
const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");
const { recipes } = require("./recipes.cjs");

const ROOT = __dirname;
const OUT = path.resolve(process.argv[2] || path.join(ROOT, "..", "docs", "assets", "img", "products"));
const FONTS = path.join(ROOT, "node_modules", "@fontsource-variable", "archivo", "files");
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".png": "image/png", ".jpg": "image/jpeg", ".woff2": "font/woff2" };

function blankFile(name) {
  for (const ext of [".png", ".jpg"]) {
    const f = path.join(ROOT, "blanks", name + ext);
    if (fs.existsSync(f)) return `/blanks/${name}${ext}`;
  }
  throw new Error(`Missing blank photo: blanks/${name}.png`);
}

const server = http.createServer((req, res) => {
  const p = decodeURIComponent(req.url.split("?")[0]);
  const file = p === "/" ? path.join(ROOT, "compose.html")
    : p.startsWith("/fonts/") ? path.join(FONTS, path.basename(p))
    : path.join(ROOT, path.normalize(p));
  if (!file.startsWith(ROOT)) { res.writeHead(403); return res.end(); }
  fs.readFile(file, (err, buf) => {
    if (err) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { "content-type": TYPES[path.extname(file)] || "application/octet-stream" });
    res.end(buf);
  });
});

(async () => {
  await new Promise(r => server.listen(0, "127.0.0.1", r));
  const port = server.address().port;
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage();
  page.on("pageerror", e => console.error("page error:", e.message));
  await page.goto(`http://127.0.0.1:${port}/`);
  let count = 0;
  for (const r of recipes()) {
    const result = await page.evaluate(rec => window.renderRecipe(rec), { ...r, blankSrc: blankFile(r.blank) });
    for (const f of result.files) {
      fs.writeFileSync(path.join(OUT, `${r.name}${f.suffix}.webp`), Buffer.from(f.b64, "base64"));
      count++;
    }
    console.log(`${r.name}  (${result.pieces} piece${result.pieces === 1 ? "" : "s"})`);
  }
  console.log(`Wrote ${count} images to ${OUT}`);
  await browser.close();
  server.close();
})().catch(e => { console.error(e); process.exit(1); });
