alter table public.companies
  add column if not exists stripe_customer_id text,
  add column if not exists stripe_subscription_id text,
  add column if not exists stripe_price_id text,
  add column if not exists subscription_status text not null default 'inactive',
  add column if not exists subscription_current_period_end timestamptz,
  add column if not exists subscription_cancel_at_period_end boolean not null default false;

create unique index if not exists idx_companies_stripe_customer_id
  on public.companies(stripe_customer_id)
  where stripe_customer_id is not null;

create unique index if not exists idx_companies_stripe_subscription_id
  on public.companies(stripe_subscription_id)
  where stripe_subscription_id is not null;
