import { LuCalendarCheck } from "react-icons/lu";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { attendance, classes, streams, students, subjectTeacher } from "@/db/schema";
import { AttendanceGrid } from "@/components/AttendanceGrid";
import { PageTitle } from "@/components/Shell";
import { CAN, requireRole } from "@/lib/auth";
import { myStaff } from "@/lib/portal";

export default async function AttendancePage({ searchParams }: { searchParams: Promise<{ c?: string; d?: string }> }) {
  const s = await requireRole(CAN.teach);
  const sp = await searchParams;
  const today = new Date().toISOString().slice(0, 10);
  const date = /^\d{4}-\d{2}-\d{2}$/.test(sp.d ?? "") && sp.d! <= today ? sp.d! : today;

  let ids: number[] | null = null;
  if (s.role !== "admin") {
    const me = await myStaff(s);
    if (me) {
      const t = await db.select({ c: subjectTeacher.classId }).from(subjectTeacher).where(eq(subjectTeacher.teacherId, me.id));
      const h = await db.select({ c: streams.classId }).from(streams).where(eq(streams.classTeacherId, me.id));
      ids = [...new Set([...t, ...h].map((r) => r.c))];
    } else ids = [];
  }
  const cls = await db.select().from(classes).where(ids ? (ids.length ? inArray(classes.id, ids) : eq(classes.id, -1)) : undefined).orderBy(classes.level);
  const cur = cls.find((c) => c.id === Number(sp.c)) ?? cls[0];

  let roster: { id: number; name: string; adm: string; status: "present" | "late" | "excused" | "absent" }[] = [];
  if (cur) {
    const st = await db.select().from(students).where(and(eq(students.classId, cur.id), eq(students.status, "active"))).orderBy(students.firstName);
    const saved = await db.select().from(attendance).where(and(eq(attendance.classId, cur.id), eq(attendance.date, date)));
    const m = new Map(saved.map((r) => [r.studentId, r.status]));
    roster = st.map((x) => ({ id: x.id, name: `${x.firstName} ${x.lastName}`, adm: x.admissionNumber, status: m.get(x.id) ?? "present" }));
  }

  return (
    <>
      <PageTitle icon={<LuCalendarCheck />} title="Attendance register" />
      {cls.length === 0 ? <p className="card p-6 text-ink-mute">No classes are assigned to you yet.</p> : (
        <>
          <form className="card grid gap-4 p-4 sm:grid-cols-[1fr_200px_auto] sm:items-end">
            <div><label className="label" htmlFor="c">Class</label><select id="c" name="c" defaultValue={cur?.id} className="field">{cls.map((c) => <option key={c.id} value={c.id}>{c.className}</option>)}</select></div>
            <div><label className="label" htmlFor="d">Date</label><input id="d" type="date" name="d" defaultValue={date} max={today} className="field" /></div>
            <button className="btn-ghost">Load</button>
          </form>
          {cur && (roster.length ? <AttendanceGrid key={`${cur.id}-${date}`} classId={cur.id} date={date} students={roster} /> : <p className="mt-4 text-ink-mute">No active students in this class.</p>)}
        </>
      )}
    </>
  );
}
