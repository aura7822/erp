import { renderToBuffer } from "@react-pdf/renderer";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { students } from "@/db/schema";
import { getSession } from "@/lib/auth";
import { canViewStudent } from "@/lib/portal";
import { reportCardData } from "@/lib/reportcard";
import { ReportCardDoc } from "@/lib/pdf/documents";

export const runtime = "nodejs";
const EXAMS = ["Opener", "Mid-Term", "End-Term"] as const;

export async function GET(_: Request, { params }: { params: Promise<{ uuid: string; termId: string; exam: string }> }) {
  const { uuid, termId, exam } = await params;
  const session = await getSession();
  if (!session) return new Response("unauthorized", { status: 401 });
  const examType = EXAMS.find((e) => e === decodeURIComponent(exam));
  if (!examType || !/^[0-9a-f-]{36}$/i.test(uuid)) return new Response("not found", { status: 404 });

  const [st] = await db.select({ id: students.id, adm: students.admissionNumber }).from(students).where(eq(students.uuid, uuid));
  // 404 (not 403) so we don't reveal which records exist
  if (!st || !(await canViewStudent(session, st.id))) return new Response("not found", { status: 404 });

  const data = await reportCardData(st.id, Number(termId), examType);
  if (!data) return new Response("not found", { status: 404 });

  const buf = await renderToBuffer(<ReportCardDoc d={data} />);
  return new Response(new Uint8Array(buf), {
    headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="report-card-${st.adm}-${examType}.pdf"` },
  });
}
