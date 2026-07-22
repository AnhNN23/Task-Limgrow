import * as React from "react";
import { cn } from "@/lib/utils";

export function Input({
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      data-slot="input"
      className={cn(
        "h-9 w-full rounded-md border border-[#dfe1e6] bg-white px-3 text-sm shadow-sm outline-none transition placeholder:text-[#8993a4] hover:border-[#b7bdc8] focus:border-[#4c43b5] focus:ring-2 focus:ring-[#4c43b5]/15 disabled:cursor-not-allowed disabled:bg-[#f1f2f4] disabled:text-[#6b778c]",
        className,
      )}
      {...props}
    />
  );
}
