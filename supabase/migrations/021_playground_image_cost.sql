-- Record what generation actually costs. xAI reports cost_in_usd_ticks per
-- call and exposes no balance endpoint, so accumulating spend here is the only
-- in-app view of what the playground has used.
--
-- Images move from a storage_paths array on the parent to one row each, so
-- cost is attributed per image rather than per call. Safe to restructure:
-- playground_images is empty at the time this is written.

alter table public.playground_images
  add column if not exists cost_in_usd_ticks bigint check (cost_in_usd_ticks >= 0);

alter table public.playground_images
  drop constraint if exists playground_images_storage_paths_check;

alter table public.playground_images
  drop column if exists storage_paths;

create table if not exists public.playground_image_files (
  id uuid primary key default gen_random_uuid(),
  generation_id uuid not null references public.playground_images (id) on delete cascade,
  position smallint not null check (position >= 0),
  storage_path text not null unique,
  -- The provider prices a call, not an image; this is that call's cost split
  -- evenly across the images it returned.
  cost_in_usd_ticks bigint check (cost_in_usd_ticks >= 0),
  created_at timestamptz not null default now(),
  unique (generation_id, position)
);

create index if not exists playground_image_files_generation_idx
  on public.playground_image_files (generation_id);

alter table public.playground_image_files enable row level security;

drop policy if exists "Admins read playground image files" on public.playground_image_files;
create policy "Admins read playground image files"
  on public.playground_image_files
  for select
  using (public.is_admin());

create index if not exists playground_images_model_resolution_idx
  on public.playground_images (model, resolution);
