"use client";

import { AlertTriangle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Xác nhận",
  busy = false,
  onConfirm,
  onClose,
}: {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  busy?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const { tr } = useI18n();
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-[110] grid place-items-center bg-[#08042f]/45 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-title"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !busy) onClose();
      }}
    >
      <div className="w-full max-w-md rounded-xl border border-[#dfe1e6] bg-white p-6 shadow-[0_20px_48px_rgba(9,30,66,.28)]">
        <div className="flex items-start gap-4">
          <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-[#fff1f0] text-[#ae2a19]">
            <AlertTriangle className="size-5" />
          </span>
          <div className="min-w-0 flex-1">
            <h2
              id="confirm-title"
              className="text-lg font-semibold text-[#172b4d]"
            >
              {title}
            </h2>
            <p className="mt-2 break-words text-sm leading-6 text-[#5e6c84] [overflow-wrap:anywhere]">
              {description}
            </p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onClose}
            disabled={busy}
            className="-mr-2 -mt-2"
            aria-label={tr("Đóng", "Close")}
          >
            <X />
          </Button>
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="outline" onClick={onClose} disabled={busy}>
            {tr("Hủy", "Cancel")}
          </Button>
          <Button variant="danger" onClick={onConfirm} disabled={busy}>
            {busy ? tr("Đang xử lý…", "Processing…") : confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
