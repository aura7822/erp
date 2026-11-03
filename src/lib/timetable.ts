import { DAYS, PERIODS } from "./constants";

export type Section = { classId: number; streamId: number | null; grade: number; label: string };
export type SubjectInfo = { id: number; name: string; code: string; periods: number; min: number; max: number };
export type Assignment = { subjectId: number; classId: number; streamId: number | null; teacherId: number };
export type PlacedSlot = { classId: number; streamId: number | null; day: number; period: number; subjectId: number; teacherId: number };
type Lesson = { sec: Section; subjectId: number; teacherId: number; core: boolean };

const D = DAYS.length, P = PERIODS;
const CORE = /(-MAT|-ENG|-KIS|-ISC|-SCI|-ADV)$/; // placed in the morning where possible

function rng(seed: number) { let a = seed >>> 0; return () => { a += 0x6d2b79f5; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const skey = (s: Section) => `${s.classId}:${s.streamId ?? 0}`;

/**
 * Greedy randomised search with restarts. Hard rules (never broken): a teacher is in one place per period, a class
 * has one lesson per period. Soft rules: spread a subject across days, core subjects in the morning.
 */
export function generateTimetable(input: {
  sections: Section[]; subjects: SubjectInfo[]; assignments: Assignment[]; external: Set<string>; teacherName: (id: number) => string;
}) {
  const { sections, subjects, assignments, external, teacherName } = input;
  const warnings: string[] = [];
  const lessons: Lesson[] = [];

  for (const sec of sections) {
    const classAssignments = assignments.filter((a) => a.classId === sec.classId);
    if (!classAssignments.length) { warnings.push(`${sec.label}: no teachers are assigned to any subject yet.`); continue; }
    let count = 0;
    for (const sub of subjects) {
      if (sec.grade < sub.min || sec.grade > sub.max) continue;
      const forSubject = classAssignments.filter((a) => a.subjectId === sub.id);
      if (!forSubject.length) continue; // subject not offered in this grade
      const a = forSubject.find((x) => x.streamId === sec.streamId) ?? forSubject.find((x) => x.streamId === null);
      if (!a) { warnings.push(`${sec.label}: ${sub.name} has no teacher for this stream.`); continue; }
      for (let i = 0; i < sub.periods; i++) { lessons.push({ sec, subjectId: sub.id, teacherId: a.teacherId, core: CORE.test(sub.code) }); count++; }
    }
    if (count > D * P) warnings.push(`${sec.label}: needs ${count} lessons a week but there are only ${D * P} periods. Reduce periods per week.`);
  }

  const load = new Map<number, number>();
  lessons.forEach((l) => load.set(l.teacherId, (load.get(l.teacherId) ?? 0) + 1));
  for (const [t, n] of load) if (n > D * P) warnings.push(`${teacherName(t)} is assigned ${n} lessons a week; the maximum is ${D * P}.`);

  let best: { slots: PlacedSlot[]; unplaced: Lesson[] } | null = null;

  for (let attempt = 0; attempt < 80; attempt++) {
    const r = rng(attempt * 7919 + 17);
    const busy = new Set(external);
    const taken = new Set<string>();
    const perDay = new Map<string, number[]>();
    const slots: PlacedSlot[] = [];
    const unplaced: Lesson[] = [];

    // most-constrained first: busiest teachers, then random
    const order = lessons.map((l) => ({ l, k: (load.get(l.teacherId) ?? 0) + r() * 3 })).sort((a, b) => b.k - a.k).map((x) => x.l);

    for (const l of order) {
      const sk = skey(l.sec), pk = `${sk}:${l.subjectId}`;
      if (!perDay.has(pk)) perDay.set(pk, new Array(D).fill(0));
      const counts = perDay.get(pk)!;
      let placed = false;
      for (const maxPerDay of [1, 2]) {
        const days = [...Array(D).keys()].sort((a, b) => counts[a] - counts[b] || r() - 0.5);
        for (const day of days) {
          if (counts[day] >= maxPerDay) continue;
          const periods = [...Array(P).keys()].sort((a, b) => (l.core ? a + r() * 2 - (b + r() * 2) : r() - 0.5));
          for (const p of periods) {
            if (taken.has(`${sk}:${day}:${p}`) || busy.has(`${l.teacherId}:${day}:${p}`)) continue;
            taken.add(`${sk}:${day}:${p}`); busy.add(`${l.teacherId}:${day}:${p}`);
            counts[day]++;
            slots.push({ classId: l.sec.classId, streamId: l.sec.streamId, day, period: p, subjectId: l.subjectId, teacherId: l.teacherId });
            placed = true; break;
          }
          if (placed) break;
        }
        if (placed) break;
      }
      if (!placed) unplaced.push(l);
    }
    if (!best || unplaced.length < best.unplaced.length) best = { slots, unplaced };
    if (!unplaced.length) break;
  }

  const subName = new Map(subjects.map((s) => [s.id, s.name]));
  const unplacedInfo = (best?.unplaced ?? []).map((l) => {
    const n = load.get(l.teacherId) ?? 0;
    const why = n > D * P ? "teacher is overloaded" : "no free period shared by the class and the teacher (teacher is busy in other classes)";
    return `${l.sec.label}: one ${subName.get(l.subjectId)} lesson with ${teacherName(l.teacherId)} couldn't be placed: ${why}.`;
  });

  return { slots: best?.slots ?? [], unplaced: unplacedInfo, warnings, total: lessons.length };
}
