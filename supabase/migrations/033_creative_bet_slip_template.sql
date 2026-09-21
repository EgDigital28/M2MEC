-- The first creative template.
--
-- The backdrop prompt spells out "no text" at length: a generated slip that
-- comes back with invented odds on it is worse than no slip, and the model
-- will happily add them unless told not to. Everything legible is drawn by the
-- composer from the slot values below.

insert into public.creative_templates (name, description, width, height, backdrop_prompt, slots)
values (
  'Bet slip',
  'Torn paper slip over an arena backdrop. Every field is rendered, not generated.',
  1080,
  1350,
  'A blank crumpled white paper receipt with torn zigzag edges, centred, hanging against a dark out-of-focus sports arena at night with soft bokeh lights. Dramatic side lighting, deep shadows, photographic, no text, no lettering, no numbers, empty paper surface.',
  '[
    {"key":"date","label":"Date","kind":"text","x":0.5,"y":0.255,"w":0.62,"align":"center","size":0.062,"weight":800,"colorRole":"secondary","transform":"none"},
    {"key":"subhead","label":"Subhead","kind":"text","x":0.5,"y":0.327,"w":0.62,"align":"center","size":0.032,"weight":700,"colorRole":"secondary","transform":"none"},
    {"key":"league","label":"League","kind":"text","x":0.40,"y":0.395,"w":0.46,"align":"center","size":0.046,"weight":800,"colorRole":"secondary","transform":"uppercase"},
    {"key":"selection","label":"Selection","kind":"text","x":0.40,"y":0.452,"w":0.46,"align":"center","size":0.046,"weight":800,"colorRole":"secondary","transform":"none"},
    {"key":"odds","label":"Odds","kind":"text","x":0.40,"y":0.512,"w":0.46,"align":"center","size":0.044,"weight":800,"colorRole":"secondary","transform":"none"},
    {"key":"unitsLabel","label":"Units label","kind":"text","x":0.735,"y":0.407,"w":0.20,"align":"center","size":0.022,"weight":700,"colorRole":"onAccent","transform":"uppercase"},
    {"key":"units","label":"Units","kind":"text","x":0.735,"y":0.437,"w":0.20,"align":"center","size":0.055,"weight":800,"colorRole":"onAccent","transform":"none"},
    {"key":"unitsSuffix","label":"Units suffix","kind":"text","x":0.735,"y":0.500,"w":0.20,"align":"center","size":0.022,"weight":700,"colorRole":"onAccent","transform":"uppercase"},
    {"key":"toMake","label":"To make","kind":"text","x":0.5,"y":0.572,"w":0.62,"align":"center","size":0.030,"weight":700,"colorRole":"secondary","transform":"uppercase"},
    {"key":"startTime","label":"Start time","kind":"text","x":0.5,"y":0.628,"w":0.62,"align":"center","size":0.030,"weight":800,"colorRole":"secondary","transform":"uppercase"},
    {"key":"cta","label":"Call to action","kind":"text","x":0.5,"y":0.690,"w":0.56,"align":"center","size":0.026,"weight":700,"colorRole":"secondary","transform":"uppercase"},
    {"key":"handle","label":"Handle","kind":"text","x":0.5,"y":0.800,"w":0.62,"align":"center","size":0.028,"weight":700,"colorRole":"primary","transform":"none"}
  ]'::jsonb
)
on conflict (name) do nothing;
