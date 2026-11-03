import { renderToBuffer } from "@react-pdf/renderer";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { academicYears, classes, feeStructures, students, terms } from "@/db/schema";
import { getSession } from "@/lib/auth";
import { canViewStudent } from "@/lib/portal";
import { FeeStructureDoc } from "@/lib/pdf/documents";

export const runtime = "nodejs";

export async function GET(_: Request, { params }: { params: Promise<{ uuid: string; termId: string }> }) {
  const { uuid, termId } = await params;
  const session = await getSession();
  if (!session) return new Response("unauthorized", { status: 401 });
  if (!/^[0-9a-f-]{36}$/i.test(uuid)) return new Response("not found", { status: 404 });

  const [st] = await db.select({ id: students.id, adm: students.admissionNumber, classId: students.classId, className: classes.className })
    .from(students).innerJoin(classes, eq(classes.id, students.classId)).where(eq(students.uuid, uuid));
  if (!st || !(await canViewStudent(session, st.id))) return new Response("not found", { status: 404 });

  const [t] = await db.select({ name: terms.termName, year: academicYears.year }).from(terms)
    .innerJoin(academicYears, eq(academicYears.id, terms.academicYearId)).where(eq(terms.id, Number(termId)));
  if (!t) return new Response("not found", { status: 404 });

  const fees = await db.select().from(feeStructures).where(and(eq(feeStructures.classId, st.classId), eq(feeStructures.termId, Number(termId))));
  const buf = await renderToBuffer(
    <FeeStructureDoc className={st.className} term={t.name} year={t.year} admission={st.adm}
      fees={fees.map((f) => ({ head: f.feeHead, due: f.dueDate, amount: f.amount }))} />,
  );
  return new Response(new Uint8Array(buf), { headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="fee-structure.pdf"` } });
}
