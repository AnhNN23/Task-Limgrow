"use client";

import { useState } from "react";
import { CalendarDays, X } from "lucide-react";
import { enUS, vi } from "react-day-picker/locale";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

type Props = {
  name?: string;
  value?: string | null;
  defaultValue?: string | null;
  onChange?: (value: string | null) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
};
const parseDate = (value?: string | null) =>
  value ? new Date(`${value}T12:00:00`) : undefined;
const serializeDate = (date?: Date) =>
  date
    ? `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`
    : "";

export function DatePicker({
  name,
  value,
  defaultValue,
  onChange,
  placeholder,
  className,
  disabled,
}: Props) {
  const { tr, locale, dateLocale } = useI18n();
  const controlled = value !== undefined;
  const [internal, setInternal] = useState(defaultValue ?? "");
  const [open, setOpen] = useState(false);
  const current = controlled ? (value ?? "") : internal;
  const setValue = (next: string) => {
    if (!controlled) setInternal(next);
    onChange?.(next || null);
    setOpen(false);
  };
  return (
    <>
      <input type="hidden" name={name} value={current} />
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            disabled={disabled}
            className={cn(
              "h-9 w-full justify-start px-3 text-sm font-medium",
              !current && "text-[#89928e]",
              className,
            )}
          >
            <CalendarDays />
            {current
              ? parseDate(current)?.toLocaleDateString(dateLocale, {
                  day: "2-digit",
                  month: "short",
                  year: "numeric",
                })
              : (placeholder ?? tr("Chọn ngày", "Pick a date"))}
            {current && (
              <span
                role="button"
                aria-label={tr("Xóa ngày", "Clear date")}
                onClick={(event) => {
                  event.stopPropagation();
                  setValue("");
                }}
                className="ml-auto rounded p-0.5 hover:bg-[#edf0ee]"
              >
                <X className="size-3.5" />
              </span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent>
          <Calendar
            mode="single"
            selected={parseDate(current)}
            onSelect={(date) => date && setValue(serializeDate(date))}
            locale={locale === "vi" ? vi : enUS}
          />
        </PopoverContent>
      </Popover>
    </>
  );
}
