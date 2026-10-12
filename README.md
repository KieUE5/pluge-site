# PLUGE shop

The website for PLUGE, a placeholder streetwear label. It's a static site (plain HTML, CSS and JavaScript) served by GitHub Pages from the `docs/` folder. Live at **https://kieue5.github.io/pluge-site/**.

PLUGE is a **print-on-demand** shop. Nothing is made until someone buys it:

1. The shopper pays on Shopify's checkout.
2. [Printful](https://www.printful.com) prints or embroiders the piece and posts it to them.
3. You never hold stock.

Customers can create an **account** (stored in a [Supabase](https://supabase.com) database) that keeps their bag and saved pieces on every device and lists their orders.

> **Preview status:** the shop isn't taking orders yet. Checkout, accounts and the drop-alert sign-up show a "preview" message, and search engines are told not to index the site. To go live, follow [Go live](#go-live) below.

## What the site does

- **Home page:** opens on the full-screen campaign photo (the TV wall) with a Shop button. The Drop 01 grid comes straight after, with category and size filters. Then the lookbook, a "build the fit" flat lay that assembles as you scroll, the channel-surfing TV beside the brand story, and the Drop 02 countdown.
- **Product pages:** every product has a full page, like [`/p/test-card-hoodie/`](https://kieue5.github.io/pluge-site/p/test-card-hoodie/). It has:
  - big photos: front, back and on-model, which swipe on phones and open full screen to zoom;
  - colour and size pickers, with a sticky Add to bag bar once the button scrolls out of view;
  - tabs for Details, Size & fit (size guide in cm/in and a size finder) and Delivery & returns;
  - the model's height and size, made-to-order delivery estimates, and "Complete the look" with a one-step "Shop the full look".

  Each page has its own title, share image, and Google product and breadcrumb data. Product cards link to these pages.
- **Quick view:** on a computer, hovering a product card shows a Quick view button that opens the product in a pop-up. You can drag to turn the garment and zoom in, then go to the full page from there.
- **Lookbook:** five photos (three on location, two studio fit checks), plus the campaign photo at the top of the home page. "Shop" on any look adds its pieces to the bag in one go once you've picked sizes. "Shop the fit" does the same for the flat lay.
- **On phones:** a slide-out menu (categories, pages, account, saved and the motion switch), a header with just the menu, logo, search and bag, filter chips that scroll sideways, and buttons at least 44px tall.
- **Brand pages:** [Our story](https://kieue5.github.io/pluge-site/about/), an [FAQ](https://kieue5.github.io/pluge-site/faq/) (delivery prices and times come from `catalog.js`, so they stay in step), and [Contact us](https://kieue5.github.io/pluge-site/contact/) with a message form. Instagram and TikTok links sit in the footer and the menu.
- **Accounts:** sign up, sign in, reset a forgotten password. The account shows:
  - your orders, with a tracking link;
  - your bag and saved pieces, on any device;
  - your email, filled in at checkout.

  Shoppers can also change their password, sign out, or delete the account themselves.
- **Saved and recently viewed:** the heart on any piece keeps it in the Saved drawer, and a recently viewed row sits under the grid. Without an account they stay on that device.
- **Search:** the magnifier, or press <kbd>/</kbd> or <kbd>Ctrl</kbd>+<kbd>K</kbd> (<kbd>⌘</kbd>+<kbd>K</kbd> on a Mac). It understands colours ("grey"), sizes ("XL") and everyday words ("trousers", "jumper", "hat").
- **Policies:** terms of sale, returns (with the official cancellation form) and privacy and cookies, at `/terms/`, `/returns/` and `/privacy/`. Every page shares the same header, footer, bag, search and account panel.
- **Motion:** "Pause motion" in the header stops every animation, and the site starts paused for visitors whose device asks for reduced motion.

## The range

Each product is a standard Printful garment. `printful` in `catalog.js` names the one to pick.

| Product | Printful garment | Colours | Sizes | Price |
|---|---|---|---|---|
| Test Card Hoodie | Unisex Heavy Blend Hoodie (Gildan 18500) | Black, Sport Grey | S–3XL | £55 |
| Channel 00 Crewneck | Unisex Crew Neck Sweatshirt (Gildan 18000) | Sport Grey, Military Green | S–3XL | £50 |
| Off Air Tee | Garment-Dyed Heavyweight T-Shirt (Comfort Colors 1717) | White, Black | S–3XL | £30 |
| Colour Bars Tee | Garment-Dyed Heavyweight T-Shirt (Comfort Colors 1717) | White, Black | S–3XL | £32 |
| Static Joggers | Unisex Fleece Sweatpants (Cotton Heritage M7580), embroidered | Black | S–2XL | £48 |
| Broadcast Cap | Classic Dad Hat (Yupoong 6245CM), embroidered | Black, Khaki | One size | £26 |
| Interference Beanie | Cuffed Beanie (Yupoong 1501KC), embroidered | Black, Navy | One size | £22 |
| Signal Socks | Socks (all-over print) | Black | S, M, L | £14 |

The prices are suggestions that leave room for Printful's costs; change them in `catalog.js`. Before launch, check the following on Printful and update `catalog.js` where they differ:
- each garment's colours, sizes and size chart;
- the fabric details;
- the joggers' and socks' specs, which I couldn't confirm from Printful's own pages.

## Go live

You'll set up three free or low-cost accounts in this order: Shopify, then Printful, then Supabase. Each step ends with something to paste into `docs/assets/js/catalog.js`, or to send to whoever maintains the site.

### 1. Shopify (checkout and payments)

**Free to start:** sign up for a free [Shopify Partner account](https://www.shopify.com/partners) and create a *development store*. It costs nothing and takes test orders, so you can set everything up and test the whole checkout before paying. When you're ready to sell, transfer the store to yourself and pick a plan (Basic or above). Check [Shopify's UK pricing page](https://www.shopify.com/uk/pricing) for current prices and trials.

1. In **Settings**:
   - **Store details:** currency GBP.
   - **Taxes and duties:** prices include VAT.
   - **Shipping and delivery:** one UK rate, *UK delivery* at £4.99, free for orders of £75 or more (Shopify can do both in one rate). Keep this in step with `SHIP` in `catalog.js`.
   - **Payments:** Shopify Payments (this also gives Apple Pay and Google Pay) and PayPal.
   - **Policies:** paste in the text of this site's `/returns/`, `/privacy/` and `/terms/` pages.
2. Install Shopify's **Headless** sales channel, create a storefront, and copy its **public access token**.
3. Fill in `CHECKOUT` in `catalog.js` (the public token is meant to be visible, so it's fine to commit):
   ```js
   const CHECKOUT = { shopDomain: "your-store.myshopify.com", storefrontToken: "the public access token", apiVersion: "2026-07", syncStock: true };
   ```
   Shopify releases a new API version every three months and supports each for about a year, so update `apiVersion` once a year.

### 2. Printful (making and posting orders)

1. Sign up free at [printful.com](https://www.printful.com) and connect it to your Shopify store (Printful's app in the Shopify App Store).
2. Build the print files: `cd tools && npm install && npm run build-print-files`. The files are already in `tools/print-files/`, and its `README.md` says which file goes where.
3. For each product in the table above, create it in Printful:
   1. Pick the named garment, then the colours and sizes listed.
   2. Upload the print files at the widths given.
   3. Set the retail price.
   4. **Name it exactly as the site does** (for example "Test Card Hoodie").
   5. Push it to Shopify.
4. In Shopify, add the products to the **Headless** sales channel. In **Products**, select them all and use the bulk action that adds products to a sales channel.
5. **Order samples** of everything. Check the print, the fit and the size charts, then photograph them to replace the AI photos.

The site matches each Shopify product by name (or URL handle), then by colour and size, so keep Printful's colour and size names the same as `catalog.js`. If something doesn't match, the browser console says which product. Once connected, the site uses Shopify's prices and availability, so what's shown is what's charged.

### 3. Supabase (customer accounts)

1. Create a free project at [supabase.com](https://supabase.com), in the London region.
2. **SQL Editor → New query:** paste in `tools/supabase/schema.sql` and click **Run**. This creates:
   - the tables for saved bags and orders;
   - the rules that keep each customer's data private;
   - the delete-my-account function.
3. **Authentication → URL Configuration:** set **Site URL** to `https://kieue5.github.io/pluge-site/` (or your own domain) and add the same address under **Redirect URLs**.
4. **Authentication → Sign In / Providers → Email:** leave **Confirm email** switched on. It stops anyone seeing orders for an email address they don't own.
5. **Authentication → Emails:** Supabase's built-in email is only for testing (it sends a handful of messages an hour). Before launch, connect a proper email service under **SMTP Settings**, and put your brand on the email templates.
6. **Project Settings → API:** copy the **Project URL** and the **anon public** key into `ACCOUNTS` in `catalog.js`. The anon key is meant to be public; the database rules protect the data.
7. **Orders in accounts:**
   1. In Supabase, go to **Edge Functions → Deploy a new function → Via editor**. Name it `shopify-orders`, paste in `tools/supabase/functions/shopify-orders/index.ts`, and deploy.
   2. In that function's settings, turn off **Verify JWT** (Shopify proves itself with its own signature instead).
   3. In Shopify, go to **Settings → Notifications → Webhooks** and create two JSON webhooks, **Order creation** and **Order update**. Point both at `https://<your-project>.supabase.co/functions/v1/shopify-orders`.
   4. Copy the signing secret Shopify shows there into a Supabase secret called `SHOPIFY_WEBHOOK_SECRET` (**Edge Functions → Secrets**).

Supabase's free plan suits a new shop. Free projects can be paused after a week without any activity, so check the project's dashboard if you go quiet for a while.

### 4. Your details, social links and the contact form

These need no accounts beyond what you already have. Fill them in at the top of `catalog.js`:

- **`COMPANY`:** as a sole trader selling under the name PLUGE, UK law says the site must show your own name and a postal address where documents can reach you. Use a virtual business address (from around £5–£20 a month) so your home address stays private. A PO box doesn't count. You can also add a separate `returnsAddress`.
- **`SOCIAL`:** your Instagram and TikTok handles, without the @. Until then the footer shows them as "soon".
- **`CONTACT`:** the contact form works straight away by opening the customer's email app with their message filled in, addressed to the shop email. To receive messages without that step:
  1. Make a free form at [formspree.io](https://formspree.io), signing up with `pluge.shop@outlook.com`.
  2. Paste its address (like `https://formspree.io/f/abcdwxyz`) into `formEndpoint`.

  The privacy page then names Formspree automatically.

### 5. Test, then launch

1. Turn on test mode in Shopify (**Settings → Payments**). Then, on the live site:
   - create an account;
   - place a test order with one of [Shopify's test cards](https://help.shopify.com/en/manual/checkout-settings/test-orders);
   - check the order reaches Printful and appears under **Your orders**.
2. Work through [Before taking real orders](#before-taking-real-orders).

> The checkout and accounts code was tested thoroughly against simulated Shopify and Supabase services, not real ones, because those can't be reached from where the site was built. Do the test order before announcing anything.

## Returns with print-on-demand

- Customers can change their mind within 14 days of delivery (UK law; your designs aren't personalised items, so the exemption doesn't apply). They pay return postage unless the piece is faulty.
- Returns come to **your** address (`returnsAddress` in `COMPANY`), not Printful's. Printful won't refund change-of-mind returns, so that refund comes out of your margin.
- Printful will usually reprint misprinted or damaged items at no cost if you report them quickly with photos. Check Printful's current returns policy for the time limit.
- Visiting `https://<your-site>/?ordered=1` empties the bag and thanks the shopper. Point any "back to the shop" link on Shopify's order status page at that address.

## What's where

| Path | What it is |
|---|---|
| `docs/index.html` | The home page, and the template for every other page: its header, footer and drawers are shared, and the part between `<!-- home -->` and `<!-- /home -->` is swapped for each page's own content |
| `docs/assets/js/catalog.js` | **Products, prices, colours, sizes, delivery, the lookbook, your business details, social handles, the contact form, and the Shopify and Supabase settings.** Edit this to change the shop. |
| `docs/assets/js/site.js` | Behaviour for every page: the home page, product pages, quick view, bag, checkout, accounts, menu and contact form |
| `docs/assets/js/vendor/` | Supabase's JavaScript library (MIT licence), loaded only when accounts are switched on |
| `docs/assets/css/site.css` | Styles |
| `docs/p/<product>/index.html` | Product pages. Made by `tools/build-pages.cjs`, so don't edit them by hand. |
| `docs/about/`, `docs/faq/`, `docs/contact/` | Brand pages, made by `tools/build-pages.cjs` from the text in `tools/pages.cjs` |
| `docs/terms/`, `docs/returns/`, `docs/privacy/` | Policy pages, made by `tools/build-pages.cjs` from `tools/policies.cjs` |
| `docs/sitemap.xml`, `docs/robots.txt` | Made by `tools/build-pages.cjs` |
| `docs/assets/img/products/` | Product photos for each product, colour and view, at 1000×1200 and 500×600 |
| `docs/assets/img/lookbook/` | Lookbook photos at full and half width, and `hero-tall`, the campaign photo cut to portrait for phones |
| `docs/assets/img/og/` | Share images for each product (what appears when a link is posted) |
| `docs/assets/fonts/` | Self-hosted Archivo and IBM Plex Mono (SIL Open Font License, licences included) |
| `tools/print-files/` | Print-ready artwork for Printful, with a guide to where each file goes |
| `tools/supabase/` | The accounts database setup (`schema.sql`) and the Shopify orders function |
| `tools/` | Scripts that build the photos, print files, product pages and share images |
| `.github/workflows/rebuild-pages.yml` | Rebuilds the product, brand and policy pages automatically after you push |

### Common edits

Edit `docs/index.html`, `catalog.js` or the page texts in `tools/` (on your computer, or with the pencil icon on GitHub) and push. A GitHub workflow then rebuilds every page from them, commits them as "Rebuild product and policy pages", and republishes the site, usually within two minutes. You can watch it under the repository's **Actions** tab.

To rebuild on your own computer instead, run `node tools/build-pages.cjs` (it needs Node, nothing else). `node tools/build-pages.cjs --check` tells you whether anything is out of date.

- **Add your business details:** fill in `COMPANY` at the top of `catalog.js`: your name, business address, returns address if different, VAT number if you register, and email. They appear in the footer and on the terms, returns, privacy and contact pages.
- **Change the About or FAQ text:** edit `tools/pages.cjs`. The policy texts are in `tools/policies.cjs`.
- **Change a price or add a colour:** edit the product in `catalog.js`, and make the same change in Printful. A new colour also needs photos (see below).
- **Rename the brand:** change `BRAND` in `catalog.js`, then replace "PLUGE" in:
  - `docs/index.html` and `docs/404.html`;
  - `tools/recipes.cjs`, `tools/meta.html` and `tools/build-print-files.cjs`.

  Then rebuild the photos, print files, share images and pages.
- **Change the Drop 02 date:** `DROP_02` in `catalog.js`.
- **Change the lookbook:** `LOOKS` in `catalog.js` lists each photo, its title, the pieces in it and, for fit checks, the model's height and sizes.

## Photos and print files

All photos on the site are AI-generated placeholders, made with Figma AI. Replace them with photos of your samples before launch.

```bash
cd tools
npm install                # Playwright and the fonts used for the prints
npm run build-images       # product photos: docs/assets/img/products/*.webp
npm run build-print-files  # artwork for Printful: tools/print-files/*.png
npm run build-lookbook     # docs/assets/img/lookbook/*.webp from tools/lookbook/
npm run build-meta         # share images (site and per product) and the iPhone icon
npm run build-pages        # product, brand and policy pages, sitemap and robots.txt
```

- **Print positions and colours** for the product photos live in `tools/recipes.cjs`. The print files are listed in `tools/build-print-files.cjs`.
- **The blank photos** are in `tools/blanks/`, and the lookbook originals in `tools/lookbook/`.
- **Other brands' logos:** TV makers' names and a trainer brand have been retouched out of the lookbook (`tools/retouch-lookbook.py`). The lookbook also shows cargo trousers we don't sell; the captions only list pieces in the shop.

## Speed and accessibility

Checked on 12 October 2026 against a local copy of the site, compressed the way GitHub Pages serves it:

| Lighthouse | Performance | Accessibility | Best practices |
|---|---|---|---|
| Home page, phone | 96 | 100 | 100 |
| Product page, phone | 93 | 100 | 100 |
| Our story, phone | 98 | 100 | 100 |
| Home and product page, desktop | 99–100 | 100 | 100 |

- On a phone, the campaign photo appears in about 2.6 seconds, and nothing shifts while the page loads. The sections further down are drawn just after it. The SEO score stays low until the `noindex` preview tag comes off.
- [axe](https://github.com/dequelabs/axe-core) found no WCAG 2.2 AA problems in 74 scans. Each of these was checked in light and dark mode, on desktop and phone:
  - the home page, before and after use
  - quick view and its on-model view
  - bag, saved, shop-the-look, search and the account panel
  - the phone menu
  - a product page with its tabs, buy bar and full-screen photos
  - Our story, FAQ, Contact us and the three policy pages
- Everything works by keyboard. Dialogs trap focus and return it when they close.

## Before taking real orders

- [ ] **Shopify, Printful and Supabase** set up as in [Go live](#go-live), and a test order placed end to end.
- [ ] **Samples.** Order a sample of every piece, check the print, fit and size charts against `catalog.js`, and replace the AI photos with photos of the real pieces.
- [ ] **Account emails.** Connect a proper email service to Supabase (step 3.5) so sign-up and password emails always arrive.
- [ ] **Your details.** Fill in your name and a virtual business address in `COMPANY` in `catalog.js` (see [step 4](#4-your-details-social-links-and-the-contact-form)). Until then the footer, policy and contact pages show [square brackets].
- [ ] **Social and contact.** Add your Instagram and TikTok handles, and a Formspree form if you'd like messages without the email app step.
- [x] **Policy pages.** Terms, returns (14 days, customer pays return postage) and privacy are written for print-on-demand and accounts. Have a solicitor read them, and add your email provider by name to the privacy page once drop alerts are connected.
- [ ] **Drop alerts.** Connect an email tool that records consent and puts an unsubscribe link in every email, then replace the preview message in `site.js`.
- [ ] **Honest selling.** With print-on-demand nothing sells out, so don't show "low stock" or "selling fast". A countdown must match a real deadline (DMCC Act 2024 / CMA guidance).
- [ ] **Search engines.** Remove `<meta name="robots" content="noindex">` from `docs/index.html`, and take the preview line out of the ticker and the note under the lookbook. The pages rebuild when you push.
- [ ] **Brand name.** Web searches on 12 October 2026 found no clothing brand called PLUGE. The nearest were a US trade mark "THE PLUG" for clothing and the New York label Plugged NYC. That isn't a register search: before launch, search "PLUGE" in class 25 on the [UK IPO register](https://trademarks.ipo.gov.uk/ipo-tmtext) (free, a couple of minutes), and consider filing your own application.
