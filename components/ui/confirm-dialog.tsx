"use client";

import { AlertTriangle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";

export function ConfirmDialog({ open, title, description, confirmLabel = "Xác nhận", busy = false, onConfirm, onClose }: { open: boolean; title: string; description: string; confirmLabel?: string; busy?: boolean; onConfirm: () => void; onClose: () => void }) {
  const { tr } = useI18n();
  if (!open) return null;
  return <div className="fixed inset-0 z-[110] grid place-items-center bg-[#08042f]/45 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="confirm-title" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) onClose(); }}><div className="w-full max-w-md rounded-2xl border border-[#e3e7e5] bg-white p-6 shadow-2xl"><div className="flex items-start gap-4"><span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[#fff0ed] text-[#c54141]"><AlertTriangle size={21} /></span><div className="min-w-0 flex-1"><h2 id="confirm-title" className="text-lg font-bold">{title}</h2><p className="mt-2 text-sm leading-6 text-[#69746f]">{description}</p></div><button onClick={onClose} disabled={busy} className="rounded-lg p-1 text-[#7d8782] hover:bg-[#f0f3f1]" aria-label={tr("Đóng", "Close")}><X size={18} /></button></div><div className="mt-6 flex justify-end gap-3"><Button variant="outline" onClick={onClose} disabled={busy}>{tr("Hủy", "Cancel")}</Button><Button variant="danger" onClick={onConfirm} disabled={busy}>{busy ? tr("Đang xử lý…", "Processing…") : confirmLabel}</Button></div></div></div>;
}
