import { eq } from "drizzle-orm";
import { db } from "@/db";
import { staff, staffGrades, staffSubjects } from "@/db/schema";
import { UserError, need, opt, str } from "./action";
import { normalizePhone } from "./money";

export type StaffKind = "teaching" | "non_teaching";
export type StaffRoleV = "admin" | "principal" | "bursar" | "teacher" | "support";
type Emp = "TSC" | "BOM" | "Permanent" | "Contract";
export const kindForRole = (r: StaffRoleV): StaffKind => (r === "teacher" || r === "principal" ? "teaching" : "non_teaching");

/** Validates the staff form. Rule: TSC teachers/principals MUST give a TSC number; BOM ones need not. */
export function parseStaff(fd: FormData, force?: { kind: StaffKind; role: StaffRoleV }) {
  const kind: StaffKind = force?.kind ?? (str(fd, "kind") === "non_teaching" ? "non_teaching" : "teaching");
  const role = (force?.role ?? str(fd, "role")) as StaffRoleV;
  const allowed = kind === "teaching" ? ["teacher", "principal"] : ["admin", "bursar", "support"];
  if (!allowed.includes(role)) throw new UserError("Choose a role that matches the staff type.");

  const phoneRaw = str(fd, "phone");
  const phone = phoneRaw ? normalizePhone(phoneRaw) : null;
  if (phone && !/^254[17]\d{8}$/.test(phone)) throw new UserError("Enter a valid Kenyan mobile number, e.g. 0712 345 678.");

  const emp = str(fd, "employmentType");
  let employmentType: Emp | null = null, tscNumber: string | null = null, jobTitle: string | null = null;
  if (kind === "teaching") {
    if (emp !== "TSC" && emp !== "BOM") throw new UserError("Say whether this person is employed by TSC or by the BOM.");
    employmentType = emp;
    tscNumber = emp === "TSC" ? need(str(fd, "tscNumber"), "TSC number (required for TSC-employed staff)") : opt(fd, "tscNumber");
  } else {
    jobTitle = need(str(fd, "jobTitle"), "Job title");
    if (emp === "Permanent" || emp === "Contract" || emp === "BOM") employmentType = emp;
  }
  const ints = (k: string) => [...new Set(fd.getAll(k).map((v) => Number(v)).filter((n) => Number.isInteger(n) && n > 0))];
  return {
    kind, role, employmentType, tscNumber, jobTitle, phone,
    name: need(str(fd, "name"), "Full name"), nationalId: opt(fd, "nationalId"), qualification: opt(fd, "qualification"), department: opt(fd, "department"),
    subjectIds: kind === "teaching" ? ints("subjectId") : [], gradeIds: kind === "teaching" ? ints("gradeId") : [],
  };
}
export type ParsedStaff = ReturnType<typeof parseStaff>;

export async function persistStaff(p: ParsedStaff & { id: number | null; email: string; status?: "active" | "pending"; requestedRole?: StaffRoleV | null; clerkUserId?: string | null }) {
  return db.transaction(async (tx) => {
    const base = { name: p.name, kind: p.kind, role: p.role, employmentType: p.employmentType, phone: p.phone, nationalId: p.nationalId, tscNumber: p.tscNumber, qualification: p.qualification, department: p.department, jobTitle: p.jobTitle, email: p.email };
    let id = p.id;
    if (id) await tx.update(staff).set(base).where(eq(staff.id, id));
    else {
      const [r] = await tx.insert(staff).values({ ...base, employeeId: `EMP-${Date.now().toString(36).toUpperCase()}`, status: p.status ?? "active", requestedRole: p.requestedRole ?? null, clerkUserId: p.clerkUserId ?? null }).returning({ id: staff.id });
      id = r.id;
    }
    const sid = id;
    await tx.delete(staffSubjects).where(eq(staffSubjects.staffId, sid));
    if (p.subjectIds.length) await tx.insert(staffSubjects).values(p.subjectIds.map((subjectId) => ({ staffId: sid, subjectId })));
    await tx.delete(staffGrades).where(eq(staffGrades.staffId, sid));
    if (p.gradeIds.length) await tx.insert(staffGrades).values(p.gradeIds.map((classId) => ({ staffId: sid, classId })));
    return sid;
  });
}
