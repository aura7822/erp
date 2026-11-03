import Link from "next/link";
import { UserButton } from "@clerk/nextjs";
import { and, eq } from "drizzle-orm";
import type { ReactNode } from "react";
import { db } from "@/db";
import { staffAttendance } from "@/db/schema";
import type { Session } from "@/lib/auth";
import { timeEAT, todayEAT } from "@/lib/constants";
import { BackLink, NavLinks, type NavItem } from "./nav";
import { ClockWidget, RefreshButton } from "./ui";
export type { NavItem };

export async function Shell({ session, nav, children, wide = false }: { session: Session; nav: NavItem[]; children: ReactNode; wide?: boolean }) {
  const name = process.env.SCHOOL_NAME ?? "School ERP";
  let clock: { state: "none" | "in" | "out"; time?: string } | null = null;
  if (session.staffId) {
    const [r] = await db.select().from(staffAttendance).where(and(eq(staffAttendance.staffId, session.staffId), eq(staffAttendance.date, todayEAT())));
    clock = !r ? { state: "none" } : r.clockOut ? { state: "out", time: timeEAT(r.clockOut) } : { state: "in", time: timeEAT(r.clockIn) };
  }

  return (
    <div className="flex min-h-screen print:block">
      {/* Sidebar: collapsed to icons, expands on hover / keyboard focus */}
      <div className="hidden w-[76px] shrink-0 md:block print:hidden">
        <aside className="group/sb bg-brand fixed inset-y-0 left-0 z-30 flex w-[76px] flex-col overflow-hidden text-white transition-[width] duration-200 ease-out focus-within:w-64 hover:w-64" style={{ boxShadow: "6px 0 18px rgba(58,4,3,.35)" }}>
          <Link href="/" className="flex h-16 items-center gap-4 px-[18px]" aria-label={name}>
            <span className="bg-brand-gold grid h-10 w-10 shrink-0 place-items-center font-display text-lg font-bold text-oxblood">{name[0]}</span>
            <span className="whitespace-nowrap font-display text-base font-bold leading-tight opacity-0 transition-opacity group-hover/sb:opacity-100 group-focus-within/sb:opacity-100">{name}</span>
          </Link>
          <NavLinks items={nav} variant="side" />
          {clock && <ClockWidget state={clock.state} time={clock.time} />}
          <div className="flex items-center gap-4 border-t border-white/15 px-[22px] py-4 text-sm">
            <UserButton />
            <span className="min-w-0 whitespace-nowrap leading-tight opacity-0 transition-opacity group-hover/sb:opacity-100 group-focus-within/sb:opacity-100">{session.name}<br /><span className="text-xs capitalize text-white/60">{session.role}</span></span>
          </div>
        </aside>
      </div>

      <div className="min-w-0 flex-1 pb-24 md:pb-0">
        <header className="bg-brand flex items-center justify-between px-4 py-3 text-white md:hidden print:hidden">
          <span className="font-display font-bold">{name}</span><UserButton />
        </header>
        <main className={`mx-auto px-4 py-6 md:px-8 print:max-w-none print:p-0 ${wide ? "max-w-6xl" : "max-w-5xl"}`}>{children}</main>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-20 flex overflow-x-auto border-t border-paper-line bg-paper-light md:hidden print:hidden" style={{ boxShadow: "0 -4px 12px rgba(110,92,48,.2)" }} aria-label="Main">
        <NavLinks items={nav} variant="bottom" />
      </nav>
    </div>
  );
}

export function PageTitle({ title, sub, back, icon, children }: { title: string; sub?: string; back?: string | null; icon?: ReactNode; children?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-3">
        {back !== null && <BackLink href={back} />}
        {icon && <span className="bg-brand grid h-11 w-11 shrink-0 place-items-center text-xl text-gold-light print:hidden" aria-hidden>{icon}</span>}
        <div>
          <h1 className="font-display text-2xl font-bold leading-tight text-oxblood md:text-3xl">{title}</h1>
          {sub && <p className="text-sm text-ink-mute">{sub}</p>}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2 print:hidden"><RefreshButton />{children}</div>
    </div>
  );
}

export function Tabs({ tabs, current }: { tabs: { href: string; label: string }[]; current: string }) {
  return (
    <nav className="mb-6 flex gap-2 overflow-x-auto pb-1 print:hidden" aria-label="Sections">
      {tabs.map((t) => (
        <Link key={t.href} href={t.href} aria-current={t.href === current ? "page" : undefined}
          className={`whitespace-nowrap ${t.href === current ? "btn-primary !min-h-[40px]" : "btn-ghost !min-h-[40px]"}`}>{t.label}</Link>
      ))}
    </nav>
  );
}

export const FINANCE_TABS = [
  { href: "/admin/invoices", label: "Invoices & ledger" },
  { href: "/admin/expenses", label: "Expenses" },
  { href: "/admin/fees", label: "Fee structures" },
  { href: "/admin/fees/broadcast", label: "Broadcast" },
];
export const ACADEMIC_TABS = [
  { href: "/admin/academics", label: "Terms" },
  { href: "/admin/academics/subjects", label: "Subjects" },
  { href: "/admin/academics/teachers", label: "Teachers" },
  { href: "/admin/academics/timetable", label: "Timetable" },
  { href: "/admin/academics/report-cards", label: "Report cards" },
];
