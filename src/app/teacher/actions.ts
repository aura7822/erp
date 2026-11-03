"use server";
import { and, eq, inArray, isNull, or } from "drizzle-orm";
import { after } from "next/server";
import { db } from "@/db";
import { attendance, examResults, guardians, streams, studentGuardian, students, subjectTeacher } from "@/db/schema";
import { CAN, requireRole } from "@/lib/auth";
import { gradeFor, remarkFor } from "@/lib/grading";
import { notifyGuardian } from "@/lib/notify";
import { myStaff } from "@/lib/portal";

const EXAMS = ["Opener", "Mid-Term", "End-Term"] as const;
type Result = { ok: true; saved: number } | { error: string };

export async function saveMarks(assignmentId: number, termId: number, examType: string, marks: Record<string, string>): Promise<Result> {
  const s = await requireRole(CAN.teach);
  const exam = EXAMS.find((e) => e === examType);
  if (!exam) return { error: "Invalid exam type." };

  const [a] = await db.select().from(subjectTeacher).where(eq(subjectTeacher.id, assignmentId));
  if (!a) return { error: "Assignment not found." };
  if (s.role !== "admin") {
    const me = await myStaff(s);
    if (!me || me.id !== a.teacherId) return { error: "You are not assigned to this subject and class." };
  }

  // Only students in the assigned class/stream; never trust ids posted from the browser
  const roster = await db.select({ id: students.id }).from(students).where(and(
    eq(students.classId, a.classId), eq(students.status, "active"), a.streamId ? eq(students.streamId, a.streamId) : undefined));
  const allowed = new Set(roster.map((r) => r.id));

  let saved = 0;
  await db.transaction(async (tx) => {
    for (const [sid, raw] of Object.entries(marks)) {
      const id = Number(sid);
      if (!allowed.has(id)) continue;
      const key = and(eq(examResults.studentId, id), eq(examResults.subjectId, a.subjectId), eq(examResults.termId, termId), eq(examResults.examType, exam));
      if (raw === "" || raw == null) { await tx.delete(examResults).where(key); continue; }
      const m = Number(raw);
      if (!Number.isFinite(m) || m < 0 || m > 100) throw new Error("Marks must be between 0 and 100.");
      await tx.insert(examResults).values({
        studentId: id, subjectId: a.subjectId, termId, examType: exam, marks: m.toFixed(2),
        grade: gradeFor(m), remarks: remarkFor(m), enteredBy: s.id,
      }).onConflictDoUpdate({
        target: [examResults.studentId, examResults.subjectId, examResults.termId, examResults.examType],
        set: { marks: m.toFixed(2), grade: gradeFor(m), remarks: remarkFor(m), enteredBy: s.id, updatedAt: new Date() },
      });
      saved++;
    }
  }).catch((e: Error) => { throw e; });
  return { ok: true, saved };
}

export async function saveAttendance(classId: number, date: string, status: Record<string, string>, notify: boolean): Promise<Result> {
  const s = await requireRole(CAN.teach);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date > new Date().toISOString().slice(0, 10)) return { error: "Pick a valid date (not in the future)." };

  if (s.role !== "admin") {
    const me = await myStaff(s);
    if (!me) return { error: "No staff record is linked to your account." };
    const taught = await db.select({ c: subjectTeacher.classId }).from(subjectTeacher).where(eq(subjectTeacher.teacherId, me.id));
    const homeroom = await db.select({ c: streams.classId }).from(streams).where(eq(streams.classTeacherId, me.id));
    if (![...taught, ...homeroom].some((r) => r.c === classId)) return { error: "You do not teach this class." };
  }

  const roster = await db.select({ id: students.id }).from(students).where(and(eq(students.classId, classId), eq(students.status, "active")));
  const allowed = new Set(roster.map((r) => r.id));
  const valid = ["present", "absent", "late", "excused"] as const;
  let saved = 0;

  await db.transaction(async (tx) => {
    for (const [sid, st] of Object.entries(status)) {
      const id = Number(sid);
      const v = valid.find((x) => x === st);
      if (!allowed.has(id) || !v) continue;
      await tx.insert(attendance).values({ studentId: id, classId, date, status: v, markedBy: s.id })
        .onConflictDoUpdate({ target: [attendance.studentId, attendance.date], set: { status: v, markedBy: s.id, classId } });
      saved++;
    }
  });

  if (notify) after(() => notifyAbsent(classId, date)); // runs after the response is sent
  return { ok: true, saved };
}

async function notifyAbsent(classId: number, date: string) {
  const rows = await db.select({ a: attendance, s: students }).from(attendance)
    .innerJoin(students, eq(students.id, attendance.studentId))
    .where(and(eq(attendance.classId, classId), eq(attendance.date, date), eq(attendance.status, "absent"), isNull(attendance.guardianNotifiedAt)));
  for (const { a, s } of rows) {
    const gs = await db.select({ g: guardians }).from(studentGuardian)
      .innerJoin(guardians, eq(guardians.id, studentGuardian.guardianId)).where(eq(studentGuardian.studentId, s.id));
    const text = `${s.firstName} ${s.lastName} was marked absent from school on ${date}. Please contact the school if this is unexpected.`;
    await Promise.all(gs.map(({ g }) => notifyGuardian(g, "Absence notice", text)));
    await db.update(attendance).set({ guardianNotifiedAt: new Date() }).where(eq(attendance.id, a.id));
  }
}
