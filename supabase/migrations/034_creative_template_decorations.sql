-- Rules, chips and the barcode were drawn from hardcoded geometry in the
-- composer, which meant retuning a design against a freshly generated
-- backdrop needed a deploy. Moving them into the template row makes the
-- whole layout editable as data.

alter table public.creative_templates
  add column if not exists decorations jsonb not null default '[]'::jsonb,
  add column if not exists logo jsonb;
