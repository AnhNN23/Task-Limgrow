"use client";

import { useMemo, useState } from "react";
import {
  AlertTriangle,
  BriefcaseBusiness,
  CheckCircle2,
  Clock3,
  Download,
  Gauge,
  Timer,
  TrendingUp,
  Users,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { SelectField } from "@/components/ui/select";
import { cn, formatDuration, initials } from "@/lib/utils";
import type { DashboardData, Role, TaskStatus, TimeEntry } from "@/lib/types";
import { useI18n } from "@/lib/i18n";

type RangeKey = "7" | "30" | "90" | "all";

const ranges: Array<{ value: RangeKey; label: string }> = [
  { value: "7", label: "7 ngày" },
  { value: "30", label: "30 ngày" },
  { value: "90", label: "90 ngày" },
  { value: "all", label: "Tất cả" },
];
const statusInfo: Record<
  TaskStatus,
  { label: string; color: string; soft: string }
> = {
  todo: {
    label: "Cần làm",
    color: "#6b778c",
    soft: "bg-[#ebecf0] text-[#42526e]",
  },
  in_progress: {
    label: "Đang làm",
    color: "#0c66e4",
    soft: "bg-[#e9f2ff] text-[#0055cc]",
  },
  review: {
    label: "Đang duyệt",
    color: "#e2a319",
    soft: "bg-[#fff7d6] text-[#7f5f01]",
  },
  done: {
    label: "Hoàn thành",
    color: "#22a06b",
    soft: "bg-[#dcfff1] text-[#216e4e]",
  },
};

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

export function AdminReports({
  data,
  isManager,
}: {
  data: DashboardData;
  isManager: boolean;
}) {
  const { tr, dateLocale } = useI18n();
  const [range, setRange] = useState<RangeKey>("30");
  const [projectId, setProjectId] = useState("all");
  const [memberId, setMemberId] = useState(isManager ? "all" : data.profile.id);
  const [now] = useState(() => Date.now());
  const rangeDays = range === "all" ? null : Number(range);
  const effectiveMemberId = isManager ? memberId : data.profile.id;
  const selectedMember =
    effectiveMemberId === "all"
      ? null
      : (data.members.find((member) => member.id === effectiveMemberId) ??
        data.profile);
  const taskMap = useMemo(
    () => new Map(data.tasks.map((task) => [task.id, task])),
    [data.tasks],
  );

  const scopedEntries = useMemo(
    () =>
      data.timeEntries.filter((entry) => {
        const task = taskMap.get(entry.task_id);
        if (!task) return false;
        if (effectiveMemberId !== "all" && entry.user_id !== effectiveMemberId)
          return false;
        if (projectId !== "all" && task.project_id !== projectId) return false;
        if (
          rangeDays &&
          now - new Date(entry.started_at).getTime() > rangeDays * 86400000
        )
          return false;
        return true;
      }),
    [data.timeEntries, effectiveMemberId, projectId, rangeDays, taskMap, now],
  );
  const scopedTasks = useMemo(
    () =>
      data.tasks.filter(
        (task) =>
          (projectId === "all" || task.project_id === projectId) &&
          (effectiveMemberId === "all" ||
            task.assignee_id === effectiveMemberId),
      ),
    [data.tasks, effectiveMemberId, projectId],
  );
  const scopedProjects = data.projects.filter(
    (project) =>
      (projectId === "all" || project.id === projectId) &&
      (effectiveMemberId === "all" ||
        scopedTasks.some((task) => task.project_id === project.id) ||
        scopedEntries.some(
          (entry) => taskMap.get(entry.task_id)?.project_id === project.id,
        )),
  );
  const totalSeconds = scopedEntries.reduce(
    (sum, entry) => sum + entrySeconds(entry, now),
    0,
  );
  const doneTasks = scopedTasks.filter((task) => task.status === "done").length;
  const completionRate = scopedTasks.length
    ? Math.round((doneTasks / scopedTasks.length) * 100)
    : 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const overdueTasks = scopedTasks.filter(
    (task) =>
      task.status !== "done" &&
      task.due_date &&
      new Date(`${task.due_date}T23:59:59`).getTime() < now,
  );
  const activeTimers = scopedEntries.filter((entry) => !entry.ended_at);
  const totalBudget = scopedProjects.reduce(
    (sum, project) => sum + (project.budget_hours ?? 0),
    0,
  );
  const budgetUsage = totalBudget
    ? Math.round((totalSeconds / 3600 / totalBudget) * 100)
    : 0;
  const totalEstimateHours =
    scopedTasks.reduce((sum, task) => sum + (task.estimated_minutes ?? 0), 0) /
    60;
  const estimateUsage = totalEstimateHours
    ? Math.round((totalSeconds / 3600 / totalEstimateHours) * 100)
    : 0;

  const statusRows = (Object.keys(statusInfo) as TaskStatus[]).map(
    (status) => ({
      status,
      count: scopedTasks.filter((task) => task.status === status).length,
    }),
  );
  let statusCursor = 0;
  const statusGradient = statusRows
    .map(({ status, count }) => {
      const start = statusCursor;
      const portion = scopedTasks.length
        ? (count / scopedTasks.length) * 100
        : 0;
      statusCursor += portion;
      return `${statusInfo[status].color} ${start}% ${statusCursor}%`;
    })
    .join(", ");

  const chartDays = range === "7" ? 7 : 14;
  const dailyRows = Array.from({ length: chartDays }, (_, index) => {
    const date = new Date(today);
    date.setDate(today.getDate() - (chartDays - index - 1));
    const key = date.toDateString();
    const seconds = scopedEntries
      .filter((entry) => new Date(entry.started_at).toDateString() === key)
      .reduce((sum, entry) => sum + entrySeconds(entry, now), 0);
    return {
      key,
      label: date.toLocaleDateString(dateLocale, {
        day: "2-digit",
        month: "2-digit",
      }),
      hours: seconds / 3600,
    };
  });
  const maxDaily = Math.max(...dailyRows.map((row) => row.hours), 1);

  const projectRows = scopedProjects
    .map((project) => {
      const tasks = scopedTasks.filter(
        (task) => task.project_id === project.id,
      );
      const seconds = scopedEntries
        .filter(
          (entry) => taskMap.get(entry.task_id)?.project_id === project.id,
        )
        .reduce((sum, entry) => sum + entrySeconds(entry, now), 0);
      const done = tasks.filter((task) => task.status === "done").length;
      return {
        project,
        hours: seconds / 3600,
        progress: tasks.length ? Math.round((done / tasks.length) * 100) : 0,
        tasks: tasks.length,
        budgetPercent: project.budget_hours
          ? Math.round((seconds / 3600 / project.budget_hours) * 100)
          : 0,
      };
    })
    .sort((a, b) => b.hours - a.hours);

  const visibleMembers =
    effectiveMemberId === "all"
      ? data.members
      : data.members.filter((member) => member.id === effectiveMemberId);
  const memberRows = visibleMembers
    .map((member) => {
      const seconds = scopedEntries
        .filter((entry) => entry.user_id === member.id)
        .reduce((sum, entry) => sum + entrySeconds(entry, now), 0);
      const tasks = scopedTasks.filter(
        (task) => task.assignee_id === member.id && task.status !== "done",
      );
      const overdue = tasks.filter(
        (task) =>
          task.due_date &&
          new Date(`${task.due_date}T23:59:59`).getTime() < now,
      ).length;
      const targetHours = rangeDays ? Math.max(8, (rangeDays / 7) * 40) : 160;
      return {
        member,
        hours: seconds / 3600,
        activeTasks: tasks.length,
        overdue,
        utilization: Math.round((seconds / 3600 / targetHours) * 100),
      };
    })
    .sort((a, b) => b.hours - a.hours);

  const alerts = [
    ...(overdueTasks.length
      ? [
          {
            tone: "danger",
            title: `${overdueTasks.length} task đã quá hạn`,
            text: "Cần rà soát deadline hoặc điều phối lại người thực hiện.",
          },
        ]
      : []),
    ...(effectiveMemberId === "all"
      ? projectRows
          .filter((row) => row.budgetPercent >= 80)
          .map((row) => ({
            tone: row.budgetPercent >= 100 ? "danger" : "warning",
            title: `${row.project.name} dùng ${row.budgetPercent}% ngân sách`,
            text: `${row.hours.toFixed(1)}h / ${row.project.budget_hours ?? 0}h trong kỳ đã chọn.`,
          }))
      : []),
    ...(scopedTasks.some((task) => !task.assignee_id)
      ? [
          {
            tone: "warning",
            title: `${scopedTasks.filter((task) => !task.assignee_id).length} task chưa được giao`,
            text: "Task chưa có assignee có nguy cơ bị bỏ sót.",
          },
        ]
      : []),
    ...activeTimers
      .filter((entry) => entrySeconds(entry, now) > 8 * 3600)
      .map((entry) => ({
        tone: "warning",
        title: "Timer chạy trên 8 giờ",
        text: `${data.members.find((member) => member.id === entry.user_id)?.full_name ?? "Thành viên"} có timer cần kiểm tra.`,
      })),
  ].slice(0, 5);

  function exportCsv() {
    const header = [
      tr("Thời gian bắt đầu", "Start time"),
      tr("Nhân sự", "Employee"),
      tr("Dự án", "Project"),
      tr("Công việc", "Task"),
      tr("Số giờ", "Hours"),
      tr("Trạng thái timer", "Timer status"),
    ];
    const rows = scopedEntries.map((entry) => {
      const task = taskMap.get(entry.task_id);
      const project = data.projects.find(
        (item) => item.id === task?.project_id,
      );
      const member = data.members.find((item) => item.id === entry.user_id);
      return [
        new Date(entry.started_at).toLocaleString(dateLocale),
        member?.full_name ?? "",
        project?.name ?? "",
        task?.title ?? "",
        (entrySeconds(entry, now) / 3600).toFixed(2),
        entry.ended_at ? tr("Đã dừng", "Stopped") : tr("Đang chạy", "Running"),
      ];
    });
    const csv = [header, ...rows]
      .map((row) =>
        row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(","),
      )
      .join("\n");
    const url = URL.createObjectURL(
      new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = `limgrow-worklog-${new Date(now).toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div>
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-[#6b778c]">
            <span>Workspace</span>
            <span>/</span>
            <Badge
              className={
                isManager && effectiveMemberId === "all"
                  ? "bg-[#e9e7fb] text-[#130b5c]"
                  : "bg-[#e9f2ff] text-[#0055cc]"
              }
            >
              {isManager && effectiveMemberId === "all"
                ? "Admin Analytics"
                : "My Analytics"}
            </Badge>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <h1 className="text-3xl font-bold tracking-tight text-[#172b4d]">
              {isManager && effectiveMemberId === "all"
                ? tr("Thống kê quản trị", "Admin analytics")
                : tr("Thống kê cá nhân", "My analytics")}
            </h1>
            {selectedMember && (
              <Badge className="gap-2 bg-[#e9e7fb] px-3 py-1 text-[#130b5c]">
                <span className="grid h-5 w-5 place-items-center rounded-full bg-white text-[8px] font-bold">
                  {initials(selectedMember.full_name)}
                </span>
                {selectedMember.full_name}
              </Badge>
            )}
          </div>
          <p className="mt-2 text-sm text-[#6b778c]">
            {isManager && effectiveMemberId === "all"
              ? tr(
                  "Theo dõi tiến độ, workload, ngân sách và time log toàn công ty.",
                  "Track company-wide progress, workload, budget and time logs.",
                )
              : tr(
                  "Theo dõi công việc, hiệu suất và toàn bộ time log của cá nhân.",
                  "Track your work, performance and personal time logs.",
                )}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {isManager && (
            <SelectField value={memberId} onValueChange={setMemberId} ariaLabel={tr("Chọn phạm vi nhân sự", "Select employee scope")} className="h-9 w-auto min-w-40 border-[#c7c2ee] bg-[#f5f3ff] text-xs font-bold text-[#130b5c] shadow-none" options={[{ value: "all", label: `👥 ${tr("Toàn công ty", "Entire company")}` }, { value: data.profile.id, label: `◎ ${tr("Của tôi", "Mine")}` }, ...data.members.filter((member) => member.id !== data.profile.id).map((member) => ({ value: member.id, label: member.full_name }))]} />
          )}
          <SelectField value={projectId} onValueChange={setProjectId} ariaLabel={tr("Chọn dự án báo cáo", "Select report project")} className="h-9 w-auto min-w-40 text-xs font-semibold shadow-none" options={[{ value: "all", label: tr("Tất cả dự án", "All projects") }, ...data.projects.map((project) => ({ value: project.id, label: project.name }))]} />
          <div className="flex rounded-md border border-[#dfe1e6] bg-white p-0.5">
            {ranges.map((item) => (
              <button
                key={item.value}
                onClick={() => setRange(item.value)}
                className={cn(
                  "h-8 rounded px-3 text-xs font-semibold",
                  range === item.value
                    ? "bg-[#e9e7fb] text-[#130b5c]"
                    : "text-[#6b778c] hover:bg-[#f1f2f4]",
                )}
              >
                {item.value === "all"
                  ? tr("Tất cả", "All")
                  : `${item.value} ${tr("ngày", "days")}`}
              </button>
            ))}
          </div>
          <Button variant="outline" size="sm" onClick={exportCsv}>
            <Download size={15} /> {tr("Xuất CSV", "Export CSV")}
          </Button>
        </div>
      </div>

      {isManager && (
        <div className="mt-5 flex flex-wrap items-center gap-2 rounded-xl border border-[#e4e1f5] bg-white p-3">
          <span className="mr-1 text-[10px] font-bold uppercase tracking-wider text-[#6b778c]">
            Xem nhanh
          </span>
          <button
            onClick={() => setMemberId("all")}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-bold transition",
              memberId === "all"
                ? "border-[#6957c8] bg-[#6957c8] text-white"
                : "border-[#dfe1e6] text-[#44546f] hover:bg-[#f1f2f4]",
            )}
          >
            <Users size={13} /> Toàn công ty{" "}
            <span className="rounded-full bg-white/20 px-1.5">
              {data.members.length}
            </span>
          </button>
          {data.members.slice(0, 8).map((member) => (
            <button
              key={member.id}
              onClick={() => setMemberId(member.id)}
              className={cn(
                "inline-flex items-center gap-2 rounded-full border px-2.5 py-1.5 text-xs font-semibold transition",
                memberId === member.id
                  ? "border-[#130b5c] bg-[#e9e7fb] text-[#130b5c]"
                  : "border-[#dfe1e6] bg-white text-[#44546f] hover:bg-[#f1f2f4]",
              )}
            >
              <span className="grid h-5 w-5 place-items-center rounded-full bg-[#eeeefe] text-[8px] font-bold text-[#130b5c]">
                {initials(member.full_name)}
              </span>
              {member.full_name.split(" ").at(-1)}
            </button>
          ))}
        </div>
      )}

      <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
        <AdminKpi
          icon={Clock3}
          label="Tổng thời gian"
          value={`${(totalSeconds / 3600).toFixed(1)}h`}
          note={`${scopedEntries.length} lượt ghi`}
          tone="purple"
        />
        <AdminKpi
          icon={BriefcaseBusiness}
          label="Dự án"
          value={String(
            scopedProjects.filter((project) => project.status === "active")
              .length,
          )}
          note={`${scopedProjects.length} tổng cộng`}
          tone="blue"
        />
        <AdminKpi
          icon={CheckCircle2}
          label="Hoàn thành"
          value={`${completionRate}%`}
          note={`${doneTasks}/${scopedTasks.length} task`}
          tone="green"
        />
        <AdminKpi
          icon={AlertTriangle}
          label="Quá hạn"
          value={String(overdueTasks.length)}
          note="task chưa xong"
          tone={overdueTasks.length ? "red" : "green"}
        />
        <AdminKpi
          icon={Gauge}
          label={effectiveMemberId === "all" ? "Ngân sách" : "So với ước tính"}
          value={
            effectiveMemberId === "all"
              ? totalBudget
                ? `${budgetUsage}%`
                : "—"
              : totalEstimateHours
                ? `${estimateUsage}%`
                : "—"
          }
          note={
            effectiveMemberId === "all"
              ? totalBudget
                ? `${totalBudget.toFixed(0)}h tổng budget`
                : "Chưa thiết lập"
              : totalEstimateHours
                ? `${totalEstimateHours.toFixed(1)}h ước tính`
                : "Task chưa có estimate"
          }
          tone={
            (effectiveMemberId === "all" ? budgetUsage : estimateUsage) >= 90
              ? "red"
              : "orange"
          }
        />
        <AdminKpi
          icon={Timer}
          label="Timer đang chạy"
          value={String(activeTimers.length)}
          note="nhân sự đang làm"
          tone="purple"
        />
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-[1.55fr_.85fr]">
        <Card className="p-5 md:p-6">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="font-bold text-[#172b4d]">Giờ làm theo ngày</h2>
              <p className="mt-1 text-xs text-[#6b778c]">
                {chartDays} ngày gần nhất trong phạm vi lọc
              </p>
            </div>
            <Badge className="bg-[#eeeefe] text-[#130b5c]">
              {(totalSeconds / 3600 / Math.max(rangeDays ?? 30, 1)).toFixed(1)}
              h/ngày
            </Badge>
          </div>
          <div className="mt-8 flex h-56 items-end gap-2 border-b border-[#dfe1e6] px-1">
            {dailyRows.map((row, index) => (
              <div
                key={row.key}
                className="group flex h-full min-w-0 flex-1 flex-col justify-end"
              >
                <div
                  className="relative mx-auto w-full max-w-9 rounded-t bg-[#6957c8] transition hover:bg-[#130b5c]"
                  style={{
                    height: `${Math.max((row.hours / maxDaily) * 100, row.hours ? 4 : 1)}%`,
                  }}
                >
                  <span className="absolute -top-7 left-1/2 hidden -translate-x-1/2 whitespace-nowrap rounded bg-[#172b4d] px-2 py-1 text-[10px] text-white group-hover:block">
                    {row.hours.toFixed(1)}h
                  </span>
                </div>
                {(chartDays === 7 || index % 2 === 0) && (
                  <span className="mt-2 truncate text-center text-[9px] text-[#8993a4]">
                    {row.label}
                  </span>
                )}
              </div>
            ))}
          </div>
        </Card>
        <Card className="p-5 md:p-6">
          <h2 className="font-bold text-[#172b4d]">Trạng thái công việc</h2>
          <p className="mt-1 text-xs text-[#6b778c]">
            {scopedTasks.length} task trong phạm vi dự án
          </p>
          <div className="mt-7 flex items-center gap-7">
            <div
              className="relative h-36 w-36 shrink-0 rounded-full"
              style={{
                background: scopedTasks.length
                  ? `conic-gradient(${statusGradient})`
                  : "#ebecf0",
              }}
            >
              <div className="absolute inset-5 grid place-items-center rounded-full bg-white text-center">
                <span>
                  <b className="block text-2xl text-[#172b4d]">
                    {completionRate}%
                  </b>
                  <small className="text-[10px] text-[#6b778c]">
                    hoàn thành
                  </small>
                </span>
              </div>
            </div>
            <div className="min-w-0 flex-1 space-y-2.5">
              {statusRows.map(({ status, count }) => (
                <Badge
                  key={status}
                  className={cn(
                    "flex w-full items-center gap-2 px-2.5 py-1.5",
                    statusInfo[status].soft,
                  )}
                >
                  <i
                    className="h-2 w-2 rounded-full"
                    style={{ background: statusInfo[status].color }}
                  />
                  <span className="min-w-0 flex-1 truncate">
                    {statusInfo[status].label}
                  </span>
                  <b className="rounded-full bg-white/70 px-1.5">{count}</b>
                </Badge>
              ))}
            </div>
          </div>
        </Card>
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-[1.4fr_.8fr]">
        <Card className="overflow-hidden">
          <div className="flex items-center border-b border-[#dfe1e6] px-5 py-4">
            <div>
              <h2 className="font-bold text-[#172b4d]">Hiệu suất dự án</h2>
              <p className="mt-1 text-xs text-[#6b778c]">
                So sánh tiến độ task và giờ đã dùng trong kỳ
              </p>
            </div>
            <Badge className="ml-auto bg-[#e9f2ff] text-[#0055cc]">
              {projectRows.length} dự án
            </Badge>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left">
              <thead>
                <tr className="bg-[#f7f8f9] text-[10px] font-bold uppercase tracking-wider text-[#6b778c]">
                  <th className="px-5 py-3">Dự án</th>
                  <th className="px-4 py-3">Tiến độ</th>
                  <th className="px-4 py-3">Task</th>
                  <th className="px-4 py-3">Giờ đã ghi</th>
                  <th className="px-5 py-3">Ngân sách</th>
                </tr>
              </thead>
              <tbody>
                {projectRows.map((row) => (
                  <tr
                    key={row.project.id}
                    className="border-t border-[#ebecf0]"
                  >
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <i
                          className="h-9 w-2 rounded-full"
                          style={{ background: row.project.color }}
                        />
                        <div>
                          <div className="flex items-center gap-2">
                            <b className="text-sm">{row.project.name}</b>
                            <Badge
                              className={
                                row.project.status === "active"
                                  ? "bg-[#dcfff1] text-[9px] text-[#216e4e]"
                                  : row.project.status === "completed"
                                    ? "bg-[#e9e7fb] text-[9px] text-[#130b5c]"
                                    : "bg-[#f1f2f4] text-[9px] text-[#44546f]"
                              }
                            >
                              {row.project.status.replaceAll("_", " ")}
                            </Badge>
                          </div>
                          <p className="mt-0.5 text-[11px] text-[#8993a4]">
                            {row.project.client_name ?? "Nội bộ"}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-20 rounded-full bg-[#ebecf0]">
                          <div
                            className="h-full rounded-full bg-[#22a06b]"
                            style={{ width: `${row.progress}%` }}
                          />
                        </div>
                        <Badge className="bg-[#dcfff1] text-[#216e4e]">
                          {row.progress}%
                        </Badge>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <Badge className="bg-[#f1f2f4] text-[#44546f]">
                        {row.tasks} task
                      </Badge>
                    </td>
                    <td className="px-4 py-4">
                      <Badge className="bg-[#eeeefe] font-mono text-[#130b5c]">
                        {row.hours.toFixed(1)}h
                      </Badge>
                    </td>
                    <td className="px-5 py-4">
                      {row.project.budget_hours ? (
                        <div>
                          <div className="flex items-center justify-between text-[11px]">
                            <Badge
                              className={
                                row.budgetPercent >= 100
                                  ? "bg-[#fff1f0] text-[#ae2a19]"
                                  : row.budgetPercent >= 80
                                    ? "bg-[#fff7d6] text-[#7f5f01]"
                                    : "bg-[#e9f2ff] text-[#0055cc]"
                              }
                            >
                              {row.budgetPercent}%
                            </Badge>
                            <span className="text-[#8993a4]">
                              /{row.project.budget_hours}h
                            </span>
                          </div>
                          <div className="mt-1.5 h-1.5 w-28 rounded-full bg-[#ebecf0]">
                            <div
                              className={cn(
                                "h-full rounded-full",
                                row.budgetPercent >= 100
                                  ? "bg-[#c9372c]"
                                  : row.budgetPercent >= 80
                                    ? "bg-[#e2a319]"
                                    : "bg-[#0c66e4]",
                              )}
                              style={{
                                width: `${Math.min(row.budgetPercent, 100)}%`,
                              }}
                            />
                          </div>
                        </div>
                      ) : (
                        <Badge className="bg-[#f1f2f4] text-[#6b778c]">
                          Chưa đặt
                        </Badge>
                      )}
                    </td>
                  </tr>
                ))}
                {!projectRows.length && (
                  <tr>
                    <td
                      colSpan={5}
                      className="p-8 text-center text-sm text-[#8993a4]"
                    >
                      Chưa có dữ liệu dự án
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
        <Card className="p-5">
          <div className="flex items-center gap-2">
            <AlertTriangle size={18} className="text-[#e2a319]" />
            <h2 className="font-bold text-[#172b4d]">Cần chú ý</h2>
            <Badge className="ml-auto bg-[#fff7d6] text-[#7f5f01]">
              {alerts.length}
            </Badge>
          </div>
          <div className="mt-4 space-y-3">
            {alerts.map((alert, index) => (
              <div
                key={`${alert.title}-${index}`}
                className={cn(
                  "rounded-lg border p-3",
                  alert.tone === "danger"
                    ? "border-[#ffd2cc] bg-[#fff1f0]"
                    : "border-[#f5df9b] bg-[#fffbea]",
                )}
              >
                <p
                  className={cn(
                    "text-xs font-bold",
                    alert.tone === "danger"
                      ? "text-[#ae2a19]"
                      : "text-[#7f5f01]",
                  )}
                >
                  {alert.title}
                </p>
                <p className="mt-1 text-[11px] leading-5 text-[#6b778c]">
                  {alert.text}
                </p>
              </div>
            ))}
            {!alerts.length && (
              <div className="rounded-lg bg-[#dcfff1] p-4 text-center">
                <CheckCircle2 className="mx-auto text-[#22a06b]" size={22} />
                <p className="mt-2 text-xs font-bold text-[#216e4e]">
                  Mọi chỉ số đang ổn định
                </p>
              </div>
            )}
          </div>
        </Card>
      </div>

      <Card className="mt-5 overflow-hidden">
        <div className="flex items-center justify-between border-b border-[#dfe1e6] px-5 py-4">
          <div>
            <h2 className="font-bold text-[#172b4d]">
              {effectiveMemberId === "all"
                ? "Workload nhân sự"
                : "Hiệu suất cá nhân"}
            </h2>
            <p className="mt-1 text-xs text-[#6b778c]">
              Giờ ghi nhận và số task đang phụ trách
            </p>
          </div>
          <Badge className="gap-1.5 bg-[#e9e7fb] text-[#130b5c]">
            <Users size={13} /> {memberRows.length} thành viên
          </Badge>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left">
            <thead>
              <tr className="bg-[#f7f8f9] text-[10px] font-bold uppercase tracking-wider text-[#6b778c]">
                <th className="px-5 py-3">Nhân sự</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">Giờ ghi nhận</th>
                <th className="px-4 py-3">Mức sử dụng</th>
                <th className="px-4 py-3">Task đang làm</th>
                <th className="px-5 py-3">Quá hạn</th>
              </tr>
            </thead>
            <tbody>
              {memberRows.map((row) => (
                <tr key={row.member.id} className="border-t border-[#ebecf0]">
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-3">
                      <span className="grid h-8 w-8 place-items-center rounded-full bg-[#e9e7fb] text-[10px] font-bold text-[#130b5c]">
                        {initials(row.member.full_name)}
                      </span>
                      <div>
                        <b className="text-sm">{row.member.full_name}</b>
                        <p className="text-[10px] text-[#8993a4]">
                          {row.member.email}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3.5">
                    <RoleBadge role={row.member.role} />
                  </td>
                  <td className="px-4 py-3.5">
                    <Badge className="bg-[#eeeefe] font-mono text-[#130b5c]">
                      {row.hours.toFixed(1)}h
                    </Badge>
                  </td>
                  <td className="px-4 py-3.5">
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 w-24 rounded-full bg-[#ebecf0]">
                        <div
                          className={cn(
                            "h-full rounded-full",
                            row.utilization > 110
                              ? "bg-[#c9372c]"
                              : row.utilization >= 80
                                ? "bg-[#22a06b]"
                                : "bg-[#0c66e4]",
                          )}
                          style={{
                            width: `${Math.min(row.utilization, 100)}%`,
                          }}
                        />
                      </div>
                      <Badge
                        className={
                          row.utilization > 110
                            ? "bg-[#fff1f0] text-[#ae2a19]"
                            : row.utilization >= 80
                              ? "bg-[#dcfff1] text-[#216e4e]"
                              : "bg-[#e9f2ff] text-[#0055cc]"
                        }
                      >
                        {row.utilization}%
                      </Badge>
                    </div>
                  </td>
                  <td className="px-4 py-3.5">
                    <Badge className="bg-[#e9f2ff] text-[#0055cc]">
                      {row.activeTasks} task
                    </Badge>
                  </td>
                  <td className="px-5 py-3.5">
                    <Badge
                      className={
                        row.overdue
                          ? "bg-[#fff1f0] text-[#ae2a19]"
                          : "bg-[#dcfff1] text-[#216e4e]"
                      }
                    >
                      {row.overdue ? `${row.overdue} quá hạn` : "Đúng hạn"}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card className="mt-5 overflow-hidden">
        <div className="flex items-center border-b border-[#dfe1e6] px-5 py-4">
          <div>
            <h2 className="font-bold text-[#172b4d]">Time log gần đây</h2>
            <p className="mt-1 text-xs text-[#6b778c]">
              20 bản ghi mới nhất trong bộ lọc hiện tại
            </p>
          </div>
          <Badge className="ml-auto bg-[#f1f2f4] text-[#44546f]">
            {scopedEntries.length} bản ghi
          </Badge>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left">
            <thead>
              <tr className="bg-[#f7f8f9] text-[10px] font-bold uppercase tracking-wider text-[#6b778c]">
                <th className="px-5 py-3">Thời gian</th>
                <th className="px-4 py-3">Nhân sự</th>
                <th className="px-4 py-3">Công việc</th>
                <th className="px-4 py-3">Dự án</th>
                <th className="px-5 py-3 text-right">Thời lượng</th>
              </tr>
            </thead>
            <tbody>
              {scopedEntries.slice(0, 20).map((entry) => {
                const task = taskMap.get(entry.task_id);
                const member = data.members.find(
                  (item) => item.id === entry.user_id,
                );
                const project = data.projects.find(
                  (item) => item.id === task?.project_id,
                );
                return (
                  <tr key={entry.id} className="border-t border-[#ebecf0]">
                    <td className="px-5 py-3.5 text-xs text-[#5e6c84]">
                      {new Date(entry.started_at).toLocaleString("vi-VN")}
                    </td>
                    <td className="px-4 py-3.5">
                      <Badge className="gap-1.5 bg-[#f1f2f4] text-[#44546f]">
                        <span className="grid h-4 w-4 place-items-center rounded-full bg-white text-[7px]">
                          {initials(member?.full_name ?? "?")}
                        </span>
                        {member?.full_name ?? "—"}
                      </Badge>
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="max-w-xs truncate text-sm">
                        {task?.title ?? "Task đã xóa"}
                      </div>
                    </td>
                    <td className="px-4 py-3.5">
                      <Badge className="gap-1.5 bg-[#f7f8f9] text-[#44546f]">
                        <i
                          className="h-2 w-2 rounded-sm"
                          style={{ background: project?.color ?? "#8993a4" }}
                        />
                        {project?.name ?? "—"}
                      </Badge>
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <Badge
                        className={
                          !entry.ended_at
                            ? "bg-[#e9f2ff] font-mono text-[#0055cc]"
                            : "bg-[#dcfff1] font-mono text-[#216e4e]"
                        }
                      >
                        {!entry.ended_at && (
                          <span className="mr-1 inline-flex h-1.5 w-1.5 animate-pulse rounded-full bg-[#22a06b]" />
                        )}
                        {formatDuration(entrySeconds(entry, now)).slice(0, 8)} ·{" "}
                        {entry.ended_at ? "Đã ghi" : "Đang chạy"}
                      </Badge>
                    </td>
                  </tr>
                );
              })}
              {!scopedEntries.length && (
                <tr>
                  <td
                    colSpan={5}
                    className="p-8 text-center text-sm text-[#8993a4]"
                  >
                    Chưa có time log trong phạm vi này
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function AdminKpi({
  icon: Icon,
  label,
  value,
  note,
  tone,
}: {
  icon: typeof TrendingUp;
  label: string;
  value: string;
  note: string;
  tone: "purple" | "blue" | "green" | "orange" | "red";
}) {
  const tones = {
    purple: "bg-[#eeeefe] text-[#5e4db2]",
    blue: "bg-[#e9f2ff] text-[#0c66e4]",
    green: "bg-[#dcfff1] text-[#22a06b]",
    orange: "bg-[#fff7d6] text-[#b38600]",
    red: "bg-[#fff1f0] text-[#c9372c]",
  };
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-xs font-semibold text-[#6b778c]">
            {label}
          </p>
          <p className="mt-2 text-2xl font-bold tracking-tight text-[#172b4d]">
            {value}
          </p>
        </div>
        <span
          className={cn(
            "grid h-9 w-9 shrink-0 place-items-center rounded-lg",
            tones[tone],
          )}
        >
          <Icon size={18} />
        </span>
      </div>
      <Badge
        className={cn("mt-3 max-w-full truncate font-medium", tones[tone])}
      >
        {note}
      </Badge>
    </Card>
  );
}

function RoleBadge({ role }: { role: Role }) {
  const styles: Record<Role, string> = {
    project_manager: "bg-[#e9e7fb] text-[#130b5c]",
    developer: "bg-[#e9f2ff] text-[#0055cc]",
    tester: "bg-[#dcfff1] text-[#216e4e]",
    business_analyst: "bg-[#fff7d6] text-[#7f5f01]",
    ui_ux: "bg-[#f3f0ff] text-[#5e4db2]",
    graphic_designer: "bg-[#fff0f6] text-[#943d73]",
  };
  const labels: Record<Role, string> = {
    project_manager: "Project Manager",
    developer: "Developer",
    tester: "Tester / QA",
    business_analyst: "Business Analyst",
    ui_ux: "UI/UX Designer",
    graphic_designer: "Graphic Designer",
  };
  return <Badge className={styles[role]}>{labels[role]}</Badge>;
}
