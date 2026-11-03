import Link from "next/link";
import { eq } from "drizzle-orm";
import { LuUsers } from "react-icons/lu";
import { db } from "@/db";
import { classes, staff, staffAttendance, staffGrades, staffSubjects, streams, subjects } from "@/db/schema";
import { ACADEMIC_TABS, PageTitle, Tabs } from "@/components/Shell";
import { requireRole } from "@/lib/auth";
import { effectiveAssignments } from "@/lib/assignments";
import { todayEAT } from "@/lib/constants";

const VIEWS = [["teacher", "By teacher"], ["subject", "By subject"], ["grade", "By grade"]] as const;

export default async function TeachersPage({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  await requireRole(["admin", "principal"]);
  const sp = await searchParams;
  const view = VIEWS.some(([k]) => k === sp.view) ? sp.view! : "teacher";

  const [eff, teachers, subs, cls, strs, ss, sg, att] = await Promise.all([
    effectiveAssignments(), db.select().from(staff).where(eq(staff.status, "active")).orderBy(staff.name), db.select().from(subjects), db.select().from(classes).orderBy(classes.level), db.select().from(streams),
    db.select().from(staffSubjects), db.select().from(staffGrades), db.select().from(staffAttendance).where(eq(staffAttendance.date, todayEAT())),
  ]);
  const tOf = new Map(teachers.map((t) => [t.id, t])), sOf = new Map(subs.map((s) => [s.id, s])), cOf = new Map(cls.map((c) => [c.id, c]));
  const where = (a: (typeof eff)[number]) => `${cOf.get(a.classId)?.className ?? ""}${a.streamId ? " " + (strs.find((x) => x.id === a.streamId)?.stream ?? "") : ""}`;
  const active = new Set(att.filter((a) => !a.clockOut).map((a) => a.staffId));

  return (
    <>
      <PageTitle title="Academics" sub="Teachers grouped by what and where they teach" back="/admin/academics" icon={<LuUsers />} />
      <Tabs tabs={ACADEMIC_TABS} current="/admin/academics/teachers" />
      <nav className="mb-5 flex gap-2" aria-label="Group by">{VIEWS.map(([k, l]) => <Link key={k} href={`/admin/academics/teachers?view=${k}`} className={`chip ${view === k ? "!bg-bus-soft !text-bus-deep" : ""}`}>{l}</Link>)}</nav>

      {view === "teacher" && (
        <div className="grid gap-4 md:grid-cols-2">
          {teachers.filter((t) => t.kind === "teaching").map((t) => {
            const mine = eff.filter((a) => a.teacherId === t.id);
            const lessons = mine.reduce((n, a) => n + (sOf.get(a.subjectId)?.periodsPerWeek ?? 0), 0);
            const profSubs = ss.filter((x) => x.staffId === t.id).map((x) => sOf.get(x.subjectId)?.name).filter(Boolean) as string[];
            const profGrades = sg.filter((x) => x.staffId === t.id).map((x) => cOf.get(x.classId)?.className.replace("Grade ", "Gr ")).filter(Boolean) as string[];
            return (
              <section key={t.id} className="card p-5">
                <div className="flex items-start justify-between gap-3">
                  <div><h2 className="font-display text-lg font-bold text-oxblood">{t.name}</h2><p className="text-xs text-ink-mute">{t.employmentType ?? "-"}{t.tscNumber ? ` · TSC ${t.tscNumber}` : ""} · {t.department ?? "no department"} · {active.has(t.id) ? "active today" : "not clocked in"}</p></div>
                  <span className={`chip ${lessons > 40 ? "text-alert" : ""}`}>{lessons} lessons/wk</span>
                </div>
                <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-ink-mute">Subjects</p>
                <div className="mt-1 flex flex-wrap gap-1.5">{profSubs.length ? profSubs.map((s) => <span key={s} className="chip">{s}</span>) : <span className="text-sm text-ink-mute">None on profile</span>}</div>
                <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-ink-mute">Grades on profile</p>
                <div className="mt-1 flex flex-wrap gap-1.5">{profGrades.length ? profGrades.map((s) => <span key={s} className="chip">{s}</span>) : <span className="text-sm text-alert">None chosen</span>}</div>
                <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-ink-mute">Classes &amp; streams they will teach</p>
                <div className="mt-1 flex flex-wrap gap-1.5">{[...new Set(mine.map(where))].map((w) => <span key={w} className="chip">{w}</span>)}{mine.length === 0 && <span className="text-sm text-ink-mute">None yet</span>}</div>
              </section>
            );
          })}
          {teachers.filter((t) => t.kind === "teaching").length === 0 && <p className="card p-6 text-ink-mute md:col-span-2">No teaching staff yet. Add them under Staff.</p>}
        </div>
      )}

      {view === "subject" && (
        <div className="grid gap-4 md:grid-cols-2">
          {[...new Set(eff.map((r) => r.subjectId))].map((id) => {
            const mine = eff.filter((r) => r.subjectId === id);
            return (
              <section key={id} className="card p-5"><h2 className="font-display text-lg font-bold text-oxblood">{sOf.get(id)?.name}</h2><p className="text-xs text-ink-mute">{sOf.get(id)?.category}</p>
                <ul className="mt-3 space-y-1.5 text-sm">{mine.map((r, i) => <li key={i} className="flex justify-between gap-2"><span>{tOf.get(r.teacherId)?.name}</span><span className="text-ink-mute">{where(r)}</span></li>)}</ul></section>
            );
          })}
          {eff.length === 0 && <p className="card p-6 text-ink-mute md:col-span-2">No one is teaching anything yet. Add subjects and grades to teacher profiles on the Staff page.</p>}
        </div>
      )}

      {view === "grade" && (
        <div className="grid gap-4 md:grid-cols-2">
          {[...new Set(eff.map((r) => r.classId))].sort((a, b) => (cOf.get(a)?.level ?? 0) - (cOf.get(b)?.level ?? 0)).map((id) => {
            const mine = eff.filter((r) => r.classId === id);
            return (
              <section key={id} className="card p-5"><h2 className="font-display text-lg font-bold text-oxblood">{cOf.get(id)?.className}</h2>
                <ul className="mt-3 space-y-1.5 text-sm">{mine.map((r, i) => <li key={i} className="flex justify-between gap-2"><span>{sOf.get(r.subjectId)?.name}{r.streamId ? ` · ${strs.find((x) => x.id === r.streamId)?.stream}` : ""}</span><span className="text-ink-mute">{tOf.get(r.teacherId)?.name}</span></li>)}</ul></section>
            );
          })}
        </div>
      )}
    </>
  );
}
