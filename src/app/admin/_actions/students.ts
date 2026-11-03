"use server";
import { and, count, eq, ne } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { guardians, studentGuardian, studentImportRows, students } from "@/db/schema";
import { parseStudentSheet, type StudentRowData } from "@/lib/import";
import { type ActionState, UserError, int, need, opt, optInt, run, str } from "@/lib/action";
import { CAN, requireRole } from "@/lib/auth";
import { normalizePhone } from "@/lib/money";
import { idDates, idMissing, issueId, makeIdNumber } from "@/lib/student-id";

function parse(fd: FormData) {
  const photoRaw = str(fd, "photo");
  if (photoRaw && (!photoRaw.startsWith("data:image/jpeg;base64,") || photoRaw.length > 400_000)) throw new UserError("The photo is invalid or too large. Please upload it again.");
  const gender = str(fd, "gender");
  if (gender !== "male" && gender !== "female") throw new UserError("Choose the student's gender.");
  return {
    admissionNumber: need(str(fd, "admissionNumber").replace(/\s+/g, "").toUpperCase(), "Admission number"),
    firstName: need(str(fd, "firstName"), "First name"), lastName: need(str(fd, "lastName"), "Last name"),
    gender: gender as "male" | "female", dob: need(str(fd, "dob"), "Date of birth"),
    classId: int(fd, "classId"), streamId: optInt(fd, "streamId"),
    admittedOn: need(str(fd, "admittedOn"), "Date admitted"),
    email: opt(fd, "email")?.toLowerCase() ?? null, photoUrl: photoRaw || null,
  };
}

const syncViews = () => { revalidatePath("/admin/students"); revalidatePath("/admin/classes"); revalidatePath("/admin"); };

async function linkGuardian(studentId: number, g: { fullName: string; phone: string; email: string | null; relationship: string }) {
  const phone = normalizePhone(g.phone);
  if (!/^254[17]\d{8}$/.test(phone)) return;
  let [row] = await db.select().from(guardians).where(eq(guardians.phone, phone));
  if (!row) [row] = await db.insert(guardians).values({ fullName: g.fullName, phone, email: g.email }).returning();
  else if (g.email && !row.email) await db.update(guardians).set({ email: g.email }).where(eq(guardians.id, row.id));
  const rel = (["Father", "Mother", "Sponsor", "Guardian"].find((r) => r.toLowerCase() === g.relationship.toLowerCase()) ?? "Guardian") as "Father";
  await db.insert(studentGuardian).values({ studentId, guardianId: row.id, relationship: rel }).onConflictDoNothing();
}

export async function createStudent(_: ActionState, fd: FormData) {
  return run(async () => {
    await requireRole(CAN.manageSchool);
    const v = parse(fd);
    const importRowId = optInt(fd, "importRowId");
    const wantId = fd.get("generateId") === "1";
    if (wantId) {
      const missing = await idMissing(v);
      if (missing.length) throw new UserError(`Can't generate an ID yet. Missing: ${missing.join(", ")}.`);
    }
    const [row] = await db.insert(students).values(v).returning({ id: students.id });
    if (wantId) {
      const { issued, expires } = idDates();
      await db.update(students).set({ idNumber: makeIdNumber(row.id), idIssuedAt: issued, idExpiresAt: expires }).where(eq(students.id, row.id));
    }
    let remaining = 0;
    if (importRowId) {
      const [ir] = await db.select().from(studentImportRows).where(eq(studentImportRows.id, importRowId));
      if (ir) {
        const d = ir.data as StudentRowData;
        if (d.guardianName && d.guardianPhone) await linkGuardian(row.id, { fullName: d.guardianName, phone: d.guardianPhone, email: d.guardianEmail || null, relationship: d.relationship });
        await db.update(studentImportRows).set({ status: "done", studentId: row.id }).where(eq(studentImportRows.id, importRowId));
      }
      [{ n: remaining }] = await db.select({ n: count() }).from(studentImportRows).where(eq(studentImportRows.status, "pending"));
    }
    syncViews();
    if (importRowId && remaining > 0) redirect(`/admin/students/new?saved=${encodeURIComponent(v.admissionNumber)}`);
    redirect(wantId && !importRowId ? `/admin/students/${row.id}/id-card` : `/admin/students/${row.id}`);
  });
}

// ───────── Spreadsheet import: rows wait in a queue and autofill the form one by one ─────────
export async function uploadStudentSheet(_: ActionState, fd: FormData) {
  return run(async () => {
    await requireRole(CAN.manageSchool);
    const file = fd.get("file");
    if (!(file instanceof File) || !file.size) throw new UserError("Choose a spreadsheet (.xlsx, .xls or .csv) first.");
    if (file.size > 5 * 1024 * 1024) throw new UserError("That file is larger than 5 MB.");
    const rows = parseStudentSheet(await file.arrayBuffer());
    if (!rows.length) throw new UserError("No student rows were found. Check that the first row has column headings like “Admission No”, “First Name”, “Grade”.");
    if (rows.length > 2000) throw new UserError("Please upload at most 2000 students at a time.");

    const existing = new Set((await db.select({ a: students.admissionNumber }).from(students)).map((r) => r.a));
    const seen = new Set<string>();
    const batchId = crypto.randomUUID();
    const keep: { batchId: string; position: number; data: StudentRowData }[] = [];
    const notes: string[] = [];
    rows.forEach((r, i) => {
      if (!r.admissionNumber) { notes.push(`Row ${i + 2}: no admission number, skipped.`); return; }
      if (existing.has(r.admissionNumber)) { notes.push(`Row ${i + 2}: ${r.admissionNumber} is already in the system, skipped.`); return; }
      if (seen.has(r.admissionNumber)) { notes.push(`Row ${i + 2}: ${r.admissionNumber} appears twice in the file, skipped.`); return; }
      seen.add(r.admissionNumber);
      keep.push({ batchId, position: keep.length, data: r });
    });
    if (!keep.length) throw new UserError(`Nothing to import. ${notes[0] ?? ""}`);
    await db.update(studentImportRows).set({ status: "skipped" }).where(eq(studentImportRows.status, "pending")); // replace any older queue
    for (let i = 0; i < keep.length; i += 500) await db.insert(studentImportRows).values(keep.slice(i, i + 500));
    revalidatePath("/admin/students/new");
    return { ok: `${keep.length} student(s) queued. The form below is now filled from row 1; add each photo and email, then save to move to the next.`, details: notes.slice(0, 15) };
  });
}
export async function skipImportRow(_: ActionState, fd: FormData) {
  return run(async () => {
    await requireRole(CAN.manageSchool);
    await db.update(studentImportRows).set({ status: "skipped" }).where(eq(studentImportRows.id, int(fd, "id")));
    revalidatePath("/admin/students/new");
    return "Row skipped.";
  });
}
export async function cancelImport(_: ActionState, __: FormData) {
  return run(async () => {
    await requireRole(CAN.manageSchool);
    await db.update(studentImportRows).set({ status: "skipped" }).where(and(eq(studentImportRows.status, "pending"), ne(studentImportRows.id, 0)));
    revalidatePath("/admin/students/new");
    return "Import cancelled.";
  });
}

export async function updateStudent(_: ActionState, fd: FormData) {
  return run(async () => {
    await requireRole(CAN.manageSchool);
    const id = int(fd, "id");
    const v = parse(fd);
    const status = str(fd, "status") as "active";
    await db.update(students).set({ ...v, status }).where(eq(students.id, id));
    if (fd.get("generateId") === "1") await issueId(id);
    revalidatePath(`/admin/students/${id}`);
    syncViews();
    return "Student saved.";
  });
}

export async function issueStudentId(_: ActionState, fd: FormData) {
  return run(async () => {
    await requireRole(CAN.manageSchool);
    const id = int(fd, "id");
    await issueId(id);
    revalidatePath(`/admin/students/${id}`);
    revalidatePath(`/admin/students/${id}/id-card`);
    return "Student ID generated.";
  });
}

export async function addGuardian(_: ActionState, fd: FormData) {
  return run(async () => {
    await requireRole(CAN.manageSchool);
    const studentId = int(fd, "studentId");
    const phone = normalizePhone(need(str(fd, "phone"), "Phone number"));
    if (!/^254[17]\d{8}$/.test(phone)) throw new UserError("Enter a valid Kenyan mobile number, e.g. 0712 345 678.");
    const email = opt(fd, "email")?.toLowerCase() ?? null;
    let [g] = await db.select().from(guardians).where(eq(guardians.phone, phone));
    if (!g) [g] = await db.insert(guardians).values({ fullName: need(str(fd, "fullName"), "Guardian name"), phone, email, nationalId: opt(fd, "nationalId") }).returning();
    else if (email && !g.email) await db.update(guardians).set({ email }).where(eq(guardians.id, g.id));
    await db.insert(studentGuardian).values({ studentId, guardianId: g.id, relationship: str(fd, "relationship") as "Father" }).onConflictDoNothing();
    revalidatePath(`/admin/students/${studentId}`);
    return `${g.fullName} linked.`;
  });
}

export async function removeGuardian(_: ActionState, fd: FormData) {
  return run(async () => {
    await requireRole(CAN.manageSchool);
    const studentId = int(fd, "studentId");
    await db.delete(studentGuardian).where(and(eq(studentGuardian.studentId, studentId), eq(studentGuardian.guardianId, int(fd, "guardianId"))));
    revalidatePath(`/admin/students/${studentId}`);
    return "Guardian removed.";
  });
}
