create index if not exists tracker_preferences_active_task_idx
  on public.tracker_preferences(active_task_id)
  where active_task_id is not null;

create index if not exists activity_sessions_time_entry_idx
  on public.activity_sessions(time_entry_id)
  where time_entry_id is not null;
