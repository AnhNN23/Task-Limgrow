"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { AlertCircle, CheckCircle2, Info, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/i18n";

type ToastVariant = "success" | "error" | "info";
type ToastInput = { title: string; description?: string; variant?: ToastVariant; duration?: number };
type ToastItem = ToastInput & { id: string };
type ToastContextValue = { toast: (input: ToastInput) => void };
const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const { tr } = useI18n();
  const [items, setItems] = useState<ToastItem[]>([]);
  const dismiss = useCallback((id: string) => setItems((current) => current.filter((item) => item.id !== id)), []);
  const toast = useCallback((input: ToastInput) => {
    const id = crypto.randomUUID();
    setItems((current) => [...current.slice(-3), { ...input, id }]);
    window.setTimeout(() => dismiss(id), input.duration ?? 4000);
  }, [dismiss]);
  const value = useMemo(() => ({ toast }), [toast]);
  return <ToastContext.Provider value={value}>{children}<div className="pointer-events-none fixed bottom-5 right-5 z-[100] flex w-[min(390px,calc(100vw-2rem))] flex-col gap-2" role="region" aria-label={tr("Thông báo", "Notifications")} aria-live="polite">{items.map((item) => <ToastCard key={item.id} item={item} onDismiss={() => dismiss(item.id)} />)}</div></ToastContext.Provider>;
}

function ToastCard({ item, onDismiss }: { item: ToastItem; onDismiss: () => void }) {
  const { tr } = useI18n();
  const variant = item.variant ?? "info";
  const meta = {
    success: { icon: CheckCircle2, style: "border-[#b8dfcf] bg-[#f1fbf7] text-[#0e6246]", iconStyle: "text-[#16966a]" },
    error: { icon: AlertCircle, style: "border-[#f0c5bf] bg-[#fff7f5] text-[#8d3028]", iconStyle: "text-[#d04a3f]" },
    info: { icon: Info, style: "border-[#cbd8ed] bg-[#f6f9ff] text-[#294c7b]", iconStyle: "text-[#4275b8]" },
  }[variant];
  const Icon = meta.icon;
  return <div className={cn("pointer-events-auto flex items-start gap-3 rounded-xl border p-4 shadow-[0_12px_36px_rgba(16,35,28,.14)] backdrop-blur", meta.style)} role={variant === "error" ? "alert" : "status"}><Icon size={20} className={cn("mt-0.5 shrink-0", meta.iconStyle)} /><div className="min-w-0 flex-1"><p className="text-sm font-bold">{item.title}</p>{item.description && <p className="mt-1 break-words text-xs leading-5 opacity-80">{item.description}</p>}</div><button onClick={onDismiss} className="rounded-md p-1 opacity-60 transition hover:bg-black/5 hover:opacity-100" aria-label={tr("Đóng thông báo", "Dismiss notification")}><X size={15} /></button></div>;
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error("useToast must be used inside ToastProvider");
  return context;
}
