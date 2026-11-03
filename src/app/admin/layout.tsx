import { Shell, type NavItem } from "@/components/Shell";
import { STAFF_VIEW, requireRole } from "@/lib/auth";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const s = await requireRole(STAFF_VIEW);
  const nav: NavItem[] = [
    { href: "/admin", label: "Overview", icon: "overview" },
    { href: "/admin/students", label: "Students", icon: "students" },
    ...(s.role !== "bursar" ? [{ href: "/admin/classes", label: "Classes", icon: "classes" } as NavItem] : []),
    { href: "/admin/invoices", label: "Finance", icon: "finance", match: ["/admin/invoices", "/admin/expenses", "/admin/fees"] },
    ...(s.role !== "bursar" ? [{ href: "/admin/academics", label: "Academics", icon: "academics" } as NavItem, { href: "/admin/staff", label: "Staff", icon: "staff" } as NavItem] : []),
  ];
  return <Shell session={s} nav={nav} wide>{children}</Shell>;
}
