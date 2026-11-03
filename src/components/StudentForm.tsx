"use client";
import Link from "next/link";
import { useActionState, useEffect, useState } from "react";
import { FormMessage, SubmitButton } from "./ui";
import type { ActionState } from "@/lib/action";

export type ClassOpt = { id: number; name: string; streams: { id: number; name: string }[] };
export type StudentInit = {
  id?: number; admissionNumber: string; firstName: string; lastName: string; gender: string; dob: string;
  classId: number | ""; streamId: number | ""; admittedOn: string; email: string; status?: string; photo: string | null; hasId?: boolean;
};

/** Crop to a 4:5 passport frame and shrink to ~30 KB so it can live in the database. */
async function toPassport(file: File): Promise<string> {
  const bmp = await createImageBitmap(file);
  const W = 360, H = 450;
  const c = document.createElement("canvas");
  c.width = W; c.height = H;
  const ctx = c.getContext("2d")!;
  const s = Math.max(W / bmp.width, H / bmp.height);
  const w = bmp.width * s, h = bmp.height * s;
  ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, W, H);
  ctx.drawImage(bmp, (W - w) / 2, (H - h) * 0.3, w, h); // bias upward so faces aren't cut off
  return c.toDataURL("image/jpeg", 0.82);
}

export function StudentForm({ classes, action, initial, submitLabel, cancelHref, importRowId }: {
  classes: ClassOpt[]; action: (p: ActionState, fd: FormData) => Promise<ActionState>; initial: StudentInit; submitLabel: string; cancelHref: string; importRowId?: number;
}) {
  const [state, formAction] = useActionState(action, null);
  const [v, setV] = useState(initial);
  const [gen, setGen] = useState(false);
  const [photoErr, setPhotoErr] = useState<string | null>(null);
  const cls = classes.find((c) => c.id === Number(v.classId));
  const streamNeeded = !!cls?.streams.length;
  const complete = !!(v.admissionNumber.trim() && v.firstName.trim() && v.lastName.trim() && v.gender && v.dob && v.classId && v.admittedOn && v.photo && (!streamNeeded || v.streamId));
  useEffect(() => { if (!complete) setGen(false); }, [complete]);

  const set = (k: keyof StudentInit) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setV((p) => ({ ...p, [k]: e.target.value }));
  const onPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    setPhotoErr(null);
    if (!f) return;
    if (!f.type.startsWith("image/")) return setPhotoErr("Please choose an image file (JPG or PNG).");
    if (f.size > 10 * 1024 * 1024) return setPhotoErr("That image is too large (10 MB max).");
    try { setV((p) => ({ ...p, photo: null })); const url = await toPassport(f); setV((p) => ({ ...p, photo: url })); }
    catch { setPhotoErr("We couldn't read that image. Try another photo."); }
  };

  return (
    <form action={formAction} className="card grid gap-5 p-5 sm:p-6 lg:grid-cols-[220px_1fr]">
      {v.id && <input type="hidden" name="id" value={v.id} />}
      {importRowId && <input type="hidden" name="importRowId" value={importRowId} />}
      <input type="hidden" name="photo" value={v.photo ?? ""} />

      {/* Passport photo */}
      <div>
        <p className="label">Passport photo</p>
        <div className="grid aspect-[4/5] w-full max-w-[220px] place-items-center overflow-hidden rounded-2xl" style={{ background: "#e9e2c8", boxShadow: "var(--clay-in)" }}>
          {v.photo ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={v.photo} alt="Student passport preview" className="h-full w-full object-cover" />
            : <span className="px-4 text-center text-sm text-ink-mute">No photo yet.<br />Required for an ID card.</span>}
        </div>
        <label className="btn-ghost btn-sm mt-3 cursor-pointer">
          {v.photo ? "Change photo" : "Upload photo"}
          <input type="file" accept="image/*" className="sr-only" onChange={onPhoto} />
        </label>
        {v.photo && <button type="button" className="ml-2 text-xs text-alert underline" onClick={() => setV((p) => ({ ...p, photo: null }))}>Remove</button>}
        {photoErr && <p role="alert" className="mt-2 text-sm text-alert">{photoErr}</p>}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div><label className="label" htmlFor="adm">Admission number</label><input id="adm" name="admissionNumber" value={v.admissionNumber} onChange={set("admissionNumber")} className="field" required /></div>
        <div><label className="label" htmlFor="adt">Date admitted</label><input id="adt" type="date" name="admittedOn" value={v.admittedOn} onChange={set("admittedOn")} className="field" required /></div>
        <div><label className="label" htmlFor="fn">First name</label><input id="fn" name="firstName" value={v.firstName} onChange={set("firstName")} className="field" required /></div>
        <div><label className="label" htmlFor="ln">Last name</label><input id="ln" name="lastName" value={v.lastName} onChange={set("lastName")} className="field" required /></div>
        <div><label className="label" htmlFor="g">Gender</label>
          <select id="g" name="gender" value={v.gender} onChange={set("gender")} className="field" required><option value="" disabled>Choose…</option><option value="male">Male</option><option value="female">Female</option></select></div>
        <div><label className="label" htmlFor="dob">Date of birth</label><input id="dob" type="date" name="dob" value={v.dob} onChange={set("dob")} className="field" required /></div>
        <div><label className="label" htmlFor="cls">Class</label>
          <select id="cls" name="classId" value={v.classId} onChange={(e) => setV((p) => ({ ...p, classId: Number(e.target.value), streamId: "" }))} className="field" required>
            <option value="" disabled>Grade 1 – Grade 12</option>{classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select></div>
        <div><label className="label" htmlFor="str">Stream</label>
          <select id="str" name="streamId" value={v.streamId} onChange={set("streamId")} className="field" disabled={!cls} required={streamNeeded}>
            <option value="">{!cls ? "Choose a class first" : streamNeeded ? "Choose a stream…" : "This class has no streams"}</option>
            {cls?.streams.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select></div>
        <div><label className="label" htmlFor="em">Student email (optional)</label><input id="em" type="email" name="email" value={v.email} onChange={set("email")} className="field" /></div>
        {v.id && <div><label className="label" htmlFor="stt">Status</label>
          <select id="stt" name="status" value={v.status} onChange={set("status")} className="field">{["active", "graduated", "suspended", "transferred"].map((x) => <option key={x}>{x}</option>)}</select></div>}

        {!v.hasId && (
          <div className={`rounded-2xl p-4 sm:col-span-2 ${complete ? "bg-bus-soft" : "bg-paper-dark/60"}`}>
            <label className={`flex items-start gap-3 ${complete ? "cursor-pointer" : "cursor-not-allowed opacity-70"}`}>
              <input type="checkbox" name="generateId" value="1" checked={gen} disabled={!complete} onChange={(e) => setGen(e.target.checked)} className="mt-1 h-4 w-4 accent-[#550605]" />
              <span><span className="font-semibold">Generate student ID card</span>
                <span className="block text-sm text-ink-mute">{complete ? "Creates an ID number, issue and expiry dates you can print right after saving." : "Fill in every detail (including class, stream and photo) to enable this."}</span></span>
            </label>
          </div>
        )}

        <div className="flex flex-wrap gap-3 sm:col-span-2">
          <SubmitButton pendingText="Saving…" className="w-full sm:w-auto">{submitLabel}</SubmitButton>
          <Link href={cancelHref} className="btn-ghost w-full sm:w-auto">Cancel</Link>
        </div>
        <FormMessage state={state} />
      </div>
    </form>
  );
}
