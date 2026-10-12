// Runs inside Chromium (see build-images.cjs). Turns one blank, mid-grey product photo on a white
// background into a cut-out product image in a given colour, with the prints applied so they pick
// up the fabric's folds and lighting.

const BAR_COLOURS = ["#C8C8C8", "#E9DF00", "#00CFD6", "#00BF3A", "#D000C4", "#E3141C", "#1426E0"];
const hexToRgb = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
const lum = (r, g, b) => 0.2126 * r + 0.7152 * g + 0.0722 * b;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

let fontsReady = null;
function loadFonts() {
  if (!fontsReady) {
    const face = new FontFace("Archivo", "url(/fonts/archivo-latin-standard-normal.woff2)", { weight: "100 900", stretch: "62% 125%" });
    fontsReady = face.load().then(f => document.fonts.add(f));
  }
  return fontsReady;
}

async function loadImageData(src) {
  const img = new Image();
  img.src = src;
  await img.decode();
  const c = new OffscreenCanvas(img.naturalWidth, img.naturalHeight);
  const ctx = c.getContext("2d");
  ctx.drawImage(img, 0, 0);
  return ctx.getImageData(0, 0, c.width, c.height);
}

function boxBlur(src, W, H, r) {
  const tmp = new Float32Array(src.length), out = new Float32Array(src.length), n = 2 * r + 1;
  for (let y = 0; y < H; y++) {
    let acc = 0;
    for (let x = -r; x <= r; x++) acc += src[y * W + clamp(x, 0, W - 1)];
    for (let x = 0; x < W; x++) {
      tmp[y * W + x] = acc / n;
      acc += src[y * W + clamp(x + r + 1, 0, W - 1)] - src[y * W + clamp(x - r, 0, W - 1)];
    }
  }
  for (let x = 0; x < W; x++) {
    let acc = 0;
    for (let y = -r; y <= r; y++) acc += tmp[clamp(y, 0, H - 1) * W + x];
    for (let y = 0; y < H; y++) {
      out[y * W + x] = acc / n;
      acc += tmp[clamp(y + r + 1, 0, H - 1) * W + x] - tmp[clamp(y - r, 0, H - 1) * W + x];
    }
  }
  return out;
}

// Background = near-white pixels connected to the image border. Everything else is garment.
function analyse(id, bgThreshold) {
  const { width: W, height: H, data } = id;
  const N = W * H;
  const L = new Float32Array(N);
  for (let i = 0; i < N; i++) L[i] = lum(data[i * 4], data[i * 4 + 1], data[i * 4 + 2]);
  const isBg = i => {
    const r = data[i * 4], g = data[i * 4 + 1], b = data[i * 4 + 2];
    return Math.min(r, g, b) >= bgThreshold && Math.max(r, g, b) - Math.min(r, g, b) < 22;
  };
  const bg = new Uint8Array(N), stack = new Int32Array(N);
  let sp = 0;
  const push = i => { if (!bg[i] && isBg(i)) { bg[i] = 1; stack[sp++] = i; } };
  for (let x = 0; x < W; x++) { push(x); push((H - 1) * W + x); }
  for (let y = 0; y < H; y++) { push(y * W); push(y * W + W - 1); }
  while (sp) {
    const i = stack[--sp], x = i % W, y = (i - x) / W;
    if (x > 0) push(i - 1);
    if (x < W - 1) push(i + 1);
    if (y > 0) push(i - W);
    if (y < H - 1) push(i + W);
  }
  // Erode one pixel so the white fringe around the edge doesn't survive, then soften.
  const hard = new Float32Array(N);
  for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
    const i = y * W + x;
    hard[i] = bg[i] || bg[i - 1] || bg[i + 1] || bg[i - W] || bg[i + W] ? 0 : 1;
  }
  const alpha = boxBlur(hard, W, H, Math.max(1, Math.round(W / 900)));

  // Connected garment pieces (the sock pack has three), largest first, then left to right.
  const comp = new Int32Array(N).fill(-1);
  const comps = [];
  for (let s = 0; s < N; s++) {
    if (!hard[s] || comp[s] !== -1) continue;
    const id = comps.length, c = { id, area: 0, x0: W, y0: H, x1: 0, y1: 0, sx: 0 };
    let top = 0;
    stack[top++] = s;
    comp[s] = id;
    while (top) {
      const i = stack[--top], x = i % W, y = (i - x) / W;
      c.area++; c.sx += x;
      if (x < c.x0) c.x0 = x; if (x > c.x1) c.x1 = x; if (y < c.y0) c.y0 = y; if (y > c.y1) c.y1 = y;
      for (const j of [i - 1, i + 1, i - W, i + W]) if (j >= 0 && j < N && hard[j] && comp[j] === -1) { comp[j] = id; stack[top++] = j; }
    }
    comps.push(c);
  }
  const pieces = comps.filter(c => c.area > N * 0.004).sort((a, b) => a.sx / a.area - b.sx / b.area);

  let x0 = W, y0 = H, x1 = 0, y1 = 0;
  for (const c of pieces) { x0 = Math.min(x0, c.x0); y0 = Math.min(y0, c.y0); x1 = Math.max(x1, c.x1); y1 = Math.max(y1, c.y1); }
  const vals = [];
  for (let i = 0; i < N; i += 7) if (hard[i]) vals.push(L[i]);
  vals.sort((a, b) => a - b);
  const Lref = vals[Math.floor(vals.length / 2)] || 128;
  return { W, H, L, alpha, comp, pieces, bbox: { x: x0, y: y0, w: x1 - x0, h: y1 - y0 }, Lref };
}

// ---- Print artwork, drawn with canvas so it uses the real brand typeface -------------------
function canvas(w, h) {
  const c = new OffscreenCanvas(Math.max(1, Math.round(w)), Math.max(1, Math.round(h)));
  return [c, c.getContext("2d")];
}
function setFont(ctx, size, weight, stretch) {
  ctx.font = `${weight} ${size}px Archivo`;
  ctx.fontStretch = stretch;
  ctx.textBaseline = "alphabetic";
}
function textBox(text, weight, stretch) {
  const [, ctx] = canvas(10, 10);
  setFont(ctx, 100, weight, stretch);
  const m = ctx.measureText(text);
  return { w: m.width, asc: m.actualBoundingBoxAscent, desc: m.actualBoundingBoxDescent };
}
function drawText(ctx, text, x, baseline, size, weight, stretch, colour) {
  setFont(ctx, size, weight, stretch);
  ctx.fillStyle = colour;
  ctx.fillText(text, x, baseline);
}
function drawBars(ctx, x, y, w, h) {
  const bw = w / 7;
  BAR_COLOURS.forEach((c, i) => { ctx.fillStyle = c; ctx.fillRect(x + i * bw, y, bw + 0.6, h); });
}

const PRINTS = {
  // Logo box: brand name reversed out of a solid box.
  osd({ brand, box, ink }, W) {
    const t = textBox(brand, 900, "expanded");
    const size = 100, padX = 46, padY = 26;
    const s = W / (t.w + padX * 2);
    const [c, ctx] = canvas(W, (t.asc + padY * 2) * s);
    ctx.fillStyle = box;
    ctx.fillRect(0, 0, c.width, c.height);
    drawText(ctx, brand, padX * s, (padY + t.asc) * s, size * s, 900, "expanded", ink);
    return c;
  },
  wordmark({ brand, ink }, W) {
    const t = textBox(brand, 900, "expanded");
    const s = W / t.w;
    const [c, ctx] = canvas(W, (t.asc + 4) * s);
    drawText(ctx, brand, 0, (t.asc + 2) * s, 100 * s, 900, "expanded", ink);
    return c;
  },
  bars(_, W) {
    const [c, ctx] = canvas(W, W * 0.737);
    drawBars(ctx, 0, 0, c.width, c.height);
    return c;
  },
  // Full test card with the logo box over it (hoodie back).
  barsOsd({ brand }, W) {
    const [c, ctx] = canvas(W, W * 0.705);
    drawBars(ctx, 0, 0, c.width, c.height);
    const box = PRINTS.osd({ brand, box: "#0A0A0A", ink: "#F5F5F5" }, W * 0.74);
    ctx.drawImage(box, (c.width - box.width) / 2, (c.height - box.height) / 2);
    return c;
  },
  ch00({ ink }, W) {
    const t = textBox("CH 00", 800, "condensed");
    const s = W / t.w;
    const textH = t.asc * s, gap = W * 0.06, stripH = W * 0.075;
    const [c, ctx] = canvas(W, textH + gap + stripH + 2);
    drawText(ctx, "CH 00", 0, textH, 100 * s, 800, "condensed", ink);
    drawBars(ctx, W * 0.115, textH + gap, W * 0.77, stripH);
    return c;
  },
  // Woven label: cream ground with the colour bars.
  tab(_, W) {
    const [c, ctx] = canvas(W, W * 0.46);
    ctx.fillStyle = "#ECEBE4";
    ctx.fillRect(0, 0, c.width, c.height);
    drawBars(ctx, W * 0.08, c.height * 0.16, W * 0.84, c.height * 0.68);
    return c;
  },
};

// ---- Compositing ----------------------------------------------------------------------------
function recolour(a, colours) {
  const { W, H, L, alpha, comp, pieces, Lref } = a;
  const out = new Float32Array(W * H * 3);
  const per = pieces.map((p, k) => colours[Math.min(k, colours.length - 1)]);
  const pieceIndex = new Map(pieces.map((p, k) => [p.id, k]));
  for (let i = 0; i < W * H; i++) {
    if (alpha[i] <= 0) continue;
    const k = pieceIndex.has(comp[i]) ? pieceIndex.get(comp[i]) : nearestPiece(a, i);
    const C = per[k];
    const lc = lum(C[0], C[1], C[2]) / 255;
    let s = L[i] / Lref;
    if (alpha[i] < 0.999) s = Math.min(s, 1);
    const d = L[i] - Lref;
    const kAdd = 0.55 * Math.pow(1 - lc, 1.5);
    for (let ch = 0; ch < 3; ch++) out[i * 3 + ch] = C[ch] * s + d * kAdd;
  }
  return out;
}
function nearestPiece(a, i) {
  const x = i % a.W;
  let best = 0, bd = Infinity;
  a.pieces.forEach((p, k) => { const d = Math.abs(p.sx / p.area - x); if (d < bd) { bd = d; best = k; } });
  return best;
}

function applyPrint(a, out, spec, opts) {
  const { W, H, L, Lref, bbox } = a;
  const px = spec.w * bbox.w;
  const art = PRINTS[spec.kind](opts, px);
  const [layer, lctx] = canvas(W, H);
  lctx.translate(bbox.x + spec.cx * bbox.w, bbox.y + spec.cy * bbox.h);
  lctx.rotate(((spec.rot || 0) * Math.PI) / 180);
  lctx.drawImage(art, -art.width / 2, -art.height / 2);
  const ld = lctx.getImageData(0, 0, W, H).data;
  const D = (spec.warp ?? 0.05) * (W / 960) * 6;
  const finish = spec.finish || "screen";
  for (let y = 2; y < H - 2; y++) for (let x = 2; x < W - 2; x++) {
    const i = y * W + x;
    if (a.alpha[i] <= 0) continue;
    // Shift the print along the fabric's slope so it bends over folds.
    const gx = (L[i + 1] - L[i - 1]) / 255, gy = (L[i + W] - L[i - W]) / 255;
    const sx = clamp(Math.round(x - gx * D * 10), 0, W - 1), sy = clamp(Math.round(y - gy * D * 10), 0, H - 1);
    const j = (sy * W + sx) * 4;
    let pa = ld[j + 3] / 255;
    if (pa <= 0) continue;
    const s = clamp(L[i] / Lref, 0.62, 1.14), d = L[i] - Lref;
    let ink = [ld[j] * s + d * 0.12, ld[j + 1] * s + d * 0.12, ld[j + 2] * s + d * 0.12];
    if (finish === "puff" || finish === "embroidery") {
      // Raised ink: light on the upper-left edge, shadow on the lower-right.
      const o = finish === "puff" ? 3 : 2;
      const e = (ld[(((sy - o) * W) + (sx - o)) * 4 + 3] - ld[(((sy + o) * W) + (sx + o)) * 4 + 3]) / 255;
      ink = ink.map(v => v - e * (finish === "puff" ? 38 : 26));
    }
    if (finish === "embroidery") {
      const stitch = ((x + y) % 4) < 2 ? 1 : 0.86;
      ink = ink.map(v => v * stitch);
    }
    if (finish === "woven") ink = ink.map(v => v * (y % 2 ? 0.94 : 1));
    if (finish === "screen") pa *= 0.96;
    for (let ch = 0; ch < 3; ch++) out[i * 3 + ch] = out[i * 3 + ch] * (1 - pa) + ink[ch] * pa;
  }
}

// Knitted colour-bar stripe across each sock, just under the ribbed cuff.
function sockBars(a, out, band) {
  const { W, L, Lref, comp, pieces, alpha } = a;
  const cols = BAR_COLOURS.map(hexToRgb);
  for (const p of pieces) {
    const yA = Math.round(p.y0 + band[0] * (p.y1 - p.y0)), yB = Math.round(p.y0 + band[1] * (p.y1 - p.y0));
    for (let y = yA; y <= yB; y++) {
      let xa = -1, xb = -1;
      for (let x = p.x0; x <= p.x1; x++) if (comp[y * W + x] === p.id) { if (xa < 0) xa = x; xb = x; }
      if (xa < 0) continue;
      for (let x = xa; x <= xb; x++) {
        const i = y * W + x;
        if (alpha[i] <= 0) continue;
        const c = cols[Math.min(6, Math.floor(((x - xa) / (xb - xa + 1)) * 7))];
        const s = clamp(L[i] / Lref, 0.55, 1.2), d = L[i] - Lref;
        for (let ch = 0; ch < 3; ch++) out[i * 3 + ch] = c[ch] * s + d * 0.15;
      }
    }
  }
}

async function frame(a, out, size) {
  const { W, H, alpha, bbox } = a;
  const [full, fctx] = canvas(W, H);
  const img = fctx.createImageData(W, H);
  for (let i = 0; i < W * H; i++) {
    img.data[i * 4] = clamp(out[i * 3], 0, 255);
    img.data[i * 4 + 1] = clamp(out[i * 3 + 1], 0, 255);
    img.data[i * 4 + 2] = clamp(out[i * 3 + 2], 0, 255);
    img.data[i * 4 + 3] = Math.round(clamp(alpha[i], 0, 1) * 255);
  }
  fctx.putImageData(img, 0, 0);
  const [OW, OH] = size;
  const [o, octx] = canvas(OW, OH);
  const fill = 0.86;
  const scale = Math.min((fill * OW) / bbox.w, (fill * OH) / bbox.h);
  const dx = (OW - bbox.w * scale) / 2 - bbox.x * scale, dy = (OH - bbox.h * scale) / 2 - bbox.y * scale;
  // Soft shadow under the garment.
  const [sh, shctx] = canvas(W, H);
  shctx.drawImage(full, 0, 0);
  shctx.globalCompositeOperation = "source-in";
  shctx.fillStyle = "#000";
  shctx.fillRect(0, 0, W, H);
  octx.filter = `blur(${Math.round(OW * 0.016)}px)`;
  octx.globalAlpha = 0.24;
  octx.drawImage(sh, dx, dy + OH * 0.018, W * scale, H * scale);
  octx.filter = "none";
  octx.globalAlpha = 1;
  octx.imageSmoothingQuality = "high";
  octx.drawImage(full, dx, dy, W * scale, H * scale);
  const blob = await o.convertToBlob({ type: "image/webp", quality: 0.86 });
  const buf = new Uint8Array(await blob.arrayBuffer());
  let bin = "";
  for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
  return btoa(bin);
}

const cache = new Map();
window.renderRecipe = async function (r) {
  await loadFonts();
  if (!cache.has(r.blankSrc)) cache.set(r.blankSrc, analyse(await loadImageData(r.blankSrc), r.bgThreshold || 232));
  const a = cache.get(r.blankSrc);
  const out = recolour(a, r.colours.map(hexToRgb));
  for (const p of r.prints || []) applyPrint(a, out, p, { brand: r.brand, box: p.box, ink: p.ink });
  if (r.sockBand) sockBars(a, out, r.sockBand);
  const files = [];
  for (const s of r.sizes) files.push({ suffix: s.suffix, b64: await frame(a, out, [s.w, s.h]) });
  return { files, bbox: a.bbox, pieces: a.pieces.length };
};

// Flat, full-size artwork for the printer (see build-print-files.cjs). With "knockout", the lettering
// is cut out of the logo box so the garment's own colour shows through, which suits any colour.
window.renderPrintFile = async function ({ kind, widthPx, brand, box, ink, knockout }) {
  await loadFonts();
  let art;
  if (kind === "osd" && knockout) {
    const t = textBox(brand, 900, "expanded");
    const padX = 46, padY = 26, s = widthPx / (t.w + padX * 2);
    const [c, ctx] = canvas(widthPx, (t.asc + padY * 2) * s);
    ctx.fillStyle = box;
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.globalCompositeOperation = "destination-out";
    drawText(ctx, brand, padX * s, (padY + t.asc) * s, 100 * s, 900, "expanded", "#000");
    art = c;
  } else if (kind === "stripe") {
    const [c, ctx] = canvas(widthPx, widthPx / 9);
    drawBars(ctx, 0, 0, c.width, c.height);
    art = c;
  } else {
    art = PRINTS[kind]({ brand, box, ink }, widthPx);
  }
  const blob = await art.convertToBlob({ type: "image/png" });
  const buf = new Uint8Array(await blob.arrayBuffer());
  let bin = "";
  for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
  return { b64: btoa(bin), w: art.width, h: art.height };
};
