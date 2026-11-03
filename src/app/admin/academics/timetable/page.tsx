import { LuCalendarDays } from "react-icons/lu";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { academicYears, classes, staff, streams, subjects, terms, timetableSlots } from "@/db/schema";
import { TimetableGrid } from "@/components/TimetableGrid";
import { ACADEMIC_TABS, PageTitle, Tabs } from "@/components/Shell";
import { ActionForm, PrintButton, SubmitButton } from "@/components/ui";
import { CAN, requireRole } from "@/lib/auth";
import { clearTimetable, generateTimetable } from "../../_actions/timetable";

export default async function TimetablePage({ searchParams }: { searchParams: Promise<{ term?: string; view?: string; sec?: string; t?: string }> }) {
  const me = await requireRole(["admin", "principal"]);
  const canEdit = CAN.manageSchool.includes(me.role);
  const sp = await searchParams;

  const [allTerms, cls, strs, teachers, subs] = await Promise.all([
    db.select({ id: terms.id, name: terms.termName, year: academicYears.year, cur: terms.isCurrent }).from(terms).innerJoin(academicYears, eq(academicYears.id, terms.academicYearId)).orderBy(academicYears.year, terms.startDate),
    db.select().from(classes).orderBy(classes.level), db.select().from(streams).orderBy(streams.stream),
    db.select().from(staff).where(eq(staff.status, "active")).orderBy(staff.name), db.select().from(subjects),
  ]);
  const term = allTerms.find((t) => t.id === Number(sp.term)) ?? allTerms.find((t) => t.cur) ?? allTerms.at(-1);
  const sections = cls.flatMap((c) => { const m = strs.filter((s) => s.classId === c.id); return m.length ? m.map((s) => ({ key: `${c.id}:${s.id}`, classId: c.id, streamKey: s.id, label: `${c.className} ${s.stream}` })) : [{ key: `${c.id}:0`, classId: c.id, streamKey: 0, label: c.className }]; });
  const view = sp.view === "teacher" ? "teacher" : "class";
  const sec = sections.find((s) => s.key === sp.sec) ?? sections[0];
  const teacher = teachers.find((t) => t.id === Number(sp.t)) ?? teachers[0];

  const slots = term ? await db.select().from(timetableSlots).where(and(eq(timetableSlots.termId, term.id), view === "teacher" ? (teacher ? eq(timetableSlots.teacherId, teacher.id) : undefined) : (sec ? and(eq(timetableSlots.classId, sec.classId), eq(timetableSlots.streamKey, sec.streamKey)) : undefined))) : [];
  const map = new Map(slots.map((s) => [`${s.day}:${s.period}`, s]));
  const subName = new Map(subs.map((s) => [s.id, s.name]));
  const tName = new Map(teachers.map((t) => [t.id, t.name]));
  const secLabel = (classId: number, streamId: number | null) => sections.find((s) => s.classId === classId && s.streamKey === (streamId ?? 0))?.label ?? "";
  const short = (n?: string) => { const p = (n ?? "").split(" "); return p.length > 1 ? `${p[0][0]}. ${p.slice(1).join(" ")}` : n ?? ""; };

  return (
    <>
      <PageTitle icon={<LuCalendarDays />} title="Academics" sub="Automatic timetables with no double-booked teachers or classes" back="/admin/academics"><PrintButton label="Print timetable" /></PageTitle>
      <Tabs tabs={ACADEMIC_TABS} current="/admin/academics/timetable" />

      {canEdit && term && (
        <section className="card mb-6 p-5 print:hidden">
          <h2 className="font-display text-lg font-bold">Generate timetable</h2>
          <p className="mb-3 text-sm text-ink-mute">Uses each subject&apos;s lessons per week and the teachers assigned to every grade and stream. Regenerating replaces the existing timetable for the chosen scope.</p>
          <ActionForm action={generateTimetable} className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
            <div><label className="label" htmlFor="gt">Term</label><select id="gt" name="termId" defaultValue={term.id} className="field">{allTerms.map((t) => <option key={t.id} value={t.id}>{t.year} · {t.name}</option>)}</select></div>
            <div><label className="label" htmlFor="gc">Scope</label><select id="gc" name="classId" defaultValue="all" className="field"><option value="all">All grades</option>{cls.map((c) => <option key={c.id} value={c.id}>{c.className}</option>)}</select></div>
            <SubmitButton pendingText="Generating…" className="w-full sm:w-auto">Generate</SubmitButton>
          </ActionForm>
          <ActionForm action={clearTimetable} className="mt-3 flex flex-wrap items-center gap-2"><input type="hidden" name="termId" value={term.id} /><input type="hidden" name="classId" value="all" /><SubmitButton size="sm" variant="danger" confirm="Clear the whole timetable for this term?">Clear this term&apos;s timetable</SubmitButton></ActionForm>
        </section>
      )}

      <form className="mb-5 flex flex-wrap items-end gap-3 print:hidden">
        <div><label className="label" htmlFor="vt">Term</label><select id="vt" name="term" defaultValue={term?.id} className="field">{allTerms.map((t) => <option key={t.id} value={t.id}>{t.year} · {t.name}</option>)}</select></div>
        <div><label className="label" htmlFor="vv">View</label><select id="vv" name="view" defaultValue={view} className="field"><option value="class">By class / stream</option><option value="teacher">By teacher</option></select></div>
        {view === "class" ? <div><label className="label" htmlFor="vs">Class &amp; stream</label><select id="vs" name="sec" defaultValue={sec?.key} className="field">{sections.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}</select></div>
          : <div><label className="label" htmlFor="vtc">Teacher</label><select id="vtc" name="t" defaultValue={teacher?.id} className="field">{teachers.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select></div>}
        <button className="btn-ghost">Show</button>
      </form>

      <h2 className="mb-3 font-display text-lg font-bold">{view === "class" ? sec?.label : teacher?.name} · {term ? `${term.year} ${term.name}` : ""}</h2>
      {slots.length === 0 && <p className="mb-4 rounded-2xl bg-bus-soft px-4 py-3 text-sm print:hidden">No lessons scheduled here yet. {canEdit ? "Assign teachers to subjects, then press Generate." : ""}</p>}
      <TimetableGrid cell={(d, p) => {
        const s = map.get(`${d}:${p}`);
        if (!s) return null;
        return view === "class" ? { title: subName.get(s.subjectId) ?? "", sub: short(tName.get(s.teacherId)), tint: s.subjectId } : { title: subName.get(s.subjectId) ?? "", sub: secLabel(s.classId, s.streamId), tint: s.subjectId };
      }} />
    </>
  );
}
