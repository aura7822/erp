"use server";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { staff, staffAttendance } from "@/db/schema";
import { type ActionState, UserError, int, need, run, str } from "@/lib/action";
import { CAN, getSession, requireRole } from "@/lib/auth";
import { todayEAT } from "@/lib/constants";
import { type StaffRoleV, kindForRole, parseStaff, persistStaff } from "@/lib/staff";

const ROLES = ["admin", "principal", "bursar", "teacher", "support"] as const;
const asRole = (v: string): StaffRoleV => { const r = ROLES.find((x) => x === v); if (!r) throw new UserError("Choose a valid role."); return r; };
const refresh = () => { revalidatePath("/admin/staff"); revalidatePath("/admin/academics", "layout"); };

export async function saveStaff(_: ActionState, fd: FormData) {
  return run(async () => {
    await requireRole(CAN.manageSchool);
    const idRaw = str(fd, "id");
    const p = parseStaff(fd);
    const email = need(str(fd, "email").toLowerCase(), "Email");
    await persistStaff({ ...p, id: idRaw ? int(fd, "id") : null, email });
    refresh();
    return idRaw ? "Staff details saved." : `${p.name} added. They get access when they sign in with ${email}.`;
  });
}

export async function approveStaff(_: ActionState, fd: FormData) {
  return run(async () => {
    await requireRole(CAN.manageSchool);
    const role = asRole(str(fd, "role"));
    await db.update(staff).set({ status: "active", role, kind: kindForRole(role) }).where(eq(staff.id, int(fd, "id")));
    refresh();
    return "Approved. They now have access.";
  });
}
export async function rejectStaff(_: ActionState, fd: FormData) {
  return run(async () => {
    await requireRole(CAN.manageSchool);
    await db.delete(staff).where(and(eq(staff.id, int(fd, "id")), eq(staff.status, "pending")));
    refresh();
    return "Request declined.";
  });
}
export async function setStaffRole(_: ActionState, fd: FormData) {
  return run(async () => {
    const s = await requireRole(CAN.manageSchool);
    const id = int(fd, "id"), role = asRole(str(fd, "role"));
    if (s.staffId === id && role !== "admin") throw new UserError("You can't remove your own admin role.");
    await db.update(staff).set({ role, kind: kindForRole(role), status: "active" }).where(eq(staff.id, id));
    refresh();
    return `Role set to ${role}.`;
  });
}
export async function revokeStaff(_: ActionState, fd: FormData) {
  return run(async () => {
    const s = await requireRole(CAN.manageSchool);
    const id = int(fd, "id");
    if (s.staffId === id) throw new UserError("You can't revoke your own access.");
    await db.update(staff).set({ status: "revoked" }).where(eq(staff.id, id));
    refresh();
    return "Access revoked.";
  });
}

// ───────── Clock in / out (drives the "active today" indicator) ─────────
async function toggleClock(staffId: number, by: string | null, dir?: "in" | "out") {
  const date = todayEAT();
  const [row] = await db.select().from(staffAttendance).where(and(eq(staffAttendance.staffId, staffId), eq(staffAttendance.date, date)));
  if (dir === "out" || (!dir && row && !row.clockOut)) {
    if (!row) throw new UserError("Not clocked in yet today.");
    await db.update(staffAttendance).set({ clockOut: new Date() }).where(eq(staffAttendance.id, row.id));
    return "Clocked out. See you tomorrow.";
  }
  if (row) {
    if (dir === "in" && row.clockOut) { await db.update(staffAttendance).set({ clockOut: null }).where(eq(staffAttendance.id, row.id)); return "Clock-out undone."; }
    throw new UserError("Already clocked in today.");
  }
  await db.insert(staffAttendance).values({ staffId, date, markedBy: by });
  return "Clocked in.";
}

export async function selfClock(_: ActionState, __: FormData) {
  return run(async () => {
    const s = await getSession();
    if (!s?.staffId) throw new UserError("No staff record is linked to your account.");
    const m = await toggleClock(s.staffId, s.id);
    revalidatePath("/admin/staff");
    revalidatePath("/", "layout");
    return m;
  });
}
export async function adminClock(_: ActionState, fd: FormData) {
  return run(async () => {
    const s = await requireRole(CAN.manageSchool);
    const dir = str(fd, "dir") === "out" ? "out" : "in";
    const m = await toggleClock(int(fd, "id"), s.id, dir);
    revalidatePath("/admin/staff");
    return m;
  });
}
