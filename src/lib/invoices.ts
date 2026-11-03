import { and, eq, notExists } from "drizzle-orm";
import { db } from "@/db";
import { feeStructures, invoiceItems, invoices, students } from "@/db/schema";
import { fromCents, toCents } from "./money";

/** Idempotent: skips students that already have an invoice for the term. Returns number created. */
export async function generateInvoices(termId: number, classId?: number | null) {
  const pending = await db.select().from(students).where(and(
    eq(students.status, "active"),
    classId ? eq(students.classId, classId) : undefined,
    notExists(db.select().from(invoices).where(and(eq(invoices.studentId, students.id), eq(invoices.termId, termId)))),
  ));

  const fees = await db.select().from(feeStructures).where(eq(feeStructures.termId, termId));
  let created = 0;

  for (const s of pending) {
    const mine = fees.filter((f) => f.classId === s.classId);
    if (!mine.length) continue;
    const total = mine.reduce((sum, f) => sum + toCents(f.amount), 0);
    const due = mine.map((f) => f.dueDate).sort()[0];
    await db.transaction(async (tx) => {
      const [inv] = await tx.insert(invoices).values({
        invoiceNumber: `INV-${termId}-${s.admissionNumber}`, studentId: s.id, termId,
        totalAmount: fromCents(total), dueDate: due,
      }).onConflictDoNothing().returning();
      if (!inv) return;
      await tx.insert(invoiceItems).values(mine.map((f) => ({ invoiceId: inv.id, feeHead: f.feeHead, amount: f.amount })));
      created++;
    });
  }
  return created;
}
