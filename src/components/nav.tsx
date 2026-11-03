"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LuBookOpen, LuCalendarCheck, LuChevronLeft, LuClipboardList, LuHouse, LuLayoutDashboard, LuSchool, LuUserCog, LuUsers, LuWallet } from "react-icons/lu";

const ICONS = { overview: LuLayoutDashboard, students: LuUsers, classes: LuSchool, finance: LuWallet, academics: LuBookOpen, staff: LuUserCog, marks: LuClipboardList, attendance: LuCalendarCheck, portal: LuHouse };
export type IconKey = keyof typeof ICONS;
export type NavItem = { href: string; label: string; icon?: IconKey; match?: string[] };

export function NavLinks({ items, variant }: { items: NavItem[]; variant: "side" | "bottom" }) {
  const path = usePathname();
  const active = (n: NavItem) => (n.match ? n.match.some((m) => path === m || path.startsWith(m + "/")) : n.href === "/admin" || n.href === "/portal" ? path === n.href : path === n.href || path.startsWith(n.href + "/"));

  if (variant === "side") {
    return (
      <nav className="mt-4 flex flex-1 flex-col gap-1 px-2" aria-label="Main">
        {items.map((n) => {
          const Icon = ICONS[n.icon ?? "overview"];
          const on = active(n);
          return (
            <Link key={n.href} href={n.href} aria-current={on ? "page" : undefined} title={n.label}
              className={`flex h-11 items-center gap-4 px-[14px] text-sm font-medium transition-colors ${on ? "bg-brand-gold text-oxblood shadow-[3px_3px_8px_rgba(0,0,0,.35)]" : "text-white/80 hover:bg-white/10 hover:text-white"}`}>
              <Icon className="h-[20px] w-[20px] shrink-0" aria-hidden />
              <span className="whitespace-nowrap opacity-0 transition-opacity duration-150 group-hover/sb:opacity-100 group-focus-within/sb:opacity-100">{n.label}</span>
            </Link>
          );
        })}
      </nav>
    );
  }
  return (
    <>
      {items.map((n) => {
        const Icon = ICONS[n.icon ?? "overview"];
        const on = active(n);
        return (
          <Link key={n.href} href={n.href} aria-current={on ? "page" : undefined}
            className={`flex min-w-[72px] flex-1 flex-col items-center gap-0.5 px-2 py-2 text-[11px] font-semibold ${on ? "text-oxblood shadow-[inset_0_3px_0_#D8A93D]" : "text-ink-mute"}`}>
            <Icon className="h-5 w-5" aria-hidden />{n.label}
          </Link>
        );
      })}
    </>
  );
}

export function BackLink({ href, label = "Back" }: { href?: string; label?: string }) {
  const router = useRouter();
  const cls = "btn-ghost !min-h-[40px] !w-10 !p-0 print:hidden";
  const icon = <LuChevronLeft className="h-5 w-5" aria-hidden />;
  if (href) return <Link href={href} aria-label={label} title={label} className={cls}>{icon}</Link>;
  return <button type="button" aria-label={label} title={label} className={cls} onClick={() => (history.length > 1 ? router.back() : router.push("/"))}>{icon}</button>;
}
