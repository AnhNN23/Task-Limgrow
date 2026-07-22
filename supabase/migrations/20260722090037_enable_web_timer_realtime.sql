-- The web timer is the single source of truth for actual time. Publish its
-- worklog rows so PM dashboards and employee sessions update without reloads.
do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'time_entries'
  ) then
    alter publication supabase_realtime add table public.time_entries;
  end if;

  if exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'activity_sessions'
  ) then
    alter publication supabase_realtime drop table public.activity_sessions;
  end if;

  if exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'tracker_devices'
  ) then
    alter publication supabase_realtime drop table public.tracker_devices;
  end if;
end
$$;
