import Link from "next/link";
import { and, count, eq, sql } from "drizzle-orm";
import { LuFileText } from "react-icons/lu";
import { db } from "@/db";
import { academicYears, classes, examResults, marklistRows, students, terms } from "@/db/schema";
import { ACADEMIC_TABS, PageTitle, Tabs } from "@/components/Shell";
import { ActionForm, SubmitButton } from "@/components/ui";
import { CAN, requireRole } from "@/lib/auth";
import { dismissMarklistRow, recheckMarklist, uploadMarklist } from "../../_actions/marklist";

const EXAMS = ["Opener", "Mid-Term", "End-Term"] as const;

export default async function ReportCardsPage({ searchParams }: { searchParams: Promise<{ term?: string; exam?: string; c?: string }> }) {
  const me = await requireRole(["admin", "principal"]);
  const canEdit = CAN.manageSchool.includes(me.role);
  const sp = await searchParams;

  const [allTerms, cls, missing] = await Promise.all([
    db.select({ id: terms.id, name: terms.termName, year: academicYears.year, cur: terms.isCurrent }).from(terms).innerJoin(academicYears, eq(academicYears.id, terms.academicYearId)).orderBy(academicYears.year, terms.startDate),
    db.select().from(classes).orderBy(classes.level),
    db.select({ r: marklistRows, term: terms.termName, year: academicYears.year }).from(marklistRows).innerJoin(terms, eq(terms.id, marklistRows.termId)).innerJoin(academicYears, eq(academicYears.id, terms.academicYearId)).orderBy(marklistRows.admissionNumber),
  ]);
  const term = allTerms.find((t) => t.id === Number(sp.term)) ?? allTerms.find((t) => t.cur) ?? allTerms.at(-1);
  const exam = EXAMS.find((e) => e === sp.exam) ?? "End-Term";
  const klass = cls.find((c) => c.id === Number(sp.c)) ?? cls[0];

  const ready = term && klass ? await db.select({
    id: students.id, uuid: students.uuid, first: students.firstName, last: students.lastName, adm: students.admissionNumber, photo: students.photoUrl,
    n: count(examResults.id), total: sql<string>`sum(${examResults.marks})`, mean: sql<string>`avg(${examResults.marks})`,
  }).from(students).innerJoin(examResults, and(eq(examResults.studentId, students.id), eq(examResults.termId, term.id), eq(examResults.examType, exam)))
    .where(eq(students.classId, klass.id)).groupBy(students.id).orderBy(students.admissionNumber) : [];

  return (
    <>
      <PageTitle title="Academics" sub="Upload a marklist and report cards are generated automatically" back="/admin/academics" icon={<LuFileText />} />
      <Tabs tabs={ACADEMIC_TABS} current="/admin/academics/report-cards" />

      {canEdit && term && (
        <section className="card mb-6 p-5">
          <h2 className="font-display text-lg font-bold text-oxblood">Upload a marklist</h2>
          <p className="mb-3 text-sm text-ink-mute">A spreadsheet (.xlsx, .xls or .csv) with an <strong>Admission No</strong> column and one column per subject (heading = subject name). Students not in the system are skipped and listed below so you can add them.</p>
          <ActionForm action={uploadMarklist} className="grid gap-3 sm:grid-cols-4 sm:items-end">
            <div><label className="label" htmlFor="mt">Term</label><select id="mt" name="termId" defaultValue={term.id} className="field">{allTerms.map((t) => <option key={t.id} value={t.id}>{t.year} · {t.name}</option>)}</select></div>
            <div><label className="label" htmlFor="me">Exam</label><select id="me" name="examType" defaultValue={exam} className="field">{EXAMS.map((e) => <option key={e}>{e}</option>)}</select></div>
            <div className="sm:col-span-2"><label className="label" htmlFor="mf">Marklist file</label><input id="mf" type="file" name="file" accept=".xlsx,.xls,.csv" className="field !p-2" required /></div>
            <SubmitButton pendingText="Processing…" className="w-full sm:w-auto">Upload &amp; generate</SubmitButton>
          </ActionForm>
          {klass && <p className="mt-3 text-sm"><a className="font-semibold underline underline-offset-4" href={`/api/templates/marklist?classId=${klass.id}`}>Download a blank marklist for {klass.className}</a> <span className="text-ink-mute">(students and subjects already filled in)</span></p>}
        </section>
      )}

      {missing.length > 0 && (
        <section className="card mb-6 border-2 border-alert/50 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div><h2 className="font-display text-lg font-bold text-alert">Not in the system ({missing.length})</h2><p className="text-sm text-ink-mute">These students were in a marklist but have no record, so their marks were skipped. Add them, then re-check.</p></div>
            {canEdit && <ActionForm action={recheckMarklist}><SubmitButton variant="accent" pendingText="Checking…">Re-check</SubmitButton></ActionForm>}
          </div>
          <ul className="mt-3 divide-y divide-paper-line/70 text-sm">
            {missing.map(({ r, term: t, year }) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                <span><strong>{r.admissionNumber}</strong> {r.studentName && `· ${r.studentName}`} <span className="text-ink-mute">· {year} {t} · {r.examType} · {Object.keys(r.marks as object).length} marks</span></span>
                {canEdit && <span className="flex gap-2">
                  <Link className="btn-primary btn-sm" href={`/admin/students/new?adm=${encodeURIComponent(r.admissionNumber)}&name=${encodeURIComponent(r.studentName ?? "")}`}>Add to system</Link>
                  <ActionForm action={dismissMarklistRow}><input type="hidden" name="id" value={r.id} /><SubmitButton size="sm" variant="danger" confirm="Dismiss this row? Its marks will be discarded.">Dismiss</SubmitButton></ActionForm></span>}
              </li>
            ))}
          </ul>
        </section>
      )}

      <form className="mb-4 flex flex-wrap items-end gap-3">
        <div><label className="label" htmlFor="ft">Term</label><select id="ft" name="term" defaultValue={term?.id} className="field">{allTerms.map((t) => <option key={t.id} value={t.id}>{t.year} · {t.name}</option>)}</select></div>
        <div><label className="label" htmlFor="fe">Exam</label><select id="fe" name="exam" defaultValue={exam} className="field">{EXAMS.map((e) => <option key={e}>{e}</option>)}</select></div>
        <div><label className="label" htmlFor="fc">Grade</label><select id="fc" name="c" defaultValue={klass?.id} className="field">{cls.map((c) => <option key={c.id} value={c.id}>{c.className}</option>)}</select></div>
        <button className="btn-ghost">Show</button>
        {ready.length > 0 && term && klass && <a className="btn-primary" href={`/api/report-cards/${klass.id}/${term.id}/${encodeURIComponent(exam)}`}>Download all ({ready.length}) as one PDF</a>}
      </form>

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr><th className="th">Student</th><th className="th">Adm. no.</th><th className="th text-right">Subjects</th><th className="th text-right">Total</th><th className="th text-right">Mean</th><th className="th">Photo</th><th className="th" /></tr></thead>
          <tbody className="divide-y divide-paper-line/70">
            {ready.map((r) => (
              <tr key={r.id}><td className="td font-medium">{r.first} {r.last}</td><td className="td tabular-nums">{r.adm}</td><td className="td text-right">{r.n}</td><td className="td text-right tabular-nums">{Number(r.total).toFixed(1)}</td><td className="td text-right tabular-nums">{Number(r.mean).toFixed(1)}</td>
                <td className="td">{r.photo ? <span className="chip text-ok">on card</span> : <Link href={`/admin/students/${r.id}`} className="chip text-alert">missing, add</Link>}</td>
                <td className="td text-right">{term && <a className="btn-ghost btn-sm" href={`/api/report-card/${r.uuid}/${term.id}/${encodeURIComponent(exam)}`}>PDF</a>}</td></tr>
            ))}
            {ready.length === 0 && <tr><td colSpan={7} className="td text-ink-mute">No results for {klass?.className} in this term and exam yet. Upload a marklist above.</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}
