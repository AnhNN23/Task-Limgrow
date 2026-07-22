-- Allow forgotten timers to be corrected without losing the original values.
alter table public.time_entries
  add column if not exists correction_reason text,
  add column if not exists corrected_at timestamptz,
  add column if not exists corrected_by uuid references public.profiles(id) on delete set null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'time_entries_correction_reason_length'
      and conrelid = 'public.time_entries'::regclass
  ) then
    alter table public.time_entries
      add constraint time_entries_correction_reason_length
      check (
        correction_reason is null
        or char_length(btrim(correction_reason)) between 5 and 500
      );
  end if;
end $$;

create table if not exists public.time_entry_adjustments (
  id uuid primary key default gen_random_uuid(),
  time_entry_id uuid not null references public.time_entries(id) on delete cascade,
  task_id uuid not null references public.tasks(id) on delete cascade,
  entry_user_id uuid references public.profiles(id) on delete set null,
  adjusted_by uuid references public.profiles(id) on delete set null,
  reason text not null check (char_length(btrim(reason)) between 5 and 500),
  old_started_at timestamptz not null,
  new_started_at timestamptz not null,
  old_ended_at timestamptz,
  new_ended_at timestamptz,
  old_duration_seconds integer not null,
  new_duration_seconds integer not null,
  created_at timestamptz not null default now()
);

create index if not exists time_entry_adjustments_entry_created_idx
  on public.time_entry_adjustments(time_entry_id, created_at desc);
create index if not exists time_entry_adjustments_user_created_idx
  on public.time_entry_adjustments(entry_user_id, created_at desc);
create index if not exists time_entries_corrected_by_idx
  on public.time_entries(corrected_by)
  where corrected_by is not null;
create index if not exists time_entry_adjustments_task_idx
  on public.time_entry_adjustments(task_id);
create index if not exists time_entry_adjustments_adjusted_by_idx
  on public.time_entry_adjustments(adjusted_by)
  where adjusted_by is not null;

alter table public.time_entry_adjustments enable row level security;

drop policy if exists "Users view own time corrections, PM views all"
  on public.time_entry_adjustments;
create policy "Users view own time corrections, PM views all"
  on public.time_entry_adjustments
  for select
  to authenticated
  using (
    entry_user_id = (select auth.uid())
    or private.is_project_manager()
  );

grant select on public.time_entry_adjustments to authenticated;
grant all on public.time_entry_adjustments to service_role;

create or replace function private.audit_time_entry_correction()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  is_correction boolean;
  clean_reason text;
begin
  is_correction :=
    new.started_at is distinct from old.started_at
    or (
      old.ended_at is not null
      and (
        new.ended_at is distinct from old.ended_at
        or new.duration_seconds is distinct from old.duration_seconds
      )
    )
    or new.correction_reason is distinct from old.correction_reason;

  if not is_correction then
    return new;
  end if;

  clean_reason := btrim(coalesce(new.correction_reason, ''));
  if char_length(clean_reason) < 5 then
    raise exception 'A correction reason of at least 5 characters is required';
  end if;

  if new.ended_at is null then
    raise exception 'A corrected time entry must have an end time';
  end if;

  if new.ended_at <= new.started_at then
    raise exception 'End time must be after start time';
  end if;

  if new.ended_at > now() + interval '1 minute' then
    raise exception 'End time cannot be in the future';
  end if;

  new.duration_seconds := greatest(
    1,
    floor(extract(epoch from (new.ended_at - new.started_at)))::integer
  );
  new.correction_reason := clean_reason;
  new.corrected_at := now();
  new.corrected_by := (select auth.uid());

  insert into public.time_entry_adjustments (
    time_entry_id,
    task_id,
    entry_user_id,
    adjusted_by,
    reason,
    old_started_at,
    new_started_at,
    old_ended_at,
    new_ended_at,
    old_duration_seconds,
    new_duration_seconds
  )
  values (
    old.id,
    old.task_id,
    old.user_id,
    (select auth.uid()),
    clean_reason,
    old.started_at,
    new.started_at,
    old.ended_at,
    new.ended_at,
    old.duration_seconds,
    new.duration_seconds
  );

  return new;
end;
$$;

revoke all on function private.audit_time_entry_correction() from public;
revoke all on function private.audit_time_entry_correction() from anon;
revoke all on function private.audit_time_entry_correction() from authenticated;

drop trigger if exists audit_time_entry_correction_trigger
  on public.time_entries;
create trigger audit_time_entry_correction_trigger
before update on public.time_entries
for each row
execute function private.audit_time_entry_correction();
