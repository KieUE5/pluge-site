# PLUGE shop

The website for PLUGE, a placeholder streetwear label. It's a static site (plain HTML, CSS and JavaScript) served by GitHub Pages from the `docs/` folder. Live at **https://kieue5.github.io/pluge-site/**.

> **Preview status:** the shop isn't taking orders yet. Checkout and the drop-alert sign-up show a "preview" message, and search engines are told not to index the site. Checkout is ready to connect to Shopify: see [Take real orders with Shopify](#take-real-orders-with-shopify).

## What the site does

- **Shop:** a channel-surfing TV hero, the Drop 01 grid with category and size filters, and a "build the fit" flat lay that assembles as you scroll.
- **Product sheet:** drag to turn the garment, hover or double-tap to zoom, colour and size pickers, a size guide with cm/in and a size finder, delivery estimates, and an **on-model photo** with the model's height and size.
- **Product pages:** every product has its own address, like [`/p/test-card-hoodie/`](https://kieue5.github.io/pluge-site/p/test-card-hoodie/), with its own title, share image and Google product data. Opening a product changes the address, and Back closes it.
- **Lookbook:** six photos (four on location, two studio fit checks). "Shop" on any look adds every piece to the bag in one go once you've picked sizes. "Shop the fit" does the same for the flat lay.
- **Saved:** the heart on any piece keeps it in the Saved drawer (stored on that device only).
- **Recently viewed:** a row under the grid.
- **Search:** the magnifier, or press <kbd>/</kbd> or <kbd>Ctrl</kbd>+<kbd>K</kbd> (<kbd>⌘</kbd>+<kbd>K</kbd> on a Mac). It understands colours ("olive"), sizes ("XL") and everyday words ("trousers", "jumper", "hat").
- **Motion:** "Pause motion" in the header stops every animation, and the site starts paused for visitors whose device asks for reduced motion.

## Go live on GitHub Pages (one time)

1. In this repository on GitHub, open **Settings → Pages**.
2. Under **Build and deployment**, set **Source** to **Deploy from a branch**.
3. Choose branch **main** and folder **/docs**, then click **Save**.
4. After about a minute the site is live at `https://<your-username>.github.io/pluge-site/`.

Every push to `main` republishes the site automatically.

### Use your own domain (optional)

1. Buy a domain from any registrar.
2. In **Settings → Pages → Custom domain**, enter it and save. GitHub adds a `docs/CNAME` file.
3. At your registrar, point the domain at GitHub Pages ([GitHub's guide](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site)).
4. Tick **Enforce HTTPS** once it's available.
5. Change `SITE_URL` in `docs/assets/js/catalog.js` to the new address (ending in `/`) and push. The pages rebuild themselves (see below).

## What's where

| Path | What it is |
|---|---|
| `docs/index.html` | The page |
| `docs/assets/js/catalog.js` | **Products, prices, sizes, stock, colours, delivery prices, the lookbook, the drop date and the checkout settings.** Edit this to change the shop. |
| `docs/assets/js/site.js` | Page behaviour |
| `docs/assets/css/site.css` | Styles |
| `docs/p/<product>/index.html` | Product pages. Made by `tools/build-pages.cjs`, so don't edit them by hand. |
| `docs/terms/`, `docs/returns/`, `docs/privacy/` | Terms of sale, returns (with the cancellation form) and privacy and cookies. Made by `tools/build-pages.cjs` from `tools/policies.cjs`. |
| `docs/sitemap.xml`, `docs/robots.txt` | Made by `tools/build-pages.cjs` |
| `docs/assets/img/products/` | Product photos for each product, colour and view, at 1000×1200 and 500×600 |
| `docs/assets/img/lookbook/` | Lookbook photos at full and half width |
| `docs/assets/img/og/` | Share images for each product (what appears when a link is posted) |
| `docs/assets/fonts/` | Self-hosted Archivo and IBM Plex Mono (SIL Open Font License, licences included) |
| `tools/` | Scripts that build the photos, product pages, share images and the Shopify import file |
| `.github/workflows/rebuild-pages.yml` | Rebuilds the product and policy pages automatically after you push |

### Common edits

Edit `docs/index.html` or `catalog.js` (on your computer, or with the pencil icon on GitHub) and push. A GitHub workflow then rebuilds the product pages, policy pages and footer, commits them as "Rebuild product and policy pages", and republishes the site, usually within two minutes. You can watch it under the repository's **Actions** tab.

To rebuild on your own computer instead, run `node tools/build-pages.cjs` (it needs Node, nothing else). `node tools/build-pages.cjs --check` tells you whether anything is out of date.

- **Add your business details:** fill in `COMPANY` at the top of `catalog.js` (company name and number, registered office, returns address, VAT number, email). They appear in the footer and on the terms, returns and privacy pages; until then those pages show [square brackets].

- **Change a price, mark a size sold out or add a colour:** edit the product in `catalog.js`. A new colour also needs photos (see below). Once Shopify is connected, prices and stock come from Shopify instead.
- **Rename the brand:** change `BRAND` in `catalog.js`, replace "PLUGE" in `docs/index.html`, `docs/404.html`, `tools/recipes.cjs` and `tools/meta.html`, then rebuild the photos, share images and pages.
- **Change the Drop 02 date:** `DROP_02` in `catalog.js`.
- **Change the lookbook:** `LOOKS` in `catalog.js` lists each photo, its title, the pieces in it and, for fit checks, the model's height and sizes.

## Take real orders with Shopify

The bag is already wired to Shopify's Storefront API. Once it's connected, the site reads live stock and prices from Shopify, and **Checkout** sends the shopper to Shopify's own checkout to pay. Shopify then handles payment, delivery choice, VAT, order emails and refunds.

**Want to try it free first?** Sign up for a free [Shopify Partner account](https://www.shopify.com/partners) and create a *development store*. Development stores cost nothing and take test orders, so you can follow the steps below and test the whole checkout before paying. When you're ready to sell, transfer the store to yourself and pick a plan. Shopify's normal sign-up also has a short free trial; check [Shopify's UK pricing page](https://www.shopify.com/uk/pricing) for the current offer.

1. **Create a store** at [shopify.com](https://www.shopify.com) (Basic plan or higher), or a development store as above. In **Settings**:
   - **Store details:** currency GBP.
   - **Taxes and duties:** prices include VAT.
   - **Shipping and delivery:** add *Royal Mail Tracked 48* at £4.95 with a free version for orders of £75 or more, and *Royal Mail Tracked 24* at £5.95. Keep these in step with `SHIP` in `catalog.js`, which the site uses for its estimates.
   - **Payments:** turn on Shopify Payments (this also gives Apple Pay and Google Pay) and add PayPal.
   - **Policies:** add a refund policy (30-day free returns, plus the legal 14-day right to cancel), privacy policy and terms.
2. **Import the products.** Run `node tools/build-shopify-csv.cjs`, then in Shopify go to **Products → Import** and upload `tools/shopify-products.csv`. It has every colour and size with photos linked from this site.
   - Stock is set to 20 per size (0 for sizes marked sold out), and the weights are estimates. Change both in Shopify.
   - Don't rename the products' URL handles or their **Colour** and **Size** option values: that's how the site finds each variant.
3. **Create a Storefront token.** Install Shopify's **Headless** sales channel, create a storefront, and copy its **public access token**. Then make all the products available on the Headless sales channel: in **Products**, select them all and use the bulk action that adds products to a sales channel.
4. **Connect the site.** In `catalog.js`, fill in `CHECKOUT`:
   ```js
   const CHECKOUT = {
     shopDomain: "your-store.myshopify.com",
     storefrontToken: "the public access token",
     apiVersion: "2026-07",
     syncStock: true,
   };
   ```
   The public token is designed to be visible in a website, so it's fine to commit. Shopify releases a new API version every three months and supports each for about a year; update `apiVersion` once a year.
5. **Test it.** Turn on test mode in **Settings → Payments**, push, and place a test order on the live site with one of [Shopify's test cards](https://help.shopify.com/en/manual/checkout-settings/test-orders).
6. **Go live.** Turn test mode off and work through the checklist below.

> The checkout code was tested against a simulated Shopify store, not a real one. Do a test order (step 5) before announcing anything.

**Good to know**

- If a size sells out in Shopify, the site shows it as sold out on the next page load. If it sells out while someone has it in their bag, Checkout tells them which piece to remove.
- Shopify doesn't tell this site when an order is paid, so the bag here isn't emptied automatically. Visiting `https://<your-site>/?ordered=1` empties it and thanks the shopper, so point any "back to the shop" link you add to Shopify's order status page at that address.

## Photos

All photos on the site are AI-generated placeholders, made with Figma AI.

**Product photos.** The garments started as blank mid-grey photos. `tools/` recolours each one and applies the prints (screen print, puff print, embroidery, woven labels and knitted sock stripes), so every colourway comes from the same photo and matches exactly.

```bash
cd tools
npm install                # Playwright and the fonts used for the prints
npm run build-images       # docs/assets/img/products/*.webp
npm run build-lookbook     # docs/assets/img/lookbook/*.webp from tools/lookbook/
npm run build-meta         # share images (site and per product) and the iPhone icon
npm run build-pages        # product pages, sitemap and robots.txt
```

- **Print positions and colours** live in `tools/recipes.cjs`. Positions are fractions of the garment's outline.
- **The blank photos** are saved in `tools/blanks/`, and the lookbook originals in `tools/lookbook/`. (The Figma links they came from expire after seven days.)
- **Swapping in real product photos:** shoot each blank garment in mid-grey on a white background, save it as `tools/blanks/<garment>-<view>.png`, and rebuild.
- **Swapping in real lookbook photos:** replace the files in `tools/lookbook/` (same names, or update `LOOKS` in `catalog.js`), run `npm run build-lookbook`, and update the model heights and sizes in `LOOKS`.

## Speed and accessibility

Checked on 12 October 2026 against a local copy of the site:

| | Performance | Accessibility | Best practices |
|---|---|---|---|
| Lighthouse, phone | 95 | 100 | 100 |
| Lighthouse, desktop | 100 | 100 | 100 |

- Phone: first paint 1.5s, largest paint 2.9s, layout shift 0. The SEO score stays low until the `noindex` preview tag comes off.
- [axe](https://github.com/dequelabs/axe-core) found no WCAG 2.2 AA problems in 32 scans: the page, product sheet, on-model view, bag, saved, shop-the-look and search, each in light and dark mode on desktop and phone.
- Everything works by keyboard. Dialogs trap focus and return it when they close.

## Before taking real orders

- [ ] **Payments.** Connect Shopify ([steps above](#take-real-orders-with-shopify)) and place a test order. Use guest checkout as the default.
- [ ] **Photos.** Replace the AI-generated product and lookbook photos with real ones, and update the model heights and sizes in `LOOKS` (`catalog.js`). Other companies' logos (TV makers' names, the trainer brand) have been retouched out of the current lookbook (`tools/retouch-lookbook.py`).
- [ ] **Company details.** Fill in `COMPANY` in `catalog.js`. Until then the footer and policy pages show [square brackets].
- [x] **Policy pages.** Terms of sale, returns with the model cancellation form, and privacy and cookies are at `/terms/`, `/returns/` and `/privacy/`. Have a solicitor read them before you sell, and add your email provider by name to the privacy page once drop alerts are connected.
- [ ] **Drop alerts.** Connect an email tool that records consent and puts an unsubscribe link in every email, then replace the preview message in `site.js`.
- [ ] **Stock.** Keep "Low stock", "Sold out" and the countdown true to reality (DMCC Act 2024 / CMA guidance).
- [ ] **Search engines.** Remove `<meta name="robots" content="noindex">` from `docs/index.html` and take the preview line out of the ticker and the note under the lookbook. The pages rebuild when you push.
- [ ] **Brand name.** Web searches on 12 October 2026 found no clothing brand called PLUGE. The nearest names were a US trade mark "THE PLUG" for clothing and the New York label Plugged NYC. That isn't a register search: before launch, search "PLUGE" in class 25 on the [UK IPO register](https://trademarks.ipo.gov.uk/ipo-tmtext) (free, a couple of minutes), and consider filing your own application.
