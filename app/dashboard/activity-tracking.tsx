"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  CheckCircle2,
  CircleStop,
  Clock3,
  History,
  ListChecks,
  Play,
  RefreshCw,
  Timer,
  TrendingUp,
  Users,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { SelectField } from "@/components/ui/select";
import { useI18n } from "@/lib/i18n";
import { cn, formatDuration, initials } from "@/lib/utils";
import type { DashboardData, Task, TimeEntry } from "@/lib/types";
import { createClient } from "@/utils/supabase/client";

type Props = {
  data: DashboardData;
  isManager: boolean;
  onDataChange: (updater: (current: DashboardData) => DashboardData) => void;
  onError: (message: string) => void;
};

type Range = "today" | "7d" | "30d" | "all";
type PendingAction =
  | { type: "stop"; entry: TimeEntry }
  | { type: "switch"; entry: TimeEntry; taskId: string }
  | null;

function entrySeconds(entry: TimeEntry, now: number) {
  return (
    entry.duration_seconds +
    (!entry.ended_at
      ? Math.max(
          0,
          Math.floor((now - new Date(entry.started_at).getTime()) / 1000),
        )
      : 0)
  );
}

function taskLoggedSeconds(taskId: string, entries: TimeEntry[], now: number) {
  return entries
    .filter((entry) => entry.task_id === taskId)
    .reduce((sum, entry) => sum + entrySeconds(entry, now), 0);
}

function progressState(task: Task, actualSeconds: number) {
  const estimateSeconds = (task.estimated_minutes ?? 0) * 60;
  if (!estimateSeconds)
    return {
      percent: 0,
      labelVi: "Chưa có estimate",
      labelEn: "No estimate",
      badge: "bg-[#eef1f4] text-[#5e6c84]",
      bar: "bg-[#8993a4]",
    };
  const percent = Math.round((actualSeconds / estimateSeconds) * 100);
  if (task.status === "done" && percent <= 100)
    return {
      percent,
      labelVi: "Hoàn thành đúng giờ",
      labelEn: "Completed on time",
      badge: "bg-[#dcfff1] text-[#216e4e]",
      bar: "bg-[#22a06b]",
    };
  if (percent > 100)
    return {
      percent,
      labelVi: "Vượt estimate",
      labelEn: "Over estimate",
      badge: "bg-[#ffebe6] text-[#ae2a19]",
      bar: "bg-[#e34935]",
    };
  if (percent >= 80)
    return {
      percent,
      labelVi: "Gần hết giờ",
      labelEn: "Near estimate",
      badge: "bg-[#fff7d6] text-[#7f5f01]",
      bar: "bg-[#e2a319]",
    };
  return {
    percent,
    labelVi: "Đúng tiến độ",
    labelEn: "On track",
    badge: "bg-[#e9f2ff] text-[#0055cc]",
    bar: "bg-[#0c66e4]",
  };
}

function rangeStart(range: Range, now: number) {
  if (range === "all") return null;
  const date = new Date(now);
  if (range === "today") date.setHours(0, 0, 0, 0);
  else date.setDate(date.getDate() - (range === "7d" ? 7 : 30));
  return date.getTime();
}

export function ActivityTracking({
  data,
  isManager,
  onDataChange,
  onError,
}: Props) {
  const { tr, dateLocale } = useI18n();
  const ownRunningEntry = data.timeEntries.find(
    (entry) => !entry.ended_at && entry.user_id === data.profile.id,
  );
  const [memberId, setMemberId] = useState(isManager ? "all" : data.profile.id);
  const [selectedTaskId, setSelectedTaskId] = useState(
    ownRunningEntry?.task_id ?? "none",
  );
  const [range, setRange] = useState<Range>("all");
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);

  const ownTasks = data.tasks.filter(
    (task) =>
      task.status !== "done" &&
      (isManager || task.assignee_id === data.profile.id),
  );

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const refreshEntries = useCallback(async () => {
    const { data: entries, error } = await createClient()
      .from("time_entries")
      .select("*")
      .order("started_at", { ascending: false })
      .limit(2000);
    if (error) return;
    onDataChange((current) => ({
      ...current,
      timeEntries: (entries as TimeEntry[] | null) ?? [],
    }));
  }, [onDataChange]);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`web-time-tracking-${data.profile.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "time_entries" },
        refreshEntries,
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [data.profile.id, refreshEntries]);

  async function stopEntry(entry: TimeEntry) {
    setBusy(true);
    const endedAt = new Date().toISOString();
    const duration = Math.max(
      1,
      Math.floor((Date.now() - new Date(entry.started_at).getTime()) / 1000),
    );
    const { error } = await createClient()
      .from("time_entries")
      .update({ ended_at: endedAt, duration_seconds: duration })
      .eq("id", entry.id)
      .eq("user_id", data.profile.id);
    setBusy(false);
    if (error) {
      onError(error.message);
      return false;
    }
    onDataChange((current) => ({
      ...current,
      timeEntries: current.timeEntries.map((item) =>
        item.id === entry.id
          ? { ...item, ended_at: endedAt, duration_seconds: duration }
          : item,
      ),
    }));
    return true;
  }

  async function startEntry(taskId: string) {
    setBusy(true);
    const supabase = createClient();
    const { data: entry, error } = await supabase
      .from("time_entries")
      .insert({
        task_id: taskId,
        user_id: data.profile.id,
        started_at: new Date().toISOString(),
      })
      .select()
      .single();
    if (error || !entry) {
      setBusy(false);
      onError(
        error?.message ??
          tr("Không thể bắt đầu timer.", "Unable to start timer."),
      );
      await refreshEntries();
      return false;
    }

    const task = data.tasks.find((item) => item.id === taskId);
    if (task?.status === "todo") {
      const { error: statusError } = await supabase
        .from("tasks")
        .update({ status: "in_progress" })
        .eq("id", taskId);
      if (statusError) onError(statusError.message);
    }
    onDataChange((current) => ({
      ...current,
      timeEntries: [entry as TimeEntry, ...current.timeEntries],
      tasks: current.tasks.map((item) =>
        item.id === taskId && item.status === "todo"
          ? { ...item, status: "in_progress" }
          : item,
      ),
    }));
    setBusy(false);
    return true;
  }

  async function startOrSwitch() {
    if (selectedTaskId === "none") {
      onError(
        tr("Chọn task trước khi bắt đầu.", "Choose a task before starting."),
      );
      return;
    }
    if (ownRunningEntry) {
      if (ownRunningEntry.task_id === selectedTaskId) return;
      setPendingAction({
        type: "switch",
        entry: ownRunningEntry,
        taskId: selectedTaskId,
      });
      return;
    }
    await startEntry(selectedTaskId);
  }

  async function confirmPendingAction() {
    if (!pendingAction) return;
    const action = pendingAction;
    if (action.type === "stop") {
      if (await stopEntry(action.entry)) setPendingAction(null);
      return;
    }
    if (await stopEntry(action.entry)) {
      const started = await startEntry(action.taskId);
      if (started) setPendingAction(null);
    }
  }

  const start = rangeStart(range, now);
  const visibleEntries = useMemo(
    () =>
      data.timeEntries.filter(
        (entry) =>
          (memberId === "all" || entry.user_id === memberId) &&
          (!start ||
            !entry.ended_at ||
            new Date(entry.started_at).getTime() >= start),
      ),
    [data.timeEntries, memberId, start],
  );
  const visibleTasks = useMemo(
    () =>
      data.tasks.filter(
        (task) => memberId === "all" || task.assignee_id === memberId,
      ),
    [data.tasks, memberId],
  );
  const totalActualSeconds = visibleEntries.reduce(
    (sum, entry) => sum + entrySeconds(entry, now),
    0,
  );
  const allTaskActualSeconds = visibleTasks.reduce(
    (sum, task) => sum + taskLoggedSeconds(task.id, data.timeEntries, now),
    0,
  );
  const totalEstimateSeconds = visibleTasks.reduce(
    (sum, task) => sum + (task.estimated_minutes ?? 0) * 60,
    0,
  );
  const activeTimers = visibleEntries.filter((entry) => !entry.ended_at);
  const selectedTask = data.tasks.find((task) => task.id === selectedTaskId);
  const ownElapsed = ownRunningEntry ? entrySeconds(ownRunningEntry, now) : 0;

  return (
    <section className="space-y-5">
      <div className="flex flex-col gap-4 border-b border-[#e2e6e4] pb-5 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-xs font-semibold text-[#89918e]">
            Workspace / {tr("Theo dõi thời gian", "Time tracking")}
          </p>
          <h1 className="mt-2 text-2xl font-bold tracking-tight">
            {tr("Timer công việc trên web", "Web task timer")}
          </h1>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-[#77817c]">
            {tr(
              "Chọn task, bấm bắt đầu và dừng khi hoàn tất. Actual được tính trực tiếp từ thời điểm bắt đầu/kết thúc và so sánh với estimate.",
              "Choose a task, start the timer, and stop when finished. Actual time is calculated from start/end timestamps and compared with the estimate.",
            )}
          </p>
        </div>
        <div className="flex w-full flex-col gap-2 sm:flex-row md:w-auto">
          {isManager && (
            <SelectField
              value={memberId}
              onValueChange={setMemberId}
              className="w-full bg-white md:w-56"
              options={[
                { value: "all", label: tr("Toàn bộ nhân sự", "All members") },
                ...data.members.map((member) => ({
                  value: member.id,
                  label: member.full_name,
                })),
              ]}
            />
          )}
          <SelectField
            value={range}
            onValueChange={(value) => setRange(value as Range)}
            className="w-full bg-white sm:w-40"
            options={[
              { value: "today", label: tr("Hôm nay", "Today") },
              { value: "7d", label: tr("7 ngày", "7 days") },
              { value: "30d", label: tr("30 ngày", "30 days") },
              { value: "all", label: tr("Toàn bộ", "All time") },
            ]}
          />
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.15fr_.85fr]">
        <Card className="overflow-hidden border-[#d9d5ff]">
          <div className="flex items-center justify-between gap-3 bg-[#f3f1ff] px-5 py-3">
            <div className="flex items-center gap-2 text-[#30246f]">
              <Timer size={18} />
              <p className="text-sm font-bold">
                {tr("Timer của tôi", "My timer")}
              </p>
            </div>
            <Badge
              className={
                ownRunningEntry
                  ? "bg-[#dcfff1] text-[#216e4e]"
                  : "bg-white text-[#5e6c84]"
              }
            >
              <span
                className={cn(
                  "mr-1.5 inline-block h-2 w-2 rounded-full",
                  ownRunningEntry
                    ? "animate-pulse bg-[#22a06b]"
                    : "bg-[#8993a4]",
                )}
              />
              {ownRunningEntry
                ? tr("Đang ghi thời gian", "Timer running")
                : tr("Chưa bắt đầu", "Not started")}
            </Badge>
          </div>
          <div className="p-5">
            {ownRunningEntry ? (
              <div className="mb-5 rounded-xl border border-[#ccebdd] bg-[#f4fcf8] p-4">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-[#43806a]">
                      {tr("Đang thực hiện", "Currently working")}
                    </p>
                    <p className="mt-1 truncate text-base font-bold">
                      {data.tasks.find(
                        (task) => task.id === ownRunningEntry.task_id,
                      )?.title ?? tr("Task đã xóa", "Deleted task")}
                    </p>
                    <p className="mt-1 text-xs text-[#688178]">
                      {tr("Bắt đầu lúc", "Started at")}{" "}
                      {new Intl.DateTimeFormat(dateLocale, {
                        hour: "2-digit",
                        minute: "2-digit",
                      }).format(new Date(ownRunningEntry.started_at))}
                    </p>
                  </div>
                  <p className="font-mono text-3xl font-bold tabular-nums text-[#17694c]">
                    {formatDuration(ownElapsed)}
                  </p>
                </div>
              </div>
            ) : (
              <div className="mb-5 flex items-start gap-3 rounded-xl border border-[#e3e7e5] bg-[#fafbfa] p-4">
                <Activity
                  className="mt-0.5 shrink-0 text-[#5747b6]"
                  size={19}
                />
                <div>
                  <p className="text-sm font-bold">
                    {tr(
                      "Sẵn sàng ghi nhận actual",
                      "Ready to capture actual time",
                    )}
                  </p>
                  <p className="mt-1 text-xs leading-5 text-[#77817c]">
                    {tr(
                      "Timer được lưu trên Supabase nên vẫn tiếp tục nếu bạn tải lại hoặc đóng tab. Hãy quay lại và bấm Dừng khi hoàn tất.",
                      "The timer is stored in Supabase and survives reloads or a closed tab. Return and stop it when the work is finished.",
                    )}
                  </p>
                </div>
              </div>
            )}

            <label className="mb-2 block text-xs font-bold text-[#56615c]">
              {tr("Task đang làm", "Task in progress")}
            </label>
            <SelectField
              value={selectedTaskId}
              onValueChange={setSelectedTaskId}
              disabled={busy}
              options={[
                { value: "none", label: tr("Chọn một task", "Choose a task") },
                ...ownTasks.map((task) => ({
                  value: task.id,
                  label: task.title,
                })),
              ]}
            />

            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs text-[#7a8580]">
                {selectedTask?.estimated_minutes
                  ? `${tr("Estimate", "Estimate")}: ${formatDuration(selectedTask.estimated_minutes * 60)}`
                  : tr(
                      "Task này chưa có estimate.",
                      "This task has no estimate yet.",
                    )}
              </p>
              {ownRunningEntry && ownRunningEntry.task_id === selectedTaskId ? (
                <Button
                  variant="danger"
                  disabled={busy}
                  onClick={() =>
                    setPendingAction({ type: "stop", entry: ownRunningEntry })
                  }
                >
                  <CircleStop size={16} />
                  {tr("Dừng & lưu actual", "Stop & save actual")}
                </Button>
              ) : (
                <Button
                  disabled={busy || selectedTaskId === "none"}
                  onClick={startOrSwitch}
                >
                  <Play size={16} fill="currentColor" />
                  {ownRunningEntry
                    ? tr("Chuyển sang task này", "Switch to this task")
                    : tr("Bắt đầu bấm giờ", "Start timer")}
                </Button>
              )}
            </div>
          </div>
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users size={18} className="text-[#5747b6]" />
              <h2 className="font-bold">
                {tr("Đang bấm giờ", "Active timers")}
              </h2>
            </div>
            <Badge className="bg-[#f0edff] text-[#5747b6]">
              {activeTimers.length}
            </Badge>
          </div>
          <div className="mt-4 space-y-2">
            {activeTimers.map((entry) => {
              const member = data.members.find(
                (item) => item.id === entry.user_id,
              );
              const task = data.tasks.find((item) => item.id === entry.task_id);
              return (
                <div
                  key={entry.id}
                  className="flex items-center gap-3 rounded-lg border border-[#e2e7e4] p-3"
                >
                  <span className="grid h-8 w-8 place-items-center rounded-full bg-[#eeecff] text-[10px] font-bold text-[#3e318c]">
                    {member ? initials(member.full_name) : "?"}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-bold">
                      {task?.title ?? tr("Task đã xóa", "Deleted task")}
                    </p>
                    <p className="mt-0.5 truncate text-[10px] text-[#89938e]">
                      {member?.full_name}
                    </p>
                  </div>
                  <span className="font-mono text-xs font-bold text-[#216e4e]">
                    {formatDuration(entrySeconds(entry, now))}
                  </span>
                </div>
              );
            })}
            {!activeTimers.length && (
              <div className="rounded-lg border border-dashed border-[#dce2df] p-7 text-center">
                <CheckCircle2 className="mx-auto text-[#9aa39f]" size={22} />
                <p className="mt-2 text-xs text-[#89938e]">
                  {tr(
                    "Không có timer đang chạy trong phạm vi này.",
                    "No running timers in this scope.",
                  )}
                </p>
              </div>
            )}
          </div>
        </Card>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric
          icon={Clock3}
          label={tr("Actual đã ghi", "Actual logged")}
          value={formatDuration(totalActualSeconds)}
          color="bg-[#e9f2ff] text-[#0c66e4]"
        />
        <Metric
          icon={Activity}
          label={tr("Timer đang chạy", "Running timers")}
          value={String(activeTimers.length)}
          color="bg-[#dcfff1] text-[#216e4e]"
        />
        <Metric
          icon={ListChecks}
          label={tr("Phiên làm việc", "Work sessions")}
          value={String(visibleEntries.length)}
          color="bg-[#f0edff] text-[#5747b6]"
        />
        <Metric
          icon={TrendingUp}
          label={tr("Actual / Estimate", "Actual / Estimate")}
          value={
            totalEstimateSeconds
              ? `${Math.round((allTaskActualSeconds / totalEstimateSeconds) * 100)}%`
              : "—"
          }
          color="bg-[#fff7d6] text-[#7f5f01]"
        />
      </div>

      <Card className="overflow-hidden">
        <div className="flex items-center justify-between border-b border-[#e6eae8] px-5 py-4">
          <div>
            <h2 className="font-bold">
              {tr("Thực tế so với estimate", "Actual vs estimate")}
            </h2>
            <p className="mt-1 text-xs text-[#7d8782]">
              {tr(
                "Actual cộng từ các phiên timer trên web của từng task.",
                "Actual is summed from each task's web timer sessions.",
              )}
            </p>
          </div>
          <Badge className="bg-[#f0edff] text-[#5747b6]">
            {visibleTasks.length} task
          </Badge>
        </div>
        <div className="grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-3">
          {visibleTasks.map((task) => {
            const actual = taskLoggedSeconds(task.id, data.timeEntries, now);
            const progress = progressState(task, actual);
            const assignee = data.members.find(
              (member) => member.id === task.assignee_id,
            );
            const estimateSeconds = (task.estimated_minutes ?? 0) * 60;
            return (
              <div
                key={task.id}
                className="rounded-xl border border-[#e2e7e4] p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold">{task.title}</p>
                    <p className="mt-1 text-[10px] uppercase tracking-wide text-[#8a938f]">
                      #{task.id.slice(0, 6).toUpperCase()}
                    </p>
                  </div>
                  <Badge className={progress.badge}>
                    {tr(progress.labelVi, progress.labelEn)}
                  </Badge>
                </div>
                <div className="mt-4 flex items-end justify-between">
                  <div>
                    <p className="text-[10px] font-semibold uppercase text-[#8b9490]">
                      Actual
                    </p>
                    <p className="mt-1 font-mono text-lg font-bold">
                      {formatDuration(actual)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-semibold uppercase text-[#8b9490]">
                      Estimate
                    </p>
                    <p className="mt-1 font-mono text-sm font-semibold text-[#59645f]">
                      {estimateSeconds ? formatDuration(estimateSeconds) : "—"}
                    </p>
                  </div>
                </div>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-[#edf0ee]">
                  <div
                    className={cn("h-full rounded-full", progress.bar)}
                    style={{ width: `${Math.min(progress.percent, 100)}%` }}
                  />
                </div>
                <div className="mt-3 flex items-center justify-between text-[10px] text-[#818b86]">
                  <span className="flex items-center gap-1.5">
                    <span className="grid h-5 w-5 place-items-center rounded-full bg-[#eeecff] text-[8px] font-bold text-[#3e318c]">
                      {assignee ? initials(assignee.full_name) : "?"}
                    </span>
                    {assignee?.full_name ?? tr("Chưa giao", "Unassigned")}
                  </span>
                  <b className={progress.percent > 100 ? "text-[#ae2a19]" : ""}>
                    {task.estimated_minutes ? `${progress.percent}%` : "—"}
                  </b>
                </div>
              </div>
            );
          })}
          {!visibleTasks.length && (
            <div className="col-span-full p-10 text-center text-sm text-[#89938e]">
              {tr("Chưa có task để so sánh.", "No tasks to compare yet.")}
            </div>
          )}
        </div>
      </Card>

      <Card className="overflow-hidden">
        <div className="flex items-center justify-between border-b border-[#e6eae8] px-5 py-4">
          <div>
            <h2 className="flex items-center gap-2 font-bold">
              <History size={17} className="text-[#5747b6]" />
              {tr("Lịch sử phiên làm việc", "Work session history")}
            </h2>
            <p className="mt-1 text-xs text-[#7d8782]">
              {tr(
                "Mỗi lần bắt đầu/dừng tạo một worklog có thời điểm và thời lượng rõ ràng.",
                "Every start/stop creates a worklog with explicit timestamps and duration.",
              )}
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={refreshEntries}>
            <RefreshCw size={14} />
            {tr("Đồng bộ", "Refresh")}
          </Button>
        </div>
        <div className="divide-y divide-[#edf0ee]">
          {visibleEntries.slice(0, 80).map((entry) => {
            const task = data.tasks.find((item) => item.id === entry.task_id);
            const member = data.members.find(
              (item) => item.id === entry.user_id,
            );
            return (
              <div
                key={entry.id}
                className="grid gap-3 px-5 py-3 sm:grid-cols-[minmax(0,1fr)_160px_110px] sm:items-center"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <span
                    className={cn(
                      "grid h-9 w-9 shrink-0 place-items-center rounded-lg",
                      entry.ended_at
                        ? "bg-[#f0edff] text-[#5747b6]"
                        : "bg-[#dcfff1] text-[#216e4e]",
                    )}
                  >
                    {entry.ended_at ? (
                      <Clock3 size={17} />
                    ) : (
                      <Play size={16} fill="currentColor" />
                    )}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold">
                      {task?.title ?? tr("Task đã xóa", "Deleted task")}
                    </p>
                    <p className="mt-0.5 truncate text-[10px] text-[#89938e]">
                      {member?.full_name}
                    </p>
                  </div>
                </div>
                <p className="text-xs text-[#59645f]">
                  {new Intl.DateTimeFormat(dateLocale, {
                    day: "2-digit",
                    month: "2-digit",
                    hour: "2-digit",
                    minute: "2-digit",
                  }).format(new Date(entry.started_at))}
                </p>
                <div className="sm:text-right">
                  <p className="font-mono text-xs font-bold">
                    {formatDuration(entrySeconds(entry, now))}
                  </p>
                  <p className="mt-0.5 text-[10px] text-[#8a938f]">
                    {entry.ended_at
                      ? tr("Đã lưu", "Saved")
                      : tr("Đang chạy", "Running")}
                  </p>
                </div>
              </div>
            );
          })}
          {!visibleEntries.length && (
            <div className="p-12 text-center">
              <Timer className="mx-auto text-[#a0a8a4]" size={25} />
              <p className="mt-3 text-sm font-semibold">
                {tr("Chưa có worklog", "No worklogs yet")}
              </p>
              <p className="mt-1 text-xs text-[#89938e]">
                {tr(
                  "Chọn task và bắt đầu timer để ghi nhận actual.",
                  "Choose a task and start the timer to capture actual time.",
                )}
              </p>
            </div>
          )}
        </div>
      </Card>

      <ConfirmDialog
        open={Boolean(pendingAction)}
        title={
          pendingAction?.type === "switch"
            ? tr("Chuyển task đang làm?", "Switch active task?")
            : tr("Dừng timer?", "Stop timer?")
        }
        description={
          pendingAction?.type === "switch"
            ? tr(
                "Timer hiện tại sẽ được dừng và lưu actual trước khi timer mới bắt đầu.",
                "The current timer will stop and save its actual time before the new timer starts.",
              )
            : tr(
                "Thời gian từ lúc bắt đầu đến hiện tại sẽ được lưu vào worklog của task.",
                "The time from start until now will be saved to this task's worklog.",
              )
        }
        confirmLabel={
          pendingAction?.type === "switch"
            ? tr("Dừng & chuyển", "Stop & switch")
            : tr("Dừng & lưu", "Stop & save")
        }
        busy={busy}
        onClose={() => !busy && setPendingAction(null)}
        onConfirm={() => void confirmPendingAction()}
      />
    </section>
  );
}

function Metric({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: typeof Timer;
  label: string;
  value: string;
  color: string;
}) {
  return (
    <Card className="flex items-center gap-3 p-4">
      <span
        className={cn("grid h-10 w-10 place-items-center rounded-xl", color)}
      >
        <Icon size={19} />
      </span>
      <div>
        <p className="text-[10px] font-bold uppercase tracking-wide text-[#85908a]">
          {label}
        </p>
        <p className="mt-1 text-xl font-bold">{value}</p>
      </div>
    </Card>
  );
}
