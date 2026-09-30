-- Brand kits, templates and renders.
--
-- Kits are versioned immutably: a render stores the version it used, so a post
-- stays reproducible after the brand changes. Templates hold layout only and
-- refer to colours by role, so any kit can drive any template.

create table if not exists public.brand_kits (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 1 and 120),
  handle text check (char_length(handle) <= 120),
  is_active boolean not null default true,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.brand_kit_versions (
  id uuid primary key default gen_random_uuid(),
  kit_id uuid not null references public.brand_kits (id) on delete cascade,
  version integer not null,
  primary_color text not null default '#e05252',
  secondary_color text not null default '#101828',
  accent_color text not null default '#22c55e',
  text_color text not null default '#ffffff',
  logo_path text,
  style_prompt text check (char_length(style_prompt) <= 1000),
  created_at timestamptz not null default now(),
  unique (kit_id, version)
);

create table if not exists public.creative_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  description text,
  width integer not null default 1080,
  height integer not null default 1350,
  backdrop_prompt text not null,
  -- Slots are fractional so one template renders at any size, and reference a
  -- colour role rather than a hex so they are not tied to one brand. The same
  -- holds for decorations (rules, chips, the barcode) and the logo rect, so a
  -- whole layout can be retuned as data. 034 adds these two to a database
  -- that already ran this file.
  slots jsonb not null,
  decorations jsonb not null default '[]'::jsonb,
  logo jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.creative_backdrops (
  id uuid primary key default gen_random_uuid(),
  kit_version_id uuid not null references public.brand_kit_versions (id) on delete cascade,
  template_id uuid not null references public.creative_templates (id) on delete cascade,
  prompt text not null,
  model text not null,
  storage_path text not null,
  cost_in_usd_ticks bigint check (cost_in_usd_ticks >= 0),
  created_at timestamptz not null default now()
);

create index if not exists creative_backdrops_lookup_idx
  on public.creative_backdrops (kit_version_id, template_id, created_at desc);

create table if not exists public.creative_renders (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.creative_templates (id) on delete restrict,
  kit_version_id uuid not null references public.brand_kit_versions (id) on delete restrict,
  backdrop_id uuid references public.creative_backdrops (id) on delete set null,
  slot_values jsonb not null,
  storage_path text not null,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists creative_renders_created_idx
  on public.creative_renders (created_at desc);

alter table public.brand_kits enable row level security;
alter table public.brand_kit_versions enable row level security;
alter table public.creative_templates enable row level security;
alter table public.creative_backdrops enable row level security;
alter table public.creative_renders enable row level security;

drop policy if exists "Admins manage brand kits" on public.brand_kits;
create policy "Admins manage brand kits" on public.brand_kits
  for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "Admins manage brand kit versions" on public.brand_kit_versions;
create policy "Admins manage brand kit versions" on public.brand_kit_versions
  for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "Admins manage creative templates" on public.creative_templates;
create policy "Admins manage creative templates" on public.creative_templates
  for all using (public.is_admin()) with check (public.is_admin());

-- Backdrops and renders are only ever written by the service role, so admins
-- get read access and nothing more.
drop policy if exists "Admins read creative backdrops" on public.creative_backdrops;
create policy "Admins read creative backdrops" on public.creative_backdrops
  for select using (public.is_admin());

drop policy if exists "Admins read creative renders" on public.creative_renders;
create policy "Admins read creative renders" on public.creative_renders
  for select using (public.is_admin());

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('creative-assets', 'creative-assets', false, 20971520,
        array['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'])
on conflict (id) do nothing;
