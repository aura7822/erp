import Link from "next/link";
import { and, desc, eq, gte, inArray } from "drizzle-orm";
import { db } from "@/db";
import { academicYears, attendance, examResults, guardians, invoiceItems, invoices, feePayments, terms } from "@/db/schema";
import { PayForm } from "@/components/PayForm";
import { RefreshButton } from "@/components/ui";
import { requireRole, ROLES } from "@/lib/auth";
import { kes, toCents } from "@/lib/money";
import { myStudents } from "@/lib/portal";

const TABS = [["fees", "Fees"], ["attendance", "Attendance"], ["reports", "Report cards"]] as const;
const BADGE: Record<string, string> = { paid: "bg-ok/10 text-ok", partial: "bg-bus/20 text-ink", overdue: "bg-alert/10 text-alert", unpaid: "bg-paper text-ink-mute" };

export default async function Portal({ searchParams }: { searchParams: Promise<{ s?: string; tab?: string }> }) {
  const session = await requireRole(ROLES);
  const sp = await searchParams;
  const kids = await myStudents(session);
  const kid = kids.find((k) => k.uuid === sp.s) ?? kids[0];
  const tab = TABS.some(([k]) => k === sp.tab) ? sp.tab! : "fees";
  const href = (o: { s?: string; tab?: string }) => `/portal?s=${o.s ?? kid?.uuid}&tab=${o.tab ?? tab}`;

  if (!kid) {
    return (
      <div className="card p-8 text-center">
        <p className="font-display text-xl font-bold">No students linked to this account</p>
        <p className="mt-2 text-ink-mute">Ask the school office to add <strong>{session.email}</strong> as a guardian email on your child's record, then refresh this page.</p>
      </div>
    );
  }

  const invs = await db.select({ inv: invoices, term: terms.termName, year: academicYears.year }).from(invoices)
    .innerJoin(terms, eq(terms.id, invoices.termId)).innerJoin(academicYears, eq(academicYears.id, terms.academicYearId))
    .where(eq(invoices.studentId, kid.id)).orderBy(desc(invoices.id));
  const ids = invs.map((i) => i.inv.id);
  const items = ids.length ? await db.select().from(invoiceItems).where(inArray(invoiceItems.invoiceId, ids)) : [];
  const pays = ids.length ? await db.select().from(feePayments).where(inArray(feePayments.invoiceId, ids)).orderBy(desc(feePayments.paidAt)) : [];
  const latest = invs[0]?.inv;
  const balance = latest ? (toCents(latest.totalAmount) - toCents(latest.amountPaid)) / 100 : 0;
  const pct = latest && toCents(latest.totalAmount) > 0 ? Math.min(100, Math.round((toCents(latest.amountPaid) / toCents(latest.totalAmount)) * 100)) : 0;

  const [g] = await db.select({ phone: guardians.phone }).from(guardians).where(eq(guardians.clerkUserId, session.id)).limit(1);

  const since = new Date(Date.now() - 60 * 864e5).toISOString().slice(0, 10);
  const att = tab === "attendance" ? await db.select().from(attendance).where(and(eq(attendance.studentId, kid.id), gte(attendance.date, since))).orderBy(desc(attendance.date)) : [];
  const reports = tab === "reports"
    ? await db.selectDistinct({ termId: examResults.termId, exam: examResults.examType, term: terms.termName, year: academicYears.year, start: terms.startDate })
        .from(examResults).innerJoin(terms, eq(terms.id, examResults.termId)).innerJoin(academicYears, eq(academicYears.id, terms.academicYearId))
        .where(eq(examResults.studentId, kid.id)).orderBy(desc(terms.startDate))
    : [];

  return (
    <div>
      <div className="mb-3 flex justify-end"><RefreshButton /></div>
      {kids.length > 1 && (
        <div className="mb-5 flex gap-2 overflow-x-auto pb-1">
          {kids.map((k) => (
            <Link key={k.id} href={href({ s: k.uuid })} className={`whitespace-nowrap rounded-full border px-4 py-1.5 text-sm font-medium ${k.id === kid.id ? "border-ink bg-ink text-white" : "border-paper-line bg-white"}`}>{k.firstName}</Link>
          ))}
        </div>
      )}

      <section className="flex items-center gap-4">
        <div className="grid h-16 w-16 shrink-0 place-items-center rounded-full bg-ink/10 font-display text-xl font-bold text-ink">{kid.firstName[0]}{kid.lastName[0]}</div>
        <div>
          <h1 className="font-display text-2xl font-bold leading-tight">{kid.firstName} {kid.lastName}</h1>
          <p className="text-sm text-ink-mute">{kid.className} {kid.stream} · Adm. {kid.admissionNumber}</p>
        </div>
      </section>

      <section className="card mt-5 overflow-hidden">
        {latest ? (
          <>
            <div className="flex flex-wrap items-end justify-between gap-4 p-5">
              <div>
                <p className="text-sm text-ink-mute">{invs[0].term} balance</p>
                <p className={`font-display text-4xl font-bold tracking-tight ${latest.status === "overdue" ? "text-alert" : ""}`}>{kes(Math.max(balance, 0))}</p>
                <p className="mt-1 text-sm text-ink-mute">{latest.status === "paid" ? "Fully paid. Thank you." : <>Due {latest.dueDate}{latest.status === "overdue" && <span className="font-semibold text-alert"> · overdue</span>}</>}</p>
              </div>
              {latest.status !== "paid" && <a href="#pay" className="btn-accent">Pay with M-Pesa</a>}
            </div>
            <div className="h-2 bg-paper" role="img" aria-label={`${pct}% paid`}><div className="h-full bg-bus" style={{ width: `${pct}%` }} /></div>
            <p className="px-5 py-2 text-xs text-ink-mute">{kes(latest.amountPaid)} paid of {kes(latest.totalAmount)}</p>
          </>
        ) : <p className="p-5 text-ink-mute">No fee invoice has been issued yet.</p>}
      </section>

      <nav className="mt-6 flex gap-1 border-b border-paper-line" aria-label="Sections">
        {TABS.map(([k, label]) => <Link key={k} href={href({ tab: k })} className={`-mb-px border-b-2 px-4 py-2.5 text-sm font-semibold ${tab === k ? "border-ink" : "border-transparent text-ink-mute hover:text-ink"}`}>{label}</Link>)}
      </nav>

      <div className="mt-5">
        {tab === "fees" && (
          <>
            {latest && latest.status !== "paid" && <div className="mb-6"><PayForm invoiceId={latest.id} balance={balance} defaultPhone={g?.phone ?? ""} /></div>}
            <h2 className="font-display text-lg font-bold">Fee statement</h2>
            <div className="mt-3 space-y-4">
              {invs.map(({ inv, term, year }) => (
                <div key={inv.id} className="card">
                  <div className="flex items-center justify-between border-b border-paper-line px-4 py-3"><p className="font-semibold">{year} · {term}</p><span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${BADGE[inv.status]}`}>{inv.status}</span></div>
                  <table className="w-full text-sm"><tbody>
                    {items.filter((i) => i.invoiceId === inv.id).map((i) => <tr key={i.id} className="border-b border-paper-line/60"><td className="td">{i.feeHead}</td><td className="td text-right tabular-nums">{kes(i.amount)}</td></tr>)}
                    <tr className="font-semibold"><td className="td">Total</td><td className="td text-right tabular-nums">{kes(inv.totalAmount)}</td></tr>
                  </tbody></table>
                  {pays.filter((p) => p.invoiceId === inv.id).length > 0 && (
                    <div className="border-t border-paper-line bg-paper/60 px-4 py-3 text-sm">
                      <p className="mb-1 font-medium">Payments</p>
                      {pays.filter((p) => p.invoiceId === inv.id).map((p) => <div key={p.id} className="flex justify-between py-0.5"><span>{p.paidAt.toLocaleDateString("en-KE")} · {p.method} · {p.receiptNumber}</span><span className="tabular-nums">{kes(p.amountPaid)}</span></div>)}
                    </div>
                  )}
                  <div className="border-t border-paper-line px-4 py-2 text-right"><a className="text-sm font-semibold underline underline-offset-4" href={`/api/fee-structure/${kid.uuid}/${inv.termId}`}>Download fee structure</a></div>
                </div>
              ))}
            </div>
          </>
        )}

        {tab === "attendance" && (
          att.length === 0 ? <p className="text-ink-mute">No attendance has been recorded yet.</p> : (
            <>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {[["Rate", `${Math.round((att.filter((a) => a.status === "present" || a.status === "late").length / att.length) * 100)}%`], ["Present", att.filter((a) => a.status === "present").length], ["Late", att.filter((a) => a.status === "late").length], ["Absent", att.filter((a) => a.status === "absent").length]].map(([l, v]) => (
                  <div key={String(l)} className="card p-4"><p className="text-sm text-ink-mute">{l}</p><p className="font-display text-2xl font-bold">{v}</p></div>
                ))}
              </div>
              <ul className="card mt-4 divide-y divide-paper-line">
                {att.slice(0, 14).map((a) => <li key={a.id} className="flex justify-between px-4 py-2.5 text-sm"><span>{new Date(a.date).toLocaleDateString("en-KE", { weekday: "short", day: "numeric", month: "short" })}</span><span className={`font-semibold ${a.status === "absent" ? "text-alert" : a.status === "present" ? "text-ok" : ""}`}>{a.status}</span></li>)}
              </ul>
            </>
          )
        )}

        {tab === "reports" && (
          <>
            <h2 className="font-display text-lg font-bold">Report cards</h2>
            {reports.length === 0 ? <p className="mt-2 text-ink-mute">Report cards appear here once results are entered.</p> : reports.map((r) => (
              <a key={`${r.termId}-${r.exam}`} href={`/api/report-card/${kid.uuid}/${r.termId}/${encodeURIComponent(r.exam)}`} className="card mt-3 flex items-center justify-between px-4 py-3 hover:bg-paper">
                <span><span className="font-semibold">{r.year} · {r.term}</span> <span className="text-ink-mute">· {r.exam}</span></span><span className="text-sm font-semibold underline underline-offset-4">Download PDF</span>
              </a>
            ))}
          </>
        )}
      </div>
    </div>
  );
}
