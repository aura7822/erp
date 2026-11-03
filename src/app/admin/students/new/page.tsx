import { asc, count, desc, eq } from "drizzle-orm";
import { LuUserPlus } from "react-icons/lu";
import { db } from "@/db";
import { studentImportRows } from "@/db/schema";
import { PageTitle } from "@/components/Shell";
import { StudentForm } from "@/components/StudentForm";
import { ActionForm, SubmitButton } from "@/components/ui";
import { CAN, requireRole } from "@/lib/auth";
import { type StudentRowData, rowToInit } from "@/lib/import";
import { classOptions } from "@/lib/queries";
import { cancelImport, createStudent, skipImportRow, uploadStudentSheet } from "../../_actions/students";

export default async function NewStudent({ searchParams }: { searchParams: Promise<{ saved?: string; adm?: string; name?: string }> }) {
  await requireRole(CAN.manageSchool);
  const sp = await searchParams;
  const classes = await classOptions();

  // Next waiting row from an uploaded spreadsheet (in the order of the list)
  const [next] = sp.adm ? [] : await db.select().from(studentImportRows).where(eq(studentImportRows.status, "pending")).orderBy(desc(studentImportRows.batchId), asc(studentImportRows.position)).limit(1);
  const stats = next ? await db.select({ status: studentImportRows.status, n: count() }).from(studentImportRows).where(eq(studentImportRows.batchId, next.batchId)).groupBy(studentImportRows.status) : [];
  const n = (st: string) => stats.find((x) => x.status === st)?.n ?? 0;
  const total = stats.reduce((a, b) => a + b.n, 0);
  const data = next?.data as StudentRowData | undefined;

  const blank = rowToInit({}, classes);
  const [first, ...rest] = (sp.name ?? "").trim().split(/\s+/);
  const initial = data ? rowToInit(data, classes) : sp.adm ? { ...blank, admissionNumber: sp.adm, firstName: first ?? "", lastName: rest.join(" ") } : blank;
  const unmatchedGrade = data && !initial.classId && data.grade;

  return (
    <>
      <PageTitle title="Add student" back="/admin/students" icon={<LuUserPlus />} />
      {classes.length === 0 && <p className="mb-4 bg-bus-soft px-4 py-3 text-sm">No classes yet. Open <strong>Classes</strong> and click “Set up Grade 1–12” first.</p>}
      {sp.saved && <p role="status" className="mb-4 bg-ok/10 px-4 py-3 text-sm text-ok">Saved {sp.saved}. Next student from your list is ready below.</p>}

      <section className="card mb-6 p-5">
        <h2 className="font-display text-lg font-bold text-oxblood">Import from a spreadsheet</h2>
        <p className="mb-3 text-sm text-ink-mute">Upload your class list (.xlsx, .xls or .csv). Each student opens in order with their details already filled in; you only add the photo and email, then save.</p>
        <ActionForm action={uploadStudentSheet} className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
          <input type="file" name="file" accept=".xlsx,.xls,.csv" className="field !p-2" aria-label="Spreadsheet" required />
          <SubmitButton pendingText="Reading file…" className="w-full sm:w-auto">Upload list</SubmitButton>
        </ActionForm>
        <p className="mt-2 text-sm"><a href="/api/templates/students" className="font-semibold underline underline-offset-4">Download the template</a></p>
      </section>

      {next && (
        <section className="card mb-6 border-2 border-gold p-5" aria-live="polite">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div><p className="font-display text-lg font-bold text-oxblood">From your list: student {n("done") + n("skipped") + 1} of {total}</p>
              <p className="text-sm text-ink-mute">{n("done")} saved · {n("pending")} waiting{n("skipped") ? ` · ${n("skipped")} skipped` : ""}. Add the photo and email, then save to continue.</p>
              {unmatchedGrade && <p className="mt-1 text-sm text-alert">The grade “{data!.grade}” in the file doesn&apos;t match a class here. Choose the class below.</p>}
              {data?.guardianName && <p className="mt-1 text-sm text-ink-mute">Guardian from the file: {data.guardianName}{data.guardianPhone ? ` · ${data.guardianPhone}` : ""} (linked automatically on save)</p>}</div>
            <div className="flex gap-2">
              <ActionForm action={skipImportRow}><input type="hidden" name="id" value={next.id} /><SubmitButton size="sm" variant="ghost">Skip this one</SubmitButton></ActionForm>
              <ActionForm action={cancelImport}><SubmitButton size="sm" variant="danger" confirm="Cancel the import? Students not yet saved will be dropped from the list.">Cancel import</SubmitButton></ActionForm>
            </div>
          </div>
        </section>
      )}

      <StudentForm key={next?.id ?? sp.adm ?? "blank"} classes={classes} action={createStudent} submitLabel={next ? "Save & next" : "Create student"} cancelHref="/admin/students" initial={initial} importRowId={next?.id} />
    </>
  );
}
