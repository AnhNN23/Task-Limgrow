"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Loader2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createClient } from "@/utils/supabase/client";
import { useToast } from "@/components/ui/toast";
import { LanguageSwitcher, useI18n } from "@/lib/i18n";

export function AuthForm() {
  const router = useRouter();
  const { toast } = useToast();
  const { tr } = useI18n();
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage(null);
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") ?? "").trim();
    const password = String(form.get("password") ?? "");
    const result = await createClient().auth.signInWithPassword({
      email,
      password,
    });
    if (result.error) {
      setMessage(
        tr(
          "Email hoặc mật khẩu không chính xác.",
          "Incorrect email or password.",
        ),
      );
      toast({
        title: tr("Đăng nhập không thành công", "Sign-in failed"),
        description: tr(
          "Kiểm tra lại email và mật khẩu của bạn.",
          "Check your email and password.",
        ),
        variant: "error",
      });
      setLoading(false);
      return;
    }
    toast({
      title: tr("Đăng nhập thành công", "Signed in successfully"),
      description: tr("Đang mở Limgrow Task Hub…", "Opening Limgrow Task Hub…"),
      variant: "success",
    });
    router.replace("/dashboard");
    router.refresh();
  }

  return (
    <div className="w-full max-w-[420px]">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-bold uppercase tracking-[.18em] text-[#130b5c]">
          Limgrow Task Hub
        </p>
        <LanguageSwitcher />
      </div>
      <h2 className="mt-3 text-3xl font-semibold tracking-tight">
        {tr("Chào mừng trở lại", "Welcome back")}
      </h2>
      <p className="mt-3 text-sm leading-6 text-[#69746f]">
        {tr(
          "Đăng nhập bằng tài khoản do Project Manager cung cấp.",
          "Sign in with the account provided by your Project Manager.",
        )}
      </p>
      <form onSubmit={submit} className="mt-8 space-y-5">
        <label className="block text-sm font-semibold">
          Email
          <Input
            name="email"
            required
            type="email"
            autoComplete="email"
            placeholder="ten@limgrow.com"
            className="mt-2 h-12"
          />
        </label>
        <label className="block text-sm font-semibold">
          {tr("Mật khẩu", "Password")}
          <span className="relative mt-2 block">
            <Input
              name="password"
              required
              minLength={8}
              autoComplete="current-password"
              type={showPassword ? "text" : "password"}
              placeholder={tr("Nhập mật khẩu", "Enter password")}
              className="h-12 pr-12"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-3 text-[#69746f]"
              aria-label={tr("Ẩn hoặc hiện mật khẩu", "Show or hide password")}
            >
              {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
            </button>
          </span>
        </label>
        {message && (
          <p className="rounded-lg bg-[#fff5f2] px-4 py-3 text-sm text-[#a23b2b]">
            {message}
          </p>
        )}
        <Button type="submit" disabled={loading} className="h-12 w-full">
          {loading && <Loader2 size={18} className="animate-spin" />}
          {tr("Đăng nhập", "Sign in")}
        </Button>
      </form>
      <div className="mt-7 flex items-start gap-3 rounded-xl border border-[#e2e6e4] bg-[#f8faf9] p-4 text-xs leading-5 text-[#68736e]">
        <ShieldCheck size={18} className="mt-0.5 shrink-0 text-[#130b5c]" />
        <p>
          {tr(
            "Chưa có tài khoản? Liên hệ Project Manager để được tạo và phân quyền đúng bộ phận.",
            "No account yet? Contact your Project Manager to get the correct department access.",
          )}
        </p>
      </div>
    </div>
  );
}
