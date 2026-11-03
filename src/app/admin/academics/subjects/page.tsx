import Link from "next/link";
import { eq } from "drizzle-orm";
import { LuBookOpen } from "react-icons/lu";
import { db } from "@/db";
import { classes, staff, staffAttendance, staffGrades, staffSubjects, streams, subjects } from "@/db/schema";
import { ACADEMIC_TABS, PageTitle, Tabs } from "@/components/Shell";
import { ActionForm, SubmitButton } from "@/components/ui";
import { CAN, requireRole } from "@/lib/auth";
import { effectiveAssignments } from "@/lib/assignments";
import { timeEAT, todayEAT } from "@/lib/constants";
import { assignTeacher, createSubject, loadCbcSubjects, removeAssignment, updateSubject } from "../../_actions/school";

export default async function SubjectsPage({ searchParams }: { searchParams: Promise<{ subject?: string }> }) {
  const me = await requireRole(["admin", "principal"]);
  const canEdit = CAN.manageSchool.includes(me.role);
  const sp = await searchParams;

  const [subs, cls, strs, teachers, eff, ss, sg, att] = await Promise.all([
    db.select().from(subjects).orderBy(subjects.category, subjects.name), db.select().from(classes).orderBy(classes.level), db.select().from(streams).orderBy(streams.stream),
    db.select().from(staff).where(eq(staff.status, "active")).orderBy(staff.name), effectiveAssignments(),
    db.select().from(staffSubjects), db.select().from(staffGrades), db.select().from(staffAttendance).where(eq(staffAttendance.date, todayEAT())),
  ]);
  const sel = subs.find((s) => s.id === Number(sp.subject));
  const tOf = new Map(teachers.map((t) => [t.id, t]));
  const effSel = sel ? eff.filter((a) => a.subjectId === sel.id) : [];
  const profileTeachers = sel ? ss.filter((x) => x.subjectId === sel.id).map((x) => tOf.get(x.staffId)).filter((t): t is NonNullable<typeof t> => !!t) : [];

  const groups = [...new Set(subs.map((s) => s.category ?? "Other"))];
  const coverage = sel ? cls.filter((c) => c.level >= sel.minGrade && c.level <= sel.maxGrade).flatMap((c) => {
    const sections = strs.filter((x) => x.classId === c.id);
    return (sections.length ? sections : [null]).map((st) => ({ label: `${c.className}${st ? " " + st.stream : ""}`, a: effSel.find((r) => r.classId === c.id && (r.streamId === (st?.id ?? null) || r.streamId === null)) }));
  }) : [];
  const gaps = coverage.filter((c) => !c.a).length;
  const presence = (id: number) => { const a = att.find((x) => x.staffId === id); return !a ? "not clocked in" : a.clockOut ? `left ${timeEAT(a.clockOut)}` : `active, in ${timeEAT(a.clockIn)}`; };

  return (
    <>
      <PageTitle title="Academics" sub="CBC learning areas and who teaches them" back="/admin/academics" icon={<LuBookOpen />} />
      <Tabs tabs={ACADEMIC_TABS} current="/admin/academics/subjects" />

      {subs.length === 0 && canEdit && (
        <ActionForm action={loadCbcSubjects} className="card mb-6 flex flex-wrap items-center gap-4 p-5">
          <p className="flex-1 text-sm">No subjects yet. Load all CBC learning areas for Grade 1 to 12 in one click.</p><SubmitButton pendingText="Loading…">Load CBC subjects</SubmitButton>
        </ActionForm>
      )}

      <div className="grid gap-6 lg:grid-cols-[300px_1fr]">
        <aside className="card max-h-[75vh] overflow-auto p-3">
          {groups.map((g) => (
            <details key={g} open={!sel || sel.category === g || groups.length < 3} className="mb-1">
              <summary className="cursor-pointer px-3 py-2 text-xs font-semibold uppercase tracking-wide text-ink-mute hover:bg-paper-dark/40">{g}</summary>
              <ul>{subs.filter((s) => (s.category ?? "Other") === g).map((s) => (
                <li key={s.id}><Link href={`/admin/academics/subjects?subject=${s.id}`} aria-current={sel?.id === s.id ? "page" : undefined}
                  className={`block px-3 py-2 text-sm ${sel?.id === s.id ? "bg-brand font-semibold text-white" : "hover:bg-paper-dark/40"}`}>{s.name}<span className="block text-[11px] opacity-70">Gr {s.minGrade}-{s.maxGrade} · {s.periodsPerWeek}/wk</span></Link></li>
              ))}</ul>
            </details>
          ))}
          {subs.length > 0 && canEdit && <ActionForm action={loadCbcSubjects} className="mt-3 border-t border-paper-line p-2"><SubmitButton size="sm" variant="ghost" className="w-full">Add any missing CBC subjects</SubmitButton></ActionForm>}
        </aside>

        <div className="space-y-6">
          {!sel ? <div className="card p-8 text-center text-ink-mute">Select a subject on the left to see its details, teachers and coverage.</div> : (
            <>
              <section className="card p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div><h2 className="font-display text-2xl font-bold text-oxblood">{sel.name}</h2><p className="text-sm text-ink-mute">{sel.category} · code {sel.subjectCode}</p></div>
                  <span className={`chip ${gaps ? "text-alert" : "text-ok"}`}>{gaps ? `${gaps} class(es) without a teacher` : "All classes covered"}</span>
                </div>
                <dl className="mt-4 grid grid-cols-3 gap-3 text-sm">
                  <div className="clay-tile p-3"><dt className="text-ink-mute">Grades</dt><dd className="font-display text-lg font-bold">{sel.minGrade}–{sel.maxGrade}</dd></div>
                  <div className="clay-tile p-3"><dt className="text-ink-mute">Lessons / week</dt><dd className="font-display text-lg font-bold">{sel.periodsPerWeek}</dd></div>
                  <div className="clay-tile p-3"><dt className="text-ink-mute">Teachers</dt><dd className="font-display text-lg font-bold">{new Set([...effSel.map((r) => r.teacherId), ...profileTeachers.map((t) => t.id)]).size}</dd></div>
                </dl>
                {canEdit && (
                  <ActionForm action={updateSubject} className="mt-4 grid grid-cols-2 gap-3 border-t border-paper-line pt-4 sm:grid-cols-[1fr_90px_90px_110px_auto] sm:items-end">
                    <input type="hidden" name="id" value={sel.id} />
                    <div className="col-span-2 sm:col-span-1"><label className="label">Name</label><input name="name" defaultValue={sel.name} className="field" required /></div>
                    <div><label className="label">From Gr</label><input name="minGrade" type="number" min={1} max={12} defaultValue={sel.minGrade} className="field" /></div>
                    <div><label className="label">To Gr</label><input name="maxGrade" type="number" min={1} max={12} defaultValue={sel.maxGrade} className="field" /></div>
                    <div><label className="label">Lessons/wk</label><input name="periodsPerWeek" type="number" min={1} max={10} defaultValue={sel.periodsPerWeek} className="field" /></div>
                    <SubmitButton size="sm" variant="ghost">Save</SubmitButton>
                  </ActionForm>
                )}
              </section>

              <section className="card p-5">
                <h3 className="font-display text-lg font-bold text-oxblood">Teachers who teach this subject</h3>
                <p className="mb-3 text-xs text-ink-mute">Read from each teacher&apos;s staff profile, so changes made on the Staff page appear here straight away.</p>
                <ul className="divide-y divide-paper-line/70 text-sm">
                  {profileTeachers.map((t) => {
                    const gs = sg.filter((x) => x.staffId === t.id).map((x) => cls.find((c) => c.id === x.classId)?.className.replace("Grade ", "Gr ")).filter(Boolean);
                    return (
                      <li key={t.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                        <span className="font-medium">{t.name} <span className="chip ml-1">{t.employmentType ?? t.kind}</span></span>
                        <span className="text-xs text-ink-mute">{gs.length ? gs.join(", ") : "No grades chosen on profile"} · {t.department ?? "no department"} · {presence(t.id)}</span>
                      </li>
                    );
                  })}
                  {profileTeachers.length === 0 && <li className="py-2 text-ink-mute">No teacher has this subject on their profile yet. Add it under Staff → Edit.</li>}
                </ul>
              </section>

              <section className="card p-5">
                <h3 className="font-display text-lg font-bold text-oxblood">Who teaches each class</h3>
                <ul className="mt-3 divide-y divide-paper-line/70 text-sm">
                  {coverage.map((c) => {
                    const t = c.a ? tOf.get(c.a.teacherId) : undefined;
                    return (
                      <li key={c.label} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                        <span className="font-medium">{c.label}</span>
                        {c.a ? (<span className="flex flex-wrap items-center gap-3"><span>{t?.name ?? "Unknown"}<span className="ml-2 text-xs text-ink-mute">{t?.phone ?? ""}{t?.tscNumber ? ` · TSC ${t.tscNumber}` : ""}</span> <span className="chip ml-1">{c.a.source === "profile" ? "from profile" : "manual"}</span></span>
                          {canEdit && c.a.source === "manual" && c.a.manualId && <ActionForm action={removeAssignment}><input type="hidden" name="id" value={c.a.manualId} /><SubmitButton size="sm" variant="danger" confirm="Remove this manual assignment?">Remove</SubmitButton></ActionForm>}</span>)
                          : <span className="text-alert">No teacher assigned</span>}
                      </li>
                    );
                  })}
                  {coverage.length === 0 && <li className="py-2 text-ink-mute">No classes exist for grades {sel.minGrade}–{sel.maxGrade}.</li>}
                </ul>
                {canEdit && (
                  <ActionForm action={assignTeacher} resetOnSuccess className="mt-4 grid gap-3 border-t border-paper-line pt-4 sm:grid-cols-2">
                    <input type="hidden" name="subjectId" value={sel.id} />
                    <h4 className="font-semibold sm:col-span-2">Manually assign a teacher (overrides the profile)</h4>
                    <select name="teacherId" className="field" required defaultValue="" aria-label="Teacher"><option value="" disabled>Teacher…</option>{teachers.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select>
                    <select name="classId" className="field" required defaultValue="" aria-label="Grade"><option value="" disabled>Grade…</option>{cls.filter((c) => c.level >= sel.minGrade && c.level <= sel.maxGrade).map((c) => <option key={c.id} value={c.id}>{c.className}</option>)}</select>
                    <select name="streamId" className="field sm:col-span-2" defaultValue="" aria-label="Stream"><option value="">All streams of that grade</option>{strs.filter((x) => { const c = cls.find((k) => k.id === x.classId); return c && c.level >= sel.minGrade && c.level <= sel.maxGrade; }).map((x) => <option key={x.id} value={x.id}>{cls.find((k) => k.id === x.classId)?.className} · {x.stream} only</option>)}</select>
                    <SubmitButton className="w-full sm:w-auto">Assign</SubmitButton>
                  </ActionForm>
                )}
              </section>
            </>
          )}

          {canEdit && (
            <ActionForm action={createSubject} resetOnSuccess className="card grid gap-3 p-5 sm:grid-cols-2">
              <h3 className="font-display text-lg font-bold text-oxblood sm:col-span-2">Add a custom subject</h3>
              <input name="subjectCode" placeholder="Code, e.g. SS-ROB" className="field" required /><input name="name" placeholder="Subject name" className="field" required />
              <input name="category" placeholder="Category (optional)" className="field" />
              <div className="grid grid-cols-3 gap-2"><input name="minGrade" type="number" min={1} max={12} defaultValue={1} className="field" aria-label="From grade" /><input name="maxGrade" type="number" min={1} max={12} defaultValue={12} className="field" aria-label="To grade" /><input name="periodsPerWeek" type="number" min={1} max={10} defaultValue={3} className="field" aria-label="Lessons per week" /></div>
              <SubmitButton className="w-full sm:w-auto">Add subject</SubmitButton>
            </ActionForm>
          )}
        </div>
      </div>
    </>
  );
}
