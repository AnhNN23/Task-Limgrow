import * as React from "react";
import { cn } from "@/lib/utils";

export function Input({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn("h-10 w-full rounded-lg border border-[#dfe5e1] bg-white px-3 text-sm outline-none transition focus:border-[#130b5c] focus:ring-2 focus:ring-[#130b5c]/10", className)} {...props} />;
}
