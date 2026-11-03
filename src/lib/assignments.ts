import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { classes, staff, staffGrades, staffSubjects, streams, subjectTeacher, subjects } from "@/db/schema";

export type EffAssignment = { subjectId: number; classId: number; streamId: number | null; teacherId: number; source: "manual" | "profile"; manualId?: number };

/**
 * Who teaches what, per grade and stream.
 *  1. Manual assignments (Academics → Subjects) always win.
 *  2. Every other (subject, class, stream) is filled from teacher profiles: a teacher who lists the subject AND the grade
 *     is a candidate; with several candidates the streams are shared out so lesson loads stay balanced.
 */
export async function effectiveAssignments(classIds?: number[]): Promise<EffAssignment[]> {
  const scope = classIds && classIds.length ? classIds : null;
  const [cls, strs, subs, manual, ss, sg, teachers] = await Promise.all([
    db.select().from(classes).where(scope ? inArray(classes.id, scope) : undefined).orderBy(classes.level),
    db.select().from(streams), db.select().from(subjects),
    db.select().from(subjectTeacher).where(scope ? inArray(subjectTeacher.classId, scope) : undefined),
    db.select().from(staffSubjects), db.select().from(staffGrades),
    db.select({ id: staff.id }).from(staff).where(and(eq(staff.status, "active"), eq(staff.kind, "teaching"))),
  ]);
  const active = new Set(teachers.map((t) => t.id));
  const subjOf = new Map<number, Set<number>>(), gradeOf = new Map<number, Set<number>>();
  for (const r of ss) if (active.has(r.staffId)) (subjOf.get(r.staffId) ?? subjOf.set(r.staffId, new Set()).get(r.staffId)!).add(r.subjectId);
  for (const r of sg) if (active.has(r.staffId)) (gradeOf.get(r.staffId) ?? gradeOf.set(r.staffId, new Set()).get(r.staffId)!).add(r.classId);

  const out: EffAssignment[] = manual.map((m) => ({ subjectId: m.subjectId, classId: m.classId, streamId: m.streamId, teacherId: m.teacherId, source: "manual", manualId: m.id }));
  const periods = new Map(subs.map((s) => [s.id, s.periodsPerWeek]));
  const load = new Map<number, number>();
  const add = (t: number, n: number) => load.set(t, (load.get(t) ?? 0) + n);
  for (const m of manual) { const n = strs.filter((x) => x.classId === m.classId).length || 1; add(m.teacherId, (periods.get(m.subjectId) ?? 3) * (m.streamId ? 1 : n)); }

  for (const sub of [...subs].sort((a, b) => b.periodsPerWeek - a.periodsPerWeek)) {
    for (const c of cls) {
      if (c.level < sub.minGrade || c.level > sub.maxGrade) continue;
      const candidates = [...subjOf.entries()].filter(([t, set]) => set.has(sub.id) && gradeOf.get(t)?.has(c.id)).map(([t]) => t);
      if (!candidates.length) continue;
      const sections = strs.filter((x) => x.classId === c.id).map((x) => x.id);
      for (const sec of sections.length ? sections : [null]) {
        const covered = manual.some((m) => m.subjectId === sub.id && m.classId === c.id && (m.streamId === sec || m.streamId === null));
        if (covered) continue;
        const pick = [...candidates].sort((a, b) => (load.get(a) ?? 0) - (load.get(b) ?? 0) || a - b)[0];
        out.push({ subjectId: sub.id, classId: c.id, streamId: sec, teacherId: pick, source: "profile" });
        add(pick, sub.periodsPerWeek);
      }
    }
  }
  return out;
}
