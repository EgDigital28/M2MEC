-- Week in review now sends on a schedule (Sundays, 1am Eastern). It starts
-- switched on because it was asked for; the Email automation page can turn
-- it off.
insert into public.email_automation_settings (email_type, enabled)
values ('week_in_review', true)
on conflict (email_type) do nothing;
