import { LuReceipt } from "react-icons/lu";
import { and, between, desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { expenses, feePayments } from "@/db/schema";
import { BarChart, HBars, Stat, monthKeys } from "@/components/charts";
import { FINANCE_TABS, PageTitle, Tabs } from "@/components/Shell";
import { ActionForm, SubmitButton } from "@/components/ui";
import { CAN, STAFF_VIEW, getSession, requireRole } from "@/lib/auth";
import { EXPENSE_CATEGORIES, fmtDate } from "@/lib/constants";
import { kes } from "@/lib/money";
import { addExpense, deleteExpense } from "../_actions/finance";

export default async function ExpensesPage({ searchParams }: { searchParams: Promise<{ from?: string; to?: string; cat?: string }> }) {
  await requireRole(STAFF_VIEW);
  const s = await getSession();
  const canEdit = !!s && CAN.manageFinance.includes(s.role);
  const sp = await searchParams;
  const y = new Date().getFullYear();
  const from = sp.from || `${y}-01-01`, to = sp.to || `${y}-12-31`;
  const range = between(expenses.expenseDate, from, to);
  const where = and(range, sp.cat ? eq(expenses.category, sp.cat) : undefined);
  const months = monthKeys(12);

  const [list, byCat, byMonth, [paid]] = await Promise.all([
    db.select().from(expenses).where(where).orderBy(desc(expenses.expenseDate), desc(expenses.id)).limit(200),
    db.select({ category: expenses.category, total: sql<string>`sum(${expenses.amount})`, n: sql<number>`count(*)` }).from(expenses).where(range).groupBy(expenses.category).orderBy(sql`sum(${expenses.amount}) desc`),
    db.select({ m: sql<string>`to_char(${expenses.expenseDate}, 'YYYY-MM')`, total: sql<string>`sum(${expenses.amount})` }).from(expenses).where(and(sql`${expenses.expenseDate} >= ${months[0].key + "-01"}`, sp.cat ? eq(expenses.category, sp.cat) : undefined)).groupBy(sql`1`),
    db.select({ t: sql<string>`coalesce(sum(${feePayments.amountPaid}),0)` }).from(feePayments).where(sql`${feePayments.paidAt}::date between ${from} and ${to}`),
  ]);
  const spent = byCat.reduce((a, c) => a + Number(c.total), 0);
  const net = Number(paid.t) - spent;

  return (
    <>
      <PageTitle icon={<LuReceipt />} title="Finance" sub="Expense tracking and spending summaries" back="/admin" />
      <Tabs tabs={FINANCE_TABS} current="/admin/expenses" />

      <form className="mb-5 flex flex-wrap items-end gap-3">
        <div><label className="label" htmlFor="f">From</label><input id="f" type="date" name="from" defaultValue={from} className="field" /></div>
        <div><label className="label" htmlFor="t">To</label><input id="t" type="date" name="to" defaultValue={to} className="field" /></div>
        <div><label className="label" htmlFor="c">Category</label><select id="c" name="cat" defaultValue={sp.cat ?? ""} className="field"><option value="">All categories</option>{EXPENSE_CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select></div>
        <button className="btn-ghost">Apply</button>
      </form>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Total spent" value={kes(spent)} hint={`${fmtDate(from)} to ${fmtDate(to)}`} />
        <Stat label="Fees collected" value={kes(paid.t)} hint="Same period" />
        <Stat label="Net position" value={kes(net)} hint="Collected minus spent" warn={net < 0} />
        <Stat label="Top category" value={byCat[0]?.category ?? "-"} hint={byCat[0] ? kes(byCat[0].total) : undefined} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <section className="card p-5"><h2 className="font-display text-lg font-bold">By category</h2><p className="mb-4 text-sm text-ink-mute">Uniforms, meals, transport and more</p>
          {byCat.length ? <HBars label="Spending by category" data={byCat.map((c) => ({ label: `${c.category} (${c.n})`, value: Number(c.total) }))} fmt={(n) => kes(n).replace(".00", "")} /> : <p className="text-ink-mute">Nothing recorded in this period.</p>}
        </section>
        <section className="card p-5"><h2 className="font-display text-lg font-bold">Monthly trend</h2><p className="mb-4 text-sm text-ink-mute">Last 12 months{sp.cat ? ` · ${sp.cat}` : ""}</p>
          <BarChart label="Monthly spending" data={months.map((m) => ({ label: m.label, value: Number(byMonth.find((b) => b.m === m.key)?.total ?? 0) }))} />
        </section>
      </div>

      {canEdit && (
        <ActionForm action={addExpense} resetOnSuccess className="card mt-6 grid gap-3 p-5 sm:grid-cols-2 lg:grid-cols-3">
          <h2 className="font-display text-lg font-bold sm:col-span-2 lg:col-span-3">Record an expense</h2>
          <div><label className="label" htmlFor="d">Date</label><input id="d" name="expenseDate" type="date" defaultValue={new Date().toISOString().slice(0, 10)} className="field" required /></div>
          <div><label className="label" htmlFor="cat">Category</label><select id="cat" name="category" className="field" defaultValue="" required><option value="" disabled>Choose…</option>{EXPENSE_CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select></div>
          <div><label className="label" htmlFor="a">Amount (KES)</label><input id="a" name="amount" type="number" step="0.01" min="0.01" className="field" required /></div>
          <div className="lg:col-span-2"><label className="label" htmlFor="ds">Description</label><input id="ds" name="description" placeholder="e.g. 120 Grade 1 uniforms from supplier" className="field" required /></div>
          <div><label className="label" htmlFor="p">Paid to</label><input id="p" name="paidTo" className="field" /></div>
          <div><label className="label" htmlFor="r">Reference / receipt no.</label><input id="r" name="reference" className="field" /></div>
          <div className="flex items-end"><SubmitButton className="w-full sm:w-auto" pendingText="Saving…">Add expense</SubmitButton></div>
        </ActionForm>
      )}

      <div className="card mt-6 overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr><th className="th">Date</th><th className="th">Category</th><th className="th">Description</th><th className="th">Paid to</th><th className="th text-right">Amount</th><th className="th" /></tr></thead>
          <tbody className="divide-y divide-paper-line/70">
            {list.map((e) => (
              <tr key={e.id}><td className="td whitespace-nowrap">{fmtDate(e.expenseDate)}</td><td className="td"><span className="chip">{e.category}</span></td><td className="td">{e.description}{e.reference && <span className="block text-xs text-ink-mute">Ref {e.reference}</span>}</td><td className="td">{e.paidTo ?? "-"}</td><td className="td text-right tabular-nums">{kes(e.amount)}</td>
                <td className="td text-right">{canEdit && <ActionForm action={deleteExpense}><input type="hidden" name="id" value={e.id} /><SubmitButton size="sm" variant="danger" confirm="Delete this expense?">Delete</SubmitButton></ActionForm>}</td></tr>
            ))}
            {list.length === 0 && <tr><td colSpan={6} className="td text-ink-mute">No expenses in this period.</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}
