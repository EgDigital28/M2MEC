-- A backdrop belongs to the template, not to a post.
--
-- It was looked up by matching (kit version, template, prompt), which made
-- generating one a decision at post time and coupled the photograph to the
-- brand kit. A template now points at its current backdrop explicitly:
-- generating one is an edit to the design, and making a post never spends
-- anything. Old backdrops are kept, so the spend history stays intact.

alter table public.creative_templates
  add column if not exists reference_path text,
  add column if not exists backdrop_id uuid
    references public.creative_backdrops (id) on delete set null,
  add column if not exists created_by uuid
    references public.profiles (id) on delete set null;

alter table public.creative_backdrops
  alter column kit_version_id drop not null;

-- Keep the backdrop each template is already using rather than making the
-- owner pay to regenerate what they have.
update public.creative_templates t
set backdrop_id = (
  select b.id
  from public.creative_backdrops b
  where b.template_id = t.id
  order by b.created_at desc
  limit 1
)
where t.backdrop_id is null;
