// Writes the share and search tags at the top of docs/index.html, the business details in its footer,
// a page for every product at docs/p/<id>/index.html, the terms, returns and privacy pages (from
// tools/policies.cjs), docs/sitemap.xml, docs/robots.txt, and the base address in docs/404.html.
//
// Run it after changing docs/index.html or docs/assets/js/catalog.js. It needs Node but no npm install.
//   node tools/build-pages.cjs          write the files
//   node tools/build-pages.cjs --check  only report whether they're up to date (exit code 1 if not)
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const DOCS = path.resolve(__dirname, "..", "docs");
const CHECK = process.argv.includes("--check");

const sandbox = { window: {} };
vm.runInNewContext(fs.readFileSync(path.join(DOCS, "assets", "js", "catalog.js"), "utf8"), sandbox);
const { BRAND, SITE_URL, PRODUCTS, COLOURS, CATS, SHIP, COMPANY } = sandbox.window.PLUGE;
const policies = require("./policies.cjs")({ BRAND, COMPANY, SHIP });
if (!/^https?:\/\/[^/]+\/(.*\/)?$/.test(SITE_URL)) throw new Error(`SITE_URL in catalog.js must be a full address ending in "/", not "${SITE_URL}"`);
const BASE_PATH = new URL(SITE_URL).pathname;

const HOME = {
  title: `${BRAND} · Drop 01: Test Pattern`,
  desc: `${BRAND} makes heavyweight streetwear in small runs. Drop 01, Test Pattern: hoodies, tees, cargos and accessories printed with TV colour bars.`,
  shareDesc: "Heavyweight streetwear printed with the colour bars a telly shows when the signal drops.",
};

const esc = s => String(s).replace(/[&<>"]/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[ch]));
const gbp = n => Number.isInteger(n) ? `£${n}` : `£${n.toFixed(2)}`;
const listing = arr => arr.length < 2 ? arr.join("") : `${arr.slice(0, -1).join(", ")} and ${arr[arr.length - 1]}`;
const isOut = (p, key, size) => (p.soldOut[key] || []).includes(size);
const inStock = p => p.colours.some(k => p.sizes.some(s => !isOut(p, k, s)));
const productUrl = p => `${SITE_URL}p/${p.id}/`;
const photo = (p, key, view = "front") => `${SITE_URL}assets/img/products/${p.id}-${key}-${view}.webp`;
const shareImage = p => fs.existsSync(path.join(DOCS, "assets", "img", "og", `${p.id}.jpg`)) ? `${SITE_URL}assets/img/og/${p.id}.jpg` : `${SITE_URL}assets/img/og.jpg`;

function metaBlock({ title, desc, shareDesc = desc, url, image, imageAlt, type, extra = [] }) {
  return [
    "<!-- page-meta: tools/build-pages.cjs writes this block, here and on every product page -->",
    `<title>${esc(title)}</title>`,
    `<meta name="description" content="${esc(desc)}">`,
    `<link rel="canonical" href="${url}">`,
    `<meta property="og:type" content="${type}">`,
    `<meta property="og:site_name" content="${esc(BRAND)}">`,
    `<meta property="og:title" content="${esc(title)}">`,
    `<meta property="og:description" content="${esc(shareDesc)}">`,
    `<meta property="og:url" content="${url}">`,
    `<meta property="og:image" content="${image}">`,
    `<meta property="og:image:width" content="1200">`,
    `<meta property="og:image:height" content="630">`,
    `<meta property="og:image:alt" content="${esc(imageAlt)}">`,
    `<meta name="twitter:card" content="summary_large_image">`,
    ...extra,
    "<!-- /page-meta -->",
  ].map(l => `  ${l}`).join("\n");
}

function productLd(p) {
  const t48 = SHIP.t48;
  const data = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: p.name,
    description: p.blurb,
    sku: p.id,
    url: productUrl(p),
    brand: { "@type": "Brand", name: BRAND },
    category: CATS.find(c => c.id === p.cat).label,
    color: p.colours.map(k => COLOURS[k].name).join(", "),
    material: p.fabric,
    image: [photo(p, p.colours[0]), ...(p.views.includes("back") ? [photo(p, p.colours[0], "back")] : []), ...p.colours.slice(1).map(k => photo(p, k))],
    offers: {
      "@type": "Offer",
      url: productUrl(p),
      price: p.price.toFixed(2),
      priceCurrency: "GBP",
      availability: `https://schema.org/${inStock(p) ? "InStock" : "OutOfStock"}`,
      itemCondition: "https://schema.org/NewCondition",
      shippingDetails: {
        "@type": "OfferShippingDetails",
        shippingRate: { "@type": "MonetaryAmount", value: p.price >= t48.freeOver ? 0 : t48.fee, currency: "GBP" },
        shippingDestination: { "@type": "DefinedRegion", addressCountry: "GB" },
        deliveryTime: {
          "@type": "ShippingDeliveryTime",
          handlingTime: { "@type": "QuantitativeValue", minValue: 1, maxValue: 2, unitCode: "DAY" },
          // SHIP days are the whole wait, so the carrier's part is what's left after 1-2 days to dispatch.
          transitTime: { "@type": "QuantitativeValue", minValue: t48.days[0] - 1, maxValue: t48.days[1] - 2, unitCode: "DAY" },
        },
      },
      hasMerchantReturnPolicy: {
        "@type": "MerchantReturnPolicy",
        applicableCountry: "GB",
        returnPolicyCategory: "https://schema.org/MerchantReturnFiniteReturnWindow",
        merchantReturnDays: 30,
        returnMethod: "https://schema.org/ReturnByMail",
        returnFees: "https://schema.org/FreeReturn",
      },
    },
  };
  // "<" is escaped so the JSON can never close its own script tag.
  return `<script type="application/ld+json">${JSON.stringify(data).replace(/</g, "\\u003c")}</script>`;
}

const META_RE = /  <!-- page-meta:[\s\S]*?<!-- \/page-meta -->/;
const COMPANY_RE = /(<!-- company:[^>]*-->\s*)<span class="foot-legal">[\s\S]*?<\/span>(\s*<!-- \/company -->)/;

// The footer line every UK trading website needs. Empty details show as [square brackets].
const co = (k, placeholder) => COMPANY[k] && String(COMPANY[k]).trim() ? esc(COMPANY[k]) : `[${placeholder}]`;
const companyLine = `${esc(BRAND)} is a trading name of ${co("legalName", "company name")}, registered in England and Wales, company no. ${co("companyNumber", "company number")}. ` +
  `Registered office: ${co("office", "address")}.${COMPANY.vat ? ` VAT no. ${esc(COMPANY.vat)}.` : ""} Contact: ${co("email", "email address")}.`;

let template = fs.readFileSync(path.join(DOCS, "index.html"), "utf8");
if (!COMPANY_RE.test(template)) throw new Error("docs/index.html has lost its <!-- company --> ... <!-- /company --> footer block");
template = template.replace(COMPANY_RE, `$1<span class="foot-legal">${companyLine}</span>$2`);
if (!META_RE.test(template)) throw new Error("docs/index.html has lost its <!-- page-meta --> ... <!-- /page-meta --> block");
if (/<base\b/.test(template)) throw new Error("docs/index.html shouldn't have a <base> tag; product pages get their own");

const out = new Map(); // file path -> contents

out.set(path.join(DOCS, "index.html"), template.replace(META_RE, metaBlock({
  title: HOME.title, desc: HOME.desc, shareDesc: HOME.shareDesc, url: SITE_URL, type: "website",
  image: `${SITE_URL}assets/img/og.jpg`, imageAlt: `${BRAND}: the Test Card Hoodie on a TV screen`,
})));

for (const p of PRODUCTS) {
  const colours = listing(p.colours.map(k => COLOURS[k].name));
  const desc = `${p.blurb} ${gbp(p.price)}, in ${colours}. Free UK delivery over ${gbp(SHIP.t48.freeOver)}.`;
  const html = template
    .replace(META_RE, metaBlock({
      title: `${p.name} · ${BRAND}`, desc, url: productUrl(p), type: "product",
      image: shareImage(p), imageAlt: `${p.name} in ${COLOURS[p.colours[0]].name}`,
      extra: [
        `<meta property="product:price:amount" content="${p.price.toFixed(2)}">`,
        `<meta property="product:price:currency" content="GBP">`,
        productLd(p),
      ],
    }))
    // Product pages sit two folders down, so every relative address starts from the site root.
    .replace(/<meta charset="utf-8">/, `<meta charset="utf-8">\n  <base href="../../">`)
    .replace(/<html lang="en-GB">/, `<html lang="en-GB" data-product="${p.id}" data-home-title="${esc(HOME.title)}">`);
  out.set(path.join(DOCS, "p", p.id, "index.html"), html);
}

// Terms, returns and privacy pages: one folder down, sharing the site's styles.
const noindex = /<meta name="robots" content="noindex">/.test(template);
const policyLinks = `<nav class="foot-links" aria-label="Policies">${policies.map(pg => `<a href="${pg.dir}/">${esc(pg.title)}</a>`).join("")}</nav>`;
for (const pg of policies) {
  out.set(path.join(DOCS, pg.dir, "index.html"), `<!doctype html>
<html lang="en-GB">
<head>
  <meta charset="utf-8">
  <base href="../">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${esc(pg.title)} · ${esc(BRAND)}</title>
  <meta name="description" content="${esc(pg.desc)}">
  <link rel="canonical" href="${SITE_URL}${pg.dir}/">
${noindex ? '  <meta name="robots" content="noindex">\n' : ""}  <meta name="theme-color" content="#0C0C10">
  <link rel="icon" href="favicon.svg" type="image/svg+xml">
  <link rel="stylesheet" href="assets/css/site.css">
</head>
<body>
<a class="skip" href="${pg.dir}/#main">Skip to content</a>
<header class="site-head legal-head">
  <div class="wrap head-row">
    <a class="logo" href="./" aria-label="${esc(BRAND)} home"><span class="logo-bars" aria-hidden="true"><i style="background:#C8C8C8"></i><i style="background:#E9DF00"></i><i style="background:#00CFD6"></i><i style="background:#00BF3A"></i><i style="background:#D000C4"></i><i style="background:#E3141C"></i><i style="background:#1426E0"></i></span><span>${esc(BRAND)}</span></a>
    <a class="btn" href="./#shop">Back to the shop</a>
  </div>
</header>
<main class="wrap legal" id="main">
${pg.body.replace(/^\n/, "")}
</main>
<footer class="foot">
  <div class="wrap foot-small">
    <span class="foot-legal">${companyLine}</span>
    ${policyLinks}
  </div>
</footer>
</body>
</html>
`);
}

const urls = [SITE_URL, ...PRODUCTS.map(productUrl), ...policies.map(pg => `${SITE_URL}${pg.dir}/`)];
out.set(path.join(DOCS, "sitemap.xml"), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map(u => `  <url><loc>${u}</loc></url>`).join("\n")}\n</urlset>\n`);
out.set(path.join(DOCS, "robots.txt"), `# Only read by search engines when the site is on its own domain.\nUser-agent: *\nAllow: /\nSitemap: ${SITE_URL}sitemap.xml\n`);

// GitHub Pages shows 404.html at whatever address was asked for, so it needs an absolute base.
const notFound = fs.readFileSync(path.join(DOCS, "404.html"), "utf8").replace(/\n  <base href="[^"]*">/, "");
out.set(path.join(DOCS, "404.html"), notFound.replace(/<meta charset="utf-8">/, `<meta charset="utf-8">\n  <base href="${BASE_PATH}">`));

// Product pages for products that no longer exist.
const pDir = path.join(DOCS, "p");
const stale = fs.existsSync(pDir) ? fs.readdirSync(pDir).filter(d => !PRODUCTS.some(p => p.id === d)) : [];

const changed = [...out].filter(([f, s]) => !fs.existsSync(f) || fs.readFileSync(f, "utf8") !== s).map(([f]) => f);
const rel = f => path.relative(path.dirname(DOCS), f);
if (CHECK) {
  if (changed.length || stale.length) {
    console.log("Out of date. Run: node tools/build-pages.cjs");
    [...changed, ...stale.map(d => path.join(pDir, d))].forEach(f => console.log(`  ${rel(f)}`));
    process.exit(1);
  }
  console.log("Pages are up to date.");
} else {
  for (const f of changed) {
    fs.mkdirSync(path.dirname(f), { recursive: true });
    fs.writeFileSync(f, out.get(f));
    console.log(`wrote   ${rel(f)}`);
  }
  for (const d of stale) {
    fs.rmSync(path.join(pDir, d), { recursive: true });
    console.log(`removed ${rel(path.join(pDir, d))}`);
  }
  console.log(changed.length || stale.length ? "Done." : "Nothing to change.");
}
