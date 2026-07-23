"use client";

import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useState,
  type FormEvent,
} from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import {
  BarChart3,
  AlertTriangle,
  Bell,
  BookOpen,
  BriefcaseBusiness,
  CalendarDays,
  Check,
  ChevronDown,
  CircleStop,
  FolderKanban,
  Grid2X2,
  HelpCircle,
  LayoutDashboard,
  ListTodo,
  LogOut,
  MonitorDot,
  Menu,
  Play,
  Plus,
  Search,
  Sparkles,
  Timer,
  Users,
  X,
  UserPlus,
  KeyRound,
  Loader2,
  Eye,
  EyeOff,
  Pencil,
  Trash2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { createClient } from "@/utils/supabase/client";
import { cn, formatDuration, initials, runningSeconds } from "@/lib/utils";
import type {
  DashboardData,
  Profile,
  Project,
  Role,
  Task,
  TaskPriority,
  TaskStatus,
  TimeEntry,
} from "@/lib/types";
import { TaskWorkspace } from "./task-workspace";
import { useToast } from "@/components/ui/toast";
import {
  createEmployee,
  deleteEmployee,
  stopTimer,
  updateEmployee,
} from "./actions";
import { ProductGuide } from "@/components/product-guide";
import { AdminReports } from "./admin-reports";
import { ActivityTracking } from "./activity-tracking";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { DatePicker } from "@/components/ui/date-picker";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { SelectField } from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { LanguageSwitcher, useI18n } from "@/lib/i18n";

type View = "overview" | "tasks" | "projects" | "team" | "tracking" | "reports";
const statusMeta: Record<TaskStatus, { label: string; style: string }> = {
  todo: { label: "Cần làm", style: "bg-[#eef1ef] text-[#56605c]" },
  in_progress: { label: "Đang làm", style: "bg-[#e3f2ff] text-[#25658f]" },
  review: { label: "Đang duyệt", style: "bg-[#fff1d8] text-[#93641f]" },
  done: { label: "Hoàn thành", style: "bg-[#eeeefe] text-[#130b5c]" },
};
const priorityMeta: Record<TaskPriority, { label: string; dot: string }> = {
  low: { label: "Thấp", dot: "bg-[#8b9691]" },
  medium: { label: "Vừa", dot: "bg-[#d79b37]" },
  high: { label: "Cao", dot: "bg-[#d44f4f]" },
};
const nav = [
  { id: "overview" as const, label: "Tổng quan", icon: LayoutDashboard },
  { id: "tasks" as const, label: "Công việc", icon: ListTodo },
  { id: "projects" as const, label: "Dự án", icon: FolderKanban },
  { id: "team" as const, label: "Thành viên", icon: Users },
  { id: "tracking" as const, label: "Theo dõi", icon: MonitorDot },
  { id: "reports" as const, label: "Báo cáo", icon: BarChart3 },
];
const roleLabels = {
  project_manager: "Project Manager",
  tester: "Tester / QA",
  business_analyst: "Business Analyst",
  ui_ux: "UI/UX Designer",
  graphic_designer: "Graphic Designer",
  developer: "Developer",
} as const;
const TIMER_REFRESH_MS = 250;

export function Dashboard({ initialData }: { initialData: DashboardData }) {
  const router = useRouter();
  const { toast } = useToast();
  const { tr, locale } = useI18n();
  const [data, setData] = useState(initialData);
  const [view, setView] = useState<View>("overview");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [dialog, setDialog] = useState<"task" | "project" | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(0);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [employeeDialog, setEmployeeDialog] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);
  const updateDashboardData = useCallback(
    (updater: (current: DashboardData) => DashboardData) => setData(updater),
    [],
  );

  const activeEntry = data.timeEntries.find(
    (entry) => !entry.ended_at && entry.user_id === data.profile.id,
  );
  useEffect(() => {
    if (!activeEntry) return;
    const tick = () => setNow(Date.now());
    tick();
    const timer = window.setInterval(tick, TIMER_REFRESH_MS);
    return () => window.clearInterval(timer);
  }, [activeEntry]);

  const todayKey = new Date().toDateString();
  const todaySeconds = data.timeEntries.reduce((sum, entry) => {
    if (new Date(entry.started_at).toDateString() !== todayKey) return sum;
    const running = entry.ended_at ? 0 : runningSeconds(entry.started_at, now);
    return sum + entry.duration_seconds + running;
  }, 0);
  const weekSeconds = data.timeEntries.reduce((sum, entry) => {
    const daysAgo = (now - new Date(entry.started_at).getTime()) / 86400000;
    return daysAgo <= 7
      ? sum +
          entry.duration_seconds +
          (!entry.ended_at ? runningSeconds(entry.started_at, now) : 0)
      : sum;
  }, 0);
  const filteredTasks = useMemo(
    () =>
      data.tasks.filter((task) =>
        task.title.toLowerCase().includes(query.toLowerCase()),
      ),
    [data.tasks, query],
  );
  const isManager = data.profile.role === "project_manager";
  function reportError(message: string) {
    setError(message);
    toast({
      title: tr("Không thể hoàn tất thao tác", "Unable to complete the action"),
      description: message,
      variant: "error",
      duration: 6000,
    });
  }

  async function signOut() {
    await createClient().auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  async function toggleTimer(task: Task) {
    if (busy) return;
    setBusy(true);
    setError(null);
    const supabase = createClient();
    if (activeEntry) {
      const result = await stopTimer(activeEntry.id);
      if (!result.ok) {
        reportError(result.message);
        setBusy(false);
        return;
      }

      const savedEntry = result.entry;
      const updatedEntries = data.timeEntries.map((entry) =>
        entry.id === activeEntry.id ? savedEntry : entry,
      );
      const taskTotalSeconds = updatedEntries
        .filter(
          (entry) =>
            entry.task_id === savedEntry.task_id &&
            entry.user_id === savedEntry.user_id,
        )
        .reduce((sum, entry) => sum + entry.duration_seconds, 0);
      setData((current) => ({
        ...current,
        timeEntries: current.timeEntries.map((entry) =>
          entry.id === activeEntry.id ? savedEntry : entry,
        ),
      }));
      toast({
        title: tr("Đã dừng bấm giờ", "Timer stopped"),
        description: tr(
          `Phiên này: ${formatDuration(savedEntry.duration_seconds)} · Tổng task: ${formatDuration(taskTotalSeconds)}.`,
          `This session: ${formatDuration(savedEntry.duration_seconds)} · Task total: ${formatDuration(taskTotalSeconds)}.`,
        ),
        variant: "success",
      });
    }
    if (!activeEntry || activeEntry.task_id !== task.id) {
      const { data: entry, error: startError } = await supabase
        .from("time_entries")
        .insert({
          task_id: task.id,
          user_id: data.profile.id,
          started_at: new Date().toISOString(),
        })
        .select()
        .single();
      if (startError) reportError(startError.message);
      else {
        setData((current) => ({
          ...current,
          timeEntries: [entry as TimeEntry, ...current.timeEntries],
          tasks: current.tasks.map((item) =>
            item.id === task.id && item.status === "todo"
              ? { ...item, status: "in_progress" }
              : item,
          ),
        }));
        if (task.status === "todo")
          await supabase
            .from("tasks")
            .update({ status: "in_progress" })
            .eq("id", task.id);
        toast({
          title: tr("Timer đang chạy", "Timer is running"),
          description: task.title,
          variant: "success",
        });
      }
    }
    setBusy(false);
  }

  async function updateTaskStatus(task: Task, status: TaskStatus) {
    const { error: updateError } = await createClient()
      .from("tasks")
      .update({ status })
      .eq("id", task.id);
    if (updateError) reportError(updateError.message);
    else {
      setData((current) => ({
        ...current,
        tasks: current.tasks.map((item) =>
          item.id === task.id ? { ...item, status } : item,
        ),
      }));
      toast({
        title: tr("Đã cập nhật trạng thái", "Status updated"),
        description: `${task.title} → ${tr(statusMeta[status].label, ({ todo: "To do", in_progress: "In progress", review: "In review", done: "Done" } as const)[status])}`,
        variant: "success",
        duration: 2500,
      });
    }
  }

  async function createTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const form = new FormData(event.currentTarget);
    const requestedAssignee = String(form.get("assignee_id") || "");
    const payload = {
      title: String(form.get("title")),
      description: String(form.get("description") || "") || null,
      project_id: String(form.get("project_id")),
      assignee_id: isManager
        ? requestedAssignee === "unassigned"
          ? null
          : requestedAssignee || null
        : data.profile.id,
      priority: String(form.get("priority")) as TaskPriority,
      due_date: String(form.get("due_date") || "") || null,
      estimated_minutes:
        Number(form.get("estimated_hours") || 0) * 60 +
          Number(form.get("estimated_minutes_part") || 0) || null,
      created_by: data.profile.id,
      sprint_id:
        String(form.get("sprint_id") || "") === "backlog"
          ? null
          : String(form.get("sprint_id") || "") || null,
    };
    const { data: task, error: createError } = await createClient()
      .from("tasks")
      .insert(payload)
      .select()
      .single();
    if (createError) reportError(createError.message);
    else {
      setData((current) => ({
        ...current,
        tasks: [task as Task, ...current.tasks],
      }));
      setDialog(null);
      toast({
        title: tr("Đã tạo task", "Task created"),
        description: payload.title,
        variant: "success",
      });
    }
    setBusy(false);
  }

  async function createProject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const form = new FormData(event.currentTarget);
    const payload = {
      name: String(form.get("name")),
      client_name: String(form.get("client_name") || "") || null,
      color: String(form.get("color")),
      budget_hours: Number(form.get("budget_hours") || 0) || null,
      created_by: data.profile.id,
    };
    const { data: project, error: createError } = await createClient()
      .from("projects")
      .insert(payload)
      .select()
      .single();
    if (createError) reportError(createError.message);
    else {
      setData((current) => ({
        ...current,
        projects: [project as Project, ...current.projects],
      }));
      setDialog(null);
      toast({
        title: tr("Đã tạo dự án", "Project created"),
        description: payload.name,
        variant: "success",
      });
    }
    setBusy(false);
  }

  return (
    <div className="min-h-screen bg-[#f7f8fa]">
      <header className="fixed inset-x-0 top-0 z-50 flex h-14 items-center gap-2 bg-[#0b063f] px-3 text-white shadow-sm md:px-4">
        <button
          onClick={() => setSidebarOpen(true)}
          className="rounded-md p-2 hover:bg-white/10 lg:hidden"
          aria-label={tr("Mở menu", "Open menu")}
        >
          <Menu size={20} />
        </button>
        <button
          className="hidden rounded-md p-2 hover:bg-white/10 lg:block"
          aria-label={tr("Mở danh sách sản phẩm", "Open product menu")}
        >
          <Grid2X2 size={19} />
        </button>
        <button
          onClick={() => setView("overview")}
          className="flex items-center gap-2 rounded-md px-1.5 py-1 hover:bg-white/10"
        >
          <Image
            src="/limgrow-logo.png"
            alt="Limgrow"
            width={30}
            height={30}
            className="h-[30px] w-[30px] rounded-lg object-cover"
          />
          <span className="hidden text-sm font-bold sm:inline">
            Limgrow Task Hub
          </span>
        </button>
        {isManager && (
          <Button
            onClick={() => setDialog(view === "projects" ? "project" : "task")}
            className="ml-1 h-8 bg-[#7d6cff] px-3 text-xs text-white hover:bg-[#8d7eff]"
          >
            <Plus size={15} />{" "}
            <span className="hidden sm:inline">{tr("Tạo", "Create")}</span>
          </Button>
        )}
        <div className="relative ml-auto hidden w-full max-w-sm md:block">
          <Search className="absolute left-3 top-2 text-white/60" size={16} />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={tr("Tìm công việc", "Search tasks")}
            className="h-8 w-full rounded-md border border-white/15 bg-white/10 pl-9 pr-3 text-xs text-white outline-none placeholder:text-white/55 focus:border-white/40 focus:bg-white/15"
          />
        </div>
        <LanguageSwitcher compact />
        <button
          onClick={() => setGuideOpen(true)}
          className="grid h-9 w-9 place-items-center rounded-md text-white/80 hover:bg-white/10 hover:text-white"
          aria-label={tr("Mở hướng dẫn sử dụng", "Open user guide")}
          title={tr("Hướng dẫn sử dụng", "User guide")}
        >
          <HelpCircle size={19} />
        </button>
        <div className="relative">
          <button
            className="relative grid h-9 w-9 place-items-center rounded-md text-white/80 hover:bg-white/10 hover:text-white"
            aria-label={tr("Mở thông báo", "Open notifications")}
            aria-expanded={notificationsOpen}
            onClick={() => setNotificationsOpen(!notificationsOpen)}
          >
            <Bell size={18} />
            <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-[#ff8f73] ring-2 ring-[#0b063f]" />
          </button>
          {notificationsOpen && (
            <div className="absolute right-0 top-11 z-50 w-[min(340px,calc(100vw-2rem))] overflow-hidden rounded-xl border border-[#dfe5e1] bg-white text-[#172b4d] shadow-xl">
              <div className="flex items-center justify-between border-b border-[#e7ebe8] px-4 py-3">
                <b className="text-sm">
                  {tr("Hoạt động gần đây", "Recent activity")}
                </b>
                <span className="text-[11px] text-[#89928e]">
                  {data.activityLogs.length} {tr("cập nhật", "updates")}
                </span>
              </div>
              <div className="max-h-80 overflow-y-auto">
                {data.activityLogs.slice(0, 8).map((log) => {
                  const member = data.members.find(
                    (item) => item.id === log.user_id,
                  );
                  return (
                    <div
                      key={log.id}
                      className="flex gap-3 border-b border-[#edf0ee] px-4 py-3 last:border-0"
                    >
                      <span className="mt-1.5 h-2 w-2 rounded-full bg-[#6957c8]" />
                      <div>
                        <p className="text-xs leading-5">
                          <b>{member?.full_name ?? tr("Hệ thống", "System")}</b>{" "}
                          {log.action.replaceAll("_", " ")}
                        </p>
                        <p className="text-[10px] text-[#929a96]">
                          {new Date(log.created_at).toLocaleString(
                            locale === "vi" ? "vi-VN" : "en-US",
                          )}
                        </p>
                      </div>
                    </div>
                  );
                })}
                {!data.activityLogs.length && (
                  <p className="p-6 text-center text-xs text-[#8b9490]">
                    {tr("Chưa có hoạt động mới", "No recent activity")}
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
        <span
          title={data.profile.full_name}
          className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#7d6cff] text-[10px] font-bold ring-2 ring-white/15"
        >
          {initials(data.profile.full_name)}
        </span>
      </header>

      {sidebarOpen && (
        <button
          className="fixed inset-0 z-30 bg-[#08042f]/35 lg:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-label="Đóng menu"
        />
      )}
      <aside
        className={cn(
          "fixed bottom-0 left-0 top-14 z-40 flex w-[240px] flex-col border-r border-[#dfe1e6] bg-[#f7f8fa] transition-transform lg:translate-x-0",
          sidebarOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="p-3">
          <div className="flex items-center gap-3 rounded-lg border border-[#dfe1e6] bg-white p-3 shadow-sm">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[#eeeefe] text-[#130b5c]">
              <BriefcaseBusiness size={18} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold text-[#172b4d]">
                Limgrow Software
              </p>
              <p className="mt-0.5 text-[10px] text-[#6b778c]">
                Company workspace
              </p>
            </div>
            <ChevronDown size={15} className="text-[#6b778c]" />
          </div>
        </div>
        <nav className="flex-1 overflow-y-auto px-3 pb-3">
          <p className="px-3 pb-2 pt-2 text-[10px] font-bold uppercase tracking-[0.12em] text-[#6b778c]">
            {tr("Làm việc", "Work")}
          </p>
          <div className="space-y-0.5">
            {nav.map((item) => (
              <button
                key={item.id}
                onClick={() => {
                  setView(item.id);
                  setSidebarOpen(false);
                }}
                className={cn(
                  "flex h-9 w-full items-center gap-3 rounded-md px-3 text-sm font-medium transition",
                  view === item.id
                    ? "bg-[#e9e7fb] font-semibold text-[#130b5c]"
                    : "text-[#44546f] hover:bg-[#ebecf0]",
                )}
              >
                <item.icon size={17} />
                {locale === "vi"
                  ? item.label
                  : (
                      {
                        overview: "Overview",
                        tasks: "Tasks",
                        projects: "Projects",
                        team: "Team",
                        tracking: "Tracking",
                        reports: "Reports",
                      } as const
                    )[item.id]}
              </button>
            ))}
          </div>
          <p className="px-3 pb-2 pt-6 text-[10px] font-bold uppercase tracking-[0.12em] text-[#6b778c]">
            {tr("Dự án gần đây", "Recent projects")}
          </p>
          <div className="space-y-0.5">
            {data.projects.slice(0, 5).map((project) => (
              <button
                key={project.id}
                onClick={() => {
                  setView("tasks");
                  setSidebarOpen(false);
                }}
                className="flex h-9 w-full items-center gap-3 rounded-md px-3 text-left text-sm text-[#44546f] hover:bg-[#ebecf0]"
              >
                <i
                  className="h-3 w-3 rounded-sm"
                  style={{ background: project.color }}
                />
                <span className="truncate">{project.name}</span>
              </button>
            ))}
            {!data.projects.length && (
              <p className="px-3 py-2 text-xs text-[#8993a4]">
                {tr("Chưa có dự án", "No projects")}
              </p>
            )}
          </div>
          <button
            onClick={() => setGuideOpen(true)}
            className="mt-5 flex h-9 w-full items-center gap-3 rounded-md px-3 text-sm font-medium text-[#44546f] hover:bg-[#ebecf0]"
          >
            <BookOpen size={17} /> {tr("Hướng dẫn sử dụng", "User guide")}
          </button>
        </nav>
        <div className="border-t border-[#dfe1e6] p-3">
          <div className="mb-3 rounded-lg bg-white p-3">
            <div className="flex items-center gap-3">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#e6e5fb] text-sm font-bold text-[#130b5c]">
                {initials(data.profile.full_name)}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold">
                  {data.profile.full_name}
                </p>
                <p className="truncate text-xs text-[#78827e]">
                  {roleLabels[data.profile.role]}
                </p>
              </div>
            </div>
          </div>
          <button
            onClick={signOut}
            className="flex h-9 w-full items-center gap-2 rounded-md px-3 text-sm font-medium text-[#5e6c84] hover:bg-[#ffebe6] hover:text-[#de350b]"
          >
            <LogOut size={17} /> {tr("Đăng xuất", "Sign out")}
          </button>
        </div>
      </aside>

      <div className="pt-14 lg:pl-[240px]">
        <main className="mx-auto max-w-[1500px] p-4 md:p-7 lg:p-8">
          {!data.databaseReady && (
            <div className="mb-6 flex items-start gap-3 rounded-xl border border-[#f1d49f] bg-[#fff8e9] p-4 text-sm text-[#76541d]">
              <Sparkles className="mt-0.5 shrink-0" size={18} />
              <div>
                <b>Database chưa được khởi tạo.</b> Chạy file{" "}
                <code>supabase/schema.sql</code> trong Supabase SQL Editor rồi
                tải lại trang để bắt đầu.
              </div>
            </div>
          )}
          {error && (
            <div className="mb-6 flex items-center justify-between rounded-xl bg-[#fff0ed] p-4 text-sm text-[#a23b2b]">
              <span>{error}</span>
              <button onClick={() => setError(null)}>
                <X size={17} />
              </button>
            </div>
          )}
          {view === "overview" && (
            <Overview
              data={data}
              tasks={filteredTasks}
              activeEntry={activeEntry}
              todaySeconds={todaySeconds}
              weekSeconds={weekSeconds}
              now={now}
              onToggleTimer={toggleTimer}
              onStatus={updateTaskStatus}
              onViewTasks={() => setView("tasks")}
              onViewTracking={() => setView("tracking")}
            />
          )}
          {view === "tasks" && (
            <TaskWorkspace
              data={data}
              query={query}
              activeEntry={activeEntry}
              isManager={isManager}
              onToggleTimer={toggleTimer}
              onStatus={updateTaskStatus}
              onDataChange={(updater) => setData(updater)}
              onCreateTask={() => setDialog("task")}
              onError={reportError}
            />
          )}
          {view === "projects" && (
            <ProjectsView
              data={data}
              isManager={isManager}
              onCreate={() => setDialog("project")}
              onDataChange={(updater) => setData(updater)}
              onError={reportError}
              onSuccess={(message) =>
                toast({ title: message, variant: "success" })
              }
            />
          )}
          {view === "team" && (
            <TeamView
              data={data}
              isManager={isManager}
              onCreate={() => setEmployeeDialog(true)}
              onDataChange={(updater) => setData(updater)}
              onError={reportError}
              onSuccess={(message) =>
                toast({ title: message, variant: "success" })
              }
            />
          )}
          {view === "reports" && (
            <AdminReports data={data} isManager={isManager} />
          )}
          {view === "tracking" && (
            <ActivityTracking
              data={data}
              isManager={isManager}
              onDataChange={updateDashboardData}
              onError={reportError}
            />
          )}
        </main>
      </div>
      {dialog === "task" && (
        <TaskDialog
          data={data}
          isManager={isManager}
          busy={busy}
          onClose={() => setDialog(null)}
          onSubmit={createTask}
        />
      )}
      {dialog === "project" && (
        <ProjectDialog
          busy={busy}
          onClose={() => setDialog(null)}
          onSubmit={createProject}
        />
      )}
      {employeeDialog && (
        <EmployeeDialog
          onClose={() => setEmployeeDialog(false)}
          onCreated={(profile) => {
            setData((current) => ({
              ...current,
              members: [...current.members, profile],
            }));
            setEmployeeDialog(false);
            toast({
              title: tr("Đã tạo tài khoản nhân sự", "Employee account created"),
              description: tr(
                `${profile.full_name} có thể đăng nhập ngay.`,
                `${profile.full_name} can sign in now.`,
              ),
              variant: "success",
            });
          }}
          onError={reportError}
        />
      )}
      <ProductGuide
        open={guideOpen}
        onClose={() => setGuideOpen(false)}
        onNavigate={(destination) => setView(destination)}
      />
      {data.mustChangePassword && (
        <ChangePasswordDialog
          onChanged={() => {
            setData((current) => ({ ...current, mustChangePassword: false }));
            toast({
              title: tr("Đã đổi mật khẩu", "Password changed"),
              description: tr(
                "Tài khoản của bạn đã được bảo vệ.",
                "Your account is now protected.",
              ),
              variant: "success",
            });
          }}
          onError={reportError}
        />
      )}
    </div>
  );
}

function Overview({
  data,
  tasks,
  activeEntry,
  todaySeconds,
  weekSeconds,
  now,
  onToggleTimer,
  onStatus,
  onViewTasks,
  onViewTracking,
}: {
  data: DashboardData;
  tasks: Task[];
  activeEntry?: TimeEntry;
  todaySeconds: number;
  weekSeconds: number;
  now: number;
  onToggleTimer: (task: Task) => void;
  onStatus: (task: Task, status: TaskStatus) => void;
  onViewTasks: () => void;
  onViewTracking: () => void;
}) {
  const { tr, dateLocale } = useI18n();
  const activeTask = data.tasks.find(
    (task) => task.id === activeEntry?.task_id,
  );
  const done = data.tasks.filter((task) => task.status === "done").length;
  const activeSessionElapsed = activeEntry
    ? runningSeconds(activeEntry.started_at, now)
    : 0;
  const activeTaskElapsed = activeEntry
    ? data.timeEntries
        .filter(
          (entry) =>
            entry.task_id === activeEntry.task_id &&
            entry.user_id === data.profile.id,
        )
        .reduce(
          (sum, entry) =>
            sum +
            entry.duration_seconds +
            (entry.ended_at ? 0 : runningSeconds(entry.started_at, now)),
          0,
        )
    : 0;
  const timerNeedsReview = activeSessionElapsed >= 4 * 60 * 60;
  const timerMayBeForgotten = activeSessionElapsed >= 8 * 60 * 60;
  return (
    <>
      <div className="mb-7 flex items-end justify-between">
        <div>
          <p className="text-sm font-semibold text-[#130b5c]">
            {new Intl.DateTimeFormat(dateLocale, {
              weekday: "long",
              day: "2-digit",
              month: "long",
            }).format(new Date())}
          </p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">
            {tr(
              `Chào ${data.profile.full_name.split(" ").at(-1)}, hôm nay làm gì?`,
              `Hello ${data.profile.full_name.split(" ").at(-1)}, what are you working on today?`,
            )}
          </h1>
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Stat
          icon={Timer}
          label={tr("Hôm nay", "Today")}
          value={formatDuration(todaySeconds)}
          note={tr("thời gian đã ghi", "time logged")}
          color="green"
        />
        <Stat
          icon={CalendarDays}
          label={tr("Tuần này", "This week")}
          value={`${(weekSeconds / 3600).toFixed(1)}h`}
          note={tr("trong 7 ngày gần nhất", "in the last 7 days")}
          color="blue"
        />
        <Stat
          icon={ListTodo}
          label={tr("Đang thực hiện", "In progress")}
          value={String(
            data.tasks.filter((task) => task.status === "in_progress").length,
          )}
          note={tr(
            `${data.tasks.length - done} công việc còn lại`,
            `${data.tasks.length - done} tasks remaining`,
          )}
          color="orange"
        />
        <Stat
          icon={Check}
          label={tr("Hoàn thành", "Completed")}
          value={String(done)}
          note={tr(
            `${data.tasks.length ? Math.round((done / data.tasks.length) * 100) : 0}% tổng công việc`,
            `${data.tasks.length ? Math.round((done / data.tasks.length) * 100) : 0}% of all tasks`,
          )}
          color="purple"
        />
      </div>
      {activeEntry && activeTask && (
        <Card
          className={cn(
            "mt-6 flex flex-col gap-4 p-5 md:flex-row md:items-center",
            timerMayBeForgotten
              ? "border-[#f0b8b1] bg-[#fff1f0]"
              : timerNeedsReview
                ? "border-[#f1d58a] bg-[#fff7d6]"
                : "border-[#a9d7c7] bg-[#f0faf6]",
          )}
        >
          <div className="flex flex-1 items-center gap-4">
            {timerNeedsReview ? (
              <AlertTriangle
                className={cn(
                  "size-5 shrink-0",
                  timerMayBeForgotten ? "text-[#ae2a19]" : "text-[#7f5f01]",
                )}
              />
            ) : (
              <span className="timer-dot h-3 w-3 rounded-full bg-[#11a071]" />
            )}
            <div>
              <p
                className={cn(
                  "text-xs font-bold uppercase tracking-wider",
                  timerMayBeForgotten
                    ? "text-[#ae2a19]"
                    : timerNeedsReview
                      ? "text-[#7f5f01]"
                      : "text-[#16805f]",
                )}
              >
                {timerMayBeForgotten
                  ? tr("Có thể quên dừng timer", "Timer may be forgotten")
                  : timerNeedsReview
                    ? tr("Timer đang chạy lâu", "Long-running timer")
                    : tr("Đang bấm giờ", "Timer running")}
              </p>
              <p className="mt-1 font-semibold">{activeTask.title}</p>
            </div>
          </div>
          <div className="font-mono text-2xl font-semibold">
            {formatDuration(activeTaskElapsed)}
          </div>
          {timerNeedsReview && (
            <Button variant="outline" onClick={onViewTracking}>
              <Pencil /> {tr("Kiểm tra & chỉnh giờ", "Review & adjust")}
            </Button>
          )}
          <Button variant="danger" onClick={() => onToggleTimer(activeTask)}>
            <CircleStop size={17} /> {tr("Dừng", "Stop")}
          </Button>
        </Card>
      )}
      <Card className="mt-6 overflow-hidden">
        <div className="flex items-center justify-between border-b border-[#e6eae8] px-5 py-4">
          <div>
            <h2 className="font-semibold">
              {tr("Công việc gần đây", "Recent tasks")}
            </h2>
            <p className="mt-1 text-xs text-[#75807b]">
              {tr(
                "Ưu tiên những việc cần hoàn thành",
                "Focus on work that needs attention",
              )}
            </p>
          </div>
          <Button variant="ghost" size="sm" onClick={onViewTasks}>
            {tr("Xem tất cả", "View all")}
          </Button>
        </div>
        <TaskTable
          data={data}
          tasks={tasks.slice(0, 6)}
          activeEntry={activeEntry}
          onToggleTimer={onToggleTimer}
          onStatus={onStatus}
        />
      </Card>
    </>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
  note,
  color,
}: {
  icon: typeof Timer;
  label: string;
  value: string;
  note: string;
  color: string;
}) {
  const colors: Record<string, string> = {
    green: "bg-[#eeeefe] text-[#130b5c]",
    blue: "bg-[#e7f2fb] text-[#35729a]",
    orange: "bg-[#fff0df] text-[#a26319]",
    purple: "bg-[#f0eafb] text-[#7153a6]",
  };
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-[#6f7974]">{label}</p>
          <p className="mt-2 text-3xl font-semibold tracking-tight">{value}</p>
        </div>
        <span
          className={cn(
            "grid h-10 w-10 place-items-center rounded-xl",
            colors[color],
          )}
        >
          <Icon size={20} />
        </span>
      </div>
      <p className="mt-4 text-xs text-[#8a938f]">{note}</p>
    </Card>
  );
}

function TaskTable({
  data,
  tasks,
  activeEntry,
  onToggleTimer,
  onStatus,
}: {
  data: DashboardData;
  tasks: Task[];
  activeEntry?: TimeEntry;
  onToggleTimer: (task: Task) => void;
  onStatus: (task: Task, status: TaskStatus) => void;
}) {
  const { tr, dateLocale } = useI18n();
  if (!tasks.length)
    return (
      <Empty
        icon={ListTodo}
        title={tr("Chưa có công việc", "No tasks yet")}
        text={tr(
          "Tạo công việc đầu tiên để bắt đầu theo dõi tiến độ.",
          "Create the first task to start tracking progress.",
        )}
      />
    );
  return (
    <Table className="min-w-[760px]">
      <TableHeader>
        <TableRow>
          <TableHead className="px-5">{tr("Công việc", "Task")}</TableHead>
          <TableHead>{tr("Dự án", "Project")}</TableHead>
          <TableHead>{tr("Ưu tiên", "Priority")}</TableHead>
          <TableHead>{tr("Trạng thái", "Status")}</TableHead>
          <TableHead className="px-5 text-right">
            {tr("Thời gian", "Time")}
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {tasks.map((task) => {
          const project = data.projects.find(
            (item) => item.id === task.project_id,
          );
          const member = data.members.find(
            (item) => item.id === task.assignee_id,
          );
          const isRunning = activeEntry?.task_id === task.id;
          const seconds = data.timeEntries
            .filter((entry) => entry.task_id === task.id)
            .reduce(
              (sum, entry) =>
                sum +
                entry.duration_seconds +
                (entry.ended_at ? 0 : runningSeconds(entry.started_at)),
              0,
            );
          return (
            <TableRow key={task.id}>
              <TableCell className="px-5 py-4">
                <div>
                  <p className="text-sm font-semibold">{task.title}</p>
                  <p className="mt-1 text-xs text-[#89928e]">
                    {member?.full_name ?? tr("Chưa giao", "Unassigned")}
                    {task.due_date
                      ? ` · ${new Date(task.due_date).toLocaleDateString(dateLocale)}`
                      : ""}
                  </p>
                </div>
              </TableCell>
              <TableCell>
                <span className="flex items-center gap-2 text-sm">
                  <i
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ background: project?.color ?? "#9aa39f" }}
                  />
                  {project?.name ?? "—"}
                </span>
              </TableCell>
              <TableCell>
                <span className="flex items-center gap-2 text-sm">
                  <i
                    className={cn(
                      "h-2 w-2 rounded-full",
                      priorityMeta[task.priority].dot,
                    )}
                  />
                  {tr(
                    priorityMeta[task.priority].label,
                    ({ low: "Low", medium: "Medium", high: "High" } as const)[
                      task.priority
                    ],
                  )}
                </span>
              </TableCell>
              <TableCell>
                <SelectField
                  value={task.status}
                  onValueChange={(value) => onStatus(task, value as TaskStatus)}
                  className={cn(
                    "h-8 w-auto min-w-28 rounded-full border-0 text-xs font-semibold shadow-none",
                    statusMeta[task.status].style,
                  )}
                  options={Object.entries(statusMeta).map(([value, meta]) => ({
                    value,
                    label: tr(
                      meta.label,
                      (
                        {
                          todo: "To do",
                          in_progress: "In progress",
                          review: "In review",
                          done: "Done",
                        } as const
                      )[value as TaskStatus],
                    ),
                  }))}
                />
              </TableCell>
              <TableCell className="px-5 text-right">
                <button
                  type="button"
                  onClick={() => onToggleTimer(task)}
                  aria-label={
                    isRunning
                      ? tr(
                          `Dừng timer ${task.title}`,
                          `Stop timer ${task.title}`,
                        )
                      : tr(
                          `Bắt đầu timer ${task.title}`,
                          `Start timer ${task.title}`,
                        )
                  }
                  className={cn(
                    "ml-auto inline-flex items-center gap-2 rounded-md px-2.5 py-1.5 font-mono text-xs font-semibold transition",
                    isRunning
                      ? "bg-[#ffebe8] text-[#c44343]"
                      : "bg-[#e8f5f0] text-[#130b5c] hover:bg-[#dcefe8]",
                  )}
                >
                  {isRunning ? (
                    <CircleStop size={13} />
                  ) : (
                    <Play size={13} fill="currentColor" />
                  )}
                  {formatDuration(seconds)}
                </button>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}

function ProjectsView({
  data,
  isManager,
  onCreate,
  onDataChange,
  onError,
  onSuccess,
}: {
  data: DashboardData;
  isManager: boolean;
  onCreate: () => void;
  onDataChange: (updater: (current: DashboardData) => DashboardData) => void;
  onError: (message: string) => void;
  onSuccess: (message: string) => void;
}) {
  const { tr } = useI18n();
  const [editing, setEditing] = useState<Project | null>(null);
  const [deleting, setDeleting] = useState<Project | null>(null);
  const [busy, setBusy] = useState(false);

  async function updateProject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editing) return;
    setBusy(true);
    const form = new FormData(event.currentTarget);
    const patch = {
      name: String(form.get("name")),
      client_name: String(form.get("client_name") || "") || null,
      color: String(form.get("color")),
      budget_hours: Number(form.get("budget_hours") || 0) || null,
      status: String(form.get("status")),
    };
    const { error } = await createClient()
      .from("projects")
      .update(patch)
      .eq("id", editing.id);
    setBusy(false);
    if (error) onError(error.message);
    else {
      onDataChange((current) => ({
        ...current,
        projects: current.projects.map((project) =>
          project.id === editing.id ? { ...project, ...patch } : project,
        ),
      }));
      onSuccess(tr("Đã cập nhật dự án", "Project updated"));
      setEditing(null);
    }
  }

  async function removeProject() {
    if (!deleting) return;
    setBusy(true);
    const { error } = await createClient()
      .from("projects")
      .delete()
      .eq("id", deleting.id);
    setBusy(false);
    if (error) onError(error.message);
    else {
      onDataChange((current) => ({
        ...current,
        projects: current.projects.filter(
          (project) => project.id !== deleting.id,
        ),
        tasks: current.tasks.filter((task) => task.project_id !== deleting.id),
        sprints: current.sprints.filter(
          (sprint) => sprint.project_id !== deleting.id,
        ),
        labels: current.labels.filter(
          (label) => label.project_id !== deleting.id,
        ),
      }));
      onSuccess(tr("Đã xóa dự án", "Project deleted"));
      setDeleting(null);
    }
  }

  return (
    <>
      <div className="mb-7 flex items-end justify-between">
        <PageTitle
          title={tr("Dự án", "Projects")}
          subtitle={tr(
            "Theo dõi ngân sách và tiến độ theo khách hàng",
            "Track budget and progress by client",
          )}
        />
        {isManager && (
          <Button onClick={onCreate}>
            <Plus size={18} /> {tr("Dự án mới", "New project")}
          </Button>
        )}
      </div>
      {!data.projects.length ? (
        <Card>
          <Empty
            icon={FolderKanban}
            title={tr("Chưa có dự án", "No projects yet")}
            text={tr(
              "Tạo dự án để gom công việc và theo dõi ngân sách.",
              "Create a project to group tasks and track budget.",
            )}
          />
        </Card>
      ) : (
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {data.projects.map((project) => {
            const projectTasks = data.tasks.filter(
              (task) => task.project_id === project.id,
            );
            const done = projectTasks.filter(
              (task) => task.status === "done",
            ).length;
            const progress = projectTasks.length
              ? Math.round((done / projectTasks.length) * 100)
              : 0;
            return (
              <Card key={project.id} className="p-5">
                <div className="flex items-start justify-between">
                  <span
                    className="grid h-11 w-11 place-items-center rounded-xl text-white"
                    style={{ background: project.color }}
                  >
                    <BriefcaseBusiness size={20} />
                  </span>
                  {isManager && (
                    <div className="flex">
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={tr("Sửa dự án", "Edit project")}
                        onClick={() => setEditing(project)}
                      >
                        <Pencil size={16} />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={tr("Xóa dự án", "Delete project")}
                        onClick={() => setDeleting(project)}
                      >
                        <Trash2 size={16} className="text-[#c54141]" />
                      </Button>
                    </div>
                  )}
                </div>
                <h3 className="mt-5 text-lg font-semibold">{project.name}</h3>
                <p className="mt-1 text-sm text-[#79837e]">
                  {project.client_name ??
                    tr("Dự án nội bộ", "Internal project")}
                </p>
                <div className="mt-6 flex items-center justify-between text-xs">
                  <span className="font-semibold">
                    {tr("Tiến độ", "Progress")}
                  </span>
                  <span className="text-[#6d7772]">{progress}%</span>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-[#edf0ee]">
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${progress}%`, background: project.color }}
                  />
                </div>
                <div className="mt-5 flex justify-between border-t border-[#edf0ee] pt-4 text-xs text-[#717b76]">
                  <span>
                    {projectTasks.length} {tr("công việc", "tasks")}
                  </span>
                  <span>
                    {project.budget_hours ?? 0}h {tr("ngân sách", "budget")}
                  </span>
                </div>
              </Card>
            );
          })}
        </div>
      )}
      {editing && (
        <DialogShell
          title={tr("Chỉnh sửa dự án", "Edit project")}
          subtitle={tr(
            "Cập nhật thông tin, trạng thái và ngân sách.",
            "Update project details, status and budget.",
          )}
          onClose={() => setEditing(null)}
        >
          <form onSubmit={updateProject} className="mt-6 space-y-4">
            <label className="block text-sm font-semibold">
              {tr("Tên dự án", "Project name")}
              <Input
                name="name"
                required
                defaultValue={editing.name}
                className="mt-2"
              />
            </label>
            <label className="block text-sm font-semibold">
              {tr("Khách hàng", "Client")}
              <Input
                name="client_name"
                defaultValue={editing.client_name ?? ""}
                className="mt-2"
              />
            </label>
            <div className="grid grid-cols-2 gap-4">
              <label className="text-sm font-semibold">
                {tr("Màu dự án", "Project color")}
                <Input
                  name="color"
                  type="color"
                  defaultValue={editing.color}
                  className="mt-2 p-1"
                />
              </label>
              <label className="text-sm font-semibold">
                {tr("Ngân sách giờ", "Hour budget")}
                <Input
                  name="budget_hours"
                  type="number"
                  min="0"
                  defaultValue={editing.budget_hours ?? ""}
                  className="mt-2"
                />
              </label>
            </div>
            <label className="block text-sm font-semibold">
              {tr("Trạng thái", "Status")}
              <SelectField
                name="status"
                defaultValue={editing.status}
                className="mt-2"
                options={[
                  { value: "active", label: tr("Đang hoạt động", "Active") },
                  { value: "on_hold", label: tr("Tạm dừng", "On hold") },
                  { value: "completed", label: tr("Hoàn thành", "Completed") },
                  { value: "archived", label: tr("Lưu trữ", "Archived") },
                ]}
              />
            </label>
            <div className="flex justify-end gap-3 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setEditing(null)}
              >
                {tr("Hủy", "Cancel")}
              </Button>
              <Button type="submit" disabled={busy}>
                {busy
                  ? tr("Đang lưu…", "Saving…")
                  : tr("Lưu thay đổi", "Save changes")}
              </Button>
            </div>
          </form>
        </DialogShell>
      )}
      <ConfirmDialog
        open={!!deleting}
        title={tr("Xóa dự án?", "Delete project?")}
        description={tr(
          `Dự án “${deleting?.name}” cùng task, sprint, time log và dữ liệu liên quan sẽ bị xóa vĩnh viễn.`,
          `Project “${deleting?.name}” and all related tasks, sprints and time logs will be permanently deleted.`,
        )}
        confirmLabel={tr("Xóa dự án", "Delete project")}
        busy={busy}
        onConfirm={removeProject}
        onClose={() => setDeleting(null)}
      />
    </>
  );
}

function TeamView({
  data,
  isManager,
  onCreate,
  onDataChange,
  onError,
  onSuccess,
}: {
  data: DashboardData;
  isManager: boolean;
  onCreate: () => void;
  onDataChange: (updater: (current: DashboardData) => DashboardData) => void;
  onError: (message: string) => void;
  onSuccess: (message: string) => void;
}) {
  const { tr } = useI18n();
  const [editing, setEditing] = useState<Profile | null>(null);
  const [deleting, setDeleting] = useState<Profile | null>(null);
  const [pendingRole, setPendingRole] = useState<{
    member: Profile;
    role: Role;
  } | null>(null);
  const [busy, setBusy] = useState(false);

  async function saveMember(formData: FormData) {
    setBusy(true);
    const result = await updateEmployee(formData);
    setBusy(false);
    if (!result.ok) onError(result.message);
    else {
      onDataChange((current) => ({
        ...current,
        members: current.members.map((member) =>
          member.id === result.profile.id
            ? {
                ...member,
                full_name: result.profile.full_name,
                role: result.profile.role,
              }
            : member,
        ),
      }));
      onSuccess(tr("Đã cập nhật nhân sự", "Employee updated"));
      setEditing(null);
      setPendingRole(null);
    }
  }
  async function confirmRole() {
    if (!pendingRole) return;
    const form = new FormData();
    form.set("id", pendingRole.member.id);
    form.set("full_name", pendingRole.member.full_name);
    form.set("role", pendingRole.role);
    await saveMember(form);
  }
  async function removeMember() {
    if (!deleting) return;
    setBusy(true);
    const result = await deleteEmployee(deleting.id);
    setBusy(false);
    if (!result.ok) onError(result.message);
    else {
      onDataChange((current) => ({
        ...current,
        members: current.members.filter((member) => member.id !== deleting.id),
      }));
      onSuccess(tr("Đã xóa tài khoản nhân sự", "Employee account deleted"));
      setDeleting(null);
    }
  }

  return (
    <>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <PageTitle
          title={tr("Thành viên", "Team")}
          subtitle={tr(
            `${data.members.length} nhân sự trong công ty`,
            `${data.members.length} company members`,
          )}
        />
        <div className="flex items-center gap-2">
          <Badge className="bg-[#e5f4ee] text-[#130b5c]">
            {tr("PM quản lý role", "PM manages roles")}
          </Badge>
          {isManager && (
            <Button onClick={onCreate}>
              <UserPlus size={17} /> {tr("Tạo tài khoản", "Create account")}
            </Button>
          )}
        </div>
      </div>
      <div className="mt-7 overflow-hidden rounded-xl border border-[#dfe1e6] bg-white shadow-[0_1px_2px_rgba(9,30,66,.08)]">
        <Table className="min-w-[760px]">
          <TableHeader>
            <TableRow>
              <TableHead className="px-5">
                {tr("Thành viên", "Member")}
              </TableHead>
              <TableHead>{tr("Bộ phận / Role", "Department / Role")}</TableHead>
              <TableHead>{tr("Task đang làm", "Active tasks")}</TableHead>
              <TableHead>{tr("Giờ tuần này", "Hours this week")}</TableHead>
              <TableHead>{tr("Thao tác", "Actions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.members.map((member) => {
              const activeTasks = data.tasks.filter(
                (task) =>
                  task.assignee_id === member.id && task.status !== "done",
              ).length;
              const hours =
                data.timeEntries
                  .filter(
                    (entry) =>
                      entry.user_id === member.id &&
                      Date.now() - new Date(entry.started_at).getTime() <
                        7 * 86400000,
                  )
                  .reduce((sum, entry) => sum + entry.duration_seconds, 0) /
                3600;
              return (
                <TableRow key={member.id}>
                  <TableCell className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <span className="grid h-10 w-10 place-items-center rounded-full bg-[#e8e7fb] text-xs font-bold text-[#130b5c]">
                        {initials(member.full_name)}
                      </span>
                      <div>
                        <p className="text-sm font-semibold">
                          {member.full_name}
                        </p>
                        <p className="mt-0.5 text-xs text-[#7b8580]">
                          {member.email}
                        </p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    {isManager && member.id !== data.profile.id ? (
                      <SelectField
                        value={member.role}
                        onValueChange={(value) =>
                          setPendingRole({ member, role: value as Role })
                        }
                        className="h-9 w-auto min-w-40 text-xs font-semibold shadow-none"
                        options={Object.entries(roleLabels)
                          .filter(([value]) => value !== "project_manager")
                          .map(([value, label]) => ({ value, label }))}
                      />
                    ) : (
                      <Badge
                        className={
                          member.role === "project_manager"
                            ? "bg-[#eeeefe] text-[#130b5c]"
                            : "bg-[#eef1ef] text-[#68736e]"
                        }
                      >
                        {roleLabels[member.role]}
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="font-semibold">{activeTasks}</TableCell>
                  <TableCell className="font-mono">
                    {hours.toFixed(1)}h
                  </TableCell>
                  <TableCell>
                    {isManager && member.id !== data.profile.id ? (
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={tr("Sửa nhân sự", "Edit employee")}
                          onClick={() => setEditing(member)}
                        >
                          <Pencil size={16} />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={tr("Xóa nhân sự", "Delete employee")}
                          onClick={() => setDeleting(member)}
                        >
                          <Trash2 size={16} className="text-[#c54141]" />
                        </Button>
                      </div>
                    ) : (
                      <Badge className="bg-[#dcfff1] text-[#216e4e]">
                        {tr("Đang hoạt động", "Active")}
                      </Badge>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
      {editing && (
        <EmployeeEditDialog
          member={editing}
          busy={busy}
          onClose={() => setEditing(null)}
          onSubmit={saveMember}
        />
      )}
      <ConfirmDialog
        open={!!pendingRole}
        title={tr("Đổi vai trò nhân sự?", "Change employee role?")}
        description={tr(
          `${pendingRole?.member.full_name} sẽ được chuyển sang ${pendingRole ? roleLabels[pendingRole.role] : ""}. Quyền truy cập sẽ thay đổi ngay.`,
          `${pendingRole?.member.full_name} will become ${pendingRole ? roleLabels[pendingRole.role] : ""}. Access permissions change immediately.`,
        )}
        confirmLabel={tr("Đổi vai trò", "Change role")}
        busy={busy}
        onConfirm={confirmRole}
        onClose={() => setPendingRole(null)}
      />
      <ConfirmDialog
        open={!!deleting}
        title={tr("Xóa tài khoản nhân sự?", "Delete employee account?")}
        description={tr(
          `Tài khoản ${deleting?.email} sẽ bị xóa khỏi Auth và không thể đăng nhập. Chỉ xóa được khi chưa có dữ liệu công việc.`,
          `Account ${deleting?.email} will be removed from Auth and can no longer sign in. Accounts with work data cannot be deleted.`,
        )}
        confirmLabel={tr("Xóa tài khoản", "Delete account")}
        busy={busy}
        onConfirm={removeMember}
        onClose={() => setDeleting(null)}
      />
    </>
  );
}

function PageTitle({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div>
      <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
      <p className="mt-2 text-sm text-[#74807a]">{subtitle}</p>
    </div>
  );
}
function Empty({
  icon: Icon,
  title,
  text,
}: {
  icon: typeof ListTodo;
  title: string;
  text: string;
}) {
  return (
    <div className="grid min-h-60 place-items-center p-8 text-center">
      <div>
        <span className="mx-auto grid h-12 w-12 place-items-center rounded-xl bg-[#edf3f0] text-[#130b5c]">
          <Icon size={22} />
        </span>
        <h3 className="mt-4 font-semibold">{title}</h3>
        <p className="mt-2 text-sm text-[#7b8580]">{text}</p>
      </div>
    </div>
  );
}

function DialogShell({
  title,
  subtitle,
  onClose,
  children,
}: {
  title: string;
  subtitle: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-[#08042f]/45 p-4 backdrop-blur-sm"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <Card className="max-h-[90vh] w-full max-w-lg overflow-y-auto p-6">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-xl font-semibold">{title}</h2>
            <p className="mt-1 text-sm text-[#74807a]">{subtitle}</p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X size={19} />
          </Button>
        </div>
        {children}
      </Card>
    </div>
  );
}

function TaskDialog({
  data,
  isManager,
  busy,
  onClose,
  onSubmit,
}: {
  data: DashboardData;
  isManager: boolean;
  busy: boolean;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const { tr } = useI18n();
  const [projectId, setProjectId] = useState("");
  return (
    <DialogShell
      title={tr("Thêm công việc", "Create task")}
      subtitle={
        isManager
          ? tr(
              "Tạo task và giao cho một thành viên.",
              "Create a task and assign it to a teammate.",
            )
          : tr(
              "Chọn bất kỳ dự án nào; task mới sẽ tự động giao cho bạn.",
              "Choose any project; the new task will be assigned to you.",
            )
      }
      onClose={onClose}
    >
      <form onSubmit={onSubmit} className="mt-6 space-y-4">
        <label className="block text-sm font-semibold">
          {tr("Tên công việc", "Task name")}
          <Input
            name="title"
            required
            placeholder={tr(
              "VD: Thiết kế trang thanh toán",
              "E.g. Design checkout page",
            )}
            className="mt-2"
          />
        </label>
        <label className="block text-sm font-semibold">
          {tr("Mô tả", "Description")}
          <textarea
            name="description"
            rows={3}
            className="mt-2 w-full rounded-lg border border-[#dfe5e1] p-3 text-sm outline-none focus:border-[#130b5c]"
          />
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="text-sm font-semibold">
            {tr("Dự án", "Project")}
            <ProjectSearchField
              name="project_id"
              value={projectId}
              onValueChange={setProjectId}
              projects={data.projects}
              className="mt-2"
            />
          </label>
          <label className="text-sm font-semibold">
            {tr("Người thực hiện", "Assignee")}
            {isManager ? (
              <SelectField
                name="assignee_id"
                defaultValue="unassigned"
                className="mt-2"
                options={[
                  {
                    value: "unassigned",
                    label: tr("Chưa giao", "Unassigned"),
                  },
                  ...data.members.map((member) => ({
                    value: member.id,
                    label: member.full_name,
                  })),
                ]}
              />
            ) : (
              <div className="mt-2 flex h-10 items-center justify-between rounded-lg border border-[#dfe5e1] bg-[#f7f8f8] px-3">
                <span className="text-sm font-medium">
                  {data.profile.full_name}
                </span>
                <Badge variant="secondary">{tr("Chính bạn", "You")}</Badge>
              </div>
            )}
          </label>
          <label className="text-sm font-semibold">
            Sprint
            <SelectField
              name="sprint_id"
              defaultValue="backlog"
              className="mt-2"
              options={[
                { value: "backlog", label: "Product Backlog" },
                ...data.sprints.map((sprint) => ({
                  value: sprint.id,
                  label: sprint.name,
                })),
              ]}
            />
          </label>
          <label className="text-sm font-semibold">
            {tr("Ưu tiên", "Priority")}
            <SelectField
              name="priority"
              defaultValue="medium"
              className="mt-2"
              options={[
                { value: "low", label: tr("Thấp", "Low") },
                { value: "medium", label: tr("Vừa", "Medium") },
                { value: "high", label: tr("Cao", "High") },
              ]}
            />
          </label>
          <label className="text-sm font-semibold">
            {tr("Hạn hoàn thành", "Due date")}
            <DatePicker name="due_date" className="mt-2" />
          </label>
          <fieldset className="text-sm font-semibold">
            <legend>{tr("Ước tính", "Estimate")}</legend>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <SelectField
                name="estimated_hours"
                defaultValue="0"
                ariaLabel={tr("Số giờ ước tính", "Estimated hours")}
                options={Array.from({ length: 25 }, (_, hour) => ({
                  value: String(hour),
                  label: tr(`${hour} giờ`, `${hour} hr`),
                }))}
              />
              <SelectField
                name="estimated_minutes_part"
                defaultValue="0"
                ariaLabel={tr("Số phút ước tính", "Estimated minutes")}
                options={Array.from({ length: 60 }, (_, minute) => ({
                  value: String(minute),
                  label: tr(`${minute} phút`, `${minute} min`),
                }))}
              />
            </div>
          </fieldset>
        </div>
        <div className="flex justify-end gap-3 pt-3">
          <Button type="button" variant="outline" onClick={onClose}>
            {tr("Hủy", "Cancel")}
          </Button>
          <Button
            type="submit"
            disabled={busy || !data.projects.length || !projectId}
          >
            {busy
              ? tr("Đang tạo…", "Creating…")
              : tr("Tạo công việc", "Create task")}
          </Button>
        </div>
        {!data.projects.length && (
          <p className="text-right text-xs text-[#a23b2b]">
            {tr(
              "Hiện chưa có dự án nào để tạo task.",
              "There are no projects available for a new task yet.",
            )}
          </p>
        )}
      </form>
    </DialogShell>
  );
}

function ProjectSearchField({
  name,
  value,
  onValueChange,
  projects,
  className,
}: {
  name: string;
  value: string;
  onValueChange: (value: string) => void;
  projects: Project[];
  className?: string;
}) {
  const { tr } = useI18n();
  const listboxId = useId();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const selectedProject = projects.find((project) => project.id === value);
  const normalizedQuery = normalizeSearch(query);
  const filteredProjects = projects.filter((project) =>
    normalizeSearch(project.name).includes(normalizedQuery),
  );

  return (
    <Popover
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (!nextOpen) setQuery("");
      }}
    >
      <input type="hidden" name={name} value={value} />
      <PopoverTrigger asChild>
        <button
          type="button"
          role="combobox"
          aria-expanded={open}
          aria-controls={listboxId}
          aria-haspopup="listbox"
          aria-label={tr("Chọn dự án", "Select project")}
          className={cn(
            "flex h-9 w-full items-center justify-between gap-2 rounded-md border border-[#dfe1e6] bg-white px-3 text-left text-sm font-normal text-[#24302b] shadow-sm outline-none transition hover:border-[#b7bdc8] focus:border-[#4c43b5] focus:ring-2 focus:ring-[#4c43b5]/15",
            !selectedProject && "text-[#8993a4]",
            className,
          )}
        >
          <span className="truncate">
            {selectedProject?.name ?? tr("Chọn dự án", "Select project")}
          </span>
          <ChevronDown className="size-4 shrink-0 text-[#6b778c]" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-[var(--radix-popover-trigger-width)] p-1"
      >
        <div className="relative border-b border-[#edf0ee] p-2">
          <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-[#8993a4]" />
          <Input
            autoFocus
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={tr("Tìm dự án…", "Search projects…")}
            aria-label={tr("Tìm dự án", "Search projects")}
            className="pl-9"
          />
        </div>
        <div
          id={listboxId}
          role="listbox"
          className="max-h-64 overflow-y-auto p-1"
        >
          {filteredProjects.map((project) => (
            <button
              key={project.id}
              type="button"
              role="option"
              aria-selected={project.id === value}
              onClick={() => {
                onValueChange(project.id);
                setOpen(false);
                setQuery("");
              }}
              className="flex min-h-9 w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm font-normal hover:bg-[#eeeefe] focus:bg-[#eeeefe] focus:outline-none"
            >
              <span
                className="size-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: project.color }}
              />
              <span className="min-w-0 flex-1 truncate">{project.name}</span>
              {project.id === value && (
                <Check className="size-4 shrink-0 text-[#130b5c]" />
              )}
            </button>
          ))}
          {!filteredProjects.length && (
            <p className="px-3 py-6 text-center text-xs font-normal text-[#8993a4]">
              {tr("Không tìm thấy dự án", "No projects found")}
            </p>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function normalizeSearch(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleLowerCase();
}

function EmployeeDialog({
  onClose,
  onCreated,
  onError,
}: {
  onClose: () => void;
  onCreated: (profile: Profile) => void;
  onError: (message: string) => void;
}) {
  const { tr } = useI18n();
  const [pending, setPending] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    const result = await createEmployee(new FormData(event.currentTarget));
    setPending(false);
    if (!result.ok) onError(result.message);
    else
      onCreated({
        ...result.user,
        role: result.user.role as Role,
        avatar_url: null,
      });
  }
  return (
    <DialogShell
      title={tr("Tạo tài khoản nhân sự", "Create employee account")}
      subtitle={tr(
        "Nhân sự có thể đăng nhập ngay và sẽ phải đổi mật khẩu lần đầu.",
        "The employee can sign in immediately and must change their password on first login.",
      )}
      onClose={onClose}
    >
      <form onSubmit={submit} className="mt-6 space-y-4">
        <label className="block text-sm font-semibold">
          {tr("Họ và tên", "Full name")}
          <Input
            name="full_name"
            required
            minLength={2}
            placeholder="Nguyễn Minh Anh"
            className="mt-2"
          />
        </label>
        <label className="block text-sm font-semibold">
          {tr("Email công ty", "Company email")}
          <Input
            name="email"
            required
            type="email"
            placeholder="minhanh@limgrow.com"
            className="mt-2"
          />
        </label>
        <label className="block text-sm font-semibold">
          {tr("Bộ phận", "Department")}
          <SelectField
            name="role"
            defaultValue="developer"
            className="mt-2"
            options={Object.entries(roleLabels)
              .filter(([value]) => value !== "project_manager")
              .map(([value, label]) => ({ value, label }))}
          />
        </label>
        <label className="block text-sm font-semibold">
          {tr("Mật khẩu tạm thời", "Temporary password")}
          <span className="relative mt-2 block">
            <Input
              name="password"
              required
              minLength={8}
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              placeholder={tr("Tối thiểu 8 ký tự", "At least 8 characters")}
              className="pr-11"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-2.5 text-[#69746f]"
              aria-label={tr("Ẩn hoặc hiện mật khẩu", "Show or hide password")}
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </span>
        </label>
        <div className="rounded-lg bg-[#f3f2ff] p-3 text-xs leading-5 text-[#4d4588]">
          {tr(
            "Hệ thống tự xác nhận email. Nhân sự bắt buộc đặt mật khẩu mới sau lần đăng nhập đầu tiên.",
            "Email is confirmed automatically. The employee must set a new password after their first sign-in.",
          )}
        </div>
        <div className="flex justify-end gap-3 pt-2">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={pending}
          >
            {tr("Hủy", "Cancel")}
          </Button>
          <Button type="submit" disabled={pending}>
            {pending && <Loader2 size={16} className="animate-spin" />}
            {tr("Tạo tài khoản", "Create account")}
          </Button>
        </div>
      </form>
    </DialogShell>
  );
}
function EmployeeEditDialog({
  member,
  busy,
  onClose,
  onSubmit,
}: {
  member: Profile;
  busy: boolean;
  onClose: () => void;
  onSubmit: (formData: FormData) => void;
}) {
  const { tr } = useI18n();
  return (
    <DialogShell
      title={tr("Chỉnh sửa nhân sự", "Edit employee")}
      subtitle={tr(
        "Cập nhật tên hiển thị và bộ phận.",
        "Update display name and department.",
      )}
      onClose={onClose}
    >
      <form action={onSubmit} className="mt-6 space-y-4">
        <input type="hidden" name="id" value={member.id} />
        <label className="block text-sm font-semibold">
          {tr("Họ và tên", "Full name")}
          <Input
            name="full_name"
            required
            minLength={2}
            defaultValue={member.full_name}
            className="mt-2"
          />
        </label>
        <label className="block text-sm font-semibold">
          Email
          <Input value={member.email} disabled className="mt-2 bg-[#f1f2f4]" />
        </label>
        <label className="block text-sm font-semibold">
          {tr("Bộ phận", "Department")}
          <SelectField
            name="role"
            defaultValue={member.role}
            className="mt-2"
            options={Object.entries(roleLabels)
              .filter(([value]) => value !== "project_manager")
              .map(([value, label]) => ({ value, label }))}
          />
        </label>
        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="outline" onClick={onClose}>
            {tr("Hủy", "Cancel")}
          </Button>
          <Button type="submit" disabled={busy}>
            {busy
              ? tr("Đang lưu…", "Saving…")
              : tr("Lưu thay đổi", "Save changes")}
          </Button>
        </div>
      </form>
    </DialogShell>
  );
}
function ChangePasswordDialog({
  onChanged,
  onError,
}: {
  onChanged: () => void;
  onError: (message: string) => void;
}) {
  const { tr } = useI18n();
  const [pending, setPending] = useState(false);
  const [show, setShow] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const password = String(form.get("password") ?? "");
    const confirm = String(form.get("confirm") ?? "");
    if (password.length < 10) {
      onError(
        tr(
          "Mật khẩu mới cần ít nhất 10 ký tự.",
          "The new password must be at least 10 characters.",
        ),
      );
      return;
    }
    if (password !== confirm) {
      onError(
        tr("Hai mật khẩu không trùng khớp.", "The passwords do not match."),
      );
      return;
    }
    setPending(true);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const { error } = await supabase.auth.updateUser({
      password,
      data: { ...user?.user_metadata, must_change_password: false },
    });
    setPending(false);
    if (error) onError(error.message);
    else onChanged();
  }
  return (
    <div
      className="fixed inset-0 z-[120] grid place-items-center bg-[#08042f]/70 p-4 backdrop-blur-md"
      role="dialog"
      aria-modal="true"
      aria-labelledby="change-password-title"
    >
      <Card className="w-full max-w-md p-6">
        <span className="grid h-12 w-12 place-items-center rounded-xl bg-[#ecebff] text-[#130b5c]">
          <KeyRound size={22} />
        </span>
        <h2 id="change-password-title" className="mt-5 text-xl font-bold">
          {tr("Đổi mật khẩu lần đầu", "Change your initial password")}
        </h2>
        <p className="mt-2 text-sm leading-6 text-[#69746f]">
          {tr(
            "Để bảo vệ tài khoản, hãy đặt mật khẩu mới trước khi tiếp tục sử dụng hệ thống.",
            "To protect your account, set a new password before continuing.",
          )}
        </p>
        <form onSubmit={submit} className="mt-6 space-y-4">
          <label className="block text-sm font-semibold">
            {tr("Mật khẩu mới", "New password")}
            <span className="relative mt-2 block">
              <Input
                name="password"
                required
                minLength={10}
                type={show ? "text" : "password"}
                autoComplete="new-password"
                placeholder={tr("Ít nhất 10 ký tự", "At least 10 characters")}
                className="pr-11"
              />
              <button
                type="button"
                onClick={() => setShow(!show)}
                className="absolute right-3 top-2.5 text-[#69746f]"
                aria-label={tr(
                  "Ẩn hoặc hiện mật khẩu",
                  "Show or hide password",
                )}
              >
                {show ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </span>
          </label>
          <label className="block text-sm font-semibold">
            {tr("Nhập lại mật khẩu", "Confirm password")}
            <Input
              name="confirm"
              required
              minLength={10}
              type={show ? "text" : "password"}
              autoComplete="new-password"
              className="mt-2"
            />
          </label>
          <Button type="submit" className="h-11 w-full" disabled={pending}>
            {pending && <Loader2 size={16} className="animate-spin" />}
            {tr("Lưu mật khẩu mới", "Save new password")}
          </Button>
        </form>
      </Card>
    </div>
  );
}
function ProjectDialog({
  busy,
  onClose,
  onSubmit,
}: {
  busy: boolean;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const { tr } = useI18n();
  return (
    <DialogShell
      title={tr("Dự án mới", "New project")}
      subtitle={tr(
        "Tạo không gian làm việc cho một khách hàng.",
        "Create a workspace for a client.",
      )}
      onClose={onClose}
    >
      <form onSubmit={onSubmit} className="mt-6 space-y-4">
        <label className="block text-sm font-semibold">
          {tr("Tên dự án", "Project name")}
          <Input
            name="name"
            required
            placeholder={tr("Website thương mại điện tử", "E-commerce website")}
            className="mt-2"
          />
        </label>
        <label className="block text-sm font-semibold">
          {tr("Khách hàng", "Client")}
          <Input
            name="client_name"
            placeholder={tr("Công ty ABC", "ABC Company")}
            className="mt-2"
          />
        </label>
        <div className="grid grid-cols-2 gap-4">
          <label className="text-sm font-semibold">
            {tr("Màu dự án", "Project color")}
            <Input
              name="color"
              type="color"
              defaultValue="#130b5c"
              className="mt-2 p-1"
            />
          </label>
          <label className="text-sm font-semibold">
            {tr("Ngân sách giờ", "Hour budget")}
            <Input
              name="budget_hours"
              type="number"
              min="0"
              placeholder="80"
              className="mt-2"
            />
          </label>
        </div>
        <div className="flex justify-end gap-3 pt-3">
          <Button type="button" variant="outline" onClick={onClose}>
            {tr("Hủy", "Cancel")}
          </Button>
          <Button type="submit" disabled={busy}>
            {busy
              ? tr("Đang tạo…", "Creating…")
              : tr("Tạo dự án", "Create project")}
          </Button>
        </div>
      </form>
    </DialogShell>
  );
}
