import * as React from "react";
import { cn } from "@/lib/utils";

type BadgeVariant =
  | "default"
  | "secondary"
  | "outline"
  | "success"
  | "warning"
  | "danger"
  | "info";

type BadgeProps = React.HTMLAttributes<HTMLSpanElement> & {
  variant?: BadgeVariant;
};

const variants: Record<BadgeVariant, string> = {
  default: "border-transparent bg-[#eeecff] text-[#37298e]",
  secondary: "border-transparent bg-[#f1f2f4] text-[#44546f]",
  outline: "border-[#dfe1e6] bg-white text-[#44546f]",
  success: "border-transparent bg-[#dcfff1] text-[#216e4e]",
  warning: "border-transparent bg-[#fff7d6] text-[#7f5f01]",
  danger: "border-transparent bg-[#fff1f0] text-[#ae2a19]",
  info: "border-transparent bg-[#e9f2ff] text-[#0055cc]",
};

export function Badge({
  className,
  variant = "default",
  ...props
}: BadgeProps) {
  return (
    <span
      data-slot="badge"
      className={cn(
        "inline-flex h-6 shrink-0 items-center gap-1 rounded-md border px-2 text-xs font-semibold leading-none whitespace-nowrap [&>svg]:size-3.5 [&>svg]:shrink-0",
        variants[variant],
        className,
      )}
      {...props}
    />
  );
}
