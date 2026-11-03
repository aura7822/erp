import { sql } from "drizzle-orm";
import { CBC_SUBJECTS } from "../lib/cbc";
import { db } from "./index";
import { academicYears, classes, feeStructures, streams, subjects, terms } from "./schema";

async function ensureSchemaCompatibility() {
  await db.execute(sql`ALTER TABLE "staff" ADD COLUMN IF NOT EXISTS "kind" "staff_kind" NOT NULL DEFAULT 'teaching';`);
  await db.execute(sql`ALTER TABLE "staff" ADD COLUMN IF NOT EXISTS "employment_type" "employment_type";`);
  await db.execute(sql`ALTER TABLE "staff" ADD COLUMN IF NOT EXISTS "job_title" text;`);
}

async function ensureSeedIndexes() {
  await db.execute(sql`
    CREATE UNIQUE INDEX IF NOT EXISTS academic_years_year_unique ON academic_years (year);
  `);
  await db.execute(sql`
    CREATE UNIQUE INDEX IF NOT EXISTS terms_academic_year_id_term_name_unique ON terms (academic_year_id, term_name);
  `);
  await db.execute(sql`
    CREATE UNIQUE INDEX IF NOT EXISTS classes_class_name_unique ON classes (class_name);
  `);
  await db.execute(sql`
    CREATE UNIQUE INDEX IF NOT EXISTS streams_class_id_stream_unique ON streams (class_id, stream);
  `);
  await db.execute(sql`
    CREATE UNIQUE INDEX IF NOT EXISTS subjects_subject_code_unique ON subjects (subject_code);
  `);
  await db.execute(sql`
    CREATE UNIQUE INDEX IF NOT EXISTS fee_structures_class_term_feehead_unique ON fee_structures (class_id, term_id, fee_head);
  `);
}

async function main() {
  await ensureSchemaCompatibility();
  await ensureSeedIndexes();
  const year = new Date().getFullYear();
  const [y] = await db.insert(academicYears).values({ year, isCurrent: true }).onConflictDoUpdate({ target: academicYears.year, set: { isCurrent: true } }).returning();
  const [t] = await db.insert(terms).values({ academicYearId: y.id, termName: "Term 1", startDate: `${year}-01-05`, endDate: `${year}-04-10`, isCurrent: true })
    .onConflictDoUpdate({ target: [terms.academicYearId, terms.termName], set: { isCurrent: true } }).returning();
  await db.insert(terms).values([
    { academicYearId: y.id, termName: "Term 2", startDate: `${year}-05-01`, endDate: `${year}-08-07` },
    { academicYearId: y.id, termName: "Term 3", startDate: `${year}-08-28`, endDate: `${year}-10-30` },
  ]).onConflictDoNothing();

  for (let g = 1; g <= 12; g++) {
    const [c] = await db.insert(classes).values({ className: `Grade ${g}`, level: g }).onConflictDoUpdate({ target: classes.className, set: { level: g } }).returning();
    for (const s of ["Blue", "Green"]) await db.insert(streams).values({ classId: c.id, stream: s }).onConflictDoNothing();
    for (const [feeHead, amount] of [["Tuition", 15000 + g * 1500], ["Meals", 6000], ["Activities", 2000]] as const) {
      await db.insert(feeStructures).values({ classId: c.id, termId: t.id, feeHead, amount: String(amount), dueDate: `${year}-02-15` }).onConflictDoNothing();
    }
  }
  await db.insert(subjects).values(CBC_SUBJECTS.map((s) => ({ subjectCode: s.code, name: s.name, category: s.category, minGrade: s.min, maxGrade: s.max, periodsPerWeek: s.periods }))).onConflictDoNothing();

  console.log("Seeded: current year with 3 terms, Grade 1-12 (Blue/Green streams), sample fees, CBC subjects");
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
