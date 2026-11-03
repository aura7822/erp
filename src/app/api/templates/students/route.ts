import { getSession } from "@/lib/auth";

export async function GET() {
  const s = await getSession();
  if (!s || s.role !== "admin") return new Response("forbidden", { status: 403 });
  const csv = [
    "Admission No,First Name,Last Name,Gender,Date of Birth,Grade,Stream,Date Admitted,Guardian Name,Guardian Phone,Guardian Email,Relationship",
    "1001,Amina,Wanjiku,Female,2014-03-12,Grade 4,Blue,2026-01-06,Grace Wanjiku,0712345678,grace@example.com,Mother",
  ].join("\n");
  return new Response(csv, { headers: { "Content-Type": "text/csv", "Content-Disposition": 'attachment; filename="students-template.csv"' } });
}
