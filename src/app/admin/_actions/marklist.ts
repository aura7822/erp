"use server";
import { and, eq, inArray, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { examResults, marklistRows, students, subjects } from "@/db/schema";
import { type ActionState, UserError, int, run, str } from "@/lib/action";
import { CAN, requireRole } from "@/lib/auth";
import { gradeFor, remarkFor } from "@/lib/grading";
import { parseMarklist } from "@/lib/import";

const EXAMS = ["Opener", "Mid-Term", "End-Term"] as const;
type Exam = (typeof EXAMS)[number];

async function upsertResults(rows: { studentId: number; subjectId: number; mark: number }[], termId: number, examType: Exam, by: string) {
  for (let i = 0; i < rows.length; i += 400) {
    await db.insert(examResults).values(rows.slice(i, i + 400).map((r) => ({
      studentId: r.studentId, subjectId: r.subjectId, termId, examType, marks: r.mark.toFixed(2), grade: gradeFor(r.mark), remarks: remarkFor(r.mark), enteredBy: by,
    }))).onConflictDoUpdate({
      target: [examResults.studentId, examResults.subjectId, examResults.termId, examResults.examType],
      set: { marks: sql`excluded.marks_obtained`, grade: sql`excluded.grade`, remarks: sql`excluded.remarks`, enteredBy: sql`excluded.entered_by`, updatedAt: new Date() },
    });
  }
}

export async function uploadMarklist(_: ActionState, fd: FormData) {
  return run(async () => {
    const me = await requireRole(CAN.manageSchool);
    const termId = int(fd, "termId");
    const examType = EXAMS.find((e) => e === str(fd, "examType"));
    if (!examType) throw new UserError("Choose the exam.");
    const file = fd.get("file");
    if (!(file instanceof File) || !file.size) throw new UserError("Choose the marklist spreadsheet first.");
    if (file.size > 5 * 1024 * 1024) throw new UserError("That file is larger than 5 MB.");

    const subs = await db.select({ id: subjects.id, name: subjects.name, code: subjects.subjectCode }).from(subjects);
    const parsed = parseMarklist(await file.arrayBuffer(), subs);
    if (parsed.error) throw new UserError(parsed.error);
    if (!parsed.rows.length) throw new UserError("No rows with an admission number were found.");
    if (!parsed.subjectCols.length) throw new UserError(`No subject columns matched. Headings found that didn't match a subject: ${parsed.unknown.join(", ") || "none"}.`);

    const found = await db.select({ id: students.id, adm: students.admissionNumber }).from(students).where(inArray(students.admissionNumber, parsed.rows.map((r) => r.adm)));
    const idOf = new Map(found.map((f) => [f.adm, f.id]));
    const toWrite: { studentId: number; subjectId: number; mark: number }[] = [];
    const missing: typeof parsed.rows = [];
    const details: string[] = [];
    let applied = 0;

    for (const r of parsed.rows) {
      for (const i of r.issues) details.push(`${r.adm}: ${i}. That mark was skipped.`);
      const sid = idOf.get(r.adm);
      if (!sid) { missing.push(r); continue; }
      for (const [subjectId, mark] of Object.entries(r.marks)) toWrite.push({ studentId: sid, subjectId: Number(subjectId), mark });
      applied++;
    }
    await upsertResults(toWrite, termId, examType, me.id);

    if (missing.length) {
      await db.delete(marklistRows).where(and(eq(marklistRows.termId, termId), eq(marklistRows.examType, examType), inArray(marklistRows.admissionNumber, missing.map((m) => m.adm))));
      await db.insert(marklistRows).values(missing.map((m) => ({ termId, examType, admissionNumber: m.adm, studentName: m.name || null, marks: m.marks })));
      for (const m of missing) details.unshift(`ERROR: ${m.adm}${m.name ? ` (${m.name})` : ""} is not in the system, so this student was skipped. Add the student, then press “Re-check”.`);
    }
    if (parsed.unknown.length) details.push(`Columns that didn't match any subject and were ignored: ${parsed.unknown.join(", ")}.`);
    revalidatePath("/admin/academics/report-cards");
    return { ok: `Marks saved for ${applied} student(s) across ${parsed.subjectCols.length} subject(s).${missing.length ? ` ${missing.length} student(s) not found.` : " Report cards are ready."}`, details: details.slice(0, 40) };
  });
}

/** After adding missing students, re-apply their skipped marks. */
export async function recheckMarklist(_: ActionState, __: FormData) {
  return run(async () => {
    const me = await requireRole(CAN.manageSchool);
    const rows = await db.select().from(marklistRows);
    if (!rows.length) return "Nothing is waiting.";
    const found = await db.select({ id: students.id, adm: students.admissionNumber }).from(students).where(inArray(students.admissionNumber, rows.map((r) => r.admissionNumber)));
    const idOf = new Map(found.map((f) => [f.adm, f.id]));
    let done = 0;
    for (const r of rows) {
      const sid = idOf.get(r.admissionNumber);
      if (!sid) continue;
      const marks = Object.entries(r.marks as Record<string, number>).map(([subjectId, mark]) => ({ studentId: sid, subjectId: Number(subjectId), mark }));
      await upsertResults(marks, r.termId, r.examType, me.id);
      await db.delete(marklistRows).where(eq(marklistRows.id, r.id));
      done++;
    }
    revalidatePath("/admin/academics/report-cards");
    return done ? `${done} student(s) found and their report cards generated.` : "Still not in the system. Add the students first.";
  });
}
export async function dismissMarklistRow(_: ActionState, fd: FormData) {
  return run(async () => {
    await requireRole(CAN.manageSchool);
    await db.delete(marklistRows).where(eq(marklistRows.id, int(fd, "id")));
    revalidatePath("/admin/academics/report-cards");
    return "Dismissed.";
  });
}
