// PLUGE shop: page behaviour. Product data lives in catalog.js.
(() => {
  "use strict";

  const { BRAND, SHIP, COLOURS, CATS, GUIDES, CARE, PRODUCTS, CHANNELS, FIT, DROP_02_PIECES, LOOKS, CHECKOUT, ACCOUNTS, COMPANY, CONTACT } = window.PLUGE;
  const DROP_02 = new Date(window.PLUGE.DROP_02);
  const BANK_HOLIDAYS = new Set(window.PLUGE.BANK_HOLIDAYS);
  const BAG_KEY = "pluge-bag-v1";
  const SAVED_KEY = "pluge-saved-v1";
  const RECENT_KEY = "pluge-recent-v1";
  const SIZES_KEY = "pluge-sizes-v1";
  const DISCOUNT_KEY = "pluge-discount-v1";
  const MOTION_KEY = "pluge-motion";
  const MAX_QTY = 10;
  const CHANNEL_DWELL = 5200; // ms each hero channel stays on screen

  const gbp2 = new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" });
  const gbp0 = new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: 0 });
  const price = n => Number.isInteger(n) ? gbp0.format(n) : gbp2.format(n);
  const money = n => gbp2.format(n);
  const listing = arr => arr.length < 2 ? arr.join("") : `${arr.slice(0, -1).join(", ")} and ${arr[arr.length - 1]}`;
  const esc = s => String(s).replace(/[&<>"']/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));
  const $ = sel => document.querySelector(sel);
  const pad = n => String(n).padStart(2, "0");
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const root = document.documentElement;
  // Every page (home, p/<id>/, about/, faq/...) shares this script. The quick view pop-up changes the
  // address to the product's page while it's open, so every address is built from the site root.
  const ROOT = new URL(".", document.baseURI).href;
  const HOME_TITLE = document.title;
  const IS_HOME = !!document.getElementById("grid");
  const pageUrl = (id, colour) => `${ROOT}p/${id}/${colour && colour !== byId[id].colours[0] ? `?colour=${colour}` : ""}`;
  // Scroll to the shop on the home page, or go there from any other page.
  function goShop() {
    if (IS_HOME) $("#shop").scrollIntoView({ behavior: still ? "auto" : "smooth" });
    else location.href = `${ROOT}#shop`;
  }
  // Change the address bar only on the real site, not in an embedded preview or a file opened from disk.
  const ROUTING = window.self === window.top && /^https?:$/.test(location.protocol);
  // Account state, used by the bag, saved and recently viewed code to save changes to the account.
  let sb = null, user = null, applying = false, pushTimer = 0, isAdmin = false;
  // dbReady: the database client once it has loaded (null without ACCOUNTS settings). authKnown: who's
  // signed in, once Supabase has checked.
  let dbReady = Promise.resolve(null), authKnownResolve;
  const authKnown = new Promise(r => { authKnownResolve = r; });
  root.classList.add("js");
  const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  const narrowScreen = window.matchMedia("(max-width: 640px)").matches;
  let still = root.dataset.motion === "off"; // true when animation is off

  document.querySelectorAll(".glitch").forEach(el => { el.dataset.text = el.textContent; });
  // Links to other pages (terms, returns...) are fixed to the site root now, before the address can
  // move to a product page and change what a relative link points at.
  document.querySelectorAll('a[href]:not([href^="#"]):not([href*=":"])').forEach(a => { a.href = new URL(a.getAttribute("href"), ROOT).href; });

  // ---- Product images --------------------------------------------------------
  const byId = Object.fromEntries(PRODUCTS.map(p => [p.id, p]));
  const isOut = (p, key, size) => (p.soldOut[key] || []).includes(size);
  const colourOut = (p, key) => p.sizes.every(s => isOut(p, key, s));
  const hasBack = p => p.views.includes("back");
  const swatchBg = key => COLOURS[key].swatch || COLOURS[key].hex;
  const imgSrc = (p, key, view, small) => `${ROOT}assets/img/products/${p.id}-${key}-${view}${small ? "-sm" : ""}.webp`;

  // sizes: the CSS width the image is shown at, so the browser picks the 500px or 1000px file.
  function art(p, key, view = "front", { sizes = "50vw", alt = "", lazy = true, cls = "product-img" } = {}) {
    return `<img class="${cls}" src="${imgSrc(p, key, view)}" srcset="${imgSrc(p, key, view, true)} 500w, ${imgSrc(p, key, view)} 1000w" sizes="${sizes}"` +
      ` width="1000" height="1200" alt="${esc(alt)}"${lazy ? ' loading="lazy"' : ""} decoding="async" draggable="false">`;
  }
  const altFor = (p, key, view) => `${p.name} in ${COLOURS[key].name}, ${view} view`;
  // Lookbook photos: <img>-<width>.webp at full and half width.
  const lookSrc = (look, w) => `${ROOT}assets/img/lookbook/${look.img}-${w}.webp`;
  function lookImg(look, { sizes, cls = "", alt = look.alt, lazy = true } = {}) {
    const half = look.w / 2;
    return `<img class="${cls}" src="${lookSrc(look, look.w)}" srcset="${lookSrc(look, half)} ${half}w, ${lookSrc(look, look.w)} ${look.w}w" sizes="${sizes}"` +
      ` width="${look.w}" height="${look.h}" alt="${esc(alt)}"${lazy ? ' loading="lazy"' : ""} decoding="async" draggable="false"${look.pos ? ` style="object-position:${look.pos}"` : ""}>`;
  }
  const HEART = `<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20.5s-7.5-4.6-7.5-10.3A4.2 4.2 0 0 1 12 7.6a4.2 4.2 0 0 1 7.5 2.6c0 5.7-7.5 10.3-7.5 10.3Z"/></svg>`;
  const norm = str => String(str).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[\u2013\u2014]/g, "-");
  const reEsc = str => str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  // Saved pieces and recently viewed live in this browser only.
  function readList(key, valid) {
    try {
      const v = JSON.parse(localStorage.getItem(key) || "[]");
      return Array.isArray(v) ? v.filter(valid) : [];
    } catch { return []; }
  }
  function writeList(key, list) {
    try { localStorage.setItem(key, JSON.stringify(list)); } catch { /* storage unavailable; kept for this visit */ }
  }
  const validPick = v => v && byId[v.id] && byId[v.id].colours.includes(v.colour);
  const firstIn = p => p.colours.find(k => !colourOut(p, k)) || p.colours[0];

  // Warm the cache before swapping an image in, so the swap never shows a blank frame.
  function preload(src, timeout = 1500) {
    const img = new Image();
    img.src = src;
    return Promise.race([img.decode().catch(() => {}), wait(timeout)]);
  }

  // ---- Delivery estimates ----------------------------------------------------
  const isoDate = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  function addWorkingDays(from, n) {
    const d = new Date(from.getFullYear(), from.getMonth(), from.getDate());
    while (n > 0) {
      d.setDate(d.getDate() + 1);
      if (d.getDay() !== 0 && d.getDay() !== 6 && !BANK_HOLIDAYS.has(isoDate(d))) n--;
    }
    return d;
  }
  const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const dayName = (d, withMonth) => `${DAYS[d.getDay()]} ${d.getDate()}${withMonth ? ` ${MONTHS[d.getMonth()]}` : ""}`;
  function estimate(key) {
    const now = new Date();
    const a = addWorkingDays(now, SHIP[key].days[0]), b = addWorkingDays(now, SHIP[key].days[1]);
    return `${dayName(a, a.getMonth() !== b.getMonth())} – ${dayName(b, true)}`;
  }
  const SHIP_KEYS = Object.keys(SHIP);
  const shipFee = (key, sub) => SHIP[key].freeOver !== null && sub >= SHIP[key].freeOver ? 0 : SHIP[key].fee;

  // ---- Effects: TV static -----------------------------------------------------
  function burst(canvas, ms) {
    if (still) return Promise.resolve();
    const ctx = canvas.getContext("2d");
    const { width: w, height: h } = canvas;
    const img = ctx.createImageData(w, h);
    const px = new Uint32Array(img.data.buffer);
    const end = performance.now() + ms;
    canvas.classList.add("on");
    return new Promise(resolve => {
      (function frame(now) {
        for (let i = 0; i < px.length; i++) {
          const v = Math.random() * 255 | 0;
          px[i] = 0xff000000 | v << 16 | v << 8 | v;
        }
        ctx.putImageData(img, 0, 0);
        ctx.fillStyle = "rgba(0,0,0,.45)";
        for (let b = 0; b < 3; b++) ctx.fillRect(0, Math.random() * h, w, 2 + Math.random() * h * 0.08);
        if (now < end) requestAnimationFrame(frame);
        else { canvas.classList.remove("on"); resolve(); }
      })(performance.now());
    });
  }

  // Text that tunes in: random glyphs resolve into the real text, left to right.
  function scramble(el, text, ms = 650, delay = 0) {
    if (still) { el.textContent = text; return; }
    const glyphs = "#%&@0123456789ABCDEFGHJKLMNPRSTUVWXYZ";
    const t0 = performance.now() + delay;
    (function step(now) {
      if (!el.isConnected) return;
      const t = (now - t0) / ms;
      const n = Math.floor(clamp(t, 0, 1) * text.length);
      let out = text.slice(0, n);
      for (let i = n; i < text.length; i++) out += /\s/.test(text[i]) ? text[i] : glyphs[Math.random() * glyphs.length | 0];
      el.textContent = out;
      if (t < 1) requestAnimationFrame(step); else el.textContent = text;
    })(performance.now());
  }

  // ---- Hero TV: channel surfing --------------------------------------------
  const BARS_HTML = `<div class="bars" aria-hidden="true">
    <div class="bars-row">${["#C0C0C0", "#C9C000", "#00BFC4", "#00B832", "#C000B8", "#C8101A", "#1222C8"].map(c => `<i style="background:${c}"></i>`).join("")}</div>
    <div class="bars-row">${["#1222C8", "#101010", "#C000B8", "#101010", "#00BFC4", "#101010", "#C0C0C0"].map(c => `<i style="background:${c}"></i>`).join("")}</div>
    <div class="bars-low">${["#00214C", "#F5F5F5", "#32006A", "#101010", "#060606", "#101010", "#1C1C1C", "#101010"].map(c => `<i style="background:${c}"></i>`).join("")}</div>
  </div><span class="osd-main" aria-hidden="true">${esc(BRAND)}</span>`;

  // The TV sits beside the brand story on the home page only.
  const tv = $("#tv");
  const channelEl = $("#channel");
  const staticCv = $("#static");
  const playBtn = $("#ch-play");
  let chIndex = 0, chBusy = false, chElapsed = 0;
  // Auto-rotation: on by default on larger screens, off on phones and when motion is off.
  let rotating = !!tv && !still && !narrowScreen;

  if (tv) $("#pips").innerHTML = CHANNELS.map((c, i) => {
    const what = c.kind === "bars" ? "colour bars" : byId[c.id].name;
    return `<button class="pip" type="button" data-ch="${i}" aria-pressed="false" aria-label="Channel ${c.n}: ${esc(what)}"><span aria-hidden="true">${c.n}</span><span class="pip-bar" aria-hidden="true"><i></i></span></button>`;
  }).join("");
  const pips = [...document.querySelectorAll("#pips .pip")];

  function setRotating(on) {
    if (!tv) return;
    rotating = on && !still;
    chElapsed = 0;
    playBtn.dataset.state = rotating ? "playing" : "stopped";
    playBtn.setAttribute("aria-label", rotating ? "Stop channel rotation" : "Start channel rotation");
    channelEl.setAttribute("aria-live", rotating ? "off" : "polite");
  }

  function renderChannel(i, animate) {
    chIndex = i;
    const ch = CHANNELS[i];
    const pos = `${i + 1} of ${CHANNELS.length}`;
    channelEl.setAttribute("aria-label", pos);
    if (ch.kind === "bars") {
      channelEl.innerHTML = BARS_HTML + `<span class="vh">Channel ${ch.n}, ${pos}: colour bars. Drop 01 is on air.</span>`;
      $("#screen-hit").setAttribute("aria-label", "Shop Drop 01");
    } else {
      const p = byId[ch.id];
      channelEl.innerHTML = `<div class="set${animate ? " enter" : ""}" style="--set:${ch.set}" aria-hidden="true">
        <span class="set-word">${esc(ch.word)}</span>
        <span class="set-num">${ch.n}</span>
        <div class="set-garment">${art(p, ch.colour, ch.view, { sizes: "(max-width: 640px) 90vw, 45vw", lazy: false, cls: "" })}</div>
        <div class="lower-third"><span class="lt-top">CH ${ch.n} · Now showing</span><span class="lt-main"><b>${esc(p.name)}</b><i>${price(p.price)}</i></span></div>
      </div><span class="vh">Channel ${ch.n}, ${pos}: ${esc(p.name)}, ${price(p.price)}.</span>`;
      $("#screen-hit").setAttribute("aria-label", `View ${p.name}, ${price(p.price)}`);
      if (animate) {
        scramble(channelEl.querySelector(".lt-main b"), p.name, 620, 420);
        scramble(channelEl.querySelector(".lt-main i"), price(p.price), 500, 520);
      }
    }
    $("#osd-ch").textContent = `CH ${ch.n}`;
    pips.forEach((b, j) => { b.setAttribute("aria-pressed", String(j === i)); b.style.setProperty("--p", 0); });
  }

  async function tune(i) {
    i = (i + CHANNELS.length) % CHANNELS.length;
    if (chBusy || i === chIndex) return;
    chBusy = true;
    chElapsed = 0;
    const ch = CHANNELS[i];
    const ready = ch.kind === "bars" ? Promise.resolve() : preload(imgSrc(byId[ch.id], ch.colour, ch.view, narrowScreen));
    if (still) { await ready; renderChannel(i, false); chBusy = false; return; }
    channelEl.classList.add("tuning");
    const done = burst(staticCv, 380);
    await Promise.all([wait(180), ready]);
    renderChannel(i, true);
    await done;
    channelEl.classList.remove("tuning");
    chBusy = false;
  }
  // Choosing a channel yourself stops the rotation, so it never jumps away from what you picked.
  const pick = i => { setRotating(false); tune(i); };

  let tvHover = false, tvFocus = false, tvVisible = true, swipe = null, swiped = false;
  if (tv) {
    playBtn.addEventListener("click", () => setRotating(!rotating));
    $("#pips").addEventListener("click", e => { const b = e.target.closest("[data-ch]"); if (b) pick(+b.dataset.ch); });
    $("#ch-prev").addEventListener("click", () => pick(chIndex - 1));
    $("#ch-next").addEventListener("click", () => pick(chIndex + 1));

    const screenHit = $("#screen-hit");
    screenHit.addEventListener("pointerdown", e => { swipe = { x: e.clientX, y: e.clientY }; swiped = false; });
    screenHit.addEventListener("pointerup", e => {
      if (!swipe) return;
      const dx = e.clientX - swipe.x, dy = e.clientY - swipe.y;
      swipe = null;
      if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy) * 1.4) { swiped = true; pick(chIndex + (dx < 0 ? 1 : -1)); }
    });
    screenHit.addEventListener("click", () => {
      if (swiped) { swiped = false; return; }
      const ch = CHANNELS[chIndex];
      if (ch.kind === "bars") goShop();
      else openProduct(ch.id, ch.colour);
    });

    tv.addEventListener("pointerenter", () => { tvHover = true; });
    tv.addEventListener("pointerleave", () => { tvHover = false; });
    tv.addEventListener("focusin", () => { tvFocus = true; });
    tv.addEventListener("focusout", e => { if (!tv.contains(e.relatedTarget)) tvFocus = false; });
  }

  let resizeT;
  window.addEventListener("resize", () => { clearTimeout(resizeT); resizeT = setTimeout(() => { fitDirty = true; }, 150); });

  // ---- Grid ----------------------------------------------------------------
  let filter = "all", sizeFilter = "", sortBy = "featured";
  const grid = $("#grid");
  const CARD_SIZES = "(max-width: 720px) 46vw, (max-width: 1000px) 31vw, 310px";

  const catCount = id => id === "all" ? PRODUCTS.length : PRODUCTS.filter(p => p.cat === id).length;
  const catUrl = id => `${ROOT}${id === "all" ? "" : `?cat=${id}`}#shop`;
  function renderChips() {
    if (grid) $("#chips").innerHTML = CATS.map(c =>
      `<button class="chip" type="button" data-cat="${c.id}" aria-pressed="${c.id === filter}">${esc(c.label)}<span class="n">${catCount(c.id)}</span></button>`).join("");
    // The footer and menu link to each category, so they work from any page.
    $("#foot-cats").innerHTML = CATS.map(c => `<li><a href="${catUrl(c.id)}" data-cat="${c.id}">${c.id === "all" ? "Shop all" : esc(c.label)}</a></li>`).join("");
    $("#menu-cats").innerHTML = CATS.map(c => `<li><a href="${catUrl(c.id)}" data-cat="${c.id}">${c.id === "all" ? "Shop all" : esc(c.label)}</a></li>`).join("");
  }

  // A product card: a link to the product's page, with colour swatches under it and, over the photo, a
  // save button and (on screens with a mouse) quick add sizes and quick view. The photo carries a
  // view-transition name, so it grows into the product page when the card is opened.
  function cardHtml(p, key, sizes) {
    const allOut = p.colours.every(k => colourOut(p, k));
    const badge = allOut ? `<span class="badge out">Sold out</span>`
      : p.badge ? `<span class="badge${p.badge === "Low stock" ? " low" : ""}">${esc(p.badge)}</span>` : "";
    const back = hasBack(p), many = p.colours.length > 1;
    const swatches = many ? `<div class="card-swatches" role="group" aria-label="${esc(p.name)} colours">${p.colours.map(k =>
      `<button class="cs" type="button" data-colour="${k}" aria-pressed="${k === key}" aria-label="${esc(COLOURS[k].name)}" title="${esc(COLOURS[k].name)}"><span style="background:${swatchBg(k)}"></span></button>`).join("")}</div>` : "";
    return `<li data-id="${p.id}" data-sizes="${esc(sizes)}"><a class="card" href="${pageUrl(p.id, key)}" data-id="${p.id}" data-colour="${key}">
        <span class="tilt"><span class="card-media" style="view-transition-name:p-${p.id}">${badge}
          <span class="flip${back ? " has-back" : ""}">
            <span class="face front">${art(p, key, "front", { sizes })}</span>${back ? `<span class="face back">${art(p, key, "back", { sizes })}</span>` : ""}
          </span>
          <span class="glare"></span>${back ? `<span class="turn-hint" aria-hidden="true">Back</span>` : ""}
        </span></span>
        <span class="card-row"><span class="card-name">${esc(p.name)}</span><span class="card-price">${price(p.price)}</span></span>
        <span class="card-stars" data-id="${p.id}">${cardStars(p.id)}</span>
        <span class="card-meta">${many ? `${p.colours.length} colours` : esc(COLOURS[key].name)}</span>
      </a>${swatches}<div class="card-tools"><button class="save-tog" type="button" data-id="${p.id}" data-colour="${key}" aria-pressed="${isSaved(p.id)}" aria-label="Save ${esc(p.name)}">${HEART}</button>${quickAddHtml(p, key)}</div></li>`;
  }
  // Quick add: the sizes in this colour, each one tap to the bag.
  function quickAddHtml(p, key) {
    const one = p.sizes.length === 1;
    return `<div class="qa"><div class="qa-head"><span>${one ? "Quick add" : "Quick add: size"}</span>${pd ? `<button class="qv" type="button" data-id="${p.id}" data-colour="${key}" aria-haspopup="dialog">Quick view<span class="vh">: ${esc(p.name)}</span></button>` : ""}</div>
      <div class="qa-sizes">${p.sizes.map(z => {
        const out = isOut(p, key, z);
        return `<button class="qa-size" type="button" data-id="${p.id}" data-colour="${key}" data-size="${esc(z)}"${out ? " disabled" : ""} aria-label="Add ${esc(p.name)}, ${esc(COLOURS[key].name)}, ${one ? "" : `size ${esc(z)}, `}to bag${out ? " (sold out)" : ""}">${one ? "Add to bag" : esc(z)}</button>`;
      }).join("")}</div></div>`;
  }

  // Cards work the same wherever they are (the shop grid, a product page's pairings): one listener.
  document.addEventListener("click", async e => {
    const t = e.target.closest && e.target.closest(".card-tools button, .card-swatches .cs");
    if (!t) return;
    const li = t.closest("li[data-id]"), p = byId[li.dataset.id];
    if (t.classList.contains("save-tog")) { toggleSaved(t.dataset.id, t.dataset.colour); return; }
    if (t.classList.contains("qv")) { openProduct(t.dataset.id, t.dataset.colour); return; }
    if (t.classList.contains("qa-size")) {
      const from = li.querySelector(".card-media").getBoundingClientRect();
      addToBag(p.id, t.dataset.colour, t.dataset.size);
      const msg = `Added ${p.name}, ${COLOURS[t.dataset.colour].name}${p.sizes.length > 1 ? `, ${t.dataset.size}` : ""}`;
      flyToBag(from, imgSrc(p, t.dataset.colour, "front")).then(() => { bumpBag(); showToast(msg); });
      announce(`${msg} to your bag.`);
      return;
    }
    if (t.classList.contains("cs") && t.getAttribute("aria-pressed") !== "true") {
      // A colour swatch redraws the card in that colour, keeping focus on the swatch.
      const k = t.dataset.colour;
      await preload(imgSrc(p, k, "front", true));
      const tmp = document.createElement("ul");
      tmp.innerHTML = cardHtml(p, k, li.dataset.sizes);
      const fresh = tmp.firstElementChild;
      li.replaceWith(fresh);
      if (finePointer) bindTilt(fresh.querySelector(".card"));
      fresh.querySelector(`.cs[data-colour="${k}"]`).focus();
      announce(`${p.name} in ${COLOURS[k].name}.`);
    }
  });

  // A size filter only keeps pieces that still have that size in at least one colour.
  const inSize = (p, size) => !size || (p.sizes.includes(size) && p.colours.some(k => !isOut(p, k, size)));

  function renderGrid(animate) {
    if (!grid) return;
    let list = PRODUCTS.filter(p => (filter === "all" || p.cat === filter) && inSize(p, sizeFilter));
    if (sortBy === "low") list = [...list].sort((a, b) => a.price - b.price);
    if (sortBy === "high") list = [...list].sort((a, b) => b.price - a.price);
    $("#result-count").textContent = `${list.length} ${list.length === 1 ? "piece" : "pieces"}${sizeFilter ? ` in ${sizeFilter}` : ""}`;
    $("#grid-empty").hidden = list.length > 0;
    grid.innerHTML = list.map(p => cardHtml(p, sizeFilter ? (p.colours.find(k => !isOut(p, k, sizeFilter)) || p.colours[0]) : p.colours[0], CARD_SIZES)).join("");
    if (animate && !still) { grid.classList.remove("swap"); void grid.offsetWidth; grid.classList.add("swap"); }
    if (finePointer) grid.querySelectorAll(".card").forEach(bindTilt);
  }

  function bindTilt(card) {
    const tilt = card.querySelector(".tilt");
    card.addEventListener("pointermove", e => {
      if (e.pointerType !== "mouse" || still) return;
      const r = tilt.getBoundingClientRect();
      const px = clamp((e.clientX - r.left) / r.width, 0, 1), py = clamp((e.clientY - r.top) / r.height, 0, 1);
      card.classList.add("live");
      tilt.style.setProperty("--rx", `${((0.5 - py) * 10).toFixed(2)}deg`);
      tilt.style.setProperty("--ry", `${((px - 0.5) * 12).toFixed(2)}deg`);
      tilt.style.setProperty("--gx", `${(px * 100).toFixed(1)}%`);
      tilt.style.setProperty("--gy", `${(py * 100).toFixed(1)}%`);
    });
    card.addEventListener("pointerleave", () => {
      card.classList.remove("live");
      tilt.style.setProperty("--rx", "0deg");
      tilt.style.setProperty("--ry", "0deg");
    });
  }

  function setFilter(cat) {
    if (cat === filter || !CATS.some(c => c.id === cat)) return;
    filter = cat;
    document.querySelectorAll("#chips .chip").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.cat === cat)));
    renderGrid(true);
  }

  // On the home page, category links filter the grid in place instead of reloading.
  const catLink = e => {
    const a = e.target.closest("[data-cat]");
    if (!a || !grid || e.metaKey || e.ctrlKey || e.shiftKey) return;
    e.preventDefault();
    if (menuDlg.open) menuDlg.close();
    setFilter(a.dataset.cat);
    goShop();
  };
  $("#foot-cats").addEventListener("click", catLink);
  $("#menu-cats").addEventListener("click", catLink);
  if (grid) {
    $("#chips").addEventListener("click", e => { const b = e.target.closest("[data-cat]"); if (b) setFilter(b.dataset.cat); });
    $("#size-filter").addEventListener("change", e => { sizeFilter = e.target.value; renderGrid(true); });
    $("#sort").addEventListener("change", e => { sortBy = e.target.value; renderGrid(true); });
    $("#clear-filters").addEventListener("click", () => {
      sizeFilter = "";
      $("#size-filter").value = "";
      filter = "all";
      document.querySelectorAll("#chips .chip").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.cat === "all")));
      renderGrid(true);
      $("#size-filter").focus();
    });
    // ?cat=tees (from the footer or menu on another page) opens the shop on that category.
    const startCat = new URLSearchParams(location.search).get("cat");
    if (startCat && CATS.some(c => c.id === startCat)) filter = startCat;
  }

  // ---- Build the fit (scroll-scrubbed flat lay) -----------------------------
  const fitStage = $("#fit-stage"), fitSec = $("#fit");
  if (fitStage) fitStage.insertAdjacentHTML("beforeend", FIT.map(f =>
    `<button class="piece" type="button" tabindex="-1" aria-hidden="true" data-id="${f.id}" data-colour="${f.colour}" style="--w:${f.w}%;left:${f.x}%;top:${f.y}%;z-index:${f.z}">${art(byId[f.id], f.colour, "front", { sizes: "(max-width: 860px) 50vw, 30vw" })}</button>`).join(""));
  const pieces = fitStage ? [...fitStage.querySelectorAll(".piece")] : [];
  let fitItems = [];
  function renderFitList() {
    if (!fitStage) return;
    $("#fit-list").innerHTML = FIT.map(f => {
      const p = byId[f.id];
      return `<li><button type="button" data-id="${f.id}" data-colour="${f.colour}"><span class="k">${f.k}</span><span class="nm">${esc(p.name)}</span><span class="pr">${price(p.price)}</span></button></li>`;
    }).join("");
    fitItems = [...document.querySelectorAll("#fit-list li")];
    fitShownTotal = -1;
    fitDirty = true;
  }
  const fitTotalEl = $("#fit-total");
  let fitDirty = true, fitShownTotal = -1;
  renderFitList();
  const easeOutBack = t => { const c1 = 1.5, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); };

  function updateFit() {
    if (!fitStage) return;
    const r = fitSec.getBoundingClientRect();
    const span = r.height - window.innerHeight;
    const prog = still || span <= 0 ? 1 : clamp(-r.top / span, 0, 1);
    const sw = fitStage.clientWidth, sh = fitStage.clientHeight;
    let total = 0;
    FIT.forEach((f, i) => {
      const t = clamp((prog - f.start) / f.len, 0, 1);
      const e = easeOutBack(t), inv = 1 - e;
      const dx = (f.fx / 100) * sw * inv, dy = (f.fy / 100) * sh * inv;
      const rot = f.r + f.fr * inv, s = 0.72 + 0.28 * e;
      pieces[i].style.transform = `translate(-50%,-50%) translate(${dx.toFixed(1)}px,${dy.toFixed(1)}px) rotate(${rot.toFixed(2)}deg) scale(${s.toFixed(3)})`;
      pieces[i].style.opacity = (0.35 + 0.65 * Math.min(1, t * 1.6)).toFixed(3);
      const landed = t >= 0.92;
      fitItems[i].classList.toggle("on", landed);
      if (landed) total += byId[f.id].price;
    });
    if (total !== fitShownTotal) {
      fitShownTotal = total;
      fitTotalEl.textContent = price(total);
      if (!still && total > 0) { fitTotalEl.classList.remove("tick"); void fitTotalEl.offsetWidth; fitTotalEl.classList.add("tick"); }
    }
  }
  const openFromFit = e => { const b = e.target.closest("[data-id]"); if (b) openProduct(b.dataset.id, b.dataset.colour); };
  if (fitStage) {
    fitStage.addEventListener("click", openFromFit);
    $("#fit-list").addEventListener("click", openFromFit);
    $("#fit-shop").addEventListener("click", () => openKit({ title: "Full broadcast", items: FIT.map(f => [f.id, f.colour]) }));
  }

  // ---- Lookbook --------------------------------------------------------------
  const lookTotal = look => look.pieces.reduce((sum, [id]) => sum + byId[id].price, 0);
  function renderLooks() {
    if (!$("#looks")) return;
    $("#looks").innerHTML = LOOKS.map((look, i) => {
      if (look.hero) return "";
      const wide = look.w > look.h, m = look.model;
      const wears = m ? look.pieces.filter(([id]) => m.wears[id]).map(([id]) => `${byId[id].short} ${m.wears[id]}`).join(" · ") : "";
      return `<figure class="look${wide ? " look-wide" : ""}" style="--ar:${look.w}/${look.h}">
        <div class="look-frame" data-look="${i}">
          ${lookImg(look, { sizes: wide ? "(max-width: 720px) 160vw, (max-width: 1320px) 64vw, 860px" : "(max-width: 720px) 80vw, (max-width: 1000px) 48vw, (max-width: 1320px) 32vw, 430px" })}
          <span class="look-osd" aria-hidden="true">Look ${look.n}</span>
          <span class="look-rec" aria-hidden="true"><i></i>${look.fitCheck ? "Studio" : "Location"}</span>
          <span class="look-cta" aria-hidden="true">Shop the look</span>
        </div>
        <figcaption class="look-cap">
          <span class="look-num" aria-hidden="true">${look.n}</span>
          <span class="look-txt"><b>${esc(look.title)}</b><span>${esc(look.pieces.map(([id]) => byId[id].name).join(" · "))}</span></span>
          <button class="look-shop" type="button" data-look="${i}" aria-haspopup="dialog">Shop <span>${price(lookTotal(look))}</span><span class="vh">: look ${look.n}, ${esc(look.title)}</span></button>
          ${m ? `<span class="look-model">Model is ${m.height}cm · ${esc(wears)}</span>` : ""}
        </figcaption>
      </figure>`;
    }).join("") + `<div class="look-tile">
        <p class="eyebrow">Fit notes</p>
        <p class="tile-big wide">Size up for slouch</p>
        <div class="tile-body">
          <p>Hoodies, crews and tees are a classic relaxed fit. Take your usual size, or one size up for the oversized look in these photos.</p>
          <p>Joggers are relaxed and tapered. Take your usual size.</p>
          <p class="tile-small">Every product has a size guide, and a size finder that matches a top you already own.</p>
        </div>
      </div>`;
  }
  function shopLook(i) {
    const look = LOOKS[i];
    openKit({
      title: `Look ${look.n}`,
      items: look.pieces.map(([id, colour]) => [id, colour, look.model && look.model.wears[id]]),
      intro: `<div class="kit-look">${lookImg(look, { sizes: "96px", alt: "" })}<p><b>${esc(look.title)}</b><span>${look.pieces.length} ${look.pieces.length === 1 ? "piece" : "pieces"}${look.model ? `, model is ${look.model.height}cm` : ""}</span></p></div>`,
    });
  }
  if ($("#looks")) $("#looks").addEventListener("click", e => { const b = e.target.closest("[data-look]"); if (b) shopLook(+b.dataset.look); });

  // ---- Shop the look: every piece of a look (or the fit) with a size for each --
  const kit = $("#kit");
  let kitItems = [], kitName = "";
  function openKit({ title, items, intro = "" }) {
    kitName = title;
    kitItems = items.map(([id, colour, wears]) => {
      const p = byId[id], out = colourOut(p, colour), usual = usualSize(p);
      const size = out ? "" : p.sizes.length === 1 ? p.sizes[0] : usual && !isOut(p, colour, usual) ? usual : "";
      return { p, colour, size, out, wears };
    });
    $("#kit-title").textContent = title;
    $("#kit-intro").innerHTML = intro;
    $("#kit-intro").hidden = !intro;
    $("#kit-msg").textContent = "";
    renderKit();
    if (!kit.open) kit.showModal();
  }
  function renderKit() {
    $("#kit-lines").innerHTML = kitItems.map((it, i) => {
      const { p, colour } = it;
      const sizePick = it.out ? `<span class="kit-out">Sold out in ${esc(COLOURS[colour].name)}</span>`
        : p.sizes.length === 1 ? `<span class="kit-one">${esc(p.sizes[0])}</span>`
        : `<label class="kit-size" for="kit-size-${i}"><span class="vh">Size for ${esc(p.name)}</span><select id="kit-size-${i}" data-i="${i}">
            <option value="">Choose size</option>${p.sizes.map(sz => {
              const out = isOut(p, colour, sz);
              return `<option value="${esc(sz)}"${out ? " disabled" : ""}${sz === it.size ? " selected" : ""}>${esc(sz)}${out ? " (sold out)" : ""}</option>`;
            }).join("")}</select></label>`;
      return `<li class="line kit-line${it.out ? " out" : ""}">
        <span class="line-thumb">${art(p, colour, "front", { sizes: "80px" })}</span>
        <div>
          <p class="line-name">${esc(p.name)}</p>
          <p class="line-opts">${esc(COLOURS[colour].name)}${it.wears ? ` · Model wears ${esc(it.wears)}` : ""}</p>
          <div class="kit-ctl">${sizePick}</div>
          <div class="line-ctl">
            <button class="remove" type="button" data-act="details" data-i="${i}">Details</button>
            <button class="remove" type="button" data-act="remove" data-i="${i}">Remove<span class="vh"> ${esc(p.name)} from this look</span></button>
          </div>
        </div>
        <span class="line-price">${price(p.price)}</span>
      </li>`;
    }).join("");
    const live = kitItems.filter(it => !it.out);
    const total = live.reduce((sum, it) => sum + it.p.price, 0);
    $("#kit-total").textContent = money(total);
    const add = $("#kit-add");
    add.disabled = live.length === 0;
    add.textContent = live.length ? `Add ${live.length} ${live.length === 1 ? "piece" : "pieces"} to bag` : "Nothing left to add";
  }
  $("#kit-lines").addEventListener("change", e => {
    const it = kitItems[+e.target.dataset.i];
    if (!it) return;
    it.size = e.target.value;
    $("#kit-msg").textContent = "";
  });
  $("#kit-lines").addEventListener("click", e => {
    const b = e.target.closest("[data-act]");
    if (!b) return;
    const i = +b.dataset.i, it = kitItems[i];
    if (b.dataset.act === "details") { kit.close(); showProduct(it.p.id, it.colour); return; }
    kitItems.splice(i, 1);
    renderKit();
    announce(`Removed ${it.p.name} from this look.`);
    const next = $("#kit-lines").querySelectorAll('[data-act="remove"]')[Math.min(i, kitItems.length - 1)];
    (next || $("#kit-close")).focus();
  });
  $("#kit-form").addEventListener("submit", e => {
    e.preventDefault();
    const live = kitItems.filter(it => !it.out);
    const missing = live.find(it => !it.size);
    if (missing) {
      $("#kit-msg").textContent = `Choose a size for the ${missing.p.name}.`;
      $(`#kit-size-${kitItems.indexOf(missing)}`).focus();
      return;
    }
    if (!live.length) return;
    fresh.clear();
    live.forEach(it => addToBag(it.p.id, it.colour, it.size));
    kit.close();
    bumpBag();
    const msg = `Added ${live.length} ${live.length === 1 ? "piece" : "pieces"} from ${kitName}`;
    showToast(msg);
    announce(`${msg} to your bag.`);
  });
  $("#kit-close").addEventListener("click", () => kit.close());

  // ---- Product view -----------------------------------------------------------
  // The same form drives two layouts: the quick view pop-up on the home page (#pd, with a turntable,
  // zoom and static on colour change) and the full product page at p/<id>/ (#pdp, with a photo
  // gallery, a full-screen viewer, tabs and a buy bar on phones).
  const pd = $("#pd"), pdp = $("#pdp");
  const pdForm = $("#pd-form");
  const stage = $("#pd-stage"), zoomLayer = $("#pd-zoom-layer"), turn = $("#pd-turn"), face = $("#pd-face");
  const lens = $("#pd-lens"), lensInner = $("#pd-lens-inner"), pdStatic = $("#pd-static"), zoomBtn = $("#pd-zoom");
  const LENS = 190, LENS_ZOOM = 2.4, ZOOM = 2.2;
  const PD_SIZES = "(max-width: 760px) 100vw, 600px";
  const sel = { p: null, colour: null, size: null };
  let angle = 0, side = "front", tweenId = 0, drag = null, units = "cm", modelOn = false;
  let zoomed = false, pan = { x: 0, y: 0 }, lastTap = { t: 0, x: 0, y: 0 };

  // Opens a product in the quick view where there is one (home), or goes to its page.
  function showProduct(id, colour) {
    if (pd) openProduct(id, colour);
    else location.href = pageUrl(id, colour);
  }

  const sideFor = a => { const n = ((a % 360) + 360) % 360; return n > 90 && n < 270 ? "back" : "front"; };

  // On-model photos come from the lookbook. A studio fit check in the chosen colour comes first.
  const lookPieces = LOOKS.flatMap(look => look.pieces.map(([id, colour]) => ({ look, id, colour })));
  const shotRank = (p, colour) => x => (x.colour === colour ? 0 : 2) + (x.look.model && x.look.model.wears[p.id] ? 0 : 1);
  function modelShots(p, colour) {
    const rank = shotRank(p, colour);
    return lookPieces.filter(x => x.id === p.id).sort((a, b) => rank(a) - rank(b));
  }
  const modelShot = (p, colour) => modelShots(p, colour)[0] || null;
  const modelSize = (p, shot) => shot.look.model && shot.look.model.wears[p.id];
  function shotCaption(p, shot) {
    const size = modelSize(p, shot);
    const what = size ? `Model is ${shot.look.model.height}cm and wears ${size}` : `Look ${shot.look.n}: ${shot.look.title}`;
    return shot.colour === sel.colour ? what : `${what} · Shown in ${COLOURS[shot.colour].name}`;
  }

  function drawFace() {
    if (!stage) return;
    const p = sel.p;
    const shot = modelOn ? modelShot(p, sel.colour) : null;
    if (shot) {
      const look = shot.look, wide = look.w > look.h, cls = `model-img${wide ? " cover" : ""}`;
      // Portrait photos sit whole in the frame over a blurred copy of themselves; wide ones are cropped.
      face.innerHTML = (wide ? "" : `<img class="model-bg" src="${lookSrc(look, look.w / 2)}" alt="" decoding="async" draggable="false">`) +
        lookImg(look, { sizes: PD_SIZES, cls, lazy: false });
      lensInner.innerHTML = `<img class="${cls}" src="${lookSrc(look, look.w)}" alt="" decoding="async"${look.pos ? ` style="object-position:${look.pos}"` : ""}>`;
      $("#pd-model-cap").textContent = shotCaption(p, shot);
    } else {
      face.innerHTML = art(p, sel.colour, side, { sizes: PD_SIZES, alt: altFor(p, sel.colour, side), lazy: false });
      lensInner.innerHTML = `<img class="product-img" src="${imgSrc(p, sel.colour, side)}" alt="" decoding="async">`;
    }
    $("#pd-model-cap").hidden = !shot;
    const current = modelOn ? "model" : side;
    document.querySelectorAll("#pd-views .pd-view").forEach(v => v.setAttribute("aria-pressed", String(v.dataset.view === current)));
  }
  const canTurn = () => hasBack(sel.p) && !modelOn;
  function applyAngle(a) {
    angle = a;
    const s = canTurn() ? sideFor(a) : "front";
    if (s !== side) { side = s; drawFace(); }
    turn.style.transform = `rotateY(${a.toFixed(2)}deg)`;
    face.style.transform = s === "back" ? "scaleX(-1)" : "";
  }
  function tweenTo(target, ms = 700) {
    const id = ++tweenId, from = angle, t0 = performance.now();
    if (still) { applyAngle(target); return; }
    (function step(now) {
      if (id !== tweenId) return;
      const t = Math.min(1, (now - t0) / ms);
      const e = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
      applyAngle(from + (target - from) * e);
      if (t < 1) requestAnimationFrame(step);
    })(t0);
  }
  const nearest = base => Math.round((angle - base) / 360) * 360 + base;

  // Zoom: scale the photo 2.2x around a point, then drag to pan.
  function setZoom(on, at) {
    if (!stage) return;
    zoomed = on;
    stage.classList.toggle("zoomed", on);
    zoomBtn.setAttribute("aria-pressed", String(on));
    zoomBtn.textContent = on ? "Zoom out" : "Zoom";
    lens.hidden = true;
    if (on) {
      const w = stage.clientWidth, h = stage.clientHeight;
      pan = at ? { x: w / 2 - at.x, y: h / 2 - at.y } : { x: 0, y: 0 };
    } else pan = { x: 0, y: 0 };
    applyPan();
  }
  function applyPan() {
    const w = stage.clientWidth, h = stage.clientHeight;
    const mx = w * (ZOOM - 1) / (2 * ZOOM), my = h * (ZOOM - 1) / (2 * ZOOM);
    pan.x = clamp(pan.x, -mx, mx);
    pan.y = clamp(pan.y, -my, my);
    zoomLayer.style.transform = zoomed ? `scale(${ZOOM}) translate(${pan.x.toFixed(1)}px,${pan.y.toFixed(1)}px)` : "";
  }

  function moveLens(e) {
    const r = stage.getBoundingClientRect();
    const x = e.clientX - r.left, y = e.clientY - r.top;
    lensInner.style.width = `${r.width * LENS_ZOOM}px`;
    lensInner.style.height = `${r.height * LENS_ZOOM}px`;
    lens.style.transform = `translate(${x - LENS / 2}px,${y - LENS / 2}px)`;
    lensInner.style.transform = `translate(${LENS / 2 - x * LENS_ZOOM}px,${LENS / 2 - y * LENS_ZOOM}px)`;
  }
  if (stage) {
    stage.addEventListener("pointerdown", e => {
      if (e.button !== 0 || e.target.closest(".zoom-btn")) return;
      drag = { x: e.clientX, y: e.clientY, a: angle, px: pan.x, py: pan.y, id: e.pointerId, moved: false };
      tweenId++;
      lens.hidden = true;
      stage.setPointerCapture(e.pointerId);
    });
    stage.addEventListener("pointermove", e => {
      if (drag && e.pointerId === drag.id) {
        const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
        if (Math.abs(dx) > 3 || Math.abs(dy) > 3) drag.moved = true;
        if (zoomed) {
          stage.classList.add("panning");
          pan.x = drag.px + dx / ZOOM;
          pan.y = drag.py + dy / ZOOM;
          applyPan();
          return;
        }
        if (modelOn) return;
        if (drag.moved) stage.classList.add("dragging");
        let a = drag.a + dx * 0.55;
        if (!canTurn()) a = clamp(a, -38, 38);
        applyAngle(a);
        return;
      }
      if (e.pointerType === "mouse" && finePointer && !zoomed && !e.target.closest(".zoom-btn")) { lens.hidden = false; moveLens(e); }
      else lens.hidden = true;
    });
    const endDrag = e => {
      if (!drag || e.pointerId !== drag.id) return;
      const moved = drag.moved;
      drag = null;
      stage.classList.remove("dragging", "panning");
      if (!zoomed && !modelOn) tweenTo(canTurn() ? Math.round(angle / 180) * 180 : 0, 520);
      if (e.type === "pointerup" && !moved) {
        // Double-tap (or double-click) toggles zoom at that point.
        const r = stage.getBoundingClientRect();
        const x = e.clientX - r.left, y = e.clientY - r.top, now = performance.now();
        if (now - lastTap.t < 320 && Math.hypot(x - lastTap.x, y - lastTap.y) < 30) { setZoom(!zoomed, { x, y }); lastTap.t = 0; }
        else lastTap = { t: now, x, y };
      }
    };
    stage.addEventListener("pointerup", endDrag);
    stage.addEventListener("pointercancel", endDrag);
    stage.addEventListener("pointerleave", () => { lens.hidden = true; });
    zoomBtn.addEventListener("click", () => setZoom(!zoomed));
  }

  // pdp: true when filling in the product page as it loads.
  function openProduct(id, colour, { push = true } = {}) {
    const p = byId[id];
    if (!p || (!pd && !pdp)) return;
    sel.p = p;
    sel.colour = colour && p.colours.includes(colour) && !colourOut(p, colour) ? colour : (p.colours.find(k => !colourOut(p, k)) || p.colours[0]);
    // The shopper's usual size is picked for them, if it's in stock.
    const usual = usualSize(p);
    sel.size = usual && !isOut(p, sel.colour, usual) ? usual : null;
    $("#restock-msg").textContent = "";
    if (stage) {
      tweenId++;
      angle = 0;
      side = "front";
      modelOn = false;
      turn.style.transform = "";
      face.style.transform = "";
      setZoom(false);
      if (hasBack(p)) preload(imgSrc(p, sel.colour, "back"));
    }

    $("#pd-eyebrow").textContent = `Drop 01 · ${CATS.find(c => c.id === p.cat).label}`;
    $("#pd-name").textContent = p.name;
    $("#pd-price").textContent = price(p.price);
    $("#pd-ship").textContent = `Made to order · ${SHIP[SHIP_KEYS[0]].name} ${money(SHIP[SHIP_KEYS[0]].fee)}, free over ${price(SHIP[SHIP_KEYS[0]].freeOver)} · Estimated delivery ${estimate(SHIP_KEYS[0])}`;
    $("#pd-blurb").textContent = p.blurb;
    $("#pd-fabric").textContent = p.fabric;
    $("#pd-details").innerHTML = p.details.map(d => `<li>${esc(d)}</li>`).join("");
    $("#pd-deco").textContent = p.deco;
    $("#pd-care").textContent = CARE[p.care];

    const g = p.guide && GUIDES[p.guide];
    if (pd) $("#pd-guide-wrap").hidden = !g;
    else {
      $("#tab-size").hidden = !g;
      if (!g && $("#tab-size").getAttribute("aria-selected") === "true") selectTab(tabs[0]);
    }
    $("#pd-guide-link").hidden = !g;
    $("#finder-out").textContent = "";
    $("#finder-in").value = "";
    if (g) renderGuide();

    $("#pd-swatches").innerHTML = p.colours.map(k => {
      const out = colourOut(p, k);
      const name = COLOURS[k].name + (out ? " (sold out)" : "");
      return `<label class="swatch${out ? " out" : ""}" title="${esc(name)}">
        <input type="radio" name="pd-colour" id="pd-colour-${k}" value="${k}"${k === sel.colour ? " checked" : ""} aria-label="${esc(name)}">
        <span style="background:${swatchBg(k)}"></span></label>`;
    }).join("");

    renderPairs();
    renderVariant();
    syncSavedButtons();
    noteRecent(p.id, sel.colour);
    if (pd) {
      $("#pd-full").href = pageUrl(p.id, sel.colour);
      if (!pd.open) pd.showModal();
      pd.scrollTop = 0;
      syncUrl(push);
      if (hasBack(p) && !still) setTimeout(() => { if (pd.open && !drag && !zoomed) { tweenTo(34, 520); setTimeout(() => { if (!drag && !zoomed) tweenTo(0, 700); }, 560); } }, 520);
    } else {
      renderRecent();
      renderAlso();
      renderReviewSummary();
      loadReviews();
      pageColourUrl();
    }
  }
  // "You might also like": the rest of the drop, same category first, leaving out the pairings.
  function alsoLike(p) {
    const skip = new Set([p.id, ...p.pairs]);
    return PRODUCTS.filter(q => !skip.has(q.id)).sort((a, b) => (b.cat === p.cat) - (a.cat === p.cat)).slice(0, 4);
  }
  function renderAlso() {
    const box = $("#also-grid");
    if (!box) return;
    box.innerHTML = alsoLike(sel.p).map(q => cardHtml(q, firstIn(q), PAIR_SIZES)).join("");
    if (finePointer) box.querySelectorAll(".card").forEach(bindTilt);
  }

  // "Complete the look": small buttons that swap the quick view, or product cards on the product page.
  function renderPairs() {
    const p = sel.p;
    if (pd) {
      $("#pd-pairs").innerHTML = p.pairs.map(pid => {
        const q = byId[pid];
        return `<button class="pair" type="button" data-id="${q.id}"><span class="pair-img">${art(q, q.colours[0], "front", { sizes: "160px" })}</span><span class="pair-name">${esc(q.name)}</span><span class="pair-price">${price(q.price)}</span></button>`;
      }).join("");
      return;
    }
    $("#pd-pairs").innerHTML = p.pairs.map(pid => cardHtml(byId[pid], firstIn(byId[pid]), PAIR_SIZES)).join("");
    if (finePointer) $("#pd-pairs").querySelectorAll(".card").forEach(bindTilt);
    const total = [p, ...p.pairs.map(pid => byId[pid])].reduce((sum, q) => sum + q.price, 0);
    $("#look-kit").innerHTML = `Shop the full look · ${price(total)}`;
  }
  const PAIR_SIZES = "(max-width: 900px) 46vw, (max-width: 1320px) 31vw, 420px";

  const fmtLen = cm => units === "in" ? `${(cm / 2.54).toFixed(1)}in` : `${+cm.toFixed(1)}cm`;
  function renderGuide() {
    const g = GUIDES[sel.p.guide];
    $("#pd-guide-note").textContent = g.note;
    $("#pd-units").hidden = !!g.noUnits;
    document.querySelectorAll("#pd-units button").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.unit === units)));
    const cell = v => typeof v === "number" ? (units === "in" ? (v / 2.54).toFixed(1) : v) : esc(v);
    const head = g.cols.map((h, i) => `<th scope="col">${esc(h)}${i > 0 && !g.noUnits ? ` (${units})` : ""}</th>`).join("");
    $("#pd-guide").innerHTML = `<table><thead><tr>${head}</tr></thead><tbody>` +
      g.rows.map(r => `<tr>${r.map((v, i) => i === 0 ? `<th scope="row">${esc(v)}</th>` : `<td>${cell(v)}</td>`).join("")}</tr>`).join("") +
      `</tbody></table>`;
    $("#pd-finder").hidden = !g.finder;
    $("#finder-label").textContent = `Lay a top that fits you well flat and measure straight across the chest, armpit to armpit (${units}).`;
    $("#finder-in").placeholder = units === "in" ? "e.g. 24" : "e.g. 60";
    $("#pd-how").textContent = g.how;
  }

  // Find your size: match a top the shopper already likes against our chest measurements.
  function suggestSize() {
    const g = GUIDES[sel.p.guide], out = $("#finder-out");
    const raw = parseFloat($("#finder-in").value);
    if (!isFinite(raw) || raw <= 0) { out.textContent = `Enter the measurement in ${units}, like ${units === "in" ? "24" : "60"}.`; return; }
    const cm = units === "in" ? raw * 2.54 : raw;
    const first = g.rows[0], last = g.rows[g.rows.length - 1];
    if (cm < first[1] - 5 || cm > last[1] + 5) {
      out.textContent = `That's outside our range, which runs from ${fmtLen(first[1])} (${first[0]}) to ${fmtLen(last[1])} (${last[0]}) across the chest.`;
      return;
    }
    const row = g.rows.find(r => r[1] >= cm - 1) || last;
    const diff = row[1] - cm;
    const how = Math.abs(diff) < 0.75 ? "about the same as the top you measured"
      : diff > 0 ? `${fmtLen(diff)} roomier than the top you measured` : `${fmtLen(-diff)} closer than the top you measured`;
    const p = sel.p, size = row[0];
    let msg = `Try ${size}: ${fmtLen(row[1])} across the chest, ${how}.`;
    if (isOut(p, sel.colour, size)) {
      const other = p.colours.find(k => !isOut(p, k, size));
      msg += other ? ` ${size} has sold out in ${COLOURS[sel.colour].name} but is in stock in ${COLOURS[other].name}.` : ` ${size} has sold out in every colour.`;
    } else {
      sel.size = size;
      renderVariant();
      msg += ` We've selected ${size} for you.`;
    }
    out.textContent = msg;
  }

  // Tabs on the product page: Details, Size & fit, Delivery & returns.
  const tabs = [...document.querySelectorAll('#pd-tabs [role="tab"]')];
  function selectTab(tab, focus) {
    tabs.forEach(t => {
      const on = t === tab;
      t.setAttribute("aria-selected", String(on));
      t.tabIndex = on ? 0 : -1;
      $(`#${t.getAttribute("aria-controls")}`).hidden = !on;
    });
    if (focus) tab.focus();
  }
  if (tabs.length) {
    $("#pd-tabs").addEventListener("click", e => { const t = e.target.closest('[role="tab"]'); if (t) selectTab(t); });
    $("#pd-tabs").addEventListener("keydown", e => {
      const shown = tabs.filter(t => !t.hidden), i = shown.indexOf(document.activeElement);
      if (i < 0) return;
      const to = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: shown.length - 1 }[e.key];
      if (to === undefined) return;
      e.preventDefault();
      selectTab(shown[(to + shown.length) % shown.length], true);
    });
  }

  // Opens the size guide or delivery section: an accordion in the quick view, a tab on the product page.
  function openSection(id) {
    const d = $(id);
    const tab = tabs.find(t => t.getAttribute("aria-controls") === d.id);
    if (tab) {
      selectTab(tab);
      $("#pd-tabs").scrollIntoView({ behavior: still ? "auto" : "smooth", block: "start" });
      tab.focus({ preventScroll: true });
      return;
    }
    d.open = true;
    d.scrollIntoView({ behavior: still ? "auto" : "smooth", block: "start" });
    d.querySelector("summary").focus({ preventScroll: true });
  }

  function renderVariant() {
    const p = sel.p, key = sel.colour, c = COLOURS[key];
    if (!sel.size && p.sizes.length === 1 && !isOut(p, key, p.sizes[0])) sel.size = p.sizes[0];

    $("#pd-colour-name").textContent = c.name;
    const shot = modelShot(p, key);
    if (!shot) modelOn = false;
    if (stage) {
      const views = [...(hasBack(p) ? ["front", "back"] : shot ? ["front"] : []), ...(shot ? ["model"] : [])];
      const current = modelOn ? "model" : side;
      $("#pd-views").innerHTML = views.map(v => {
        const thumb = v === "model"
          ? `<img class="model-thumb" src="${lookSrc(shot.look, shot.look.w / 2)}" alt="" loading="lazy" decoding="async" style="object-position:${shot.look.pos || "50% 35%"}">`
          : art(p, key, v, { sizes: "64px" });
        return `<button class="pd-view" type="button" data-view="${v}" aria-pressed="${v === current}" aria-label="${v === "model" ? "Show on a model" : `Show ${v}`}">${thumb}</button>`;
      }).join("");
      stage.classList.toggle("static-only", !canTurn());
      stage.classList.toggle("on-model", modelOn);
      const turnHint = canTurn() ? "Drag to turn · " : "";
      $("#pd-hint").textContent = turnHint + (finePointer ? "Hover to zoom" : "Double-tap to zoom");
      drawFace();
    } else renderGallery();

    // How it fits: the model's height and size, from the lookbook.
    const size = shot && modelSize(p, shot);
    $("#pd-fit-note").hidden = !shot;
    if (shot) {
      $("#pd-fit-text").textContent = size ? `Model is ${shot.look.model.height}cm and wears ${size}.` : `Seen in look ${shot.look.n}, ${shot.look.title}.`;
      $("#pd-fit-view").textContent = !stage ? "See the photo" : modelOn ? "Show the product" : "View on model";
    }

    const usual = usualSize(p);
    $("#pd-usual").hidden = !usual;
    $("#pd-usual").textContent = usual ? `Your size: ${usual}` : "";

    // Sold-out sizes stay selectable so shoppers can ask to hear when they're back.
    $("#pd-sizes").innerHTML = p.sizes.map((s, i) => {
      const out = isOut(p, key, s);
      return `<label class="size${out ? " out" : ""}"><input type="radio" name="pd-size" id="pd-size-${i}" value="${esc(s)}"${s === sel.size ? " checked" : ""}${out ? ` aria-label="${esc(s)}, sold out"` : ""}><span>${esc(s)}</span></label>`;
    }).join("");

    const outAll = colourOut(p, key);
    const someOut = !outAll && p.sizes.some(s => isOut(p, key, s));
    const stock = $("#pd-stock");
    stock.hidden = !(outAll || someOut || p.badge === "Low stock");
    stock.textContent = outAll ? `${c.name} has sold out.` : p.badge === "Low stock" ? "Low stock: only a few left in each size." : "Some sizes have sold out in this colour.";
    updateAdd();
  }

  function updateAdd() {
    const p = sel.p, add = $("#pd-add"), note = $("#pd-size-note");
    const out = sel.size && isOut(p, sel.colour, sel.size);
    note.hidden = !out;
    if (out) note.textContent = `${sel.size} is sold out in ${COLOURS[sel.colour].name}.`;
    add.disabled = !sel.size;
    add.classList.toggle("primary", !out);
    add.textContent = !sel.size ? "Select a size" : out ? `Email me when ${sel.size} is back` : `Add to bag · ${price(p.price)}`;
    // A sold-out size offers a back-in-stock email instead.
    $("#pd-restock").hidden = !out;
    if (out) {
      $("#restock-label").textContent = `Email me if ${sel.size} comes back in ${COLOURS[sel.colour].name}`;
      if (user && !$("#restock-email").value) $("#restock-email").value = user.email;
    }
    updateBuybar();
  }
  async function requestRestock() {
    const input = $("#restock-email"), msg = $("#restock-msg"), email = input.value.trim();
    const p = sel.p, colour = sel.colour, size = sel.size;
    if (!EMAIL_RE.test(email)) { msg.textContent = "Enter an email address, like name@example.com."; input.focus(); return; }
    const db = await dbReady;
    if (!db) { msg.textContent = "Preview only: back-in-stock requests aren't saved yet."; return; }
    $("#restock-go").disabled = true;
    const { error } = await db.from("restock_alerts").insert({ email, product_id: p.id, colour, size });
    $("#restock-go").disabled = false;
    msg.textContent = !error ? `Done. We'll email ${email} if ${size} comes back in ${COLOURS[colour].name}.`
      : error.code === "23505" ? `You're already on the list for ${size} in ${COLOURS[colour].name}.`
      : `That didn't work: ${String(error.message).replace(/\.$/, "")}. Try again.`;
  }

  if (pdForm) {
    $("#pd-units").addEventListener("click", e => {
      const b = e.target.closest("[data-unit]");
      if (!b || b.dataset.unit === units) return;
      const v = parseFloat($("#finder-in").value);
      units = b.dataset.unit;
      if (isFinite(v)) $("#finder-in").value = units === "in" ? (v / 2.54).toFixed(1) : (v * 2.54).toFixed(1);
      renderGuide();
      $("#finder-out").textContent = "";
    });
    $("#finder-go").addEventListener("click", suggestSize);
    $("#finder-in").addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); suggestSize(); } });
    $("#pd-guide-link").addEventListener("click", () => openSection("#pd-guide-wrap"));
    $("#pd-returns-link").addEventListener("click", () => openSection("#pd-returns-wrap"));
    $("#pd-swatches").addEventListener("change", async e => {
      if (e.target.name !== "pd-colour") return;
      sel.colour = e.target.value;
      if (stage) {
        const b = burst(pdStatic, 280);
        const shot = modelOn && modelShot(sel.p, sel.colour);
        await Promise.all([still ? null : wait(120), preload(shot ? lookSrc(shot.look, shot.look.w / 2) : imgSrc(sel.p, sel.colour, side))]);
        renderVariant();
        noteRecent(sel.p.id, sel.colour);
        syncUrl(false);
        $("#pd-full").href = pageUrl(sel.p.id, sel.colour);
        await b;
        return;
      }
      await preload(imgSrc(sel.p, sel.colour, "front", narrowScreen));
      renderVariant();
      noteRecent(sel.p.id, sel.colour);
      pageColourUrl();
    });
    $("#pd-sizes").addEventListener("change", e => {
      if (e.target.name !== "pd-size") return;
      sel.size = e.target.value;
      updateAdd();
    });
    $("#pd-fit-view").addEventListener("click", () => {
      if (stage) { setModel(!modelOn); return; }
      // On the product page: bring the first on-model photo into view.
      const i = galItems.findIndex(it => it.kind === "look");
      if (i >= 0) showSlide(i);
    });
    $("#pd-save").addEventListener("click", () => toggleSaved(sel.p.id, sel.colour));
    $("#restock-go").addEventListener("click", requestRestock);
    $("#restock-email").addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); requestRestock(); } });
    pdForm.addEventListener("submit", e => {
      e.preventDefault();
      if (!sel.size) return;
      const p = sel.p, colour = sel.colour, size = sel.size;
      if (isOut(p, colour, size)) { $("#restock-email").focus(); return; }
      const from = flyFrom();
      const src = imgSrc(p, colour, stage && !modelOn ? side : "front");
      addToBag(p.id, colour, size);
      if (pd) pd.close();
      const msg = `Added ${p.name}, ${COLOURS[colour].name}, ${size}`;
      flyToBag(from, src).then(() => { bumpBag(); showToast(msg); });
      announce(`${msg} to your bag.`);
    });
  }
  // Where the photo flies to the bag from: the turntable, the gallery photo in view, or the button.
  function flyFrom() {
    if (stage) return stage.getBoundingClientRect();
    const slide = gal && gal.children[galIndex];
    const r = slide ? slide.getBoundingClientRect() : null;
    if (r && r.top >= 0 && r.bottom <= window.innerHeight) return r;
    const btn = (buybar && buybar.classList.contains("show") ? $("#buybar-add") : $("#pd-add")).getBoundingClientRect();
    return { left: btn.left + btn.width / 2 - 50, top: btn.top - 130, width: 100, height: 120 };
  }

  if (pd) {
    $("#pd-pairs").addEventListener("click", async e => {
      const b = e.target.closest("[data-id]");
      if (!b) return;
      const q = byId[b.dataset.id];
      const s = burst(pdStatic, 260);
      await Promise.all([still ? null : wait(110), preload(imgSrc(q, q.colours[0], "front"))]);
      openProduct(q.id);
      await s;
    });
    $("#pd-views").addEventListener("click", async e => {
      const b = e.target.closest("[data-view]");
      if (!b) return;
      const v = b.dataset.view;
      if (v === "model") { setModel(true); return; }
      if (modelOn) { await setModel(false); if (v === "back") tweenTo(180, 760); return; }
      if (zoomed) setZoom(false);
      tweenTo(nearest(v === "back" ? 180 : 0), 760);
    });
    $("#pd-close").addEventListener("click", () => pd.close());
    // The quick view added a history entry with the product's address. Step back out of it first, so
    // the history reads shop, then product page, and Back from the product page returns to the shop.
    $("#pd-full").addEventListener("click", e => {
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.button || !ROUTING || !(history.state && history.state.pd)) return;
      e.preventDefault();
      const href = $("#pd-full").href;
      window.addEventListener("popstate", () => { location.href = href; }, { once: true });
      history.back();
    });
  }
  async function setModel(on) {
    if (on === modelOn) return;
    tweenId++;
    setZoom(false);
    const shot = on && modelShot(sel.p, sel.colour);
    const b = burst(pdStatic, 260);
    await Promise.all([still ? null : wait(110), shot ? preload(lookSrc(shot.look, shot.look.w / 2)) : null]);
    modelOn = on;
    angle = 0;
    side = "front";
    turn.style.transform = "";
    face.style.transform = "";
    renderVariant();
    await b;
  }

  // ---- Product page: gallery, full-screen viewer, buy bar ---------------------
  const gal = $("#gal-track"), lb = $("#lightbox"), buybar = $("#buybar");
  let galItems = [], galIndex = 0;
  // Product photos (front, back), then every lookbook photo with this piece in it.
  function galleryFor(p, key) {
    return [...p.views.map(view => ({ kind: "product", view })),
      ...modelShots(p, key).map(shot => ({ kind: "look", shot }))];
  }
  const galAlt = it => it.kind === "product" ? altFor(sel.p, sel.colour, it.view) : it.shot.look.alt;
  function renderGallery() {
    if (!gal) return;
    const p = sel.p, key = sel.colour;
    const first = !galItems.length;
    galItems = galleryFor(p, key);
    // The page arrives with the gallery already drawn in its first colour; keep those photos rather
    // than swapping in identical ones, which would make the browser paint the main photo twice.
    if (first && gal.dataset.colour === key && gal.children.length === galItems.length) { renderDots(); return; }
    gal.dataset.colour = key;
    const odd = galItems.length % 2 === 1;
    gal.classList.toggle("odd", odd);
    gal.innerHTML = galItems.map((it, i) => {
      const sizes = odd && i === 0 ? "(max-width: 900px) 100vw, 56vw" : "(max-width: 900px) 100vw, 28vw";
      const img = it.kind === "product"
        ? art(p, key, it.view, { sizes, alt: galAlt(it), lazy: i > 1 })
        : lookImg(it.shot.look, { sizes, cls: "cover", lazy: i > 1 });
      const cap = it.kind === "look" ? `<p class="gal-cap" aria-hidden="true">${esc(shotCaption(p, it.shot))}</p>` : "";
      return `<li class="gal-slide"><button class="gal-btn" type="button" data-i="${i}">${img}<span class="vh">${it.kind === "look" ? `${esc(shotCaption(p, it.shot))}. ` : ""}Open full screen</span></button>${cap}</li>`;
    }).join("");
    gal.scrollLeft = 0;
    renderDots();
  }
  function renderDots() {
    $("#gal-dots").innerHTML = galItems.length > 1 ? galItems.map((it, i) =>
      `<button class="gal-dot" type="button" data-i="${i}" aria-label="Photo ${i + 1} of ${galItems.length}"${i === 0 ? ' aria-current="true"' : ""}></button>`).join("") : "";
    setGalIndex(0);
  }
  function setGalIndex(i) {
    galIndex = i;
    $("#gal-count").textContent = galItems.length > 1 ? `${i + 1} / ${galItems.length}` : "";
    document.querySelectorAll("#gal-dots .gal-dot").forEach((d, j) => { if (j === i) d.setAttribute("aria-current", "true"); else d.removeAttribute("aria-current"); });
  }
  // On phones the gallery swipes sideways; on wider screens the photos stack and scroll with the page.
  const galSwipes = () => gal.scrollWidth > gal.clientWidth + 2;
  function showSlide(i) {
    const li = gal.children[i];
    if (!li) return;
    if (galSwipes()) {
      gal.scrollTo({ left: li.offsetLeft, behavior: still ? "auto" : "smooth" });
      gal.scrollIntoView({ behavior: still ? "auto" : "smooth", block: "nearest" });
    } else li.scrollIntoView({ behavior: still ? "auto" : "smooth", block: "center" });
    setGalIndex(i);
  }
  if (gal) {
    let galT = 0;
    gal.addEventListener("scroll", () => {
      cancelAnimationFrame(galT);
      galT = requestAnimationFrame(() => { if (galSwipes()) setGalIndex(clamp(Math.round(gal.scrollLeft / gal.clientWidth), 0, galItems.length - 1)); });
    }, { passive: true });
    gal.addEventListener("click", e => { const b = e.target.closest("[data-i]"); if (b) openLightbox(+b.dataset.i); });
    $("#gal-dots").addEventListener("click", e => { const b = e.target.closest("[data-i]"); if (b) showSlide(+b.dataset.i); });
  }

  // Full-screen viewer: swipe or use the arrows between photos; tap or click to zoom in, then drag
  // (or move the mouse) to look around.
  const lbTrack = $("#lb-track");
  let lbIndex = 0, lbDown = null;
  const LB_ZOOM = 2.2;
  function openLightbox(i) {
    const p = sel.p, key = sel.colour;
    lbTrack.innerHTML = galItems.map(it => {
      const src = it.kind === "product" ? imgSrc(p, key, it.view) : lookSrc(it.shot.look, it.shot.look.w);
      return `<li class="lb-slide"><img src="${src}" alt="${esc(galAlt(it))}" decoding="async" draggable="false"></li>`;
    }).join("");
    lb.classList.remove("zoomed");
    if (!lb.open) lb.showModal();
    lbTrack.scrollLeft = lbTrack.clientWidth * i;
    setLbIndex(i);
    $("#lb-close").focus();
  }
  function setLbIndex(i) {
    lbIndex = i;
    $("#lb-count").textContent = `${i + 1} / ${galItems.length}`;
    $("#lb-prev").disabled = i === 0;
    $("#lb-next").disabled = i === galItems.length - 1;
  }
  function lbGo(i) {
    if (i < 0 || i >= galItems.length) return;
    unzoomAll();
    lbTrack.scrollTo({ left: lbTrack.clientWidth * i, behavior: still ? "auto" : "smooth" });
    setLbIndex(i);
  }
  function unzoomAll() {
    lbTrack.querySelectorAll(".lb-slide.zoomed").forEach(sl => sl.classList.remove("zoomed"));
    lb.classList.remove("zoomed");
  }
  function zoomAt(slide, e) {
    const img = slide.querySelector("img"), r = img.getBoundingClientRect();
    img.style.transformOrigin = `${clamp((e.clientX - r.left) / r.width * 100, 0, 100)}% ${clamp((e.clientY - r.top) / r.height * 100, 0, 100)}%`;
  }
  if (lb) {
    lbTrack.addEventListener("scroll", () => {
      if (!lb.classList.contains("zoomed")) setLbIndex(clamp(Math.round(lbTrack.scrollLeft / lbTrack.clientWidth), 0, galItems.length - 1));
    }, { passive: true });
    lbTrack.addEventListener("pointerdown", e => {
      const slide = e.target.closest(".lb-slide");
      if (!slide) return;
      const o = getComputedStyle(slide.querySelector("img")).transformOrigin.split(" ").map(parseFloat);
      lbDown = { x: e.clientX, y: e.clientY, ox: o[0], oy: o[1], moved: false, id: e.pointerId };
    });
    lbTrack.addEventListener("pointermove", e => {
      const slide = e.target.closest(".lb-slide.zoomed");
      if (!slide) return;
      if (e.pointerType === "mouse") { zoomAt(slide, e); return; }
      if (!lbDown || e.pointerId !== lbDown.id) return;
      // Touch: drag the photo around. Moving the origin by d moves the picture by d x (1 - zoom).
      const dx = e.clientX - lbDown.x, dy = e.clientY - lbDown.y;
      if (Math.hypot(dx, dy) > 6) lbDown.moved = true;
      const img = slide.querySelector("img"), w = img.clientWidth, h = img.clientHeight;
      img.style.transformOrigin = `${clamp(lbDown.ox - dx / (LB_ZOOM - 1), 0, w)}px ${clamp(lbDown.oy - dy / (LB_ZOOM - 1), 0, h)}px`;
    });
    lbTrack.addEventListener("pointerup", e => {
      const down = lbDown;
      lbDown = null;
      const slide = e.target.closest(".lb-slide");
      if (!slide || (down && (down.moved || Math.hypot(e.clientX - down.x, e.clientY - down.y) > 6))) return;
      const on = !slide.classList.contains("zoomed");
      unzoomAll();
      if (on) { zoomAt(slide, e); slide.classList.add("zoomed"); lb.classList.add("zoomed"); }
    });
    lbTrack.addEventListener("pointercancel", () => { lbDown = null; });
    $("#lb-prev").addEventListener("click", () => lbGo(lbIndex - 1));
    $("#lb-next").addEventListener("click", () => lbGo(lbIndex + 1));
    $("#lb-close").addEventListener("click", () => lb.close());
    lb.addEventListener("keydown", e => {
      if (e.key === "ArrowRight") { e.preventDefault(); lbGo(lbIndex + 1); }
      if (e.key === "ArrowLeft") { e.preventDefault(); lbGo(lbIndex - 1); }
    });
    // Closing the viewer leaves the gallery on the photo it was showing.
    lb.addEventListener("close", () => { unzoomAll(); if (galSwipes()) { gal.scrollLeft = gal.children[lbIndex].offsetLeft; setGalIndex(lbIndex); } });
  }

  // Buy bar (phones): shows while the page's own Add to bag button is off screen.
  function updateBuybar() {
    if (!buybar || !sel.p) return;
    const p = sel.p, out = sel.size && isOut(p, sel.colour, sel.size);
    $("#buybar-name").textContent = p.name;
    $("#buybar-opt").textContent = `${COLOURS[sel.colour].name} · ${sel.size ? sel.size : "Choose a size"} · ${price(p.price)}`;
    $("#buybar-add").textContent = !sel.size ? "Select size" : out ? "Sold out" : "Add to bag";
  }
  if (buybar) {
    document.body.classList.add("has-buybar");
    if ("IntersectionObserver" in window) {
      new IntersectionObserver(([en]) => {
        const show = !en.isIntersecting;
        buybar.classList.toggle("show", show);
        buybar.toggleAttribute("inert", !show);
      }).observe($("#pd-add"));
    }
    $("#buybar-add").addEventListener("click", () => {
      if (sel.size && !isOut(sel.p, sel.colour, sel.size)) { pdForm.requestSubmit(); return; }
      // No size yet: take the shopper to the sizes.
      const first = $("#pd-sizes input:not(:checked)") || $("#pd-sizes input");
      $("#pd-sizes").scrollIntoView({ behavior: still ? "auto" : "smooth", block: "center" });
      if (first) first.focus({ preventScroll: true });
      announce(sel.size ? `${sel.size} is sold out. Choose another size.` : "Choose a size.");
    });
  }
  if (pdp) $("#look-kit").addEventListener("click", () => {
    const p = sel.p;
    openKit({ title: "Complete the look", items: [[p.id, sel.colour], ...p.pairs.map(id => [id, firstIn(byId[id])])] });
  });
  // The product page's address follows the chosen colour, so it can be shared as it is.
  function pageColourUrl() {
    if (!ROUTING || !pdp) return;
    try { history.replaceState(history.state, "", pageUrl(sel.p.id, sel.colour)); } catch { /* the address just doesn't change */ }
  }

  function flyToBag(from, src) {
    if (still || !from.width) return Promise.resolve();
    const el = document.createElement("img");
    el.className = "flyer product-img";
    el.src = src;
    el.alt = "";
    Object.assign(el.style, { left: `${from.left}px`, top: `${from.top}px`, width: `${from.width}px`, height: `${from.height}px` });
    document.body.appendChild(el);
    $("#site-head").classList.remove("hide");
    const to = $("#bag-open").getBoundingClientRect();
    const dx = to.left + to.width / 2 - (from.left + from.width / 2);
    const dy = to.top + to.height / 2 - (from.top + from.height / 2);
    const s = 44 / from.width;
    const anim = el.animate([
      { transform: "translate(0,0) scale(1) rotate(0deg)", opacity: 1 },
      { transform: `translate(${dx * 0.45}px,${dy * 0.45 - 140}px) scale(${(0.6 + s) / 2}) rotate(-14deg)`, opacity: 1, offset: 0.5 },
      { transform: `translate(${dx}px,${dy}px) scale(${s}) rotate(10deg)`, opacity: 0.35 },
    ], { duration: 900, easing: "cubic-bezier(.55,0,.25,1)" });
    return anim.finished.then(() => el.remove(), () => el.remove());
  }

  // ---- Reviews -------------------------------------------------------------------------
  // Star ratings and written reviews from signed-in shoppers, shown once an admin approves them on the
  // admin page. Stars appear on product cards and pages; a product page lists its reviews and a fit summary.
  const STAR_PATH = "M12 2.6l2.9 6 6.5.8-4.8 4.5 1.2 6.5L12 17.3l-5.8 3.1 1.2-6.5-4.8-4.5 6.5-.8z";
  const FIT_WORDS = { small: "Runs small", true: "True to size", large: "Runs large" };
  let reviewStats = {}; // product id -> { count, average, fit_small, fit_true, fit_large }
  const starsHtml = (avg, label) => `<span class="stars" style="--r:${(+avg).toFixed(2)}"${label ? ` role="img" aria-label="${esc(label)}"` : ' aria-hidden="true"'}></span>`;
  const reviewsWord = n => `${n} ${n === 1 ? "review" : "reviews"}`;
  function cardStars(id) {
    const st = reviewStats[id];
    return st && st.count ? `${starsHtml(st.average, `Rated ${st.average.toFixed(1)} out of 5 from ${reviewsWord(st.count)}`)}<span class="stars-n" aria-hidden="true">${st.average.toFixed(1)} (${st.count})</span>` : "";
  }
  async function loadReviewStats() {
    const db = await dbReady;
    if (!db) return;
    const { data, error } = await db.from("review_stats").select("product_id,count,average,fit_small,fit_true,fit_large");
    if (error) { console.warn(`PLUGE: couldn't load review stars: ${error.message}`); return; }
    reviewStats = Object.fromEntries((data || []).map(r => [r.product_id, r]));
    document.querySelectorAll(".card-stars[data-id]").forEach(el => { el.innerHTML = cardStars(el.dataset.id); });
    if (pdp && sel.p) renderReviewSummary();
  }

  const rvSec = $("#reviews");
  let rvList = [], rvShown = 6, rvMine = null, rvHasMine = false;
  function renderReviewSummary() {
    const p = sel.p, st = reviewStats[p.id], stars = $("#pd-stars");
    stars.hidden = !(st && st.count);
    if (st && st.count) {
      stars.innerHTML = `${starsHtml(st.average)}<span>${st.average.toFixed(1)} · ${reviewsWord(st.count)}</span><span class="vh">, out of 5. Go to reviews</span>`;
      updateRatingLd(st);
    }
    const box = $("#rv-summary");
    if (!st || !st.count) {
      box.innerHTML = `<p class="rv-empty">${acctCfg ? `No reviews yet. Got the ${esc(p.name)}? Be the first to say what you think.` : "Reviews open when the shop launches."}</p>`;
      return;
    }
    const votes = st.fit_small + st.fit_true + st.fit_large;
    const pos = votes ? (st.fit_true * 50 + st.fit_large * 100) / votes : 50; // 0 small, 50 true, 100 large
    box.innerHTML = `<div class="rv-score"><b>${st.average.toFixed(1)}</b>${starsHtml(st.average, `${st.average.toFixed(1)} out of 5 stars`)}<span>${reviewsWord(st.count)}</span></div>
      ${votes ? `<div class="rv-fit"><p>How it fits: <b>${pos < 35 ? FIT_WORDS.small : pos > 65 ? FIT_WORDS.large : FIT_WORDS.true}</b> <span class="rv-fit-n">(${votes} ${votes === 1 ? "vote" : "votes"})</span></p>
        <div class="rv-fit-bar" aria-hidden="true"><i style="left:${pos.toFixed(0)}%"></i></div><p class="rv-fit-ends" aria-hidden="true"><span>Small</span><span>True to size</span><span>Large</span></p></div>` : ""}`;
  }
  // Adds the rating to the product's search-engine data, so results can show its stars.
  function updateRatingLd(st) {
    const el = [...document.querySelectorAll('script[type="application/ld+json"]')].find(x => /"@type":"Product"/.test(x.textContent));
    if (!el) return;
    try {
      const data = JSON.parse(el.textContent);
      data.aggregateRating = { "@type": "AggregateRating", ratingValue: st.average.toFixed(1), reviewCount: st.count, bestRating: 5, worstRating: 1 };
      el.textContent = JSON.stringify(data).replace(/</g, "\\u003c");
    } catch { /* leave the data as it was */ }
  }
  async function loadReviews() {
    const db = await dbReady;
    if (!db || !sel.p) { renderReviewList(); return; }
    const id = sel.p.id, cols = "id,author,rating,title,body,size,fit,verified,status,created_at";
    const who = await authKnown;
    const [list, mine] = await Promise.all([
      db.from("reviews").select(cols).eq("product_id", id).eq("status", "approved").order("created_at", { ascending: false }).limit(100),
      user || who ? db.from("reviews").select(cols).eq("product_id", id).eq("user_id", (user || who).id).maybeSingle() : Promise.resolve({ data: null }),
    ]);
    if (list.error) console.warn(`PLUGE: couldn't load reviews: ${list.error.message}`);
    rvList = list.data || [];
    rvHasMine = !!(mine && mine.data);
    rvMine = rvHasMine && mine.data.status !== "approved" ? mine.data : null;
    renderReviewList();
  }
  function reviewHtml(r, own) {
    const when = new Date(r.created_at);
    return `<li class="rv${own ? " own" : ""}">
        <div class="rv-top">${starsHtml(r.rating, `${r.rating} out of 5 stars`)}${r.title ? `<b class="rv-title">${esc(r.title)}</b>` : ""}</div>
        <p class="rv-body">${esc(r.body)}</p>
        <p class="rv-meta"><span class="rv-author">${esc(r.author)}</span>${r.verified ? `<span class="rv-verified">Verified buyer</span>` : ""}${r.size ? `<span>Bought ${esc(r.size)}</span>` : ""}${r.fit ? `<span>${FIT_WORDS[r.fit] || ""}</span>` : ""}<span>${isNaN(when) ? "" : `${when.getDate()} ${MONTHS[when.getMonth()]} ${when.getFullYear()}`}</span></p>
        ${own ? `<p class="rv-status">${r.status === "rejected" ? "Your review wasn't approved, so only you can see it." : "Your review is waiting for approval. Only you can see it for now."}</p>` : ""}
      </li>`;
  }
  function renderReviewList() {
    $("#rv-list").innerHTML = (rvMine ? reviewHtml(rvMine, true) : "") + rvList.slice(0, rvShown).map(r => reviewHtml(r, false)).join("");
    $("#rv-more").hidden = rvList.length <= rvShown;
    $("#review-write").hidden = rvHasMine;
  }
  function reviewFormHtml() {
    const p = sel.p, name = (user.user_metadata && user.user_metadata.name) || "";
    const star = n => `<input type="radio" name="rating" id="rv-r${n}" value="${n}"><label for="rv-r${n}" title="${n} ${n === 1 ? "star" : "stars"}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="${STAR_PATH}"/></svg><span class="vh">${n} ${n === 1 ? "star" : "stars"}</span></label>`;
    const sized = p.sizes.length > 1;
    return `<form class="rv-form" id="rv-form" novalidate>
        <h3 class="acct-h">Review the ${esc(p.name)}</h3>
        <fieldset class="rv-rate"><legend>Your rating</legend><div class="star-pick">${[5, 4, 3, 2, 1].map(star).join("")}</div></fieldset>
        <label class="field" for="rv-title"><span>Headline <span class="field-opt">(optional)</span></span><input id="rv-title" name="title" maxlength="80"></label>
        <label class="field" for="rv-body"><span>Your review</span><textarea id="rv-body" name="body" maxlength="2000" required></textarea></label>
        ${sized ? `<div class="rv-row"><label class="field" for="rv-size"><span>Size you got <span class="field-opt">(optional)</span></span><select id="rv-size" name="size"><option value="">Choose</option>${p.sizes.map(z => `<option>${esc(z)}</option>`).join("")}</select></label>
        <fieldset class="rv-fitpick"><legend>How does it fit? <span class="field-opt">(optional)</span></legend>${["small", "true", "large"].map(f => `<label><input type="radio" name="fit" value="${f}"> ${FIT_WORDS[f]}</label>`).join("")}</fieldset></div>` : ""}
        <label class="field" for="rv-author"><span>Name shown with your review</span><input id="rv-author" name="author" maxlength="40" autocomplete="given-name" value="${esc(name)}"></label>
        <p class="fine">We read every review before it goes up. Please leave out personal details like your address.</p>
        <div class="acct-row"><button class="btn primary" type="submit">Submit review</button><button class="btn" type="button" data-act="rv-cancel">Cancel</button></div>
        <p class="form-msg" id="rv-msg" role="status"></p>
      </form>`;
  }
  async function openReviewForm() {
    const wrap = $("#rv-form-wrap");
    if (!acctCfg) {
      wrap.hidden = false;
      wrap.innerHTML = `<p class="acct-preview" tabindex="-1">Preview: reviews switch on once the shop's database is connected.</p>`;
      wrap.firstElementChild.focus();
      return;
    }
    await authKnown;
    if (!user) {
      afterSignIn = () => { openReviewForm(); };
      acctView = "signin";
      openAccount();
      acctMsg = "Sign in or create an account to write a review.";
      $("#acct-msg").textContent = acctMsg;
      return;
    }
    wrap.hidden = false;
    wrap.innerHTML = reviewFormHtml();
    wrap.scrollIntoView({ behavior: still ? "auto" : "smooth", block: "start" });
    $("#rv-r5").focus({ preventScroll: true });
  }
  async function submitReview(form) {
    const f = form.elements, msg = $("#rv-msg"), p = sel.p;
    const pick = name => (form.querySelector(`input[name="${name}"]:checked`) || {}).value || null;
    const rating = Number(pick("rating")), body = f.body.value.trim(), author = f.author.value.trim();
    const fail = (text, el) => { msg.classList.add("err"); msg.textContent = text; el.focus(); };
    if (!rating) return fail("Choose a star rating.", $("#rv-r5"));
    if (body.length < 10) return fail("Write a little more: at least 10 characters.", f.body);
    if (!author) return fail("Enter the name to show with your review.", f.author);
    msg.classList.remove("err");
    msg.textContent = "Sending…";
    const btn = form.querySelector('[type="submit"]');
    btn.disabled = true;
    const db = await dbReady;
    const { error } = await db.from("reviews").insert({ product_id: p.id, product_name: p.name, author, rating, title: f.title.value.trim() || null, body,
      size: (f.size && f.size.value) || null, fit: pick("fit") });
    btn.disabled = false;
    if (error) return fail(error.code === "23505" ? "You've already reviewed this piece." : `Your review didn't send: ${String(error.message).replace(/\.$/, "")}. Try again.`, btn);
    $("#rv-form-wrap").innerHTML = `<p class="rv-thanks" tabindex="-1">Thanks, ${esc(author)}. Your review will appear here once we've checked it.</p>`;
    $("#rv-form-wrap .rv-thanks").focus();
    loadReviews();
  }
  if (rvSec) {
    $("#review-write").addEventListener("click", openReviewForm);
    $("#rv-more").addEventListener("click", () => {
      rvShown += 6;
      renderReviewList();
      const items = $("#rv-list").children;
      if (items[rvShown - 6]) { items[rvShown - 6].setAttribute("tabindex", "-1"); items[rvShown - 6].focus(); }
    });
    $("#rv-form-wrap").addEventListener("submit", e => { e.preventDefault(); submitReview(e.target); });
    $("#rv-form-wrap").addEventListener("click", e => {
      if (!e.target.closest('[data-act="rv-cancel"]')) return;
      $("#rv-form-wrap").hidden = true;
      $("#review-write").focus();
    });
    $("#pd-stars").addEventListener("click", () => { rvSec.scrollIntoView({ behavior: still ? "auto" : "smooth" }); $("#reviews-title").setAttribute("tabindex", "-1"); $("#reviews-title").focus({ preventScroll: true }); });
    document.addEventListener("pluge:auth", () => { if (sel.p) loadReviews(); });
  }

  // ---- Your sizes ------------------------------------------------------------------
  // The size a shopper takes in tops, bottoms and socks: learned from the first thing they add to the bag
  // in each, editable in the account panel, kept in the account when signed in, and picked for them on
  // product pages and in "shop the look".
  const SIZE_GROUPS = [["tops", "Hoodies, crews and tees"], ["bottoms", "Joggers"], ["socks", "Socks"]];
  const sizeGroup = p => !p || p.sizes.length < 2 ? null : p.cat === "bottoms" ? "bottoms" : p.cat === "acc" ? "socks" : "tops";
  const groupSizes = g => { const p = PRODUCTS.find(x => sizeGroup(x) === g); return p ? p.sizes : []; };
  function cleanSizes(v) {
    const out = {};
    if (v && typeof v === "object") for (const [g] of SIZE_GROUPS) if (groupSizes(g).includes(v[g])) out[g] = v[g];
    return out;
  }
  let mySizes = (() => { try { return cleanSizes(JSON.parse(localStorage.getItem(SIZES_KEY) || "{}")); } catch { return {}; } })();
  function saveSizes() {
    try { localStorage.setItem(SIZES_KEY, JSON.stringify(mySizes)); } catch { /* kept for this visit */ }
    markDirty();
  }
  function learnSize(p, size) {
    const g = sizeGroup(p);
    if (g && !mySizes[g] && p.sizes.includes(size)) { mySizes[g] = size; saveSizes(); }
  }
  const usualSize = p => { const g = sizeGroup(p); return g && mySizes[g] && p.sizes.includes(mySizes[g]) ? mySizes[g] : null; };

  // ---- Discount codes -----------------------------------------------------------------
  // A code from a link (?discount=CODE) or typed into the bag is handed to Shopify's checkout, which
  // checks it and takes it off the total.
  const validCode = c => /^[A-Za-z0-9_-]{2,40}$/.test(c);
  let discount = (() => { try { const c = localStorage.getItem(DISCOUNT_KEY) || ""; return validCode(c) ? c : ""; } catch { return ""; } })();
  function setDiscount(code) {
    discount = code;
    try { if (code) localStorage.setItem(DISCOUNT_KEY, code); else localStorage.removeItem(DISCOUNT_KEY); } catch { /* kept for this visit */ }
    renderPromo();
  }
  function renderPromo() {
    const on = $("#promo-on");
    on.hidden = !discount;
    on.innerHTML = discount ? `Code <b>${esc(discount)}</b> goes on at checkout. <button class="link-btn" type="button" id="promo-remove">Remove<span class="vh"> code ${esc(discount)}</span></button>` : "";
    $("#promo-add").hidden = !!discount;
  }
  $("#promo").addEventListener("click", e => {
    if (e.target.closest("#promo-remove")) { setDiscount(""); $("#promo-add").open = true; $("#promo-in").focus(); announce("Discount code removed."); return; }
    if (!e.target.closest("#promo-apply")) return;
    const code = $("#promo-in").value.trim();
    if (!validCode(code)) { $("#promo-msg").textContent = "Enter the code as it was given to you, like WELCOME10."; $("#promo-in").focus(); return; }
    $("#promo-msg").textContent = "";
    $("#promo-in").value = "";
    setDiscount(code);
    announce(`Code ${code} saved. Shopify checks it and takes it off at checkout.`);
    $("#promo-remove").focus();
  });
  $("#promo-in").addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); $("#promo-apply").click(); } });
  {
    const fromLink = (new URLSearchParams(location.search).get("discount") || "").trim();
    if (fromLink && validCode(fromLink)) {
      setDiscount(fromLink);
      setTimeout(() => showToast(`Code ${fromLink} saved. It comes off at checkout.`, { bagLink: false }), 600);
      if (ROUTING) { try { const u = new URL(location.href); u.searchParams.delete("discount"); history.replaceState(history.state, "", u.href); } catch { /* the code stays in the address */ } }
    }
  }

  // ---- Bag -----------------------------------------------------------------
  const bagDlg = $("#bag");
  let bag = loadBag(), shipKey = SHIP_KEYS[0];
  const fresh = new Set(); // lines just added, highlighted the next time the bag opens

  // Keeps only lines for products, colours and sizes that still exist (from this browser or the account).
  function cleanBag(v) {
    if (!Array.isArray(v)) return [];
    return v.filter(l => l && byId[l.id] && COLOURS[l.colour] && byId[l.id].colours.includes(l.colour) &&
      byId[l.id].sizes.includes(l.size) && Number.isInteger(l.qty) && l.qty > 0)
      .map(l => ({ id: l.id, colour: l.colour, size: l.size, qty: Math.min(l.qty, MAX_QTY) }));
  }
  function loadBag() {
    try { return cleanBag(JSON.parse(localStorage.getItem(BAG_KEY) || "[]")); } catch { return []; }
  }
  function saveBag() {
    try { localStorage.setItem(BAG_KEY, JSON.stringify(bag)); } catch { /* storage unavailable; bag lasts for this visit */ }
    markDirty();
  }
  const lineKey = l => `${l.id}|${l.colour}|${l.size}`;

  function addToBag(id, colour, size) {
    learnSize(byId[id], size);
    const hit = bag.find(l => l.id === id && l.colour === colour && l.size === size);
    if (hit) hit.qty = Math.min(hit.qty + 1, MAX_QTY);
    else bag.push({ id, colour, size, qty: 1 });
    fresh.add(`${id}|${colour}|${size}`);
    saveBag();
    renderBag();
  }
  function bumpBag() {
    const btn = $("#bag-open");
    btn.classList.remove("bump");
    void btn.offsetWidth;
    btn.classList.add("bump");
  }

  function renderBag() {
    const count = bag.reduce((n, l) => n + l.qty, 0);
    const sub = Math.round(bag.reduce((s, l) => s + byId[l.id].price * l.qty, 0) * 100) / 100;
    const delivery = sub === 0 ? 0 : shipFee(shipKey, sub);

    $("#bag-count").textContent = count;
    $("#bag-open").setAttribute("aria-label", `Bag, ${count} ${count === 1 ? "item" : "items"}`);
    $("#bag-title").textContent = count ? `Bag (${count})` : "Bag";
    if (!checkingOut) $("#checkout-note").hidden = true;

    const empty = bag.length === 0;
    $("#bag-empty").hidden = !empty;
    $("#bag-lines").hidden = empty;
    $("#bag-foot").hidden = empty;
    $("#ship").hidden = empty;
    if (empty) { $("#bag-lines").innerHTML = ""; return; }

    const main = SHIP[SHIP_KEYS[0]], left = main.freeOver - sub;
    $("#ship-msg").textContent = left > 0 ? `Spend ${money(left)} more for free ${main.name}` : `You've got free ${main.name}`;
    $("#ship-bar").style.width = `${Math.min(100, (sub / main.freeOver) * 100)}%`;
    // One delivery option shows as a line; several become a choice.
    const several = SHIP_KEYS.length > 1;
    $("#ship-list").innerHTML = SHIP_KEYS.map(k => {
      const fee = shipFee(k, sub);
      const body = `<span><b>${esc(SHIP[k].name)}</b><small>Made to order, estimated ${estimate(k)}</small></span><em>${fee ? money(fee) : "Free"}</em>`;
      return several ? `<label class="ship-opt"><input type="radio" name="ship" value="${k}"${k === shipKey ? " checked" : ""}>${body}</label>` : `<p class="ship-opt one">${body}</p>`;
    }).join("");

    $("#bag-lines").innerHTML = bag.map(l => {
      const p = byId[l.id], k = lineKey(l);
      return `<li class="line${fresh.has(k) ? " fresh" : ""}">
        <span class="line-thumb">${art(p, l.colour, "front", { sizes: "80px" })}</span>
        <div>
          <p class="line-name">${esc(p.name)}</p>
          <p class="line-opts">${esc(COLOURS[l.colour].name)} · ${esc(l.size)}</p>
          <div class="line-ctl">
            <span class="qty">
              <button type="button" data-act="dec" data-key="${esc(k)}" aria-label="Remove one ${esc(p.name)}">−</button>
              <output aria-label="Quantity">${l.qty}</output>
              <button type="button" data-act="inc" data-key="${esc(k)}" aria-label="Add one more ${esc(p.name)}"${l.qty >= MAX_QTY ? " disabled" : ""}>+</button>
            </span>
            <button class="remove" type="button" data-act="remove" data-key="${esc(k)}">Remove</button>
          </div>
        </div>
        <span class="line-price">${money(p.price * l.qty)}</span>
      </li>`;
    }).join("");

    renderBagRecs();
    $("#t-sub").textContent = money(sub);
    $("#t-ship").textContent = delivery ? money(delivery) : "Free";
    $("#t-total").textContent = money(sub + delivery);
  }

  // Pieces that go with what's in the bag: the pairings of each piece first, then the rest of the drop.
  function renderBagRecs() {
    const inBag = new Set(bag.map(l => l.id));
    const paired = [...new Set(bag.flatMap(l => byId[l.id].pairs))].filter(id => !inBag.has(id));
    const recs = [...paired, ...PRODUCTS.map(p => p.id).filter(id => !inBag.has(id) && !paired.includes(id))].slice(0, 4).map(id => byId[id]);
    $("#bag-recs").hidden = !bag.length || !recs.length;
    $("#bag-recs-row").innerHTML = recs.map(p => `<li><a class="mini" href="${pageUrl(p.id, firstIn(p))}">
        <span class="mini-img">${art(p, firstIn(p), "front", { sizes: "120px" })}</span>
        <span class="mini-name">${esc(p.name)}</span><span class="mini-price">${price(p.price)}</span></a></li>`).join("");
  }

  $("#bag-lines").addEventListener("click", e => {
    const b = e.target.closest("[data-act]");
    if (!b) return;
    const line = bag.find(l => lineKey(l) === b.dataset.key);
    if (!line) return;
    const name = byId[line.id].name;
    if (b.dataset.act === "inc") line.qty = Math.min(line.qty + 1, MAX_QTY);
    if (b.dataset.act === "dec") line.qty -= 1;
    if (b.dataset.act === "remove") line.qty = 0;
    const removed = line.qty <= 0;
    bag = bag.filter(l => l.qty > 0);
    fresh.clear();
    saveBag();
    renderBag();
    if (removed) {
      announce(`Removed ${name} from your bag.`);
      (bag.length ? $("#bag-lines button") : $("#bag-shop")).focus();
    } else {
      const again = document.querySelector(`#bag-lines [data-act="${b.dataset.act}"][data-key="${CSS.escape(b.dataset.key)}"]`);
      if (again && !again.disabled) again.focus();
    }
  });
  $("#bag-foot").addEventListener("change", e => {
    if (e.target.name !== "ship") return;
    shipKey = e.target.value;
    fresh.clear();
    renderBag();
  });

  function openBag() { hideToast(); renderBag(); fresh.clear(); if (!bagDlg.open) bagDlg.showModal(); }
  $("#bag-open").addEventListener("click", openBag);
  $("#bag-close").addEventListener("click", () => bagDlg.close());
  $("#bag-continue").addEventListener("click", () => bagDlg.close());
  $("#bag-shop").addEventListener("click", () => { bagDlg.close(); goShop(); });

  // ---- Checkout: Shopify Storefront API ------------------------------------
  // With CHECKOUT filled in (catalog.js), the bag becomes a Shopify cart and the shopper pays on
  // Shopify's checkout. Without it, the bag explains that this is a preview.
  const shop = CHECKOUT && CHECKOUT.shopDomain && CHECKOUT.storefrontToken ? CHECKOUT : null;
  let variantsP = null, checkingOut = false;
  async function storefront(query, variables) {
    const res = await fetch(`https://${shop.shopDomain}/api/${shop.apiVersion}/graphql.json`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Shopify-Storefront-Access-Token": shop.storefrontToken },
      body: JSON.stringify({ query, variables }),
    });
    if (!res.ok) throw new Error(`the shop replied ${res.status}`);
    const json = await res.json();
    if (json.errors && json.errors.length) throw new Error(json.errors[0].message);
    return json.data;
  }
  // Shopify products (created by Printful) are matched by handle (= product id here) or by title, then by
  // their Colour and Size options.
  const optKey = v => norm(v).replace(/[^a-z0-9]+/g, "");
  const VARIANTS_Q = `query PlugeVariants {
    products(first: 100) { nodes { handle title variants(first: 100) { nodes {
      id availableForSale price { amount currencyCode } selectedOptions { name value }
    } } } }
  }`;
  function loadVariants() {
    if (variantsP) return variantsP;
    const colourByName = new Map(Object.entries(COLOURS).map(([k, c]) => [optKey(c.name), k]));
    const byTitle = new Map(PRODUCTS.map(p => [optKey(p.name), p]));
    variantsP = storefront(VARIANTS_Q).then(data => {
      const map = new Map();
      for (const prod of data.products.nodes) {
        const p = byId[prod.handle] || byTitle.get(optKey(prod.title));
        if (!p) continue;
        for (const v of prod.variants.nodes) {
          const opt = re => v.selectedOptions.find(o => re.test(o.name));
          const c = opt(/^colou?r$/i), z = opt(/^size$/i);
          const colour = c ? colourByName.get(optKey(c.value)) : p.colours.length === 1 ? p.colours[0] : null;
          const size = z ? p.sizes.find(x => optKey(x) === optKey(z.value)) : p.sizes.length === 1 ? p.sizes[0] : null;
          if (!colour || !size || !p.colours.includes(colour)) continue;
          map.set(`${p.id}|${colour}|${size}`, { id: v.id, available: v.availableForSale, price: Number(v.price.amount), currency: v.price.currencyCode });
        }
      }
      return map;
    });
    variantsP.catch(() => { variantsP = null; });
    return variantsP;
  }
  // Shopify's stock and prices replace the ones in catalog.js, so what's shown is what's charged.
  function applyStock(map) {
    for (const p of PRODUCTS) {
      const known = [...map.keys()].some(k => k.startsWith(`${p.id}|`));
      if (!known) { console.warn(`PLUGE: "${p.id}" isn't in the Shopify store, so it can't be bought yet.`); continue; }
      p.colours.forEach(k => { p.soldOut[k] = p.sizes.filter(sz => { const v = map.get(`${p.id}|${k}|${sz}`); return !v || !v.available; }); });
      const prices = [...map.entries()].filter(([k, v]) => k.startsWith(`${p.id}|`) && v.currency === "GBP").map(([, v]) => v.price);
      if (prices.length) p.price = Math.min(...prices);
    }
    renderGrid(false);
    renderFitList();
    renderLooks();
    renderBag();
    if ($("#hero-tag-price")) $("#hero-tag-price").textContent = price(byId["test-card-hoodie"].price);
    if ((pd && pd.open) || pdp) { $("#pd-price").textContent = price(sel.p.price); renderPairs(); renderVariant(); }
  }

  $("#checkout").addEventListener("click", async () => {
    const note = $("#checkout-note"), btn = $("#checkout");
    if (!shop) {
      note.textContent = "This is a preview site and isn't taking orders yet. No payment provider is connected, so nothing was charged.";
      note.hidden = false;
      return;
    }
    checkingOut = true;
    btn.disabled = true;
    btn.textContent = "Opening checkout…";
    note.hidden = true;
    try {
      const map = await loadVariants();
      const missing = bag.filter(l => !map.get(lineKey(l)) || !map.get(lineKey(l)).available);
      if (missing.length) {
        applyStock(map);
        const names = missing.map(l => `${byId[l.id].name} (${COLOURS[l.colour].name}, ${l.size})`);
        throw new Error(`${listing(names)} ${missing.length === 1 ? "has" : "have"} just sold out. Remove ${missing.length === 1 ? "it" : "them"} to carry on`);
      }
      const data = await storefront(`mutation PlugeCart($input: CartInput!) {
        cartCreate(input: $input) { cart { checkoutUrl } userErrors { field message } }
      }`, { input: { lines: bag.map(l => ({ merchandiseId: map.get(lineKey(l)).id, quantity: l.qty })), buyerIdentity: { countryCode: "GB", ...(user && user.email ? { email: user.email } : {}) }, ...(discount ? { discountCodes: [discount] } : {}) } });
      const { cart, userErrors } = data.cartCreate;
      if (userErrors && userErrors.length) throw new Error(userErrors[0].message);
      window.location.assign(cart.checkoutUrl);
    } catch (err) {
      note.textContent = `Checkout didn't open: ${String(err.message || err).replace(/\.$/, "")}. Nothing has been charged.`;
      note.hidden = false;
      btn.disabled = false;
      btn.textContent = "Checkout";
      checkingOut = false;
    }
  });
  $("#ship-fine").hidden = !shop;
  // Coming back from Shopify's checkout with the browser's back button restores this page from cache.
  window.addEventListener("pageshow", e => {
    if (!e.persisted || !checkingOut) return;
    checkingOut = false;
    $("#checkout").disabled = false;
    $("#checkout").textContent = "Checkout";
  });
  if (shop && shop.syncStock) loadVariants().then(applyStock, err => console.warn(`PLUGE: couldn't load stock from Shopify: ${err.message}`));

  // ---- Saved pieces ----------------------------------------------------------
  const savedDlg = $("#saved");
  let saved = readList(SAVED_KEY, validPick).slice(0, 60);
  const isSaved = id => saved.some(x => x.id === id);
  function toggleSaved(id, colour) {
    const on = !isSaved(id);
    saved = on ? [{ id, colour }, ...saved] : saved.filter(x => x.id !== id);
    writeList(SAVED_KEY, saved);
    markDirty();
    syncSavedButtons(id);
    if (savedDlg.open) renderSaved();
    syncMenu();
    announce(on ? `Saved ${byId[id].name}.` : `Removed ${byId[id].name} from saved.`);
  }
  // pop: the id that just changed, so its buttons get a little bounce.
  function syncSavedButtons(pop) {
    const n = saved.length;
    $("#saved-count").textContent = n;
    $("#saved-count").hidden = n === 0;
    $("#saved-open").setAttribute("aria-label", `Saved, ${n} ${n === 1 ? "piece" : "pieces"}`);
    const btns = [...document.querySelectorAll(".save-tog")];
    if (sel.p && $("#pd-save")) { $("#pd-save").dataset.id = sel.p.id; btns.push($("#pd-save")); }
    btns.forEach(b => {
      b.setAttribute("aria-pressed", String(isSaved(b.dataset.id)));
      if (pop && b.dataset.id === pop && !still) { b.classList.remove("pop"); void b.offsetWidth; b.classList.add("pop"); }
    });
    if (pop && !still) { const h = $("#saved-open"); h.classList.remove("pop"); void h.offsetWidth; h.classList.add("pop"); }
  }
  function renderSaved() {
    const empty = saved.length === 0;
    $("#saved-empty").hidden = !empty;
    $("#saved-lines").hidden = empty;
    $("#saved-share").hidden = empty;
    $("#saved-fine").textContent = user ? "Saved pieces are kept in your account, on every device you sign in on." : "Saved pieces are kept on this device. Sign in to keep them on every device.";
    $("#saved-lines").innerHTML = saved.map(x => {
      const p = byId[x.id], out = colourOut(p, x.colour);
      return `<li class="line">
        <span class="line-thumb">${art(p, x.colour, "front", { sizes: "80px" })}</span>
        <div>
          <p class="line-name">${esc(p.name)}</p>
          <p class="line-opts">${esc(COLOURS[x.colour].name)}${out ? " · Sold out" : ""}</p>
          <div class="line-ctl">
            <button class="btn small" type="button" data-act="open" data-id="${p.id}" data-colour="${x.colour}">${out ? "View" : "Choose size"}<span class="vh">: ${esc(p.name)}</span></button>
            <button class="remove" type="button" data-act="remove" data-id="${p.id}">Remove<span class="vh"> ${esc(p.name)}</span></button>
          </div>
        </div>
        <span class="line-price">${price(p.price)}</span>
      </li>`;
    }).join("");
  }
  $("#saved-lines").addEventListener("click", e => {
    const b = e.target.closest("[data-act]");
    if (!b) return;
    if (b.dataset.act === "open") { savedDlg.close(); showProduct(b.dataset.id, b.dataset.colour); return; }
    const i = saved.findIndex(x => x.id === b.dataset.id);
    toggleSaved(b.dataset.id);
    const rest = $("#saved-lines").querySelectorAll('[data-act="remove"]');
    (rest[Math.min(i, rest.length - 1)] || $("#saved-shop")).focus();
  });
  $("#saved-open").addEventListener("click", () => { renderSaved(); if (!savedDlg.open) savedDlg.showModal(); });
  // Share the saved list as a link: ?list=id.colour,id.colour opens it as a "shop the look" drawer.
  $("#saved-share").addEventListener("click", async () => {
    const url = `${ROOT}?list=${saved.map(x => `${x.id}.${x.colour}`).join(",")}`;
    if (navigator.share && !finePointer) {
      try { await navigator.share({ title: `${BRAND}: my saved pieces`, url }); return; } catch (err) { if (err && err.name === "AbortError") return; }
    }
    try {
      await navigator.clipboard.writeText(url);
      showToast("Link copied. Send it to anyone.", { bagLink: false });
      announce("Link to your saved pieces copied.");
    } catch {
      $("#saved-fine").innerHTML = `<label for="saved-link">Copy this link to share your list:</label><input class="share-link" id="saved-link" readonly value="${esc(url)}">`;
      $("#saved-link").select();
    }
  });
  $("#saved-close").addEventListener("click", () => savedDlg.close());
  $("#saved-shop").addEventListener("click", () => { savedDlg.close(); goShop(); });

  // ---- Recently viewed -----------------------------------------------------
  let recent = readList(RECENT_KEY, validPick).slice(0, 8);
  function noteRecent(id, colour) {
    recent = [{ id, colour }, ...recent.filter(x => x.id !== id)].slice(0, 8);
    writeList(RECENT_KEY, recent);
    markDirty();
  }
  // Shown under the grid on the home page and under a product page (leaving out that product).
  function renderRecent() {
    if (!$("#recent")) return;
    const list = recent.filter(x => !pdp || !sel.p || x.id !== sel.p.id);
    $("#recent").hidden = list.length === 0;
    $("#recent-row").innerHTML = list.map(x => {
      const p = byId[x.id];
      return `<li><a class="mini" href="${pageUrl(p.id, x.colour)}">
        <span class="mini-img">${art(p, x.colour, "front", { sizes: "150px" })}</span>
        <span class="mini-name">${esc(p.name)}</span><span class="mini-price">${price(p.price)}</span>
      </a></li>`;
    }).join("");
  }
  if ($("#recent")) $("#recent-clear").addEventListener("click", () => {
    recent = recent.filter(x => pdp && sel.p && x.id === sel.p.id);
    writeList(RECENT_KEY, recent);
    markDirty();
    renderRecent();
    announce("Cleared recently viewed.");
    const h = $("#shop-title") || $("#pd-name");
    h.setAttribute("tabindex", "-1");
    h.focus();
  });

  // ---- Customer accounts (Supabase) -----------------------------------------
  // An account keeps the bag, saved pieces and recently viewed in the database, so they follow the shopper
  // to any device, and lists their Shopify orders. The database's row rules keep each shopper's data private
  // (tools/supabase/schema.sql). Without ACCOUNTS settings the panel explains that it's a preview.
  const acctCfg = ACCOUNTS && ACCOUNTS.supabaseUrl && ACCOUNTS.supabaseKey ? ACCOUNTS : null;
  const SYNC_KEY = "pluge-sync-v1"; // { user, dirty }: whether this device has changes the account hasn't got yet
  const acctDlg = $("#account");
  let acctView = "signin", acctMsg = "", acctBusy = false, orders = null, confirmDelete = false;

  function readSync() { try { return JSON.parse(localStorage.getItem(SYNC_KEY) || "{}") || {}; } catch { return {}; } }
  function writeSync(v) { try { localStorage.setItem(SYNC_KEY, JSON.stringify(v)); } catch { /* kept for this visit */ } }
  const cleanPicks = v => Array.isArray(v) ? v.filter(validPick).map(x => ({ id: x.id, colour: x.colour })) : [];
  const mergePicks = (a, b) => [...a, ...b.filter(x => !a.some(y => y.id === x.id))];
  function mergeBags(a, b) {
    const out = a.map(l => ({ ...l }));
    for (const l of b) {
      const hit = out.find(x => lineKey(x) === lineKey(l));
      if (hit) hit.qty = Math.max(hit.qty, l.qty); else out.push({ ...l });
    }
    return out;
  }

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const el = document.createElement("script");
      el.src = src;
      el.onload = resolve;
      el.onerror = () => reject(new Error("the accounts library didn't load"));
      document.head.appendChild(el);
    });
  }
  async function initAccounts() {
    if (!acctCfg) { authKnownResolve(null); return null; }
    try {
      if (!window.supabase) await loadScript(`${ROOT}assets/js/vendor/supabase-2.117.2.js`);
      sb = window.supabase.createClient(acctCfg.supabaseUrl, acctCfg.supabaseKey, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, storageKey: "pluge-auth" },
      });
      // Supabase asks for other calls to wait until its auth callback has returned, hence the timeout.
      sb.auth.onAuthStateChange((event, session) => { setTimeout(() => onAuth(event, session), 0); });
      return sb;
    } catch (err) {
      console.warn(`PLUGE: accounts are unavailable: ${err.message}`);
      authKnownResolve(null);
      return null;
    }
  }
  // Something to do once the shopper has signed in, such as writing the review they asked to write.
  let afterSignIn = null;

  async function onAuth(event, session) {
    const next = session ? session.user : null, prev = user;
    user = next;
    if (event === "PASSWORD_RECOVERY") { acctView = "newpass"; acctMsg = ""; openAccount(); }
    syncAccountButton();
    if (next && (!prev || prev.id !== next.id)) {
      orders = null;
      isAdmin = false;
      sb.rpc("is_admin").then(({ data }) => {
        isAdmin = data === true;
        if (isAdmin && acctDlg.open && user && acctView !== "newpass" && !$("#acct-admin")) renderAccount();
      });
      // Signing in on this device brings the guest bag along; a returning visit loads the account's.
      await pullState(event === "SIGNED_IN" ? "merge" : "load");
      if (event === "SIGNED_IN" && prev === null) announce(`Signed in as ${next.email}.`);
    } else if (!next && prev) {
      clearShopperState();
    }
    // Redraw only when who's signed in changes, so messages like "password saved" stay put.
    const changed = (prev && prev.id) !== (next && next.id);
    if (acctDlg.open && (changed || event === "PASSWORD_RECOVERY")) {
      renderAccount();
      if (user && acctView !== "newpass") $("#acct-hello").focus();
    }
    authKnownResolve(user);
    if (changed) {
      document.dispatchEvent(new CustomEvent("pluge:auth", { detail: { user } }));
      if (user && afterSignIn) {
        const todo = afterSignIn;
        afterSignIn = null;
        if (acctDlg.open) acctDlg.close();
        todo();
      }
    }
  }

  function markDirty() {
    if (!user || applying) return;
    writeSync({ user: user.id, dirty: true });
    clearTimeout(pushTimer);
    pushTimer = setTimeout(pushState, 700);
  }
  async function pushState() {
    clearTimeout(pushTimer);
    if (!user || !sb) return;
    const { error } = await sb.from("shopper_state").upsert({ user_id: user.id, bag, saved, recent, sizes: mySizes, updated_at: new Date().toISOString() });
    if (error) console.warn(`PLUGE: couldn't save to your account: ${error.message}`);
    else writeSync({ user: user.id, dirty: false });
  }
  async function pullState(mode) {
    const { data, error } = await sb.from("shopper_state").select("bag,saved,recent,sizes").eq("user_id", user.id).maybeSingle();
    if (error) { console.warn(`PLUGE: couldn't load your account: ${error.message}`); return; }
    const info = readSync();
    // Changes made on this device that never reached the account win over the copy in the account.
    if (mode === "load" && info.user === user.id && info.dirty) { await pushState(); return; }
    const remote = { bag: cleanBag(data && data.bag), saved: cleanPicks(data && data.saved), recent: cleanPicks(data && data.recent) };
    const remoteSizes = cleanSizes(data && data.sizes);
    if (mode === "merge") {
      bag = mergeBags(remote.bag, bag);
      saved = mergePicks(saved, remote.saved).slice(0, 60);
      recent = mergePicks(recent, remote.recent).slice(0, 8);
      mySizes = { ...remoteSizes, ...mySizes };
    } else {
      bag = remote.bag;
      saved = remote.saved.slice(0, 60);
      recent = remote.recent.slice(0, 8);
      mySizes = remoteSizes;
    }
    applyShopperState();
    if (mode === "merge" || !data) await pushState(); else writeSync({ user: user.id, dirty: false });
  }
  function applyShopperState() {
    applying = true;
    saveBag();
    writeList(SAVED_KEY, saved);
    writeList(RECENT_KEY, recent);
    try { localStorage.setItem(SIZES_KEY, JSON.stringify(mySizes)); } catch { /* kept for this visit */ }
    applying = false;
    fresh.clear();
    renderBag();
    syncSavedButtons();
    renderRecent();
    if (savedDlg.open) renderSaved();
  }
  // Signing out leaves nothing of the account on a shared device.
  function clearShopperState() {
    bag = []; saved = []; recent = []; mySizes = {};
    isAdmin = false;
    applyShopperState();
    writeSync({});
  }

  function syncAccountButton() {
    $("#menu-account-txt").textContent = user ? "Your account" : "Sign in or create an account";
    $("#account-dot").hidden = !user;
    $("#account-open").setAttribute("aria-label", user ? `Account, signed in as ${user.email}` : "Account, sign in");
  }

  const AUTH_VIEWS = {
    signin: { title: "Sign in", submit: "Sign in", fields: [["email", "Email", "email", "email"], ["password", "Password", "password", "current-password"]] },
    create: { title: "Create an account", submit: "Create account", fields: [["name", "First name", "text", "given-name"], ["email", "Email", "email", "email"], ["password", "Password, 8 or more characters", "password", "new-password"]] },
    reset: { title: "Reset your password", submit: "Email me a reset link", fields: [["email", "Email", "email", "email"]] },
    newpass: { title: "Choose a new password", submit: "Save password", fields: [["password", "New password, 8 or more characters", "password", "new-password"]] },
  };
  const PERKS = `<ul class="acct-perks"><li>Your bag and saved pieces on every device</li><li>Your orders and tracking in one place</li><li>Your email filled in at checkout</li></ul>`;

  function authFormHtml() {
    const v = AUTH_VIEWS[acctView] ? acctView : "signin", cfg = AUTH_VIEWS[v];
    const tabs = v === "signin" || v === "create" ? `<div class="acct-tabs" role="group" aria-label="Sign in or create an account">
        <button type="button" data-view="signin" aria-pressed="${v === "signin"}">Sign in</button><button type="button" data-view="create" aria-pressed="${v === "create"}">Create account</button></div>` : "";
    const fields = cfg.fields.map(([n, label, type, ac]) =>
      `<label class="field" for="acct-${n}"><span>${label}</span><input id="acct-${n}" name="${n}" type="${type}" autocomplete="${ac}"${type === "email" ? ' inputmode="email" autocapitalize="off" spellcheck="false"' : ""} required></label>`).join("");
    const after = v === "signin" ? `<button class="link-btn" type="button" data-view="reset">Forgot your password?</button>`
      : v === "reset" ? `<button class="link-btn" type="button" data-view="signin">Back to sign in</button>` : "";
    return `${acctCfg ? "" : `<p class="acct-preview">Preview: accounts switch on once the shop's customer database is connected.</p>`}
      ${tabs}
      <form class="acct-form" id="acct-form" data-view="${v}" novalidate>
        <h3 class="acct-h">${cfg.title}</h3>
        ${fields}
        <p class="acct-msg" id="acct-msg" role="status">${esc(acctMsg)}</p>
        <button class="btn primary block" type="submit"${acctBusy ? " disabled" : ""}>${cfg.submit}</button>
        ${after}
      </form>
      ${v === "signin" || v === "create" ? PERKS : ""}`;
  }

  const ORDER_STATUS = o => o.cancelled_at ? "Cancelled" : o.financial_status === "refunded" ? "Refunded"
    : o.fulfillment_status === "fulfilled" ? "Sent" : o.fulfillment_status === "partial" ? "Partly sent" : "Being made";
  function ordersHtml() {
    if (orders === null || orders === "loading") return `<p>Loading your orders…</p>`;
    if (orders === "error") return `<p>Your orders couldn't load just now. Try again later.</p>`;
    if (!orders.length) return `<p>No orders yet. Orders you place with ${esc(user.email)} will show up here.</p>`;
    return `<ul class="acct-orders">${orders.map(o => {
      const when = new Date(o.created_at);
      const items = (Array.isArray(o.items) ? o.items : []).map(i => `${esc(i.title)}${i.variant ? ` (${esc(i.variant)})` : ""}${i.qty > 1 ? ` × ${i.qty}` : ""}`).join(", ");
      const track = /^https:\/\//.test(o.status_url || "") ? `<a href="${esc(o.status_url)}" target="_blank" rel="noopener">Track order<span class="vh"> ${esc(o.order_number)} (opens in a new tab)</span></a>` : "";
      return `<li><div class="ord-top"><b>Order ${esc(o.order_number)}</b><span>${isNaN(when) ? "" : dayName(when, true) + " " + when.getFullYear()}</span></div>
        ${items ? `<p class="ord-items">${items}</p>` : ""}
        <div class="ord-bottom"><span class="ord-status">${ORDER_STATUS(o)}</span><span>${o.total != null ? gbp2.format(Number(o.total)) : ""}</span>${track}</div></li>`;
    }).join("")}</ul>`;
  }
  async function loadOrders() {
    if (!sb || !user || orders === "loading") return;
    orders = "loading";
    const { data, error } = await sb.from("orders").select("order_number,created_at,total,currency,financial_status,fulfillment_status,cancelled_at,status_url,items")
      .order("created_at", { ascending: false }).limit(20);
    orders = error ? "error" : data || [];
    if (error) console.warn(`PLUGE: couldn't load orders: ${error.message}`);
    const box = $("#acct-orders");
    if (box) box.innerHTML = ordersHtml();
  }

  function signedInHtml() {
    const name = (user.user_metadata && user.user_metadata.name) || "";
    const count = bag.reduce((n, l) => n + l.qty, 0);
    return `<div class="acct-hello" id="acct-hello" tabindex="-1"><p class="eyebrow">Signed in</p><p class="acct-name">${name ? `Hi ${esc(name)}` : "Hi"}</p><p class="acct-email">${esc(user.email)}</p></div>
      ${acctMsg ? `<p class="acct-msg" role="status">${esc(acctMsg)}</p>` : ""}
      <section class="acct-sec" aria-labelledby="acct-orders-h"><h3 class="acct-h" id="acct-orders-h">Your orders</h3><div id="acct-orders">${ordersHtml()}</div></section>
      <section class="acct-sec" aria-labelledby="acct-kept-h"><h3 class="acct-h" id="acct-kept-h">Bag and saved</h3>
        <p>${count} ${count === 1 ? "piece" : "pieces"} in your bag and ${saved.length} saved, kept in your account so they're here on any device you sign in on.</p>
        <div class="acct-row"><button class="btn small" type="button" data-act="bag">Open bag</button><button class="btn small" type="button" data-act="saved">Open saved</button></div></section>
      <section class="acct-sec" aria-labelledby="acct-sizes-h"><h3 class="acct-h" id="acct-sizes-h">Your sizes</h3>
        <p>We pick these for you on product pages.</p>
        <div class="acct-sizes">${SIZE_GROUPS.map(([g, label]) => `<label class="field" for="acct-size-${g}"><span>${label}</span><select id="acct-size-${g}" data-group="${g}">
          <option value="">Not set</option>${groupSizes(g).map(z => `<option${mySizes[g] === z ? " selected" : ""}>${esc(z)}</option>`).join("")}</select></label>`).join("")}</div>
      </section>
      ${isAdmin ? `<section class="acct-sec" id="acct-admin" aria-labelledby="acct-admin-h"><h3 class="acct-h" id="acct-admin-h">Shop admin</h3>
        <p>Orders, messages, sign-ups and reviews waiting for you.</p><div class="acct-row"><a class="btn small" href="${ROOT}admin/">Open the admin page</a></div></section>` : ""}
      <section class="acct-sec" aria-labelledby="acct-pass-h"><h3 class="acct-h" id="acct-pass-h">Change password</h3>
        <form class="acct-form" id="acct-pass" novalidate><label class="field" for="acct-newpass"><span>New password, 8 or more characters</span><input id="acct-newpass" name="password" type="password" autocomplete="new-password" required></label>
        <p class="acct-msg" id="acct-pass-msg" role="status"></p><button class="btn small" type="submit">Save password</button></form></section>
      <div class="acct-row"><button class="btn block" type="button" data-act="signout">Sign out</button></div>
      <section class="acct-sec" aria-labelledby="acct-del-h"><h3 class="acct-h" id="acct-del-h">Delete account</h3>
        <p>This deletes your account and the bag and saved pieces kept in it. We keep order records for six years, as tax law requires.</p>
        ${confirmDelete ? `<div class="acct-row"><button class="btn small danger" type="button" data-act="delete-yes">Yes, delete my account</button><button class="btn small" type="button" data-act="delete-no">Keep my account</button></div>`
          : `<div class="acct-row"><button class="btn small danger" type="button" data-act="delete">Delete my account</button></div>`}</section>`;
  }

  function renderAccount() {
    const body = $("#acct-body");
    if (user && acctView !== "newpass") {
      body.innerHTML = signedInHtml();
      if (orders === null) loadOrders();
    } else body.innerHTML = authFormHtml();
  }
  function openAccount() {
    confirmDelete = false;
    renderAccount();
    if (!acctDlg.open) acctDlg.showModal();
    const first = user && acctView !== "newpass" ? $("#acct-hello") : $("#acct-form input");
    if (first) first.focus();
  }

  function friendlyAuthError(err) {
    const m = String((err && err.message) || err);
    if (/invalid login credentials/i.test(m)) return "That email and password don't match. Try again, or reset your password.";
    if (/email not confirmed/i.test(m)) return "Confirm your email first: open the link we sent you, then sign in.";
    if (/already (been )?registered|already exists/i.test(m)) return "There's already an account with that email. Sign in, or reset your password.";
    if (/rate limit|too many/i.test(m)) return "Too many tries. Wait a minute, then try again.";
    if (/password/i.test(m) && /(weak|short|least|characters)/i.test(m)) return "Choose a longer password: 8 or more characters.";
    return `That didn't work: ${m.replace(/\.$/, "")}. Try again.`;
  }
  async function handleAuth(form) {
    const v = form.dataset.view, f = new FormData(form);
    const email = String(f.get("email") || "").trim(), password = String(f.get("password") || ""), name = String(f.get("name") || "").trim();
    const say = (text, field) => { acctMsg = text; $("#acct-msg").textContent = text; if (field) form.querySelector(`[name="${field}"]`).focus(); };
    if (v === "create" && !name) return say("Enter your first name.", "name");
    if (v !== "newpass" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return say("Enter your email address, like name@example.com.", "email");
    if (v === "signin" && !password) return say("Enter your password.", "password");
    if ((v === "create" || v === "newpass") && password.length < 8) return say("Use 8 or more characters for your password.", "password");
    if (!sb) return say(acctCfg ? "Accounts aren't available right now. Try again in a moment." : "This is a preview: accounts aren't switched on yet, so nothing was saved.");
    const btn = form.querySelector('[type="submit"]');
    acctBusy = true;
    btn.disabled = true;
    try {
      if (v === "signin") {
        const { error } = await sb.auth.signInWithPassword({ email, password });
        if (error) throw error;
        acctMsg = "";
      } else if (v === "create") {
        const { data, error } = await sb.auth.signUp({ email, password, options: { data: { name }, emailRedirectTo: ROOT } });
        if (error) throw error;
        if (!data.session) {
          acctView = "signin";
          acctMsg = `Nearly there: we've emailed a link to ${email}. Open it to confirm your address, then sign in.`;
          renderAccount();
          $("#acct-email").value = email;
        }
      } else if (v === "reset") {
        const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: ROOT });
        if (error) throw error;
        say("If there's an account for that email, we've sent it a link to choose a new password.");
      } else if (v === "newpass") {
        const { error } = await sb.auth.updateUser({ password });
        if (error) throw error;
        acctView = "signin";
        acctMsg = "Your new password is saved.";
        renderAccount();
        if (user) $("#acct-hello").focus();
      }
    } catch (err) {
      if ($("#acct-msg")) say(friendlyAuthError(err));
    } finally {
      // The form may have been redrawn meanwhile, so free whichever submit button is showing now.
      acctBusy = false;
      document.querySelectorAll('#acct-body [type="submit"]').forEach(b => { b.disabled = false; });
    }
  }

  $("#acct-body").addEventListener("submit", async e => {
    e.preventDefault();
    if (e.target.id === "acct-form") return handleAuth(e.target);
    if (e.target.id === "acct-pass") {
      const input = $("#acct-newpass"), msg = $("#acct-pass-msg");
      if (input.value.length < 8) { msg.textContent = "Use 8 or more characters for your password."; input.focus(); return; }
      const { error } = await sb.auth.updateUser({ password: input.value });
      msg.textContent = error ? friendlyAuthError(error) : "Your new password is saved.";
      if (!error) input.value = "";
    }
  });
  $("#acct-body").addEventListener("click", async e => {
    const viewBtn = e.target.closest("button[data-view]");
    if (viewBtn) {
      acctView = viewBtn.dataset.view;
      acctMsg = "";
      renderAccount();
      const first = $("#acct-form input");
      if (first) first.focus();
      return;
    }
    const b = e.target.closest("[data-act]");
    if (!b) return;
    const act = b.dataset.act;
    if (act === "bag") { acctDlg.close(); openBag(); }
    if (act === "saved") { acctDlg.close(); renderSaved(); savedDlg.showModal(); }
    if (act === "signout") {
      if (readSync().dirty) await pushState();
      acctView = "signin";
      acctMsg = "You're signed out. Your bag and saved pieces are kept in your account.";
      await sb.auth.signOut();
    }
    if (act === "delete" || act === "delete-no") {
      confirmDelete = act === "delete";
      renderAccount();
      $(`#acct-body [data-act="${confirmDelete ? "delete-no" : "delete"}"]`).focus();
    }
    if (act === "delete-yes") {
      const { error } = await sb.rpc("delete_my_account");
      if (error) { acctMsg = `Your account couldn't be deleted: ${error.message}. Email us and we'll do it.`; renderAccount(); return; }
      confirmDelete = false;
      acctView = "signin";
      acctMsg = "Your account has been deleted.";
      await sb.auth.signOut({ scope: "local" });
    }
  });
  $("#acct-body").addEventListener("change", e => {
    const g = e.target.dataset.group;
    if (!g) return;
    if (e.target.value) mySizes[g] = e.target.value; else delete mySizes[g];
    saveSizes();
    announce(e.target.value ? `Saved ${e.target.value} as your size.` : "Size cleared.");
  });
  $("#account-open").addEventListener("click", openAccount);
  $("#account-close").addEventListener("click", () => acctDlg.close());
  acctDlg.addEventListener("close", () => { acctMsg = ""; confirmDelete = false; });

  // ---- Search ----------------------------------------------------------------
  const searchDlg = $("#search"), searchIn = $("#search-in"), searchList = $("#search-list");
  // Sections of the home page (#...) and other pages (.../).
  const SECTIONS = [
    { label: "Lookbook", href: "#lookbook", words: "lookbook looks photos model fit check" },
    { label: "The fit", href: "#fit", words: "fit outfit full broadcast flat lay" },
    { label: "Drop 02 countdown", href: "#drop-02", words: "drop 02 next countdown interference alert notify" },
    { label: "Delivery and returns", href: "returns/", words: "delivery shipping postage returns refund exchange cancel" },
    { label: "FAQ", href: "faq/", words: "faq help questions sizing size guide tracking order payment care wash" },
    { label: "Contact us", href: "contact/", words: "contact email message help support order problem" },
    { label: "Our story", href: "about/", words: "about brand story pluge made to order" },
  ];
  const searchIndex = PRODUCTS.map(p => ({
    p,
    name: norm(p.name),
    text: norm([p.name, CATS.find(c => c.id === p.cat).label, p.tags || "", p.blurb, p.fabric, p.deco, p.sizes.join(" ")].join(" ")),
  }));
  const startsWord = (text, t) => new RegExp(`(^|[^a-z0-9])${reEsc(t)}`).test(text);
  function runSearch(q) {
    const terms = norm(q).split(/[\s,]+/).filter(Boolean);
    if (!terms.length) return [...PRODUCTS.map(p => ({ kind: "p", p, colour: firstIn(p) })), ...SECTIONS.map(x => ({ kind: "s", ...x }))];
    const hits = [];
    for (const it of searchIndex) {
      let score = 0, colour = null;
      const ok = terms.every(t => {
        const c = it.p.colours.find(k => startsWord(norm(COLOURS[k].name), t));
        if (c) { colour = colour || c; score += 3; return true; }
        if (startsWord(it.name, t)) { score += 5; return true; }
        if (startsWord(it.text, t)) { score += 2; return true; }
        if (t.length > 2 && it.text.includes(t)) { score += 1; return true; }
        return false;
      });
      if (ok) hits.push({ kind: "p", p: it.p, colour: colour || firstIn(it.p), score });
    }
    hits.sort((a, b) => b.score - a.score);
    const secs = SECTIONS.filter(x => terms.every(t => startsWord(norm(`${x.label} ${x.words}`), t))).map(x => ({ kind: "s", ...x }));
    return [...hits, ...secs];
  }
  function marked(text, q) {
    const terms = norm(q).split(/\s+/).filter(Boolean);
    if (!terms.length) return esc(text);
    const re = new RegExp(`(^|\\s)(${terms.map(reEsc).join("|")})`, "gi");
    return esc(text).replace(re, "$1<mark>$2</mark>");
  }
  let results = [], active = -1;
  function renderSearch() {
    const q = searchIn.value.trim();
    results = runSearch(q);
    searchList.innerHTML = results.map((r, i) => r.kind === "p"
      ? `<li class="opt" role="option" id="opt-${i}" data-i="${i}" aria-selected="false">
          <span class="opt-img">${art(r.p, r.colour, "front", { sizes: "56px" })}</span>
          <span class="opt-main"><span class="opt-name">${marked(r.p.name, q)}</span>
          <span class="opt-meta">${esc(COLOURS[r.colour].name)}${r.p.colours.length > 1 ? ` + ${r.p.colours.length - 1} more` : ""} · ${esc(CATS.find(c => c.id === r.p.cat).label)}</span></span>
          <span class="opt-price">${price(r.p.price)}</span></li>`
      : `<li class="opt opt-section" role="option" id="opt-${i}" data-i="${i}" aria-selected="false">
          <span class="opt-img" aria-hidden="true">→</span>
          <span class="opt-main"><span class="opt-name">${esc(r.label)}</span><span class="opt-meta">${r.href[0] === "#" ? "Go to section" : "Go to page"}</span></span></li>`).join("");
    const empty = $("#search-empty");
    empty.hidden = results.length > 0;
    if (!results.length) empty.textContent = `Nothing matches "${q}". Try "hoodie", "olive" or "XL".`;
    $("#search-status").textContent = q ? (results.length ? `${results.length} ${results.length === 1 ? "result" : "results"}` : "No results") : "";
    setActive(results.length ? 0 : -1, false);
  }
  function setActive(i, scroll = true) {
    const prev = searchList.querySelector('[aria-selected="true"]');
    if (prev) prev.setAttribute("aria-selected", "false");
    active = i;
    const el = i >= 0 ? $(`#opt-${i}`) : null;
    if (!el) { searchIn.removeAttribute("aria-activedescendant"); return; }
    el.setAttribute("aria-selected", "true");
    searchIn.setAttribute("aria-activedescendant", el.id);
    if (scroll) el.scrollIntoView({ block: "nearest" });
  }
  function choose(r) {
    searchDlg.close();
    if (r.kind === "p") { if (!ROUTING && pd) openProduct(r.p.id, r.colour); else location.href = pageUrl(r.p.id, r.colour); return; }
    const target = r.href[0] === "#" && $(r.href);
    if (!target) { location.href = ROOT + r.href; return; }
    target.scrollIntoView({ behavior: still ? "auto" : "smooth", block: "start" });
    const h = target.querySelector("h2, h3");
    if (h) { h.setAttribute("tabindex", "-1"); h.focus({ preventScroll: true }); }
  }
  function openSearch() {
    searchIn.value = "";
    renderSearch();
    if (!searchDlg.open) searchDlg.showModal();
    searchIn.focus();
  }
  searchIn.addEventListener("input", renderSearch);
  searchIn.addEventListener("keydown", e => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (results.length) setActive((active + (e.key === "ArrowDown" ? 1 : -1) + results.length) % results.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (active >= 0) choose(results[active]);
    }
  });
  searchList.addEventListener("click", e => { const o = e.target.closest("[data-i]"); if (o) choose(results[+o.dataset.i]); });
  searchList.addEventListener("pointermove", e => { const o = e.target.closest("[data-i]"); if (o && +o.dataset.i !== active) setActive(+o.dataset.i, false); });
  $("#search-open").addEventListener("click", openSearch);
  $("#search-close").addEventListener("click", () => searchDlg.close());
  // "/" or Ctrl+K (Cmd+K on a Mac) opens search from anywhere.
  document.addEventListener("keydown", e => {
    const typing = e.target.closest && e.target.closest("input, textarea, select, [contenteditable]");
    if ((e.key === "k" || e.key === "K") && (e.ctrlKey || e.metaKey) && !e.altKey) { e.preventDefault(); openSearch(); return; }
    if (e.key === "/" && !typing && !e.ctrlKey && !e.metaKey && !e.altKey && !document.querySelector("dialog[open]")) { e.preventDefault(); openSearch(); }
  });

  // In an embedded preview or a copy opened from disk, the product pages' folders can't load, so on the
  // home page a link to a product opens its quick view instead.
  if (!ROUTING && pd) document.addEventListener("click", e => {
    const a = e.target.closest && e.target.closest("a[href]");
    const m = a && a.href.startsWith(`${ROOT}p/`) && a.href.slice(ROOT.length).match(/^p\/([a-z0-9-]+)\/(?:\?colour=([a-z]+))?$/);
    if (!m || !byId[m[1]] || e.metaKey || e.ctrlKey || e.shiftKey) return;
    e.preventDefault();
    [searchDlg, savedDlg, kit, menuDlg, bagDlg].forEach(d => { if (d.open) d.close(); });
    openProduct(m[1], m[2]);
  });

  // ---- Menu (phones and small tablets) ------------------------------------------
  const menuDlg = $("#menu");
  function syncMenu() {
    $("#menu-saved-txt").textContent = saved.length ? `Saved (${saved.length})` : "Saved";
  }
  $("#menu-open").addEventListener("click", () => { syncMenu(); if (!menuDlg.open) menuDlg.showModal(); });
  $("#menu-close").addEventListener("click", () => menuDlg.close());
  $("#menu-account").addEventListener("click", () => { menuDlg.close(); openAccount(); });
  $("#menu-saved").addEventListener("click", () => { menuDlg.close(); renderSaved(); if (!savedDlg.open) savedDlg.showModal(); });
  // A link to a section of the page the menu is open on just closes the menu and scrolls there.
  menuDlg.addEventListener("click", e => {
    const a = e.target.closest("a[href]");
    if (a && a.hash && a.pathname === location.pathname && !a.dataset.cat) menuDlg.close();
  });
  // The menu is only for narrow screens; it closes if the window is widened past them.
  window.matchMedia("(min-width: 901px)").addEventListener("change", e => { if (e.matches && menuDlg.open) menuDlg.close(); });

  [pd, bagDlg, kit, savedDlg, searchDlg, acctDlg, menuDlg, lb].filter(Boolean).forEach(d => d.addEventListener("click", e => { if (e.target === d) d.close(); }));

  // ---- Product links: the sheet's address is p/<id>/, so it can be shared and Back closes it ----
  function syncUrl(push) {
    document.title = `${sel.p.name} · ${BRAND}`;
    if (!ROUTING) return;
    const state = { pd: sel.p.id, colour: sel.colour };
    try {
      if (push && !(history.state && history.state.pd)) history.pushState(state, "", pageUrl(sel.p.id, sel.colour));
      else history.replaceState(state, "", pageUrl(sel.p.id, sel.colour));
    } catch { /* the address just doesn't change */ }
  }
  if (pd) {
    pd.addEventListener("close", () => {
      document.title = HOME_TITLE;
      renderRecent();
      if (ROUTING && history.state && history.state.pd) history.back();
    });
    window.addEventListener("popstate", e => {
      const st = e.state;
      if (st && st.pd && byId[st.pd]) openProduct(st.pd, st.colour, { push: false });
      else if (pd.open) pd.close();
    });
  }

  const toast = $("#toast");
  let toastT;
  function showToast(text, { bagLink = true } = {}) {
    $("#toast-msg").textContent = text;
    $("#toast-view").hidden = !bagLink;
    toast.hidden = false;
    toast.classList.remove("show");
    void toast.offsetWidth;
    toast.classList.add("show");
    clearTimeout(toastT);
    toastT = setTimeout(hideToast, 5000);
  }
  function hideToast() { clearTimeout(toastT); toast.hidden = true; }
  $("#toast-view").addEventListener("click", openBag);

  // ---- Drop 02: countdown, local time, teletext guide, sign-up --------------
  const dropSec = $("#drop-02");
  if (dropSec) {
    $("#ttx-list").innerHTML = DROP_02_PIECES.map(([c, n, pr]) =>
      `<li><span class="c">${c}</span><span class="n">${esc(n)}</span><span class="p">${price(pr)}</span></li>`).join("");
    try {
      const local = new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZoneName: "short" }).format(DROP_02);
      $("#drop-local").textContent = `Your time: ${local}`;
    } catch { /* leave the GMT time on its own */ }
  }
  const clockFmt = new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", second: "2-digit" });

  function setDigit(id, v) {
    const el = $(`#${id}`);
    if (el.textContent === v) return;
    el.textContent = v;
    if (!still) { el.classList.remove("tick"); void el.offsetWidth; el.classList.add("tick"); }
  }
  function tickClock() {
    $("#ttx-clock").textContent = clockFmt.format(new Date()).replace(/,/g, "");
    const ms = DROP_02.getTime() - Date.now();
    if (ms <= 0) {
      ["cd-d", "cd-h", "cd-m", "cd-s"].forEach(id => setDigit(id, "00"));
      return;
    }
    setDigit("cd-d", pad(Math.floor(ms / 864e5)));
    setDigit("cd-h", pad(Math.floor(ms / 36e5) % 24));
    setDigit("cd-m", pad(Math.floor(ms / 6e4) % 60));
    setDigit("cd-s", pad(Math.floor(ms / 1e3) % 60));
  }
  if (dropSec) {
    tickClock();
    setInterval(tickClock, 1000);
  }

  // Drop alert sign-ups (the Drop 02 form and the footer form on every page), saved to the database
  // with the wording the shopper agreed to.
  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  document.querySelectorAll(".alert-form").forEach(form => form.addEventListener("submit", async e => {
    e.preventDefault();
    const input = form.querySelector('input[type="email"]'), consent = form.querySelector('input[type="checkbox"]');
    const msg = form.querySelector(".notify-msg"), btn = form.querySelector('[type="submit"]');
    const email = input.value.trim();
    if (!EMAIL_RE.test(email)) { msg.textContent = "Enter an email address, like name@example.com."; input.focus(); return; }
    if (!consent.checked) { msg.textContent = "Tick the box to agree to drop alert emails."; consent.focus(); return; }
    const db = await dbReady;
    if (!db) { msg.textContent = "Preview only: sign-ups aren't saved yet."; return; }
    btn.disabled = true;
    msg.textContent = "Signing you up…";
    const { error } = await db.from("drop_alerts").insert({ email, list: form.dataset.list, consent: consent.closest("label").textContent.replace(/\s+/g, " ").trim() });
    btn.disabled = false;
    if (error && error.code !== "23505") { msg.textContent = `That didn't work: ${String(error.message).replace(/\.$/, "")}. Try again.`; return; }
    msg.textContent = error ? "You're already on the list. We'll email you when the next drop lands." : "You're on the list. We'll email you when the next drop lands.";
    input.value = "";
    consent.checked = false;
  }));
  document.querySelectorAll('a[href="#notify"]').forEach(a => a.addEventListener("click", () => {
    setTimeout(() => $("#notify-email").focus({ preventScroll: true }), still ? 0 : 450);
  }));

  // ---- Motion toggle -------------------------------------------------------
  const motionBtns = [$("#motion-toggle"), $("#menu-motion")];
  function syncMotionBtn() {
    const text = still ? "Play motion" : "Pause motion";
    motionBtns.forEach(b => { b.querySelector(".motion-txt").textContent = text; b.setAttribute("aria-label", text); });
  }
  motionBtns.forEach(b => b.addEventListener("click", () => {
    still = !still;
    root.dataset.motion = still ? "off" : "on";
    try { localStorage.setItem(MOTION_KEY, still ? "off" : "on"); } catch { /* remembered for this visit only */ }
    syncMotionBtn();
    setRotating(!still && !narrowScreen);
    if (still) document.querySelectorAll(".tilt").forEach(t => { t.style.setProperty("--rx", "0deg"); t.style.setProperty("--ry", "0deg"); });
    fitDirty = true;
    announce(still ? "Motion paused." : "Motion on.");
  }));
  syncMotionBtn();

  // ---- Header hides on the way down, returns on the way up -----------------
  const head = $("#site-head");
  let lastY = window.scrollY;
  window.addEventListener("scroll", () => {
    const y = window.scrollY, dy = y - lastY;
    lastY = y;
    fitDirty = true;
    if (head.contains(document.activeElement)) { head.classList.remove("hide"); return; }
    if (y > 420 && dy > 6) head.classList.add("hide");
    else if (dy < -6 || y < 200) head.classList.remove("hide");
  }, { passive: true });
  head.addEventListener("focusin", () => head.classList.remove("hide"));

  // ---- Visibility tracking -------------------------------------------------
  if (tv && "IntersectionObserver" in window) {
    new IntersectionObserver(([en]) => { tvVisible = en.isIntersecting; }).observe(tv);
  }

  // ---- One animation loop (home page): timecode, channel timer, fit ----------
  const tcEl = $("#timecode");
  const t0 = performance.now();
  let last = t0, lastTcSec = -1;
  function frame(now) {
    const dt = Math.min(64, now - last);
    last = now;

    if (tv && tvVisible) {
      const t = (now - t0) / 1000;
      if (!still || Math.floor(t) !== lastTcSec) {
        lastTcSec = Math.floor(t);
        const ff = still ? 0 : Math.floor((t % 1) * 25);
        tcEl.textContent = `TC ${pad(Math.floor(t / 3600))}:${pad(Math.floor(t / 60) % 60)}:${pad(Math.floor(t) % 60)}:${pad(ff)}`;
      }
    }
    if (tv) {
      const paused = !rotating || tvHover || tvFocus || !tvVisible || document.hidden || (pd && pd.open) || bagDlg.open;
      if (!paused && !chBusy) {
        chElapsed += dt;
        if (chElapsed >= CHANNEL_DWELL) tune(chIndex + 1);
      }
      pips[chIndex].style.setProperty("--p", rotating ? Math.min(1, chElapsed / CHANNEL_DWELL).toFixed(3) : 0);
    }

    if (fitDirty) { fitDirty = false; updateFit(); }
    requestAnimationFrame(frame);
  }

  // ---- Contact page ------------------------------------------------------------
  // With CONTACT.formEndpoint set (a Formspree form), messages are posted there and arrive by email.
  // Otherwise, with the database connected, they're saved for the admin page. Without either, the
  // shopper's email app opens with the message filled in.
  const contactForm = $("#contact-form");
  // The "opens your email app" note only applies when messages can't be sent straight to the shop.
  // (Checked once start-up has finished, when the database connection has been started.)
  if (contactForm && $("#contact-app-note")) Promise.resolve().then(() => dbReady).then(db => { if (db || (CONTACT && CONTACT.formEndpoint)) $("#contact-app-note").hidden = true; });
  if (contactForm) {
    const f = contactForm.elements, msg = $("#contact-msg"), sendBtn = $("#contact-send");
    const CHECKS = [
      ["name", el => el.value.trim(), "Enter your name."],
      ["email", el => el.value.trim() && el.checkValidity(), "Enter your email address, like name@example.com."],
      ["message", el => el.value.trim().length > 1, "Write your message."],
    ];
    contactForm.addEventListener("input", e => { if (e.target.getAttribute("aria-invalid") === "true") e.target.removeAttribute("aria-invalid"); });
    contactForm.addEventListener("submit", async e => {
      e.preventDefault();
      msg.classList.remove("err");
      const bad = CHECKS.filter(([name, ok]) => !ok(f[name]));
      CHECKS.forEach(([name]) => f[name].removeAttribute("aria-invalid"));
      bad.forEach(([name]) => f[name].setAttribute("aria-invalid", "true"));
      if (bad.length) {
        msg.textContent = bad[0][2];
        msg.classList.add("err");
        f[bad[0][0]].focus();
        return;
      }
      if (f._gotcha.value) return; // filled in by a spam bot, not a person
      const data = {
        name: f.name.value.trim(), email: f.email.value.trim(), topic: f.topic.value,
        order: f.order.value.trim(), message: f.message.value.trim(),
      };
      const endpoint = CONTACT && CONTACT.formEndpoint;
      const db = endpoint ? null : await dbReady;
      if (!endpoint && !db) {
        const subject = `${data.topic}${data.order ? `, order ${data.order}` : ""}`;
        const body = `${data.message}\n\n${data.name}\n${data.email}${data.order ? `\nOrder: ${data.order}` : ""}`;
        location.href = `mailto:${COMPANY.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
        msg.textContent = `Your email app should open with your message ready to send. If it doesn't, email us at ${COMPANY.email}.`;
        return;
      }
      sendBtn.disabled = true;
      sendBtn.textContent = "Sending…";
      msg.textContent = "";
      try {
        if (endpoint) {
          const res = await fetch(endpoint, {
            method: "POST",
            headers: { "Content-Type": "application/json", Accept: "application/json" },
            body: JSON.stringify({ ...data, _subject: `${BRAND} contact form: ${data.topic}`, _replyto: data.email }),
          });
          if (!res.ok) throw new Error(`the form service replied ${res.status}`);
        } else {
          const { error } = await db.from("contact_messages").insert({ name: data.name, email: data.email, topic: data.topic, order_ref: data.order || null, message: data.message });
          if (error) throw new Error(/Too many/.test(error.message) ? "you've sent a lot of messages in the last hour, so please email us instead" : error.message);
        }
        contactForm.hidden = true;
        $("#contact-done-email").textContent = data.email;
        $("#contact-done").hidden = false;
        $("#contact-done").focus();
      } catch (err) {
        msg.textContent = `Your message didn't send: ${String(err.message || err).replace(/\.$/, "")}. Try again, or email us at ${COMPANY.email}.`;
        msg.classList.add("err");
      } finally {
        sendBtn.disabled = false;
        sendBtn.textContent = "Send message";
      }
    });
  }

  // ---- Shared lists ------------------------------------------------------------------
  // A link made with "Share your list" (?list=id.colour,...) opens those pieces, ready to size and add.
  {
    const raw = new URLSearchParams(location.search).get("list");
    const picks = raw ? raw.split(",").map(x => { const [id, colour] = x.split("."); return { id, colour }; }).filter(validPick).slice(0, 30) : [];
    if (picks.length) {
      openKit({
        title: "Shared with you",
        items: picks.map(x => [x.id, x.colour]),
        intro: `<p class="kit-shared">Someone shared ${picks.length} ${picks.length === 1 ? "piece" : "pieces"} from ${esc(BRAND)} with you. Pick sizes to add them to your bag, or keep them for later.</p><button class="btn small" type="button" data-act="save-all">Save all to my list</button>`,
      });
      if (ROUTING) { try { const u = new URL(location.href); u.searchParams.delete("list"); history.replaceState(history.state, "", u.href); } catch { /* the list stays in the address */ } }
    }
  }
  $("#kit-intro").addEventListener("click", e => {
    const b = e.target.closest('[data-act="save-all"]');
    if (!b) return;
    kitItems.forEach(it => { if (!isSaved(it.p.id)) toggleSaved(it.p.id, it.colour); });
    b.textContent = "Saved to your list";
    b.disabled = true;
    announce("All saved.");
  });

  // ---- Photos fade in once loaded (with a shimmer while they load) ---------------------
  const markLoaded = img => img.classList.add("ld");
  document.addEventListener("load", e => { if (e.target.tagName === "IMG") markLoaded(e.target); }, true);
  document.addEventListener("error", e => { if (e.target.tagName === "IMG") markLoaded(e.target); }, true);
  const markDone = () => document.querySelectorAll("img:not(.ld)").forEach(img => { if (img.complete) markLoaded(img); });

  // ---- For the admin page (assets/js/admin.js) -------------------------------------------
  window.PLUGE.app = { db: () => dbReady, authKnown, user: () => user, openAccount, announce, esc, money, price, byId };

  // ---- Misc ----------------------------------------------------------------
  function announce(text) {
    const live = $("#live");
    live.textContent = "";
    setTimeout(() => { live.textContent = text; }, 30);
  }

  renderChips();
  renderBag();
  syncSavedButtons();
  syncMenu();
  syncAccountButton();
  dbReady = initAccounts();
  renderPromo();
  loadReviewStats();
  if (!still && $("#hero-title")) $("#hero-title").classList.add("play");
  // The home page's sections below the campaign photo are drawn just after the first paint, so the
  // photo shows sooner.
  const afterPaint = fn => requestAnimationFrame(() => setTimeout(fn, 0));
  afterPaint(() => {
    if (tv) { renderChannel(0, false); setRotating(rotating); }
    renderGrid(false);
    renderLooks();
    if (!pdp) renderRecent();
    updateFit();
    syncSavedButtons();
    if (tv || fitStage) requestAnimationFrame(frame);
    markDone();
  });
  markDone();

  // Shopify's order status page can link back with ?ordered=1, which empties the bag after a purchase.
  if (new URLSearchParams(location.search).has("ordered") && IS_HOME) {
    bag = [];
    saveBag();
    // If this device belongs to a signed-in shopper, the empty bag replaces the account's copy too.
    const info = readSync();
    if (info.user) writeSync({ user: info.user, dirty: true });
    renderBag();
    showToast("Thanks for your order. We've emptied your bag.", { bagLink: false });
    if (ROUTING) { try { history.replaceState(null, "", ROOT); } catch { /* the address keeps ?ordered=1 */ } }
  }

  // A product page (p/<id>/) fills in its product, in the colour from ?colour= if there is one.
  if (pdp && byId[pdp.dataset.id]) openProduct(pdp.dataset.id, new URLSearchParams(location.search).get("colour"));
})();
