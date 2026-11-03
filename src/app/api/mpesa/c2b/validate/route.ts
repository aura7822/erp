import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { students } from "@/db/schema";
import { tokenOk } from "@/lib/webhook";

// Reject unknown admission numbers BEFORE money moves. C2B00012 = invalid account number.
export async function POST(req: Request) {
  if (!tokenOk(req)) return new Response("forbidden", { status: 403 });
  const body = await req.json();
  const ref = String(body.BillRefNumber ?? "").replace(/\s+/g, "").toUpperCase();
  const [s] = await db.select({ id: students.id }).from(students).where(and(eq(students.admissionNumber, ref), eq(students.status, "active")));
  return Response.json(s ? { ResultCode: "0", ResultDesc: "Accepted" } : { ResultCode: "C2B00012", ResultDesc: "Rejected" });
}
