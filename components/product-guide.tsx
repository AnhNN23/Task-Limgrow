"use client";

import { useEffect, useState } from "react";
import {
  BarChart3,
  FolderKanban,
  ListChecks,
  MonitorDot,
  Timer,
  Users,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/i18n";

type GuideDestination = "team" | "projects" | "tasks" | "tracking" | "reports";

const steps = [
  {
    icon: Users,
    destination: "team" as const,
    eyebrow: ["Thiết lập đội ngũ", "Set up your team"],
    title: ["PM tạo tài khoản cho nhân sự", "PM creates employee accounts"],
    description: [
      "Vào Thành viên để tạo tài khoản Tester, BA, UI/UX, Graphic hoặc Developer. Nhân sự sẽ đổi mật khẩu ở lần đăng nhập đầu tiên.",
      "Open Team to create Tester, BA, UI/UX, Graphic or Developer accounts. Employees change their password on first sign-in.",
    ],
    action: ["Mở Thành viên", "Open Team"],
  },
  {
    icon: FolderKanban,
    destination: "projects" as const,
    eyebrow: ["Chuẩn bị dự án", "Prepare projects"],
    title: ["Tạo dự án và ngân sách giờ", "Create projects and hour budgets"],
    description: [
      "Mỗi dự án gom task, sprint và time log của một khách hàng. PM đặt màu nhận diện, khách hàng và ngân sách giờ để theo dõi.",
      "Each project groups a client's tasks, sprints and time logs. PMs configure its color, client and hour budget.",
    ],
    action: ["Mở Dự án", "Open Projects"],
  },
  {
    icon: ListChecks,
    destination: "tasks" as const,
    eyebrow: ["Giao và theo dõi việc", "Assign and track work"],
    title: ["Tạo task, phân công và kéo thả", "Create, assign and drag tasks"],
    description: [
      "Dùng List để lọc nhanh, Board để kéo task qua trạng thái, Calendar để xem deadline và Backlog để lên kế hoạch sprint.",
      "Use List for quick filters, Board to move task status, Calendar for deadlines and Backlog for sprint planning.",
    ],
    action: ["Mở Công việc", "Open Tasks"],
  },
  {
    icon: MonitorDot,
    destination: "tracking" as const,
    eyebrow: ["Theo dõi minh bạch", "Transparent tracking"],
    title: [
      "So sánh giờ thực tế với estimate",
      "Compare actual time with estimates",
    ],
    description: [
      "Nhân sự chọn task và bắt đầu timer trực tiếp trên web, sau đó dừng để lưu actual. Hệ thống hiển thị cảnh báo khi task gần hoặc đã vượt estimate.",
      "Employees choose a task and start the web timer, then stop it to save actual time. The system flags tasks nearing or exceeding their estimate.",
    ],
    action: ["Mở Theo dõi", "Open Tracking"],
  },
  {
    icon: Timer,
    destination: "reports" as const,
    eyebrow: ["Ghi nhận hiệu suất", "Track performance"],
    title: ["Bấm giờ rồi xem báo cáo", "Track time and view reports"],
    description: [
      "Nhân sự mở task và bấm giờ khi bắt đầu. PM xem toàn bộ thời gian theo dự án, còn mỗi nhân sự chỉ xem dữ liệu được phân quyền.",
      "Employees start the timer from a task. PMs see all project time while employees only see authorized data.",
    ],
    action: ["Mở Báo cáo", "Open Reports"],
  },
];

export function ProductGuide({
  open,
  onClose,
  onNavigate,
}: {
  open: boolean;
  onClose: () => void;
  onNavigate: (view: GuideDestination) => void;
}) {
  const { tr, locale } = useI18n();
  const [step, setStep] = useState(0);
  const closeGuide = () => {
    setStep(0);
    onClose();
  };
  useEffect(() => {
    if (!open) return;
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [open, onClose]);
  if (!open) return null;

  const current = steps[step];
  const Icon = current.icon;
  return (
    <div
      className="fixed inset-0 z-[110] grid place-items-center bg-[#07032e]/60 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="guide-title"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) closeGuide();
      }}
    >
      <section className="max-h-[calc(100vh-2rem)] w-full max-w-[760px] overflow-y-auto rounded-2xl border border-white/10 bg-white shadow-2xl">
        <div className="grid md:grid-cols-[250px_1fr]">
          <aside className="relative hidden overflow-hidden bg-[#0b063f] p-6 text-white md:block">
            <div className="absolute -right-14 -top-14 h-40 w-40 rounded-full bg-[#7d6cff]/25 blur-2xl" />
            <div className="relative">
              <div className="flex items-center gap-2 text-sm font-bold">
                <span className="grid h-8 w-8 place-items-center rounded-lg bg-white/12">
                  <BarChart3 size={17} />
                </span>
                Limgrow Task Hub
              </div>
              <p className="mt-10 text-xs font-bold uppercase tracking-[0.18em] text-white/50">
                {tr("Bắt đầu nhanh", "Quick start")}
              </p>
              <h2 className="mt-2 text-2xl font-bold leading-tight">
                {tr("Quản lý công việc trong 5 bước", "Manage work in 5 steps")}
              </h2>
              <div className="mt-8 space-y-2">
                {steps.map((item, index) => (
                  <button
                    key={item.title[0]}
                    onClick={() => setStep(index)}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-xs font-semibold transition",
                      index === step
                        ? "bg-white text-[#130b5c]"
                        : "text-white/65 hover:bg-white/10 hover:text-white",
                    )}
                  >
                    <span
                      className={cn(
                        "grid h-6 w-6 place-items-center rounded-full text-[10px]",
                        index === step ? "bg-[#eeeefe]" : "bg-white/10",
                      )}
                    >
                      {index + 1}
                    </span>
                    <span className="truncate">
                      {item.eyebrow[locale === "vi" ? 0 : 1]}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </aside>
          <div className="flex min-h-[500px] flex-col p-6 md:min-h-[430px] md:p-8">
            <div className="flex items-start justify-between">
              <span className="text-xs font-bold uppercase tracking-[0.16em] text-[#6957c8]">
                {tr("Bước", "Step")} {step + 1} / {steps.length}
              </span>
              <button
                onClick={closeGuide}
                className="rounded-md p-1.5 text-[#6b778c] hover:bg-[#f1f2f4]"
                aria-label={tr("Đóng hướng dẫn", "Close guide")}
              >
                <X size={19} />
              </button>
            </div>
            <div className="mt-5 flex gap-1.5 md:hidden">
              {steps.map((item, index) => (
                <button
                  key={item.title[0]}
                  onClick={() => setStep(index)}
                  className={cn(
                    "h-1.5 flex-1 rounded-full",
                    index === step ? "bg-[#6957c8]" : "bg-[#dfe1e6]",
                  )}
                  aria-label={tr(
                    `Đến bước ${index + 1}`,
                    `Go to step ${index + 1}`,
                  )}
                />
              ))}
            </div>
            <div className="mt-10 grid h-14 w-14 place-items-center rounded-2xl bg-[#eeeefe] text-[#130b5c]">
              <Icon size={26} />
            </div>
            <p className="mt-6 text-sm font-semibold text-[#6957c8]">
              {current.eyebrow[locale === "vi" ? 0 : 1]}
            </p>
            <h3
              id="guide-title"
              className="mt-2 text-2xl font-bold tracking-tight text-[#172b4d]"
            >
              {current.title[locale === "vi" ? 0 : 1]}
            </h3>
            <p className="mt-4 max-w-lg text-sm leading-6 text-[#5e6c84]">
              {current.description[locale === "vi" ? 0 : 1]}
            </p>
            <div className="mt-auto flex flex-wrap items-center justify-between gap-3 pt-8">
              <button
                onClick={closeGuide}
                className="text-sm font-semibold text-[#6b778c] hover:text-[#172b4d]"
              >
                {tr("Để sau", "Later")}
              </button>
              <div className="flex gap-2">
                {step > 0 && (
                  <Button variant="outline" onClick={() => setStep(step - 1)}>
                    {tr("Quay lại", "Back")}
                  </Button>
                )}
                {step < steps.length - 1 ? (
                  <Button onClick={() => setStep(step + 1)}>
                    {tr("Tiếp theo", "Next")}
                  </Button>
                ) : (
                  <Button
                    onClick={() => {
                      onNavigate(current.destination);
                      closeGuide();
                    }}
                  >
                    {current.action[locale === "vi" ? 0 : 1]}
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
