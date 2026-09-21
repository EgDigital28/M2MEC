-- Image playground: generation history plus a private Storage bucket.
-- Images are written and read with the service role only; the browser never
-- touches the bucket directly and reads through short-lived signed URLs.

create table if not exists public.playground_images (
  id uuid primary key default gen_random_uuid(),
  created_by uuid references public.profiles (id) on delete set null,
  provider text not null default 'xai',
  model text not null,
  prompt text not null check (char_length(prompt) between 1 and 4000),
  aspect_ratio text not null,
  resolution text not null,
  media_type text not null,
  storage_paths text[] not null check (cardinality(storage_paths) between 1 and 8),
  duration_ms integer check (duration_ms >= 0),
  created_at timestamptz not null default now()
);

create index if not exists playground_images_created_at_idx
  on public.playground_images (created_at desc);

alter table public.playground_images enable row level security;

drop policy if exists "Admins read playground images" on public.playground_images;
create policy "Admins read playground images"
  on public.playground_images
  for select
  using (public.is_admin());

-- Writes arrive from the server route under the service role, which bypasses
-- RLS. No browser insert/update/delete policy is granted on purpose.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'playground-images',
  'playground-images',
  false,
  20971520,
  array['image/png', 'image/jpeg', 'image/webp']
)
on conflict (id) do nothing;
