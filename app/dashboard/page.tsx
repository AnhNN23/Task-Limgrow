import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import type {
  ActivityLog,
  ChecklistItem,
  DashboardData,
  Label,
  Profile,
  Project,
  Sprint,
  Task,
  TaskAttachment,
  TaskComment,
  TaskLabel,
  TimeEntry,
} from "@/lib/types";
import { Dashboard } from "./dashboard";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [
    profileResult,
    projectsResult,
    tasksResult,
    entriesResult,
    membersResult,
    sprintsResult,
    labelsResult,
    taskLabelsResult,
    checklistResult,
    commentsResult,
    attachmentsResult,
    activityResult,
  ] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(),
    supabase
      .from("projects")
      .select("*")
      .order("created_at", { ascending: false }),
    supabase
      .from("tasks")
      .select("*")
      .order("created_at", { ascending: false }),
    supabase
      .from("time_entries")
      .select("*")
      .order("started_at", { ascending: false })
      .limit(2000),
    supabase.from("profiles").select("*").order("full_name"),
    supabase
      .from("sprints")
      .select("*")
      .order("start_date", { ascending: false }),
    supabase.from("labels").select("*").order("name"),
    supabase.from("task_labels").select("*"),
    supabase.from("task_checklist_items").select("*").order("position"),
    supabase.from("task_comments").select("*").order("created_at"),
    supabase.from("task_attachments").select("*").order("created_at"),
    supabase
      .from("activity_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100),
  ]);

  const fallbackProfile: Profile = {
    id: user.id,
    full_name: String(
      user.user_metadata.full_name ?? user.email?.split("@")[0] ?? "Thành viên",
    ),
    email: user.email ?? "",
    role:
      (user.user_metadata.role as Profile["role"] | undefined) ?? "developer",
    avatar_url: null,
  };
  const databaseReady =
    !profileResult.error &&
    !projectsResult.error &&
    !tasksResult.error &&
    !sprintsResult.error &&
    !commentsResult.error &&
    !checklistResult.error;
  const data: DashboardData = {
    profile: (profileResult.data as Profile | null) ?? fallbackProfile,
    projects: (projectsResult.data as Project[] | null) ?? [],
    tasks: (tasksResult.data as Task[] | null) ?? [],
    timeEntries: (entriesResult.data as TimeEntry[] | null) ?? [],
    members: (membersResult.data as Profile[] | null) ?? [fallbackProfile],
    sprints: (sprintsResult.data as Sprint[] | null) ?? [],
    labels: (labelsResult.data as Label[] | null) ?? [],
    taskLabels: (taskLabelsResult.data as TaskLabel[] | null) ?? [],
    checklistItems: (checklistResult.data as ChecklistItem[] | null) ?? [],
    comments: (commentsResult.data as TaskComment[] | null) ?? [],
    attachments: (attachmentsResult.data as TaskAttachment[] | null) ?? [],
    activityLogs: (activityResult.data as ActivityLog[] | null) ?? [],
    mustChangePassword: user.user_metadata.must_change_password === true,
    databaseReady,
  };

  return <Dashboard initialData={data} />;
}
