-- Configurable tax rates, applied to purchases and sales/invoices.
-- Depends on 002_auth_bridge_and_rls.sql's current_store_id()/current_role_name().

create table if not exists tax_rates (
  id uuid primary key default gen_random_uuid(),
  store_id text not null,
  name text not null,
  rate numeric not null check (rate >= 0 and rate <= 100),
  applies_to text not null default 'both' check (applies_to in ('purchase', 'sales', 'both')),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists tax_rates_store_id_idx on tax_rates (store_id);

alter table tax_rates enable row level security;

-- Shared across every branch of a store (like items/suppliers) — everyone
-- can read the active rates to apply them; only the owner manages the list.
create policy tax_rates_select on tax_rates for select
  using (store_id = current_store_id());
create policy tax_rates_owner_insert on tax_rates for insert
  with check (store_id = current_store_id() and current_role_name() = 'owner');
create policy tax_rates_owner_update on tax_rates for update
  using (store_id = current_store_id() and current_role_name() = 'owner')
  with check (store_id = current_store_id() and current_role_name() = 'owner');
create policy tax_rates_owner_delete on tax_rates for delete
  using (store_id = current_store_id() and current_role_name() = 'owner');

-- Tax applied to a purchase/sale/invoice is snapshotted (name + percent, not
-- just a foreign key) so a later rename/deletion/rate-change of the tax
-- itself never rewrites the meaning of a past, already-printed document.
-- "on delete set null" is what makes that true for deletion specifically:
-- without it, the plain foreign key would instead BLOCK deleting any tax
-- that was ever used, which defeats the point of snapshotting the name/
-- percent/amount onto the row in the first place.
alter table purchases add column if not exists tax_rate_id uuid references tax_rates(id) on delete set null;
alter table purchases add column if not exists tax_name text;
alter table purchases add column if not exists tax_percent numeric;
alter table purchases add column if not exists tax_amount numeric;

alter table sales add column if not exists tax_rate_id uuid references tax_rates(id) on delete set null;
alter table sales add column if not exists tax_name text;
alter table sales add column if not exists tax_percent numeric;
alter table sales add column if not exists tax_amount numeric;

alter table invoices add column if not exists tax_rate_id uuid references tax_rates(id) on delete set null;
alter table invoices add column if not exists tax_name text;
alter table invoices add column if not exists tax_percent numeric;
alter table invoices add column if not exists tax_amount numeric;

-- Note: tax_amount is additive on top of the existing cost/price fields, not
-- folded into them — purchases.cost_price stays the inventory cost basis
-- (unaffected, so weighted-average-cost in getInventory() needs no change)
-- and sales.actual_price stays pre-tax revenue (unaffected, so Profit & Loss
-- correctly continues to exclude tax collected on behalf of the government).
-- invoices.total, however, IS tax-inclusive — it already represents "what
-- the customer owes/paid", which tax is naturally part of.
