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

-- Each shopper's usual sizes ({"tops": "M", "bottoms": "L", "socks": "M"}), picked for them on product pages.
alter table public.shopper_state add column if not exists sizes jsonb not null default '{}'::jsonb;

-- ---- The shop's own team ------------------------------------------------------------------------
-- Accounts whose confirmed email is listed here can open the admin page (/admin/). The shop email is
-- added below; sign up on the site with it and confirm it to become an admin. To add someone else:
--   insert into public.admins (email) values ('their.email@example.com');
create table if not exists public.admins (
  email text primary key check (email = lower(email))
);
alter table public.admins enable row level security;
-- No rules on purpose: nobody can read or change this table from the website.
insert into public.admins (email) values ('pluge.shop@outlook.com') on conflict do nothing;

create or replace function public.is_admin() returns boolean
  language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from public.admins a where a.email = public.my_confirmed_email())
$$;
revoke all on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

drop policy if exists "Admins read all orders" on public.orders;
create policy "Admins read all orders" on public.orders
  for select to authenticated using ((select public.is_admin()));

-- ---- Sign-ups and messages from the website ----------------------------------------------------
-- Anyone can add a row (the website does this), but only admins can read, change or delete them.
-- Visitors can only fill in the columns listed in each "grant insert", so they can't backdate a row
-- or mark it as handled.

-- Drop alert sign-ups. "consent" records the exact wording they agreed to.
create table if not exists public.drop_alerts (
  id bigint generated always as identity primary key,
  email text not null check (length(email) <= 254 and email ~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'),
  list text not null default 'drops' check (list ~ '^[a-z0-9-]{1,40}$'),
  consent text not null check (length(consent) between 10 and 300),
  created_at timestamptz not null default now()
);
create unique index if not exists drop_alerts_email_list on public.drop_alerts (lower(email), list);

-- "Email me when it's back" requests for a sold-out size.
create table if not exists public.restock_alerts (
  id bigint generated always as identity primary key,
  email text not null check (length(email) <= 254 and email ~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'),
  product_id text not null check (product_id ~ '^[a-z0-9-]{1,60}$'),
  colour text not null check (colour ~ '^[a-z0-9-]{1,30}$'),
  size text not null check (length(size) between 1 and 20),
  created_at timestamptz not null default now(),
  notified_at timestamptz
);
create unique index if not exists restock_alerts_once on public.restock_alerts (lower(email), product_id, colour, size);

-- Messages sent with the contact form.
create table if not exists public.contact_messages (
  id bigint generated always as identity primary key,
  name text not null check (length(name) between 1 and 100),
  email text not null check (length(email) <= 254 and email ~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'),
  topic text not null check (length(topic) between 1 and 60),
  order_ref text check (length(order_ref) <= 40),
  message text not null check (length(message) between 2 and 4000),
  created_at timestamptz not null default now(),
  handled_at timestamptz
);

-- A brake on floods: at most 5 messages, and 20 back-in-stock requests, an hour from one email address.
create or replace function public.limit_per_email() returns trigger
  language plpgsql security definer set search_path = ''
as $$
declare
  recent int;
  most int := case tg_table_name when 'contact_messages' then 5 else 20 end;
begin
  execute format('select count(*) from public.%I where lower(email) = lower($1) and created_at > now() - interval ''1 hour''', tg_table_name)
    into recent using new.email;
  if recent >= most then
    raise exception 'Too many requests from this email address. Try again in an hour.' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
drop trigger if exists contact_messages_limit on public.contact_messages;
create trigger contact_messages_limit before insert on public.contact_messages for each row execute function public.limit_per_email();
drop trigger if exists restock_alerts_limit on public.restock_alerts;
create trigger restock_alerts_limit before insert on public.restock_alerts for each row execute function public.limit_per_email();

do $$
declare t text;
begin
  foreach t in array array['drop_alerts', 'restock_alerts', 'contact_messages'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "Anyone can add" on public.%I', t);
    execute format('drop policy if exists "Admins read" on public.%I', t);
    execute format('drop policy if exists "Admins update" on public.%I', t);
    execute format('drop policy if exists "Admins delete" on public.%I', t);
    execute format('create policy "Anyone can add" on public.%I for insert to anon, authenticated with check (true)', t);
    execute format('create policy "Admins read" on public.%I for select to authenticated using ((select public.is_admin()))', t);
    execute format('create policy "Admins update" on public.%I for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()))', t);
    execute format('create policy "Admins delete" on public.%I for delete to authenticated using ((select public.is_admin()))', t);
    execute format('revoke insert, update on public.%I from anon, authenticated', t);
  end loop;
end;
$$;
grant insert (email, list, consent) on public.drop_alerts to anon, authenticated;
grant insert (email, product_id, colour, size) on public.restock_alerts to anon, authenticated;
grant update (notified_at) on public.restock_alerts to authenticated;
grant insert (name, email, topic, order_ref, message) on public.contact_messages to anon, authenticated;
grant update (handled_at) on public.contact_messages to authenticated;

-- ---- Product reviews ----------------------------------------------------------------------------
-- Signed-in shoppers with a confirmed email write one review per product. Reviews wait as "pending"
-- until an admin approves them on the admin page; only approved ones are shown on the site.
create table if not exists public.reviews (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  product_id text not null check (product_id ~ '^[a-z0-9-]{1,60}$'),
  product_name text not null check (length(product_name) between 1 and 100),
  author text not null check (length(author) between 1 and 40),
  rating smallint not null check (rating between 1 and 5),
  title text check (length(title) <= 80),
  body text not null check (length(body) between 10 and 2000),
  size text check (length(size) <= 20),
  fit text check (fit in ('small', 'true', 'large')),
  verified boolean not null default false, -- set by the database when the reviewer has ordered this piece
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now(),
  unique (user_id, product_id)
);
create index if not exists reviews_product_idx on public.reviews (product_id, status);
alter table public.reviews enable row level security;

-- Whatever the website sends, a new review belongs to the person signed in, starts as pending, and is
-- "verified" only if one of their orders has a piece with this name.
create or replace function public.review_defaults() returns trigger
  language plpgsql security definer set search_path = ''
as $$
begin
  new.user_id := auth.uid();
  new.status := 'pending';
  new.created_at := now();
  new.verified := exists (
    select 1 from public.orders o, jsonb_array_elements(o.items) i
    where lower(o.email) = public.my_confirmed_email() and o.cancelled_at is null
      and lower(i ->> 'title') = lower(new.product_name)
  );
  return new;
end;
$$;
drop trigger if exists reviews_defaults on public.reviews;
create trigger reviews_defaults before insert on public.reviews for each row execute function public.review_defaults();

drop policy if exists "Anyone reads approved reviews" on public.reviews;
drop policy if exists "Shoppers read their own reviews" on public.reviews;
drop policy if exists "Shoppers write reviews" on public.reviews;
drop policy if exists "Shoppers delete their own reviews" on public.reviews;
drop policy if exists "Admins read reviews" on public.reviews;
drop policy if exists "Admins moderate reviews" on public.reviews;
drop policy if exists "Admins delete reviews" on public.reviews;
create policy "Anyone reads approved reviews" on public.reviews
  for select to anon, authenticated using (status = 'approved');
create policy "Shoppers read their own reviews" on public.reviews
  for select to authenticated using (user_id = (select auth.uid()));
create policy "Shoppers write reviews" on public.reviews
  for insert to authenticated with check (user_id = (select auth.uid()) and (select public.my_confirmed_email()) is not null);
create policy "Shoppers delete their own reviews" on public.reviews
  for delete to authenticated using (user_id = (select auth.uid()));
create policy "Admins read reviews" on public.reviews
  for select to authenticated using ((select public.is_admin()));
create policy "Admins moderate reviews" on public.reviews
  for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "Admins delete reviews" on public.reviews
  for delete to authenticated using ((select public.is_admin()));
revoke insert, update on public.reviews from anon, authenticated;
grant insert (product_id, product_name, author, rating, title, body, size, fit) on public.reviews to authenticated;
grant update (status) on public.reviews to authenticated;

-- Star ratings and fit votes per product, from approved reviews, for product cards and pages.
create or replace view public.review_stats with (security_invoker = true) as
  select product_id,
    count(*)::int as count,
    round(avg(rating), 2)::float as average,
    count(*) filter (where fit = 'small')::int as fit_small,
    count(*) filter (where fit = 'true')::int as fit_true,
    count(*) filter (where fit = 'large')::int as fit_large
  from public.reviews
  where status = 'approved'
  group by product_id;
grant select on public.review_stats to anon, authenticated;

-- ---- Admin page figures -------------------------------------------------------------------------
create or replace function public.admin_overview() returns json
  language plpgsql stable security definer set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Only admins can see this.' using errcode = '42501';
  end if;
  return json_build_object(
    'accounts', (select count(*) from auth.users where email_confirmed_at is not null),
    'drop_alerts', (select count(*) from public.drop_alerts),
    'restock_alerts', (select count(*) from public.restock_alerts where notified_at is null),
    'new_messages', (select count(*) from public.contact_messages where handled_at is null),
    'pending_reviews', (select count(*) from public.reviews where status = 'pending'),
    'orders', (select count(*) from public.orders where cancelled_at is null),
    'sales', (select coalesce(sum(total), 0) from public.orders where cancelled_at is null)
  );
end;
$$;
revoke all on function public.admin_overview() from public, anon;
grant execute on function public.admin_overview() to authenticated;
