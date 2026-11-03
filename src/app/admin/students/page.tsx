import { LuUsers } from "react-icons/lu";
import Link from "next/link";
import { and, count, eq, gte, ilike, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { classes, streams, students } from "@/db/schema";
import { BarChart, monthKeys } from "@/components/charts";
import { PageTitle } from "@/components/Shell";
import { CAN, getSession } from "@/lib/auth";

export default async function StudentsPage({ searchParams }: { searchParams: Promise<{ q?: string; c?: string }> }) {
  const sp = await searchParams;
  const s = await getSession();
  const q = sp.q?.trim();
  const months = monthKeys(12);
  const [rows, cls, adm] = await Promise.all([
    db.select({ id: students.id, adm: students.admissionNumber, first: students.firstName, last: students.lastName, photo: students.photoUrl, idNo: students.idNumber, cls: classes.className, stream: streams.stream, status: students.status })
      .from(students).innerJoin(classes, eq(classes.id, students.classId)).leftJoin(streams, eq(streams.id, students.streamId))
      .where(and(q ? or(ilike(students.admissionNumber, `%${q}%`), ilike(students.firstName, `%${q}%`), ilike(students.lastName, `%${q}%`)) : undefined, sp.c ? eq(students.classId, Number(sp.c)) : undefined))
      .orderBy(classes.level, students.firstName).limit(200),
    db.select().from(classes).orderBy(classes.level),
    db.select({ m: sql<string>`to_char(${students.admittedOn}, 'YYYY-MM')`, n: count() }).from(students).where(gte(students.admittedOn, months[0].key + "-01")).groupBy(sql`1`),
  ]);

  return (
    <>
      <PageTitle icon={<LuUsers />} title="Students" sub={`${rows.length} shown`} back="/admin">
        {s && CAN.manageSchool.includes(s.role) && <Link href="/admin/students/new" className="btn-primary">Add student</Link>}
      </PageTitle>

      <section className="card mb-6 p-5">
        <h2 className="font-display text-lg font-bold">Admission rate</h2>
        <p className="mb-3 text-sm text-ink-mute">Students admitted per month, last 12 months</p>
        <BarChart label="Admissions per month" data={months.map((m) => ({ label: m.label, value: adm.find((a) => a.m === m.key)?.n ?? 0 }))} fmt={(n) => String(n)} />
      </section>

      <form className="mb-4 flex flex-wrap gap-3">
        <input name="q" defaultValue={q} placeholder="Search name or admission no." className="field max-w-xs" aria-label="Search" />
        <select name="c" defaultValue={sp.c ?? ""} className="field max-w-[180px]" aria-label="Class"><option value="">All classes</option>{cls.map((c) => <option key={c.id} value={c.id}>{c.className}</option>)}</select>
        <button className="btn-ghost">Filter</button>
      </form>

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr><th className="th">Student</th><th className="th">Adm. no.</th><th className="th">Class</th><th className="th">ID</th><th className="th">Status</th><th className="th" /></tr></thead>
          <tbody className="divide-y divide-paper-line/70">
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="td"><div className="flex items-center gap-3">
                  <div className="h-10 w-10 shrink-0 overflow-hidden rounded-full bg-bus-soft">{r.photo ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={r.photo} alt="" className="h-full w-full object-cover" /> : <span className="grid h-full place-items-center text-xs font-bold text-bus-deep">{r.first[0]}{r.last[0]}</span>}</div>
                  <span className="font-medium">{r.first} {r.last}</span></div></td>
                <td className="td tabular-nums">{r.adm}</td><td className="td">{r.cls} {r.stream}</td>
                <td className="td tabular-nums text-ink-mute">{r.idNo ?? "-"}</td>
                <td className="td"><span className={`chip ${r.status === "active" ? "text-ok" : r.status === "suspended" ? "text-alert" : "text-ink-mute"}`}>{r.status}</span></td>
                <td className="td text-right"><Link className="btn-ghost btn-sm" href={`/admin/students/${r.id}`}>Open</Link></td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={6} className="td text-ink-mute">No students found.</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}
