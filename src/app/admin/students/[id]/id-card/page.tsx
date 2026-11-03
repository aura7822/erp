import { notFound } from "next/navigation";
import QRCode from "qrcode";
import { eq } from "drizzle-orm";
import { LuContact } from "react-icons/lu";
import { db } from "@/db";
import { classes, streams, students } from "@/db/schema";
import { PageTitle } from "@/components/Shell";
import { ActionForm, PrintButton, SubmitButton } from "@/components/ui";
import { CAN, STAFF_VIEW, getSession, requireRole } from "@/lib/auth";
import { fmtDate } from "@/lib/constants";
import { idMissing } from "@/lib/student-id";
import { issueStudentId } from "../../../_actions/students";

export default async function IdCard({ params }: { params: Promise<{ id: string }> }) {
  await requireRole(STAFF_VIEW);
  const session = await getSession();
  const { id } = await params;
  const [s] = await db.select({ st: students, cls: classes.className, stream: streams.stream }).from(students)
    .innerJoin(classes, eq(classes.id, students.classId)).leftJoin(streams, eq(streams.id, students.streamId)).where(eq(students.id, Number(id)));
  if (!s) notFound();
  const { st } = s;
  const missing = await idMissing(st);
  const canIssue = !!session && CAN.manageSchool.includes(session.role);
  const back = `/admin/students/${st.id}`;
  const school = process.env.SCHOOL_NAME ?? "School";

  if (!st.idNumber) {
    return (
      <>
        <PageTitle title="Student ID card" back={back} icon={<LuContact />} />
        <div className="card max-w-xl p-6">
          <p className="font-semibold">No ID has been generated for {st.firstName} yet.</p>
          <p className="mt-1 text-sm text-ink-mute">{missing.length ? `Complete these details first: ${missing.join(", ")}.` : "All details are on file."}</p>
          {canIssue && <ActionForm action={issueStudentId} className="mt-4"><input type="hidden" name="id" value={st.id} /><SubmitButton disabled={missing.length > 0}>Generate ID</SubmitButton></ActionForm>}
        </div>
      </>
    );
  }

  const svg = await QRCode.toString(`${process.env.APP_URL}/portal?s=${st.uuid}`, { type: "svg", margin: 0, width: 160, color: { dark: "#550605", light: "#0000" } });

  return (
    <>
      <style>{`@media print { @page { size: 85.6mm 54mm; margin: 0 } html, body { background: #fff !important; } }`}</style>
      <PageTitle title="Student ID card" sub="Single-sided · CR80 size (85.6 × 54 mm). In the print dialog set margins to None and scale to 100%." back={back} icon={<LuContact />}>
        <PrintButton label="Print ID" />
        {canIssue && <ActionForm action={issueStudentId}><input type="hidden" name="id" value={st.id} /><SubmitButton variant="ghost" confirm="Re-issue this ID with new issue and expiry dates?">Re-issue</SubmitButton></ActionForm>}
      </PageTitle>

      <div className="grid place-items-center py-6 print:block print:p-0">
        <div className="[zoom:1.9] sm:[zoom:2.2] print:[zoom:1]">
          <div className="relative h-[54mm] w-[85.6mm] overflow-hidden bg-[#F3EEDB] text-[#2E0907] shadow-xl print:shadow-none" style={{ WebkitPrintColorAdjust: "exact", printColorAdjust: "exact" }}>
            <div className="flex h-[9.5mm] items-center justify-between bg-[#550605] px-[4mm] text-[#F3E7C2]">
              <span className="font-display text-[3.5mm] font-bold leading-none">{school}</span>
              <span className="text-[2.1mm] font-semibold uppercase tracking-[0.25em] text-[#D8A93D]">Student ID</span>
            </div>
            <div className="h-[0.8mm] bg-[#D8A93D]" />
            <div className="grid grid-cols-[22mm_1fr_17mm] gap-[3mm] px-[4mm] pt-[2.6mm]">
              <div className="h-[26.5mm] w-[22mm] overflow-hidden border-[0.4mm] border-[#C0B281] bg-white">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {st.photoUrl && <img src={st.photoUrl} alt="" className="h-full w-full object-cover" />}
              </div>
              <div className="min-w-0 text-[2.5mm] leading-[1.45]">
                <p className="font-display text-[3.9mm] font-bold leading-tight text-[#550605]">{st.firstName} {st.lastName}</p>
                <dl className="mt-[1.2mm] grid grid-cols-[auto_1fr] gap-x-[1.5mm]">
                  <dt className="text-[#6F5F3F]">Adm. no.</dt><dd className="font-semibold">{st.admissionNumber}</dd>
                  <dt className="text-[#6F5F3F]">Class</dt><dd className="font-semibold">{s.cls} {s.stream}</dd>
                  <dt className="text-[#6F5F3F]">Admitted</dt><dd className="font-semibold">{fmtDate(st.admittedOn)}</dd>
                  <dt className="text-[#6F5F3F]">Expires</dt><dd className="font-semibold text-[#550605]">{fmtDate(st.idExpiresAt)}</dd>
                </dl>
              </div>
              <div className="pt-[0.5mm] text-center"><div className="mx-auto h-[15mm] w-[15mm] [&>svg]:h-full [&>svg]:w-full" dangerouslySetInnerHTML={{ __html: svg }} /><p className="mt-[0.8mm] text-[1.8mm] text-[#6F5F3F]">Scan for fees<br />&amp; results</p></div>
            </div>
            <div className="absolute inset-x-0 bottom-0 bg-[#550605] px-[4mm] py-[1.2mm] text-[#F3E7C2]">
              <p className="text-[1.95mm] leading-tight">If found, please return this card to {school}.</p>
              <p className="mt-[0.3mm] flex justify-between text-[1.95mm] leading-tight text-[#D8A93D]"><span className="font-semibold tracking-wider">ID {st.idNumber}</span><span>Issued {fmtDate(st.idIssuedAt)}</span></p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
