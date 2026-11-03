"use server";
import { and, eq, inArray, notInArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { classes, staff, streams, subjects, timetableSlots } from "@/db/schema";
import { effectiveAssignments } from "@/lib/assignments";
import { type ActionState, UserError, int, run, str } from "@/lib/action";
import { CAN, requireRole } from "@/lib/auth";
import { generateTimetable as generate, type Section } from "@/lib/timetable";

export async function generateTimetable(_: ActionState, fd: FormData) {
  return run(async () => {
    await requireRole(CAN.manageSchool);
    const termId = int(fd, "termId");
    const scope = str(fd, "classId");

    const cls = await db.select().from(classes).where(scope === "all" ? undefined : eq(classes.id, int(fd, "classId"))).orderBy(classes.level);
    if (!cls.length) throw new UserError("No classes found. Set up Grade 1–12 first.");
    const clsIds = cls.map((c) => c.id);
    const strs = await db.select().from(streams).where(inArray(streams.classId, clsIds));

    const sections: Section[] = cls.flatMap((c): Section[] => {
      const mine = strs.filter((s) => s.classId === c.id);
      return mine.length ? mine.map((s) => ({ classId: c.id, streamId: s.id, grade: c.level, label: `${c.className} ${s.stream}` })) : [{ classId: c.id, streamId: null, grade: c.level, label: c.className }];
    });

    const [subs, asg, teachers] = await Promise.all([
      db.select().from(subjects), effectiveAssignments(clsIds), db.select().from(staff),
    ]);
    const tName = new Map(teachers.map((t) => [t.id, t.name]));

    // Lessons already scheduled for OTHER classes keep their teachers busy
    const other = await db.select().from(timetableSlots).where(and(eq(timetableSlots.termId, termId), notInArray(timetableSlots.classId, clsIds)));
    const external = new Set(other.map((o) => `${o.teacherId}:${o.day}:${o.period}`));

    const r = generate({
      sections, subjects: subs.map((s) => ({ id: s.id, name: s.name, code: s.subjectCode, periods: s.periodsPerWeek, min: s.minGrade, max: s.maxGrade })),
      assignments: asg.map((a) => ({ subjectId: a.subjectId, classId: a.classId, streamId: a.streamId, teacherId: a.teacherId })),
      external, teacherName: (id) => tName.get(id) ?? `Teacher #${id}`,
    });
    if (!r.total) throw new UserError("Nothing to schedule yet. Assign teachers to subjects first (Academics → Subjects).");

    await db.transaction(async (tx) => {
      await tx.delete(timetableSlots).where(and(eq(timetableSlots.termId, termId), inArray(timetableSlots.classId, clsIds)));
      for (let i = 0; i < r.slots.length; i += 500) {
        await tx.insert(timetableSlots).values(r.slots.slice(i, i + 500).map((s) => ({ ...s, termId, streamKey: s.streamId ?? 0 })));
      }
    });

    revalidatePath("/admin/academics/timetable");
    const details = [...r.warnings, ...r.unplaced].slice(0, 30);
    return { ok: `Placed ${r.slots.length} of ${r.total} lessons across ${sections.length} class stream(s). No teacher or class is double-booked.${r.unplaced.length ? ` ${r.unplaced.length} lesson(s) need attention:` : ""}`, details };
  });
}

export async function clearTimetable(_: ActionState, fd: FormData) {
  return run(async () => {
    await requireRole(CAN.manageSchool);
    const termId = int(fd, "termId");
    const scope = str(fd, "classId");
    await db.delete(timetableSlots).where(and(eq(timetableSlots.termId, termId), scope === "all" ? undefined : eq(timetableSlots.classId, int(fd, "classId"))));
    revalidatePath("/admin/academics/timetable");
    return "Timetable cleared.";
  });
}
