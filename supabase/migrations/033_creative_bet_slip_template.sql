-- The first creative template.
--
-- The backdrop prompt spells out "no text" at length: a generated slip that
-- comes back with invented odds on it is worse than no slip, and the model
-- will happily add them unless told not to. Everything legible is drawn by the
-- composer from the slots and decorations below, so the layout can be retuned
-- against a new backdrop by editing this row rather than shipping code.

insert into public.creative_templates
  (name, description, width, height, backdrop_prompt, slots, decorations, logo)
values (
  'Bet slip',
  'Torn paper slip over an arena backdrop. Every field is rendered, not generated.',
  1080,
  1350,
  'A single large blank crumpled white paper betting receipt with torn zigzag edges along the top and bottom, hanging centred and filling most of the frame, photographed against a very dark desaturated out-of-focus arena interior at night. Subtle cool rim light on the paper, deep black background, minimal soft bokeh, cinematic, understated, photographic. The paper is completely blank: no text, no lettering, no numbers, no barcode, no logo, no printing, no markings of any kind, plain empty paper surface.',
  '[{"key":"date","label":"Date","kind":"text","x":0.515,"y":0.2,"w":0.7,"align":"center","size":0.072,"weight":400,"font":"display","colorRole":"secondary","transform":"none","placeholder":"May 5th"},{"key":"subhead","label":"Subhead","kind":"text","x":0.515,"y":0.3,"w":0.7,"align":"center","size":0.036,"weight":900,"colorRole":"secondary","transform":"none","placeholder":"Official Free Play #3"},{"key":"league","label":"League","kind":"text","x":0.39,"y":0.382,"w":0.42,"align":"center","size":0.04,"weight":400,"font":"display","colorRole":"secondary","transform":"uppercase","placeholder":"ATP Rome"},{"key":"selection","label":"Selection","kind":"text","x":0.39,"y":0.432,"w":0.42,"align":"center","size":0.04,"weight":400,"font":"display","colorRole":"secondary","transform":"none","placeholder":"Basilashvili ML"},{"key":"odds","label":"Odds","kind":"text","x":0.39,"y":0.482,"w":0.42,"align":"center","size":0.04,"weight":400,"font":"display","colorRole":"secondary","transform":"none","placeholder":"Odds: -160"},{"key":"unitsLabel","label":"Units label","kind":"text","x":0.7025,"y":0.392,"w":0.175,"align":"center","size":0.019,"weight":900,"tracking":0.04,"colorRole":"onAccent","transform":"uppercase","placeholder":"Wager"},{"key":"units","label":"Units","kind":"text","x":0.7025,"y":0.421,"w":0.175,"align":"center","size":0.055,"weight":400,"font":"display","colorRole":"onAccent","transform":"none","placeholder":"6.4"},{"key":"unitsSuffix","label":"Units suffix","kind":"text","x":0.7025,"y":0.487,"w":0.175,"align":"center","size":0.019,"weight":900,"tracking":0.04,"colorRole":"onAccent","transform":"uppercase","placeholder":"Units"},{"key":"toMake","label":"To make","kind":"text","x":0.515,"y":0.57,"w":0.7,"align":"center","size":0.03,"weight":700,"colorRole":"secondary","transform":"uppercase","placeholder":"To make: 4 units"},{"key":"startTime","label":"Start time","kind":"text","x":0.515,"y":0.63,"w":0.7,"align":"center","size":0.032,"weight":900,"colorRole":"secondary","transform":"uppercase","placeholder":"Start time: 8:00 am EST"},{"key":"cta","label":"Call to action","kind":"text","x":0.515,"y":0.695,"w":0.52,"align":"center","size":0.026,"weight":900,"colorRole":"secondary","transform":"uppercase","placeholder":"Save this post & come back when picks hit"},{"key":"handle","label":"Handle","kind":"text","x":0.515,"y":0.845,"w":0.7,"align":"center","size":0.028,"weight":900,"colorRole":"primary","transform":"none","placeholder":"@m2mec"}]'::jsonb,
  '[{"type":"rule","x":0.185,"y":0.345,"w":0.66,"h":0.0035,"colorRole":"accent"},{"type":"block","x":0.615,"y":0.375,"w":0.175,"h":0.145,"colorRole":"accent","radius":10},{"type":"rule","x":0.185,"y":0.545,"w":0.66,"h":0.0035,"colorRole":"accent"},{"type":"barcode","x":0.315,"y":0.775,"w":0.4,"h":0.048,"colorRole":"secondary"}]'::jsonb,
  '{"x":0.355,"y":0.128,"w":0.32,"h":0.058}'::jsonb
)
on conflict (name) do nothing;
