import { and, asc, desc, eq, ne } from "drizzle-orm";
import { db } from "@/db";
import {
  feePayments, guardians, invoices, students, studentGuardian, unmatchedPayments,
} from "@/db/schema";
import { fromCents, invoiceStatusFor, kes, toCents } from "./money";
import { notifyGuardian } from "./notify";

type PostArgs = {
  reference: string;
  amount: string; // "1500.00"
  method: "M-Pesa" | "Bank" | "Cash" | "Cheque";
  billRef?: string | null;
  phone?: string | null;
  paidAt?: Date;
  invoiceId?: number | null;
  userId?: string | null;
};

const receiptNo = () => `RCP-${new Date().toISOString().slice(2, 10).replace(/-/g, "")}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;

/**
 * The only place money is applied to a ledger.
 * Idempotent on `reference` (gateways retry); runs in one transaction with the invoice row locked.
 * Unknown accounts go to unmatched_payments so nothing is ever dropped.
 */
export async function postPayment(a: PostArgs) {
  const paidAt = a.paidAt ?? new Date();

  const result = await db.transaction(async (tx) => {
    const [existing] = await tx.select().from(feePayments).where(eq(feePayments.transactionReference, a.reference));
    if (existing) return { payment: existing, created: false as const };

    // Who is this for?
    let studentId: number | null = null;
    if (a.invoiceId) {
      studentId = (await tx.select({ s: invoices.studentId }).from(invoices).where(eq(invoices.id, a.invoiceId)))[0]?.s ?? null;
    } else if (a.billRef) {
      const ref = a.billRef.replace(/\s+/g, "").toUpperCase();
      studentId = (await tx.select({ id: students.id }).from(students).where(eq(students.admissionNumber, ref)))[0]?.id ?? null;
    }

    const park = async () => {
      await tx.insert(unmatchedPayments).values({
        transactionReference: a.reference, billRef: a.billRef ?? null, amount: a.amount,
        payerPhone: a.phone ?? null, method: a.method, paidAt,
      }).onConflictDoNothing();
      return { payment: null, created: false as const };
    };
    if (!studentId) return park();

    // Lock target invoice: specified one, else the oldest open one, else the latest
    const lock = (where: ReturnType<typeof and>, order: ReturnType<typeof asc>) =>
      tx.select().from(invoices).where(where).orderBy(order).limit(1).for("update");
    let [inv] = a.invoiceId
      ? await lock(eq(invoices.id, a.invoiceId), asc(invoices.id))
      : await lock(and(eq(invoices.studentId, studentId), ne(invoices.status, "paid")), asc(invoices.dueDate));
    if (!inv) [inv] = await lock(eq(invoices.studentId, studentId), desc(invoices.id));
    if (!inv) return park();

    const [payment] = await tx.insert(feePayments).values({
      invoiceId: inv.id, studentId, amountPaid: a.amount, method: a.method,
      receiptNumber: receiptNo(), transactionReference: a.reference,
      payerPhone: a.phone ?? null, paidAt, recordedBy: a.userId ?? null,
    }).returning();

    const newPaid = toCents(inv.amountPaid) + toCents(a.amount); // overpayment => credit (paid > total)
    const [updated] = await tx.update(invoices).set({
      amountPaid: fromCents(newPaid),
      status: invoiceStatusFor(toCents(inv.totalAmount), newPaid, inv.dueDate),
    }).where(eq(invoices.id, inv.id)).returning();

    return { payment, created: true as const, invoice: updated, studentId };
  });

  // Receipt notification after commit; never fail the payment because email failed
  if (result.created && result.payment) {
    const gs = await db.select({ g: guardians }).from(studentGuardian)
      .innerJoin(guardians, eq(guardians.id, studentGuardian.guardianId))
      .where(eq(studentGuardian.studentId, result.studentId));
    const bal = toCents(result.invoice.totalAmount) - toCents(result.invoice.amountPaid);
    const text = `Payment received: ${kes(a.amount)}. Receipt ${result.payment.receiptNumber}. Outstanding balance: ${kes(fromCents(Math.max(bal, 0)))}.`;
    await Promise.all(gs.map(({ g }) => notifyGuardian(g, `Receipt ${result.payment!.receiptNumber}`, text)));
  }
  return result.payment;
}
