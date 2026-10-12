// The About, FAQ and Contact pages. tools/build-pages.cjs puts each one inside the site's header and
// footer at docs/about/, docs/faq/ and docs/contact/. Delivery prices, times and care notes come from
// catalog.js, so they stay in step with the shop.
module.exports = function pages({ BRAND, COMPANY, SHIP, CARE, CONTACT = {}, ACCOUNTS = {} }) {
  const esc = s => String(s).replace(/[&<>"]/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[ch]));
  const has = k => Boolean(COMPANY[k] && String(COMPANY[k]).trim());
  const c = (k, placeholder) => has(k) ? esc(COMPANY[k]) : `<span class="todo">[${placeholder}]</span>`;
  const gbp = n => Number.isInteger(n) ? `£${n}` : `£${n.toFixed(2)}`;
  const ship = SHIP[Object.keys(SHIP)[0]];
  const email = has("email") ? `<a href="mailto:${esc(COMPANY.email)}">${esc(COMPANY.email)}</a>` : c("email", "email address");
  const crumbs = here => `<nav class="crumbs" aria-label="Breadcrumb"><ol><li><a href="./">Home</a></li><li><span aria-current="page">${esc(here)}</span></li></ol></nav>`;
  const careLine = k => CARE[k].replace(/^Care: /, "");
  const look = (img, alt, cap) => `<figure><img src="assets/img/lookbook/${img}-480.webp" srcset="assets/img/lookbook/${img}-480.webp 480w, assets/img/lookbook/${img}-960.webp 960w" sizes="(max-width: 760px) 50vw, 33vw" width="960" height="1280" alt="${esc(alt)}" loading="lazy" decoding="async"><figcaption>${esc(cap)}</figcaption></figure>`;

  const about = `
  ${crumbs("Our story")}
  <header class="page-head">
    <p class="eyebrow">Our story</p>
    <h1 class="wide">Named after the darkest bars on the test card</h1>
    <p class="page-lede">${esc(BRAND)} is a small streetwear label from the UK. Each drop takes one thing from broadcast TV and builds a handful of pieces around it, and every piece is made when you order it.</p>
  </header>
  <div class="story-figs">
    ${look("look-04", "A model lit by a TV full of static, wearing the black Interference Beanie.", "Look 02 · Off air")}
    ${look("look-02", "A model in a TV control room in the white Colour Bars Tee and the black Broadcast Cap.", "Look 03 · Control room")}
    ${look("look-03", "Two friends laughing on a rooftop at night above the London skyline, one in the Channel 00 Crewneck.", "Look 04 · After dark")}
  </div>
  <div class="story">
    <section class="story-row" aria-labelledby="story-1">
      <h2 class="wide" id="story-1"><span class="k">01</span>What the name means</h2>
      <div>
        <p>PLUGE stands for picture line-up generation equipment. It's the strip of near-black bars at the bottom of the colour bars, there so engineers could set a screen's black level just right: dark enough to look black, not so dark that the detail disappears.</p>
        <p>It's the part of the test card almost nobody noticed. We liked that.</p>
      </div>
    </section>
    <section class="story-row" aria-labelledby="story-2">
      <h2 class="wide" id="story-2"><span class="k">02</span>One idea per drop</h2>
      <div>
        <p>Drop 01, Test Pattern, is built around the colour bars a telly shows when the signal drops. Drop 02, Interference, lands on Friday 30 October.</p>
        <p>Each drop is a handful of pieces, not a whole catalogue, so every one gets the time it deserves.</p>
      </div>
    </section>
    <section class="story-row" aria-labelledby="story-3">
      <h2 class="wide" id="story-3"><span class="k">03</span>Made to order, not made to waste</h2>
      <div>
        <p>Every piece is printed or embroidered after you order it, by our print partner, and posted straight to you. There's no warehouse of unsold stock, and nothing gets thrown away because someone guessed wrong about sizes.</p>
        <p>It takes a little longer, usually ${ship.days[0]}–${ship.days[1]} working days, and we think that's a fair trade.</p>
      </div>
    </section>
    <section class="story-row" aria-labelledby="story-4">
      <h2 class="wide" id="story-4"><span class="k">04</span>Built to be worn</h2>
      <div>
        <p>Heavyweight blanks we'd wear anyway: 270gsm fleece for the hoodie and crew, 207gsm garment-dyed cotton for the tees, and embroidery on the joggers, cap and beanie. Relaxed fits, cut for layering.</p>
      </div>
    </section>
  </div>
  <section class="specs" aria-label="Fabric and delivery">
    <ul>
      <li><span class="spec-num">270<small>GSM</small></span><p>Hoodie and crew fleece, soft on the inside</p></li>
      <li><span class="spec-num">207<small>GSM</small></span><p>Garment-dyed, ring-spun cotton tees</p></li>
      <li><span class="spec-num">${gbp(ship.freeOver)}</span><p>Spend this for free UK delivery</p></li>
      <li><span class="spec-num">14<small>DAYS</small></span><p>To change your mind after delivery</p></li>
    </ul>
  </section>
  <div class="page-cta">
    <a class="btn primary" href="./#shop">Shop Drop 01</a>
    <a class="btn" href="./#notify">Get the Drop 02 alert</a>
    <a class="btn" href="contact/">Contact us</a>
  </div>`;

  // Questions and answers. Answers are HTML; the FAQ page also lists them for search engines.
  const FAQ = [
    { id: "orders", title: "Orders and payment", items: [
      ["How does made to order work?", `<p>Nothing is printed until you order it. Our print partner makes your piece, usually within ${ship.make[0]}–${ship.make[1]} working days, then posts it straight to you. It means we don't throw away unsold stock, and it's why delivery takes a little longer than a warehouse would.</p>`],
      ["How do I pay?", `<p>You pay on our secure checkout, run by Shopify, by card or with the wallet options it shows you, such as Apple Pay or Google Pay. We never see your full card details.</p>`],
      ["Can I change or cancel my order?", `<p>Email ${email} as soon as you can with your order number. We can change or cancel it until it goes into production, which often starts within a few hours. After that, you can still return it within 14 days of delivery.</p>`],
      ["Do I need an account to order?", `<p>No. An account keeps your bag, saved pieces and sizes on all your devices and shows your orders, but you can check out without one.</p>`],
      ["Where do I enter a discount code?", `<p>In your bag, under Add a discount code, or at checkout. If you followed a link with a code in it, we've saved it for you and it comes off at checkout.</p>`],
    ] },
    { id: "delivery", title: "Delivery", items: [
      ["How much is delivery?", `<p>UK delivery is ${gbp(ship.fee)}, or free when your order is ${gbp(ship.freeOver)} or more.</p>`],
      ["How long will my order take?", `<p>Usually ${ship.days[0]}–${ship.days[1]} working days from when you order: ${ship.make[0]}–${ship.make[1]} days to make it, then the post. Each product page shows an estimated delivery date.</p>`],
      ["Do you deliver outside the UK?", `<p>Not yet. We only deliver to UK addresses for now.</p>`],
      ["How do I track my order?", `<p>We email you a tracking link when your order is posted. If your order has several pieces, they may come in separate parcels, each with its own tracking.</p>`],
    ] },
    { id: "returns", title: "Returns and refunds", items: [
      ["Can I return something?", `<p>Yes. Tell us within 14 days of delivery, then send it back within 14 days of telling us. Return postage is yours to pay unless the piece is faulty. We refund you within 14 days of getting it back, including the delivery charge you paid. <a href="returns/">How to return something</a>.</p>`],
      ["Can I swap for a different size?", `<p>Because every piece is made to order, the quickest way is to return it for a refund and order the size you need.</p>`],
      ["What if my order arrives faulty or wrong?", `<p>Email ${email} within 30 days with your order number and a photo. We'll replace it or refund you, and you won't pay to send anything back.</p>`],
    ] },
    { id: "sizing", title: "Sizing and fit", items: [
      ["How do your clothes fit?", `<p>Hoodies, crews and tees are a classic relaxed fit: take your usual size, or one size up for an oversized look. Joggers are relaxed and tapered, so take your usual size.</p>`],
      ["Where's the size guide?", `<p>On every product page, under Size &amp; fit. There's also a size finder: measure a top you already like across the chest and it suggests your size.</p>`],
      ["What size is the model wearing?", `<p>Product pages show the model's height and size next to their photos, where we have them.</p>`],
      ["Can the site remember my size?", `<p>Yes. The first time you add a top, joggers or socks to your bag, we remember that size and pick it for you next time. You can change your sizes in your account.</p>`],
    ] },
    { id: "care", title: "Products and care", items: [
      ["How do I wash my pieces?", `<p>Hoodies, crews, tees and joggers: ${esc(careLine("cotton"))}</p><p>Caps: ${esc(careLine("cap"))} Beanies: ${esc(careLine("knit"))} Socks: ${esc(careLine("sock"))}</p>`],
      ["Why does my tee look slightly different from the photo?", `<p>Our tees are garment-dyed, which makes them soft from the first wear, and each one takes the dye a little differently. Screens show colours differently too.</p>`],
      ["Will sold-out pieces come back?", `<p>Most Drop 01 pieces are made to order, so they rarely sell out. If a size does, choose it on the product page and leave your email, and we'll tell you if it comes back. Drops can close, though, so sign up for the drop alert to hear about new pieces first.</p>`],
      ["How do reviews work?", `<p>Sign in, open a product page and choose Write a review. We read every review before it goes up, and publish genuine ones whether they're good or bad. Reviews from people who've ordered that piece are marked "verified buyer".</p>`],
    ] },
    { id: "account", title: "Your account", items: [
      ["How do I reset my password?", `<p>Open Account and choose Forgot your password? We'll email you a link to set a new one.</p>`],
      ["How do I delete my account?", `<p>Open Account and choose Delete account. Your saved pieces and bag go straight away. We keep order records for six years because tax law requires it. See <a href="privacy/">Privacy and cookies</a>.</p>`],
    ] },
  ];
  const stripTags = h => h.replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();
  const faqLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: FAQ.flatMap(g => g.items.map(([q, a]) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: stripTags(a) } }))),
  };
  const faq = `
  ${crumbs("FAQ")}
  <header class="page-head">
    <p class="eyebrow">Help</p>
    <h1 class="wide">Questions, answered</h1>
    <p class="page-lede">Orders, delivery, returns and sizing. Can't find what you need? <a href="contact/">Send us a message</a>.</p>
  </header>
  <div class="faq-wrap">
    <aside>
      <nav aria-label="FAQ sections"><ul class="faq-toc">${FAQ.map(g => `<li><a href="faq/#${g.id}">${esc(g.title)}</a></li>`).join("")}</ul></nav>
      <div class="faq-help">
        <p>Still stuck? We usually reply within 2 working days.</p>
        <a class="btn primary" href="contact/">Contact us</a>
      </div>
    </aside>
    <div>
      ${FAQ.map(g => `<section class="faq-group" id="${g.id}" aria-labelledby="${g.id}-h">
        <h2 class="wide" id="${g.id}-h">${esc(g.title)}</h2>
        ${g.items.map(([q, a]) => `<details><summary>${esc(q)}</summary><div>${a}</div></details>`).join("\n        ")}
      </section>`).join("\n      ")}
    </div>
  </div>`;

  const contact = `
  ${crumbs("Contact us")}
  <header class="page-head">
    <p class="eyebrow">Help</p>
    <h1 class="wide">Contact us</h1>
    <p class="page-lede">Questions about an order, sizing or a return? Send us a message and we'll get back to you, usually within 2 working days.</p>
  </header>
  <div class="contact-wrap">
    <div>
      <form class="contact-form" id="contact-form" novalidate>
        <div class="row">
          <label class="field" for="c-name">Your name<input id="c-name" name="name" autocomplete="name" required></label>
          <label class="field" for="c-email">Email<input id="c-email" name="email" type="email" autocomplete="email" required></label>
        </div>
        <div class="row">
          <label class="field" for="c-topic">What's it about?
            <select id="c-topic" name="topic">
              <option>My order or delivery</option>
              <option>A return or refund</option>
              <option>Sizing and fit</option>
              <option>A product question</option>
              <option>Wholesale, press or collabs</option>
              <option>Something else</option>
            </select>
          </label>
          <label class="field" for="c-order">Order number <span class="field-opt">(if you have one)</span><input id="c-order" name="order" autocomplete="off" spellcheck="false"></label>
        </div>
        <label class="field" for="c-msg">Message<textarea id="c-msg" name="message" maxlength="4000" required></textarea></label>
        <div class="hp" aria-hidden="true"><label for="c-web">Leave this empty</label><input id="c-web" name="_gotcha" tabindex="-1" autocomplete="off"></div>
        <p class="fine">We only use your details to reply. See <a href="privacy/">Privacy and cookies</a>.${CONTACT.formEndpoint || ACCOUNTS.supabaseUrl ? "" : ' <span id="contact-app-note">Sending opens your email app with your message ready to go.</span>'}</p>
        <div><button class="btn primary" type="submit" id="contact-send">Send message</button></div>
        <p class="form-msg" id="contact-msg" role="status"></p>
      </form>
      <div class="form-done" id="contact-done" tabindex="-1" hidden>
        <p class="eyebrow">Message sent</p>
        <h2 class="wide">Thanks, we've got it</h2>
        <p>We'll reply to <b id="contact-done-email"></b>, usually within 2 working days.</p>
        <p><a class="btn" href="./#shop">Back to the shop</a></p>
      </div>
    </div>
    <div class="contact-side">
      <section class="contact-card" aria-labelledby="cc-email"><h2 id="cc-email">Email</h2><p>${email}</p></section>
      <section class="contact-card" aria-labelledby="cc-order"><h2 id="cc-order">About an order?</h2><p>Add your order number from your confirmation email and we can help faster.</p></section>
      <section class="contact-card" aria-labelledby="cc-faq"><h2 id="cc-faq">Quick answers</h2><p>Delivery times, sizing and care are in the <a href="faq/">FAQ</a>. Returns are explained in <a href="returns/">Returns and refunds</a>.</p></section>
      <section class="contact-card" aria-labelledby="cc-post"><h2 id="cc-post">Post</h2><p>${c("traderName", "your name")}, trading as ${esc(BRAND)}<br>${c("address", "business address")}</p><p>Please don't send returns here without emailing us first.</p></section>
    </div>
  </div>`;

  return [
    { dir: "about", title: "Our story", desc: `${BRAND} is a small UK streetwear label. Each drop takes one thing from broadcast TV, and every piece is made to order.`, body: about },
    { dir: "faq", title: "FAQ", desc: `Answers about ordering from ${BRAND}: delivery, returns, sizing, care and your account.`, body: faq, ld: faqLd },
    { dir: "contact", title: "Contact us", desc: `Get in touch with ${BRAND} about an order, sizing or a return.`, body: contact },
  ];
};
