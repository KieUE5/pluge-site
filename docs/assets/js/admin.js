// PLUGE admin page (/admin/): orders, messages, drop alert sign-ups, back-in-stock requests and reviews.
// Only accounts listed in the database's admins table get in; the database's rules enforce that, and
// this page just shows what they allow. It uses the database client that site.js sets up.
(() => {
  "use strict";
  const app = window.PLUGE && window.PLUGE.app;
  if (!app) return;
  const { esc, money, announce, byId } = app;
  const $ = sel => document.querySelector(sel);
  const gate = $("#admin-gate"), main = $("#admin-app"), panel = $("#admin-panel"), who = $("#admin-who");
  const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const when = iso => { const d = new Date(iso); return isNaN(d) ? "" : `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}, ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`; };
  const say = text => { $("#admin-msg").textContent = text; };
  let db = null, overview = {}, tab = "overview", filters = { messages: "new", reviews: "pending", restock: "waiting" };

  const TABS = [
    ["overview", "Overview"],
    ["orders", "Orders", "orders"],
    ["messages", "Messages", "new_messages"],
    ["alerts", "Drop alerts", "drop_alerts"],
    ["restock", "Back in stock", "restock_alerts"],
    ["reviews", "Reviews", "pending_reviews"],
  ];

  function showGate(html) {
    main.hidden = true;
    gate.hidden = false;
    gate.innerHTML = html;
  }

  let current = null;
  async function start(user) {
    // Runs once per signed-in person (sign-in events and the first check can both arrive).
    const key = user ? user.id : "signed-out";
    if (key === current) return;
    current = key;
    db = await app.db();
    if (!db) {
      who.textContent = "The database isn't connected yet.";
      showGate(`<p>This page works once the shop's Supabase database is connected (see the README, step 3). Then sign in here with the shop's email address.</p>`);
      return;
    }
    if (!user) {
      who.textContent = "Signed out.";
      showGate(`<p>Sign in with the shop's account to see orders, messages, sign-ups and reviews.</p><button class="btn primary" type="button" id="admin-signin">Sign in</button>`);
      $("#admin-signin").addEventListener("click", () => app.openAccount());
      return;
    }
    who.textContent = `Signed in as ${user.email}.`;
    const { data: isAdmin, error } = await db.rpc("is_admin");
    if (error || isAdmin !== true) {
      showGate(`<p>${esc(user.email)} isn't an admin. Sign out and sign in with the shop's email address, or add this address to the <code>admins</code> table in Supabase.</p>`);
      return;
    }
    gate.hidden = true;
    main.hidden = false;
    await loadOverview();
    renderTabs();
    show(tab);
  }

  async function loadOverview() {
    const { data, error } = await db.rpc("admin_overview");
    if (error) { say(`Couldn't load the figures: ${error.message}`); return; }
    overview = data || {};
  }
  function renderTabs() {
    $("#admin-tabs").innerHTML = TABS.map(([id, label, count]) => {
      const n = count && id !== "orders" && id !== "alerts" ? overview[count] || 0 : 0;
      return `<button type="button" role="tab" id="tab-${id}" aria-controls="admin-panel" aria-selected="${id === tab}" tabindex="${id === tab ? 0 : -1}" data-tab="${id}">${label}<span class="n" aria-label="${n ? `${n} waiting` : ""}">${n || ""}</span></button>`;
    }).join("");
  }
  $("#admin-tabs").addEventListener("click", e => { const b = e.target.closest("[data-tab]"); if (b) show(b.dataset.tab, true); });
  $("#admin-tabs").addEventListener("keydown", e => {
    const ids = TABS.map(t => t[0]), i = ids.indexOf(tab);
    const to = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: ids.length - 1 }[e.key];
    if (to === undefined) return;
    e.preventDefault();
    show(ids[(to + ids.length) % ids.length], false, true);
  });

  async function show(id, focusPanel, focusTab) {
    tab = id;
    renderTabs();
    panel.setAttribute("aria-labelledby", `tab-${id}`);
    say("");
    panel.innerHTML = `<p class="admin-empty">Loading…</p>`;
    await VIEWS[id]();
    panel.insertAdjacentHTML("afterbegin", `<h2 class="vh">${TABS.find(t => t[0] === id)[1]}</h2>`);
    if (focusTab) $(`#tab-${id}`).focus();
    else if (focusPanel) panel.focus();
  }
  async function refresh() { await loadOverview(); await show(tab); }

  // Downloads rows as a spreadsheet file. Cells that start like a formula are made safe for Excel.
  function downloadCsv(name, header, rows) {
    const cell = v => { let t = v == null ? "" : String(v); if (/^[=+\-@]/.test(t)) t = `'${t}`; return `"${t.replace(/"/g, '""')}"`; };
    const csv = [header, ...rows].map(r => r.map(cell).join(",")).join("\r\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([`﻿${csv}`], { type: "text/csv;charset=utf-8" }));
    a.download = `pluge-${name}-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  }
  const filterHtml = (key, options) => `<div class="admin-filter" role="group" aria-label="Show">${options.map(([v, label]) =>
    `<button type="button" data-filter="${key}" data-value="${v}" aria-pressed="${filters[key] === v}">${label}</button>`).join("")}</div>`;
  panel.addEventListener("click", e => {
    const f = e.target.closest("[data-filter]");
    if (f) { filters[f.dataset.filter] = f.dataset.value; show(tab); return; }
    const b = e.target.closest("[data-act]");
    if (b && ACTIONS[b.dataset.act]) ACTIONS[b.dataset.act](b);
  });
  const productName = id => (byId[id] && byId[id].name) || id;

  const VIEWS = {
    async overview() {
      const o = overview;
      const card = (n, label) => `<li><b>${n}</b><span>${label}</span></li>`;
      panel.innerHTML = `<ul class="admin-cards">
        ${card(o.orders || 0, "Orders")}
        ${card(money(Number(o.sales || 0)), "Sales, not cancelled")}
        ${card(o.accounts || 0, "Customer accounts")}
        ${card(o.drop_alerts || 0, "Drop alert sign-ups")}
        ${card(o.new_messages || 0, "Messages to answer")}
        ${card(o.restock_alerts || 0, "Back-in-stock requests")}
        ${card(o.pending_reviews || 0, "Reviews to check")}
      </ul>`;
    },
    async orders() {
      const { data, error } = await db.from("orders").select("order_number,created_at,email,total,currency,financial_status,fulfillment_status,cancelled_at,status_url,items").order("created_at", { ascending: false }).limit(200);
      if (error) { panel.innerHTML = `<p class="admin-empty">Couldn't load orders: ${esc(error.message)}</p>`; return; }
      if (!data.length) { panel.innerHTML = `<p class="admin-empty">No orders yet. They appear here once Shopify sends them (README, step 3.7).</p>`; return; }
      const status = o => o.cancelled_at ? "Cancelled" : o.fulfillment_status === "fulfilled" ? "Sent" : o.fulfillment_status === "partial" ? "Partly sent" : "Being made";
      panel.innerHTML = `<div class="admin-bar"><p>Latest ${data.length} orders. Manage them in Shopify and Printful.</p></div>
        <div class="admin-scroll"><table class="admin-table"><thead><tr><th scope="col">Order</th><th scope="col">Date</th><th scope="col">Email</th><th scope="col">Pieces</th><th scope="col">Total</th><th scope="col">Status</th></tr></thead><tbody>
        ${data.map(o => `<tr><th scope="row">${esc(o.order_number || "")}</th><td>${when(o.created_at)}</td><td>${esc(o.email)}</td>
          <td>${(Array.isArray(o.items) ? o.items : []).map(i => `${esc(i.title)}${i.variant ? ` (${esc(i.variant)})` : ""}${i.qty > 1 ? ` × ${i.qty}` : ""}`).join("<br>")}</td>
          <td class="num">${o.total != null ? money(Number(o.total)) : ""}</td><td>${status(o)}</td></tr>`).join("")}
        </tbody></table></div>`;
    },
    async messages() {
      let q = db.from("contact_messages").select("id,name,email,topic,order_ref,message,created_at,handled_at").order("created_at", { ascending: false }).limit(200);
      if (filters.messages === "new") q = q.is("handled_at", null);
      const { data, error } = await q;
      if (error) { panel.innerHTML = `<p class="admin-empty">Couldn't load messages: ${esc(error.message)}</p>`; return; }
      panel.innerHTML = `<div class="admin-bar">${filterHtml("messages", [["new", "To answer"], ["all", "All"]])}<p>Reply by email, then mark the message answered.</p></div>
        ${data.length ? `<ul class="admin-items">${data.map(m => `<li class="admin-item${m.handled_at ? "" : " new"}">
          <h3>${esc(m.topic)}${m.order_ref ? ` · order ${esc(m.order_ref)}` : ""}</h3>
          <p class="meta"><span>${esc(m.name)}</span><span>${esc(m.email)}</span><span>${when(m.created_at)}</span>${m.handled_at ? `<span>Answered</span>` : ""}</p>
          <p class="text">${esc(m.message)}</p>
          <div class="admin-actions">
            <a class="btn small" href="mailto:${esc(m.email)}?subject=${encodeURIComponent(`Re: ${m.topic}`)}">Reply by email</a>
            <button class="btn small" type="button" data-act="handled" data-id="${m.id}" data-on="${m.handled_at ? "" : "1"}">${m.handled_at ? "Mark as not answered" : "Mark as answered"}</button>
            <button class="btn small danger" type="button" data-act="delete" data-table="contact_messages" data-id="${m.id}">Delete<span class="vh"> message from ${esc(m.name)}</span></button>
          </div></li>`).join("")}</ul>` : `<p class="admin-empty">${filters.messages === "new" ? "Nothing to answer." : "No messages yet."}</p>`}`;
    },
    async alerts() {
      const { data, error } = await db.from("drop_alerts").select("id,email,list,consent,created_at").order("created_at", { ascending: false }).limit(5000);
      if (error) { panel.innerHTML = `<p class="admin-empty">Couldn't load sign-ups: ${esc(error.message)}</p>`; return; }
      panel._rows = data;
      panel.innerHTML = `<div class="admin-bar"><p>${data.length} ${data.length === 1 ? "person" : "people"} asked for drop alerts. Download the list and import it into your email tool, which adds the unsubscribe link every email needs.</p>
        ${data.length ? `<button class="btn small" type="button" data-act="csv-alerts">Download as a spreadsheet</button>` : ""}</div>
        ${data.length ? `<div class="admin-scroll"><table class="admin-table"><thead><tr><th scope="col">Email</th><th scope="col">Signed up</th><th scope="col">Form</th><th scope="col"><span class="vh">Remove</span></th></tr></thead><tbody>
        ${data.map(a => `<tr><th scope="row">${esc(a.email)}</th><td>${when(a.created_at)}</td><td>${esc(a.list)}</td><td><button class="btn small danger" type="button" data-act="delete" data-table="drop_alerts" data-id="${a.id}">Remove<span class="vh"> ${esc(a.email)}</span></button></td></tr>`).join("")}
        </tbody></table></div>` : `<p class="admin-empty">No sign-ups yet.</p>`}`;
    },
    async restock() {
      let q = db.from("restock_alerts").select("id,email,product_id,colour,size,created_at,notified_at").order("created_at", { ascending: false }).limit(2000);
      if (filters.restock === "waiting") q = q.is("notified_at", null);
      const { data, error } = await q;
      if (error) { panel.innerHTML = `<p class="admin-empty">Couldn't load requests: ${esc(error.message)}</p>`; return; }
      panel._rows = data;
      const groups = new Map();
      for (const r of data) {
        const k = `${r.product_id}|${r.colour}|${r.size}`;
        if (!groups.has(k)) groups.set(k, []);
        groups.get(k).push(r);
      }
      panel.innerHTML = `<div class="admin-bar">${filterHtml("restock", [["waiting", "Waiting"], ["all", "All"]])}${data.length ? `<button class="btn small" type="button" data-act="csv-restock">Download as a spreadsheet</button>` : ""}</div>
        ${groups.size ? `<ul class="admin-items">${[...groups].map(([k, rows]) => {
          const [id, colour, size] = k.split("|"), waiting = rows.filter(r => !r.notified_at);
          return `<li class="admin-item${waiting.length ? " new" : ""}"><h3>${esc(productName(id))}, ${esc(colour)}, ${esc(size)}</h3>
            <p class="meta"><span>${rows.length} ${rows.length === 1 ? "request" : "requests"}</span>${waiting.length ? `<span>${waiting.length} waiting</span>` : "<span>All emailed</span>"}</p>
            <p class="text">${rows.map(r => esc(r.email)).join(", ")}</p>
            ${waiting.length ? `<div class="admin-actions"><button class="btn small" type="button" data-act="notified" data-ids="${waiting.map(r => r.id).join(",")}">Mark as emailed<span class="vh">: ${esc(productName(id))} ${esc(size)}</span></button></div>` : ""}</li>`;
        }).join("")}</ul>` : `<p class="admin-empty">${filters.restock === "waiting" ? "Nobody's waiting for a size." : "No requests yet."}</p>`}`;
    },
    async reviews() {
      let q = db.from("reviews").select("id,product_id,product_name,author,rating,title,body,size,fit,verified,status,created_at").order("created_at", { ascending: false }).limit(500);
      if (filters.reviews !== "all") q = q.eq("status", filters.reviews);
      const { data, error } = await q;
      if (error) { panel.innerHTML = `<p class="admin-empty">Couldn't load reviews: ${esc(error.message)}</p>`; return; }
      const FIT = { small: "Runs small", true: "True to size", large: "Runs large" };
      panel.innerHTML = `<div class="admin-bar">${filterHtml("reviews", [["pending", "To check"], ["approved", "Approved"], ["rejected", "Rejected"], ["all", "All"]])}<p>Approve every genuine review, good or bad. Only reject one that breaks the review rules in the terms: by law, you can't hide reviews for being negative.</p></div>
        ${data.length ? `<ul class="admin-items">${data.map(r => `<li class="admin-item${r.status === "pending" ? " new" : ""}">
          <h3>${esc(r.product_name)}: ${"★".repeat(r.rating)}${"☆".repeat(5 - r.rating)}<span class="vh"> ${r.rating} out of 5</span>${r.title ? ` · ${esc(r.title)}` : ""}</h3>
          <p class="meta"><span>${esc(r.author)}</span>${r.verified ? "<span>Verified buyer</span>" : "<span>No matching order</span>"}${r.size ? `<span>Size ${esc(r.size)}</span>` : ""}${r.fit ? `<span>${FIT[r.fit]}</span>` : ""}<span>${when(r.created_at)}</span><span>${esc(r.status)}</span></p>
          <p class="text">${esc(r.body)}</p>
          <div class="admin-actions">
            ${r.status !== "approved" ? `<button class="btn small" type="button" data-act="review" data-status="approved" data-id="${r.id}">Approve<span class="vh"> review by ${esc(r.author)}</span></button>` : ""}
            ${r.status !== "rejected" ? `<button class="btn small" type="button" data-act="review" data-status="rejected" data-id="${r.id}">Reject<span class="vh"> review by ${esc(r.author)}</span></button>` : ""}
            <button class="btn small danger" type="button" data-act="delete" data-table="reviews" data-id="${r.id}">Delete<span class="vh"> review by ${esc(r.author)}</span></button>
          </div></li>`).join("")}</ul>` : `<p class="admin-empty">${filters.reviews === "pending" ? "No reviews waiting." : "No reviews here."}</p>`}`;
    },
  };

  const ACTIONS = {
    async handled(b) {
      const { error } = await db.from("contact_messages").update({ handled_at: b.dataset.on ? new Date().toISOString() : null }).eq("id", b.dataset.id);
      if (error) return say(`That didn't save: ${error.message}`);
      announce(b.dataset.on ? "Marked as answered." : "Marked as not answered.");
      refresh();
    },
    async notified(b) {
      const ids = b.dataset.ids.split(",").map(Number);
      const { error } = await db.from("restock_alerts").update({ notified_at: new Date().toISOString() }).in("id", ids);
      if (error) return say(`That didn't save: ${error.message}`);
      announce("Marked as emailed.");
      refresh();
    },
    async review(b) {
      const { error } = await db.from("reviews").update({ status: b.dataset.status }).eq("id", b.dataset.id);
      if (error) return say(`That didn't save: ${error.message}`);
      announce(b.dataset.status === "approved" ? "Review approved. It's on the site now." : "Review rejected.");
      refresh();
    },
    async delete(b) {
      if (!window.confirm("Delete this for good? This can't be undone.")) return;
      const { error } = await db.from(b.dataset.table).delete().eq("id", b.dataset.id);
      if (error) return say(`That didn't delete: ${error.message}`);
      announce("Deleted.");
      refresh();
    },
    "csv-alerts"() {
      downloadCsv("drop-alerts", ["Email", "Signed up", "Form", "Agreed to"], panel._rows.map(a => [a.email, a.created_at, a.list, a.consent]));
    },
    "csv-restock"() {
      downloadCsv("back-in-stock", ["Email", "Product", "Colour", "Size", "Asked", "Emailed"], panel._rows.map(r => [r.email, productName(r.product_id), r.colour, r.size, r.created_at, r.notified_at || ""]));
    },
  };

  app.authKnown.then(start);
  document.addEventListener("pluge:auth", e => start(e.detail.user));
})();
