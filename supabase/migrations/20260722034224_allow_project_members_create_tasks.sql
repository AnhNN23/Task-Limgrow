-- PMs may create and assign any task. Other roles may create only a task that
-- belongs to a project they participate in, and it must be owned/assigned to
-- themselves. This keeps browser-side task creation safe under RLS.
drop policy if exists "PM creates tasks" on public.tasks;
drop policy if exists "PM or project members create tasks" on public.tasks;

create policy "PM or project members create tasks"
on public.tasks
for insert
to authenticated
with check (
  private.is_project_manager()
  or (
    created_by = (select auth.uid())
    and assignee_id = (select auth.uid())
    and private.is_project_member(project_id)
  )
);
