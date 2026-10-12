# Research notes: PLUGE shop

Research run on 12 Oct 2026 to ground the shop in real streetwear, UX and UK retail practice.

**How it was gathered:** direct page fetches were blocked from the research environment, so every finding below comes from web-search summaries of the listed sources. Check exact figures and legal wording against the live pages before launch.

## Brand name

- The first placeholder name, "NO SIGNAL", is already used by a London radio and media brand that has sold merch (a Daily Paper collaboration, per search results). The shop was renamed to **PLUGE**: picture line-up generation equipment, the near-black bars on a TV test card.
- A quick search found no clothing brand called PLUGE. Before launch, check the UK IPO trade mark register (class 25) for any name you pick.
- The BBC owns Test Card F (the girl and clown image). The site only uses generic SMPTE-style colour bars, drawn from scratch.

## What changed on the site, and why

| Change | Evidence |
|---|---|
| Delivery price, free-delivery threshold and an estimated delivery date on every product page | Baymard: unexpected extra costs are the top checkout-abandonment reason. Testers read a dated estimate as a promise, and 41% of sites don't show one. CMA209 says mandatory delivery charges belong in the invitation to purchase. |
| Size guide link next to the sizes, cm/in toggle, how-to-measure note, "find your size" helper | Baymard: 83% of desktop and 87% of mobile apparel sites give too little sizing information, and 84% of test participants used it |
| Size filter on the shop grid | Baymard: 39% of testers only found out on the product page that their size had sold out |
| Sold-out sizes stay selectable, with "Notify me when it's back" | Baymard: hide nothing, and offer a path for out-of-stock sizes. It found pre-orders work better than email alerts, so consider those later |
| Tap and double-tap zoom (not just a hover lens) | Baymard: up to 40% of sites don't support mobile image gestures |
| "Complete the look" on product pages, plus "Continue shopping" and a highlight on the item just added in the bag | Baymard guidance on add-to-bag confirmation and relevant cross-sells |
| Royal Mail Tracked 48 (£4.95, free over £75) and Tracked 24 (£5.95), dispatch in 1–2 working days | Royal Mail online prices from 7 Apr 2026: Tracked 48 small parcel £3.65, Tracked 24 £4.65. Peers: Palace £5, Daily Paper £5, Trapstar £5.45 (free over £160) |
| Statutory cancellation wording: 14 days to cancel, refund within 14 days including standard delivery | Consumer Contracts Regulations 2013 |
| Footer placeholders for company name, number, registered office, VAT number and contact email | E-Commerce Regulations 2002 reg. 6 and the Company, Limited Liability Partnership and Business (Names and Trading Disclosures) Regulations 2015 |
| Unticked consent box on the drop-alert sign-up | PECR and ICO guidance: the "soft opt-in" does not cover sign-ups from people who aren't customers |
| TV hero: play/pause button, rotation stops when you pick a channel, no auto-rotation on phones, pauses on hover and focus, slide labels | WCAG 2.2.2 (Pause, Stop, Hide), the W3C carousel tutorial and the ARIA Authoring Practices carousel pattern; NN/g advises against auto-advance on mobile |
| Sitewide "Pause motion" button that turns off the grain, glitches, tilt, marquee and scroll-scrubbed sections, and respects the OS reduced-motion setting | WCAG 2.2.2 (one control for several moving elements) and 2.3.3; GSAP accessibility guidance |
| Specs: 450gsm brushed-back fleece (Ash shown as a 90/10 heather), 280gsm jersey, puff and screen prints, jacquard-knit socks, cap fits 54–60cm, single 81cm inseam plus rise, thigh and leg opening on the cargo guide, care lines | Blank specs, from search results only: LA Apparel HF-09 at about 475gsm; Shaka Wear 255–265gsm; AS Colour, BYB and AWDis at 300gsm. Carhartt WIP socks are 80/17/3 |
| Drop 02 "teletext" guide with pieces shown view-only, and the drop time in the viewer's time zone | Supreme publishes its item list days before a drop, and drop sites show local times |
| Lower-third text that scrambles into place when a channel tunes in | Codrops and GSAP ScrambleText patterns, done here in about 15 lines of plain JS |

## Price check (GBP)

Current prices are credible for a new indie label:

| Piece | PLUGE | Peer range found |
|---|---|---|
| Hoodie | £85 | Stüssy £115–140, Daily Paper £110–165, Represent about £170 |
| Crewneck | £75 | £70–90 suggested |
| Tees | £40–42 | Daily Paper £55–65, Palace about $48 |
| Cargo | £95 | Stüssy ripstop £129–190 |
| Cap | £32 | Stüssy £45 |
| Beanie | £28 | Carhartt WIP £20–25, Stüssy £39–40 |
| Sock 3-pack | £18 | Carhartt WIP £17.95 |

## Still to do before launch

- **Payments:** connect Shopify or Stripe. The checkout should be guest-first, with Apple Pay, Google Pay and PayPal buttons above the card form. The final button must say "Pay now" or "Place order and pay".
- **Photos:** real on-model photos with the model's height and size ("Model is 185cm, wears L"). Drawn art can't show fit.
- **Legal footer:** fill in the company details placeholders.
- **Policy pages:** add privacy, terms, cookies, and returns with a model cancellation form.
- **Drop-alert email:** keep a record of consent, and put an unsubscribe link in every email.
- **Stock claims:** keep "Low stock" and "Sold out" true to real stock, and never reset a countdown. Both are covered by the DMCC Act 2024 and CMA guidance on pressure selling.
- **Reviews:** if you add them, follow CMA208 on fake reviews, and show a fit summary from "runs small" to "runs large".

## Sources (seen through search summaries)

**UX:**
- https://baymard.com/research-articles/apparel-size-information
- https://baymard.com/blog/human-model
- https://baymard.com/blog/mobile-image-gestures
- https://baymard.com/blog/handling-out-of-stock-products
- https://baymard.com/blog/apparel-put-size-filter-near-top-and-expand-for-sidebar-filtering
- https://baymard.com/research-articles/shipping-speed-vs-delivery-date
- https://baymard.com/blog/show-shipping-costs-on-product-pages
- https://baymard.com/blog/avoid-banners-only-free-shipping
- https://baymard.com/ecommerce-design-examples/added-to-cart-confirmation
- https://baymard.com/lists/cart-abandonment-rate
- https://www.nngroup.com/articles/auto-forwarding/

**Accessibility:**
- https://www.w3.org/WAI/WCAG21/Understanding/pause-stop-hide.html
- https://www.w3.org/WAI/tutorials/carousels/animations/
- https://www.w3.org/WAI/ARIA/apg/patterns/carousel/
- https://www.w3.org/WAI/WCAG22/Understanding/animation-from-interactions.html
- https://www.gsap.com/resources/a11y/

**UK law and regulators:**
- https://www.legislation.gov.uk/uksi/2013/3134
- https://www.legislation.gov.uk/uksi/2002/2013/regulation/6
- https://www.legislation.gov.uk/uksi/2015/17
- https://www.gov.uk/online-and-distance-selling-for-businesses
- https://www.gov.uk/government/publications/price-transparency-cma209
- https://www.gov.uk/government/publications/unfair-commercial-practices-cma207/unfair-commercial-practices
- https://ico.org.uk/for-organisations/direct-marketing-and-privacy-and-electronic-communications/guide-to-pecr/electronic-and-telephone-marketing/electronic-mail-marketing/

**Delivery:**
- https://www.royalmail.com/current-postage-prices/online-parcel-price-reduction
- https://uk.trapstarlondon.com/pages/shipping-information
- https://boring.palaceskateboards.com/row/delivery-information
- https://uk.dailypaperclothing.com/pages/faq

**Product specs and prices:**
- https://www.stitchi.com/los-angeles-apparel-l-s-heavy-fleece-hood-14-oz
- https://www.shakawear.com/products/7-5oz-max-heavyweight-garment-dye
- https://www.endclothing.com/gb/brands/stussy/hoodies
- https://www.endclothing.com/gb/stussy-ripstop-cargo-pant-116323-camo.html
- https://endclothing.com/gb/carhartt-wip-watch-hat-i008598-tp00.html

**Drops and design:**
- https://www.nike.com/gb/help/a/nike-launch-drawing
- https://justfreshkicks.com/supreme-ss22-week-1/
- https://tympanus.net/codrops/2026/08/07/the-department-is-open-building-the-px-push-website/
- https://tympanus.net/codrops/2024/11/21/from-product-to-cart-adding-guiding-animations-to-the-shopping-experience/
- https://crackmagazine.net/article/profiles/no-signal-radio/
