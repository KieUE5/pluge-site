# PLUGE shop

The website for PLUGE, a placeholder streetwear label. It's a static site (plain HTML, CSS and JavaScript, no build step) served by GitHub Pages from the `docs/` folder.

> **Preview status:** the shop isn't taking orders. Checkout and the drop-alert sign-up show a "preview" message, and search engines are told not to index the site. See [Before taking real orders](#before-taking-real-orders).

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

## What's where

| Path | What it is |
|---|---|
| `docs/index.html` | The page |
| `docs/assets/js/catalog.js` | **Products, prices, sizes, stock, colours, delivery prices and the drop date.** Edit this to change the shop. |
| `docs/assets/js/site.js` | Page behaviour: TV hero, grid, product sheet, bag, animations |
| `docs/assets/css/site.css` | Styles |
| `docs/assets/img/products/` | Product photos, one per product, colour and view, at 1000×1200 and 500×600 |
| `docs/assets/fonts/` | Self-hosted Archivo and IBM Plex Mono (SIL Open Font License, licences included) |
| `tools/` | Turns the blank product photos into every colour with the prints applied |

### Common edits

- **Change a price, mark a size sold out or add a colour:** edit the product in `docs/assets/js/catalog.js`. A new colour also needs photos (see below).
- **Rename the brand:** change `BRAND` in `catalog.js`, and replace "PLUGE" in `docs/index.html`, `docs/404.html` and `tools/recipes.cjs`, then rebuild the photos.
- **Change the Drop 02 date:** `DROP_02` in `catalog.js`.

## Product photos

The garments started as blank mid-grey product photos generated with Figma AI. `tools/` recolours each one and applies the prints (screen print, puff print, embroidery, woven labels and knitted sock stripes), so every colourway comes from the same photo and matches exactly.

```bash
cd tools
./fetch-blanks.sh          # downloads the blank photos listed in blanks.tsv into tools/blanks
npm install                # Playwright and the fonts used for the prints
npm run build-images       # writes docs/assets/img/products/*.webp
node build-meta.cjs        # writes the social share image and the iPhone icon
```

- **Print positions and colours** live in `tools/recipes.cjs`. Positions are fractions of the garment's outline.
- **Swapping in real photos:** shoot each blank garment in mid-grey on a white background, save it as `tools/blanks/<garment>-<view>.png`, and rebuild.

## Before taking real orders

- [ ] **Payments.** The quickest options for a static site are the [Shopify Buy Button](https://www.shopify.com/buy-button) or [Stripe Payment Links](https://stripe.com/payments/payment-links). Make guest checkout the default and show Apple Pay, Google Pay and PayPal. The final button must say "Pay now" or "Place order and pay".
- [ ] **Photos.** Real on-model photos, with the model's height and size ("Model is 185cm, wears L").
- [ ] **Company details.** Fill in the bracketed placeholders in the footer of `docs/index.html`: company name and number, registered office, VAT number and contact email.
- [ ] **Policy pages.** Add privacy, terms, cookies, and returns with a model cancellation form.
- [ ] **Drop alerts.** Connect an email tool that records consent and puts an unsubscribe link in every email, then replace the preview message in `site.js`.
- [ ] **Stock.** Keep "Low stock", "Sold out" and the countdown true to reality (DMCC Act 2024 / CMA guidance).
- [ ] **Search.** Remove `<meta name="robots" content="noindex">` from `docs/index.html`, and take the preview line out of the ticker.
- [ ] **Brand name.** Check the UK IPO trade mark register (class 25) for whatever name you launch with.
