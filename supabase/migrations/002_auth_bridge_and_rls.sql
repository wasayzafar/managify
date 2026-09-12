-- Phase 3 of the multi-branch plan: turns on real, server-enforced access
-- control. Run this in the Supabase SQL Editor AFTER you've enabled Firebase
-- as a Third-Party Auth provider (Dashboard -> Authentication -> Sign In /
-- Providers -> Third Party Auth -> Add provider -> Firebase -> paste your
-- Firebase Project ID: managify608). Until that's done, auth.jwt() is empty
-- for every request and these policies would block everyone.
--
-- Every existing `user_id` column already means "which store this belongs
-- to" (the owner's Firebase UID). Nothing here changes what any column
-- means or migrates any data — it only adds server-side checks so a client
-- can no longer read/write rows outside what it's actually allowed to,
-- something that was previously enforced only by trusting the app's own
-- queries (RLS was off).

-- ── Helper functions (SECURITY DEFINER: they read staff_members/
--    managify_admins directly, bypassing RLS on those tables themselves --
--    required, or every policy that calls them would recurse into itself) ──

create or replace function current_store_id() returns text
language sql stable security definer set search_path = public as $$
  select coalesce(
    (select store_id from staff_members where staff_uid = (auth.jwt()->>'sub') and is_active = true limit 1),
    (auth.jwt()->>'sub')
  )
$$;

create or replace function current_role_name() returns text
language sql stable security definer set search_path = public as $$
  select coalesce(
    (select role from staff_members where staff_uid = (auth.jwt()->>'sub') and is_active = true limit 1),
    'owner'
  )
$$;

-- NULL for an owner (sees every branch); the assigned branch id for staff/manager.
create or replace function current_branch_id() returns uuid
language sql stable security definer set search_path = public as $$
  select branch_id from staff_members where staff_uid = (auth.jwt()->>'sub') and is_active = true limit 1
$$;

-- A store's oldest branch -- legacy rows with a NULL branch_id belong here
-- (mirrors matchesBranch() in src/utils/branchFilter.ts).
create or replace function main_branch_id(sid text) returns uuid
language sql stable security definer set search_path = public as $$
  select id from branches where store_id = sid order by created_at asc limit 1
$$;

create or replace function is_managify_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists(select 1 from managify_admins where email = (auth.jwt()->>'email'))
$$;

-- Shape shared by every branch-aware table's USING/CHECK clause.
create or replace function branch_visible(row_branch_id uuid, row_store_id text) returns boolean
language sql stable as $$
  select row_store_id = current_store_id() and (
    current_branch_id() is null
    or row_branch_id = current_branch_id()
    or (row_branch_id is null and current_branch_id() = main_branch_id(current_store_id()))
  )
$$;

-- ── Store-scoped only (shared across every branch of a store) ───────────

alter table items       enable row level security;
alter table employees   enable row level security;
alter table suppliers   enable row level security;
alter table store_info  enable row level security;
alter table imeis       enable row level security;

create policy items_all      on items      for all using (user_id = current_store_id()) with check (user_id = current_store_id());
create policy employees_all  on employees  for all using (user_id = current_store_id()) with check (user_id = current_store_id());
create policy suppliers_all  on suppliers  for all using (user_id = current_store_id()) with check (user_id = current_store_id());
create policy store_info_all on store_info for all using (user_id = current_store_id()) with check (user_id = current_store_id());
create policy imeis_all      on imeis      for all using (user_id = current_store_id()) with check (user_id = current_store_id());

-- ── Store + branch scoped (transactions) ─────────────────────────────────

alter table purchases enable row level security;
alter table sales     enable row level security;
alter table expenses  enable row level security;
alter table assets    enable row level security;
alter table invoices  enable row level security;

create policy purchases_all on purchases for all using (branch_visible(branch_id, user_id)) with check (branch_visible(branch_id, user_id));
create policy sales_all     on sales     for all using (branch_visible(branch_id, user_id)) with check (branch_visible(branch_id, user_id));
create policy expenses_all  on expenses  for all using (branch_visible(branch_id, user_id)) with check (branch_visible(branch_id, user_id));
create policy assets_all    on assets    for all using (branch_visible(branch_id, user_id)) with check (branch_visible(branch_id, user_id));
create policy invoices_all  on invoices  for all using (branch_visible(branch_id, user_id)) with check (branch_visible(branch_id, user_id));

-- ── Branches ──────────────────────────────────────────────────────────────
-- Everyone at the store can read the branch list; only the owner manages it.

alter table branches enable row level security;

create policy branches_select on branches for select using (store_id = current_store_id());
create policy branches_owner_insert on branches for insert with check (store_id = current_store_id() and current_role_name() = 'owner');
create policy branches_owner_update on branches for update using (store_id = current_store_id() and current_role_name() = 'owner') with check (store_id = current_store_id() and current_role_name() = 'owner');
create policy branches_owner_delete on branches for delete using (store_id = current_store_id() and current_role_name() = 'owner');

-- ── Staff members ─────────────────────────────────────────────────────────
-- A staff member can always read their OWN row (needed to resolve who they
-- are on login, before we know their role). The owner can read/write every
-- row for their store.

alter table staff_members enable row level security;

create policy staff_members_self_select on staff_members for select using (staff_uid = (auth.jwt()->>'sub'));
create policy staff_members_owner_select on staff_members for select using (store_id = current_store_id() and current_role_name() = 'owner');
create policy staff_members_owner_insert on staff_members for insert with check (store_id = current_store_id() and current_role_name() = 'owner');
create policy staff_members_owner_update on staff_members for update using (store_id = current_store_id() and current_role_name() = 'owner') with check (store_id = current_store_id() and current_role_name() = 'owner');
create policy staff_members_owner_delete on staff_members for delete using (store_id = current_store_id() and current_role_name() = 'owner');

-- ── Platform-level tables (unrelated to branches, but were also open) ────

alter table announcements   enable row level security;
alter table managify_admins enable row level security;
alter table user_registry   enable row level security;

-- Announcements power an unauthenticated marketing popup -- keep public read.
create policy announcements_public_select on announcements for select using (true);
create policy announcements_admin_insert  on announcements for insert with check (is_managify_admin());
create policy announcements_admin_update  on announcements for update using (is_managify_admin()) with check (is_managify_admin());
create policy announcements_admin_delete  on announcements for delete using (is_managify_admin());

-- managify_admins: anyone can check whether THEY are an admin (self-row);
-- a confirmed admin can see/manage the full list.
create policy managify_admins_self_select  on managify_admins for select using (email = (auth.jwt()->>'email'));
create policy managify_admins_admin_select on managify_admins for select using (is_managify_admin());
create policy managify_admins_admin_insert on managify_admins for insert with check (is_managify_admin());
create policy managify_admins_admin_delete on managify_admins for delete using (is_managify_admin());

-- user_registry: every signed-in user maintains their own row; the platform
-- admin panel can see/manage everyone's.
create policy user_registry_self_upsert    on user_registry for insert with check (uid = (auth.jwt()->>'sub'));
create policy user_registry_self_update    on user_registry for update using (uid = (auth.jwt()->>'sub')) with check (uid = (auth.jwt()->>'sub'));
create policy user_registry_self_select    on user_registry for select using (uid = (auth.jwt()->>'sub'));
create policy user_registry_admin_select   on user_registry for select using (is_managify_admin());
create policy user_registry_admin_update   on user_registry for update using (is_managify_admin()) with check (is_managify_admin());
create policy user_registry_admin_delete   on user_registry for delete using (is_managify_admin());

-- ── Verification ──────────────────────────────────────────────────────────
-- In the SQL editor, run `select * from items limit 1;` etc. using the
-- "anon, public" role (Dashboard's SQL editor lets you pick a role, or just
-- run it via a raw REST call with only the anon/publishable key and no
-- Authorization header) -- it should now return zero rows on every
-- tenant-scoped table above, proving the original client-trusted-only
-- scoping is now backed by the database, not just the app's own queries.
