-- Two custom-priced plans sold above Max: Restaurant POS and Bakery
-- Production & POS. They carry the same in-app entitlements as Max — the
-- app only restricts the Pro tier — so no other schema change is needed.

alter table user_registry drop constraint if exists user_registry_plan_check;
alter table user_registry add constraint user_registry_plan_check
  check (plan in ('pro', 'max', 'restaurant', 'bakery', 'none'));
