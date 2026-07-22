-- Tempo database schema. Run the whole file in Supabase SQL Editor once.
create extension if not exists "pgcrypto";

do $$ begin
  create type public.app_role as enum ('project_manager', 'tester', 'business_analyst', 'ui_ux', 'graphic_designer', 'developer');
exception when duplicate_object then null; end $$;
do $$ begin
  create type public.task_status as enum ('todo', 'in_progress', 'review', 'done');
exception when duplicate_object then null; end $$;
do $$ begin
  create type public.task_priority as enum ('low', 'medium', 'high');
exception when duplicate_object then null; end $$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  email text not null default '',
  role public.app_role not null default 'developer',
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 120),
  client_name text,
  color text not null default '#116149',
  status text not null default 'active' check (status in ('active', 'on_hold', 'completed', 'archived')),
  budget_hours numeric(10,2) check (budget_hours is null or budget_hours >= 0),
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.project_members (
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (project_id, user_id)
);

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  title text not null check (char_length(title) between 2 and 240),
  description text,
  status public.task_status not null default 'todo',
  priority public.task_priority not null default 'medium',
  assignee_id uuid references public.profiles(id) on delete set null,
  due_date date,
  estimated_minutes integer check (estimated_minutes is null or estimated_minutes >= 0),
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.time_entries (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  duration_seconds integer not null default 0 check (duration_seconds >= 0),
  note text,
  created_at timestamptz not null default now(),
  check (ended_at is null or ended_at >= started_at)
);

create unique index if not exists one_running_timer_per_user
  on public.time_entries(user_id) where ended_at is null;
create index if not exists tasks_project_id_idx on public.tasks(project_id);
create index if not exists tasks_assignee_id_idx on public.tasks(assignee_id);
create index if not exists time_entries_task_id_idx on public.time_entries(task_id);
create index if not exists time_entries_user_started_idx on public.time_entries(user_id, started_at desc);

create or replace function public.is_project_manager()
returns boolean language sql stable security definer set search_path = public
as $$ select exists(select 1 from public.profiles where id = auth.uid() and role = 'project_manager') $$;

create or replace function public.is_project_member(target_project uuid)
returns boolean language sql stable security definer set search_path = public
as $$ select exists(select 1 from public.project_members where project_id = target_project and user_id = auth.uid()) $$;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public
as $$
declare assigned_role public.app_role; requested_role text;
begin
  requested_role := coalesce(new.raw_user_meta_data->>'role', 'developer');
  if exists(select 1 from public.profiles limit 1) then
    assigned_role := case requested_role
      when 'tester' then 'tester'::public.app_role
      when 'business_analyst' then 'business_analyst'::public.app_role
      when 'ui_ux' then 'ui_ux'::public.app_role
      when 'graphic_designer' then 'graphic_designer'::public.app_role
      else 'developer'::public.app_role end;
  else assigned_role := 'project_manager';
  end if;
  insert into public.profiles(id, full_name, email, role)
  values(new.id, coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)), coalesce(new.email, ''), assigned_role)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
for each row execute procedure public.handle_new_user();

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$ begin new.updated_at = now(); return new; end; $$;
create or replace function public.protect_profile_role()
returns trigger language plpgsql security definer set search_path = public
as $$ begin
  if new.role is distinct from old.role and not public.is_project_manager() then
    raise exception 'Only Project Managers can change employee roles';
  end if;
  return new;
end; $$;
create or replace function public.add_task_assignee_to_project()
returns trigger language plpgsql security definer set search_path = public
as $$ begin
  if new.assignee_id is not null then
    insert into public.project_members(project_id, user_id) values(new.project_id, new.assignee_id)
    on conflict do nothing;
  end if;
  return new;
end; $$;
drop trigger if exists profiles_updated_at on public.profiles;
create trigger profiles_updated_at before update on public.profiles for each row execute procedure public.set_updated_at();
drop trigger if exists protect_profile_role_trigger on public.profiles;
create trigger protect_profile_role_trigger before update on public.profiles for each row execute procedure public.protect_profile_role();
drop trigger if exists projects_updated_at on public.projects;
create trigger projects_updated_at before update on public.projects for each row execute procedure public.set_updated_at();
drop trigger if exists tasks_updated_at on public.tasks;
create trigger tasks_updated_at before update on public.tasks for each row execute procedure public.set_updated_at();
drop trigger if exists add_task_assignee_to_project_trigger on public.tasks;
create trigger add_task_assignee_to_project_trigger after insert or update of assignee_id, project_id on public.tasks for each row execute procedure public.add_task_assignee_to_project();

alter table public.profiles enable row level security;
alter table public.projects enable row level security;
alter table public.project_members enable row level security;
alter table public.tasks enable row level security;
alter table public.time_entries enable row level security;

-- ClickUp/Jira-style collaboration layer
create table if not exists public.sprints (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  name text not null check (char_length(name) between 2 and 100),
  goal text,
  start_date date,
  end_date date,
  status text not null default 'planned' check (status in ('planned', 'active', 'completed')),
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);
alter table public.tasks add column if not exists sprint_id uuid references public.sprints(id) on delete set null;
alter table public.tasks add column if not exists position integer not null default 0;

create table if not exists public.labels (
  id uuid primary key default gen_random_uuid(), project_id uuid not null references public.projects(id) on delete cascade,
  name text not null, color text not null default '#6b7280', created_at timestamptz not null default now(),
  unique(project_id, name)
);
create table if not exists public.task_labels (
  task_id uuid not null references public.tasks(id) on delete cascade,
  label_id uuid not null references public.labels(id) on delete cascade,
  primary key(task_id, label_id)
);
create table if not exists public.task_checklist_items (
  id uuid primary key default gen_random_uuid(), task_id uuid not null references public.tasks(id) on delete cascade,
  content text not null check (char_length(content) between 1 and 500), is_completed boolean not null default false,
  position integer not null default 0, created_by uuid not null references public.profiles(id), created_at timestamptz not null default now()
);
create table if not exists public.task_comments (
  id uuid primary key default gen_random_uuid(), task_id uuid not null references public.tasks(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade, content text not null check (char_length(content) between 1 and 4000),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.task_attachments (
  id uuid primary key default gen_random_uuid(), task_id uuid not null references public.tasks(id) on delete cascade,
  uploaded_by uuid not null references public.profiles(id), file_name text not null, file_path text not null,
  file_size bigint, mime_type text, created_at timestamptz not null default now()
);
create table if not exists public.activity_logs (
  id uuid primary key default gen_random_uuid(), task_id uuid references public.tasks(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete set null, action text not null, details jsonb,
  created_at timestamptz not null default now()
);
create index if not exists comments_task_idx on public.task_comments(task_id, created_at);
create index if not exists checklist_task_idx on public.task_checklist_items(task_id, position);
create index if not exists activity_task_idx on public.activity_logs(task_id, created_at desc);

alter table public.sprints enable row level security;
alter table public.labels enable row level security;
alter table public.task_labels enable row level security;
alter table public.task_checklist_items enable row level security;
alter table public.task_comments enable row level security;
alter table public.task_attachments enable row level security;
alter table public.activity_logs enable row level security;

drop policy if exists "Members view sprints" on public.sprints;
create policy "Members view sprints" on public.sprints for select to authenticated using (public.is_project_manager() or public.is_project_member(project_id));
drop policy if exists "PM manages sprints" on public.sprints;
create policy "PM manages sprints" on public.sprints for all to authenticated using (public.is_project_manager()) with check (public.is_project_manager());
drop policy if exists "Members view labels" on public.labels;
create policy "Members view labels" on public.labels for select to authenticated using (public.is_project_manager() or public.is_project_member(project_id));
drop policy if exists "PM manages labels" on public.labels;
create policy "PM manages labels" on public.labels for all to authenticated using (public.is_project_manager()) with check (public.is_project_manager());
drop policy if exists "Members view task labels" on public.task_labels;
create policy "Members view task labels" on public.task_labels for select to authenticated using (exists(select 1 from public.tasks t where t.id = task_id));
drop policy if exists "PM manages task labels" on public.task_labels;
create policy "PM manages task labels" on public.task_labels for all to authenticated using (public.is_project_manager()) with check (public.is_project_manager());
drop policy if exists "Members view checklist" on public.task_checklist_items;
create policy "Members view checklist" on public.task_checklist_items for select to authenticated using (exists(select 1 from public.tasks t where t.id = task_id));
drop policy if exists "Task participants manage checklist" on public.task_checklist_items;
create policy "Task participants manage checklist" on public.task_checklist_items for all to authenticated using (public.is_project_manager() or created_by = auth.uid() or exists(select 1 from public.tasks t where t.id = task_id and t.assignee_id = auth.uid())) with check (public.is_project_manager() or created_by = auth.uid() or exists(select 1 from public.tasks t where t.id = task_id and t.assignee_id = auth.uid()));
drop policy if exists "Members view comments" on public.task_comments;
create policy "Members view comments" on public.task_comments for select to authenticated using (exists(select 1 from public.tasks t where t.id = task_id));
drop policy if exists "Members add comments" on public.task_comments;
create policy "Members add comments" on public.task_comments for insert to authenticated with check (user_id = auth.uid() and exists(select 1 from public.tasks t where t.id = task_id));
drop policy if exists "Authors manage comments" on public.task_comments;
create policy "Authors manage comments" on public.task_comments for update to authenticated using (user_id = auth.uid() or public.is_project_manager()) with check (user_id = auth.uid() or public.is_project_manager());
drop policy if exists "Authors delete comments" on public.task_comments;
create policy "Authors delete comments" on public.task_comments for delete to authenticated using (user_id = auth.uid() or public.is_project_manager());
drop policy if exists "Members view attachments" on public.task_attachments;
create policy "Members view attachments" on public.task_attachments for select to authenticated using (exists(select 1 from public.tasks t where t.id = task_id));
drop policy if exists "Members add attachments" on public.task_attachments;
create policy "Members add attachments" on public.task_attachments for insert to authenticated with check (uploaded_by = auth.uid() and exists(select 1 from public.tasks t where t.id = task_id));
drop policy if exists "Owners delete attachments" on public.task_attachments;
create policy "Owners delete attachments" on public.task_attachments for delete to authenticated using (uploaded_by = auth.uid() or public.is_project_manager());
drop policy if exists "Members view activity" on public.activity_logs;
create policy "Members view activity" on public.activity_logs for select to authenticated using (task_id is null or exists(select 1 from public.tasks t where t.id = task_id));

create or replace function public.log_task_activity()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    insert into public.activity_logs(task_id, user_id, action, details) values(new.id, auth.uid(), 'task_created', jsonb_build_object('title', new.title));
  elsif tg_op = 'UPDATE' then
    if new.status is distinct from old.status then insert into public.activity_logs(task_id,user_id,action,details) values(new.id,auth.uid(),'status_changed',jsonb_build_object('from',old.status,'to',new.status)); end if;
    if new.assignee_id is distinct from old.assignee_id then insert into public.activity_logs(task_id,user_id,action,details) values(new.id,auth.uid(),'assignee_changed',jsonb_build_object('assignee_id',new.assignee_id)); end if;
    if new.title is distinct from old.title or new.description is distinct from old.description or new.due_date is distinct from old.due_date then insert into public.activity_logs(task_id,user_id,action,details) values(new.id,auth.uid(),'task_updated',null); end if;
  end if;
  return new;
end; $$;
drop trigger if exists task_activity_trigger on public.tasks;
create trigger task_activity_trigger after insert or update on public.tasks for each row execute procedure public.log_task_activity();

insert into storage.buckets(id, name, public) values('task-attachments','task-attachments',false) on conflict(id) do nothing;
drop policy if exists "Authenticated users upload task files" on storage.objects;
create policy "Authenticated users upload task files" on storage.objects for insert to authenticated with check (bucket_id = 'task-attachments' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "Authenticated users read task files" on storage.objects;
create policy "Authenticated users read task files" on storage.objects for select to authenticated using (bucket_id = 'task-attachments');
drop policy if exists "Owners delete task files" on storage.objects;
create policy "Owners delete task files" on storage.objects for delete to authenticated using (bucket_id = 'task-attachments' and owner_id = auth.uid()::text);

drop policy if exists "Authenticated users can view profiles" on public.profiles;
create policy "Authenticated users can view profiles" on public.profiles for select to authenticated using (true);
drop policy if exists "Users can update self or PM updates all" on public.profiles;
create policy "Users can update self or PM updates all" on public.profiles for update to authenticated using (id = auth.uid() or public.is_project_manager()) with check (id = auth.uid() or public.is_project_manager());

drop policy if exists "Users can view available projects" on public.projects;
create policy "Users can view available projects" on public.projects for select to authenticated using (public.is_project_manager() or public.is_project_member(id));
drop policy if exists "PM manages projects" on public.projects;
create policy "PM manages projects" on public.projects for all to authenticated using (public.is_project_manager()) with check (public.is_project_manager());

drop policy if exists "Users view their project memberships" on public.project_members;
create policy "Users view their project memberships" on public.project_members for select to authenticated using (user_id = auth.uid() or public.is_project_manager());
drop policy if exists "PM manages project memberships" on public.project_members;
create policy "PM manages project memberships" on public.project_members for all to authenticated using (public.is_project_manager()) with check (public.is_project_manager());

drop policy if exists "Users view available tasks" on public.tasks;
create policy "Users view available tasks" on public.tasks for select to authenticated using (public.is_project_manager() or assignee_id = auth.uid() or public.is_project_member(project_id));
drop policy if exists "PM creates tasks" on public.tasks;
create policy "PM creates tasks" on public.tasks for insert to authenticated with check (public.is_project_manager());
drop policy if exists "PM or assignee updates tasks" on public.tasks;
create policy "PM or assignee updates tasks" on public.tasks for update to authenticated using (public.is_project_manager() or assignee_id = auth.uid()) with check (public.is_project_manager() or assignee_id = auth.uid());
drop policy if exists "PM deletes tasks" on public.tasks;
create policy "PM deletes tasks" on public.tasks for delete to authenticated using (public.is_project_manager());

drop policy if exists "Users view own time, PM views all" on public.time_entries;
create policy "Users view own time, PM views all" on public.time_entries for select to authenticated using (user_id = auth.uid() or public.is_project_manager());
drop policy if exists "Users create own time" on public.time_entries;
create policy "Users create own time" on public.time_entries for insert to authenticated with check (user_id = auth.uid());
drop policy if exists "Users update own time, PM updates all" on public.time_entries;
create policy "Users update own time, PM updates all" on public.time_entries for update to authenticated using (user_id = auth.uid() or public.is_project_manager()) with check (user_id = auth.uid() or public.is_project_manager());
drop policy if exists "Users delete own time, PM deletes all" on public.time_entries;
create policy "Users delete own time, PM deletes all" on public.time_entries for delete to authenticated using (user_id = auth.uid() or public.is_project_manager());

grant usage on schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant execute on function public.is_project_manager() to authenticated;
grant execute on function public.is_project_member(uuid) to authenticated;

-- Existing auth users created before this schema can be backfilled with:
insert into public.profiles(id, full_name, email, role)
select id, coalesce(raw_user_meta_data->>'full_name', split_part(email, '@', 1)), coalesce(email, ''),
  case when row_number() over(order by created_at) = 1 then 'project_manager'::public.app_role else 'developer'::public.app_role end
from auth.users on conflict (id) do nothing;

-- Hardened authorization rules are maintained in the migration below. Keep
-- fresh environments aligned with production by applying all migrations after
-- this baseline schema.
