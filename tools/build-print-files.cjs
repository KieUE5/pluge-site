// Writes the print-ready artwork for Printful to tools/print-files, with a guide (README.md) saying which
// file goes on which product and where. Usage: npm run build-print-files
const http = require("http");
const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");

const ROOT = __dirname;
const OUT = path.join(ROOT, "print-files");
const FONTS = path.join(ROOT, "node_modules", "@fontsource-variable", "archivo", "files");
const BRAND = "PLUGE";
const DPI = 300;
const LIGHT = "#F2F2F0", DARK = "#111114";

// in = printed width in inches. Printful sizes artwork to the width you set in its design maker.
const FILES = [
  { file: "hoodie-front-logo-for-dark", kind: "osd", in: 4, box: LIGHT, knockout: true, use: "Test Card Hoodie in Black: front, centred on the chest, about 4in wide." },
  { file: "hoodie-front-logo-for-light", kind: "osd", in: 4, box: DARK, knockout: true, use: "Test Card Hoodie in Sport Grey: front, centred on the chest, about 4in wide." },
  { file: "hoodie-back-colour-bars", kind: "barsOsd", in: 11, use: "Test Card Hoodie, both colours: back, centred, about 11in wide." },
  { file: "crew-front-ch00-dark-ink", kind: "ch00", in: 10, ink: DARK, use: "Channel 00 Crewneck in Sport Grey: front, centred, about 10in wide." },
  { file: "crew-front-ch00-light-ink", kind: "ch00", in: 10, ink: "#EDEDE6", use: "Channel 00 Crewneck in Military Green: front, centred, about 10in wide." },
  { file: "neck-wordmark-dark-ink", kind: "wordmark", in: 2.5, ink: DARK, use: "Back of the neck, about 2.5in wide: Channel 00 Crewneck in Sport Grey, Colour Bars Tee in White." },
  { file: "neck-wordmark-light-ink", kind: "wordmark", in: 2.5, ink: LIGHT, use: "Back of the neck, about 2.5in wide: Channel 00 Crewneck in Military Green, Colour Bars Tee in Black." },
  { file: "tee-chest-wordmark-dark-ink", kind: "wordmark", in: 3.5, ink: DARK, use: "Off Air Tee in White: front, centred high on the chest, about 3.5in wide." },
  { file: "tee-chest-wordmark-light-ink", kind: "wordmark", in: 3.5, ink: LIGHT, use: "Off Air Tee in Black: front, centred high on the chest, about 3.5in wide." },
  { file: "tee-back-logo-for-light", kind: "osd", in: 10, box: DARK, knockout: true, use: "Off Air Tee in White: back, centred below the neck, about 10in wide." },
  { file: "tee-back-logo-for-dark", kind: "osd", in: 10, box: LIGHT, knockout: true, use: "Off Air Tee in Black: back, centred below the neck, about 10in wide." },
  { file: "tee-front-colour-bars", kind: "bars", in: 9, use: "Colour Bars Tee, both colours: front, centred on the chest, about 9in wide." },
  { file: "joggers-thigh-colour-bars-embroidery", kind: "tab", in: 2.5, use: "Static Joggers: embroidery on the left leg, near the top, about 2.5in wide." },
  { file: "cap-front-logo-for-dark-embroidery", kind: "osd", in: 3, box: LIGHT, knockout: true, use: "Broadcast Cap in Black: front embroidery, centred, about 3in wide." },
  { file: "cap-front-logo-for-light-embroidery", kind: "osd", in: 3, box: DARK, knockout: true, use: "Broadcast Cap in Khaki: front embroidery, centred, about 3in wide." },
  { file: "beanie-cuff-colour-bars-embroidery", kind: "tab", in: 2.5, use: "Interference Beanie, both colours: embroidery on the front of the cuff, about 2.5in wide." },
  { file: "socks-colour-bar-stripe", kind: "stripe", in: 9, use: "Signal Socks: in Printful's sock design maker, fill the background black and lay this stripe across each sock just under the cuff." },
];

const server = http.createServer((req, res) => {
  const p = decodeURIComponent(req.url.split("?")[0]);
  const file = p === "/" ? path.join(ROOT, "compose.html") : p.startsWith("/fonts/") ? path.join(FONTS, path.basename(p)) : path.join(ROOT, path.normalize(p));
  if (!file.startsWith(ROOT)) { res.writeHead(403); return res.end(); }
  fs.readFile(file, (err, buf) => {
    if (err) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { "content-type": { ".html": "text/html", ".js": "text/javascript", ".woff2": "font/woff2" }[path.extname(file)] || "application/octet-stream" });
    res.end(buf);
  });
});

(async () => {
  await new Promise(r => server.listen(0, "127.0.0.1", r));
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto(`http://127.0.0.1:${server.address().port}/`);
  const rows = [];
  for (const f of FILES) {
    const r = await page.evaluate(spec => window.renderPrintFile(spec), { ...f, brand: BRAND, widthPx: Math.round(f.in * DPI) });
    fs.writeFileSync(path.join(OUT, `${f.file}.png`), Buffer.from(r.b64, "base64"));
    rows.push(`| \`${f.file}.png\` | ${r.w}×${r.h}px | ${f.use} |`);
    console.log(`${f.file}.png  ${r.w}x${r.h}`);
  }
  fs.writeFileSync(path.join(OUT, "README.md"), `# Print files for Printful

Made by \`tools/build-print-files.cjs\` at ${DPI} DPI, with transparent backgrounds. In Printful, create each product
from the garment named in \`docs/assets/js/catalog.js\` (\`printful\`), upload the file shown here, and set it to
about the width given. Name each Printful product exactly as the site does (for example "Test Card Hoodie") and
use the colours and sizes listed in \`catalog.js\`, so the site can match them.

Logo boxes marked "for dark" or "for light" have the lettering cut out, so the garment colour shows through.

| File | Size | Where it goes |
|---|---|---|
${rows.join("\n")}
`);
  console.log(`Wrote ${FILES.length} print files to ${OUT}`);
  await browser.close();
  server.close();
})().catch(e => { console.error(e); process.exit(1); });
