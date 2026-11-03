import { redirect } from "next/navigation";
import { Shell, type NavItem } from "@/components/Shell";
import { getSession, homeFor } from "@/lib/auth";

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const s = await getSession();
  if (!s) redirect("/sign-in");
  const nav: NavItem[] = [{ href: "/portal", label: "My child", icon: "portal" }, ...(s.role !== "parent" && s.role !== "student" ? [{ href: homeFor(s.role), label: "Back to work", icon: "overview" } as NavItem] : [])];
  return <Shell session={s} nav={nav}>{children}</Shell>;
}
