"use server";
import { and, eq, inArray, ne } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/db";
import {
  broadcasts, classes, expenses, feeStructures, guardians, invoiceItems, invoices, stkRequests as _stk, studentGuardian, students, terms, academicYears, unmatchedPayments,
} from "@/db/schema";
import { type ActionState, UserError, int, need, opt, optInt, run, str } from "@/lib/action";
import { CAN, requireRole } from "@/lib/auth";
import { EXPENSE_CATEGORIES } from "@/lib/constants";
import { generateInvoices } from "@/lib/invoices";
import { invoiceMessages } from "@/lib/invoice-mail";
import { fromCents, invoiceStatusFor, toCents } from "@/lib/money";
import { notifyGuardian, sendEmailBatch, sendSms } from "@/lib/notify";
import { postPayment } from "@/lib/payments";
import { bankConfigured, syncBankPayments } from "@/lib/bank";
void _stk;

const amountOf = (fd: FormData, k = "amount") => {
  const c = toCents(str(fd, k));
  if (!(c > 0)) throw new UserError("Enter an amount greater than zero.");
  return fromCents(c);
};

// ---------- Fee structures ----------
export async function saveFee(_: ActionState, fd: FormData) {
  return run(async () => {
    await requireRole(CAN.manageFinance);
    const v = { feeHead: need(str(fd, "feeHead"), "Fee name"), amount: amountOf(fd), dueDate: need(str(fd, "dueDate"), "Due date") };
    const id = optInt(fd, "id");
    if (id) await db.update(feeStructures).set(v).where(eq(feeStructures.id, id));
    else await db.insert(feeStructures).values({ ...v, classId: int(fd, "classId"), termId: int(fd, "termId") })
      .onConflictDoUpdate({ target: [feeStructures.classId, feeStructures.termId, feeStructures.feeHead], set: { amount: v.amount, dueDate: v.dueDate } });
    revalidatePath("/admin/fees");
    return id ? "Fee updated." : "Fee added.";
  });
}
export async function deleteFee(_: ActionState, fd: FormData) {
  return run(async () => {
    await requireRole(CAN.manageFinance);
    await db.delete(feeStructures).where(eq(feeStructures.id, int(fd, "id")));
    revalidatePath("/admin/fees");
    return "Fee removed.";
  });
}
export async function runInvoiceGeneration(_: ActionState, fd: FormData) {
  return run(async () => {
    await requireRole(CAN.manageFinance);
    const n = await generateInvoices(int(fd, "termId"), optInt(fd, "classId"));
    revalidatePath("/admin/invoices");
    return n ? `${n} invoices created.` : "No new invoices: everyone already has one, or no fees are set for this grade/term.";
  });
}

/** Re-price invoices that nobody has paid on yet, after the fee structure changed. Invoices with payments are left untouched. */
export async function resyncInvoices(_: ActionState, fd: FormData) {
  return run(async () => {
    await requireRole(CAN.manageFinance);
    const termId = int(fd, "termId"), classId = int(fd, "classId");
    const fees = await db.select().from(feeStructures).where(and(eq(feeStructures.termId, termId), eq(feeStructures.classId, classId)));
    if (!fees.length) throw new UserError("Add fees for this grade first.");
    const total = fees.reduce((s, f) => s + toCents(f.amount), 0);
    const due = fees.map((f) => f.dueDate).sort()[0];
    const open = await db.select({ id: invoices.id }).from(invoices).innerJoin(students, eq(students.id, invoices.studentId))
      .where(and(eq(invoices.termId, termId), eq(students.classId, classId), eq(invoices.amountPaid, "0.00")));
    let n = 0;
    await db.transaction(async (tx) => {
      for (const { id } of open) {
        await tx.delete(invoiceItems).where(eq(invoiceItems.invoiceId, id));
        await tx.insert(invoiceItems).values(fees.map((f) => ({ invoiceId: id, feeHead: f.feeHead, amount: f.amount })));
        await tx.update(invoices).set({ totalAmount: fromCents(total), dueDate: due, status: invoiceStatusFor(total, 0, due) }).where(eq(invoices.id, id));
        n++;
      }
    });
    revalidatePath("/admin/invoices");
    return `${n} unpaid invoices updated to the current fees. Invoices that already have payments were left as they are.`;
  });
}

// ---------- Payments ----------
export async function recordPayment(_: ActionState, fd: FormData) {
  return run(async () => {
    const s = await requireRole(CAN.manageFinance);
    const p = await postPayment({ reference: need(str(fd, "reference"), "Reference"), amount: amountOf(fd), method: str(fd, "method") as "Cash", invoiceId: int(fd, "invoiceId"), userId: s.id });
    revalidatePath("/admin/invoices");
    return p ? `Recorded. Receipt ${p.receiptNumber}.` : "Could not record that payment.";
  });
}
export async function remindInvoice(_: ActionState, fd: FormData) {
  return run(async () => {
    await requireRole(CAN.manageFinance);
    const [row] = await db.select({ inv: invoices, s: students, t: terms.termName }).from(invoices)
      .innerJoin(students, eq(students.id, invoices.studentId)).innerJoin(terms, eq(terms.id, invoices.termId)).where(eq(invoices.id, int(fd, "invoiceId")));
    if (!row || row.inv.status === "paid") throw new UserError("Nothing to remind: this invoice is paid.");
    const gs = await db.select({ g: guardians }).from(studentGuardian).innerJoin(guardians, eq(guardians.id, studentGuardian.guardianId)).where(eq(studentGuardian.studentId, row.s.id));
    if (!gs.length) throw new UserError("No guardian is linked to this student.");
    const bal = fromCents(toCents(row.inv.totalAmount) - toCents(row.inv.amountPaid));
    const text = `Fee reminder: ${row.s.firstName} ${row.s.lastName} (${row.s.admissionNumber}) has a balance of KES ${bal} for ${row.t}. Pay via M-Pesa Paybill ${process.env.MPESA_SHORTCODE}, account ${row.s.admissionNumber}.`;
    await Promise.all(gs.map(({ g }) => notifyGuardian(g, "Fee balance reminder", text)));
    return `Reminder sent to ${gs.length} guardian(s).`;
  });
}
export async function allocateUnmatched(_: ActionState, fd: FormData) {
  return run(async () => {
    const s = await requireRole(CAN.manageFinance);
    const [u] = await db.select().from(unmatchedPayments).where(eq(unmatchedPayments.id, int(fd, "id")));
    if (!u || u.resolvedAt) throw new UserError("That payment was already allocated.");
    const p = await postPayment({ reference: u.transactionReference, amount: u.amount, method: u.method, billRef: need(str(fd, "admission"), "Admission number"), phone: u.payerPhone, paidAt: u.paidAt, userId: s.id });
    if (!p) throw new UserError("No student or invoice matches that admission number.");
    await db.update(unmatchedPayments).set({ resolvedAt: new Date() }).where(eq(unmatchedPayments.id, u.id));
    revalidatePath("/admin/invoices");
    return `Allocated. Receipt ${p.receiptNumber}.`;
  });
}

// ---------- Expenses ----------
export async function addExpense(_: ActionState, fd: FormData) {
  return run(async () => {
    const s = await requireRole(CAN.manageFinance);
    const category = str(fd, "category");
    if (!(EXPENSE_CATEGORIES as readonly string[]).includes(category)) throw new UserError("Choose a category.");
    await db.insert(expenses).values({
      expenseDate: need(str(fd, "expenseDate"), "Date"), category, description: need(str(fd, "description"), "Description"),
      amount: amountOf(fd), paidTo: opt(fd, "paidTo"), reference: opt(fd, "reference"), recordedBy: s.id,
    });
    revalidatePath("/admin/expenses");
    revalidatePath("/admin");
    return "Expense recorded.";
  });
}
export async function deleteExpense(_: ActionState, fd: FormData) {
  return run(async () => {
    await requireRole(CAN.manageFinance);
    await db.delete(expenses).where(eq(expenses.id, int(fd, "id")));
    revalidatePath("/admin/expenses");
    revalidatePath("/admin");
    return "Expense deleted.";
  });
}

// ---------- Broadcast invoices to parents ----------
export async function broadcastInvoices(_: ActionState, fd: FormData) {
  return run(async () => {
    const s = await requireRole(CAN.manageFinance);
    const termId = int(fd, "termId");
    const classId = str(fd, "classId") === "all" ? null : int(fd, "classId");
    const channel = str(fd, "channel");
    if (!["email", "sms", "both"].includes(channel)) throw new UserError("Choose how to send.");
    const includePaid = str(fd, "include") === "all";
    const note = opt(fd, "note") ?? undefined;

    const rows = await db.select({ inv: invoices, s: students, cls: classes.className, g: guardians, term: terms.termName, year: academicYears.year })
      .from(invoices)
      .innerJoin(students, eq(students.id, invoices.studentId)).innerJoin(classes, eq(classes.id, students.classId))
      .innerJoin(terms, eq(terms.id, invoices.termId)).innerJoin(academicYears, eq(academicYears.id, terms.academicYearId))
      .innerJoin(studentGuardian, eq(studentGuardian.studentId, students.id)).innerJoin(guardians, eq(guardians.id, studentGuardian.guardianId))
      .where(and(eq(invoices.termId, termId), eq(students.status, "active"), classId ? eq(students.classId, classId) : undefined, includePaid ? undefined : ne(invoices.status, "paid")));
    if (!rows.length) throw new UserError("No invoices with a linked parent match that selection. Generate invoices and link guardians first.");

    const invIds = [...new Set(rows.map((r) => r.inv.id))];
    const items = await db.select().from(invoiceItems).where(inArray(invoiceItems.invoiceId, invIds));
    const school = process.env.SCHOOL_NAME ?? "School";

    const emails: Parameters<typeof sendEmailBatch>[0] = [];
    const smsList: { phone: string; text: string }[] = [];
    const seen = new Set<string>();
    const contacted = new Set<number>();
    for (const r of rows) {
      const key = `${r.g.id}:${r.inv.id}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const m = invoiceMessages({
        school, term: `${r.year} ${r.term}`, student: `${r.s.firstName} ${r.s.lastName}`, adm: r.s.admissionNumber, grade: r.cls,
        items: items.filter((i) => i.invoiceId === r.inv.id).map((i) => ({ feeHead: i.feeHead, amount: i.amount })),
        total: r.inv.totalAmount, paid: r.inv.amountPaid, balance: fromCents(toCents(r.inv.totalAmount) - toCents(r.inv.amountPaid)), due: r.inv.dueDate, note,
      });
      if ((channel === "email" || channel === "both") && r.g.email) { emails.push({ to: r.g.email, subject: m.subject, text: m.text, html: m.html }); contacted.add(r.inv.id); }
      if ((channel === "sms" || channel === "both") && r.g.phone) { smsList.push({ phone: r.g.phone, text: m.sms }); contacted.add(r.inv.id); }
    }

    const details: string[] = [];
    if (emails.length && !process.env.RESEND_API_KEY) details.push("Email is not configured (RESEND_API_KEY), so no emails were sent.");
    if (smsList.length && !process.env.AT_KEY) details.push("SMS is not configured (AT_KEY), so no texts were sent.");
    const emailsSent = await sendEmailBatch(emails);
    let smsSent = 0;
    if (process.env.AT_KEY) for (let i = 0; i < smsList.length; i += 10) { await Promise.all(smsList.slice(i, i + 10).map((m) => sendSms(m.phone, m.text))); smsSent += Math.min(10, smsList.length - i); }
    const skipped = invIds.length - contacted.size;
    if (skipped > 0) details.push(`${skipped} invoice(s) had no usable ${channel === "sms" ? "phone number" : channel === "email" ? "email address" : "contact"} on file.`);

    await db.insert(broadcasts).values({ termId, classId, channel, invoicesCount: invIds.length, messagesCount: emailsSent + smsSent, sentBy: s.id });
    revalidatePath("/admin/fees/broadcast");
    return { ok: `Sent ${emailsSent} email(s) and ${smsSent} text(s) covering ${contacted.size} invoice(s).`, details };
  });
}
void redirect;

// ---------- Bank statement sync ----------
export async function syncBank(_: ActionState, fd: FormData) {
  return run(async () => {
    await requireRole(CAN.manageFinance);
    if (!bankConfigured()) throw new UserError("The bank API isn't configured yet. Fill in the BANK_API_* values in your environment variables.");
    const days = Math.min(Math.max(Number(str(fd, "days")) || 7, 1), 60);
    let r;
    try { r = await syncBankPayments(days); } catch (e) { throw new UserError(`Couldn't reach the bank: ${(e as Error).message}`); }
    revalidatePath("/admin/invoices");
    return `Checked the last ${days} days: ${r.fetched} credit(s) found, ${r.matched} posted to student ledgers, ${r.unmatched} need allocating under “Unmatched payments”.`;
  });
}
