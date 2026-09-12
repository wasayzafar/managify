-- Phase 1 of the multi-branch feature: new tables + branch_id columns.
-- Run this in the Supabase SQL Editor (Dashboard -> managify project -> SQL Editor).
-- Safe to run on the live database: only adds new tables/columns, touches no
-- existing rows, and every new column is nullable so existing data keeps
-- working exactly as it does today.

-- ── Branches ────────────────────────────────────────────────────────────
create table if not exists branches (
  id uuid primary key default gen_random_uuid(),
  store_id text not null,               -- owner's Firebase UID (the tenant)
  name text not null,
  address text,
  phone text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists branches_store_id_idx on branches (store_id);

-- ── Staff members ───────────────────────────────────────────────────────
-- Maps a staff member's OWN Firebase UID to the store they work for, the
-- one branch they're scoped to, and their role.
create table if not exists staff_members (
  id uuid primary key default gen_random_uuid(),
  store_id text not null,               -- owner's Firebase UID (the tenant)
  staff_uid text not null unique,       -- the staff member's own Firebase UID
  branch_id uuid not null references branches(id),
  email text not null,
  display_name text,
  role text not null default 'staff',   -- 'manager' | 'staff'
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists staff_members_store_id_idx on staff_members (store_id);
create index if not exists staff_members_staff_uid_idx on staff_members (staff_uid);

-- ── branch_id on existing transactional tables ─────────────────────────
-- Nullable: existing rows stay NULL (meaning "the store's original / only
-- branch") until the app backfills them lazily. Nothing here is destructive.
alter table purchases add column if not exists branch_id uuid references branches(id);
alter table sales     add column if not exists branch_id uuid references branches(id);
alter table expenses  add column if not exists branch_id uuid references branches(id);
alter table assets    add column if not exists branch_id uuid references branches(id);
alter table invoices  add column if not exists branch_id uuid references branches(id);

create index if not exists purchases_branch_id_idx on purchases (branch_id);
create index if not exists sales_branch_id_idx     on sales (branch_id);
create index if not exists expenses_branch_id_idx  on expenses (branch_id);
create index if not exists assets_branch_id_idx    on assets (branch_id);
create index if not exists invoices_branch_id_idx  on invoices (branch_id);

-- Note: RLS is intentionally NOT enabled by this migration. That's phase 3
-- of the multi-branch plan (requires the Firebase<->Supabase auth bridge
-- to be configured first, otherwise policies using auth.jwt() would block
-- everything). This migration only adds the schema the app's client-side
-- scoping needs for phases 1-2.
