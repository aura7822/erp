import { count, eq } from "drizzle-orm";
import { db } from "@/db";
import { classes, staff, streams, students } from "@/db/schema";
import { ClassCard, type ClassData } from "@/components/ClassCard";
import { PageTitle } from "@/components/Shell";
import { ActionForm, AutoRefresh, SubmitButton } from "@/components/ui";
import { LuSchool } from "react-icons/lu";
import { CAN, requireRole } from "@/lib/auth";
import { ensureGrades } from "../_actions/school";

export default async function ClassesPage() {
  const s = await requireRole(["admin", "principal"]);
  const [cls, st, stf, byStream, roster] = await Promise.all([
    db.select().from(classes).orderBy(classes.level), db.select().from(streams).orderBy(streams.stream),
    db.select({ id: staff.id, name: staff.name }).from(staff).where(eq(staff.status, "active")).orderBy(staff.name),
    db.select({ stream: students.streamId, cls: students.classId, n: count() }).from(students).where(eq(students.status, "active")).groupBy(students.streamId, students.classId),
    db.select({ id: students.id, f: students.firstName, l: students.lastName, adm: students.admissionNumber, cls: students.classId, stream: students.streamId }).from(students).where(eq(students.status, "active")).orderBy(students.firstName),
  ]);
  const name = (id: number | null) => stf.find((t) => t.id === id)?.name ?? null;
  const data: ClassData[] = cls.map((c) => ({
    id: c.id, name: c.className, level: c.level, teacherId: c.classTeacherId, teacherName: name(c.classTeacherId),
    students: roster.filter((x) => x.cls === c.id).map((x) => ({ id: x.id, name: `${x.f} ${x.l}`, adm: x.adm, streamId: x.stream })),
    total: byStream.filter((b) => b.cls === c.id).reduce((a, b) => a + b.n, 0),
    streams: st.filter((x) => x.classId === c.id).map((x) => ({ id: x.id, name: x.stream, teacherId: x.classTeacherId, teacherName: name(x.classTeacherId), count: byStream.find((b) => b.stream === x.id)?.n ?? 0 })),
  }));
  const haveAll = Array.from({ length: 12 }, (_, i) => `Grade ${i + 1}`).every((g) => cls.some((c) => c.className === g));

  return (
    <>
      <PageTitle title="Classes & streams" sub="Grade 1 to Grade 12 · updates automatically as students are added" back="/admin" icon={<LuSchool />} />
      <AutoRefresh seconds={30} />
      {!haveAll && CAN.manageSchool.includes(s.role) && (
        <ActionForm action={ensureGrades} className="card mb-6 flex flex-wrap items-center gap-4 p-4">
          <p className="flex-1 text-sm">Some grades are missing. Create Grade 1 to Grade 12 in one click.</p>
          <SubmitButton pendingText="Creating…">Set up Grade 1–12</SubmitButton>
        </ActionForm>
      )}
      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
        {data.map((c) => <ClassCard key={c.id} c={c} teachers={stf} canEdit={CAN.manageSchool.includes(s.role)} />)}
      </div>
    </>
  );
}
