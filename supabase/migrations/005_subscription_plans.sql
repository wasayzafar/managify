-- Subscription plans (Pro / Max) sold via Paddle. Every existing account
-- predates this feature and already relies on multi-branch + staff, so the
-- default grandfathers them to 'max' — only new self-serve signups through
-- the Pricing page start out on 'pro'.

alter table user_registry add column if not exists plan text not null default 'max' check (plan in ('pro', 'max'));
alter table user_registry add column if not exists paddle_customer_id text;
alter table user_registry add column if not exists paddle_subscription_id text;
alter table user_registry add column if not exists paddle_transaction_id text;

create index if not exists user_registry_plan_idx on user_registry (plan);
