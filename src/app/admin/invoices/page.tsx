import { and, desc, eq, ilike, isNull, or } from "drizzle-orm";
import { db } from "@/db";
import { academicYears, classes, invoices, students, terms, unmatchedPayments } from "@/db/schema";
import { bankConfigured } from "@/lib/bank";
import { LuWallet } from "react-icons/lu";
import { FINANCE_TABS, PageTitle, Tabs } from "@/components/Shell";
import { ActionForm, SubmitButton } from "@/components/ui";
import { CAN, STAFF_VIEW, getSession, requireRole } from "@/lib/auth";
import { fromCents, kes, toCents } from "@/lib/money";
import { allocateUnmatched, recordPayment, remindInvoice, syncBank } from "../_actions/finance";

const BADGE: Record<string, string> = { paid: "text-ok", partial: "text-bus-deep", overdue: "text-alert", unpaid: "text-ink-mute" };

export default async function InvoicesPage({ searchParams }: { searchParams: Promise<{ status?: string; q?: string; year?: string; term?: string; grade?: string }> }) {
  await requireRole(STAFF_VIEW);
  const s = await getSession();
  const canPay = !!s && CAN.manageFinance.includes(s.role);
  const sp = await searchParams;
  const q = sp.q?.trim();

  const [years, cls] = await Promise.all([db.select().from(academicYears).orderBy(academicYears.year), db.select().from(classes).orderBy(classes.level)]);
  const [rows, unmatched] = await Promise.all([
    db.select({ inv: invoices, s: students, term: terms.termName }).from(invoices)
      .innerJoin(students, eq(students.id, invoices.studentId)).innerJoin(terms, eq(terms.id, invoices.termId))
      .where(and(sp.year ? eq(terms.academicYearId, Number(sp.year)) : undefined, sp.term ? eq(terms.termName, `Term ${Number(sp.term)}`) : undefined, sp.grade ? eq(students.classId, Number(sp.grade)) : undefined, sp.status ? eq(invoices.status, sp.status as "paid") : undefined, q ? or(ilike(students.admissionNumber, `%${q}%`), ilike(students.firstName, `%${q}%`), ilike(students.lastName, `%${q}%`)) : undefined))
      .orderBy(desc(invoices.id)).limit(200),
    db.select().from(unmatchedPayments).where(isNull(unmatchedPayments.resolvedAt)).orderBy(desc(unmatchedPayments.paidAt)),
  ]);

  return (
    <>
      <PageTitle title="Finance" sub="Invoices, payments, expenses and fee broadcasts" back="/admin" icon={<LuWallet />} />
      <Tabs tabs={FINANCE_TABS} current="/admin/invoices" />

      {unmatched.length > 0 && canPay && (
        <section className="card mb-6 p-5">
          <h2 className="font-display text-lg font-bold">Unmatched payments ({unmatched.length})</h2>
          <p className="text-sm text-ink-mute">Money received with an unknown account number. Allocate each to a student.</p>
          <ul className="mt-3 divide-y divide-paper-line/70 text-sm">
            {unmatched.map((u) => (
              <li key={u.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <span>{kes(u.amount)} · {u.method} · {u.transactionReference} · ref “{u.billRef ?? "-"}” · {u.payerPhone}</span>
                <ActionForm action={allocateUnmatched} className="flex flex-wrap items-center gap-2"><input type="hidden" name="id" value={u.id} /><input name="admission" placeholder="Admission no." className="field !w-36 !py-1.5" required /><SubmitButton size="sm">Allocate</SubmitButton></ActionForm>
              </li>
            ))}
          </ul>
        </section>
      )}

      {canPay && (
        <ActionForm action={syncBank} className="card mb-6 flex flex-wrap items-center gap-3 p-4">
          <p className="min-w-[200px] flex-1 text-sm"><strong>Bank payments.</strong> {bankConfigured() ? "Pull recent credits from the bank statement API and post them to student ledgers." : "Not connected yet: fill in the BANK_API_* values in your environment to enable this."}</p>
          <select name="days" defaultValue="7" className="field !w-36" aria-label="Look back"><option value="1">Last day</option><option value="7">Last 7 days</option><option value="30">Last 30 days</option></select>
          <SubmitButton variant="accent" pendingText="Syncing…" disabled={!bankConfigured()}>Sync bank payments</SubmitButton>
        </ActionForm>
      )}

      <form className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
        <select name="year" defaultValue={sp.year ?? ""} className="field" aria-label="Year"><option value="">All years</option>{years.map((y) => <option key={y.id} value={y.id}>{y.year}</option>)}</select>
        <select name="term" defaultValue={sp.term ?? ""} className="field" aria-label="Term"><option value="">All terms</option>{[1, 2, 3].map((n) => <option key={n} value={n}>Term {n}</option>)}</select>
        <select name="grade" defaultValue={sp.grade ?? ""} className="field" aria-label="Grade"><option value="">All grades</option>{cls.map((c) => <option key={c.id} value={c.id}>{c.className}</option>)}</select>
        <select name="status" defaultValue={sp.status ?? ""} className="field" aria-label="Status"><option value="">All statuses</option>{["unpaid", "partial", "overdue", "paid"].map((x) => <option key={x}>{x}</option>)}</select>
        <input name="q" defaultValue={q} placeholder="Name or adm. no." className="field" aria-label="Search" />
        <button className="btn-ghost">Filter</button>
      </form>

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr><th className="th">Invoice</th><th className="th">Student</th><th className="th">Term</th><th className="th text-right">Total</th><th className="th text-right">Paid</th><th className="th text-right">Balance</th><th className="th">Status</th><th className="th" /></tr></thead>
          <tbody className="divide-y divide-paper-line/70">
            {rows.map(({ inv, s: st, term }) => {
              const bal = fromCents(toCents(inv.totalAmount) - toCents(inv.amountPaid));
              return (
                <tr key={inv.id} className="align-top">
                  <td className="td tabular-nums">{inv.invoiceNumber}</td>
                  <td className="td">{st.firstName} {st.lastName}<div className="text-xs text-ink-mute">{st.admissionNumber}</div></td>
                  <td className="td">{term}</td>
                  <td className="td text-right tabular-nums">{kes(inv.totalAmount)}</td>
                  <td className="td text-right tabular-nums">{kes(inv.amountPaid)}</td>
                  <td className="td text-right tabular-nums">{kes(bal)}</td>
                  <td className="td"><span className={`chip ${BADGE[inv.status]}`}>{inv.status}</span></td>
                  <td className="td">
                    {canPay && inv.status !== "paid" && (
                      <div className="flex flex-col items-end gap-2">
                        <details className="group"><summary className="btn-ghost btn-sm cursor-pointer list-none">Record payment</summary>
                          <ActionForm action={recordPayment} resetOnSuccess className="mt-2 grid w-60 gap-2 rounded-2xl bg-paper-light p-3 shadow-lg">
                            <input type="hidden" name="invoiceId" value={inv.id} />
                            <input name="amount" type="number" step="0.01" min="1" placeholder="Amount" className="field" required />
                            <select name="method" className="field">{["Cash", "Bank", "Cheque", "M-Pesa"].map((m) => <option key={m}>{m}</option>)}</select>
                            <input name="reference" placeholder="Slip / reference no." className="field" required />
                            <SubmitButton size="sm">Save payment</SubmitButton>
                          </ActionForm></details>
                        <ActionForm action={remindInvoice}><input type="hidden" name="invoiceId" value={inv.id} /><SubmitButton size="sm" variant="ghost" pendingText="Sending…">Send reminder</SubmitButton></ActionForm>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && <tr><td colSpan={8} className="td text-ink-mute">No invoices found.</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}
