-- Every authenticated employee works from the same company project catalog.
-- Project membership is no longer a prerequisite for creating a personal task.
alter policy "Users can view available projects" on public.projects
  using (true);

alter policy "Members view sprints" on public.sprints
  using (true);

alter policy "Members view labels" on public.labels
  using (true);

drop policy if exists "PM creates tasks" on public.tasks;
drop policy if exists "PM or project members create tasks" on public.tasks;
drop policy if exists "PM or staff create self-assigned tasks" on public.tasks;

create policy "PM or staff create self-assigned tasks"
on public.tasks
for insert
to authenticated
with check (
  private.is_project_manager()
  or (
    created_by = (select auth.uid())
    and assignee_id = (select auth.uid())
  )
);
