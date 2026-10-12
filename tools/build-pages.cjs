// Writes every page of the site from docs/index.html, which is the home page and also the template:
// its header, footer and drawers are shared, and its <!-- home --> ... <!-- /home --> block is swapped for
// each page's own content. It writes:
//   docs/index.html            the share and search tags, footer business details and social links
//   docs/p/<id>/index.html     a full page for every product (gallery, sizes, tabs, complete the look)
//   docs/about/, faq/, contact/  the brand pages (tools/pages.cjs)
//   docs/terms/, returns/, privacy/  the policy pages (tools/policies.cjs)
//   docs/sitemap.xml, docs/robots.txt, and the base address in docs/404.html
//
// Run it after changing docs/index.html, catalog.js or the page texts. It needs Node but no npm install.
// GitHub runs it for you when you push (see .github/workflows/rebuild-pages.yml).
//   node tools/build-pages.cjs          write the files
//   node tools/build-pages.cjs --check  only report whether they're up to date (exit code 1 if not)
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const DOCS = path.resolve(__dirname, "..", "docs");
const CHECK = process.argv.includes("--check");

const sandbox = { window: {} };
vm.runInNewContext(fs.readFileSync(path.join(DOCS, "assets", "js", "catalog.js"), "utf8"), sandbox);
const { BRAND, SITE_URL, PRODUCTS, COLOURS, CATS, SHIP, COMPANY, SOCIAL = {}, CONTACT = {}, CARE, GUIDES, LOOKS } = sandbox.window.PLUGE;
const policies = require("./policies.cjs")({ BRAND, COMPANY, SHIP, CONTACT });
const brandPages = require("./pages.cjs")({ BRAND, COMPANY, SHIP, CARE, CONTACT });
if (!/^https?:\/\/[^/]+\/(.*\/)?$/.test(SITE_URL)) throw new Error(`SITE_URL in catalog.js must be a full address ending in "/", not "${SITE_URL}"`);
const BASE_PATH = new URL(SITE_URL).pathname;
const SHIP1 = SHIP[Object.keys(SHIP)[0]];

const HOME = {
  title: `${BRAND} · Drop 01: Test Pattern`,
  desc: `${BRAND} makes streetwear to order. Drop 01, Test Pattern: hoodies, tees, joggers and accessories printed with TV colour bars.`,
  shareDesc: "Streetwear printed with the colour bars a telly shows when the signal drops, made to order.",
};

const esc = s => String(s).replace(/[&<>"]/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[ch]));
const gbp = n => Number.isInteger(n) ? `£${n}` : `£${n.toFixed(2)}`;
const listing = arr => arr.length < 2 ? arr.join("") : `${arr.slice(0, -1).join(", ")} and ${arr[arr.length - 1]}`;
const isOut = (p, key, size) => (p.soldOut[key] || []).includes(size);
const inStock = p => p.colours.some(k => p.sizes.some(s => !isOut(p, k, s)));
const firstIn = p => p.colours.find(k => p.sizes.some(s => !isOut(p, k, s))) || p.colours[0];
const productUrl = p => `${SITE_URL}p/${p.id}/`;
const photo = (p, key, view = "front") => `${SITE_URL}assets/img/products/${p.id}-${key}-${view}.webp`;
const shareImage = p => fs.existsSync(path.join(DOCS, "assets", "img", "og", `${p.id}.jpg`)) ? `${SITE_URL}assets/img/og/${p.id}.jpg` : `${SITE_URL}assets/img/og.jpg`;
const catLabel = p => CATS.find(c => c.id === p.cat).label;
const ldScript = data => `<script type="application/ld+json">${JSON.stringify(data).replace(/</g, "\\u003c")}</script>`; // "<" escaped so the JSON can't close its own tag

function metaBlock({ title, desc, shareDesc = desc, url, image = `${SITE_URL}assets/img/og.jpg`, imageAlt = `${BRAND}: the Test Card Hoodie on a TV screen`, type = "website", extra = [] }) {
  return [
    "<!-- page-meta: tools/build-pages.cjs writes this block, here and on every other page -->",
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
  return ldScript({
    "@context": "https://schema.org",
    "@type": "Product",
    name: p.name,
    description: p.blurb,
    sku: p.id,
    url: productUrl(p),
    brand: { "@type": "Brand", name: BRAND },
    category: catLabel(p),
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
        shippingRate: { "@type": "MonetaryAmount", value: p.price >= SHIP1.freeOver ? 0 : SHIP1.fee, currency: "GBP" },
        shippingDestination: { "@type": "DefinedRegion", addressCountry: "GB" },
        deliveryTime: {
          "@type": "ShippingDeliveryTime",
          // Made to order: handling is Printful's making time, transit is what's left of the whole wait.
          handlingTime: { "@type": "QuantitativeValue", minValue: SHIP1.make[0], maxValue: SHIP1.make[1], unitCode: "DAY" },
          transitTime: { "@type": "QuantitativeValue", minValue: SHIP1.days[0] - SHIP1.make[0], maxValue: SHIP1.days[1] - SHIP1.make[1], unitCode: "DAY" },
        },
      },
      hasMerchantReturnPolicy: {
        "@type": "MerchantReturnPolicy",
        applicableCountry: "GB",
        returnPolicyCategory: "https://schema.org/MerchantReturnFiniteReturnWindow",
        merchantReturnDays: 14,
        returnMethod: "https://schema.org/ReturnByMail",
        returnFees: "https://schema.org/ReturnFeesCustomerResponsibility",
      },
    },
  });
}
const crumbsLd = trail => ldScript({
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: trail.map(([name, item], i) => ({ "@type": "ListItem", position: i + 1, name, item })),
});

const META_RE = /  <!-- page-meta:[\s\S]*?<!-- \/page-meta -->/;
const HOME_RE = /<!-- home:[^>]*-->[\s\S]*?<!-- \/home -->\n/;
const QUICKVIEW_RE = /<!-- quickview:[^>]*-->[\s\S]*?<!-- \/quickview -->\n\n?/;
const COMPANY_RE = /(<!-- company:[^>]*-->\s*)<span class="foot-legal">[\s\S]*?<\/span>(\s*<!-- \/company -->)/;
const SOCIAL_RE = /(<!-- social:[^>]*-->\s*)<ul class="social"[\s\S]*?<\/ul>(\s*<!-- \/social -->)/g;

// The footer line a UK sole trader selling under a brand name needs: their own name and a postal
// address. Empty details show as [square brackets].
const has = k => Boolean(COMPANY[k] && String(COMPANY[k]).trim());
const co = (k, placeholder) => has(k) ? esc(COMPANY[k]) : `[${placeholder}]`;
const companyLine = `${esc(BRAND)} is a trading name of ${co("traderName", "your name")}, a sole trader. Business address: ${co("address", "business address")}.` +
  `${has("vat") ? ` VAT no. ${esc(COMPANY.vat)}.` : ""} Email: ${has("email") ? `<a href="mailto:${esc(COMPANY.email)}">${esc(COMPANY.email)}</a>` : "[email address]"}.` +
  ` Prices in GBP${has("vat") ? ", including VAT" : ""}.`;

// Instagram and TikTok links, or "soon" while a handle is empty.
const ICONS = {
  instagram: `<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="3.5" width="17" height="17" rx="4.5"/><circle cx="12" cy="12" r="4"/><circle cx="17.2" cy="6.8" r=".6" fill="currentColor"/></svg>`,
  tiktok: `<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M13.5 3.5v11.2a3.3 3.3 0 1 1-3.3-3.3"/><path d="M13.5 3.5c.4 2.7 2.4 4.6 5 4.8"/></svg>`,
};
const SOCIALS = [
  { key: "instagram", label: "Instagram", url: h => `https://www.instagram.com/${h}/` },
  { key: "tiktok", label: "TikTok", url: h => `https://www.tiktok.com/@${h}` },
];
const handle = key => {
  const raw = String(SOCIAL[key] || "").trim().replace(/^https?:\/\/(www\.)?[a-z.]+\/@?/i, "").replace(/^@/, "").replace(/[/?#].*$/, "");
  if (raw && !/^[A-Za-z0-9._]{1,30}$/.test(raw)) throw new Error(`SOCIAL.${key} in catalog.js should be just the handle, like "pluge.shop", not "${SOCIAL[key]}"`);
  return raw;
};
const socialHtml = `<ul class="social">${SOCIALS.map(s => {
  const h = handle(s.key);
  return h ? `<li><a href="${s.url(h)}" rel="me noopener">${ICONS[s.key]}<span>${s.label}</span><span class="vh">: @${esc(h)}</span></a></li>`
    : `<li><span class="soon">${ICONS[s.key]}<span>${s.label}</span> <small>soon</small></span></li>`;
}).join("")}</ul>`;

let template = fs.readFileSync(path.join(DOCS, "index.html"), "utf8");
for (const [re, what] of [[META_RE, "<!-- page-meta --> ... <!-- /page-meta -->"], [HOME_RE, "<!-- home --> ... <!-- /home -->"], [QUICKVIEW_RE, "<!-- quickview --> ... <!-- /quickview -->"], [COMPANY_RE, "<!-- company --> ... <!-- /company -->"]]) {
  if (!new RegExp(re.source).test(template)) throw new Error(`docs/index.html has lost its ${what} block`);
}
if (/<base\b/.test(template)) throw new Error("docs/index.html shouldn't have a <base> tag; the other pages get their own");
template = template.replace(COMPANY_RE, `$1<span class="foot-legal">${companyLine}</span>$2`).replace(SOCIAL_RE, `$1${socialHtml}$2`);

const out = new Map(); // file path -> contents

out.set(path.join(DOCS, "index.html"), template.replace(META_RE, metaBlock({
  title: HOME.title, desc: HOME.desc, shareDesc: HOME.shareDesc, url: SITE_URL,
})));

// Any page but the home page: the shared header, footer and drawers around its own <main>, with a
// <base> so the site's relative addresses work from its folder.
function shellPage(dir, meta, main) {
  return template
    .replace(META_RE, meta)
    .replace(HOME_RE, () => `${main}\n`)
    .replace(QUICKVIEW_RE, "")
    .replace(/<meta charset="utf-8">/, `<meta charset="utf-8">\n  <base href="${"../".repeat(dir.split("/").length)}">`)
    .replace(/<a class="skip" href="#shop">[^<]*<\/a>/, `<a class="skip" href="${dir}/#main">Skip to content</a>`);
}

// ---- Product pages ------------------------------------------------------------
const imgSrc = (p, key, view, small) => `assets/img/products/${p.id}-${key}-${view}${small ? "-sm" : ""}.webp`;
// lazy: true to load when scrolled near, "high" for the page's main photo.
const art = (p, key, view, sizes, alt, lazy) => `<img class="product-img" src="${imgSrc(p, key, view)}" srcset="${imgSrc(p, key, view, true)} 500w, ${imgSrc(p, key, view)} 1000w" sizes="${sizes}"` +
  ` width="1000" height="1200" alt="${esc(alt)}"${lazy === "high" ? ' fetchpriority="high"' : lazy ? ' loading="lazy" decoding="async"' : ""} draggable="false">`;
const lookImg = (look, sizes, lazy) => `<img class="cover" src="assets/img/lookbook/${look.img}-${look.w}.webp" srcset="assets/img/lookbook/${look.img}-${look.w / 2}.webp ${look.w / 2}w, assets/img/lookbook/${look.img}-${look.w}.webp ${look.w}w" sizes="${sizes}"` +
  ` width="${look.w}" height="${look.h}" alt="${esc(look.alt)}"${lazy ? ' loading="lazy"' : ""} decoding="async" draggable="false"${look.pos ? ` style="object-position:${look.pos}"` : ""}>`;
// The same order as the gallery site.js draws: product photos, then on-model photos, the chosen
// colour and studio fit checks first.
function gallery(p, key) {
  const rank = x => (x.colour === key ? 0 : 2) + (x.look.model && x.look.model.wears[p.id] ? 0 : 1);
  const shots = LOOKS.flatMap(look => look.pieces.filter(([id]) => id === p.id).map(([, colour]) => ({ look, colour }))).sort((a, b) => rank(a) - rank(b));
  const items = [...p.views.map(view => ({ view })), ...shots];
  const odd = items.length % 2 === 1;
  return `<ul class="gal-track${odd ? " odd" : ""}" id="gal-track" data-colour="${key}">${items.map((it, i) => {
    const sizes = odd && i === 0 ? "(max-width: 900px) 100vw, 56vw" : "(max-width: 900px) 100vw, 28vw";
    if (it.view) return `<li class="gal-slide"><button class="gal-btn" type="button" data-i="${i}">${art(p, key, it.view, sizes, `${p.name} in ${COLOURS[key].name}, ${it.view} view`, i === 0 ? "high" : i > 1)}<span class="vh">Open full screen</span></button></li>`;
    const size = it.look.model && it.look.model.wears[p.id];
    const cap = (size ? `Model is ${it.look.model.height}cm and wears ${size}` : `Look ${it.look.n}: ${it.look.title}`) + (it.colour === key ? "" : ` · Shown in ${COLOURS[it.colour].name}`);
    return `<li class="gal-slide"><button class="gal-btn" type="button" data-i="${i}">${lookImg(it.look, sizes, i > 1)}<span class="vh">${esc(cap)}. Open full screen</span></button><p class="gal-cap" aria-hidden="true">${esc(cap)}</p></li>`;
  }).join("")}</ul>`;
}
const HEART = `<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20.5s-7.5-4.6-7.5-10.3A4.2 4.2 0 0 1 12 7.6a4.2 4.2 0 0 1 7.5 2.6c0 5.7-7.5 10.3-7.5 10.3Z"/></svg>`;
const pairCard = q => `<li><a class="card" href="p/${q.id}/"><span class="tilt"><span class="card-media">${art(q, firstIn(q), "front", "(max-width: 900px) 46vw, 31vw", "", true)}</span></span>` +
  `<span class="card-row"><span class="card-name">${esc(q.name)}</span><span class="card-price">${gbp(q.price)}</span></span></a></li>`;

function productMain(p) {
  const key = firstIn(p);
  return `<main class="pdp wrap" id="main">
<article id="pdp" data-id="${p.id}">
  <nav class="crumbs" aria-label="Breadcrumb"><ol><li><a href="./">Home</a></li><li><a href="./?cat=${p.cat}#shop">${esc(catLabel(p))}</a></li><li><span aria-current="page">${esc(p.name)}</span></li></ol></nav>
  <div class="pdp-grid">
    <section class="gallery" aria-label="Photos">
      ${gallery(p, key)}
      <div class="gal-bar"><div class="gal-dots" id="gal-dots"></div><p class="gal-count" id="gal-count" aria-hidden="true"></p></div>
    </section>
    <form class="pd-info pdp-info" id="pd-form">
      <div>
        <p class="eyebrow" id="pd-eyebrow">Drop 01 · ${esc(catLabel(p))}</p>
        <h1 class="pd-name wide" id="pd-name">${esc(p.name)}</h1>
      </div>
      <div class="pd-buy">
        <p class="pd-price" id="pd-price">${gbp(p.price)}</p>
        <p class="pd-ship" id="pd-ship">Made to order · ${esc(SHIP1.name)} £${SHIP1.fee.toFixed(2)}, free over ${gbp(SHIP1.freeOver)}</p>
      </div>
      <p class="pd-blurb" id="pd-blurb">${esc(p.blurb)}</p>
      <fieldset>
        <legend>Colour: <b id="pd-colour-name">${esc(COLOURS[key].name)}</b></legend>
        <div class="swatches" id="pd-swatches"></div>
      </fieldset>
      <div>
        <div class="size-head"><span class="legend" id="pd-size-label">Size</span><button class="link-btn size-guide-link" type="button" id="pd-guide-link">Size guide</button></div>
        <div class="sizes" id="pd-sizes" role="radiogroup" aria-labelledby="pd-size-label"></div>
      </div>
      <p class="stock-note" id="pd-stock" hidden></p>
      <p class="size-note" id="pd-size-note" role="status" hidden></p>
      <p class="pd-fit-note" id="pd-fit-note" hidden><span id="pd-fit-text"></span> <button class="link-btn" type="button" id="pd-fit-view">See the photo</button></p>
      <div class="pd-actions">
        <button class="btn primary block" type="submit" id="pd-add" disabled>Select a size</button>
        <button class="btn save-big" type="button" id="pd-save" aria-pressed="false" aria-label="Save">${HEART}</button>
      </div>
      <p class="pd-returns">14 days to change your mind · <button class="link-btn" type="button" id="pd-returns-link">Delivery and returns</button></p>
      <div class="tabs" id="pd-tabs" role="tablist" aria-label="Product information">
        <button class="tab" type="button" role="tab" id="tab-details" aria-controls="pd-details-wrap" aria-selected="true">Details</button>
        <button class="tab" type="button" role="tab" id="tab-size" aria-controls="pd-guide-wrap" aria-selected="false" tabindex="-1"${p.guide ? "" : " hidden"}>Size &amp; fit</button>
        <button class="tab" type="button" role="tab" id="tab-delivery" aria-controls="pd-returns-wrap" aria-selected="false" tabindex="-1">Delivery &amp; returns</button>
      </div>
      <div class="tabpanel" role="tabpanel" id="pd-details-wrap" aria-labelledby="tab-details">
        <p id="pd-fabric">${esc(p.fabric)}</p>
        <ul id="pd-details">${p.details.map(d => `<li>${esc(d)}</li>`).join("")}</ul>
        <p id="pd-deco">${esc(p.deco)}</p>
        <p id="pd-care">${esc(CARE[p.care])}</p>
      </div>
      <div class="tabpanel" role="tabpanel" id="pd-guide-wrap" aria-labelledby="tab-size" hidden>
        <p id="pd-guide-note"></p>
        <div class="units" id="pd-units" role="group" aria-label="Units">
          <button type="button" data-unit="cm" aria-pressed="true">cm</button>
          <button type="button" data-unit="in" aria-pressed="false">in</button>
        </div>
        <div class="guide" id="pd-guide"></div>
        <div class="finder" id="pd-finder">
          <p class="finder-title">Find your size</p>
          <label for="finder-in" id="finder-label">Lay a top that fits you well flat and measure straight across the chest, armpit to armpit (cm).</label>
          <div class="finder-row">
            <input id="finder-in" type="number" inputmode="decimal" min="10" max="100" step="0.5" placeholder="e.g. 60">
            <button class="btn" type="button" id="finder-go">Suggest</button>
          </div>
          <p class="finder-out" id="finder-out" role="status"></p>
        </div>
        <p id="pd-how"></p>
      </div>
      <div class="tabpanel" role="tabpanel" id="pd-returns-wrap" aria-labelledby="tab-delivery" hidden>
        <p>${esc(SHIP1.name)}: £${SHIP1.fee.toFixed(2)}, or free when your order is ${gbp(SHIP1.freeOver)} or more. Every piece is made to order, so it usually arrives ${SHIP1.days[0]}–${SHIP1.days[1]} working days after you order.</p>
        <p>Changed your mind? Tell us within 14 days of delivery, then send it back within 14 days. Return postage is yours to pay unless the piece is faulty. We refund within 14 days of getting it back, including the delivery charge you paid.</p>
        <p><a href="returns/">Returns, refunds and the cancellation form</a> · <a href="faq/">FAQ</a></p>
      </div>
    </form>
  </div>
  <section class="pdp-section" aria-labelledby="pairs-title">
    <div class="pdp-section-head">
      <div><p class="eyebrow">Pairs well with</p><h2 class="wide" id="pairs-title">Complete the look</h2></div>
      <button class="btn" type="button" id="look-kit" aria-haspopup="dialog">Shop the full look</button>
    </div>
    <ul class="grid" id="pd-pairs">${p.pairs.map(id => pairCard(PRODUCTS.find(q => q.id === id))).join("")}</ul>
  </section>
  <section class="recent" id="recent" aria-labelledby="recent-title" hidden>
    <div class="recent-head">
      <h2 class="eyebrow" id="recent-title">Recently viewed</h2>
      <button class="link-btn" type="button" id="recent-clear">Clear</button>
    </div>
    <ul class="recent-row" id="recent-row"></ul>
  </section>
</article>
</main>
<aside class="buybar" id="buybar" aria-label="Add to bag" inert>
  <div class="buybar-txt"><span class="buybar-name" id="buybar-name">${esc(p.name)}</span><span class="buybar-opt" id="buybar-opt">${gbp(p.price)}</span></div>
  <button class="btn primary" type="button" id="buybar-add">Select size</button>
</aside>
<dialog class="lightbox" id="lightbox" aria-label="Photos of the ${esc(p.name)}">
  <ul class="lb-track" id="lb-track" tabindex="0" aria-label="Photos. Use the arrow keys to move between them."></ul>
  <p class="lb-count" id="lb-count" aria-live="polite"></p>
  <button class="x lb-close" type="button" id="lb-close" aria-label="Close photos">×</button>
  <button class="lb-nav lb-prev" type="button" id="lb-prev" aria-label="Previous photo">←</button>
  <button class="lb-nav lb-next" type="button" id="lb-next" aria-label="Next photo">→</button>
  <p class="lb-hint" aria-hidden="true">Tap or click to zoom</p>
</dialog>`;
}

for (const p of PRODUCTS) {
  const colours = listing(p.colours.map(k => COLOURS[k].name));
  const desc = `${p.blurb} ${gbp(p.price)}, in ${colours}. Made to order, with free UK delivery over ${gbp(SHIP1.freeOver)}.`;
  const meta = metaBlock({
    title: `${p.name} · ${BRAND}`, desc, url: productUrl(p), type: "product",
    image: shareImage(p), imageAlt: `${p.name} in ${COLOURS[p.colours[0]].name}`,
    extra: [
      `<meta property="product:price:amount" content="${p.price.toFixed(2)}">`,
      `<meta property="product:price:currency" content="GBP">`,
      productLd(p),
      crumbsLd([["Home", SITE_URL], [catLabel(p), `${SITE_URL}?cat=${p.cat}`], [p.name, productUrl(p)]]),
    ],
  });
  out.set(path.join(DOCS, "p", p.id, "index.html"), shellPage(`p/${p.id}`, meta, productMain(p)));
}

// ---- About, FAQ, contact, and the policy pages ----------------------------------
for (const pg of brandPages) {
  const url = `${SITE_URL}${pg.dir}/`;
  const meta = metaBlock({ title: `${pg.title} · ${BRAND}`, desc: pg.desc, url, extra: pg.ld ? [ldScript(pg.ld)] : [] });
  out.set(path.join(DOCS, pg.dir, "index.html"), shellPage(pg.dir, meta, `<main class="wrap page page-${pg.dir}" id="main">${pg.body.replace(/\n+$/, "")}\n</main>`));
}
for (const pg of policies) {
  const url = `${SITE_URL}${pg.dir}/`;
  const meta = metaBlock({ title: `${pg.title} · ${BRAND}`, desc: pg.desc, url });
  out.set(path.join(DOCS, pg.dir, "index.html"), shellPage(pg.dir, meta, `<main class="wrap legal" id="main">\n${pg.body.replace(/^\n/, "")}\n</main>`));
}

const urls = [SITE_URL, ...PRODUCTS.map(productUrl), ...[...brandPages, ...policies].map(pg => `${SITE_URL}${pg.dir}/`)];
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
