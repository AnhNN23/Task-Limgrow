"use client";

import { useMemo, useState, type ChangeEvent, type FormEvent } from "react";
import {
  AlignLeft,
  Archive,
  CalendarDays,
  Check,
  ChevronDown,
  Circle,
  Clock3,
  Columns3,
  Download,
  FileText,
  Filter,
  Flag,
  GitPullRequest,
  LayoutList,
  ListChecks,
  MessageSquare,
  Paperclip,
  Play,
  Plus,
  Send,
  Sparkles,
  Pencil,
  Tag,
  Timer,
  Trash2,
  UserRound,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn, formatDuration, initials } from "@/lib/utils";
import { createClient } from "@/utils/supabase/client";
import { useToast } from "@/components/ui/toast";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { DatePicker } from "@/components/ui/date-picker";
import { SelectField } from "@/components/ui/select";
import { useI18n } from "@/lib/i18n";
import { TeamWorkflow } from "./team-workflow";
import type {
  ChecklistItem,
  DashboardData,
  Label,
  Sprint,
  Task,
  TaskAttachment,
  TaskComment,
  TaskPriority,
  TaskStatus,
  TimeEntry,
} from "@/lib/types";

type WorkView = "list" | "board" | "calendar" | "backlog" | "workflow";
type Props = {
  data: DashboardData;
  query: string;
  activeEntry?: TimeEntry;
  isManager: boolean;
  onToggleTimer: (task: Task) => void;
  onStatus: (task: Task, status: TaskStatus) => void;
  onDataChange: (updater: (current: DashboardData) => DashboardData) => void;
  onCreateTask: () => void;
  onError: (message: string) => void;
};

export const statusMeta: Record<
  TaskStatus,
  { label: string; color: string; soft: string }
> = {
  todo: {
    label: "Cần làm",
    color: "#6b7280",
    soft: "bg-[#eef0f2] text-[#5e6670]",
  },
  in_progress: {
    label: "Đang làm",
    color: "#3b82f6",
    soft: "bg-[#e8f2ff] text-[#2467ae]",
  },
  review: {
    label: "Đang duyệt",
    color: "#f59e0b",
    soft: "bg-[#fff3dc] text-[#986510]",
  },
  done: {
    label: "Hoàn thành",
    color: "#16a36a",
    soft: "bg-[#e4f7ef] text-[#11794f]",
  },
};
export const priorityMeta: Record<
  TaskPriority,
  { label: string; color: string }
> = {
  low: { label: "Thấp", color: "text-[#7b8580]" },
  medium: { label: "Trung bình", color: "text-[#d28b19]" },
  high: { label: "Cao", color: "text-[#d34b4b]" },
};

export function TaskWorkspace(props: Props) {
  const {
    data,
    query,
    activeEntry,
    isManager,
    onToggleTimer,
    onStatus,
    onDataChange,
    onCreateTask,
    onError,
  } = props;
  const { tr } = useI18n();
  const [workView, setWorkView] = useState<WorkView>("list");
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [projectFilter, setProjectFilter] = useState("all");
  const [assigneeFilter, setAssigneeFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [hideDone, setHideDone] = useState(false);
  const [draggedId, setDraggedId] = useState<string | null>(null);

  const tasks = useMemo(
    () =>
      data.tasks.filter((task) => {
        if (query && !task.title.toLowerCase().includes(query.toLowerCase()))
          return false;
        if (projectFilter !== "all" && task.project_id !== projectFilter)
          return false;
        if (assigneeFilter !== "all" && task.assignee_id !== assigneeFilter)
          return false;
        if (priorityFilter !== "all" && task.priority !== priorityFilter)
          return false;
        if (hideDone && task.status === "done") return false;
        return true;
      }),
    [
      data.tasks,
      query,
      projectFilter,
      assigneeFilter,
      priorityFilter,
      hideDone,
    ],
  );

  const selectedTask =
    data.tasks.find((task) => task.id === selectedTaskId) ?? null;
  const filtersActive =
    [projectFilter, assigneeFilter, priorityFilter].some(
      (value) => value !== "all",
    ) || hideDone;
  function clearFilters() {
    setProjectFilter("all");
    setAssigneeFilter("all");
    setPriorityFilter("all");
    setHideDone(false);
  }

  async function dropToStatus(status: TaskStatus) {
    const task = data.tasks.find((item) => item.id === draggedId);
    setDraggedId(null);
    if (task && task.status !== status) await onStatus(task, status);
  }

  return (
    <>
      <section>
        <div className="flex flex-col gap-5 border-b border-[#e2e6e4] pb-5 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-[#89918e]">
              <span>Workspace</span>
              <span>/</span>
              <span className="text-[#130b5c]">
                {tr("Tất cả công việc", "All tasks")}
              </span>
            </div>
            <h1 className="mt-2 text-2xl font-bold tracking-tight">
              {tr("Công việc", "Tasks")}
            </h1>
            <p className="mt-1 text-sm text-[#77817c]">
              {tasks.length} task ·{" "}
              {
                data.tasks.filter((task) => task.status === "in_progress")
                  .length
              }{" "}
              {tr("đang thực hiện", "in progress")}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex rounded-lg border border-[#dfe4e1] bg-white p-1">
              <ViewButton
                active={workView === "list"}
                icon={LayoutList}
                label="List"
                onClick={() => setWorkView("list")}
              />
              <ViewButton
                active={workView === "board"}
                icon={Columns3}
                label="Board"
                onClick={() => setWorkView("board")}
              />
              <ViewButton
                active={workView === "calendar"}
                icon={CalendarDays}
                label="Calendar"
                onClick={() => setWorkView("calendar")}
              />
              <ViewButton
                active={workView === "backlog"}
                icon={Archive}
                label="Backlog"
                onClick={() => setWorkView("backlog")}
              />
              <ViewButton
                active={workView === "workflow"}
                icon={GitPullRequest}
                label={tr("Quy trình", "Workflow")}
                onClick={() => setWorkView("workflow")}
              />
            </div>
            {isManager && (
              <Button onClick={onCreateTask}>
                <Plus size={17} /> {tr("Tạo task", "Create task")}
              </Button>
            )}
          </div>
        </div>

        <div className="my-4 flex flex-wrap items-center gap-2">
          <Filter size={16} className="mr-1 text-[#7e8883]" />
          <FilterSelect
            value={projectFilter}
            onChange={setProjectFilter}
            label={tr("Dự án", "Project")}
            options={data.projects.map((project) => ({
              value: project.id,
              label: project.name,
            }))}
          />
          <FilterSelect
            value={assigneeFilter}
            onChange={setAssigneeFilter}
            label={tr("Người thực hiện", "Assignee")}
            options={data.members.map((member) => ({
              value: member.id,
              label: member.full_name,
            }))}
          />
          <FilterSelect
            value={priorityFilter}
            onChange={setPriorityFilter}
            label={tr("Ưu tiên", "Priority")}
            options={Object.keys(priorityMeta).map((value) => ({
              value,
              label:
                value === "low"
                  ? tr("Thấp", "Low")
                  : value === "medium"
                    ? tr("Trung bình", "Medium")
                    : tr("Cao", "High"),
            }))}
          />
          <button
            onClick={() => setHideDone(!hideDone)}
            className={cn(
              "h-9 rounded-lg border px-3 text-xs font-semibold",
              hideDone
                ? "border-[#130b5c] bg-[#e8f5f0] text-[#130b5c]"
                : "border-[#dfe4e1] bg-white text-[#5f6964]",
            )}
          >
            {tr("Ẩn task hoàn thành", "Hide completed tasks")}
          </button>
          {filtersActive && (
            <button
              onClick={clearFilters}
              className="text-xs font-semibold text-[#b54141] hover:underline"
            >
              {tr("Xóa bộ lọc", "Clear filters")}
            </button>
          )}
          <span className="ml-auto text-xs text-[#8a938f]">
            {tr("Cập nhật theo thời gian thực", "Real-time updates")}
          </span>
        </div>

        {workView === "list" && (
          <ListView
            data={data}
            tasks={tasks}
            activeEntry={activeEntry}
            onOpen={setSelectedTaskId}
            onTimer={onToggleTimer}
            onStatus={onStatus}
          />
        )}
        {workView === "board" && (
          <BoardView
            data={data}
            tasks={tasks}
            activeEntry={activeEntry}
            draggedId={draggedId}
            setDraggedId={setDraggedId}
            onDrop={dropToStatus}
            onOpen={setSelectedTaskId}
            onTimer={onToggleTimer}
          />
        )}
        {workView === "calendar" && (
          <CalendarView data={data} tasks={tasks} onOpen={setSelectedTaskId} />
        )}
        {workView === "backlog" && (
          <BacklogView
            data={data}
            tasks={tasks}
            isManager={isManager}
            onOpen={setSelectedTaskId}
            onDataChange={onDataChange}
            onError={onError}
          />
        )}
        {workView === "workflow" && <TeamWorkflow data={data} />}
      </section>
      {selectedTask && (
        <TaskDrawer
          task={selectedTask}
          data={data}
          activeEntry={activeEntry}
          isManager={isManager}
          onClose={() => setSelectedTaskId(null)}
          onTimer={onToggleTimer}
          onStatus={onStatus}
          onDataChange={onDataChange}
          onError={onError}
        />
      )}
    </>
  );
}

function ViewButton({
  active,
  icon: Icon,
  label,
  onClick,
}: {
  active: boolean;
  icon: typeof LayoutList;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex h-8 items-center gap-2 rounded-md px-3 text-xs font-semibold transition",
        active
          ? "bg-[#130b5c] text-white shadow-sm"
          : "text-[#68736e] hover:bg-[#f0f3f1]",
      )}
    >
      <Icon size={15} />
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
}
function FilterSelect({
  value,
  onChange,
  label,
  options,
}: {
  value: string;
  onChange: (value: string) => void;
  label: string;
  options: { value: string; label: string }[];
}) {
  const { tr } = useI18n();
  return (
    <SelectField
      value={value}
      onValueChange={onChange}
      ariaLabel={label}
      className={cn(
        "h-9 w-auto min-w-36 text-xs font-semibold shadow-none",
        value !== "all" && "border-[#6957c8] bg-[#f5f3ff] text-[#130b5c]",
      )}
      options={[
        { value: "all", label: `${label}: ${tr("Tất cả", "All")}` },
        ...options,
      ]}
    />
  );
}

function ListView({
  data,
  tasks,
  activeEntry,
  onOpen,
  onTimer,
  onStatus,
}: {
  data: DashboardData;
  tasks: Task[];
  activeEntry?: TimeEntry;
  onOpen: (id: string) => void;
  onTimer: (task: Task) => void;
  onStatus: (task: Task, status: TaskStatus) => void;
}) {
  const groups = (Object.keys(statusMeta) as TaskStatus[]).map((status) => ({
    status,
    tasks: tasks.filter((task) => task.status === status),
  }));
  if (!tasks.length) return <EmptyTasks />;
  return (
    <div className="space-y-4">
      {groups.map(
        ({ status, tasks: items }) =>
          items.length > 0 && (
            <Card key={status} className="overflow-hidden">
              <div className="flex h-11 items-center gap-3 border-b border-[#e8ebe9] bg-[#fafbfa] px-4">
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ background: statusMeta[status].color }}
                />
                <span className="text-xs font-bold uppercase tracking-wide">
                  {statusMeta[status].label}
                </span>
                <Badge className="bg-[#eef1ef] text-[#69736e]">
                  {items.length}
                </Badge>
                <Plus size={15} className="ml-auto text-[#8c9591]" />
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[900px] text-left">
                  <thead>
                    <tr className="text-[11px] uppercase tracking-wider text-[#969d99]">
                      <th className="w-[44%] px-4 py-2.5 font-semibold">
                        Tên task
                      </th>
                      <th className="px-3 py-2.5 font-semibold">
                        Người thực hiện
                      </th>
                      <th className="px-3 py-2.5 font-semibold">Ưu tiên</th>
                      <th className="px-3 py-2.5 font-semibold">Hạn</th>
                      <th className="px-3 py-2.5 text-right font-semibold">
                        Thời gian
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((task) => (
                      <TaskRow
                        key={task.id}
                        task={task}
                        data={data}
                        activeEntry={activeEntry}
                        onOpen={onOpen}
                        onTimer={onTimer}
                        onStatus={onStatus}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          ),
      )}
    </div>
  );
}
function TaskRow({
  task,
  data,
  activeEntry,
  onOpen,
  onTimer,
  onStatus,
}: {
  task: Task;
  data: DashboardData;
  activeEntry?: TimeEntry;
  onOpen: (id: string) => void;
  onTimer: (task: Task) => void;
  onStatus: (task: Task, status: TaskStatus) => void;
}) {
  const member = data.members.find((item) => item.id === task.assignee_id);
  const project = data.projects.find((item) => item.id === task.project_id);
  const running = activeEntry?.task_id === task.id;
  const seconds = taskSeconds(task.id, data.timeEntries);
  const estimateSeconds = (task.estimated_minutes ?? 0) * 60;
  const estimatePercent = estimateSeconds
    ? Math.round((seconds / estimateSeconds) * 100)
    : 0;
  return (
    <tr className="group border-t border-[#edf0ee] hover:bg-[#f9fbfa]">
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <button
            onClick={() =>
              onStatus(task, task.status === "done" ? "todo" : "done")
            }
            className={cn(
              "grid h-5 w-5 shrink-0 place-items-center rounded-full border",
              task.status === "done"
                ? "border-[#18a06b] bg-[#18a06b] text-white"
                : "border-[#cbd3cf] text-transparent hover:border-[#18a06b]",
            )}
          >
            <Check size={12} />
          </button>
          <button onClick={() => onOpen(task.id)} className="min-w-0 text-left">
            <p className="truncate text-sm font-semibold group-hover:text-[#130b5c]">
              {task.title}
            </p>
            <p className="mt-1 flex items-center gap-2 text-[11px] text-[#8b938f]">
              <span
                className="h-2 w-2 rounded-full"
                style={{ background: project?.color }}
              />
              {project?.name}
              <span>#{task.id.slice(0, 5).toUpperCase()}</span>
              {data.comments.some((comment) => comment.task_id === task.id) && (
                <span className="flex items-center gap-1">
                  <MessageSquare size={11} />
                  {
                    data.comments.filter(
                      (comment) => comment.task_id === task.id,
                    ).length
                  }
                </span>
              )}
            </p>
          </button>
        </div>
      </td>
      <td className="px-3 py-3">
        {member ? (
          <span className="flex items-center gap-2 text-xs">
            <Avatar name={member.full_name} small />
            {member.full_name}
          </span>
        ) : (
          <span className="text-xs text-[#a0a7a3]">Chưa giao</span>
        )}
      </td>
      <td className="px-3 py-3">
        <span
          className={cn(
            "flex items-center gap-1.5 text-xs font-semibold",
            priorityMeta[task.priority].color,
          )}
        >
          <Flag size={13} fill="currentColor" />
          {priorityMeta[task.priority].label}
        </span>
      </td>
      <td className="px-3 py-3 text-xs text-[#69736e]">
        {task.due_date ? dateLabel(task.due_date) : "—"}
      </td>
      <td className="px-3 py-3">
        <div className="ml-auto w-28">
          <button
            onClick={() => onTimer(task)}
            className={cn(
              "ml-auto inline-flex items-center gap-2 rounded-md px-2 py-1 font-mono text-xs font-semibold",
              running
                ? "bg-[#ffebe8] text-[#c44343]"
                : "text-[#66716c] hover:bg-[#e8f5f0] hover:text-[#130b5c]",
            )}
          >
            <Play size={12} fill="currentColor" />
            {running ? "Đang chạy" : formatDuration(seconds).slice(0, 5)}
          </button>
          {estimateSeconds > 0 && (
            <>
              <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-[#e8ecea]">
                <div
                  className={cn(
                    "h-full rounded-full",
                    estimatePercent > 100
                      ? "bg-[#e34935]"
                      : estimatePercent >= 80
                        ? "bg-[#e2a319]"
                        : "bg-[#0c66e4]",
                  )}
                  style={{ width: `${Math.min(estimatePercent, 100)}%` }}
                />
              </div>
              <p
                className={cn(
                  "mt-1 text-right text-[9px] font-semibold",
                  estimatePercent > 100 ? "text-[#ae2a19]" : "text-[#89938e]",
                )}
              >
                {estimatePercent}% estimate
              </p>
            </>
          )}
        </div>
      </td>
    </tr>
  );
}

function BoardView({
  data,
  tasks,
  activeEntry,
  draggedId,
  setDraggedId,
  onDrop,
  onOpen,
  onTimer,
}: {
  data: DashboardData;
  tasks: Task[];
  activeEntry?: TimeEntry;
  draggedId: string | null;
  setDraggedId: (id: string | null) => void;
  onDrop: (status: TaskStatus) => void;
  onOpen: (id: string) => void;
  onTimer: (task: Task) => void;
}) {
  return (
    <div className="grid min-h-[600px] gap-4 overflow-x-auto pb-4 lg:grid-cols-4">
      {(Object.keys(statusMeta) as TaskStatus[]).map((status) => {
        const items = tasks.filter((task) => task.status === status);
        return (
          <div
            key={status}
            onDragOver={(event) => event.preventDefault()}
            onDrop={() => onDrop(status)}
            className={cn(
              "min-w-[270px] rounded-xl border border-[#e1e6e3] bg-[#f2f4f3] p-3 transition",
              draggedId && "border-dashed border-[#8ebdab]",
            )}
          >
            <div className="mb-3 flex items-center gap-2 px-1">
              <span
                className="h-2.5 w-2.5 rounded-full"
                style={{ background: statusMeta[status].color }}
              />
              <h3 className="text-xs font-bold uppercase tracking-wide">
                {statusMeta[status].label}
              </h3>
              <Badge className="bg-white text-[#68726d]">{items.length}</Badge>
              <Plus size={15} className="ml-auto text-[#87908d]" />
            </div>
            <div className="space-y-3">
              {items.map((task) => {
                const member = data.members.find(
                  (item) => item.id === task.assignee_id,
                );
                const project = data.projects.find(
                  (item) => item.id === task.project_id,
                );
                const running = activeEntry?.task_id === task.id;
                return (
                  <article
                    draggable
                    onDragStart={() => setDraggedId(task.id)}
                    onDragEnd={() => setDraggedId(null)}
                    key={task.id}
                    onClick={() => onOpen(task.id)}
                    className={cn(
                      "cursor-grab rounded-xl border border-[#dfe4e1] bg-white p-4 shadow-[0_1px_2px_rgba(20,35,29,.04)] transition hover:-translate-y-0.5 hover:border-[#b9c7c1] hover:shadow-md active:cursor-grabbing",
                      draggedId === task.id && "opacity-45",
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <span className="flex items-center gap-2 text-[11px] font-semibold text-[#7c8581]">
                        <i
                          className="h-2 w-2 rounded-full"
                          style={{ background: project?.color }}
                        />
                        {project?.name}
                      </span>
                      <Flag
                        size={14}
                        className={priorityMeta[task.priority].color}
                        fill="currentColor"
                      />
                    </div>
                    <h4 className="mt-3 text-sm font-semibold leading-5">
                      {task.title}
                    </h4>
                    <div className="mt-4 flex flex-wrap gap-1.5">
                      {taskLabels(task.id, data)
                        .slice(0, 2)
                        .map((label) => (
                          <span
                            key={label.id}
                            className="rounded px-1.5 py-0.5 text-[10px] font-semibold"
                            style={{
                              color: label.color,
                              background: `${label.color}15`,
                            }}
                          >
                            {label.name}
                          </span>
                        ))}
                    </div>
                    <div className="mt-4 flex items-center border-t border-[#edf0ee] pt-3">
                      <button
                        onClick={(event) => {
                          event.stopPropagation();
                          onTimer(task);
                        }}
                        className={cn(
                          "flex items-center gap-1 text-[11px] font-semibold",
                          running ? "text-[#c54141]" : "text-[#78827d]",
                        )}
                      >
                        <Timer size={13} />
                        {running
                          ? "Đang chạy"
                          : formatDuration(
                              taskSeconds(task.id, data.timeEntries),
                            ).slice(0, 5)}
                      </button>
                      <div className="ml-auto flex items-center gap-2">
                        {task.due_date && (
                          <span className="text-[10px] text-[#8a928e]">
                            {dateLabel(task.due_date)}
                          </span>
                        )}
                        {member && <Avatar name={member.full_name} small />}
                      </div>
                    </div>
                  </article>
                );
              })}
              {!items.length && (
                <div className="grid h-28 place-items-center rounded-lg border border-dashed border-[#d3dad6] text-xs text-[#99a19d]">
                  Kéo task vào đây
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function CalendarView({
  data,
  tasks,
  onOpen,
}: {
  data: DashboardData;
  tasks: Task[];
  onOpen: (id: string) => void;
}) {
  const [monthOffset, setMonthOffset] = useState(0);
  const base = new Date();
  const month = new Date(base.getFullYear(), base.getMonth() + monthOffset, 1);
  const startDay = (month.getDay() + 6) % 7;
  const days = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const cells = Array.from(
    { length: Math.ceil((startDay + days) / 7) * 7 },
    (_, index) => index - startDay + 1,
  );
  return (
    <Card className="overflow-hidden">
      <div className="flex items-center justify-between border-b border-[#e4e8e6] p-4">
        <button
          onClick={() => setMonthOffset(monthOffset - 1)}
          className="rounded-lg border px-3 py-1.5 text-sm"
        >
          ←
        </button>
        <h3 className="font-semibold">
          Tháng {month.getMonth() + 1}, {month.getFullYear()}
        </h3>
        <button
          onClick={() => setMonthOffset(monthOffset + 1)}
          className="rounded-lg border px-3 py-1.5 text-sm"
        >
          →
        </button>
      </div>
      <div className="grid grid-cols-7 border-b border-[#e4e8e6] bg-[#fafbfa]">
        {["T2", "T3", "T4", "T5", "T6", "T7", "CN"].map((day) => (
          <div
            key={day}
            className="p-2 text-center text-[11px] font-bold text-[#858e89]"
          >
            {day}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {cells.map((day, index) => {
          const date =
            day > 0 && day <= days
              ? `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`
              : null;
          const dayTasks = date
            ? tasks.filter((task) => task.due_date === date)
            : [];
          return (
            <div
              key={index}
              className={cn(
                "min-h-28 border-b border-r border-[#edf0ee] p-2",
                !date && "bg-[#fafbfa]",
              )}
            >
              <span className="text-xs font-semibold text-[#7c8580]">
                {date ? day : ""}
              </span>
              <div className="mt-1 space-y-1">
                {dayTasks.slice(0, 3).map((task) => (
                  <button
                    onClick={() => onOpen(task.id)}
                    key={task.id}
                    className="block w-full truncate rounded px-2 py-1 text-left text-[10px] font-semibold text-white"
                    style={{
                      background: data.projects.find(
                        (project) => project.id === task.project_id,
                      )?.color,
                    }}
                  >
                    {task.title}
                  </button>
                ))}
                {dayTasks.length > 3 && (
                  <span className="text-[10px] text-[#7c8580]">
                    +{dayTasks.length - 3} task
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

function BacklogView({
  data,
  tasks,
  isManager,
  onOpen,
  onDataChange,
  onError,
}: {
  data: DashboardData;
  tasks: Task[];
  isManager: boolean;
  onOpen: (id: string) => void;
  onDataChange: Props["onDataChange"];
  onError: (message: string) => void;
}) {
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Sprint | null>(null);
  const [deleting, setDeleting] = useState<Sprint | null>(null);
  const [busy, setBusy] = useState(false);
  const { toast } = useToast();
  const { tr } = useI18n();
  async function createSprint(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const payload = {
      name: String(form.get("name")),
      project_id: String(form.get("project_id")),
      goal: String(form.get("goal") || "") || null,
      start_date: String(form.get("start_date") || "") || null,
      end_date: String(form.get("end_date") || "") || null,
      created_by: data.profile.id,
    };
    const { data: sprint, error } = await createClient()
      .from("sprints")
      .insert(payload)
      .select()
      .single();
    if (error) onError(error.message);
    else {
      onDataChange((current) => ({
        ...current,
        sprints: [sprint as Sprint, ...current.sprints],
      }));
      setCreating(false);
      toast({
        title: tr("Đã tạo sprint", "Sprint created"),
        description: payload.name,
        variant: "success",
      });
    }
  }
  async function updateSprint(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editing) return;
    setBusy(true);
    const form = new FormData(event.currentTarget);
    const patch = {
      name: String(form.get("name")),
      goal: String(form.get("goal") || "") || null,
      start_date: String(form.get("start_date") || "") || null,
      end_date: String(form.get("end_date") || "") || null,
      status: String(form.get("status")) as Sprint["status"],
    };
    const { error } = await createClient()
      .from("sprints")
      .update(patch)
      .eq("id", editing.id);
    setBusy(false);
    if (error) onError(error.message);
    else {
      onDataChange((current) => ({
        ...current,
        sprints: current.sprints.map((sprint) =>
          sprint.id === editing.id ? { ...sprint, ...patch } : sprint,
        ),
      }));
      toast({
        title: tr("Đã cập nhật sprint", "Sprint updated"),
        variant: "success",
      });
      setEditing(null);
    }
  }
  async function deleteSprint() {
    if (!deleting) return;
    setBusy(true);
    const { error } = await createClient()
      .from("sprints")
      .delete()
      .eq("id", deleting.id);
    setBusy(false);
    if (error) onError(error.message);
    else {
      onDataChange((current) => ({
        ...current,
        sprints: current.sprints.filter((sprint) => sprint.id !== deleting.id),
        tasks: current.tasks.map((task) =>
          task.sprint_id === deleting.id ? { ...task, sprint_id: null } : task,
        ),
      }));
      toast({
        title: tr("Đã xóa sprint", "Sprint deleted"),
        variant: "success",
      });
      setDeleting(null);
    }
  }
  const groups: { id: string; name: string; status: string; tasks: Task[] }[] =
    [
      ...data.sprints.map((sprint) => ({
        id: sprint.id,
        name: sprint.name,
        status: sprint.status,
        tasks: tasks.filter((task) => task.sprint_id === sprint.id),
      })),
      {
        id: "backlog",
        name: "Product Backlog",
        status: "backlog",
        tasks: tasks.filter((task) => !task.sprint_id),
      },
    ];
  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        {isManager && (
          <Button variant="outline" onClick={() => setCreating(true)}>
            <GitPullRequest size={16} /> {tr("Sprint mới", "New sprint")}
          </Button>
        )}
      </div>
      {creating && (
        <Card className="p-4">
          <form onSubmit={createSprint} className="grid gap-3 md:grid-cols-5">
            <Input name="name" required placeholder="Sprint 12" />
            <SelectField
              name="project_id"
              required
              placeholder={tr("Chọn dự án", "Select project")}
              options={data.projects.map((project) => ({
                value: project.id,
                label: project.name,
              }))}
            />
            <DatePicker
              name="start_date"
              placeholder={tr("Ngày bắt đầu", "Start date")}
            />
            <DatePicker
              name="end_date"
              placeholder={tr("Ngày kết thúc", "End date")}
            />
            <div className="flex gap-2">
              <Button type="submit" size="sm">
                {tr("Tạo", "Create")}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => setCreating(false)}
              >
                {tr("Hủy", "Cancel")}
              </Button>
            </div>
            <Input
              name="goal"
              placeholder={tr("Mục tiêu sprint", "Sprint goal")}
              className="md:col-span-5"
            />
          </form>
        </Card>
      )}
      {groups.map((group) => {
        const sprint = data.sprints.find((item) => item.id === group.id);
        return (
          <Card key={group.id} className="overflow-hidden">
            <div className="flex items-center gap-3 border-b border-[#e7ebe8] bg-[#fafbfa] px-4 py-3">
              <ChevronDown size={16} />
              <span className="font-semibold">{group.name}</span>
              <Badge
                className={
                  group.status === "active"
                    ? "bg-[#e5f6ef] text-[#11744d]"
                    : "bg-[#edf0ef] text-[#68726d]"
                }
              >
                {group.status === "active"
                  ? tr("Đang chạy", "Active")
                  : group.status === "backlog"
                    ? "Backlog"
                    : tr("Kế hoạch", "Planned")}
              </Badge>
              <span className="ml-auto text-xs text-[#858e89]">
                {group.tasks.length} task
              </span>
              {isManager && sprint && (
                <div className="flex">
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={tr("Sửa sprint", "Edit sprint")}
                    onClick={() => setEditing(sprint)}
                  >
                    <Pencil size={15} />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={tr("Xóa sprint", "Delete sprint")}
                    onClick={() => setDeleting(sprint)}
                  >
                    <Trash2 size={15} className="text-[#c54141]" />
                  </Button>
                </div>
              )}
            </div>
            {group.tasks.length ? (
              group.tasks.map((task) => (
                <button
                  onClick={() => onOpen(task.id)}
                  key={task.id}
                  className="flex w-full items-center gap-3 border-b border-[#edf0ee] px-4 py-3 text-left last:border-0 hover:bg-[#fafcfa]"
                >
                  <Circle size={16} className="text-[#a1a8a4]" />
                  <span className="flex-1 text-sm font-semibold">
                    {task.title}
                  </span>
                  <span
                    className={cn(
                      "text-xs font-semibold",
                      priorityMeta[task.priority].color,
                    )}
                  >
                    {priorityMeta[task.priority].label}
                  </span>
                  {task.estimated_minutes && (
                    <span className="text-xs text-[#7d8681]">
                      {task.estimated_minutes}m
                    </span>
                  )}
                </button>
              ))
            ) : (
              <div className="p-6 text-center text-xs text-[#929a96]">
                {tr("Chưa có task trong nhóm này", "No tasks in this group")}
              </div>
            )}
          </Card>
        );
      })}
      {editing && (
        <div className="fixed inset-0 z-[90] grid place-items-center bg-[#08042f]/45 p-4">
          <Card className="w-full max-w-lg p-6">
            <h2 className="text-lg font-bold">
              {tr("Chỉnh sửa sprint", "Edit sprint")}
            </h2>
            <form
              onSubmit={updateSprint}
              className="mt-5 grid gap-3 sm:grid-cols-2"
            >
              <Input name="name" required defaultValue={editing.name} />
              <Input
                name="goal"
                defaultValue={editing.goal ?? ""}
                placeholder={tr("Mục tiêu", "Goal")}
              />
              <DatePicker
                name="start_date"
                defaultValue={editing.start_date}
                placeholder={tr("Ngày bắt đầu", "Start date")}
              />
              <DatePicker
                name="end_date"
                defaultValue={editing.end_date}
                placeholder={tr("Ngày kết thúc", "End date")}
              />
              <SelectField
                name="status"
                defaultValue={editing.status}
                options={[
                  { value: "planned", label: tr("Kế hoạch", "Planned") },
                  { value: "active", label: tr("Đang chạy", "Active") },
                  { value: "completed", label: tr("Hoàn thành", "Completed") },
                ]}
              />
              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setEditing(null)}
                >
                  {tr("Hủy", "Cancel")}
                </Button>
                <Button type="submit" disabled={busy}>
                  {tr("Lưu", "Save")}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}
      <ConfirmDialog
        open={!!deleting}
        title={tr("Xóa sprint?", "Delete sprint?")}
        description={tr(
          `Task trong “${deleting?.name}” sẽ được chuyển về Product Backlog.`,
          `Tasks in “${deleting?.name}” will move to Product Backlog.`,
        )}
        confirmLabel={tr("Xóa sprint", "Delete sprint")}
        busy={busy}
        onConfirm={deleteSprint}
        onClose={() => setDeleting(null)}
      />
    </div>
  );
}

function TaskDrawer({
  task,
  data,
  activeEntry,
  isManager,
  onClose,
  onTimer,
  onStatus,
  onDataChange,
  onError,
}: {
  task: Task;
  data: DashboardData;
  activeEntry?: TimeEntry;
  isManager: boolean;
  onClose: () => void;
  onTimer: (task: Task) => void;
  onStatus: (task: Task, status: TaskStatus) => void;
  onDataChange: Props["onDataChange"];
  onError: (message: string) => void;
}) {
  const [tab, setTab] = useState<"comments" | "activity">("comments");
  const [editingDescription, setEditingDescription] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [newLabelMode, setNewLabelMode] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<{
    kind: "checklist" | "comment" | "attachment";
    id: string;
    label: string;
    path?: string;
  } | null>(null);
  const { toast } = useToast();
  const { tr } = useI18n();
  const project = data.projects.find((item) => item.id === task.project_id);
  const checklist = data.checklistItems.filter(
    (item) => item.task_id === task.id,
  );
  const comments = data.comments.filter((item) => item.task_id === task.id);
  const attachments = data.attachments.filter(
    (item) => item.task_id === task.id,
  );
  const activity = data.activityLogs.filter((item) => item.task_id === task.id);
  const completed = checklist.filter((item) => item.is_completed).length;
  const running = activeEntry?.task_id === task.id;
  const loggedSeconds = taskSeconds(task.id, data.timeEntries);
  const estimateSeconds = (task.estimated_minutes ?? 0) * 60;
  const estimatePercent = estimateSeconds
    ? Math.round((loggedSeconds / estimateSeconds) * 100)
    : 0;
  async function updateTask(patch: Partial<Task>) {
    const { error } = await createClient()
      .from("tasks")
      .update(patch)
      .eq("id", task.id);
    if (error) onError(error.message);
    else
      onDataChange((current) => ({
        ...current,
        tasks: current.tasks.map((item) =>
          item.id === task.id ? { ...item, ...patch } : item,
        ),
      }));
  }
  async function saveDescription(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await updateTask({
      description:
        String(new FormData(event.currentTarget).get("description") || "") ||
        null,
    });
    setEditingDescription(false);
    toast({ title: "Đã lưu mô tả", variant: "success", duration: 2500 });
  }
  async function addChecklist(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const content = String(new FormData(form).get("content") || "").trim();
    if (!content) return;
    const { data: item, error } = await createClient()
      .from("task_checklist_items")
      .insert({
        task_id: task.id,
        content,
        created_by: data.profile.id,
        position: checklist.length,
      })
      .select()
      .single();
    if (error) onError(error.message);
    else {
      onDataChange((current) => ({
        ...current,
        checklistItems: [...current.checklistItems, item as ChecklistItem],
      }));
      form.reset();
      toast({ title: "Đã thêm checklist", variant: "success", duration: 2200 });
    }
  }
  async function toggleChecklist(item: ChecklistItem) {
    const next = !item.is_completed;
    const { error } = await createClient()
      .from("task_checklist_items")
      .update({ is_completed: next })
      .eq("id", item.id);
    if (error) onError(error.message);
    else
      onDataChange((current) => ({
        ...current,
        checklistItems: current.checklistItems.map((row) =>
          row.id === item.id ? { ...row, is_completed: next } : row,
        ),
      }));
  }
  async function addComment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const content = String(new FormData(form).get("comment") || "").trim();
    if (!content) return;
    const { data: comment, error } = await createClient()
      .from("task_comments")
      .insert({ task_id: task.id, user_id: data.profile.id, content })
      .select()
      .single();
    if (error) onError(error.message);
    else {
      onDataChange((current) => ({
        ...current,
        comments: [...current.comments, comment as TaskComment],
      }));
      form.reset();
      toast({ title: "Đã đăng bình luận", variant: "success", duration: 2200 });
    }
  }
  async function uploadFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.size > 20 * 1024 * 1024) {
      onError("Tệp không được vượt quá 20 MB.");
      event.target.value = "";
      return;
    }
    setUploading(true);
    const supabase = createClient();
    const path = `${data.profile.id}/${task.id}/${crypto.randomUUID()}-${file.name}`;
    const { error: uploadError } = await supabase.storage
      .from("task-attachments")
      .upload(path, file);
    if (uploadError) onError(uploadError.message);
    else {
      const { data: attachment, error } = await supabase
        .from("task_attachments")
        .insert({
          task_id: task.id,
          uploaded_by: data.profile.id,
          file_name: file.name,
          file_path: path,
          file_size: file.size,
          mime_type: file.type,
        })
        .select()
        .single();
      if (error) onError(error.message);
      else {
        onDataChange((current) => ({
          ...current,
          attachments: [...current.attachments, attachment as TaskAttachment],
        }));
        toast({
          title: "Tải tệp thành công",
          description: file.name,
          variant: "success",
        });
      }
    }
    setUploading(false);
    event.target.value = "";
  }
  async function downloadFile(attachment: TaskAttachment) {
    const { data: signed, error } = await createClient()
      .storage.from("task-attachments")
      .createSignedUrl(attachment.file_path, 60);
    if (error) onError(error.message);
    else window.open(signed.signedUrl, "_blank", "noopener,noreferrer");
  }
  async function deleteTask() {
    setDeleting(true);
    const { error } = await createClient()
      .from("tasks")
      .delete()
      .eq("id", task.id);
    if (error) {
      onError(error.message);
      setDeleting(false);
    } else {
      onDataChange((current) => ({
        ...current,
        tasks: current.tasks.filter((item) => item.id !== task.id),
      }));
      toast({
        title: "Đã xóa task",
        description: task.title,
        variant: "success",
      });
      onClose();
    }
  }
  async function addLabel(labelId: string) {
    if (
      !labelId ||
      data.taskLabels.some(
        (item) => item.task_id === task.id && item.label_id === labelId,
      )
    )
      return;
    const { data: relation, error } = await createClient()
      .from("task_labels")
      .insert({ task_id: task.id, label_id: labelId })
      .select()
      .single();
    if (error) onError(error.message);
    else
      onDataChange((current) => ({
        ...current,
        taskLabels: [...current.taskLabels, relation],
      }));
  }
  async function createLabel(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = new FormData(form);
    const name = String(values.get("label_name") || "").trim();
    if (!name) return;
    const { data: label, error } = await createClient()
      .from("labels")
      .insert({
        project_id: task.project_id,
        name,
        color: String(values.get("label_color") || "#6957c8"),
      })
      .select()
      .single();
    if (error) onError(error.message);
    else {
      const typed = label as Label;
      onDataChange((current) => ({
        ...current,
        labels: [...current.labels, typed],
      }));
      await addLabel(typed.id);
      setNewLabelMode(false);
      toast({ title: "Đã tạo nhãn", description: name, variant: "success" });
    }
  }
  async function removeTaskLabel(labelId: string) {
    const { error } = await createClient()
      .from("task_labels")
      .delete()
      .eq("task_id", task.id)
      .eq("label_id", labelId);
    if (error) onError(error.message);
    else
      onDataChange((current) => ({
        ...current,
        taskLabels: current.taskLabels.filter(
          (item) => !(item.task_id === task.id && item.label_id === labelId),
        ),
      }));
  }
  async function deleteRelatedItem() {
    if (!pendingDelete) return;
    setDeleting(true);
    const supabase = createClient();
    if (pendingDelete.kind === "attachment" && pendingDelete.path) {
      const { error: storageError } = await supabase.storage
        .from("task-attachments")
        .remove([pendingDelete.path]);
      if (storageError) {
        onError(storageError.message);
        setDeleting(false);
        return;
      }
    }
    const table =
      pendingDelete.kind === "checklist"
        ? "task_checklist_items"
        : pendingDelete.kind === "comment"
          ? "task_comments"
          : "task_attachments";
    const { error } = await supabase
      .from(table)
      .delete()
      .eq("id", pendingDelete.id);
    setDeleting(false);
    if (error) onError(error.message);
    else {
      onDataChange((current) =>
        pendingDelete.kind === "checklist"
          ? {
              ...current,
              checklistItems: current.checklistItems.filter(
                (item) => item.id !== pendingDelete.id,
              ),
            }
          : pendingDelete.kind === "comment"
            ? {
                ...current,
                comments: current.comments.filter(
                  (item) => item.id !== pendingDelete.id,
                ),
              }
            : {
                ...current,
                attachments: current.attachments.filter(
                  (item) => item.id !== pendingDelete.id,
                ),
              },
      );
      toast({
        title: tr("Đã xóa", "Deleted"),
        description: pendingDelete.label,
        variant: "success",
      });
      setPendingDelete(null);
    }
  }
  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-[#08042f]/35 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-label={`Chi tiết task ${task.title}`}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <aside className="flex h-full w-full max-w-[900px] flex-col bg-white shadow-2xl">
        <header className="flex h-16 shrink-0 items-center gap-3 border-b border-[#e3e7e5] px-5">
          <span className="flex items-center gap-2 text-xs font-semibold text-[#7b8580]">
            <i
              className="h-2.5 w-2.5 rounded-full"
              style={{ background: project?.color }}
            />
            {project?.name}
            <span>/</span>#{task.id.slice(0, 6).toUpperCase()}
          </span>
          <div className="ml-auto flex items-center gap-1">
            <Button
              variant={running ? "danger" : "outline"}
              size="sm"
              onClick={() => onTimer(task)}
            >
              <Play size={14} fill="currentColor" />
              {running ? "Dừng timer" : "Bấm giờ"}
            </Button>
            {isManager && (
              <Button
                variant="ghost"
                size="icon"
                aria-label="Xóa task"
                onClick={() => setConfirmDelete(true)}
              >
                <Trash2 size={17} className="text-[#c54a4a]" />
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              aria-label="Đóng chi tiết task"
              onClick={onClose}
            >
              <X size={20} />
            </Button>
          </div>
        </header>
        <div className="grid min-h-0 flex-1 overflow-y-auto lg:grid-cols-[1fr_280px]">
          <main className="p-6 lg:p-8">
            <div className="flex items-start gap-3">
              <button
                aria-label={
                  task.status === "done"
                    ? "Đánh dấu chưa hoàn thành"
                    : "Đánh dấu hoàn thành"
                }
                onClick={() =>
                  onStatus(task, task.status === "done" ? "todo" : "done")
                }
                className={cn(
                  "mt-1 grid h-6 w-6 shrink-0 place-items-center rounded-full border",
                  task.status === "done"
                    ? "border-[#16a36a] bg-[#16a36a] text-white"
                    : "border-[#bbc5c0]",
                )}
              >
                <Check size={14} />
              </button>
              <input
                aria-label="Tên task"
                defaultValue={task.title}
                onBlur={(event) =>
                  event.target.value !== task.title &&
                  updateTask({ title: event.target.value })
                }
                className="w-full border-0 bg-transparent text-2xl font-bold tracking-tight outline-none"
              />
            </div>
            <div className="ml-0 mt-6 sm:ml-9">
              <SectionTitle
                icon={AlignLeft}
                title="Mô tả"
                action={editingDescription ? "Hủy" : "Chỉnh sửa"}
                onAction={() => setEditingDescription(!editingDescription)}
              />
              {editingDescription ? (
                <form onSubmit={saveDescription} className="mt-3">
                  <textarea
                    name="description"
                    defaultValue={task.description ?? ""}
                    rows={6}
                    autoFocus
                    className="w-full rounded-lg border border-[#cfd7d3] p-3 text-sm leading-6 outline-none focus:border-[#130b5c]"
                  />
                  <Button type="submit" size="sm" className="mt-2">
                    Lưu mô tả
                  </Button>
                </form>
              ) : (
                <p
                  onClick={() => setEditingDescription(true)}
                  className="mt-3 min-h-20 cursor-text whitespace-pre-wrap rounded-lg border border-transparent p-3 text-sm leading-6 text-[#59645f] hover:border-[#e0e5e2] hover:bg-[#fafbfa]"
                >
                  {task.description ||
                    "Thêm mô tả chi tiết, acceptance criteria hoặc link thiết kế…"}
                </p>
              )}
              <div className="mt-8">
                <SectionTitle
                  icon={ListChecks}
                  title={`Checklist ${completed}/${checklist.length}`}
                />
                {checklist.length > 0 && (
                  <>
                    <div className="mt-3 h-2 overflow-hidden rounded-full bg-[#edf0ee]">
                      <div
                        className="h-full rounded-full bg-[#16a36a] transition-all"
                        style={{
                          width: `${(completed / checklist.length) * 100}%`,
                        }}
                      />
                    </div>
                    <div className="mt-3 space-y-1">
                      {checklist.map((item) => (
                        <div
                          key={item.id}
                          className="group flex items-center rounded-lg hover:bg-[#f6f8f7]"
                        >
                          <button
                            onClick={() => toggleChecklist(item)}
                            className="flex min-w-0 flex-1 items-center gap-3 px-2 py-2 text-left"
                          >
                            <span
                              className={cn(
                                "grid h-5 w-5 place-items-center rounded border",
                                item.is_completed
                                  ? "border-[#16a36a] bg-[#16a36a] text-white"
                                  : "border-[#cbd3cf]",
                              )}
                            >
                              {item.is_completed && <Check size={13} />}
                            </span>
                            <span
                              className={cn(
                                "truncate text-sm",
                                item.is_completed &&
                                  "text-[#8a938f] line-through",
                              )}
                            >
                              {item.content}
                            </span>
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              setPendingDelete({
                                kind: "checklist",
                                id: item.id,
                                label: item.content,
                              })
                            }
                            className="mr-2 rounded p-1 text-[#9aa29e] opacity-0 hover:bg-[#ffebe8] hover:text-[#c54141] group-hover:opacity-100"
                            aria-label={tr(
                              "Xóa checklist",
                              "Delete checklist item",
                            )}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
              <form onSubmit={addChecklist} className="mt-3 flex gap-2">
                <Input
                  name="content"
                  placeholder={tr(
                    "Thêm checklist item…",
                    "Add checklist item…",
                  )}
                />
                <Button type="submit" variant="outline" size="icon">
                  <Plus size={17} />
                </Button>
              </form>
              <div className="mt-8">
                <SectionTitle
                  icon={Paperclip}
                  title={`${tr("Tệp đính kèm", "Attachments")} ${attachments.length}`}
                />
                <div className="mt-3 space-y-2">
                  {attachments.map((attachment) => (
                    <div
                      key={attachment.id}
                      className="flex w-full items-center gap-2 rounded-lg border border-[#e2e7e4] p-2 hover:bg-[#fafbfa]"
                    >
                      <button
                        onClick={() => downloadFile(attachment)}
                        className="flex min-w-0 flex-1 items-center gap-3 p-1 text-left"
                      >
                        <span className="grid h-9 w-9 place-items-center rounded-lg bg-[#edf3f0] text-[#130b5c]">
                          <FileText size={18} />
                        </span>
                        <span className="min-w-0 flex-1">
                          <b className="block truncate text-sm">
                            {attachment.file_name}
                          </b>
                          <small className="text-[#89928e]">
                            {attachment.file_size
                              ? `${Math.round(attachment.file_size / 1024)} KB`
                              : tr("Tệp", "File")}
                          </small>
                        </span>
                        <Download size={16} className="text-[#7d8782]" />
                      </button>
                      {(attachment.uploaded_by === data.profile.id ||
                        isManager) && (
                        <button
                          type="button"
                          onClick={() =>
                            setPendingDelete({
                              kind: "attachment",
                              id: attachment.id,
                              label: attachment.file_name,
                              path: attachment.file_path,
                            })
                          }
                          className="rounded-md p-2 text-[#9aa29e] hover:bg-[#ffebe8] hover:text-[#c54141]"
                          aria-label={tr("Xóa tệp", "Delete attachment")}
                        >
                          <Trash2 size={15} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                <label className="mt-3 flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-[#cbd4cf] p-4 text-xs font-semibold text-[#63706a] hover:border-[#130b5c] hover:bg-[#f3faf7] hover:text-[#130b5c]">
                  <Paperclip size={15} />
                  {uploading
                    ? tr("Đang tải lên…", "Uploading…")
                    : tr("Đính kèm tệp", "Attach file")}
                  <input
                    type="file"
                    className="hidden"
                    disabled={uploading}
                    onChange={uploadFile}
                  />
                </label>
              </div>
              <div className="mt-8 border-t border-[#e5e9e7] pt-5">
                <div className="flex gap-5">
                  <button
                    onClick={() => setTab("comments")}
                    className={cn(
                      "border-b-2 pb-2 text-sm font-semibold",
                      tab === "comments"
                        ? "border-[#130b5c] text-[#130b5c]"
                        : "border-transparent text-[#7c8581]",
                    )}
                  >
                    {tr("Bình luận", "Comments")} ({comments.length})
                  </button>
                  <button
                    onClick={() => setTab("activity")}
                    className={cn(
                      "border-b-2 pb-2 text-sm font-semibold",
                      tab === "activity"
                        ? "border-[#130b5c] text-[#130b5c]"
                        : "border-transparent text-[#7c8581]",
                    )}
                  >
                    {tr("Hoạt động", "Activity")} ({activity.length})
                  </button>
                </div>
                {tab === "comments" ? (
                  <Comments
                    comments={comments}
                    data={data}
                    onSubmit={addComment}
                    onDelete={(comment) =>
                      setPendingDelete({
                        kind: "comment",
                        id: comment.id,
                        label: tr("Bình luận", "Comment"),
                      })
                    }
                    isManager={isManager}
                  />
                ) : (
                  <Activity logs={activity} data={data} />
                )}
              </div>
            </div>
          </main>
          <aside className="border-l border-[#e5e9e7] bg-[#fafbfa] p-5">
            <p className="mb-5 text-[11px] font-bold uppercase tracking-wider text-[#8a938f]">
              {tr("Thuộc tính", "Properties")}
            </p>
            <Property icon={Circle} label={tr("Trạng thái", "Status")}>
              <SelectField
                value={task.status}
                onValueChange={(value) => onStatus(task, value as TaskStatus)}
                className={cn(
                  "h-9 text-xs font-semibold shadow-none",
                  statusMeta[task.status].soft,
                )}
                options={(Object.keys(statusMeta) as TaskStatus[]).map(
                  (value) => ({
                    value,
                    label:
                      value === "todo"
                        ? tr("Cần làm", "To do")
                        : value === "in_progress"
                          ? tr("Đang làm", "In progress")
                          : value === "review"
                            ? tr("Đang duyệt", "In review")
                            : tr("Hoàn thành", "Done"),
                  }),
                )}
              />
            </Property>
            <Property
              icon={UserRound}
              label={tr("Người thực hiện", "Assignee")}
            >
              <SelectField
                value={task.assignee_id ?? "unassigned"}
                disabled={!isManager}
                onValueChange={(value) =>
                  updateTask({
                    assignee_id: value === "unassigned" ? null : value,
                  })
                }
                className="h-9 text-xs shadow-none"
                options={[
                  { value: "unassigned", label: tr("Chưa giao", "Unassigned") },
                  ...data.members.map((member) => ({
                    value: member.id,
                    label: member.full_name,
                  })),
                ]}
              />
            </Property>
            <Property icon={Flag} label={tr("Ưu tiên", "Priority")}>
              <SelectField
                value={task.priority}
                onValueChange={(value) =>
                  updateTask({ priority: value as TaskPriority })
                }
                className="h-9 text-xs shadow-none"
                options={(Object.keys(priorityMeta) as TaskPriority[]).map(
                  (value) => ({
                    value,
                    label:
                      value === "low"
                        ? tr("Thấp", "Low")
                        : value === "medium"
                          ? tr("Trung bình", "Medium")
                          : tr("Cao", "High"),
                  }),
                )}
              />
            </Property>
            <Property
              icon={CalendarDays}
              label={tr("Ngày hết hạn", "Due date")}
            >
              <DatePicker
                value={task.due_date}
                onChange={(value) => updateTask({ due_date: value })}
                className="h-9 text-xs shadow-none"
              />
            </Property>
            <Property icon={GitPullRequest} label="Sprint">
              <SelectField
                value={task.sprint_id ?? "backlog"}
                disabled={!isManager}
                onValueChange={(value) =>
                  updateTask({ sprint_id: value === "backlog" ? null : value })
                }
                className="h-9 text-xs shadow-none"
                options={[
                  { value: "backlog", label: "Backlog" },
                  ...data.sprints
                    .filter((sprint) => sprint.project_id === task.project_id)
                    .map((sprint) => ({
                      value: sprint.id,
                      label: sprint.name,
                    })),
                ]}
              />
            </Property>
            <Property icon={Clock3} label={tr("Ước tính", "Estimate")}>
              <input
                type="number"
                min="0"
                value={task.estimated_minutes ?? ""}
                onChange={(event) =>
                  updateTask({
                    estimated_minutes: Number(event.target.value) || null,
                  })
                }
                className="w-full rounded-md border border-[#dce2df] bg-white px-2 py-1.5 text-xs"
                placeholder={tr("Phút", "Minutes")}
              />
            </Property>
            <Property icon={Timer} label={tr("Đã ghi", "Logged")}>
              <span className="font-mono text-xs font-semibold">
                {formatDuration(taskSeconds(task.id, data.timeEntries))}
              </span>
            </Property>
            <Property icon={Tag} label={tr("Nhãn", "Labels")}>
              <div className="flex flex-wrap gap-1">
                {taskLabels(task.id, data).map((label) => (
                  <span
                    key={label.id}
                    className="inline-flex items-center gap-1 rounded px-2 py-1 text-[10px] font-semibold"
                    style={{
                      color: label.color,
                      background: `${label.color}15`,
                    }}
                  >
                    {label.name}
                    {isManager && (
                      <button
                        type="button"
                        onClick={() => removeTaskLabel(label.id)}
                        aria-label={tr("Bỏ nhãn", "Remove label")}
                      >
                        <X size={10} />
                      </button>
                    )}
                  </span>
                ))}
                {!taskLabels(task.id, data).length && (
                  <span className="text-xs text-[#969e9a]">
                    {tr("Chưa có nhãn", "No labels")}
                  </span>
                )}
              </div>
              {isManager && (
                <div className="mt-2 flex gap-1">
                  <SelectField
                    key={
                      data.taskLabels.filter((item) => item.task_id === task.id)
                        .length
                    }
                    placeholder={tr("+ Gắn nhãn", "+ Add label")}
                    onValueChange={addLabel}
                    className="h-8 min-w-0 flex-1 text-[11px] shadow-none"
                    options={data.labels
                      .filter((label) => label.project_id === task.project_id)
                      .map((label) => ({ value: label.id, label: label.name }))}
                  />
                  <button
                    type="button"
                    onClick={() => setNewLabelMode(!newLabelMode)}
                    className="rounded-md border border-[#dce2df] bg-white px-2 text-xs"
                  >
                    {tr("Mới", "New")}
                  </button>
                </div>
              )}
              {isManager && newLabelMode && (
                <form onSubmit={createLabel} className="mt-2 flex gap-1">
                  <input
                    name="label_color"
                    type="color"
                    defaultValue="#6957c8"
                    className="h-8 w-9 rounded border p-0.5"
                    aria-label={tr("Màu nhãn", "Label color")}
                  />
                  <input
                    name="label_name"
                    required
                    autoFocus
                    placeholder={tr("Tên nhãn", "Label name")}
                    className="min-w-0 flex-1 rounded-md border border-[#dce2df] bg-white px-2 text-[11px]"
                  />
                  <button
                    type="submit"
                    className="rounded-md bg-[#130b5c] px-2 text-[11px] font-semibold text-white"
                  >
                    {tr("Tạo", "Create")}
                  </button>
                </form>
              )}
            </Property>
            <div className="mt-8 rounded-lg border border-[#e0e5e2] bg-white p-3">
              <p className="text-[10px] font-bold uppercase text-[#8a938f]">
                {tr("Tiến độ task", "Task progress")}
              </p>
              <div className="mt-3 flex items-center justify-between text-xs">
                <span>Checklist</span>
                <b>
                  {checklist.length
                    ? Math.round((completed / checklist.length) * 100)
                    : 0}
                  %
                </b>
              </div>
              <div className="mt-2 h-1.5 rounded-full bg-[#edf0ee]">
                <div
                  className="h-full rounded-full bg-[#16a36a]"
                  style={{
                    width: `${checklist.length ? (completed / checklist.length) * 100 : 0}%`,
                  }}
                />
              </div>
              <div className="mt-4 border-t border-[#edf0ee] pt-3">
                <div className="flex items-center justify-between text-xs">
                  <span>
                    {tr("Giờ thực tế / estimate", "Actual / estimate")}
                  </span>
                  <b className={estimatePercent > 100 ? "text-[#ae2a19]" : ""}>
                    {estimateSeconds ? `${estimatePercent}%` : "—"}
                  </b>
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#edf0ee]">
                  <div
                    className={cn(
                      "h-full rounded-full",
                      estimatePercent > 100
                        ? "bg-[#e34935]"
                        : estimatePercent >= 80
                          ? "bg-[#e2a319]"
                          : "bg-[#0c66e4]",
                    )}
                    style={{ width: `${Math.min(estimatePercent, 100)}%` }}
                  />
                </div>
                <p className="mt-2 text-[10px] text-[#7e8983]">
                  {formatDuration(loggedSeconds).slice(0, 5)} /{" "}
                  {estimateSeconds
                    ? formatDuration(estimateSeconds).slice(0, 5)
                    : tr("chưa estimate", "not estimated")}
                </p>
              </div>
            </div>
          </aside>
        </div>
      </aside>
      <ConfirmDialog
        open={confirmDelete}
        title={tr("Xóa task?", "Delete task?")}
        description={tr(
          "Task, checklist, bình luận, tệp và toàn bộ lịch sử liên quan sẽ bị xóa. Hành động này không thể hoàn tác.",
          "The task, checklist, comments, files and activity history will be deleted. This cannot be undone.",
        )}
        confirmLabel={tr("Xóa task", "Delete task")}
        busy={deleting}
        onConfirm={deleteTask}
        onClose={() => setConfirmDelete(false)}
      />
      <ConfirmDialog
        open={!!pendingDelete}
        title={tr("Xác nhận xóa?", "Confirm deletion?")}
        description={tr(
          `“${pendingDelete?.label}” sẽ bị xóa vĩnh viễn.`,
          `“${pendingDelete?.label}” will be permanently deleted.`,
        )}
        confirmLabel={tr("Xóa", "Delete")}
        busy={deleting}
        onConfirm={deleteRelatedItem}
        onClose={() => setPendingDelete(null)}
      />
    </div>
  );
}

function Comments({
  comments,
  data,
  onSubmit,
  onDelete,
  isManager,
}: {
  comments: TaskComment[];
  data: DashboardData;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onDelete: (comment: TaskComment) => void;
  isManager: boolean;
}) {
  const { tr, dateLocale } = useI18n();
  return (
    <div className="mt-5">
      <div className="space-y-5">
        {comments.map((comment) => {
          const member = data.members.find(
            (item) => item.id === comment.user_id,
          );
          return (
            <div key={comment.id} className="flex gap-3">
              <Avatar name={member?.full_name ?? "?"} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <b className="text-sm">
                    {member?.full_name ?? tr("Thành viên", "Member")}
                  </b>
                  <span className="text-[11px] text-[#929a96]">
                    {new Date(comment.created_at).toLocaleString(dateLocale)}
                  </span>
                  {(comment.user_id === data.profile.id || isManager) && (
                    <button
                      type="button"
                      onClick={() => onDelete(comment)}
                      className="ml-auto rounded p-1 text-[#9aa29e] hover:bg-[#ffebe8] hover:text-[#c54141]"
                      aria-label={tr("Xóa bình luận", "Delete comment")}
                    >
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>
                <p className="mt-1 rounded-lg bg-[#f5f7f6] p-3 text-sm leading-6 text-[#52605a]">
                  {comment.content}
                </p>
              </div>
            </div>
          );
        })}
        {!comments.length && (
          <p className="py-4 text-center text-xs text-[#929a96]">
            {tr("Chưa có bình luận", "No comments yet")}
          </p>
        )}
      </div>
      <form onSubmit={onSubmit} className="mt-5 flex items-start gap-3">
        <Avatar name={data.profile.full_name} />
        <div className="relative flex-1">
          <textarea
            name="comment"
            rows={3}
            placeholder={tr(
              "Viết bình luận… Dùng @ để nhắc thành viên",
              "Write a comment… Use @ to mention a teammate",
            )}
            className="w-full rounded-lg border border-[#dce2df] p-3 pr-12 text-sm outline-none focus:border-[#130b5c]"
          />
          <Button
            type="submit"
            size="icon"
            className="absolute bottom-2 right-2"
          >
            <Send size={15} />
          </Button>
        </div>
      </form>
    </div>
  );
}
function Activity({
  logs,
  data,
}: {
  logs: DashboardData["activityLogs"];
  data: DashboardData;
}) {
  const labels: Record<string, string> = {
    task_created: "đã tạo task",
    status_changed: "đã đổi trạng thái",
    assignee_changed: "đã đổi người thực hiện",
    task_updated: "đã cập nhật nội dung",
  };
  return (
    <div className="mt-5 space-y-4">
      {logs.map((log) => {
        const member = data.members.find((item) => item.id === log.user_id);
        return (
          <div key={log.id} className="flex gap-3">
            <span className="mt-1 h-2 w-2 rounded-full bg-[#77b9a1]" />
            <p className="text-xs leading-5 text-[#66716c]">
              <b>{member?.full_name ?? "Hệ thống"}</b>{" "}
              {labels[log.action] ?? log.action}
              <br />
              <span className="text-[#98a09c]">
                {new Date(log.created_at).toLocaleString("vi-VN")}
              </span>
            </p>
          </div>
        );
      })}
      {!logs.length && (
        <p className="py-4 text-center text-xs text-[#929a96]">
          Chưa có hoạt động
        </p>
      )}
    </div>
  );
}
function Property({
  icon: Icon,
  label,
  children,
}: {
  icon: typeof Circle;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-4">
      <div className="mb-1.5 flex items-center gap-2 text-[11px] font-semibold text-[#7d8782]">
        <Icon size={13} />
        {label}
      </div>
      {children}
    </div>
  );
}
function SectionTitle({
  icon: Icon,
  title,
  action,
  onAction,
}: {
  icon: typeof AlignLeft;
  title: string;
  action?: string;
  onAction?: () => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <Icon size={18} className="text-[#65706b]" />
      <h3 className="font-semibold">{title}</h3>
      {action && (
        <button
          onClick={onAction}
          className="ml-auto text-xs font-semibold text-[#130b5c] hover:underline"
        >
          {action}
        </button>
      )}
    </div>
  );
}
function Avatar({ name, small = false }: { name: string; small?: boolean }) {
  return (
    <span
      title={name}
      className={cn(
        "grid shrink-0 place-items-center rounded-full bg-[#e8e7fb] font-bold text-[#130b5c]",
        small ? "h-6 w-6 text-[9px]" : "h-8 w-8 text-[10px]",
      )}
    >
      {initials(name)}
    </span>
  );
}
function EmptyTasks() {
  const { tr } = useI18n();
  return (
    <Card className="grid min-h-[420px] place-items-center text-center">
      <div>
        <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-[#e7f4ef] text-[#130b5c]">
          <Sparkles size={24} />
        </span>
        <h3 className="mt-4 font-semibold">
          {tr("Không tìm thấy task", "No tasks found")}
        </h3>
        <p className="mt-2 text-sm text-[#818b86]">
          {tr(
            "Thử thay đổi bộ lọc hoặc tạo task mới.",
            "Try changing the filters or create a new task.",
          )}
        </p>
      </div>
    </Card>
  );
}
function taskSeconds(taskId: string, entries: TimeEntry[]) {
  return entries
    .filter((entry) => entry.task_id === taskId)
    .reduce((sum, entry) => sum + entry.duration_seconds, 0);
}
function taskLabels(taskId: string, data: DashboardData): Label[] {
  const ids = data.taskLabels
    .filter((item) => item.task_id === taskId)
    .map((item) => item.label_id);
  return data.labels.filter((label) => ids.includes(label.id));
}
function dateLabel(date: string) {
  const value = new Date(`${date}T00:00:00`);
  const diff = Math.ceil(
    (value.getTime() - new Date().setHours(0, 0, 0, 0)) / 86400000,
  );
  if (diff === 0) return "Hôm nay";
  if (diff === 1) return "Ngày mai";
  if (diff < 0) return `Trễ ${Math.abs(diff)} ngày`;
  return value.toLocaleDateString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
  });
}
