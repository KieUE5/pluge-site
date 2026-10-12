// Turns the lookbook photos in ./lookbook into WebP files at full and half width, plus the portrait
// crops listed in CROPS (the homepage's campaign photo on phones).
// Usage: node build-lookbook.cjs [<output dir>]
const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");

const SRC = path.join(__dirname, "lookbook");
const OUT = path.resolve(process.argv[2] || path.join(__dirname, "..", "docs", "assets", "img", "lookbook"));
const QUALITY = 0.8;
// name: the output file's name, aspect: width / height, cx: the crop's centre across the photo (0-1).
const CROPS = {
  "look-01": [{ name: "hero-tall", aspect: 2 / 3, cx: 0.51 }],
};

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const files = fs.readdirSync(SRC).filter(f => /\.(png|jpe?g)$/i.test(f)).sort();
  for (const f of files) {
    const name = f.replace(/\.[^.]+$/, "");
    const mime = /\.png$/i.test(f) ? "image/png" : "image/jpeg";
    const dataUrl = `data:${mime};base64,${fs.readFileSync(path.join(SRC, f)).toString("base64")}`;
    const out = await page.evaluate(async ({ dataUrl, quality, name, crops }) => {
      const img = new Image();
      img.src = dataUrl;
      await img.decode();
      const W = img.naturalWidth, H = img.naturalHeight;
      // Each job: the source rectangle, and the output name.
      const jobs = [{ name, sx: 0, sy: 0, sw: W, sh: H }];
      for (const c of crops) {
        const sw = Math.min(W, Math.round(H * c.aspect));
        const sx = Math.round(Math.min(W - sw, Math.max(0, W * c.cx - sw / 2)));
        jobs.push({ name: c.name, sx, sy: 0, sw, sh: H });
      }
      const results = [];
      for (const j of jobs) {
        for (const w of [j.sw, Math.round(j.sw / 2)]) {
          const h = Math.round(j.sh * w / j.sw);
          const cv = document.createElement("canvas");
          cv.width = w;
          cv.height = h;
          const ctx = cv.getContext("2d");
          ctx.imageSmoothingQuality = "high";
          ctx.drawImage(img, j.sx, j.sy, j.sw, j.sh, 0, 0, w, h);
          results.push({ name: j.name, w, h, b64: cv.toDataURL("image/webp", quality).split(",")[1] });
        }
      }
      return results;
    }, { dataUrl, quality: QUALITY, name, crops: CROPS[name] || [] });
    for (const r of out) {
      const file = path.join(OUT, `${r.name}-${r.w}.webp`);
      fs.writeFileSync(file, Buffer.from(r.b64, "base64"));
      console.log(`${path.basename(file)}  ${r.w}x${r.h}  ${Math.round(fs.statSync(file).size / 1024)}KB`);
    }
  }
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
