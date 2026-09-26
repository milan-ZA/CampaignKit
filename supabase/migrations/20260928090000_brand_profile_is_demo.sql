-- Marks a brand profile that was filled with the Sunrise Bakery demo ("Use demo profile").
-- generate-plan copies the whole profile into campaigns.brand_snapshot, so campaigns made while the
-- demo is loaded carry brand_snapshot->>'is_demo' = 'true' and "Remove demo" can find them.
-- Existing RLS policies on brand_profiles already cover the new column.

alter table public.brand_profiles
  add column is_demo boolean not null default false;
