import Link from "next/link";
import { eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { academicYears, classes, feeStructures, terms } from "@/db/schema";
import { LuWallet } from "react-icons/lu";
import { FINANCE_TABS, PageTitle, Tabs } from "@/components/Shell";
import { ActionForm, PrintButton, SubmitButton } from "@/components/ui";
import { CAN, STAFF_VIEW, getSession, requireRole } from "@/lib/auth";
import { fmtDate } from "@/lib/constants";
import { kes } from "@/lib/money";
import { deleteFee, resyncInvoices, runInvoiceGeneration, saveFee } from "../_actions/finance";

export default async function FeesPage({ searchParams }: { searchParams: Promise<{ year?: string; grade?: string; term?: string }> }) {
  await requireRole(STAFF_VIEW);
  const s = await getSession();
  const canEdit = !!s && CAN.manageFinance.includes(s.role);
  const sp = await searchParams;

  const [years, cls] = await Promise.all([db.select().from(academicYears).orderBy(academicYears.year), db.select().from(classes).orderBy(classes.level)]);
  const year = years.find((y) => y.id === Number(sp.year)) ?? years.find((y) => y.isCurrent) ?? years.at(-1);
  const allYearTerms = year ? await db.select().from(terms).where(eq(terms.academicYearId, year.id)).orderBy(terms.startDate) : [];
  const yTerms = sp.term ? allYearTerms.filter((t) => t.termName === `Term ${Number(sp.term)}`) : allYearTerms;
  const fees = yTerms.length ? await db.select().from(feeStructures).where(inArray(feeStructures.termId, yTerms.map((t) => t.id))) : [];
  const grade = sp.grade && sp.grade !== "all" ? cls.find((c) => c.id === Number(sp.grade)) : undefined;
  const total = (classId: number, termId: number) => fees.filter((f) => f.classId === classId && f.termId === termId).reduce((a, f) => a + Number(f.amount), 0);
  const link = (g: string) => `/admin/fees?year=${year?.id}&grade=${g}${sp.term ? `&term=${sp.term}` : ""}`;

  return (
    <>
      <PageTitle title="Finance" sub="Fee structures for every term and grade" back="/admin" icon={<LuWallet />}>
        <PrintButton label="Print" />
      </PageTitle>
      <Tabs tabs={FINANCE_TABS} current="/admin/fees" />

      <form className="mb-5 flex flex-wrap items-end gap-3 print:hidden">
        <div><label className="label" htmlFor="y">Academic year</label><select id="y" name="year" defaultValue={year?.id} className="field">{years.map((y) => <option key={y.id} value={y.id}>{y.year}</option>)}</select></div>
        <div><label className="label" htmlFor="g">Grade</label><select id="g" name="grade" defaultValue={grade?.id ?? "all"} className="field"><option value="all">All grades (overview)</option>{cls.map((c) => <option key={c.id} value={c.id}>{c.className}</option>)}</select></div>
        <div><label className="label" htmlFor="tm">Term</label><select id="tm" name="term" defaultValue={sp.term ?? ""} className="field"><option value="">All terms</option>{[1, 2, 3].map((n) => <option key={n} value={n}>Term {n}</option>)}</select></div>
        <button className="btn-ghost">Show</button>
      </form>

      {!year || yTerms.length === 0 ? <p className="card p-6 text-ink-mute">No terms exist for this year yet. Create them under Academics → Terms.</p> : (
        <>
          <div className="mb-4 hidden print:block"><h2 className="font-display text-xl font-bold">{process.env.SCHOOL_NAME} · Fee structure {year.year}</h2><p>{grade ? grade.className : "All grades"}</p></div>

          {/* Overview matrix: every grade x every term of the year */}
          {!grade && (
            <div className="card overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr><th className="th">Grade</th>{yTerms.map((t) => <th key={t.id} className="th text-right">{t.termName}</th>)}<th className="th text-right">Year total</th><th className="th print:hidden" /></tr></thead>
                <tbody className="divide-y divide-paper-line/70">
                  {cls.map((c) => (
                    <tr key={c.id}><td className="td font-medium">{c.className}</td>
                      {yTerms.map((t) => <td key={t.id} className="td text-right tabular-nums">{total(c.id, t.id) ? kes(total(c.id, t.id)).replace(".00", "") : <span className="text-ink-mute">-</span>}</td>)}
                      <td className="td text-right font-semibold tabular-nums">{kes(yTerms.reduce((a, t) => a + total(c.id, t.id), 0)).replace(".00", "")}</td>
                      <td className="td text-right print:hidden"><Link href={link(String(c.id))} className="btn-ghost btn-sm">View &amp; edit</Link></td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* One grade: every term, editable */}
          {grade && yTerms.map((t) => {
            const mine = fees.filter((f) => f.classId === grade.id && f.termId === t.id);
            return (
              <section key={t.id} className="card mb-6 break-inside-avoid p-5">
                <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2"><h2 className="font-display text-lg font-bold">{grade.className} · {t.termName}</h2><span className="font-semibold tabular-nums">{kes(mine.reduce((a, f) => a + Number(f.amount), 0))}</span></div>

                <table className="mb-3 hidden w-full text-sm print:table"><tbody>{mine.map((f) => <tr key={f.id} className="border-b"><td className="py-1">{f.feeHead}</td><td className="py-1">due {fmtDate(f.dueDate)}</td><td className="py-1 text-right">{kes(f.amount)}</td></tr>)}</tbody></table>

                <div className="space-y-2 print:hidden">
                  {mine.map((f) => (
                    <div key={f.id} className="flex flex-wrap items-start gap-2">
                      {canEdit ? (<>
                        <ActionForm action={saveFee} className="grid flex-1 grid-cols-2 gap-2 sm:grid-cols-[1fr_130px_150px_auto]">
                          <input type="hidden" name="id" value={f.id} />
                          <input name="feeHead" defaultValue={f.feeHead} className="field" aria-label="Fee name" required />
                          <input name="amount" type="number" step="0.01" min="0.01" defaultValue={f.amount} className="field" aria-label="Amount" required />
                          <input name="dueDate" type="date" defaultValue={f.dueDate} className="field" aria-label="Due date" required />
                          <SubmitButton size="sm" variant="ghost">Save</SubmitButton>
                        </ActionForm>
                        <ActionForm action={deleteFee}><input type="hidden" name="id" value={f.id} /><SubmitButton size="sm" variant="danger" confirm={`Remove ${f.feeHead}?`}>Remove</SubmitButton></ActionForm>
                      </>) : <p className="text-sm">{f.feeHead} · {kes(f.amount)} · due {fmtDate(f.dueDate)}</p>}
                    </div>
                  ))}
                  {mine.length === 0 && <p className="text-sm text-ink-mute">No fees set for this term.</p>}
                </div>

                {canEdit && (
                  <div className="mt-4 space-y-3 border-t border-paper-line pt-4 print:hidden">
                    <ActionForm action={saveFee} resetOnSuccess className="grid grid-cols-2 gap-2 sm:grid-cols-[1fr_130px_150px_auto]">
                      <input type="hidden" name="classId" value={grade.id} /><input type="hidden" name="termId" value={t.id} />
                      <input name="feeHead" placeholder="New fee, e.g. Transport" className="field" required />
                      <input name="amount" type="number" step="0.01" min="0.01" placeholder="Amount" className="field" required />
                      <input name="dueDate" type="date" defaultValue={t.startDate} className="field" required aria-label="Due date" />
                      <SubmitButton size="sm">Add fee</SubmitButton>
                    </ActionForm>
                    <div className="flex flex-wrap gap-3">
                      <ActionForm action={runInvoiceGeneration}><input type="hidden" name="termId" value={t.id} /><input type="hidden" name="classId" value={grade.id} /><SubmitButton variant="accent" size="sm" pendingText="Generating…">Generate invoices for {grade.className}</SubmitButton></ActionForm>
                      <ActionForm action={resyncInvoices}><input type="hidden" name="termId" value={t.id} /><input type="hidden" name="classId" value={grade.id} /><SubmitButton variant="ghost" size="sm" confirm="Re-price all UNPAID invoices for this grade and term to match these fees? Invoices with payments are not changed.">Apply changes to unpaid invoices</SubmitButton></ActionForm>
                    </div>
                  </div>
                )}
              </section>
            );
          })}
        </>
      )}
    </>
  );
}
