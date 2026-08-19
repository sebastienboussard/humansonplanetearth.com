-- Deadline reminders become three independent windows: two weeks, one week,
-- one day. `deadline_reminders` stays as the master switch, so existing rows
-- keep working untouched and turning it off still silences all three.
--
-- Two weeks defaults to false: it is new, and defaulting it on would start
-- sending mail to people who never asked for it. One week and one day default
-- to true, matching what the reminder already did before this change.

alter table notification_prefs
  add column if not exists deadline_14d boolean not null default false,
  add column if not exists deadline_7d  boolean not null default true,
  add column if not exists deadline_1d  boolean not null default true;
