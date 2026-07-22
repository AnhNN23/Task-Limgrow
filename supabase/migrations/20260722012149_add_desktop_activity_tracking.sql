-- Privacy-first desktop activity tracking. The tracker stores application names
-- and website domains only; it never stores keystrokes, page content, or screenshots.

create table if not exists public.tracker_preferences (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  active_task_id uuid references public.tasks(id) on delete set null,
  tracking_enabled boolean not null default false,
  capture_websites boolean not null default true,
  idle_timeout_seconds integer not null default 300 check (idle_timeout_seconds between 60 and 3600),
  privacy_acknowledged_at timestamptz,
  updated_at timestamptz not null default now(),
  check (not tracking_enabled or privacy_acknowledged_at is not null)
);

create table if not exists public.tracker_devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  device_key text not null check (char_length(device_key) between 8 and 160),
  device_name text not null check (char_length(device_name) between 1 and 160),
  platform text not null default 'macos' check (platform in ('macos', 'windows', 'linux')),
  tracker_version text not null default '1.0.0',
  status text not null default 'offline' check (status in ('online', 'offline', 'error')),
  status_message text,
  last_seen_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, device_key)
);

create table if not exists public.activity_sessions (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  device_id uuid not null references public.tracker_devices(id) on delete cascade,
  time_entry_id uuid references public.time_entries(id) on delete set null,
  source_type text not null check (source_type in ('app', 'website', 'idle')),
  app_name text not null check (char_length(app_name) between 1 and 160),
  domain text check (domain is null or char_length(domain) <= 253),
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  duration_seconds integer not null default 0 check (duration_seconds >= 0),
  created_at timestamptz not null default now(),
  check (ended_at is null or ended_at >= started_at),
  check ((source_type = 'website' and domain is not null) or source_type <> 'website')
);

create index if not exists activity_sessions_user_started_idx
  on public.activity_sessions(user_id, started_at desc);
create index if not exists activity_sessions_task_started_idx
  on public.activity_sessions(task_id, started_at desc);
create index if not exists tracker_devices_user_seen_idx
  on public.tracker_devices(user_id, last_seen_at desc);
create unique index if not exists one_open_activity_per_device
  on public.activity_sessions(device_id) where ended_at is null;

drop trigger if exists tracker_preferences_updated_at on public.tracker_preferences;
create trigger tracker_preferences_updated_at
before update on public.tracker_preferences
for each row execute procedure public.set_updated_at();

drop trigger if exists tracker_devices_updated_at on public.tracker_devices;
create trigger tracker_devices_updated_at
before update on public.tracker_devices
for each row execute procedure public.set_updated_at();

alter table public.tracker_preferences enable row level security;
alter table public.tracker_devices enable row level security;
alter table public.activity_sessions enable row level security;

drop policy if exists "Users view own tracker preferences, PM views all" on public.tracker_preferences;
create policy "Users view own tracker preferences, PM views all"
on public.tracker_preferences for select to authenticated
using ((select auth.uid()) = user_id or private.is_project_manager());

drop policy if exists "Users create own tracker preferences" on public.tracker_preferences;
create policy "Users create own tracker preferences"
on public.tracker_preferences for insert to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists "Users update own tracker preferences" on public.tracker_preferences;
create policy "Users update own tracker preferences"
on public.tracker_preferences for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "Users delete own tracker preferences" on public.tracker_preferences;
create policy "Users delete own tracker preferences"
on public.tracker_preferences for delete to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Users view own tracker devices, PM views all" on public.tracker_devices;
create policy "Users view own tracker devices, PM views all"
on public.tracker_devices for select to authenticated
using ((select auth.uid()) = user_id or private.is_project_manager());

drop policy if exists "Users create own tracker devices" on public.tracker_devices;
create policy "Users create own tracker devices"
on public.tracker_devices for insert to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists "Users update own tracker devices" on public.tracker_devices;
create policy "Users update own tracker devices"
on public.tracker_devices for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "Users delete own tracker devices, PM deletes all" on public.tracker_devices;
create policy "Users delete own tracker devices, PM deletes all"
on public.tracker_devices for delete to authenticated
using ((select auth.uid()) = user_id or private.is_project_manager());

drop policy if exists "Users view own activity, PM views all" on public.activity_sessions;
create policy "Users view own activity, PM views all"
on public.activity_sessions for select to authenticated
using ((select auth.uid()) = user_id or private.is_project_manager());

drop policy if exists "Users create own assigned-task activity" on public.activity_sessions;
create policy "Users create own assigned-task activity"
on public.activity_sessions for insert to authenticated
with check (
  (select auth.uid()) = user_id
  and exists (
    select 1 from public.tasks t
    where t.id = task_id
      and (t.assignee_id = (select auth.uid()) or private.is_project_manager())
  )
  and exists (
    select 1 from public.tracker_devices d
    where d.id = device_id and d.user_id = (select auth.uid())
  )
);

drop policy if exists "Users update own activity, PM updates all" on public.activity_sessions;
create policy "Users update own activity, PM updates all"
on public.activity_sessions for update to authenticated
using ((select auth.uid()) = user_id or private.is_project_manager())
with check ((select auth.uid()) = user_id or private.is_project_manager());

drop policy if exists "Users delete own activity, PM deletes all" on public.activity_sessions;
create policy "Users delete own activity, PM deletes all"
on public.activity_sessions for delete to authenticated
using ((select auth.uid()) = user_id or private.is_project_manager());

grant select, insert, update, delete on public.tracker_preferences to authenticated;
grant select, insert, update, delete on public.tracker_devices to authenticated;
grant select, insert, update, delete on public.activity_sessions to authenticated;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'activity_sessions'
  ) then
    alter publication supabase_realtime add table public.activity_sessions;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'tracker_devices'
  ) then
    alter publication supabase_realtime add table public.tracker_devices;
  end if;
end $$;
