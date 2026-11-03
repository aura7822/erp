import { LuClipboardList } from "react-icons/lu";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { academicYears, classes, examResults, streams, students, subjects, subjectTeacher, terms } from "@/db/schema";
import { MarksGrid } from "@/components/MarksGrid";
import { PageTitle } from "@/components/Shell";
import { CAN, requireRole } from "@/lib/auth";
import { myStaff } from "@/lib/portal";

export default async function MarksPage({ searchParams }: { searchParams: Promise<{ a?: string; t?: string; e?: string }> }) {
  const s = await requireRole(CAN.teach);
  const sp = await searchParams;
  const me = s.role === "admin" ? null : await myStaff(s);

  const mine = await db.select({ id: subjectTeacher.id, subjectId: subjectTeacher.subjectId, classId: subjectTeacher.classId, streamId: subjectTeacher.streamId, subject: subjects.name, cls: classes.className, stream: streams.stream })
    .from(subjectTeacher).innerJoin(subjects, eq(subjects.id, subjectTeacher.subjectId)).innerJoin(classes, eq(classes.id, subjectTeacher.classId))
    .leftJoin(streams, eq(streams.id, subjectTeacher.streamId))
    .where(me ? eq(subjectTeacher.teacherId, me.id) : undefined);

  const allTerms = await db.select({ id: terms.id, name: terms.termName, year: academicYears.year, cur: terms.isCurrent }).from(terms)
    .innerJoin(academicYears, eq(academicYears.id, terms.academicYearId)).orderBy(terms.startDate);
  const a = mine.find((x) => x.id === Number(sp.a)) ?? mine[0];
  const termId = Number(sp.t) || allTerms.find((t) => t.cur)?.id || allTerms.at(-1)?.id;
  const exam = (["Opener", "Mid-Term", "End-Term"].includes(sp.e ?? "") ? sp.e : "End-Term") as "End-Term";

  let roster: { id: number; name: string; adm: string; marks: string }[] = [];
  if (a && termId) {
    const st = await db.select().from(students).where(and(eq(students.classId, a.classId), eq(students.status, "active"), a.streamId ? eq(students.streamId, a.streamId) : undefined)).orderBy(students.admissionNumber);
    const existing = await db.select().from(examResults).where(and(eq(examResults.subjectId, a.subjectId), eq(examResults.termId, termId), eq(examResults.examType, exam)));
    const byStudent = new Map(existing.map((r) => [r.studentId, r.marks]));
    roster = st.map((x) => ({ id: x.id, name: `${x.firstName} ${x.lastName}`, adm: x.admissionNumber, marks: byStudent.has(x.id) ? String(Number(byStudent.get(x.id))) : "" }));
  }

  return (
    <>
      <PageTitle icon={<LuClipboardList />} title="Enter marks" />
      {mine.length === 0 ? (
        <p className="card p-6 text-ink-mute">No classes are assigned to you yet. Ask the office to assign your subjects (and make sure your staff email matches your sign-in email).</p>
      ) : (
        <>
          <form className="card grid gap-4 p-4 sm:grid-cols-4">
            <div className="sm:col-span-2"><label className="label" htmlFor="a">Subject and class</label>
              <select id="a" name="a" defaultValue={a?.id} className="field">{mine.map((x) => <option key={x.id} value={x.id}>{x.subject} · {x.cls} {x.stream ?? ""}</option>)}</select></div>
            <div><label className="label" htmlFor="t">Term</label><select id="t" name="t" defaultValue={termId} className="field">{allTerms.map((t) => <option key={t.id} value={t.id}>{t.year} · {t.name}</option>)}</select></div>
            <div><label className="label" htmlFor="e">Exam</label><select id="e" name="e" defaultValue={exam} className="field">{["Opener", "Mid-Term", "End-Term"].map((x) => <option key={x}>{x}</option>)}</select></div>
            <div className="sm:col-span-4"><button className="btn-ghost">Load students</button></div>
          </form>
          {a && termId && (roster.length ? <MarksGrid key={`${a.id}-${termId}-${exam}`} assignmentId={a.id} termId={termId} examType={exam} students={roster} /> : <p className="mt-4 text-ink-mute">No active students in this class.</p>)}
        </>
      )}
    </>
  );
}
