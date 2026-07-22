-- Remote migration version: 20260721093222.
-- Keep authorization helpers outside the exposed public schema so they cannot
-- be invoked as Data API RPC endpoints.
create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

create or replace function private.is_project_manager()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles
    where id = (select auth.uid())
      and role = 'project_manager'
  )
$$;

create or replace function private.is_project_member(target_project uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.project_members
    where project_id = target_project
      and user_id = (select auth.uid())
  )
$$;

revoke all on function private.is_project_manager() from public, anon;
revoke all on function private.is_project_member(uuid) from public, anon;
grant execute on function private.is_project_manager() to authenticated;
grant execute on function private.is_project_member(uuid) to authenticated;

alter function public.set_updated_at() set search_path = '';

create or replace function public.protect_profile_role()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.role is distinct from old.role and not private.is_project_manager() then
    raise exception 'Only Project Managers can change employee roles';
  end if;
  return new;
end;
$$;

-- Trigger functions are invoked by Postgres, never directly by API clients.
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.add_task_assignee_to_project() from public, anon, authenticated;
revoke execute on function public.protect_profile_role() from public, anon, authenticated;
revoke execute on function public.log_task_activity() from public, anon, authenticated;

alter policy "Authenticated users can view profiles" on public.profiles
  using (id = (select auth.uid()) or private.is_project_manager());
alter policy "Users can update self or PM updates all" on public.profiles
  using (id = (select auth.uid()) or private.is_project_manager())
  with check (id = (select auth.uid()) or private.is_project_manager());

alter policy "Users can view available projects" on public.projects
  using (private.is_project_manager() or private.is_project_member(id));
alter policy "PM manages projects" on public.projects
  using (private.is_project_manager()) with check (private.is_project_manager());

alter policy "Users view their project memberships" on public.project_members
  using (user_id = (select auth.uid()) or private.is_project_manager());
alter policy "PM manages project memberships" on public.project_members
  using (private.is_project_manager()) with check (private.is_project_manager());

-- Core access rule: PM sees every task; employees only see assigned tasks.
alter policy "Users view available tasks" on public.tasks
  using (private.is_project_manager() or assignee_id = (select auth.uid()));
alter policy "PM creates tasks" on public.tasks
  with check (private.is_project_manager());
alter policy "PM or assignee updates tasks" on public.tasks
  using (private.is_project_manager() or assignee_id = (select auth.uid()))
  with check (private.is_project_manager() or assignee_id = (select auth.uid()));
alter policy "PM deletes tasks" on public.tasks
  using (private.is_project_manager());

alter policy "Users view own time, PM views all" on public.time_entries
  using (user_id = (select auth.uid()) or private.is_project_manager());
alter policy "Users create own time" on public.time_entries
  with check (user_id = (select auth.uid()));
alter policy "Users update own time, PM updates all" on public.time_entries
  using (user_id = (select auth.uid()) or private.is_project_manager())
  with check (user_id = (select auth.uid()) or private.is_project_manager());
alter policy "Users delete own time, PM deletes all" on public.time_entries
  using (user_id = (select auth.uid()) or private.is_project_manager());

alter policy "Members view sprints" on public.sprints
  using (private.is_project_manager() or private.is_project_member(project_id));
alter policy "PM manages sprints" on public.sprints
  using (private.is_project_manager()) with check (private.is_project_manager());
alter policy "Members view labels" on public.labels
  using (private.is_project_manager() or private.is_project_member(project_id));
alter policy "PM manages labels" on public.labels
  using (private.is_project_manager()) with check (private.is_project_manager());
alter policy "PM manages task labels" on public.task_labels
  using (private.is_project_manager()) with check (private.is_project_manager());
alter policy "Task participants manage checklist" on public.task_checklist_items
  using (
    private.is_project_manager()
    or created_by = (select auth.uid())
    or exists (select 1 from public.tasks t where t.id = task_id and t.assignee_id = (select auth.uid()))
  )
  with check (
    private.is_project_manager()
    or created_by = (select auth.uid())
    or exists (select 1 from public.tasks t where t.id = task_id and t.assignee_id = (select auth.uid()))
  );
alter policy "Authors manage comments" on public.task_comments
  using (user_id = (select auth.uid()) or private.is_project_manager())
  with check (user_id = (select auth.uid()) or private.is_project_manager());
alter policy "Authors delete comments" on public.task_comments
  using (user_id = (select auth.uid()) or private.is_project_manager());
alter policy "Owners delete attachments" on public.task_attachments
  using (uploaded_by = (select auth.uid()) or private.is_project_manager());
alter policy "Members view activity" on public.activity_logs
  using (
    private.is_project_manager()
    or (task_id is not null and exists (select 1 from public.tasks t where t.id = task_id))
  );

alter policy "Authenticated users upload task files" on storage.objects
  with check (
    bucket_id = 'task-attachments'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
alter policy "Authenticated users read task files" on storage.objects
  using (
    bucket_id = 'task-attachments'
    and (
      private.is_project_manager()
      or exists (
        select 1
        from public.task_attachments attachment
        join public.tasks task on task.id = attachment.task_id
        where attachment.file_path = storage.objects.name
          and task.assignee_id = (select auth.uid())
      )
    )
  );
alter policy "Owners delete task files" on storage.objects
  using (
    bucket_id = 'task-attachments'
    and (owner_id = (select auth.uid())::text or private.is_project_manager())
  );

drop function public.is_project_member(uuid);
drop function public.is_project_manager();
