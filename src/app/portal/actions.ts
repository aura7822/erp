"use server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { invoices, students, stkRequests } from "@/db/schema";
import { getSession } from "@/lib/auth";
import { fromCents, isKenyanMobile, normalizePhone, toCents } from "@/lib/money";
import { stkPush } from "@/lib/mpesa";
import { canViewStudent } from "@/lib/portal";

export async function startStkPush(invoiceId: number, phone: string, amount: number): Promise<{ stkId: number } | { error: string }> {
  const s = await getSession();
  if (!s) return { error: "Please sign in again." };

  const [inv] = await db.select().from(invoices).where(eq(invoices.id, invoiceId));
  if (!inv || !(await canViewStudent(s, inv.studentId))) return { error: "Invoice not found." };

  const balance = toCents(inv.totalAmount) - toCents(inv.amountPaid);
  if (balance <= 0) return { error: "This invoice is already fully paid." };
  if (!isKenyanMobile(phone)) return { error: "Enter a Safaricom number like 0712 345 678." };
  if (!Number.isInteger(amount) || amount < 1) return { error: "Enter a whole-shilling amount." };
  if (amount * 100 > balance + 99) return { error: "That is more than the balance due." };

  const [st] = await db.select({ adm: students.admissionNumber }).from(students).where(eq(students.id, inv.studentId));
  try {
    const r = await stkPush({ phone, amount, accountRef: st.adm });
    const [row] = await db.insert(stkRequests).values({
      invoiceId: inv.id, studentId: inv.studentId, phone: normalizePhone(phone), amount: fromCents(amount * 100),
      merchantRequestId: r.MerchantRequestID, checkoutRequestId: r.CheckoutRequestID,
    }).returning({ id: stkRequests.id });
    return { stkId: row.id };
  } catch (e) {
    console.error("stk push failed", e);
    return { error: "We could not reach M-Pesa. Please try again in a minute." };
  }
}
