import { desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { academicYears, broadcasts, classes, guardians, invoices, studentGuardian, students, terms } from "@/db/schema";
import { BroadcastForm, type Aud } from "@/components/BroadcastForm";
import { LuSend } from "react-icons/lu";
import { FINANCE_TABS, PageTitle, Tabs } from "@/components/Shell";
import { CAN, requireRole } from "@/lib/auth";
import { fmtDate } from "@/lib/constants";

export const maxDuration = 60; // sending many emails/texts can take a while

export default async function BroadcastPage({ searchParams }: { searchParams: Promise<{ year?: string; term?: string }> }) {
  await requireRole(CAN.manageFinance);
  const sp = await searchParams;
  const [allTerms, cls, history] = await Promise.all([
    db.select({ id: terms.id, name: terms.termName, year: academicYears.year, cur: terms.isCurrent }).from(terms).innerJoin(academicYears, eq(academicYears.id, terms.academicYearId)).orderBy(desc(academicYears.year), desc(terms.startDate)),
    db.select().from(classes).orderBy(classes.level),
    db.select({ b: broadcasts, cls: classes.className, term: terms.termName }).from(broadcasts).leftJoin(classes, eq(classes.id, broadcasts.classId)).leftJoin(terms, eq(terms.id, broadcasts.termId)).orderBy(desc(broadcasts.id)).limit(8),
  ]);
  const years = [...new Set(allTerms.map((t) => t.year))];
  const wantYear = Number(sp.year) || allTerms.find((t) => t.cur)?.year || years[0];
  const term = (sp.term ? allTerms.find((t) => t.year === wantYear && t.name === `Term ${Number(sp.term)}`) : undefined) ?? allTerms.find((t) => t.cur) ?? allTerms[0];

  const stats: Record<string, Aud> = {};
  if (term) {
    const rows = await db.select({
      classId: students.classId,
      allInv: sql<number>`count(distinct ${invoices.id})`, openInv: sql<number>`count(distinct ${invoices.id}) filter (where ${invoices.status} <> 'paid')`,
      allEm: sql<number>`count(distinct ${guardians.id}) filter (where ${guardians.email} is not null)`, openEm: sql<number>`count(distinct ${guardians.id}) filter (where ${guardians.email} is not null and ${invoices.status} <> 'paid')`,
      allPh: sql<number>`count(distinct ${guardians.id})`, openPh: sql<number>`count(distinct ${guardians.id}) filter (where ${invoices.status} <> 'paid')`,
    }).from(invoices).innerJoin(students, eq(students.id, invoices.studentId))
      .innerJoin(studentGuardian, eq(studentGuardian.studentId, students.id)).innerJoin(guardians, eq(guardians.id, studentGuardian.guardianId))
      .where(sql`${invoices.termId} = ${term.id} and ${students.status} = 'active'`).groupBy(students.classId);
    const sum = { open: { invoices: 0, emails: 0, phones: 0 }, all: { invoices: 0, emails: 0, phones: 0 } };
    for (const r of rows) {
      stats[String(r.classId)] = { open: { invoices: Number(r.openInv), emails: Number(r.openEm), phones: Number(r.openPh) }, all: { invoices: Number(r.allInv), emails: Number(r.allEm), phones: Number(r.allPh) } };
      sum.open.invoices += Number(r.openInv); sum.open.emails += Number(r.openEm); sum.open.phones += Number(r.openPh);
      sum.all.invoices += Number(r.allInv); sum.all.emails += Number(r.allEm); sum.all.phones += Number(r.allPh);
    }
    stats.all = sum;
  }

  return (
    <>
      <PageTitle title="Finance" sub="Send invoices to parents by grade or to everyone" back="/admin" icon={<LuSend />} />
      <Tabs tabs={FINANCE_TABS} current="/admin/fees/broadcast" />
      <form className="mb-5 flex flex-wrap items-end gap-3">
        <div><label className="label" htmlFor="y">Year</label><select id="y" name="year" defaultValue={term?.year} className="field">{years.map((y) => <option key={y} value={y}>{y}</option>)}</select></div>
        <div><label className="label" htmlFor="t">Term</label><select id="t" name="term" defaultValue={term ? term.name.replace("Term ", "") : ""} className="field">{[1, 2, 3].map((n) => <option key={n} value={n}>Term {n}</option>)}</select></div>
        <button className="btn-ghost">Load</button>
      </form>
      {term ? <BroadcastForm key={term.id} termId={term.id} classes={cls.map((c) => ({ id: c.id, name: c.className }))} stats={stats} /> : <p className="card p-6 text-ink-mute">Create a term and generate invoices first.</p>}

      <section className="card mt-6 p-5">
        <h2 className="font-display text-lg font-bold">Recent broadcasts</h2>
        <ul className="mt-3 divide-y divide-paper-line/70 text-sm">
          {history.map(({ b, cls: c, term: t }) => <li key={b.id} className="flex flex-wrap justify-between gap-2 py-2.5"><span>{fmtDate(b.createdAt)} · {t ?? "-"} · {c ?? "All grades"} · {b.channel}</span><span className="text-ink-mute">{b.invoicesCount} invoices · {b.messagesCount} messages</span></li>)}
          {history.length === 0 && <li className="py-2 text-ink-mute">Nothing sent yet.</li>}
        </ul>
      </section>
    </>
  );
}
