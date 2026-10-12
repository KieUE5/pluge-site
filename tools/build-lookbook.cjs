// Turns the lookbook photos in ./lookbook into WebP files at full and half width.
// Usage: node build-lookbook.cjs [<output dir>]
const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");

const SRC = path.join(__dirname, "lookbook");
const OUT = path.resolve(process.argv[2] || path.join(__dirname, "..", "docs", "assets", "img", "lookbook"));
const QUALITY = 0.8;

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const files = fs.readdirSync(SRC).filter(f => /\.(png|jpe?g)$/i.test(f)).sort();
  for (const f of files) {
    const name = f.replace(/\.[^.]+$/, "");
    const mime = /\.png$/i.test(f) ? "image/png" : "image/jpeg";
    const dataUrl = `data:${mime};base64,${fs.readFileSync(path.join(SRC, f)).toString("base64")}`;
    const out = await page.evaluate(async ({ dataUrl, quality }) => {
      const img = new Image();
      img.src = dataUrl;
      await img.decode();
      const results = [];
      for (const w of [img.naturalWidth, Math.round(img.naturalWidth / 2)]) {
        const h = Math.round(img.naturalHeight * w / img.naturalWidth);
        const cv = document.createElement("canvas");
        cv.width = w;
        cv.height = h;
        const ctx = cv.getContext("2d");
        ctx.imageSmoothingQuality = "high";
        ctx.drawImage(img, 0, 0, w, h);
        results.push({ w, h, b64: cv.toDataURL("image/webp", quality).split(",")[1] });
      }
      return results;
    }, { dataUrl, quality: QUALITY });
    for (const r of out) {
      const file = path.join(OUT, `${name}-${r.w}.webp`);
      fs.writeFileSync(file, Buffer.from(r.b64, "base64"));
      console.log(`${path.basename(file)}  ${r.w}x${r.h}  ${Math.round(fs.statSync(file).size / 1024)}KB`);
    }
  }
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
