import type { Metadata } from "next";
import "./globals.css";
import { ToastProvider } from "@/components/ui/toast";
import { I18nProvider } from "@/lib/i18n";

export const metadata: Metadata = {
  title: "Limgrow Task Hub",
  description: "Quản lý dự án, công việc và thời gian cho đội ngũ công ty.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="vi">
      <body><I18nProvider><ToastProvider>{children}</ToastProvider></I18nProvider></body>
    </html>
  );
}
