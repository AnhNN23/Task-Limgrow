export type Role =
  | "project_manager"
  | "tester"
  | "business_analyst"
  | "ui_ux"
  | "graphic_designer"
  | "developer";
export type TaskStatus = "todo" | "in_progress" | "review" | "done";
export type TaskPriority = "low" | "medium" | "high";

export interface Profile {
  id: string;
  full_name: string;
  email: string;
  role: Role;
  avatar_url: string | null;
}

export interface Project {
  id: string;
  name: string;
  client_name: string | null;
  color: string;
  status: string;
  budget_hours: number | null;
}

export interface Task {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  due_date: string | null;
  estimated_minutes: number | null;
  project_id: string;
  assignee_id: string | null;
  sprint_id: string | null;
  position: number;
}

export interface TimeEntry {
  id: string;
  task_id: string;
  user_id: string;
  started_at: string;
  ended_at: string | null;
  duration_seconds: number;
  note: string | null;
}

export interface Sprint {
  id: string;
  project_id: string;
  name: string;
  goal: string | null;
  start_date: string | null;
  end_date: string | null;
  status: "planned" | "active" | "completed";
}

export interface Label {
  id: string;
  project_id: string;
  name: string;
  color: string;
}

export interface TaskLabel {
  task_id: string;
  label_id: string;
}
export interface ChecklistItem {
  id: string;
  task_id: string;
  content: string;
  is_completed: boolean;
  position: number;
  created_by: string;
}
export interface TaskComment {
  id: string;
  task_id: string;
  user_id: string;
  content: string;
  created_at: string;
}
export interface TaskAttachment {
  id: string;
  task_id: string;
  uploaded_by: string;
  file_name: string;
  file_path: string;
  file_size: number | null;
  mime_type: string | null;
  created_at: string;
}
export interface ActivityLog {
  id: string;
  task_id: string | null;
  user_id: string | null;
  action: string;
  details: Record<string, string> | null;
  created_at: string;
}

export interface DashboardData {
  profile: Profile;
  projects: Project[];
  tasks: Task[];
  timeEntries: TimeEntry[];
  members: Profile[];
  sprints: Sprint[];
  labels: Label[];
  taskLabels: TaskLabel[];
  checklistItems: ChecklistItem[];
  comments: TaskComment[];
  attachments: TaskAttachment[];
  activityLogs: ActivityLog[];
  mustChangePassword: boolean;
  databaseReady: boolean;
}
