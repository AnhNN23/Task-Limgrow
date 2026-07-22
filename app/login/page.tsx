"use client";

import Image from "next/image";
import { AuthForm } from "./auth-form";
import { useI18n } from "@/lib/i18n";

export default function LoginPage() {
  const { tr } = useI18n();
  return (
    <main className="min-h-screen bg-white lg:grid lg:grid-cols-[minmax(0,1.14fr)_minmax(440px,.86fr)]">
      <section className="relative flex min-h-[260px] overflow-hidden bg-[#0b0640] text-white sm:min-h-[340px] lg:min-h-screen lg:flex-col lg:justify-between">
        <Image
          src="/limgrow-team.png"
          alt={tr(
            "Đội ngũ Limgrow tại văn phòng",
            "The Limgrow team at the office",
          )}
          fill
          loading="eager"
          fetchPriority="high"
          sizes="(max-width: 1023px) 100vw, 57vw"
          className="object-cover object-[50%_58%] lg:object-center"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-[#09042f]/45 via-[#0b0640]/10 to-[#08032f]/80 lg:from-[#09042f]/55 lg:via-transparent lg:to-[#08032f]/95" />
        <div className="absolute inset-0 bg-gradient-to-r from-[#0b0640]/30 via-transparent to-transparent" />

        <div className="relative z-10 flex w-full items-start justify-between p-5 sm:p-7 lg:p-10 xl:p-12">
          <div className="flex items-center gap-3 rounded-2xl border border-white/20 bg-[#0b0640]/75 p-2 pr-4 shadow-xl shadow-black/15 backdrop-blur-md">
            <Image
              src="/limgrow-logo.png"
              alt="Limgrow"
              width={46}
              height={46}
              className="h-11 w-11 rounded-xl object-cover ring-1 ring-white/50"
            />
            <div>
              <p className="font-bold leading-tight">Limgrow</p>
              <p className="text-[11px] font-medium text-white/65">Task Hub</p>
            </div>
          </div>
          <span className="rounded-full border border-white/20 bg-black/25 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[.16em] text-white/80 backdrop-blur-md sm:text-xs">
            {tr("Không gian nội bộ", "Internal workspace")}
          </span>
        </div>

        <div className="relative z-10 mt-auto hidden max-w-2xl p-10 pt-20 lg:block xl:p-12">
          <p className="mb-4 text-xs font-bold uppercase tracking-[.22em] text-[#cbc8ff]">
            {tr("Cùng một đội ngũ · Cùng một mục tiêu", "One team · One goal")}
          </p>
          <h1 className="max-w-xl text-4xl font-semibold leading-[1.08] tracking-tight drop-shadow-lg xl:text-5xl">
            {tr(
              "Công việc rõ ràng. Cả đội cùng tiến về phía trước.",
              "Clear work. Everyone moving forward together.",
            )}
          </h1>
          <p className="mt-5 max-w-lg text-base leading-7 text-white/75 drop-shadow-md xl:text-lg">
            {tr(
              "Một không gian tập trung cho PM, BA, UI/UX, Developer và Tester cùng phối hợp, theo dõi tiến độ và ghi nhận thời gian.",
              "One focused workspace where PMs, BAs, UI/UX, Developers and Testers collaborate, track progress and log time.",
            )}
          </p>
          <div className="mt-7 flex flex-wrap gap-2">
            {["PM", "BA", "UI/UX", "Developer", "Tester"].map((role) => (
              <span
                key={role}
                className="rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-semibold text-white/90 backdrop-blur-md"
              >
                {role}
              </span>
            ))}
          </div>
          <p className="mt-8 text-xs text-white/45">© 2026 Limgrow Task Hub</p>
        </div>
      </section>
      <section className="flex items-center justify-center bg-white px-6 py-10 sm:px-10 lg:px-12">
        <AuthForm />
      </section>
    </main>
  );
}
