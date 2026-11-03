import { LuGraduationCap } from "react-icons/lu";
import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { academicYears, examResults, guardians, studentGuardian, students, terms } from "@/db/schema";
import { PageTitle } from "@/components/Shell";
import { StudentForm } from "@/components/StudentForm";
import { ActionForm, SubmitButton } from "@/components/ui";
import { CAN, getSession } from "@/lib/auth";
import { fmtDate } from "@/lib/constants";
import { classOptions } from "@/lib/queries";
import { idMissing } from "@/lib/student-id";
import { addGuardian, issueStudentId, removeGuardian, updateStudent } from "../../_actions/students";

export default async function StudentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sid = Number(id);
  if (!Number.isInteger(sid)) notFound();
  const [s] = await db.select().from(students).where(eq(students.id, sid));
  if (!s) notFound();
  const session = await getSession();
  const canEdit = !!session && CAN.manageSchool.includes(session.role);

  const [classes, gs, reports, missing] = await Promise.all([
    classOptions(),
    db.select({ g: guardians, rel: studentGuardian.relationship }).from(studentGuardian).innerJoin(guardians, eq(guardians.id, studentGuardian.guardianId)).where(eq(studentGuardian.studentId, sid)),
    db.selectDistinct({ termId: examResults.termId, exam: examResults.examType, term: terms.termName, year: academicYears.year }).from(examResults).innerJoin(terms, eq(terms.id, examResults.termId)).innerJoin(academicYears, eq(academicYears.id, terms.academicYearId)).where(eq(examResults.studentId, sid)),
    idMissing(s),
  ]);

  return (
    <>
      <PageTitle icon={<LuGraduationCap />} title={`${s.firstName} ${s.lastName}`} sub={`Adm. ${s.admissionNumber} · admitted ${fmtDate(s.admittedOn)}`} back="/admin/students" />

      <section className="card mb-6 p-5">
        <h2 className="font-display text-lg font-bold">Student ID card</h2>
        {s.idNumber ? (
          <div className="mt-3 flex flex-wrap items-center justify-between gap-4">
            <dl className="grid grid-cols-3 gap-x-8 gap-y-1 text-sm">
              <div><dt className="text-ink-mute">ID number</dt><dd className="font-semibold tabular-nums">{s.idNumber}</dd></div>
              <div><dt className="text-ink-mute">Issued</dt><dd className="font-semibold">{fmtDate(s.idIssuedAt)}</dd></div>
              <div><dt className="text-ink-mute">Expires</dt><dd className="font-semibold">{fmtDate(s.idExpiresAt)}</dd></div>
            </dl>
            <Link href={`/admin/students/${s.id}/id-card`} className="btn-primary">View &amp; print ID</Link>
          </div>
        ) : (
          <ActionForm action={issueStudentId} className="mt-3 flex flex-wrap items-center gap-3">
            <input type="hidden" name="id" value={s.id} />
            <SubmitButton disabled={!canEdit || missing.length > 0} pendingText="Generating…">Generate student ID</SubmitButton>
            <p className="text-sm text-ink-mute">{missing.length ? `Complete these first: ${missing.join(", ")}.` : "Every detail is on file, so the ID can be generated."}</p>
          </ActionForm>
        )}
      </section>

      {canEdit && (
        <StudentForm classes={classes} action={updateStudent} submitLabel="Save changes" cancelHref="/admin/students"
          initial={{ id: s.id, admissionNumber: s.admissionNumber, firstName: s.firstName, lastName: s.lastName, gender: s.gender, dob: s.dob, classId: s.classId, streamId: s.streamId ?? "", admittedOn: s.admittedOn, email: s.email ?? "", status: s.status, photo: s.photoUrl, hasId: true }} />
      )}

      <section className="card mt-6 p-5">
        <h2 className="font-display text-lg font-bold">Parents &amp; guardians</h2>
        <ul className="mt-3 divide-y divide-paper-line/70 text-sm">
          {gs.map(({ g, rel }) => (
            <li key={g.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
              <span><strong>{g.fullName}</strong> · {rel} · {g.phone}{g.email ? ` · ${g.email}` : ""}{g.clerkUserId && <span className="chip ml-2 text-ok">can sign in</span>}</span>
              {canEdit && <ActionForm action={removeGuardian}><input type="hidden" name="studentId" value={s.id} /><input type="hidden" name="guardianId" value={g.id} /><SubmitButton size="sm" variant="danger" confirm="Remove this guardian from the student?">Remove</SubmitButton></ActionForm>}
            </li>
          ))}
          {gs.length === 0 && <li className="py-2 text-ink-mute">No guardians linked yet.</li>}
        </ul>
        {canEdit && (
          <ActionForm action={addGuardian} resetOnSuccess className="mt-4 grid gap-3 border-t border-paper-line pt-4 sm:grid-cols-2">
            <input type="hidden" name="studentId" value={s.id} />
            <input name="fullName" placeholder="Full name" className="field" required />
            <input name="phone" placeholder="Phone, e.g. 0712345678" className="field" required />
            <input name="email" type="email" placeholder="Email (they sign in with this one)" className="field" />
            <select name="relationship" className="field">{["Father", "Mother", "Sponsor", "Guardian"].map((r) => <option key={r}>{r}</option>)}</select>
            <SubmitButton className="w-full sm:w-auto">Add guardian</SubmitButton>
          </ActionForm>
        )}
      </section>

      <section className="card mt-6 p-5">
        <h2 className="font-display text-lg font-bold">Report cards</h2>
        {reports.length === 0 ? <p className="mt-2 text-ink-mute">No results entered yet.</p> : (
          <ul className="mt-3 space-y-1.5 text-sm">{reports.map((r) => <li key={`${r.termId}-${r.exam}`}><a className="font-medium underline underline-offset-4" href={`/api/report-card/${s.uuid}/${r.termId}/${encodeURIComponent(r.exam)}`}>{r.year} {r.term} · {r.exam} (PDF)</a></li>)}</ul>
        )}
      </section>
    </>
  );
}
