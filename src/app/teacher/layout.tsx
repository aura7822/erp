import { Shell } from "@/components/Shell";
import { CAN, requireRole } from "@/lib/auth";

export default async function TeacherLayout({ children }: { children: React.ReactNode }) {
  const s = await requireRole(CAN.teach);
  return <Shell session={s} nav={[{ href: "/teacher/marks", label: "Marks", icon: "marks" }, { href: "/teacher/attendance", label: "Attendance", icon: "attendance" }, ...(s.role === "admin" ? [{ href: "/admin", label: "Admin", icon: "overview" as const }] : [])]}>{children}</Shell>;
}
