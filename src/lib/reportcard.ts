import { and, eq, inArray, or } from "drizzle-orm";
import { db } from "@/db";
import { academicYears, classes, examResults, invoices, streams, students, subjects, terms } from "@/db/schema";
import { gradeFor } from "./grading";

type Exam = "Opener" | "Mid-Term" | "End-Term";

/** Competition ranking: 1, 2, 2, 4 */
function rank(scores: Map<number, number>) {
  const sorted = [...scores.entries()].sort((a, b) => b[1] - a[1]);
  const out = new Map<number, number>();
  let prev: number | null = null, r = 0;
  sorted.forEach(([id, sc], i) => { if (sc !== prev) { r = i + 1; prev = sc; } out.set(id, r); });
  return out;
}

/** Loads everything for a whole class once, so one student or a full class costs the same handful of queries. */
async function loadContext(classId: number, termId: number, examType: Exam, includeStudentId?: number) {
  const [term] = await db.select({ id: terms.id, termName: terms.termName, year: academicYears.year }).from(terms).innerJoin(academicYears, eq(academicYears.id, terms.academicYearId)).where(eq(terms.id, termId));
  if (!term) return null;
  const roster = await db.select({
    id: students.id, firstName: students.firstName, lastName: students.lastName, admissionNumber: students.admissionNumber, classId: students.classId,
    className: classes.className, stream: streams.stream, photoUrl: students.photoUrl,
  }).from(students).innerJoin(classes, eq(classes.id, students.classId)).leftJoin(streams, eq(streams.id, students.streamId))
    .where(and(eq(students.classId, classId), or(eq(students.status, "active"), includeStudentId ? eq(students.id, includeStudentId) : undefined)))
    .orderBy(students.admissionNumber);
  const ids = roster.map((r) => r.id);
  const all = ids.length ? await db.select({ studentId: examResults.studentId, subjectId: examResults.subjectId, subject: subjects.name, marks: examResults.marks, grade: examResults.grade, remarks: examResults.remarks })
    .from(examResults).innerJoin(subjects, eq(subjects.id, examResults.subjectId)).where(and(eq(examResults.termId, termId), eq(examResults.examType, examType), inArray(examResults.studentId, ids))) : [];
  const invs = ids.length ? await db.select().from(invoices).where(and(eq(invoices.termId, termId), inArray(invoices.studentId, ids))) : [];

  const totals = new Map<number, number>();
  const bySubject = new Map<number, Map<number, number>>();
  for (const r of all) {
    const m = Number(r.marks);
    totals.set(r.studentId, (totals.get(r.studentId) ?? 0) + m);
    if (!bySubject.has(r.subjectId)) bySubject.set(r.subjectId, new Map());
    bySubject.get(r.subjectId)!.set(r.studentId, m);
  }
  return { term, examType, roster, all, invs, totals, bySubject, overall: rank(totals), subjectRanks: new Map([...bySubject].map(([k, v]) => [k, rank(v)])) };
}
type Ctx = NonNullable<Awaited<ReturnType<typeof loadContext>>>;

function build(ctx: Ctx, studentId: number) {
  const student = ctx.roster.find((r) => r.id === studentId);
  if (!student) return null;
  const rows = ctx.all.filter((r) => r.studentId === studentId).sort((a, b) => a.subject.localeCompare(b.subject)).map((r) => {
    const m = ctx.bySubject.get(r.subjectId)!;
    const mean = [...m.values()].reduce((x, y) => x + y, 0) / m.size;
    return { subject: r.subject, marks: Number(r.marks), grade: r.grade, remarks: r.remarks ?? "", mean: Math.round(mean * 10) / 10, rank: ctx.subjectRanks.get(r.subjectId)?.get(studentId) ?? null };
  });
  const total = rows.reduce((s, r) => s + r.marks, 0);
  const mean = rows.length ? Math.round((total / rows.length) * 10) / 10 : 0;
  const inv = ctx.invs.find((i) => i.studentId === studentId);
  return {
    student, term: ctx.term, examType: ctx.examType, rows, total, mean, meanGrade: gradeFor(mean),
    position: ctx.overall.get(studentId) ?? null, outOf: ctx.totals.size,
    balance: inv ? Number(inv.totalAmount) - Number(inv.amountPaid) : null,
  };
}
export type ReportCard = NonNullable<ReturnType<typeof build>>;

export async function reportCardData(studentId: number, termId: number, examType: Exam): Promise<ReportCard | null> {
  const [s] = await db.select({ classId: students.classId }).from(students).where(eq(students.id, studentId));
  if (!s) return null;
  const ctx = await loadContext(s.classId, termId, examType, studentId);
  return ctx ? build(ctx, studentId) : null;
}

/** Every student in the class who has results for the exam, one card each. */
export async function reportCardsForClass(classId: number, termId: number, examType: Exam): Promise<ReportCard[]> {
  const ctx = await loadContext(classId, termId, examType);
  if (!ctx) return [];
  const withResults = new Set(ctx.all.map((r) => r.studentId));
  return ctx.roster.filter((r) => withResults.has(r.id)).map((r) => build(ctx, r.id)!).filter(Boolean);
}
