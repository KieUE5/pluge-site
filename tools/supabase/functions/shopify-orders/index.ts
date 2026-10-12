// Copies Shopify orders into the accounts database so shoppers see them under "Your orders".
// Shopify calls this for "Order creation" and "Order update" webhooks (see README, "Customer accounts").
//
// Deploy in Supabase: Edge Functions > Deploy a new function > Via editor, name it "shopify-orders",
// paste this file, deploy, then turn off "Verify JWT" for it (Shopify signs its own requests instead).
// Add the secret SHOPIFY_WEBHOOK_SECRET under Edge Functions > Secrets. SUPABASE_URL and
// SUPABASE_SERVICE_ROLE_KEY are provided automatically.
import { createClient } from "npm:@supabase/supabase-js@2.117.2";

const secret = Deno.env.get("SHOPIFY_WEBHOOK_SECRET") ?? "";
const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

// Shopify signs the raw body with HMAC-SHA256 and sends it base64-encoded.
async function signedByShopify(body: string, signature: string | null): Promise<boolean> {
  if (!secret || !signature) return false;
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body)));
  const expected = btoa(String.fromCharCode(...mac));
  if (expected.length !== signature.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ signature.charCodeAt(i);
  return diff === 0;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });
  const body = await req.text();
  if (!(await signedByShopify(body, req.headers.get("x-shopify-hmac-sha256")))) return new Response("Unauthorized", { status: 401 });

  const o = JSON.parse(body);
  const email = o.email || o.contact_email || o.customer?.email;
  if (!o.id || !email) return new Response("Skipped: no order id or email");

  const { error } = await db.from("orders").upsert({
    id: String(o.id),
    email,
    order_number: o.name ?? String(o.order_number ?? ""),
    created_at: o.created_at,
    total: Number(o.current_total_price ?? o.total_price ?? 0),
    currency: o.currency ?? "GBP",
    financial_status: o.financial_status ?? null,
    fulfillment_status: o.fulfillment_status ?? null,
    cancelled_at: o.cancelled_at ?? null,
    status_url: o.order_status_url ?? null,
    items: (o.line_items ?? []).map((l: Record<string, unknown>) => ({ title: l.title, variant: l.variant_title, qty: l.quantity, price: l.price })),
    updated_at: new Date().toISOString(),
  });
  if (error) return new Response(`Couldn't save the order: ${error.message}`, { status: 500 });
  return new Response("ok");
});
