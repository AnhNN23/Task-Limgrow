"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { DayPicker, type DayPickerProps } from "react-day-picker";
import { cn } from "@/lib/utils";

export function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  ...props
}: DayPickerProps) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn("p-1", className)}
      classNames={{
        months: "flex flex-col",
        month: "space-y-4",
        month_caption: "relative flex h-9 items-center justify-center",
        caption_label: "text-sm font-bold text-[#172b4d]",
        nav: "absolute inset-x-1 top-1 flex items-center justify-between",
        button_previous:
          "grid h-8 w-8 place-items-center rounded-md text-[#5e6c84] hover:bg-[#eeeefe] hover:text-[#130b5c]",
        button_next:
          "grid h-8 w-8 place-items-center rounded-md text-[#5e6c84] hover:bg-[#eeeefe] hover:text-[#130b5c]",
        month_grid: "w-full border-collapse",
        weekdays: "flex",
        weekday: "w-9 text-center text-[11px] font-semibold text-[#8993a4]",
        week: "mt-1 flex w-full",
        day: "relative h-9 w-9 p-0 text-center",
        day_button:
          "h-9 w-9 rounded-md text-sm outline-none hover:bg-[#eeeefe] focus:ring-2 focus:ring-[#4c43b5]/25",
        selected:
          "[&_button]:bg-[#130b5c] [&_button]:font-bold [&_button]:text-white [&_button]:hover:bg-[#130b5c]",
        today:
          "[&_button]:border [&_button]:border-[#6957c8] [&_button]:font-bold [&_button]:text-[#130b5c]",
        outside: "opacity-35",
        disabled: "opacity-35",
        hidden: "invisible",
        ...classNames,
      }}
      components={{
        Chevron: ({ orientation }) =>
          orientation === "left" ? (
            <ChevronLeft size={16} />
          ) : (
            <ChevronRight size={16} />
          ),
      }}
      {...props}
    />
  );
}
