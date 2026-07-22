-- Desktop tracking has been retired. Actual work time is recorded exclusively
-- through public.time_entries by the web timer.
drop table if exists public.activity_sessions;
drop table if exists public.tracker_devices;
drop table if exists public.tracker_preferences;
