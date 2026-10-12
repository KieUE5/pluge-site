// The terms, returns and privacy pages, written for a small UK online clothing shop.
// tools/build-pages.cjs turns these into docs/terms/, docs/returns/ and docs/privacy/, filling in the
// business details from COMPANY in catalog.js. Anything still empty shows as [square brackets].
//
// They follow the Consumer Contracts Regulations 2013, the Consumer Rights Act 2015 and UK GDPR as
// they stood when written. Have a solicitor read them before you start selling, and change POLICY_DATE
// whenever you change the wording.
const POLICY_DATE = "12 October 2026";

module.exports = function policies({ BRAND, COMPANY, SHIP }) {
  const esc = s => String(s).replace(/[&<>"]/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[ch]));
  const has = k => Boolean(COMPANY[k] && String(COMPANY[k]).trim());
  const c = (k, placeholder) => has(k) ? esc(COMPANY[k]) : `<span class="todo">[${placeholder}]</span>`;
  const gbp = n => `£${n.toFixed(2)}`;
  const ship = SHIP[Object.keys(SHIP)[0]];
  const legal = c("legalName", "company name");
  const email = has("email") ? `<a href="mailto:${esc(COMPANY.email)}">${esc(COMPANY.email)}</a>` : c("email", "email address");
  const returnsTo = has("returnsAddress") ? esc(COMPANY.returnsAddress) : c("office", "returns address");
  const who = `${esc(BRAND)} is a trading name of ${legal}, a company registered in England and Wales (company number ${c("companyNumber", "company number")}). Our registered office is ${c("office", "registered office address")}.${has("vat") ? ` Our VAT number is ${esc(COMPANY.vat)}.` : ""}`;
  const contact = `Email ${email}${has("phone") ? ` or call ${esc(COMPANY.phone)}` : ""}.`;
  const dated = `<p class="legal-date">Last updated ${POLICY_DATE}</p>`;

  const delivery = `<table>
      <thead><tr><th scope="col">Service</th><th scope="col">Cost</th><th scope="col">Usually arrives</th></tr></thead>
      <tbody>
        ${Object.values(SHIP).map(o => `<tr><th scope="row">${esc(o.name)}</th><td>${gbp(o.fee)}${o.freeOver ? `, free on orders of £${o.freeOver} or more` : ""}</td><td>${o.days[0]}–${o.days[1]} working days after you order</td></tr>`).join("")}
      </tbody>
    </table>`;

  const terms = `
    <h1 class="wide">Terms of sale</h1>
    ${dated}
    <p>These terms apply when you buy from this website as a customer in the UK. They don't affect your legal rights.</p>

    <h2>Who we are</h2>
    <p>${who}</p>
    <p>${contact}</p>

    <h2>Your order</h2>
    <p>Every piece is made to order: it's printed or embroidered for you by our production partner, Printful, after you buy it, and posted to you from their workshop.</p>
    <p>When you place an order you're offering to buy the pieces in it. We accept by emailing you to confirm the order, and that email is the start of our contract. If we can't accept, for example because a piece has sold out or a price on the site was wrong, we'll tell you and refund anything you've paid.</p>
    <p>Some drops are only on sale for a limited time. When a drop closes, its pieces can no longer be ordered.</p>

    <h2>Prices and payment</h2>
    <p>Prices are in pounds sterling and include VAT. The delivery charge is shown before you pay. Payment is taken when you place your order and is handled by our checkout and payment providers; we never see your full card details.</p>

    <h2>Delivery</h2>
    <p>We deliver to UK addresses only. Each piece takes ${ship.make[0]}–${ship.make[1]} working days to make before it's posted. If your order has several pieces, they may arrive in separate parcels.</p>
    ${delivery}
    <p>Delivery times are estimates. If we haven't delivered within 30 days of your order, you can cancel and get a full refund. The pieces are your responsibility once they're delivered, and they belong to you once we've received payment.</p>

    <h2>Changing your mind</h2>
    <p>You can cancel your order for any reason within 14 days of the day you receive it. If your order arrives in more than one parcel, the 14 days start when the last parcel arrives. Being made to order doesn't take this right away, because our pieces aren't personalised for you. See <a href="returns/">Returns and refunds</a> for how to cancel and send pieces back. Unless a piece is faulty, you pay the cost of posting it back.</p>

    <h2>If something's wrong</h2>
    <p>Everything we sell must be as described, of satisfactory quality and fit for purpose. If a piece is faulty:</p>
    <ul>
      <li>within 30 days of delivery, you can reject it for a full refund;</li>
      <li>after 30 days, we'll repair or replace it, and if that doesn't work you can have a refund or a price reduction;</li>
      <li>you can make a claim for up to six years after delivery (five in Scotland).</li>
    </ul>
    <p>Email us with your order number and a photo of the problem, including any printing or embroidery fault. We'll replace or refund it, and you won't pay to send anything back.</p>

    <h2>Our responsibility to you</h2>
    <p>We're responsible for loss or damage you suffer that is a foreseeable result of us breaking these terms or failing to use reasonable care. We're not responsible for loss that wasn't foreseeable, or for business losses. Nothing in these terms limits our responsibility for death or personal injury caused by our negligence, for fraud, or for breaking your legal rights as a consumer.</p>

    <h2>Complaints</h2>
    <p>${contact} We'll reply within 5 working days.</p>

    <h2>The law</h2>
    <p>These terms are governed by the law of England and Wales. You can bring a claim in the courts of England and Wales, or in Scotland or Northern Ireland if you live there.</p>
    <p>We may update these terms. The version that applies to your order is the one on this page when you placed it.</p>`;

  const returns = `
    <h1 class="wide">Returns and refunds</h1>
    ${dated}
    <p>Every piece is made to order for you, but you can still change your mind. You have 14 days from delivery to cancel, under the Consumer Contracts Regulations 2013.</p>

    <h2>How to return something</h2>
    <ol>
      <li><strong>Tell us within 14 days</strong> of the day your order arrives (or the last parcel, if it came in several). Email ${email} saying you want to cancel, or fill in the form below and email or post it to us. You don't have to give a reason.</li>
      <li><strong>Send the pieces back within 14 days</strong> of telling us, to ${returnsTo}. Use a tracked service and keep your proof of postage. Return postage is yours to pay, unless the piece is faulty.</li>
      <li><strong>We refund you within 14 days</strong> of receiving the pieces, or of you showing us proof you've sent them, whichever is sooner. The refund goes back to your original payment method and includes the delivery charge you paid.</li>
    </ol>
    <p>You can try pieces on as you would in a shop. If a piece comes back worn, washed or damaged, we may reduce the refund by the amount its value has gone down.</p>

    <h2>Faulty pieces</h2>
    <p>If a piece arrives faulty, damaged or misprinted, email us a photo within 30 days and we'll replace it or refund you, and you won't pay to send it back. Faulty pieces are covered by the Consumer Rights Act 2015 whatever the time limits above; see <a href="terms/">Terms of sale</a>.</p>

    <h2>Delivery</h2>
    ${delivery}

    <h2 id="cancellation-form">Cancellation form</h2>
    <p>Complete and return this form only if you want to cancel your order. Copy it into an email, or print it and post it.</p>
    <div class="legal-form">
      <p>To: ${legal}, ${returnsTo}. Email: ${email}</p>
      <p>I/We* hereby give notice that I/We* cancel my/our* contract of sale of the following goods:</p>
      <p class="blank">&nbsp;</p>
      <p>Ordered on* / received on*:</p>
      <p>Name of consumer(s):</p>
      <p>Address of consumer(s):</p>
      <p>Signature of consumer(s) (only if this form is sent on paper):</p>
      <p>Date:</p>
      <p class="small">* Delete as appropriate</p>
    </div>`;

  const privacy = `
    <h1 class="wide">Privacy and cookies</h1>
    ${dated}
    <p>This notice explains what personal information ${esc(BRAND)} collects, why, and what you can do about it.</p>

    <h2>Who we are</h2>
    <p>${who} We decide how your information is used, which makes us its "controller" under UK data protection law.</p>
    <p>For anything about your information: ${contact}</p>

    <h2>What we collect and why</h2>
    <table>
      <thead><tr><th scope="col">When</th><th scope="col">What</th><th scope="col">Why, and the legal basis</th></tr></thead>
      <tbody>
        <tr><th scope="row">You place an order</th><td>Name, delivery and billing address, email, phone number if you give it, what you bought, and payment status</td><td>To take payment, deliver your order, handle returns and keep the records the law requires. Basis: our contract with you, and legal obligation for tax records.</td></tr>
        <tr><th scope="row">You create an account</th><td>Name, email, a password (stored scrambled, so nobody can read it), your bag, saved and recently viewed pieces, and the orders placed with your email</td><td>To run your account, keep your bag on all your devices and show your orders. Basis: our contract with you.</td></tr>
        <tr><th scope="row">You sign up for drop alerts</th><td>Email address, and when and how you agreed</td><td>To email you about new drops. Basis: your consent, which you can withdraw at any time with the unsubscribe link in every email.</td></tr>
        <tr><th scope="row">You contact us</th><td>Your message and contact details</td><td>To reply and sort out your question. Basis: our legitimate interest in helping customers.</td></tr>
      </tbody>
    </table>
    <p>We don't use analytics, advertising trackers or social media pixels on this website, and we don't sell your information.</p>

    <h2 id="cookies">Cookies and storage on your device</h2>
    <p>This website doesn't set cookies. To make the shop work, it keeps a few things in your browser's local storage, on your device only:</p>
    <ul>
      <li>your bag, so it's still there when you come back;</li>
      <li>the pieces you've saved, and the ones you've recently viewed;</li>
      <li>whether you've paused the site's motion.</li>
    </ul>
    <p>If you sign in, it also keeps a sign-in token there so you stay signed in, and your bag, saved and recently viewed pieces are copied to your account. Otherwise none of this is sent to us. You can delete it at any time by signing out or clearing this site's data in your browser settings. When you check out, our checkout provider (Shopify) sets cookies needed to take payment; its cookie notice applies there.</p>

    <h2>Who we share it with</h2>
    <ul>
      <li><strong>Shopify</strong>, which runs our checkout and stores order details for us.</li>
      <li><strong>Supabase</strong>, which hosts customer accounts and stores the account information above for us.</li>
      <li><strong>Payment providers</strong> (such as Shopify Payments and PayPal), which handle your payment and check it for fraud.</li>
      <li><strong>Printful</strong>, which makes your order and posts it to you, so it needs your name, delivery address and what you bought. Its delivery partners need your name and address too.</li>
      <li><strong>Our email provider</strong>, if you sign up for drop alerts.</li>
      <li><strong>GitHub</strong>, which hosts this website and keeps short-term server logs, including IP addresses, for security.</li>
      <li>Our accountants and advisers, and HMRC or the police when the law requires it.</li>
    </ul>
    <p>Some of these companies store information outside the UK. When they do, they use safeguards recognised by UK law, such as adequacy regulations or the UK International Data Transfer Agreement.</p>

    <h2>How long we keep it</h2>
    <ul>
      <li>Order records: six years after the end of the financial year of the order, as tax law requires.</li>
      <li>Accounts: until you delete yours, which you can do yourself from the account panel. Order records stay for six years, as above.</li>
      <li>Drop alert sign-ups: until you unsubscribe.</li>
      <li>Messages: up to two years after we last hear from you.</li>
    </ul>

    <h2>Your rights</h2>
    <p>You can ask us for a copy of your information, or ask us to correct it, delete it, limit how we use it, or send it to you or someone else in a portable form. You can object to us using it, and you can withdraw consent at any time. Email us and we'll respond within one month. You can also delete your account yourself at any time.</p>
    <p>If you're not happy with how we've handled your information, you can complain to the Information Commissioner's Office at <a href="https://ico.org.uk/make-a-complaint/">ico.org.uk</a> or on 0303 123 1113. We'd appreciate the chance to put things right first.</p>`;

  return [
    { dir: "terms", title: "Terms of sale", desc: `The terms that apply when you buy from ${BRAND}.`, body: terms },
    { dir: "returns", title: "Returns and refunds", desc: `Your 14-day right to change your mind, how to send pieces back, and the cancellation form.`, body: returns },
    { dir: "privacy", title: "Privacy and cookies", desc: `What personal information ${BRAND} collects, why, and your rights.`, body: privacy },
  ];
};
