// PLUGE shop: page behaviour. Product data lives in catalog.js.
(() => {
  "use strict";

  const { BRAND, SHIP, COLOURS, CATS, GUIDES, CARE, PRODUCTS, CHANNELS, FIT, DROP_02_PIECES } = window.PLUGE;
  const DROP_02 = new Date(window.PLUGE.DROP_02);
  const BANK_HOLIDAYS = new Set(window.PLUGE.BANK_HOLIDAYS);
  const BAG_KEY = "pluge-bag-v1";
  const MOTION_KEY = "pluge-motion";
  const MAX_QTY = 10;
  const CHANNEL_DWELL = 5200; // ms each hero channel stays on screen
  const BAR_COLOURS = ["#C8C8C8", "#E9DF00", "#00CFD6", "#00BF3A", "#D000C4", "#E3141C", "#1426E0"];

  const gbp2 = new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" });
  const gbp0 = new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: 0 });
  const price = n => Number.isInteger(n) ? gbp0.format(n) : gbp2.format(n);
  const money = n => gbp2.format(n);
  const esc = s => String(s).replace(/[&<>"']/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));
  const $ = sel => document.querySelector(sel);
  const pad = n => String(n).padStart(2, "0");
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const root = document.documentElement;
  const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  const narrowScreen = window.matchMedia("(max-width: 640px)").matches;
  let still = root.dataset.motion === "off"; // true when animation is off

  document.querySelectorAll(".glitch").forEach(el => { el.dataset.text = el.textContent; });

  // ---- Product images --------------------------------------------------------
  const byId = Object.fromEntries(PRODUCTS.map(p => [p.id, p]));
  const isOut = (p, key, size) => (p.soldOut[key] || []).includes(size);
  const colourOut = (p, key) => p.sizes.every(s => isOut(p, key, s));
  const hasBack = p => p.views.includes("back");
  const swatchBg = key => COLOURS[key].swatch || COLOURS[key].hex;
  const imgSrc = (p, key, view, small) => `assets/img/products/${p.id}-${key}-${view}${small ? "-sm" : ""}.webp`;

  // sizes: the CSS width the image is shown at, so the browser picks the 500px or 1000px file.
  function art(p, key, view = "front", { sizes = "50vw", alt = "", lazy = true, cls = "product-img" } = {}) {
    return `<img class="${cls}" src="${imgSrc(p, key, view)}" srcset="${imgSrc(p, key, view, true)} 500w, ${imgSrc(p, key, view)} 1000w" sizes="${sizes}"` +
      ` width="1000" height="1200" alt="${esc(alt)}"${lazy ? ' loading="lazy"' : ""} decoding="async" draggable="false">`;
  }
  const altFor = (p, key, view) => `${p.name} in ${COLOURS[key].name}, ${view} view`;
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

  // ---- Effects: film grain and TV static -----------------------------------
  (function makeGrain() {
    try {
      const cv = document.createElement("canvas");
      cv.width = cv.height = 160;
      const ctx = cv.getContext("2d");
      const img = ctx.createImageData(160, 160);
      for (let i = 0; i < img.data.length; i += 4) {
        const v = Math.random() * 255 | 0;
        img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
        img.data[i + 3] = 255;
      }
      ctx.putImageData(img, 0, 0);
      root.style.setProperty("--grain", `url(${cv.toDataURL()})`);
    } catch { /* grain is decoration only */ }
  })();

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
  const glyph = `<span class="mq-glyph">${BAR_COLOURS.map(c => `<i style="background:${c}"></i>`).join("")}</span>`;
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
      </button></li>`;
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
  grid.addEventListener("click", e => { const card = e.target.closest(".card"); if (card) openProduct(card.dataset.id, card.dataset.colour); });

  // ---- Build the fit (scroll-scrubbed flat lay) -----------------------------
  const fitStage = $("#fit-stage"), fitSec = $("#fit");
  fitStage.insertAdjacentHTML("beforeend", FIT.map(f =>
    `<button class="piece" type="button" tabindex="-1" aria-hidden="true" data-id="${f.id}" data-colour="${f.colour}" style="--w:${f.w}%;left:${f.x}%;top:${f.y}%;z-index:${f.z}">${art(byId[f.id], f.colour, "front", { sizes: "(max-width: 860px) 50vw, 30vw" })}</button>`).join(""));
  const pieces = [...fitStage.querySelectorAll(".piece")];
  $("#fit-list").innerHTML = FIT.map(f => {
    const p = byId[f.id];
    return `<li><button type="button" data-id="${f.id}" data-colour="${f.colour}"><span class="k">${f.k}</span><span class="nm">${esc(p.name)}</span><span class="pr">${price(p.price)}</span></button></li>`;
  }).join("");
  const fitItems = [...document.querySelectorAll("#fit-list li")];
  const fitTotalEl = $("#fit-total");
  let fitDirty = true, fitShownTotal = -1;
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

  // ---- Product sheet: turntable, zoom, static on colour change -------------
  const pd = $("#pd");
  const stage = $("#pd-stage"), zoomLayer = $("#pd-zoom-layer"), turn = $("#pd-turn"), face = $("#pd-face");
  const lens = $("#pd-lens"), lensInner = $("#pd-lens-inner"), pdStatic = $("#pd-static"), zoomBtn = $("#pd-zoom");
  const LENS = 190, LENS_ZOOM = 2.4, ZOOM = 2.2;
  const PD_SIZES = "(max-width: 760px) 100vw, 600px";
  const sel = { p: null, colour: null, size: null };
  let angle = 0, side = "front", tweenId = 0, drag = null, units = "cm";
  let zoomed = false, pan = { x: 0, y: 0 }, lastTap = { t: 0, x: 0, y: 0 };

  const sideFor = a => { const n = ((a % 360) + 360) % 360; return n > 90 && n < 270 ? "back" : "front"; };
  function drawFace() {
    const p = sel.p;
    face.innerHTML = art(p, sel.colour, side, { sizes: PD_SIZES, alt: altFor(p, sel.colour, side), lazy: false });
    lensInner.innerHTML = `<img class="product-img" src="${imgSrc(p, sel.colour, side)}" alt="" decoding="async">`;
    document.querySelectorAll("#pd-views .pd-view").forEach(v => v.setAttribute("aria-pressed", String(v.dataset.view === side)));
  }
  function applyAngle(a) {
    angle = a;
    const s = hasBack(sel.p) ? sideFor(a) : "front";
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
      if (drag.moved) stage.classList.add("dragging");
      let a = drag.a + dx * 0.55;
      if (!hasBack(sel.p)) a = clamp(a, -38, 38);
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
    if (!zoomed) tweenTo(hasBack(sel.p) ? Math.round(angle / 180) * 180 : 0, 520);
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

  function openProduct(id, colour) {
    const p = byId[id];
    sel.p = p;
    sel.colour = colour && p.colours.includes(colour) && !colourOut(p, colour) ? colour : (p.colours.find(k => !colourOut(p, k)) || p.colours[0]);
    sel.size = null;
    tweenId++;
    angle = 0;
    side = "front";
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
    const touchHint = hasBack(p) ? "Drag to turn · Double-tap to zoom" : "Double-tap to zoom";
    const mouseHint = hasBack(p) ? "Drag to turn · Hover to zoom" : "Hover to zoom";
    $("#pd-hint").textContent = finePointer ? mouseHint : touchHint;

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
    if (!pd.open) pd.showModal();
    pd.scrollTop = 0;
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
    $("#pd-views").innerHTML = hasBack(p) ? ["front", "back"].map(v =>
      `<button class="pd-view" type="button" data-view="${v}" aria-pressed="${v === side}" aria-label="Show ${v}">${art(p, key, v, { sizes: "64px" })}</button>`).join("") : "";
    stage.classList.toggle("static-only", !hasBack(p));
    drawFace();

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
    await Promise.all([still ? null : wait(120), preload(imgSrc(sel.p, sel.colour, side))]);
    renderVariant();
    await b;
  });
  $("#pd-sizes").addEventListener("change", e => {
    if (e.target.name !== "pd-size") return;
    sel.size = e.target.value;
    updateAdd();
  });
  $("#pd-views").addEventListener("click", e => {
    const b = e.target.closest("[data-view]");
    if (!b) return;
    if (zoomed) setZoom(false);
    tweenTo(nearest(b.dataset.view === "back" ? 180 : 0), 760);
  });
  $("#pd-form").addEventListener("submit", e => {
    e.preventDefault();
    if (!sel.size) return;
    const p = sel.p, colour = sel.colour, size = sel.size;
    if (isOut(p, colour, size)) {
      $("#pd-size-note").textContent = `Preview only: restock alerts aren't saved yet, so we can't email you about ${size}.`;
      return;
    }
    const from = stage.getBoundingClientRect();
    const src = imgSrc(p, colour, side);
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
  let bag = loadBag(), freshKey = null, shipKey = "t48";

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
    freshKey = `${id}|${colour}|${size}`;
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
    $("#checkout-note").hidden = true;

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
      return `<li class="line${k === freshKey ? " fresh" : ""}">
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
    freshKey = null;
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
    freshKey = null;
    renderBag();
  });

  function openBag() { hideToast(); renderBag(); freshKey = null; if (!bagDlg.open) bagDlg.showModal(); }
  $("#bag-open").addEventListener("click", openBag);
  $("#bag-close").addEventListener("click", () => bagDlg.close());
  $("#bag-continue").addEventListener("click", () => bagDlg.close());
  $("#bag-shop").addEventListener("click", () => {
    bagDlg.close();
    $("#shop").scrollIntoView({ behavior: still ? "auto" : "smooth" });
  });
  $("#checkout").addEventListener("click", () => { $("#checkout-note").hidden = false; });
  [pd, bagDlg].forEach(d => d.addEventListener("click", e => { if (e.target === d) d.close(); }));

  const toast = $("#toast");
  let toastT;
  function showToast(text) {
    $("#toast-msg").textContent = text;
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
  renderBag();
  updateFit();
  if (!still) $("#hero-title").classList.add("play");
  requestAnimationFrame(frame);
})();
