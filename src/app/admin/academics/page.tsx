import { LuBookOpen } from "react-icons/lu";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { academicYears, terms } from "@/db/schema";
import { ACADEMIC_TABS, PageTitle, Tabs } from "@/components/Shell";
import { ActionForm, SubmitButton } from "@/components/ui";
import { CAN, requireRole } from "@/lib/auth";
import { fmtDate } from "@/lib/constants";
import { createTerm } from "../_actions/school";

export default async function Academics() {
  const s = await requireRole(["admin", "principal"]);
  const canEdit = CAN.manageSchool.includes(s.role);
  const ts = await db.select({ id: terms.id, name: terms.termName, year: academicYears.year, cur: terms.isCurrent, s: terms.startDate, e: terms.endDate })
    .from(terms).innerJoin(academicYears, eq(academicYears.id, terms.academicYearId)).orderBy(academicYears.year, terms.startDate);

  return (
    <>
      <PageTitle icon={<LuBookOpen />} title="Academics" sub="Terms, subjects, teachers and timetables" back="/admin" />
      <Tabs tabs={ACADEMIC_TABS} current="/admin/academics" />
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="card p-5">
          <h2 className="font-display text-lg font-bold">Terms</h2>
          <ul className="mt-3 divide-y divide-paper-line/70 text-sm">
            {ts.map((t) => <li key={t.id} className="flex flex-wrap justify-between gap-2 py-2.5"><span>{t.year} · {t.name} {t.cur && <span className="chip ml-1 text-bus-deep">current</span>}</span><span className="text-ink-mute">{fmtDate(t.s)} → {fmtDate(t.e)}</span></li>)}
            {ts.length === 0 && <li className="py-2 text-ink-mute">No terms yet.</li>}
          </ul>
        </section>
        {canEdit && (
          <ActionForm action={createTerm} className="card grid grid-cols-2 gap-3 p-5">
            <h2 className="col-span-2 font-display text-lg font-bold">Add or update a term</h2>
            <div><label className="label" htmlFor="y">Year</label><input id="y" name="year" type="number" defaultValue={new Date().getFullYear()} className="field" required /></div>
            <div><label className="label" htmlFor="n">Term name</label><input id="n" name="termName" placeholder="Term 1" className="field" required /></div>
            <div><label className="label" htmlFor="s">Start date</label><input id="s" name="startDate" type="date" className="field" required /></div>
            <div><label className="label" htmlFor="e">End date</label><input id="e" name="endDate" type="date" className="field" required /></div>
            <label className="col-span-2 flex items-center gap-2 text-sm"><input type="checkbox" name="isCurrent" className="h-4 w-4 accent-[#550605]" /> Make this the current term</label>
            <SubmitButton className="col-span-2 sm:col-span-1">Save term</SubmitButton>
          </ActionForm>
        )}
      </div>
    </>
  );
}
