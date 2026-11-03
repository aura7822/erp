import { renderToBuffer } from "@react-pdf/renderer";
import { getSession } from "@/lib/auth";
import { ReportCardsDoc } from "@/lib/pdf/documents";
import { reportCardsForClass } from "@/lib/reportcard";

export const runtime = "nodejs";
export const maxDuration = 60;
const EXAMS = ["Opener", "Mid-Term", "End-Term"] as const;

export async function GET(_: Request, { params }: { params: Promise<{ classId: string; termId: string; exam: string }> }) {
  const { classId, termId, exam } = await params;
  const s = await getSession();
  if (!s || !["admin", "principal", "teacher"].includes(s.role)) return new Response("forbidden", { status: 403 });
  const examType = EXAMS.find((e) => e === decodeURIComponent(exam));
  if (!examType) return new Response("not found", { status: 404 });
  const cards = await reportCardsForClass(Number(classId), Number(termId), examType);
  if (!cards.length) return new Response("No results have been entered for that class and exam.", { status: 404 });
  const buf = await renderToBuffer(<ReportCardsDoc cards={cards} />);
  return new Response(new Uint8Array(buf), { headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="report-cards-${cards[0].student.className.replace(/\s+/g, "")}-${examType}.pdf"` } });
}
