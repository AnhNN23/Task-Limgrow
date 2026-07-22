import * as React from "react";
import { cn } from "@/lib/utils";

type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "default" | "outline" | "ghost" | "danger";
  size?: "default" | "sm" | "icon";
};

export function Button({ className, variant = "default", size = "default", ...props }: Props) {
  const variants = {
    default: "bg-[#130b5c] text-white hover:bg-[#0b063f] shadow-sm",
    outline: "border border-[#dfe5e1] bg-white text-[#24302b] hover:bg-[#f4f7f5]",
    ghost: "text-[#53605a] hover:bg-[#eef2f0] hover:text-[#18201d]",
    danger: "bg-[#c54141] text-white hover:bg-[#a83434]",
  };
  const sizes = { default: "h-10 px-4", sm: "h-8 px-3 text-sm", icon: "h-9 w-9" };
  return <button className={cn("inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4c43b5] focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50", variants[variant], sizes[size], className)} {...props} />;
}
