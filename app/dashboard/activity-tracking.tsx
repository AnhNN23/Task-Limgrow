"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  CircleStop,
  Clock3,
  History,
  ListChecks,
  Play,
  Pencil,
  RefreshCw,
  Timer,
  TrendingUp,
  Users,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Input } from "@/components/ui/input";
import { SelectField } from "@/components/ui/select";
import { useToast } from "@/components/ui/toast";
import { useI18n } from "@/lib/i18n";
import { cn, formatDuration, initials, runningSeconds } from "@/lib/utils";
import type { DashboardData, Task, TimeEntry } from "@/lib/types";
import { createClient } from "@/utils/supabase/client";
import { stopTimer } from "./actions";

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

const LONG_TIMER_SECONDS = 4 * 60 * 60;
const FORGOTTEN_TIMER_SECONDS = 8 * 60 * 60;
const TIMER_REFRESH_MS = 250;

function toDateTimeLocal(value: string | Date) {
  const date = value instanceof Date ? value : new Date(value);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

function timerRisk(seconds: number) {
  if (seconds >= FORGOTTEN_TIMER_SECONDS) return "forgotten" as const;
  if (seconds >= LONG_TIMER_SECONDS) return "long" as const;
  return "normal" as const;
}

function entrySeconds(entry: TimeEntry, now: number) {
  return (
    entry.duration_seconds +
    (!entry.ended_at ? runningSeconds(entry.started_at, now) : 0)
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
  const { toast } = useToast();
  const ownRunningEntry = data.timeEntries.find(
    (entry) => !entry.ended_at && entry.user_id === data.profile.id,
  );
  const [memberId, setMemberId] = useState(isManager ? "all" : data.profile.id);
  const [manualTaskId, setManualTaskId] = useState("none");
  const [manualHours, setManualHours] = useState("0");
  const [manualMinutes, setManualMinutes] = useState("0");
  const [range, setRange] = useState<Range>("all");
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const [editingEntry, setEditingEntry] = useState<TimeEntry | null>(null);

  const ownTasks = data.tasks.filter(
    (task) =>
      task.status !== "done" &&
      (isManager || task.assignee_id === data.profile.id),
  );

  useEffect(() => {
    const timer = window.setInterval(
      () => setNow(Date.now()),
      TIMER_REFRESH_MS,
    );
    return () => window.clearInterval(timer);
  }, []);

  async function refreshEntries() {
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
  }

  async function stopEntry(entry: TimeEntry) {
    setBusy(true);
    const result = await stopTimer(entry.id);
    setBusy(false);
    if (!result.ok) {
      onError(result.message);
      return false;
    }
    onDataChange((current) => ({
      ...current,
      timeEntries: current.timeEntries.map((item) =>
        item.id === entry.id ? result.entry : item,
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

  async function startOrSwitch(taskId: string) {
    if (ownRunningEntry) {
      if (ownRunningEntry.task_id === taskId) {
        setPendingAction({ type: "stop", entry: ownRunningEntry });
        return;
      }
      setPendingAction({
        type: "switch",
        entry: ownRunningEntry,
        taskId,
      });
      return;
    }
    await startEntry(taskId);
  }

  async function logManualTime(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const durationSeconds =
      Number(manualHours) * 3600 + Number(manualMinutes) * 60;
    if (manualTaskId === "none") {
      onError(tr("Hãy chọn task cần log.", "Choose a task to log."));
      return;
    }
    if (durationSeconds <= 0) {
      onError(
        tr(
          "Thời gian log phải lớn hơn 0 phút.",
          "Logged time must be greater than 0 minutes.",
        ),
      );
      return;
    }
    const endedAt = new Date();
    const startedAt = new Date(endedAt.getTime() - durationSeconds * 1000);
    setBusy(true);
    const { data: entry, error } = await createClient()
      .from("time_entries")
      .insert({
        task_id: manualTaskId,
        user_id: data.profile.id,
        started_at: startedAt.toISOString(),
        ended_at: endedAt.toISOString(),
        duration_seconds: durationSeconds,
        note: tr("Log thủ công", "Manual time log"),
      })
      .select()
      .single();
    setBusy(false);
    if (error || !entry) {
      onError(
        error?.message ?? tr("Không thể log giờ.", "Unable to log time."),
      );
      return;
    }
    onDataChange((current) => ({
      ...current,
      timeEntries: [entry as TimeEntry, ...current.timeEntries],
    }));
    const task = data.tasks.find((item) => item.id === manualTaskId);
    toast({
      title: tr("Đã log thời gian", "Time logged"),
      description: `${task?.title ?? "Task"} · ${formatDuration(durationSeconds)}`,
      variant: "success",
    });
    setManualHours("0");
    setManualMinutes("0");
  }

  async function saveCorrection(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingEntry) return;
    if (!isManager && editingEntry.user_id !== data.profile.id) {
      onError(
        tr("Bạn không thể sửa worklog này.", "You cannot edit this worklog."),
      );
      return;
    }
    const values = new FormData(event.currentTarget);
    const startedAt = new Date(String(values.get("started_at")));
    const endedAt = new Date(String(values.get("ended_at")));
    const reason = String(values.get("correction_reason") || "").trim();
    const note = String(values.get("note") || "").trim() || null;
    if (
      Number.isNaN(startedAt.getTime()) ||
      Number.isNaN(endedAt.getTime()) ||
      endedAt <= startedAt
    ) {
      onError(
        tr(
          "Giờ kết thúc phải sau giờ bắt đầu.",
          "End time must be after start time.",
        ),
      );
      return;
    }
    if (endedAt.getTime() > Date.now() + 60000) {
      onError(
        tr(
          "Giờ kết thúc không được nằm trong tương lai.",
          "End time cannot be in the future.",
        ),
      );
      return;
    }
    if (endedAt.getTime() - startedAt.getTime() > 24 * 60 * 60 * 1000) {
      onError(
        tr(
          "Một phiên làm việc không được vượt quá 24 giờ.",
          "A work session cannot exceed 24 hours.",
        ),
      );
      return;
    }
    if (reason.length < 5) {
      onError(
        tr(
          "Vui lòng nhập lý do chỉnh sửa ít nhất 5 ký tự.",
          "Enter a correction reason of at least 5 characters.",
        ),
      );
      return;
    }

    setBusy(true);
    const duration = Math.max(
      1,
      Math.floor((endedAt.getTime() - startedAt.getTime()) / 1000),
    );
    let query = createClient()
      .from("time_entries")
      .update({
        started_at: startedAt.toISOString(),
        ended_at: endedAt.toISOString(),
        duration_seconds: duration,
        note,
        correction_reason: reason,
      })
      .eq("id", editingEntry.id);
    if (!isManager) query = query.eq("user_id", data.profile.id);
    const { data: updated, error } = await query.select().single();
    setBusy(false);
    if (error) {
      onError(error.message);
      return;
    }
    onDataChange((current) => ({
      ...current,
      timeEntries: current.timeEntries.map((entry) =>
        entry.id === editingEntry.id ? (updated as TimeEntry) : entry,
      ),
    }));
    toast({
      title: tr("Đã điều chỉnh worklog", "Worklog adjusted"),
      description: tr(
        "Giá trị cũ và mới đã được lưu trong lịch sử kiểm toán.",
        "The old and new values were saved to the audit history.",
      ),
      variant: "success",
    });
    setEditingEntry(null);
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
  const ownSessionElapsed = ownRunningEntry
    ? entrySeconds(ownRunningEntry, now)
    : 0;
  const ownTaskElapsed = ownRunningEntry
    ? data.timeEntries
        .filter(
          (entry) =>
            entry.task_id === ownRunningEntry.task_id &&
            entry.user_id === data.profile.id,
        )
        .reduce((sum, entry) => sum + entrySeconds(entry, now), 0)
    : 0;
  const ownTimerRisk = timerRisk(ownSessionElapsed);

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
                    {ownTimerRisk !== "normal" && (
                      <div
                        className={cn(
                          "mt-3 flex flex-wrap items-center gap-2 rounded-lg border px-3 py-2 text-xs",
                          ownTimerRisk === "forgotten"
                            ? "border-[#f0b8b1] bg-[#fff1f0] text-[#ae2a19]"
                            : "border-[#f1d58a] bg-[#fff7d6] text-[#7f5f01]",
                        )}
                      >
                        <AlertTriangle className="size-4 shrink-0" />
                        <span className="flex-1 font-semibold">
                          {ownTimerRisk === "forgotten"
                            ? tr(
                                "Timer đã chạy hơn 8 giờ — có thể bạn quên dừng.",
                                "This timer has run for over 8 hours — you may have forgotten to stop it.",
                              )
                            : tr(
                                "Timer đã chạy hơn 4 giờ. Hãy kiểm tra lại.",
                                "This timer has run for over 4 hours. Please check it.",
                              )}
                        </span>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="bg-white"
                          onClick={() => setEditingEntry(ownRunningEntry)}
                        >
                          <Pencil /> {tr("Dừng & chỉnh giờ", "Stop & correct")}
                        </Button>
                      </div>
                    )}
                  </div>
                  <p className="font-mono text-3xl font-bold tabular-nums text-[#17694c]">
                    {formatDuration(ownTaskElapsed)}
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

            <p className="mb-2 text-xs font-bold text-[#56615c]">
              {tr("Chọn ngay trên task", "Start directly from a task")}
            </p>
            <div className="max-h-64 space-y-2 overflow-y-auto pr-1">
              {ownTasks.map((task) => {
                const running = ownRunningEntry?.task_id === task.id;
                const total = taskLoggedSeconds(task.id, data.timeEntries, now);
                return (
                  <div
                    key={task.id}
                    className={cn(
                      "flex items-center gap-3 rounded-lg border p-3",
                      running
                        ? "border-[#b9e4d1] bg-[#f4fcf8]"
                        : "border-[#e2e7e4] bg-white",
                    )}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">
                        {task.title}
                      </p>
                      <p className="mt-1 font-mono text-xs text-[#69736e]">
                        {formatDuration(total)}
                      </p>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant={running ? "danger" : "outline"}
                      disabled={busy}
                      onClick={() => void startOrSwitch(task.id)}
                    >
                      {running ? (
                        <CircleStop size={15} />
                      ) : (
                        <Play size={15} fill="currentColor" />
                      )}
                      {running
                        ? tr("Dừng", "Stop")
                        : ownRunningEntry
                          ? tr("Chuyển", "Switch")
                          : tr("Bắt đầu", "Start")}
                    </Button>
                  </div>
                );
              })}
              {!ownTasks.length && (
                <p className="rounded-lg border border-dashed p-5 text-center text-xs text-[#89938e]">
                  {tr("Không có task đang mở.", "No open tasks.")}
                </p>
              )}
            </div>

            <form
              onSubmit={logManualTime}
              className="mt-5 border-t border-[#e6eae8] pt-5"
            >
              <p className="text-xs font-bold text-[#56615c]">
                {tr("Log thời gian thủ công", "Log time manually")}
              </p>
              <div className="mt-2 grid gap-2 sm:grid-cols-[minmax(0,1fr)_110px_110px_auto]">
                <SelectField
                  value={manualTaskId}
                  onValueChange={setManualTaskId}
                  disabled={busy}
                  ariaLabel={tr("Task cần log", "Task to log")}
                  options={[
                    { value: "none", label: tr("Chọn task", "Choose task") },
                    ...ownTasks.map((task) => ({
                      value: task.id,
                      label: task.title,
                    })),
                  ]}
                />
                <SelectField
                  value={manualHours}
                  onValueChange={setManualHours}
                  disabled={busy}
                  ariaLabel={tr("Số giờ", "Hours")}
                  options={Array.from({ length: 25 }, (_, hour) => ({
                    value: String(hour),
                    label: tr(`${hour} giờ`, `${hour} hr`),
                  }))}
                />
                <SelectField
                  value={manualMinutes}
                  onValueChange={setManualMinutes}
                  disabled={busy}
                  ariaLabel={tr("Số phút", "Minutes")}
                  options={Array.from({ length: 60 }, (_, minute) => ({
                    value: String(minute),
                    label: tr(`${minute} phút`, `${minute} min`),
                  }))}
                />
                <Button type="submit" disabled={busy}>
                  <Clock3 size={15} /> {tr("Log", "Log")}
                </Button>
              </div>
            </form>
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
              const elapsed = entrySeconds(entry, now);
              const risk = timerRisk(elapsed);
              const canEdit = isManager || entry.user_id === data.profile.id;
              return (
                <div
                  key={entry.id}
                  className={cn(
                    "flex items-center gap-3 rounded-lg border p-3",
                    risk === "forgotten"
                      ? "border-[#f0b8b1] bg-[#fff8f7]"
                      : risk === "long"
                        ? "border-[#f1d58a] bg-[#fffdf5]"
                        : "border-[#e2e7e4]",
                  )}
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
                    {formatDuration(elapsed)}
                  </span>
                  {risk !== "normal" && (
                    <Badge
                      variant={risk === "forgotten" ? "danger" : "warning"}
                    >
                      <AlertTriangle />
                      {risk === "forgotten"
                        ? tr("Quên dừng?", "Forgotten?")
                        : tr("Đang lâu", "Long running")}
                    </Badge>
                  )}
                  {canEdit && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-8"
                      onClick={() => setEditingEntry(entry)}
                      aria-label={tr("Điều chỉnh giờ", "Adjust time")}
                    >
                      <Pencil />
                    </Button>
                  )}
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
                className="grid gap-3 px-5 py-3 sm:grid-cols-[minmax(0,1fr)_160px_130px_90px] sm:items-center"
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
                    {entry.corrected_at && (
                      <p
                        className="mt-1 truncate text-[10px] font-medium text-[#7f5f01]"
                        title={entry.correction_reason ?? undefined}
                      >
                        {tr("Đã điều chỉnh", "Adjusted")}:{" "}
                        {entry.correction_reason}
                      </p>
                    )}
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
                <div className="sm:text-right">
                  {(isManager || entry.user_id === data.profile.id) && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setEditingEntry(entry)}
                    >
                      <Pencil /> {tr("Sửa", "Edit")}
                    </Button>
                  )}
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

      {editingEntry && (
        <TimeCorrectionDialog
          key={editingEntry.id}
          entry={editingEntry}
          task={data.tasks.find((task) => task.id === editingEntry.task_id)}
          member={data.members.find(
            (member) => member.id === editingEntry.user_id,
          )}
          busy={busy}
          isManager={isManager}
          onSubmit={saveCorrection}
          onClose={() => !busy && setEditingEntry(null)}
        />
      )}
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

function TimeCorrectionDialog({
  entry,
  task,
  member,
  busy,
  isManager,
  onSubmit,
  onClose,
}: {
  entry: TimeEntry;
  task?: Task;
  member?: DashboardData["members"][number];
  busy: boolean;
  isManager: boolean;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onClose: () => void;
}) {
  const { tr } = useI18n();
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const [startedAt, setStartedAt] = useState(toDateTimeLocal(entry.started_at));
  const [endedAt, setEndedAt] = useState(
    toDateTimeLocal(entry.ended_at ?? new Date()),
  );
  const startMs = new Date(startedAt).getTime();
  const endMs = new Date(endedAt).getTime();
  const previewSeconds =
    Number.isFinite(startMs) && Number.isFinite(endMs) && endMs > startMs
      ? Math.floor((endMs - startMs) / 1000)
      : 0;
  const wasRunning = !entry.ended_at;

  return (
    <div
      className="fixed inset-0 z-[120] grid place-items-center bg-[#08042f]/45 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="time-correction-title"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !busy) onClose();
      }}
    >
      <Card className="max-h-[92vh] w-full max-w-xl overflow-y-auto p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <Badge variant={wasRunning ? "warning" : "info"}>
              {wasRunning
                ? tr("Timer đang chạy", "Running timer")
                : tr("Worklog đã lưu", "Saved worklog")}
            </Badge>
            <h2
              id="time-correction-title"
              className="mt-3 text-lg font-semibold text-[#172b4d]"
            >
              {wasRunning
                ? tr("Dừng và điều chỉnh thời gian", "Stop and correct time")
                : tr("Điều chỉnh worklog", "Adjust worklog")}
            </h2>
            <p className="mt-1 text-sm text-[#5e6c84]">
              {task?.title ?? tr("Task đã xóa", "Deleted task")}
              {isManager && member ? ` · ${member.full_name}` : ""}
            </p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onClose}
            disabled={busy}
            aria-label={tr("Đóng", "Close")}
          >
            ×
          </Button>
        </div>

        {wasRunning && (
          <div className="mt-5 flex gap-3 rounded-lg border border-[#f1d58a] bg-[#fff7d6] p-3 text-xs leading-5 text-[#7f5f01]">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            <p>
              {tr(
                "Hãy chọn thời điểm bạn thực sự ngừng làm việc. Worklog sẽ được đóng tại thời điểm đó, không phải thời điểm hiện tại.",
                "Choose when you actually stopped working. The worklog will close at that time, not the current time.",
              )}
            </p>
          </div>
        )}

        <form onSubmit={onSubmit} className="mt-5 space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="text-sm font-semibold text-[#172b4d]">
              {tr("Bắt đầu", "Started")}
              <Input
                type="datetime-local"
                name="started_at"
                required
                value={startedAt}
                onChange={(event) => setStartedAt(event.target.value)}
                className="mt-2"
              />
            </label>
            <label className="text-sm font-semibold text-[#172b4d]">
              {tr("Kết thúc thực tế", "Actual end")}
              <Input
                type="datetime-local"
                name="ended_at"
                required
                max={toDateTimeLocal(new Date())}
                value={endedAt}
                onChange={(event) => setEndedAt(event.target.value)}
                className="mt-2"
              />
            </label>
          </div>

          <div className="flex items-center justify-between rounded-lg border border-[#dfe1e6] bg-[#f7f8f9] px-4 py-3">
            <span className="text-xs font-semibold text-[#5e6c84]">
              {tr("Thời lượng sau điều chỉnh", "Corrected duration")}
            </span>
            <span className="font-mono text-base font-bold text-[#37298e]">
              {previewSeconds ? formatDuration(previewSeconds) : "—"}
            </span>
          </div>

          <label className="block text-sm font-semibold text-[#172b4d]">
            {tr("Lý do điều chỉnh", "Correction reason")}
            <textarea
              name="correction_reason"
              required
              minLength={5}
              maxLength={500}
              rows={3}
              defaultValue={
                wasRunning
                  ? tr("Quên bấm dừng timer", "Forgot to stop the timer")
                  : ""
              }
              placeholder={tr(
                "Ví dụ: Quên bấm dừng khi kết thúc công việc",
                "Example: Forgot to stop when work finished",
              )}
              className="mt-2 w-full resize-none rounded-md border border-[#dfe1e6] bg-white px-3 py-2 text-sm font-normal outline-none transition focus:border-[#4c43b5] focus:ring-2 focus:ring-[#4c43b5]/15"
            />
          </label>

          <label className="block text-sm font-semibold text-[#172b4d]">
            {tr("Ghi chú công việc", "Work note")}
            <textarea
              name="note"
              maxLength={1000}
              rows={2}
              defaultValue={entry.note ?? ""}
              placeholder={tr(
                "Nội dung đã thực hiện trong phiên này (không bắt buộc)",
                "What was completed in this session (optional)",
              )}
              className="mt-2 w-full resize-none rounded-md border border-[#dfe1e6] bg-white px-3 py-2 text-sm font-normal outline-none transition focus:border-[#4c43b5] focus:ring-2 focus:ring-[#4c43b5]/15"
            />
          </label>

          <div className="rounded-lg bg-[#f0edff] px-4 py-3 text-xs leading-5 text-[#5747b6]">
            {tr(
              `Bản ghi cũ, bản ghi mới, lý do và người chỉnh sửa sẽ được lưu lại. Múi giờ hiển thị: ${timeZone}.`,
              `Old and new values, the reason, and the editor are retained. Display timezone: ${timeZone}.`,
            )}
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={busy}
            >
              {tr("Hủy", "Cancel")}
            </Button>
            <Button type="submit" disabled={busy || !previewSeconds}>
              {busy
                ? tr("Đang lưu…", "Saving…")
                : wasRunning
                  ? tr("Dừng & lưu điều chỉnh", "Stop & save correction")
                  : tr("Lưu điều chỉnh", "Save correction")}
            </Button>
          </div>
        </form>
      </Card>
    </div>
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
