import { eq } from "drizzle-orm";
import { db } from "@/db";
import { streams, students } from "@/db/schema";
import { UserError } from "./action";

type Candidate = {
  admissionNumber?: string | null; firstName?: string | null; lastName?: string | null; gender?: string | null; dob?: string | null;
  classId?: number | null; streamId?: number | null; admittedOn?: string | null; photoUrl?: string | null;
};

/** An ID may only be issued when EVERY detail (including the photo) is present. */
export async function idMissing(s: Candidate): Promise<string[]> {
  const m: string[] = [];
  if (!s.admissionNumber) m.push("admission number");
  if (!s.firstName || !s.lastName) m.push("full name");
  if (!s.gender) m.push("gender");
  if (!s.dob) m.push("date of birth");
  if (!s.classId) m.push("class");
  else if (!s.streamId) {
    const has = await db.select({ id: streams.id }).from(streams).where(eq(streams.classId, s.classId)).limit(1);
    if (has.length) m.push("stream");
  }
  if (!s.admittedOn) m.push("date admitted");
  if (!s.photoUrl) m.push("passport photo");
  return m;
}

/** Kenyan school year runs Jan–Nov: IDs issued Jan–Oct expire 31 Dec this year, Nov–Dec issues roll to next year. */
export function idDates(from = new Date()) {
  const y = from.getMonth() >= 10 ? from.getFullYear() + 1 : from.getFullYear();
  return { issued: from.toISOString().slice(0, 10), expires: `${y}-12-31` };
}

export const makeIdNumber = (id: number) => `${String(new Date().getFullYear()).slice(2)}${String(id).padStart(5, "0")}`;

/** Issue (or re-issue with fresh dates) an ID for an existing student. */
export async function issueId(studentId: number) {
  const [s] = await db.select().from(students).where(eq(students.id, studentId));
  if (!s) throw new UserError("Student not found.");
  const missing = await idMissing(s);
  if (missing.length) throw new UserError(`Can't generate an ID yet. Missing: ${missing.join(", ")}.`);
  const { issued, expires } = idDates();
  await db.update(students).set({ idNumber: s.idNumber ?? makeIdNumber(s.id), idIssuedAt: issued, idExpiresAt: expires }).where(eq(students.id, studentId));
}
