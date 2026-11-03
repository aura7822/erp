import { and, eq, inArray, lt } from "drizzle-orm";
import { db } from "@/db";
import { guardians, invoices, students, studentGuardian, terms } from "@/db/schema";
import { fromCents, kes, toCents } from "@/lib/money";
import { notifyGuardian } from "@/lib/notify";
import { bankConfigured, syncBankPayments } from "@/lib/bank";

// Vercel Cron calls this daily (see vercel.json) with Authorization: Bearer $CRON_SECRET
export async function GET(req: Request) {
  if (!process.env.CRON_SECRET || req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response("forbidden", { status: 403 });
  }
  const today = new Date().toISOString().slice(0, 10);

  const flipped = await db.update(invoices).set({ status: "overdue" })
    .where(and(inArray(invoices.status, ["unpaid", "partial"]), lt(invoices.dueDate, today))).returning({ id: invoices.id });

  // Mondays (Nairobi): remind every overdue invoice
  let reminded = 0;
  const nairobiDay = new Date(Date.now() + 3 * 3600 * 1000).getUTCDay();
  if (nairobiDay === 1) {
    const rows = await db.select({ inv: invoices, s: students, t: terms.termName }).from(invoices)
      .innerJoin(students, eq(students.id, invoices.studentId)).innerJoin(terms, eq(terms.id, invoices.termId))
      .where(eq(invoices.status, "overdue"));
    for (const { inv, s, t } of rows) {
      const gs = await db.select({ g: guardians }).from(studentGuardian)
        .innerJoin(guardians, eq(guardians.id, studentGuardian.guardianId)).where(eq(studentGuardian.studentId, s.id));
      const bal = fromCents(toCents(inv.totalAmount) - toCents(inv.amountPaid));
      const text = `Fee reminder: ${s.firstName} ${s.lastName} (${s.admissionNumber}) has an overdue balance of ${kes(bal)} for ${t}. Pay via M-Pesa Paybill ${process.env.MPESA_SHORTCODE}, account ${s.admissionNumber}.`;
      await Promise.all(gs.map(({ g }) => notifyGuardian(g, "Fee balance reminder", text)));
      reminded++;
    }
  }
  let bank: unknown = "not configured";
  if (bankConfigured()) { try { bank = await syncBankPayments(3); } catch (e) { bank = `failed: ${(e as Error).message}`; } }
  return Response.json({ markedOverdue: flipped.length, reminded, bank, date: today });
}
