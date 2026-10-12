-- PLUGE customer accounts: run this once in Supabase (SQL Editor > New query > paste > Run).
-- It's safe to run again: it only creates what's missing and replaces the rules and functions.

-- Each shopper's bag, saved pieces and recently viewed, one row per account.
create table if not exists public.shopper_state (
  user_id uuid primary key references auth.users (id) on delete cascade,
  bag jsonb not null default '[]'::jsonb,
  saved jsonb not null default '[]'::jsonb,
  recent jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);
alter table public.shopper_state enable row level security;
drop policy if exists "Shoppers read their own state" on public.shopper_state;
drop policy if exists "Shoppers add their own state" on public.shopper_state;
drop policy if exists "Shoppers change their own state" on public.shopper_state;
create policy "Shoppers read their own state" on public.shopper_state
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "Shoppers add their own state" on public.shopper_state
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Shoppers change their own state" on public.shopper_state
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- Orders, copied from Shopify by the shopify-orders function. Matched to accounts by email address.
create table if not exists public.orders (
  id text primary key,                -- Shopify's order id
  email text not null,
  order_number text,
  created_at timestamptz not null,
  total numeric(10, 2),
  currency text,
  financial_status text,
  fulfillment_status text,
  cancelled_at timestamptz,
  status_url text,
  items jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);
create index if not exists orders_email_idx on public.orders (lower(email));
alter table public.orders enable row level security;

-- The signed-in shopper's email, but only once they've confirmed it, so nobody can see orders for an
-- address they don't own.
create or replace function public.my_confirmed_email() returns text
  language sql stable security definer set search_path = ''
as $$
  select lower(email) from auth.users where id = auth.uid() and email_confirmed_at is not null
$$;
revoke all on function public.my_confirmed_email() from public, anon;
grant execute on function public.my_confirmed_email() to authenticated;

drop policy if exists "Shoppers read their own orders" on public.orders;
create policy "Shoppers read their own orders" on public.orders
  for select to authenticated using (lower(email) = (select public.my_confirmed_email()));
-- No insert or update rules: only the shopify-orders function writes orders, with the service key.

-- Lets a shopper delete their own account (and, through "on delete cascade", their saved state).
create or replace function public.delete_my_account() returns void
  language plpgsql security definer set search_path = ''
as $$
begin
  delete from auth.users where id = auth.uid();
end;
$$;
revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
