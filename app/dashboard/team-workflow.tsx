"use client";

import {
  ArrowRight, Braces, CheckCircle2, ClipboardCheck, FileSearch,
  Lightbulb, Palette, RotateCcw, ShieldCheck, Sparkles, Users,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { useI18n } from "@/lib/i18n";
import type { DashboardData, Role, TaskStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

type Stage = {
  key: string;
  role: Role | "team";
  icon: typeof Lightbulb;
  color: string;
  soft: string;
  status: TaskStatus;
  title: [string, string];
  purpose: [string, string];
  outputs: Array<[string, string]>;
  gate: [string, string];
};

const stages: Stage[] = [
  {
    key: "discovery", role: "business_analyst", icon: FileSearch, status: "todo",
    color: "#7f5f01", soft: "bg-[#fff7d6] text-[#7f5f01]",
    title: ["1. Phân tích yêu cầu", "1. Discovery & scope"],
    purpose: ["BA làm rõ vấn đề, luồng nghiệp vụ và phạm vi MVP.", "BA clarifies the problem, business flow and MVP scope."],
    outputs: [["User story", "User story"], ["Acceptance criteria", "Acceptance criteria"], ["Edge cases", "Edge cases"]],
    gate: ["PM và BA xác nhận đủ rõ để thiết kế", "PM and BA confirm the task is ready for design"],
  },
  {
    key: "design", role: "ui_ux", icon: Palette, status: "todo",
    color: "#5e4db2", soft: "bg-[#eeeefe] text-[#5e4db2]",
    title: ["2. Thiết kế UI/UX", "2. UI/UX design"],
    purpose: ["UI/UX biến yêu cầu thành flow, prototype và spec có thể triển khai.", "UI/UX turns requirements into an implementable flow, prototype and spec."],
    outputs: [["User flow", "User flow"], ["Figma + states", "Figma + states"], ["Design handoff", "Design handoff"]],
    gate: ["BA xác nhận đúng nghiệp vụ, Dev xác nhận khả thi", "BA validates the flow; Dev confirms feasibility"],
  },
  {
    key: "ready", role: "team", icon: ClipboardCheck, status: "todo",
    color: "#0055cc", soft: "bg-[#e9f2ff] text-[#0055cc]",
    title: ["3. Ready for Dev", "3. Ready for Dev"],
    purpose: ["Cả team refinement, chia nhỏ task, estimate và khóa dependency.", "The team refines, splits, estimates and clears dependencies."],
    outputs: [["Technical notes", "Technical notes"], ["Estimate", "Estimate"], ["Test scenarios", "Test scenarios"]],
    gate: ["Đạt Definition of Ready", "Definition of Ready is satisfied"],
  },
  {
    key: "development", role: "developer", icon: Braces, status: "in_progress",
    color: "#0c66e4", soft: "bg-[#e9f2ff] text-[#0055cc]",
    title: ["4. Development", "4. Development"],
    purpose: ["Dev triển khai theo spec, tự kiểm tra và cập nhật tiến độ hàng ngày.", "Dev implements the spec, self-tests and updates progress daily."],
    outputs: [["Pull request", "Pull request"], ["Unit/self test", "Unit/self test"], ["Build cho QA", "QA build"]],
    gate: ["PR đã review, checklist Dev hoàn tất", "PR reviewed and Dev checklist completed"],
  },
  {
    key: "qa", role: "tester", icon: ShieldCheck, status: "review",
    color: "#b38600", soft: "bg-[#fff7d6] text-[#7f5f01]",
    title: ["5. QA Verification", "5. QA verification"],
    purpose: ["Tester kiểm tra acceptance criteria, edge case và regression có bằng chứng.", "Tester verifies acceptance criteria, edge cases and regression with evidence."],
    outputs: [["Test result", "Test result"], ["Bug evidence", "Bug evidence"], ["Regression pass", "Regression pass"]],
    gate: ["Không còn blocker/critical và BA chấp nhận", "No blocker/critical issues and BA accepts"],
  },
  {
    key: "release", role: "team", icon: CheckCircle2, status: "done",
    color: "#216e4e", soft: "bg-[#dcfff1] text-[#216e4e]",
    title: ["6. Release & Learn", "6. Release & learn"],
    purpose: ["PM điều phối release, theo dõi chỉ số và ghi nhận bài học.", "PM coordinates release, monitors metrics and captures learnings."],
    outputs: [["Release note", "Release note"], ["Monitoring", "Monitoring"], ["Retro action", "Retro action"]],
    gate: ["Đạt Definition of Done", "Definition of Done is satisfied"],
  },
];

const roleNames: Record<Role | "team", [string, string]> = {
  project_manager: ["PM", "PM"], business_analyst: ["BA", "BA"], ui_ux: ["UI/UX", "UI/UX"],
  graphic_designer: ["Graphic", "Graphic"], developer: ["Dev", "Dev"], tester: ["Tester", "Tester"], team: ["Cả team", "Whole team"],
};

export function TeamWorkflow({ data }: { data: DashboardData }) {
  const { tr, locale } = useI18n();
  const statusCount = (status: TaskStatus) => data.tasks.filter((task) => task.status === status).length;

  return <div className="space-y-5">
    <Card className="overflow-hidden border-[#d9d5f3] bg-gradient-to-r from-[#130b5c] to-[#37298e] p-6 text-white">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="max-w-3xl"><div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[.16em] text-[#c8c3ff]"><Sparkles size={15} /> Limgrow Product Delivery</div><h2 className="mt-3 text-2xl font-bold">{tr("Workflow làm app xuyên suốt", "End-to-end app delivery workflow")}</h2><p className="mt-2 text-sm leading-6 text-white/70">{tr("Một nguồn dữ liệu từ yêu cầu đến release. Mỗi bước có owner, đầu ra và cổng bàn giao rõ ràng.", "One source of truth from requirement to release. Every stage has a clear owner, output and handoff gate.")}</p></div>
        <div className="grid grid-cols-3 gap-2 text-center"><Metric value={String(data.tasks.length)} label={tr("Tổng task", "Total tasks")} /><Metric value={String(statusCount("in_progress"))} label={tr("Đang làm", "In progress")} /><Metric value={String(statusCount("review"))} label={tr("Đang QA", "In QA")} /></div>
      </div>
    </Card>

    <div className="grid gap-4 xl:grid-cols-3">
      {stages.map((stage, index) => {
        const Icon = stage.icon;
        const owners = stage.role === "team" ? data.members : data.members.filter((member) => member.role === stage.role);
        return <Card key={stage.key} className="relative overflow-hidden p-5">
          <i className="absolute inset-x-0 top-0 h-1" style={{ background: stage.color }} />
          <div className="flex items-start gap-3"><span className={cn("grid h-10 w-10 shrink-0 place-items-center rounded-lg", stage.soft)}><Icon size={19} /></span><div className="min-w-0 flex-1"><h3 className="font-bold text-[#172b4d]">{stage.title[locale === "vi" ? 0 : 1]}</h3><div className="mt-1 flex flex-wrap gap-1.5"><Badge className={stage.soft}>{roleNames[stage.role][locale === "vi" ? 0 : 1]}</Badge><Badge className="bg-[#f1f2f4] text-[#44546f]">{statusCount(stage.status)} task</Badge></div></div>{index < stages.length - 1 && <ArrowRight size={17} className="mt-3 hidden text-[#8993a4] xl:block" />}</div>
          <p className="mt-4 min-h-12 text-sm leading-6 text-[#5e6c84]">{stage.purpose[locale === "vi" ? 0 : 1]}</p>
          <div className="mt-4 flex flex-wrap gap-1.5">{stage.outputs.map((output) => <Badge key={output[0]} className="border border-[#dfe1e6] bg-white text-[#44546f]">{output[locale === "vi" ? 0 : 1]}</Badge>)}</div>
          <div className="mt-4 rounded-lg bg-[#f7f8f9] p-3"><p className="text-[10px] font-bold uppercase tracking-wider text-[#6b778c]">{tr("Cổng bàn giao", "Handoff gate")}</p><p className="mt-1 text-xs leading-5 text-[#44546f]">{stage.gate[locale === "vi" ? 0 : 1]}</p></div>
          <div className="mt-4 flex items-center gap-2 text-xs text-[#6b778c]"><Users size={14} /><span className="truncate">{owners.length ? owners.map((owner) => owner.full_name.split(" ").at(-1)).join(", ") : tr("PM cần phân công owner", "PM needs to assign an owner")}</span></div>
        </Card>;
      })}
    </div>

    <div className="grid gap-5 lg:grid-cols-3">
      <ChecklistCard title={tr("Definition of Ready", "Definition of Ready")} tone="blue" items={[
        tr("User story và giá trị kinh doanh rõ ràng", "Clear user story and business value"),
        tr("Acceptance criteria kiểm thử được", "Testable acceptance criteria"),
        tr("Figma có đủ loading, empty, error và responsive", "Figma covers loading, empty, error and responsive states"),
        tr("Dependency, API và estimate đã thống nhất", "Dependencies, API and estimate are agreed"),
      ]} />
      <ChecklistCard title={tr("Definition of Done", "Definition of Done")} tone="green" items={[
        tr("Code review và self-test đã hoàn tất", "Code review and self-test completed"),
        tr("Acceptance criteria và regression đều pass", "Acceptance criteria and regression passed"),
        tr("Không còn blocker hoặc critical bug", "No blocker or critical bugs remain"),
        tr("Release note, monitoring và tài liệu đã cập nhật", "Release notes, monitoring and docs updated"),
      ]} />
      <Card className="p-5"><div className="flex items-center gap-2"><RotateCcw size={18} className="text-[#c9372c]" /><h3 className="font-bold text-[#172b4d]">{tr("Vòng phản hồi ngắn", "Short feedback loops")}</h3></div><div className="mt-4 space-y-3 text-xs leading-5 text-[#5e6c84]"><FlowRule from="QA fail" to="Development" text={tr("Tester đính kèm evidence và mức độ ảnh hưởng.", "Tester attaches evidence and impact level.")} /><FlowRule from="Design gap" to="UI/UX + BA" text={tr("Không để Dev tự suy đoán nghiệp vụ.", "Dev never guesses business behavior.")} /><FlowRule from="Scope change" to="PM + BA" text={tr("Đánh giá lại priority, estimate và deadline.", "Reassess priority, estimate and deadline.")} /></div></Card>
    </div>
  </div>;
}

function Metric({ value, label }: { value: string; label: string }) { return <div className="min-w-20 rounded-lg bg-white/10 px-3 py-2"><b className="block text-lg">{value}</b><span className="text-[10px] text-white/65">{label}</span></div>; }
function ChecklistCard({ title, items, tone }: { title: string; items: string[]; tone: "blue" | "green" }) { return <Card className="p-5"><h3 className="font-bold text-[#172b4d]">{title}</h3><div className="mt-4 space-y-3">{items.map((item) => <div key={item} className="flex items-start gap-2 text-xs leading-5 text-[#5e6c84]"><CheckCircle2 size={15} className={cn("mt-0.5 shrink-0", tone === "blue" ? "text-[#0c66e4]" : "text-[#22a06b]")} />{item}</div>)}</div></Card>; }
function FlowRule({ from, to, text }: { from: string; to: string; text: string }) { return <div className="rounded-lg border border-[#ebecf0] p-3"><div className="flex items-center gap-2 font-bold text-[#172b4d]"><Badge className="bg-[#fff1f0] text-[#ae2a19]">{from}</Badge><ArrowRight size={13} /><Badge className="bg-[#e9f2ff] text-[#0055cc]">{to}</Badge></div><p className="mt-2">{text}</p></div>; }
