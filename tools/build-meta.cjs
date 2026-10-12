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

  // One share image per product, used by its page at p/<id>/.
  const vm = require("vm");
  const sandbox = { window: {} };
  vm.runInNewContext(fs.readFileSync(path.join(SITE_ROOT, "docs", "assets", "js", "catalog.js"), "utf8"), sandbox);
  const { PRODUCTS, CHANNELS } = sandbox.window.PLUGE;
  const SETS = ["#4A4C55", "#1426E0", "#C9B800", "#B0009F", "#00A9AE", "#3A3C44", "#5A5D44", "#0E7A3A"];
  fs.mkdirSync(path.join(out, "og"), { recursive: true });
  for (const [i, p] of PRODUCTS.entries()) {
    const ch = CHANNELS.find(c => c.id === p.id);
    await page.evaluate(({ p, set, n }) => new Promise(resolve => {
      const name = document.getElementById("p-name");
      name.textContent = p.name;
      // Shrink long names until the longest word fits.
      for (let size = 76; size > 40; size -= 2) {
        name.style.fontSize = `${size}px`;
        if (name.scrollWidth <= name.clientWidth) break;
      }
      document.getElementById("p-price").textContent = Number.isInteger(p.price) ? `£${p.price}` : `£${p.price.toFixed(2)}`;
      document.getElementById("p-ch").textContent = `CH ${n}`;
      document.getElementById("p-set").style.setProperty("--set", set);
      const img = document.getElementById("p-img");
      img.onload = () => resolve();
      img.src = `/docs/assets/img/products/${p.id}-${p.colours[0]}-front.webp`;
    }), { p, set: ch ? ch.set : SETS[i % SETS.length], n: ch ? ch.n : String(i + 2).padStart(2, "0") });
    await (await page.$("#og-p")).screenshot({ path: path.join(out, "og", `${p.id}.jpg`), type: "jpeg", quality: 84 });
  }
  console.log(`Wrote ${PRODUCTS.length} product share images to docs/assets/img/og`);
  await browser.close();
  server.close();
})().catch(e => { console.error(e); process.exit(1); });
