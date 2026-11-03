import { and, eq, inArray, isNull, or } from "drizzle-orm";
import { db } from "@/db";
import { classes, guardians, staff, streams, studentGuardian, students } from "@/db/schema";
import type { Session } from "./auth";

/**
 * Students this login may see. Accounts link themselves on first sign-in by matching the
 * Clerk email to the guardian's (or student's) email on file, so admins never copy Clerk IDs around.
 */
export async function myStudents(s: Session) {
  if (s.email) {
    await db.update(guardians).set({ clerkUserId: s.id }).where(and(eq(guardians.email, s.email), isNull(guardians.clerkUserId)));
    await db.update(students).set({ clerkUserId: s.id }).where(and(eq(students.email, s.email), isNull(students.clerkUserId)));
  }
  const viaGuardian = await db.select({ id: studentGuardian.studentId }).from(studentGuardian)
    .innerJoin(guardians, eq(guardians.id, studentGuardian.guardianId)).where(eq(guardians.clerkUserId, s.id));
  const ids = viaGuardian.map((r) => r.id);

  return db.select({
    id: students.id, uuid: students.uuid, firstName: students.firstName, lastName: students.lastName,
    admissionNumber: students.admissionNumber, classId: students.classId, className: classes.className, stream: streams.stream,
    photoUrl: students.photoUrl,
  }).from(students)
    .innerJoin(classes, eq(classes.id, students.classId))
    .leftJoin(streams, eq(streams.id, students.streamId))
    .where(or(eq(students.clerkUserId, s.id), ids.length ? inArray(students.id, ids) : undefined))
    .orderBy(students.firstName);
}

/** Authorization for any per-student resource (invoices, PDFs, STK status). */
export async function canViewStudent(s: Session, studentId: number) {
  if (["admin", "principal", "bursar"].includes(s.role)) return true;
  return (await myStudents(s)).some((x) => x.id === studentId);
}

/** The staff record for this login (linked by getSession on sign-in). */
export async function myStaff(s: Session) {
  return (await db.select().from(staff).where(eq(staff.clerkUserId, s.id)))[0] ?? null;
}
