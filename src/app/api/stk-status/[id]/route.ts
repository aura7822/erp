import { eq } from "drizzle-orm";
import { db } from "@/db";
import { stkRequests } from "@/db/schema";
import { getSession } from "@/lib/auth";
import { canViewStudent } from "@/lib/portal";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const s = await getSession();
  if (!s) return new Response("unauthorized", { status: 401 });
  const { id } = await params;
  const [r] = await db.select().from(stkRequests).where(eq(stkRequests.id, Number(id)));
  if (!r || !(await canViewStudent(s, r.studentId))) return new Response("not found", { status: 404 });
  return Response.json({ status: r.status, resultDesc: r.resultDesc });
}
