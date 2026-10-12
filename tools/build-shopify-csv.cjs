// Writes tools/shopify-products.csv: every product, colour and size from catalog.js in Shopify's
// product import format, with photos linked from the live site. Import it in Shopify admin under
// Products > Import. Needs Node but no npm install.
//   node tools/build-shopify-csv.cjs
//
// The site finds each Shopify variant by the product's handle (its id here) and its Colour and Size
// option values, so keep those exactly as this file writes them.
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const DOCS = path.resolve(__dirname, "..", "docs");
const sandbox = { window: {} };
vm.runInNewContext(fs.readFileSync(path.join(DOCS, "assets", "js", "catalog.js"), "utf8"), sandbox);
const { BRAND, SITE_URL, PRODUCTS, COLOURS, CATS, CARE } = sandbox.window.PLUGE;

// Starting stock for every size that isn't marked sold out. Change it in Shopify after importing.
const STOCK = 20;
// Rough packed weights in grams, for weight-based delivery rates. Weigh the real pieces before launch.
const GRAMS = { fleece: 900, tees: 320, bottoms: 750, acc: 150 };
const TYPES = { fleece: "Sweatshirt", tees: "T-shirt", bottoms: "Trousers", acc: "Accessory" };

const HEAD = [
  "Handle", "Title", "Body (HTML)", "Vendor", "Type", "Tags", "Published",
  "Option1 Name", "Option1 Value", "Option2 Name", "Option2 Value",
  "Variant SKU", "Variant Grams", "Variant Inventory Tracker", "Variant Inventory Qty", "Variant Inventory Policy",
  "Variant Fulfillment Service", "Variant Price", "Variant Requires Shipping", "Variant Taxable", "Variant Weight Unit",
  "Image Src", "Image Position", "Image Alt Text", "Variant Image", "SEO Title", "SEO Description", "Status",
];
const cell = v => {
  const s = v === undefined || v === null ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const html = s => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const isOut = (p, key, size) => (p.soldOut[key] || []).includes(size);
const photo = (p, key, view) => `${SITE_URL}assets/img/products/${p.id}-${key}-${view}.webp`;
const sku = (p, key, size) => [p.id.split("-").map(w => w[0]).join(""), key.slice(0, 3), size.replace(/[^A-Za-z0-9]+/g, "")].join("-").toUpperCase();

const rows = [];
for (const p of PRODUCTS) {
  const body = [
    `<p>${html(p.blurb)}</p>`,
    `<p>${html(p.fabric)}</p>`,
    `<ul>${p.details.map(d => `<li>${html(d)}</li>`).join("")}</ul>`,
    `<p>${html(p.deco)}</p>`,
    `<p>${html(CARE[p.care])}</p>`,
  ].join("");
  const images = p.colours.flatMap(k => p.views.map(v => ({ src: photo(p, k, v), alt: `${p.name} in ${COLOURS[k].name}, ${v} view` })));
  const start = rows.length;
  let first = true;
  for (const k of p.colours) {
    for (const size of p.sizes) {
      const row = {
        "Handle": p.id,
        "Option1 Value": COLOURS[k].name,
        "Option2 Value": size,
        "Variant SKU": sku(p, k, size),
        "Variant Grams": GRAMS[p.cat],
        "Variant Inventory Tracker": "shopify",
        "Variant Inventory Qty": isOut(p, k, size) ? 0 : STOCK,
        "Variant Inventory Policy": "deny",
        "Variant Fulfillment Service": "manual",
        "Variant Price": p.price.toFixed(2),
        "Variant Requires Shipping": "TRUE",
        "Variant Taxable": "TRUE",
        "Variant Weight Unit": "g",
        "Variant Image": photo(p, k, "front"),
      };
      if (first) {
        Object.assign(row, {
          "Title": p.name, "Body (HTML)": body, "Vendor": BRAND, "Type": TYPES[p.cat],
          "Tags": ["Drop 01", CATS.find(c => c.id === p.cat).label].join(", "), "Published": "TRUE",
          "Option1 Name": "Colour", "Option2 Name": "Size",
          "SEO Title": `${p.name} · ${BRAND}`, "SEO Description": p.blurb, "Status": "active",
        });
        first = false;
      }
      rows.push(row);
    }
  }
  // Shopify takes one image per row, so the product's images fill its variant rows in order and any
  // left over get rows of their own under the same handle.
  const own = rows.slice(start);
  images.forEach((img, i) => {
    if (!own[i]) { own[i] = { Handle: p.id }; rows.push(own[i]); }
    Object.assign(own[i], { "Image Src": img.src, "Image Position": i + 1, "Image Alt Text": img.alt });
  });
}

const out = path.join(__dirname, "shopify-products.csv");
fs.writeFileSync(out, [HEAD.join(","), ...rows.map(r => HEAD.map(h => cell(r[h])).join(","))].join("\n") + "\n");
console.log(`Wrote ${rows.length} rows for ${PRODUCTS.length} products to ${path.relative(process.cwd(), out)}`);
