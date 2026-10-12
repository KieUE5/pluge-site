// PLUGE shop: page behaviour. Product data lives in catalog.js.
(() => {
  "use strict";

  const { BRAND, SHIP, COLOURS, CATS, GUIDES, CARE, PRODUCTS, CHANNELS, FIT, DROP_02_PIECES, LOOKS, CHECKOUT } = window.PLUGE;
  const DROP_02 = new Date(window.PLUGE.DROP_02);
  const BANK_HOLIDAYS = new Set(window.PLUGE.BANK_HOLIDAYS);
  const BAG_KEY = "pluge-bag-v1";
  const SAVED_KEY = "pluge-saved-v1";
  const RECENT_KEY = "pluge-recent-v1";
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
  // Each product also has its own page at p/<id>/, and the address changes as the product sheet opens,
  // so every asset address is built from the site root rather than from the current address.
  const ROOT = new URL(".", document.baseURI).href;
  const HOME_TITLE = root.dataset.homeTitle || document.title;
  // Change the address bar only on the real site, not in an embedded preview or a file opened from disk.
  const ROUTING = window.self === window.top && /^https?:$/.test(location.protocol);
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

  const channelEl = $("#channel");
  const staticCv = $("#static");
  const playBtn = $("#ch-play");
  let chIndex = 0, chBusy = false, chElapsed = 0;
  // Auto-rotation: on by default on larger screens, off on phones and when motion is off.
  let rotating = !still && !narrowScreen;

  $("#pips").innerHTML = CHANNELS.map((c, i) => {
    const what = c.kind === "bars" ? "colour bars" : byId[c.id].name;
    return `<button class="pip" type="button" data-ch="${i}" aria-pressed="false" aria-label="Channel ${c.n}: ${esc(what)}"><span aria-hidden="true">${c.n}</span><span class="pip-bar" aria-hidden="true"><i></i></span></button>`;
  }).join("");
  const pips = [...document.querySelectorAll("#pips .pip")];

  function setRotating(on) {
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

  playBtn.addEventListener("click", () => setRotating(!rotating));
  $("#pips").addEventListener("click", e => { const b = e.target.closest("[data-ch]"); if (b) pick(+b.dataset.ch); });
  $("#ch-prev").addEventListener("click", () => pick(chIndex - 1));
  $("#ch-next").addEventListener("click", () => pick(chIndex + 1));

  const screenHit = $("#screen-hit");
  let swipe = null, swiped = false;
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
    if (ch.kind === "bars") $("#shop").scrollIntoView({ behavior: still ? "auto" : "smooth" });
    else openProduct(ch.id, ch.colour);
  });

  const tv = $("#tv");
  let tvHover = false, tvFocus = false, tvVisible = true;
  tv.addEventListener("pointerenter", () => { tvHover = true; });
  tv.addEventListener("pointerleave", () => { tvHover = false; });
  tv.addEventListener("focusin", () => { tvFocus = true; });
  tv.addEventListener("focusout", e => { if (!tv.contains(e.relatedTarget)) tvFocus = false; });

  // ---- Velocity marquee ------------------------------------------------------
  const MQ_WORDS = [[BRAND, ""], ["Test pattern", "outline"], ["Drop 01", ""], ["450gsm", "outline"], ["Heavyweight", ""], ["Boxy fit", "outline"]];
  const glyph = `<span class="mq-glyph"></span>`;
  const mqGroup = words => words.map(([t, cls]) => `<span class="mq-item ${cls}">${esc(t)}${glyph}</span>`).join("");
  const mqA = $("#mq-a"), mqB = $("#mq-b");
  const mq = { a: 0, b: 0, wa: 1, wb: 1, vel: 0, visible: false };
  function buildMarquee() {
    const reps = Math.max(2, Math.ceil(window.innerWidth / 1400) + 1);
    const ga = mqGroup(MQ_WORDS).repeat(reps);
    const gb = mqGroup([...MQ_WORDS].reverse().map(([t, c]) => [t, c ? "" : "outline"])).repeat(reps);
    mqA.innerHTML = ga + ga;
    mqB.innerHTML = gb + gb;
    mq.wa = mqA.scrollWidth / 2 || 1;
    mq.wb = mqB.scrollWidth / 2 || 1;
  }
  buildMarquee();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(buildMarquee);
  let resizeT;
  window.addEventListener("resize", () => { clearTimeout(resizeT); resizeT = setTimeout(() => { buildMarquee(); fitDirty = true; }, 150); });

  // ---- Grid ----------------------------------------------------------------
  let filter = "all", sizeFilter = "", sortBy = "featured";
  const grid = $("#grid");
  const CARD_SIZES = "(max-width: 720px) 46vw, (max-width: 1000px) 31vw, 310px";

  function renderChips() {
    $("#chips").innerHTML = CATS.map(c => {
      const n = c.id === "all" ? PRODUCTS.length : PRODUCTS.filter(p => p.cat === c.id).length;
      return `<button class="chip" type="button" data-cat="${c.id}" aria-pressed="${c.id === filter}">${esc(c.label)}<span class="n">${n}</span></button>`;
    }).join("");
    $("#foot-cats").innerHTML = CATS.filter(c => c.id !== "all")
      .map(c => `<li><button class="link-btn" type="button" data-cat="${c.id}">${esc(c.label)}</button></li>`).join("");
  }

  // A size filter only keeps pieces that still have that size in at least one colour.
  const inSize = (p, size) => !size || (p.sizes.includes(size) && p.colours.some(k => !isOut(p, k, size)));

  function renderGrid(animate) {
    let list = PRODUCTS.filter(p => (filter === "all" || p.cat === filter) && inSize(p, sizeFilter));
    if (sortBy === "low") list = [...list].sort((a, b) => a.price - b.price);
    if (sortBy === "high") list = [...list].sort((a, b) => b.price - a.price);
    $("#result-count").textContent = `${list.length} ${list.length === 1 ? "piece" : "pieces"}${sizeFilter ? ` in ${sizeFilter}` : ""}`;
    $("#grid-empty").hidden = list.length > 0;
    grid.innerHTML = list.map(p => {
      const key = sizeFilter ? (p.colours.find(k => !isOut(p, k, sizeFilter)) || p.colours[0]) : p.colours[0];
      const allOut = p.colours.every(k => colourOut(p, k));
      const badge = allOut ? `<span class="badge out">Sold out</span>`
        : p.badge ? `<span class="badge${p.badge === "Low stock" ? " low" : ""}">${esc(p.badge)}</span>` : "";
      const back = hasBack(p);
      const dots = p.colours.map(k => `<span class="dot" style="background:${swatchBg(k)}"></span>`).join("");
      return `<li><button class="card" type="button" data-id="${p.id}" data-colour="${key}" aria-haspopup="dialog">
        <span class="tilt"><span class="card-media">${badge}
          <span class="flip${back ? " has-back" : ""}">
            <span class="face front">${art(p, key, "front", { sizes: CARD_SIZES })}</span>${back ? `<span class="face back">${art(p, key, "back", { sizes: CARD_SIZES })}</span>` : ""}
          </span>
          <span class="glare"></span>${back ? `<span class="turn-hint" aria-hidden="true">Back</span>` : ""}
        </span></span>
        <span class="card-row"><span class="card-name">${esc(p.name)}</span><span class="card-price">${price(p.price)}</span></span>
        <span class="card-meta">${dots}${p.colours.length} ${p.colours.length === 1 ? "colour" : "colours"}</span>
      </button><button class="save-tog" type="button" data-id="${p.id}" data-colour="${key}" aria-pressed="${isSaved(p.id)}" aria-label="Save ${esc(p.name)}">${HEART}</button></li>`;
    }).join("");
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
    if (cat === filter) return;
    filter = cat;
    document.querySelectorAll("#chips .chip").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.cat === cat)));
    renderGrid(true);
  }

  $("#chips").addEventListener("click", e => { const b = e.target.closest("[data-cat]"); if (b) setFilter(b.dataset.cat); });
  $("#foot-cats").addEventListener("click", e => {
    const b = e.target.closest("[data-cat]");
    if (!b) return;
    setFilter(b.dataset.cat);
    $("#shop").scrollIntoView({ behavior: still ? "auto" : "smooth" });
  });
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
  grid.addEventListener("click", e => {
    const save = e.target.closest(".save-tog");
    if (save) { toggleSaved(save.dataset.id, save.dataset.colour); return; }
    const card = e.target.closest(".card");
    if (card) openProduct(card.dataset.id, card.dataset.colour);
  });

  // ---- Build the fit (scroll-scrubbed flat lay) -----------------------------
  const fitStage = $("#fit-stage"), fitSec = $("#fit");
  fitStage.insertAdjacentHTML("beforeend", FIT.map(f =>
    `<button class="piece" type="button" tabindex="-1" aria-hidden="true" data-id="${f.id}" data-colour="${f.colour}" style="--w:${f.w}%;left:${f.x}%;top:${f.y}%;z-index:${f.z}">${art(byId[f.id], f.colour, "front", { sizes: "(max-width: 860px) 50vw, 30vw" })}</button>`).join(""));
  const pieces = [...fitStage.querySelectorAll(".piece")];
  let fitItems = [];
  function renderFitList() {
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
  fitStage.addEventListener("click", openFromFit);
  $("#fit-list").addEventListener("click", openFromFit);
  $("#fit-shop").addEventListener("click", () => openKit({ title: "Full broadcast", items: FIT.map(f => [f.id, f.colour]) }));

  // ---- Lookbook --------------------------------------------------------------
  const lookTotal = look => look.pieces.reduce((sum, [id]) => sum + byId[id].price, 0);
  function renderLooks() {
    $("#looks").innerHTML = LOOKS.map((look, i) => {
      const wide = look.w > look.h, m = look.model;
      const wears = m ? look.pieces.filter(([id]) => m.wears[id]).map(([id]) => `${byId[id].short} ${m.wears[id]}`).join(" · ") : "";
      return `<figure class="look${wide ? " look-wide" : ""}" style="--ar:${look.w}/${look.h}">
        <div class="look-frame" data-look="${i}">
          ${lookImg(look, { sizes: wide ? "(max-width: 720px) 160vw, (max-width: 1320px) 64vw, 860px" : "(max-width: 720px) 80vw, (max-width: 1320px) 40vw, 540px" })}
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
        <p class="tile-big wide">Boxy on purpose</p>
        <div class="tile-body">
          <p>Hoodies, crews and tees are cut boxy with a dropped shoulder. Take your usual size for the fit in these photos, or one size down for a closer fit.</p>
          <p>Cargos are a relaxed straight leg. Take your usual waist size.</p>
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
  $("#looks").addEventListener("click", e => { const b = e.target.closest("[data-look]"); if (b) shopLook(+b.dataset.look); });

  // ---- Shop the look: every piece of a look (or the fit) with a size for each --
  const kit = $("#kit");
  let kitItems = [], kitName = "";
  function openKit({ title, items, intro = "" }) {
    kitName = title;
    kitItems = items.map(([id, colour, wears]) => {
      const p = byId[id], out = colourOut(p, colour);
      const size = p.sizes.length === 1 && !out ? p.sizes[0] : "";
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
    if (b.dataset.act === "details") { kit.close(); openProduct(it.p.id, it.colour); return; }
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

  // ---- Product sheet: turntable, zoom, static on colour change -------------
  const pd = $("#pd");
  const stage = $("#pd-stage"), zoomLayer = $("#pd-zoom-layer"), turn = $("#pd-turn"), face = $("#pd-face");
  const lens = $("#pd-lens"), lensInner = $("#pd-lens-inner"), pdStatic = $("#pd-static"), zoomBtn = $("#pd-zoom");
  const LENS = 190, LENS_ZOOM = 2.4, ZOOM = 2.2;
  const PD_SIZES = "(max-width: 760px) 100vw, 600px";
  const sel = { p: null, colour: null, size: null };
  let angle = 0, side = "front", tweenId = 0, drag = null, units = "cm", modelOn = false;
  let zoomed = false, pan = { x: 0, y: 0 }, lastTap = { t: 0, x: 0, y: 0 };

  const sideFor = a => { const n = ((a % 360) + 360) % 360; return n > 90 && n < 270 ? "back" : "front"; };

  // On-model photos come from the lookbook. A studio fit check in the chosen colour comes first.
  const lookPieces = LOOKS.flatMap(look => look.pieces.map(([id, colour]) => ({ look, id, colour })));
  function modelShot(p, colour) {
    const rank = x => (x.colour === colour ? 0 : 2) + (x.look.model && x.look.model.wears[p.id] ? 0 : 1);
    return lookPieces.filter(x => x.id === p.id).sort((a, b) => rank(a) - rank(b))[0] || null;
  }
  const modelSize = (p, shot) => shot.look.model && shot.look.model.wears[p.id];

  function drawFace() {
    const p = sel.p;
    const shot = modelOn ? modelShot(p, sel.colour) : null;
    if (shot) {
      const look = shot.look, wide = look.w > look.h, cls = `model-img${wide ? " cover" : ""}`;
      // Portrait photos sit whole in the frame over a blurred copy of themselves; wide ones are cropped.
      face.innerHTML = (wide ? "" : `<img class="model-bg" src="${lookSrc(look, look.w / 2)}" alt="" decoding="async" draggable="false">`) +
        lookImg(look, { sizes: PD_SIZES, cls, lazy: false });
      lensInner.innerHTML = `<img class="${cls}" src="${lookSrc(look, look.w)}" alt="" decoding="async"${look.pos ? ` style="object-position:${look.pos}"` : ""}>`;
      const size = modelSize(p, shot);
      const what = size ? `Model is ${shot.look.model.height}cm and wears ${size}` : `Look ${look.n}: ${look.title}`;
      $("#pd-model-cap").textContent = shot.colour === sel.colour ? what : `${what} · Shown in ${COLOURS[shot.colour].name}`;
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

  function openProduct(id, colour, { push = true } = {}) {
    const p = byId[id];
    if (!p) return;
    sel.p = p;
    sel.colour = colour && p.colours.includes(colour) && !colourOut(p, colour) ? colour : (p.colours.find(k => !colourOut(p, k)) || p.colours[0]);
    sel.size = null;
    tweenId++;
    angle = 0;
    side = "front";
    modelOn = false;
    turn.style.transform = "";
    face.style.transform = "";
    setZoom(false);
    if (hasBack(p)) preload(imgSrc(p, sel.colour, "back"));

    $("#pd-eyebrow").textContent = `Drop 01 · ${CATS.find(c => c.id === p.cat).label}`;
    $("#pd-name").textContent = p.name;
    $("#pd-price").textContent = price(p.price);
    $("#pd-ship").textContent = `UK delivery ${money(SHIP.t48.fee)}, free over ${price(SHIP.t48.freeOver)} · Estimated delivery ${estimate("t48")}`;
    $("#pd-blurb").textContent = p.blurb;
    $("#pd-fabric").textContent = p.fabric;
    $("#pd-details").innerHTML = p.details.map(d => `<li>${esc(d)}</li>`).join("");
    $("#pd-deco").textContent = p.deco;
    $("#pd-care").textContent = CARE[p.care];

    const g = p.guide && GUIDES[p.guide];
    $("#pd-guide-wrap").hidden = !g;
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

    $("#pd-pairs").innerHTML = p.pairs.map(pid => {
      const q = byId[pid];
      return `<button class="pair" type="button" data-id="${q.id}"><span class="pair-img">${art(q, q.colours[0], "front", { sizes: "160px" })}</span><span class="pair-name">${esc(q.name)}</span><span class="pair-price">${price(q.price)}</span></button>`;
    }).join("");

    renderVariant();
    syncSavedButtons();
    noteRecent(p.id, sel.colour);
    if (!pd.open) pd.showModal();
    pd.scrollTop = 0;
    syncUrl(push);
    if (hasBack(p) && !still) setTimeout(() => { if (pd.open && !drag && !zoomed) { tweenTo(34, 520); setTimeout(() => { if (!drag && !zoomed) tweenTo(0, 700); }, 560); } }, 520);
  }

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
  $("#pd-units").addEventListener("click", e => {
    const b = e.target.closest("[data-unit]");
    if (!b || b.dataset.unit === units) return;
    const v = parseFloat($("#finder-in").value);
    units = b.dataset.unit;
    if (isFinite(v)) $("#finder-in").value = units === "in" ? (v / 2.54).toFixed(1) : (v * 2.54).toFixed(1);
    renderGuide();
    $("#finder-out").textContent = "";
  });

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
  $("#finder-go").addEventListener("click", suggestSize);
  $("#finder-in").addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); suggestSize(); } });

  function openSection(id) {
    const d = $(id);
    d.open = true;
    d.scrollIntoView({ behavior: still ? "auto" : "smooth", block: "start" });
    d.querySelector("summary").focus({ preventScroll: true });
  }
  $("#pd-guide-link").addEventListener("click", () => openSection("#pd-guide-wrap"));
  $("#pd-returns-link").addEventListener("click", () => openSection("#pd-returns-wrap"));
  $("#pd-pairs").addEventListener("click", async e => {
    const b = e.target.closest("[data-id]");
    if (!b) return;
    const q = byId[b.dataset.id];
    const s = burst(pdStatic, 260);
    await Promise.all([still ? null : wait(110), preload(imgSrc(q, q.colours[0], "front"))]);
    openProduct(q.id);
    await s;
  });

  function renderVariant() {
    const p = sel.p, key = sel.colour, c = COLOURS[key];
    if (!sel.size && p.sizes.length === 1 && !isOut(p, key, p.sizes[0])) sel.size = p.sizes[0];

    $("#pd-colour-name").textContent = c.name;
    const shot = modelShot(p, key);
    if (!shot) modelOn = false;
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

    // How it fits: the model's height and size, from the lookbook.
    const size = shot && modelSize(p, shot);
    $("#pd-fit-note").hidden = !shot;
    if (shot) {
      $("#pd-fit-text").textContent = size ? `Model is ${shot.look.model.height}cm and wears ${size}.` : `Seen in look ${shot.look.n}, ${shot.look.title}.`;
      $("#pd-fit-view").textContent = modelOn ? "Show the product" : "View on model";
    }

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
    add.textContent = !sel.size ? "Select a size" : out ? `Notify me when ${sel.size} is back` : `Add to bag · ${price(p.price)}`;
  }

  $("#pd-swatches").addEventListener("change", async e => {
    if (e.target.name !== "pd-colour") return;
    sel.colour = e.target.value;
    const b = burst(pdStatic, 280);
    const shot = modelOn && modelShot(sel.p, sel.colour);
    await Promise.all([still ? null : wait(120), preload(shot ? lookSrc(shot.look, shot.look.w / 2) : imgSrc(sel.p, sel.colour, side))]);
    renderVariant();
    noteRecent(sel.p.id, sel.colour);
    syncUrl(false);
    await b;
  });
  $("#pd-sizes").addEventListener("change", e => {
    if (e.target.name !== "pd-size") return;
    sel.size = e.target.value;
    updateAdd();
  });
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
  $("#pd-views").addEventListener("click", async e => {
    const b = e.target.closest("[data-view]");
    if (!b) return;
    const v = b.dataset.view;
    if (v === "model") { setModel(true); return; }
    if (modelOn) { await setModel(false); if (v === "back") tweenTo(180, 760); return; }
    if (zoomed) setZoom(false);
    tweenTo(nearest(v === "back" ? 180 : 0), 760);
  });
  $("#pd-fit-view").addEventListener("click", () => setModel(!modelOn));
  $("#pd-save").addEventListener("click", () => toggleSaved(sel.p.id, sel.colour));
  $("#pd-form").addEventListener("submit", e => {
    e.preventDefault();
    if (!sel.size) return;
    const p = sel.p, colour = sel.colour, size = sel.size;
    if (isOut(p, colour, size)) {
      $("#pd-size-note").textContent = `Preview only: restock alerts aren't saved yet, so we can't email you about ${size}.`;
      return;
    }
    const from = stage.getBoundingClientRect();
    const src = imgSrc(p, colour, modelOn ? "front" : side);
    addToBag(p.id, colour, size);
    pd.close();
    const msg = `Added ${p.name}, ${COLOURS[colour].name}, ${size}`;
    flyToBag(from, src).then(() => { bumpBag(); showToast(msg); });
    announce(`${msg} to your bag.`);
  });
  $("#pd-close").addEventListener("click", () => pd.close());

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

  // ---- Bag -----------------------------------------------------------------
  const bagDlg = $("#bag");
  let bag = loadBag(), shipKey = "t48";
  const fresh = new Set(); // lines just added, highlighted the next time the bag opens

  function loadBag() {
    try {
      const v = JSON.parse(localStorage.getItem(BAG_KEY) || "[]");
      if (!Array.isArray(v)) return [];
      return v.filter(l => l && byId[l.id] && COLOURS[l.colour] && byId[l.id].colours.includes(l.colour) &&
        byId[l.id].sizes.includes(l.size) && Number.isInteger(l.qty) && l.qty > 0)
        .map(l => ({ id: l.id, colour: l.colour, size: l.size, qty: Math.min(l.qty, MAX_QTY) }));
    } catch { return []; }
  }
  function saveBag() {
    try { localStorage.setItem(BAG_KEY, JSON.stringify(bag)); } catch { /* storage unavailable; bag lasts for this visit */ }
  }
  const lineKey = l => `${l.id}|${l.colour}|${l.size}`;

  function addToBag(id, colour, size) {
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

    const left = SHIP.t48.freeOver - sub;
    $("#ship-msg").textContent = left > 0 ? `Spend ${money(left)} more for free Tracked 48 delivery` : "You've got free Tracked 48 delivery";
    $("#ship-bar").style.width = `${Math.min(100, (sub / SHIP.t48.freeOver) * 100)}%`;
    ["t48", "t24"].forEach(k => {
      const fee = shipFee(k, sub);
      $(`#fee-${k}`).textContent = fee ? money(fee) : "Free";
      $(`#est-${k}`).textContent = `Estimated ${estimate(k)}`;
    });

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

    $("#t-sub").textContent = money(sub);
    $("#t-ship").textContent = delivery ? money(delivery) : "Free";
    $("#t-total").textContent = money(sub + delivery);
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
  $("#bag-shop").addEventListener("click", () => {
    bagDlg.close();
    $("#shop").scrollIntoView({ behavior: still ? "auto" : "smooth" });
  });

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
  // Shopify products are matched by handle (= product id here), then by their Colour and Size options.
  const optKey = v => norm(v).replace(/[^a-z0-9]+/g, "");
  const VARIANTS_Q = `query PlugeVariants {
    products(first: 100) { nodes { handle variants(first: 100) { nodes {
      id availableForSale price { amount currencyCode } selectedOptions { name value }
    } } } }
  }`;
  function loadVariants() {
    if (variantsP) return variantsP;
    const colourByName = new Map(Object.entries(COLOURS).map(([k, c]) => [optKey(c.name), k]));
    variantsP = storefront(VARIANTS_Q).then(data => {
      const map = new Map();
      for (const prod of data.products.nodes) {
        const p = byId[prod.handle];
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
    if (pd.open) { $("#pd-price").textContent = price(sel.p.price); renderVariant(); }
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
      }`, { input: { lines: bag.map(l => ({ merchandiseId: map.get(lineKey(l)).id, quantity: l.qty })), buyerIdentity: { countryCode: "GB" } } });
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
    syncSavedButtons(id);
    if (savedDlg.open) renderSaved();
    announce(on ? `Saved ${byId[id].name}.` : `Removed ${byId[id].name} from saved.`);
  }
  // pop: the id that just changed, so its buttons get a little bounce.
  function syncSavedButtons(pop) {
    const n = saved.length;
    $("#saved-count").textContent = n;
    $("#saved-count").hidden = n === 0;
    $("#saved-open").setAttribute("aria-label", `Saved, ${n} ${n === 1 ? "piece" : "pieces"}`);
    const btns = [...document.querySelectorAll(".save-tog")];
    if (sel.p) { $("#pd-save").dataset.id = sel.p.id; btns.push($("#pd-save")); }
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
    if (b.dataset.act === "open") { savedDlg.close(); openProduct(b.dataset.id, b.dataset.colour); return; }
    const i = saved.findIndex(x => x.id === b.dataset.id);
    toggleSaved(b.dataset.id);
    const rest = $("#saved-lines").querySelectorAll('[data-act="remove"]');
    (rest[Math.min(i, rest.length - 1)] || $("#saved-shop")).focus();
  });
  $("#saved-open").addEventListener("click", () => { renderSaved(); if (!savedDlg.open) savedDlg.showModal(); });
  $("#saved-close").addEventListener("click", () => savedDlg.close());
  $("#saved-shop").addEventListener("click", () => {
    savedDlg.close();
    $("#shop").scrollIntoView({ behavior: still ? "auto" : "smooth" });
  });

  // ---- Recently viewed -----------------------------------------------------
  let recent = readList(RECENT_KEY, validPick).slice(0, 8);
  function noteRecent(id, colour) {
    recent = [{ id, colour }, ...recent.filter(x => x.id !== id)].slice(0, 8);
    writeList(RECENT_KEY, recent);
  }
  function renderRecent() {
    $("#recent").hidden = recent.length === 0;
    $("#recent-row").innerHTML = recent.map(x => {
      const p = byId[x.id];
      return `<li><button class="mini" type="button" data-id="${p.id}" data-colour="${x.colour}">
        <span class="mini-img">${art(p, x.colour, "front", { sizes: "150px" })}</span>
        <span class="mini-name">${esc(p.name)}</span><span class="mini-price">${price(p.price)}</span>
      </button></li>`;
    }).join("");
  }
  $("#recent-row").addEventListener("click", e => { const b = e.target.closest("[data-id]"); if (b) openProduct(b.dataset.id, b.dataset.colour); });
  $("#recent-clear").addEventListener("click", () => {
    recent = [];
    writeList(RECENT_KEY, recent);
    renderRecent();
    announce("Cleared recently viewed.");
    $("#shop-title").setAttribute("tabindex", "-1");
    $("#shop-title").focus();
  });

  // ---- Search ----------------------------------------------------------------
  const searchDlg = $("#search"), searchIn = $("#search-in"), searchList = $("#search-list");
  const SECTIONS = [
    { label: "Lookbook", href: "#lookbook", words: "lookbook looks photos model fit check" },
    { label: "The fit", href: "#fit", words: "fit outfit full broadcast flat lay" },
    { label: "Drop 02 countdown", href: "#drop-02", words: "drop 02 next countdown interference alert notify" },
    { label: "Delivery and returns", href: "#delivery", words: "delivery shipping postage returns refund royal mail" },
    { label: "About PLUGE", href: "#about", words: "about brand story pluge" },
  ];
  const searchIndex = PRODUCTS.map(p => ({
    p,
    name: norm(p.name),
    text: norm([p.name, CATS.find(c => c.id === p.cat).label, p.tags || "", p.blurb, p.fabric, p.deco, p.sizes.join(" ")].join(" ")),
  }));
  const startsWord = (text, t) => new RegExp(`(^|[^a-z0-9])${reEsc(t)}`).test(text);
  function runSearch(q) {
    const terms = norm(q).split(/[\s,]+/).filter(Boolean);
    const firstIn = p => p.colours.find(k => !colourOut(p, k)) || p.colours[0];
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
          <span class="opt-main"><span class="opt-name">${esc(r.label)}</span><span class="opt-meta">Go to section</span></span></li>`).join("");
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
    if (r.kind === "p") { openProduct(r.p.id, r.colour); return; }
    const target = $(r.href);
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

  [pd, bagDlg, kit, savedDlg, searchDlg].forEach(d => d.addEventListener("click", e => { if (e.target === d) d.close(); }));

  // ---- Product links: the sheet's address is p/<id>/, so it can be shared and Back closes it ----
  const productUrl = (id, colour) => `${ROOT}p/${id}/${colour && colour !== byId[id].colours[0] ? `?colour=${colour}` : ""}`;
  function syncUrl(push) {
    document.title = `${sel.p.name} · ${BRAND}`;
    if (!ROUTING) return;
    const state = { pd: sel.p.id, colour: sel.colour };
    try {
      if (push && !(history.state && history.state.pd)) history.pushState(state, "", productUrl(sel.p.id, sel.colour));
      else history.replaceState(state, "", productUrl(sel.p.id, sel.colour));
    } catch { /* the address just doesn't change */ }
  }
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
  $("#ttx-list").innerHTML = DROP_02_PIECES.map(([c, n, pr]) =>
    `<li><span class="c">${c}</span><span class="n">${esc(n)}</span><span class="p">${price(pr)}</span></li>`).join("");
  try {
    const local = new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZoneName: "short" }).format(DROP_02);
    $("#drop-local").textContent = `Your time: ${local}`;
  } catch { /* leave the GMT time on its own */ }
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
      $("#hero-drop-cta").textContent = "Drop 02 is live";
      return;
    }
    const d = Math.floor(ms / 864e5);
    setDigit("cd-d", pad(d));
    setDigit("cd-h", pad(Math.floor(ms / 36e5) % 24));
    setDigit("cd-m", pad(Math.floor(ms / 6e4) % 60));
    setDigit("cd-s", pad(Math.floor(ms / 1e3) % 60));
    $("#hero-drop-cta").textContent = d >= 1 ? `Drop 02 in ${d} ${d === 1 ? "day" : "days"}` : "Drop 02 today";
  }
  tickClock();
  setInterval(tickClock, 1000);

  $("#notify").addEventListener("submit", e => {
    e.preventDefault();
    const input = $("#notify-email"), consent = $("#notify-consent"), msg = $("#notify-msg");
    if (!input.value.trim() || !input.checkValidity()) {
      msg.textContent = "Enter an email address, like name@example.com.";
      input.focus();
      return;
    }
    if (!consent.checked) {
      msg.textContent = "Tick the box to agree to drop alert emails.";
      consent.focus();
      return;
    }
    msg.textContent = "Preview only: sign-ups aren't saved yet.";
  });
  document.querySelectorAll('a[href="#notify"]').forEach(a => a.addEventListener("click", () => {
    setTimeout(() => $("#notify-email").focus({ preventScroll: true }), still ? 0 : 450);
  }));

  // ---- Motion toggle -------------------------------------------------------
  const motionBtn = $("#motion-toggle");
  function syncMotionBtn() {
    const text = still ? "Play motion" : "Pause motion";
    motionBtn.querySelector(".motion-txt").textContent = text;
    motionBtn.setAttribute("aria-label", text);
  }
  motionBtn.addEventListener("click", () => {
    still = !still;
    root.dataset.motion = still ? "off" : "on";
    try { localStorage.setItem(MOTION_KEY, still ? "off" : "on"); } catch { /* remembered for this visit only */ }
    syncMotionBtn();
    setRotating(!still && !narrowScreen);
    if (still) {
      mqA.style.transform = mqB.style.transform = "";
      document.querySelectorAll(".tilt").forEach(t => { t.style.setProperty("--rx", "0deg"); t.style.setProperty("--ry", "0deg"); });
    }
    fitDirty = true;
    announce(still ? "Motion paused." : "Motion on.");
  });
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
  if ("IntersectionObserver" in window) {
    const io = new IntersectionObserver(entries => entries.forEach(en => {
      if (en.target === tv) tvVisible = en.isIntersecting;
      if (en.target.id === "mq") mq.visible = en.isIntersecting;
    }));
    io.observe(tv);
    io.observe($("#mq"));
  } else { mq.visible = true; }

  // ---- One animation loop: timecode, channel timer, marquee, fit ------------
  const tcEl = $("#timecode");
  const t0 = performance.now();
  let last = t0, lastScrollY = window.scrollY, lastTcSec = -1;
  function frame(now) {
    const dt = Math.min(64, now - last);
    last = now;

    const t = (now - t0) / 1000;
    if (!still || Math.floor(t) !== lastTcSec) {
      lastTcSec = Math.floor(t);
      const ff = still ? 0 : Math.floor((t % 1) * 25);
      tcEl.textContent = `TC ${pad(Math.floor(t / 3600))}:${pad(Math.floor(t / 60) % 60)}:${pad(Math.floor(t) % 60)}:${pad(ff)}`;
    }

    const paused = !rotating || tvHover || tvFocus || !tvVisible || document.hidden || pd.open || bagDlg.open;
    if (!paused && !chBusy) {
      chElapsed += dt;
      if (chElapsed >= CHANNEL_DWELL) tune(chIndex + 1);
    }
    pips[chIndex].style.setProperty("--p", rotating ? Math.min(1, chElapsed / CHANNEL_DWELL).toFixed(3) : 0);

    const sy = window.scrollY;
    const v = (sy - lastScrollY) / Math.max(dt, 1) * 1000;
    lastScrollY = sy;
    mq.vel += (v - mq.vel) * 0.12;
    if (mq.visible && !still) {
      const speed = 70 + Math.min(1600, Math.abs(mq.vel) * 0.5);
      const dir = mq.vel < -20 ? -1 : 1;
      mq.a = ((mq.a + dir * speed * dt / 1000) % mq.wa + mq.wa) % mq.wa;
      mq.b = ((mq.b - dir * speed * dt / 1000) % mq.wb + mq.wb) % mq.wb;
      const skew = clamp(mq.vel * -0.006, -14, 14).toFixed(2);
      mqA.style.transform = `translate3d(${-mq.a}px,0,0) skewX(${skew}deg)`;
      mqB.style.transform = `translate3d(${-mq.b}px,0,0) skewX(${skew}deg)`;
    }

    if (fitDirty) { fitDirty = false; updateFit(); }
    requestAnimationFrame(frame);
  }

  // ---- Misc ----------------------------------------------------------------
  function announce(text) {
    const live = $("#live");
    live.textContent = "";
    setTimeout(() => { live.textContent = text; }, 30);
  }

  renderChannel(0, false);
  setRotating(rotating);
  renderChips();
  renderGrid(false);
  renderLooks();
  renderRecent();
  renderBag();
  syncSavedButtons();
  updateFit();
  if (!still) $("#hero-title").classList.add("play");
  requestAnimationFrame(frame);

  // Shopify's order status page can link back with ?ordered=1, which empties the bag after a purchase.
  if (new URLSearchParams(location.search).has("ordered") && !root.dataset.product) {
    bag = [];
    saveBag();
    renderBag();
    showToast("Thanks for your order. We've emptied your bag.", { bagLink: false });
    if (ROUTING) { try { history.replaceState(null, "", ROOT); } catch { /* the address keeps ?ordered=1 */ } }
  }

  // A product page (p/<id>/) is the shop with that product's sheet open. Its address is swapped for
  // the shop's underneath the sheet, so Back closes the sheet instead of leaving the site.
  const startId = root.dataset.product;
  if (startId && byId[startId]) {
    const st = history.state;
    if (st && st.pd === startId) openProduct(startId, st.colour, { push: false });
    else {
      const colour = new URLSearchParams(location.search).get("colour");
      if (ROUTING) { try { history.replaceState(null, "", ROOT); } catch { /* stay on the product address */ } }
      openProduct(startId, colour);
    }
  }
})();
