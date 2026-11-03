import { Suspense } from "react";
import { and, count, eq, gte, sql } from "drizzle-orm";
import { LuLayoutDashboard } from "react-icons/lu";
import { db } from "@/db";
import { attendance, classes, expenses, invoices, staff, students, terms } from "@/db/schema";
import { BarChart, HBars, Stat, monthKeys } from "@/components/charts";
import { PageTitle } from "@/components/Shell";
import { Skeleton } from "@/components/skeleton";
import { kes } from "@/lib/money";

export default async function Overview() {
  const [term] = await db.select().from(terms).where(eq(terms.isCurrent, true));
  return (
    <>
      <PageTitle title="Overview" sub={term ? `Current term: ${term.termName}` : "No current term set. Create one under Academics."} back={null} icon={<LuLayoutDashboard />} />
      <Suspense fallback={<StatsSkeleton />}><StatsRow termId={term?.id} /></Suspense>
      <Suspense fallback={<ChartsSkeleton />}><Charts /></Suspense>
    </>
  );
}

const StatsSkeleton = () => <div className="grid grid-cols-2 gap-4 lg:grid-cols-5" role="status" aria-busy="true">{Array.from({ length: 5 }).map((_, i) => <div key={i} className="card p-4"><Skeleton className="h-3.5 w-20" /><Skeleton className="mt-3 h-7 w-28" /></div>)}</div>;
const ChartsSkeleton = () => <div className="mt-6 grid gap-6 lg:grid-cols-2" role="status" aria-busy="true">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="card p-5"><Skeleton className="h-5 w-44" /><Skeleton className="mt-5 h-44 w-full" /></div>)}</div>;

async function StatsRow({ termId }: { termId?: number }) {
  const today = new Date().toISOString().slice(0, 10);
  const yearStart = `${new Date().getFullYear()}-01-01`;
  const [[active], [staffN], [fin], [overdue], [att], [admThis]] = await Promise.all([
    db.select({ n: count() }).from(students).where(eq(students.status, "active")),
    db.select({ n: count() }).from(staff).where(eq(staff.status, "active")),
    db.select({ billed: sql<string>`coalesce(sum(${invoices.totalAmount}),0)`, paid: sql<string>`coalesce(sum(${invoices.amountPaid}),0)` }).from(invoices).where(termId ? eq(invoices.termId, termId) : undefined),
    db.select({ n: count() }).from(invoices).where(and(eq(invoices.status, "overdue"), termId ? eq(invoices.termId, termId) : undefined)),
    db.select({ marked: count(), present: sql<number>`count(*) filter (where ${attendance.status} in ('present','late'))` }).from(attendance).where(eq(attendance.date, today)),
    db.select({ n: count() }).from(students).where(gte(students.admittedOn, yearStart)),
  ]);
  const billed = Number(fin.billed), paid = Number(fin.paid);
  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
      <Stat label="Active students" value={String(active.n)} hint={`${admThis.n} admitted this year`} />
      <Stat label="Staff" value={String(staffN.n)} />
      <Stat label="Fees collected" value={kes(paid)} hint={billed ? `${Math.round((paid / billed) * 100)}% of ${kes(billed)}` : "No invoices yet"} />
      <Stat label="Pending balance" value={kes(Math.max(billed - paid, 0))} hint={`${overdue.n} overdue invoices`} warn={overdue.n > 0} />
      <Stat label="Present today" value={att.marked ? `${Math.round((Number(att.present) / att.marked) * 100)}%` : "-"} hint={`${att.present} of ${att.marked} marked`} />
    </div>
  );
}

async function Charts() {
  const yearStart = `${new Date().getFullYear()}-01-01`, lastYearStart = `${new Date().getFullYear() - 1}-01-01`;
  const since14 = new Date(Date.now() - 14 * 864e5).toISOString().slice(0, 10);
  const months12 = monthKeys(12), months6 = monthKeys(6);
  const [trend, expCat, expMonth, admMonth, [admThis], [admLast], perGrade] = await Promise.all([
    db.select({ date: attendance.date, pct: sql<number>`round(100.0 * count(*) filter (where ${attendance.status} in ('present','late')) / count(*))` }).from(attendance).where(gte(attendance.date, since14)).groupBy(attendance.date).orderBy(attendance.date),
    db.select({ category: expenses.category, total: sql<string>`sum(${expenses.amount})` }).from(expenses).where(gte(expenses.expenseDate, yearStart)).groupBy(expenses.category).orderBy(sql`sum(${expenses.amount}) desc`).limit(6),
    db.select({ m: sql<string>`to_char(${expenses.expenseDate}, 'YYYY-MM')`, total: sql<string>`sum(${expenses.amount})` }).from(expenses).where(gte(expenses.expenseDate, months6[0].key + "-01")).groupBy(sql`1`),
    db.select({ m: sql<string>`to_char(${students.admittedOn}, 'YYYY-MM')`, n: count() }).from(students).where(gte(students.admittedOn, months12[0].key + "-01")).groupBy(sql`1`),
    db.select({ n: count() }).from(students).where(gte(students.admittedOn, yearStart)),
    db.select({ n: count() }).from(students).where(and(gte(students.admittedOn, lastYearStart), sql`${students.admittedOn} < ${yearStart}`)),
    db.select({ name: classes.className, level: classes.level, n: count(students.id) }).from(classes).leftJoin(students, and(eq(students.classId, classes.id), eq(students.status, "active"))).groupBy(classes.id).orderBy(classes.level),
  ]);
  const growth = admLast.n ? Math.round(((admThis.n - admLast.n) / admLast.n) * 100) : null;
  const expTotal = expCat.reduce((s, e) => s + Number(e.total), 0);

  return (
    <div className="mt-6 grid gap-6 lg:grid-cols-2">
      <section className="card p-5">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div><h2 className="font-display text-lg font-bold text-oxblood">Admissions, last 12 months</h2><p className="text-sm text-ink-mute">New students by month admitted</p></div>
          <div className="clay-tile px-3 py-1.5 text-right"><p className="font-display text-lg font-bold leading-none">{admThis.n}</p><p className="text-[10px] text-ink-mute">{growth === null ? "this year" : `${growth >= 0 ? "+" : ""}${growth}% vs last year`}</p></div>
        </div>
        <BarChart label="Admissions per month" data={months12.map((m) => ({ label: m.label, value: admMonth.find((a) => a.m === m.key)?.n ?? 0 }))} fmt={(n) => String(n)} />
      </section>
      <section className="card p-5">
        <h2 className="font-display text-lg font-bold text-oxblood">Students per grade</h2><p className="mb-4 text-sm text-ink-mute">Active enrolment</p>
        <BarChart label="Students per grade" tone="sand" data={perGrade.map((g) => ({ label: g.name.replace("Grade ", "G"), value: g.n }))} fmt={(n) => String(n)} />
      </section>
      <section className="card p-5">
        <h2 className="font-display text-lg font-bold text-oxblood">Spending by category</h2><p className="mb-4 text-sm text-ink-mute">This year · total {kes(expTotal)}</p>
        {expCat.length === 0 ? <p className="text-ink-mute">No expenses recorded yet. Add some under Finance → Expenses.</p> : <HBars label="Spending by category" data={expCat.map((e) => ({ label: e.category, value: Number(e.total) }))} fmt={(n) => kes(n).replace(".00", "")} />}
      </section>
      <section className="card p-5">
        <h2 className="font-display text-lg font-bold text-oxblood">Monthly spending</h2><p className="mb-4 text-sm text-ink-mute">Last 6 months</p>
        <BarChart label="Monthly spending" data={months6.map((m) => ({ label: m.label, value: Number(expMonth.find((e) => e.m === m.key)?.total ?? 0) }))} />
      </section>
      <section className="card p-5 lg:col-span-2">
        <h2 className="font-display text-lg font-bold text-oxblood">Attendance, last 14 days</h2>
        {trend.length === 0 ? <p className="mt-2 text-ink-mute">No attendance recorded yet.</p> : <div className="mt-4"><BarChart label="Daily attendance %" fmt={(n) => `${n}%`} data={trend.map((t) => ({ label: t.date.slice(8), value: Number(t.pct) }))} /></div>}
      </section>
    </div>
  );
}
