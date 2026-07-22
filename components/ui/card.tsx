import * as React from "react";
import { cn } from "@/lib/utils";

export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("rounded-xl border border-[#e3e8e5] bg-white shadow-[0_1px_2px_rgba(20,40,32,.04)]", className)} {...props} />;
}
