-- Branch-to-branch stock transfers, with manager/owner approval required
-- before stock leaves the source branch, and an explicit "receive" step at
-- the destination. Run this after 002_auth_bridge_and_rls.sql (it reuses
-- current_store_id()/current_branch_id()/current_role_name() from there).

create table if not exists stock_transfers (
  id uuid primary key default gen_random_uuid(),
  store_id text not null,
  item_id uuid not null references items(id),
  quantity numeric not null check (quantity > 0),
  from_branch_id uuid not null references branches(id),
  to_branch_id uuid not null references branches(id),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'received')),
  requested_by text not null,       -- acting Firebase uid (owner or staff), not the store id
  requested_by_name text,
  approved_by text,
  approved_at timestamptz,
  received_at timestamptz,
  rejected_reason text,
  notes text,
  created_at timestamptz not null default now(),
  constraint stock_transfers_different_branches check (from_branch_id <> to_branch_id)
);

create index if not exists stock_transfers_store_id_idx    on stock_transfers (store_id);
create index if not exists stock_transfers_from_branch_idx on stock_transfers (from_branch_id);
create index if not exists stock_transfers_to_branch_idx   on stock_transfers (to_branch_id);
create index if not exists stock_transfers_status_idx      on stock_transfers (status);

alter table stock_transfers enable row level security;

-- Visibility: anyone whose branch is either side of the transfer (owner sees all).
create policy stock_transfers_select on stock_transfers for select
  using (
    store_id = current_store_id() and (
      current_branch_id() is null or current_branch_id() = from_branch_id or current_branch_id() = to_branch_id
    )
  );

-- Anyone can request a transfer OUT of their own branch (owner can request from any branch they choose).
create policy stock_transfers_insert on stock_transfers for insert
  with check (
    store_id = current_store_id()
    and status = 'pending'
    and requested_by = (auth.jwt()->>'sub')
    and (current_branch_id() is null or current_branch_id() = from_branch_id)
  );

-- Broad visibility gate for updates; the trigger below is the actual
-- authority on WHICH status transitions are allowed and WHO may make them —
-- keeping that in one function avoids the classic RLS pitfall where multiple
-- permissive policies' USING/WITH CHECK clauses get OR'd independently
-- (letting one policy's "old row" match pair with another's "new row" check).
create policy stock_transfers_update on stock_transfers for update
  using (
    store_id = current_store_id() and (
      current_branch_id() is null or current_branch_id() = from_branch_id or current_branch_id() = to_branch_id
    )
  )
  with check (store_id = current_store_id());

create or replace function enforce_stock_transfer_transition() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  caller_role text := current_role_name();
  caller_branch uuid := current_branch_id();
begin
  if new.status = old.status then
    -- No status change (e.g. editing notes) — nothing to authorize here.
    return new;
  end if;

  if old.status = 'pending' and new.status in ('approved', 'rejected') then
    if not (
      caller_role = 'owner'
      or (caller_role = 'manager' and (caller_branch = old.from_branch_id or caller_branch = old.to_branch_id))
    ) then
      raise exception 'Only a manager or the store owner can approve or reject a transfer';
    end if;
    new.approved_by := auth.jwt()->>'sub';
    new.approved_at := now();
    return new;
  end if;

  if old.status = 'approved' and new.status = 'received' then
    if not (caller_branch is null or caller_branch = old.to_branch_id) then
      raise exception 'Only the receiving branch can confirm receipt';
    end if;
    new.received_at := now();
    return new;
  end if;

  raise exception 'Invalid stock transfer status transition: % -> %', old.status, new.status;
end;
$$;

drop trigger if exists stock_transfers_transition on stock_transfers;
create trigger stock_transfers_transition
  before update on stock_transfers
  for each row execute function enforce_stock_transfer_transition();

-- Note on inventory math: a transfer's quantity leaves the source branch's
-- countable stock once APPROVED (it's physically left, even if still in
-- transit) and only lands in the destination branch's stock once RECEIVED.
-- src/supabaseStorage.ts's getInventory() implements this by subtracting
-- approved+received outbound transfers from the source branch and adding
-- only received inbound transfers to the destination branch.
