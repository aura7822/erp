"use server";
import { and, count, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { academicYears, classes, staff, streams, students, subjects, subjectTeacher, terms } from "@/db/schema";
import { type ActionState, UserError, int, need, opt, optInt, run, str } from "@/lib/action";
import { CAN, requireRole, STAFF_VIEW } from "@/lib/auth";
import { CBC_SUBJECTS } from "@/lib/cbc";
import { GRADES } from "@/lib/constants";
import { normalizePhone } from "@/lib/money";

const ROLE_VALUES = ["admin", "principal", "bursar", "teacher"] as const;
type R = (typeof ROLE_VALUES)[number];
const asRole = (v: string): R => { const r = ROLE_VALUES.find((x) => x === v); if (!r) throw new UserError("Choose a valid role."); return r; };

// ---------- Classes ----------
export async function ensureGrades(_: ActionState, __: FormData) {
  return run(async () => {
    await requireRole(CAN.manageSchool);
    await db.insert(classes).values(GRADES.map((g) => ({ className: g.name, level: g.level }))).onConflictDoNothing();
    revalidatePath("/admin/classes");
    return "Grade 1 to Grade 12 are set up.";
  });
}
export async function updateClass(_: ActionState, fd: FormData) {
  return run(async () => {
    await requireRole(CAN.manageSchool);
    await db.update(classes).set({ className: need(str(fd, "className"), "Class name"), level: int(fd, "level"), classTeacherId: optInt(fd, "classTeacherId") }).where(eq(classes.id, int(fd, "id")));
    revalidatePath("/admin/classes");
    return "Class updated.";
  });
}
export async function addStream(_: ActionState, fd: FormData) {
  return run(async () => {
    await requireRole(CAN.manageSchool);
    const name = str(fd, "custom") || need(str(fd, "pick"), "Stream");
    await db.insert(streams).values({ classId: int(fd, "classId"), stream: name, classTeacherId: optInt(fd, "classTeacherId") });
    revalidatePath("/admin/classes");
    return `Stream "${name}" added.`;
  });
}
export async function updateStream(_: ActionState, fd: FormData) {
  return run(async () => {
    await requireRole(CAN.manageSchool);
    await db.update(streams).set({ stream: need(str(fd, "stream"), "Stream name"), classTeacherId: optInt(fd, "classTeacherId") }).where(eq(streams.id, int(fd, "id")));
    revalidatePath("/admin/classes");
    return "Stream updated.";
  });
}
export async function deleteStream(_: ActionState, fd: FormData) {
  return run(async () => {
    await requireRole(CAN.manageSchool);
    const id = int(fd, "id");
    const [{ n }] = await db.select({ n: count() }).from(students).where(eq(students.streamId, id));
    if (n > 0) throw new UserError(`${n} students are in this stream. Move them to another stream first.`);
    await db.delete(streams).where(eq(streams.id, id));
    revalidatePath("/admin/classes");
    return "Stream deleted.";
  });
}

// ---------- Terms ----------
export async function createTerm(_: ActionState, fd: FormData) {
  return run(async () => {
    await requireRole(CAN.manageSchool);
    const year = int(fd, "year");
    const current = fd.get("isCurrent") === "on";
    const start = need(str(fd, "startDate"), "Start date"), end = need(str(fd, "endDate"), "End date");
    if (end <= start) throw new UserError("The end date must be after the start date.");
    const [y] = await db.insert(academicYears).values({ year }).onConflictDoUpdate({ target: academicYears.year, set: { year } }).returning();
    if (current) {
      await db.update(terms).set({ isCurrent: false });
      await db.update(academicYears).set({ isCurrent: false });
      await db.update(academicYears).set({ isCurrent: true }).where(eq(academicYears.id, y.id));
    }
    await db.insert(terms).values({ academicYearId: y.id, termName: need(str(fd, "termName"), "Term name"), startDate: start, endDate: end, isCurrent: current })
      .onConflictDoUpdate({ target: [terms.academicYearId, terms.termName], set: { startDate: start, endDate: end, isCurrent: current } });
    revalidatePath("/admin", "layout");
    return "Term saved.";
  });
}

// ---------- Subjects ----------
export async function createSubject(_: ActionState, fd: FormData) {
  return run(async () => {
    await requireRole(CAN.manageSchool);
    const min = int(fd, "minGrade"), max = int(fd, "maxGrade");
    if (min > max) throw new UserError("The lowest grade can't be above the highest grade.");
    await db.insert(subjects).values({ subjectCode: need(str(fd, "subjectCode").toUpperCase(), "Code"), name: need(str(fd, "name"), "Subject name"), category: opt(fd, "category"), minGrade: min, maxGrade: max, periodsPerWeek: int(fd, "periodsPerWeek") });
    revalidatePath("/admin/academics/subjects");
    return "Subject added.";
  });
}
export async function updateSubject(_: ActionState, fd: FormData) {
  return run(async () => {
    await requireRole(CAN.manageSchool);
    const min = int(fd, "minGrade"), max = int(fd, "maxGrade"), periods = int(fd, "periodsPerWeek");
    if (min > max) throw new UserError("The lowest grade can't be above the highest grade.");
    if (periods < 1 || periods > 10) throw new UserError("Periods per week must be between 1 and 10.");
    await db.update(subjects).set({ name: need(str(fd, "name"), "Subject name"), minGrade: min, maxGrade: max, periodsPerWeek: periods }).where(eq(subjects.id, int(fd, "id")));
    revalidatePath("/admin/academics/subjects");
    return "Subject updated.";
  });
}
export async function loadCbcSubjects(_: ActionState, __: FormData) {
  return run(async () => {
    await requireRole(CAN.manageSchool);
    const r = await db.insert(subjects).values(CBC_SUBJECTS.map((s) => ({ subjectCode: s.code, name: s.name, category: s.category, minGrade: s.min, maxGrade: s.max, periodsPerWeek: s.periods }))).onConflictDoNothing().returning({ id: subjects.id });
    revalidatePath("/admin/academics/subjects");
    return r.length ? `${r.length} CBC learning areas added.` : "All CBC learning areas are already loaded.";
  });
}
export async function assignTeacher(_: ActionState, fd: FormData) {
  return run(async () => {
    await requireRole(CAN.manageSchool);
    const [t] = await db.select().from(staff).where(eq(staff.id, int(fd, "teacherId")));
    if (!t || t.status !== "active") throw new UserError("Only active staff can be assigned to teach.");
    const streamId = optInt(fd, "streamId");
    const classId = int(fd, "classId");
    if (streamId) { const [s] = await db.select().from(streams).where(and(eq(streams.id, streamId), eq(streams.classId, classId))); if (!s) throw new UserError("That stream doesn't belong to the chosen grade."); }
    await db.insert(subjectTeacher).values({ subjectId: int(fd, "subjectId"), classId, streamId, teacherId: t.id }).onConflictDoNothing();
    revalidatePath("/admin/academics", "layout");
    return `${t.name} assigned.`;
  });
}
export async function removeAssignment(_: ActionState, fd: FormData) {
  return run(async () => {
    await requireRole(CAN.manageSchool);
    await db.delete(subjectTeacher).where(eq(subjectTeacher.id, int(fd, "id")));
    revalidatePath("/admin/academics", "layout");
    return "Assignment removed.";
  });
}

