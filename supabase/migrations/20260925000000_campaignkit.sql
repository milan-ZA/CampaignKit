-- CampaignKit schema: brand profiles, campaigns, posts, post images + Storage.
-- Every table has Row Level Security; users only ever see and change their own rows.

-- ---------------------------------------------------------------------------
-- brand_profiles
-- ---------------------------------------------------------------------------
create table public.brand_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users (id) on delete cascade default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- Personal DNA
  owner_name text,
  owner_story text,
  owner_values text,
  owner_personality text,
  owner_expertise text,

  -- Business DNA
  business_name text,
  what_you_sell text,
  location text,
  customers text,
  what_makes_you_different text,
  price_level text check (price_level in ('Budget', 'Mid-range', 'Premium')),

  -- Brand voice
  tone_words text[] not null default '{}' check (
    cardinality(tone_words) <= 3
    and tone_words <@ array['Friendly','Warm','Playful','Bold','Calm','Expert','Premium','Down-to-earth']::text[]
  ),
  words_to_use text,
  words_to_avoid text,
  emoji_use text check (emoji_use in ('None', 'A few', 'Lots')),
  example_post text,
  visual_style text check (visual_style in ('Photo', 'Illustration', 'Simple graphic')),
  brand_colours text,

  -- Channels
  channels text[] not null default '{}' check (
    channels <@ array['Instagram','Facebook','TikTok','LinkedIn','WhatsApp','Email','Google Business Profile','In-store']::text[]
  )
);

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- Runs on every save (including upserts that hit an existing row).
create trigger brand_profiles_touch
before update on public.brand_profiles
for each row execute function public.touch_updated_at();

alter table public.brand_profiles enable row level security;

create policy "Own brand profile: select" on public.brand_profiles
  for select to authenticated using (user_id = auth.uid());
create policy "Own brand profile: insert" on public.brand_profiles
  for insert to authenticated with check (user_id = auth.uid());
create policy "Own brand profile: update" on public.brand_profiles
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "Own brand profile: delete" on public.brand_profiles
  for delete to authenticated using (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- campaigns
-- ---------------------------------------------------------------------------
create table public.campaigns (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  name text not null,
  business_brief text not null check (char_length(business_brief) <= 1000),
  target_audience text not null,
  goal text not null,
  duration_weeks int not null check (duration_weeks between 1 and 12),
  start_date date not null,
  channels text[] not null check (
    cardinality(channels) >= 1
    and channels <@ array['Instagram','Facebook','TikTok','LinkedIn','WhatsApp','Email','Google Business Profile','In-store']::text[]
  ),
  -- Copy of the saved brand profile that was used to build this plan.
  brand_snapshot jsonb,
  created_at timestamptz not null default now()
);

create index campaigns_user_created_idx on public.campaigns (user_id, created_at desc);

alter table public.campaigns enable row level security;

create policy "Own campaigns: select" on public.campaigns
  for select to authenticated using (user_id = auth.uid());
create policy "Own campaigns: insert" on public.campaigns
  for insert to authenticated with check (user_id = auth.uid());
create policy "Own campaigns: update" on public.campaigns
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "Own campaigns: delete" on public.campaigns
  for delete to authenticated using (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- campaign_items (posts)
-- ---------------------------------------------------------------------------
create table public.campaign_items (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  week_number int not null check (week_number between 1 and 12),
  post_date date not null,
  channel text not null,
  content_idea text not null default '',
  "copy" text not null default '',
  ad_script text,
  creative_brief text,
  created_at timestamptz not null default now()
);

create index campaign_items_campaign_idx on public.campaign_items (campaign_id, week_number, post_date);

alter table public.campaign_items enable row level security;

create or replace function public.owns_campaign(p_campaign_id uuid)
returns boolean language sql stable security invoker set search_path = public as $$
  select exists (select 1 from public.campaigns c where c.id = p_campaign_id and c.user_id = auth.uid())
$$;

create policy "Own items: select" on public.campaign_items
  for select to authenticated using (public.owns_campaign(campaign_id));
create policy "Own items: insert" on public.campaign_items
  for insert to authenticated with check (public.owns_campaign(campaign_id));
create policy "Own items: update" on public.campaign_items
  for update to authenticated using (public.owns_campaign(campaign_id)) with check (public.owns_campaign(campaign_id));
create policy "Own items: delete" on public.campaign_items
  for delete to authenticated using (public.owns_campaign(campaign_id));

-- ---------------------------------------------------------------------------
-- campaign_item_images (max 3 per post)
-- ---------------------------------------------------------------------------
create table public.campaign_item_images (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.campaign_items (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  storage_path text not null,
  prompt text,
  size text,
  created_at timestamptz not null default now()
);

create index campaign_item_images_item_idx on public.campaign_item_images (item_id, created_at);

alter table public.campaign_item_images enable row level security;

create or replace function public.owns_item(p_item_id uuid)
returns boolean language sql stable security invoker set search_path = public as $$
  select exists (
    select 1 from public.campaign_items i
    join public.campaigns c on c.id = i.campaign_id
    where i.id = p_item_id and c.user_id = auth.uid()
  )
$$;

create policy "Own images: select" on public.campaign_item_images
  for select to authenticated using (user_id = auth.uid());
create policy "Own images: insert" on public.campaign_item_images
  for insert to authenticated with check (
    user_id = auth.uid()
    and public.owns_item(item_id)
    and storage_path like auth.uid()::text || '/' || item_id::text || '/%'
  );
create policy "Own images: delete" on public.campaign_item_images
  for delete to authenticated using (user_id = auth.uid());

-- AFTER trigger so it sees every row the statement inserted.
create or replace function public.enforce_image_limit()
returns trigger language plpgsql as $$
begin
  if (select count(*) from public.campaign_item_images where item_id = new.item_id) > 3 then
    raise exception 'A post can have at most 3 images.';
  end if;
  return null;
end $$;

create trigger campaign_item_images_limit
after insert on public.campaign_item_images
for each row execute function public.enforce_image_limit();

-- ---------------------------------------------------------------------------
-- RPC: create a campaign and its posts in one transaction (all or nothing).
-- SECURITY INVOKER so RLS still applies.
-- ---------------------------------------------------------------------------
create or replace function public.create_campaign_with_items(p_campaign jsonb, p_items jsonb)
returns uuid language plpgsql security invoker set search_path = public as $$
declare
  v_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Not logged in';
  end if;

  insert into public.campaigns (user_id, name, business_brief, target_audience, goal, duration_weeks, start_date, channels, brand_snapshot)
  values (
    auth.uid(),
    p_campaign->>'name',
    p_campaign->>'business_brief',
    p_campaign->>'target_audience',
    p_campaign->>'goal',
    (p_campaign->>'duration_weeks')::int,
    (p_campaign->>'start_date')::date,
    array(select jsonb_array_elements_text(p_campaign->'channels')),
    p_campaign->'brand_snapshot'
  )
  returning id into v_id;

  insert into public.campaign_items (campaign_id, week_number, post_date, channel, content_idea, "copy")
  select v_id, (i->>'week_number')::int, (i->>'post_date')::date, i->>'channel', i->>'content_idea', i->>'copy'
  from jsonb_array_elements(p_items) as i;

  return v_id;
end $$;

-- ---------------------------------------------------------------------------
-- RPC: swap a post's image rows for a new set in one transaction.
-- Returns the storage paths of the rows it removed so the caller can delete those files.
-- ---------------------------------------------------------------------------
create or replace function public.replace_item_images(p_item_id uuid, p_images jsonb)
returns setof text language plpgsql security invoker set search_path = public as $$
begin
  if not public.owns_item(p_item_id) then
    raise exception 'Post not found';
  end if;

  return query
    with removed as (
      delete from public.campaign_item_images
      where item_id = p_item_id and user_id = auth.uid()
      returning storage_path
    )
    select removed.storage_path from removed;

  insert into public.campaign_item_images (id, item_id, user_id, storage_path, prompt, size)
  select (img->>'id')::uuid, p_item_id, auth.uid(), img->>'storage_path', img->>'prompt', img->>'size'
  from jsonb_array_elements(p_images) as img;
end $$;

revoke all on function public.create_campaign_with_items(jsonb, jsonb) from public, anon;
revoke all on function public.replace_item_images(uuid, jsonb) from public, anon;
grant execute on function public.create_campaign_with_items(jsonb, jsonb) to authenticated;
grant execute on function public.replace_item_images(uuid, jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- Storage: private bucket "post-images", files under {user_id}/{item_id}/{image_id}.png
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('post-images', 'post-images', false)
on conflict (id) do update set public = false;

create policy "Post images: read own folder" on storage.objects
  for select to authenticated
  using (bucket_id = 'post-images' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "Post images: upload to own folder" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'post-images' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "Post images: update own folder" on storage.objects
  for update to authenticated
  using (bucket_id = 'post-images' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'post-images' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "Post images: delete own folder" on storage.objects
  for delete to authenticated
  using (bucket_id = 'post-images' and (storage.foldername(name))[1] = auth.uid()::text);
