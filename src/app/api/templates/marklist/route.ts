import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { classes, students, subjects } from "@/db/schema";
import { getSession } from "@/lib/auth";

/** A ready-to-fill marklist: the class's students down the side and the grade's subjects across the top. */
export async function GET(req: Request) {
  const s = await getSession();
  if (!s || !["admin", "principal", "teacher"].includes(s.role)) return new Response("forbidden", { status: 403 });
  const classId = Number(new URL(req.url).searchParams.get("classId"));
  const [c] = await db.select().from(classes).where(eq(classes.id, classId));
  if (!c) return new Response("not found", { status: 404 });
  const subs = (await db.select().from(subjects)).filter((x) => c.level >= x.minGrade && c.level <= x.maxGrade);
  const list = await db.select().from(students).where(and(eq(students.classId, classId), eq(students.status, "active"))).orderBy(students.admissionNumber);
  const q = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const csv = [["Admission No", "Name", ...subs.map((x) => x.name)].map(q).join(","), ...list.map((st) => [st.admissionNumber, `${st.firstName} ${st.lastName}`, ...subs.map(() => "")].map(q).join(","))].join("\n");
  return new Response(csv, { headers: { "Content-Type": "text/csv", "Content-Disposition": `attachment; filename="marklist-${c.className.replace(/\s+/g, "")}.csv"` } });
}
