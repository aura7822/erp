"use client";
import { ActionForm, Modal, SubmitButton } from "./ui";
import { addStream, deleteStream, updateClass, updateStream } from "@/app/admin/_actions/school";
import { STREAM_COLOURS, STREAM_NAMES } from "@/lib/constants";

export type ClassData = {
  id: number; name: string; level: number; teacherId: number | null; teacherName: string | null; total: number;
  students: { id: number; name: string; adm: string; streamId: number | null }[];
  streams: { id: number; name: string; teacherId: number | null; teacherName: string | null; count: number }[];
};
type T = { id: number; name: string };

const dot = (name: string) => <span className="inline-block h-3 w-3 shrink-0 rounded-full ring-2 ring-white" style={{ background: STREAM_COLOURS[name] ?? "#b7aca9" }} />;

function TeacherSelect({ teachers, name = "classTeacherId", value }: { teachers: T[]; name?: string; value: number | null }) {
  return (
    <select name={name} defaultValue={value ?? ""} className="field" aria-label="Class teacher">
      <option value="">No class teacher</option>{teachers.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
    </select>
  );
}

export function ClassCard({ c, teachers, canEdit }: { c: ClassData; teachers: T[]; canEdit: boolean }) {
  return (
    <article className="card flex flex-col p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-bold">{c.name}</h2>
          <p className="text-sm text-ink-mute">Class teacher: <span className="font-medium text-ink">{c.teacherName ?? "Not assigned"}</span></p>
        </div>
        <div className="clay-tile px-3 py-1.5 text-center"><p className="font-display text-xl font-bold leading-none">{c.total}</p><p className="text-[10px] uppercase tracking-wide text-ink-mute">students</p></div>
      </div>

      <div className="mt-4 flex-1">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-mute">{c.streams.length} {c.streams.length === 1 ? "stream" : "streams"}</p>
        {c.streams.length === 0 ? <p className="text-sm text-ink-mute">No streams yet.</p> : (
          <ul className="space-y-2">
            {c.streams.map((s) => (
              <li key={s.id} className="clay-tile flex items-center justify-between gap-2 px-3 py-2 text-sm">
                <span className="flex min-w-0 items-center gap-2">{dot(s.name)}<span className="truncate font-medium">{s.name}</span>{s.teacherName && <span className="hidden truncate text-xs text-ink-mute sm:inline">· {s.teacherName}</span>}</span>
                <span className="tabular-nums text-ink-mute">{s.count}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {canEdit && (
        <div className="mt-4">
          <Modal label="Edit class" title={`Edit ${c.name}`} variant="accent">
            <div className="space-y-6">
              <ActionForm action={updateClass} className="grid gap-3 sm:grid-cols-2">
                <input type="hidden" name="id" value={c.id} />
                <div><label className="label">Class name</label><input name="className" defaultValue={c.name} className="field" required /></div>
                <div><label className="label">Order (1 to 12)</label><input name="level" type="number" min={0} defaultValue={c.level} className="field" required /></div>
                <div className="sm:col-span-2"><label className="label">Class teacher</label><TeacherSelect teachers={teachers} value={c.teacherId} /></div>
                <SubmitButton className="w-full sm:w-auto">Save class</SubmitButton>
              </ActionForm>

              <section>
                <h3 className="font-display text-lg font-bold text-oxblood">Students in this class ({c.total})</h3>
                <p className="text-xs text-ink-mute">Live: new students added on the Students page appear here automatically.</p>
                <div className="mt-2 max-h-48 space-y-1 overflow-auto border border-paper-line bg-paper-light p-2 text-sm">
                  {[...c.streams, { id: null as number | null, name: "No stream", teacherId: null, teacherName: null, count: 0 }].map((st) => {
                    const list = c.students.filter((x) => x.streamId === st.id);
                    if (!list.length && st.id === null) return null;
                    return (
                      <details key={st.id ?? "none"} open={list.length > 0 && list.length <= 8}>
                        <summary className="cursor-pointer font-medium">{st.name} <span className="text-ink-mute">({list.length})</span></summary>
                        <ul className="ml-4 py-1">{list.map((x) => <li key={x.id}><a className="underline-offset-2 hover:underline" href={`/admin/students/${x.id}`}>{x.name}</a> <span className="text-xs text-ink-mute">{x.adm}</span></li>)}{list.length === 0 && <li className="text-ink-mute">Empty</li>}</ul>
                      </details>
                    );
                  })}
                </div>
              </section>

              <section>
                <h3 className="font-display text-lg font-bold text-oxblood">Streams</h3>
                <div className="mt-3 space-y-3">
                  {c.streams.map((s) => (
                    <div key={s.id} className="clay-tile p-3">
                      <ActionForm action={updateStream} className="grid gap-2 sm:grid-cols-[1fr_1fr_auto] sm:items-center">
                        <input type="hidden" name="id" value={s.id} />
                        <input name="stream" defaultValue={s.name} className="field" aria-label="Stream name" required />
                        <TeacherSelect teachers={teachers} name="classTeacherId" value={s.teacherId} />
                        <SubmitButton size="sm" variant="ghost">Save</SubmitButton>
                      </ActionForm>
                      <ActionForm action={deleteStream} className="mt-2 flex items-center justify-between text-xs text-ink-mute">
                        <input type="hidden" name="id" value={s.id} />
                        <span>{s.count} students</span>
                        <SubmitButton size="sm" variant="danger" confirm={`Delete stream ${s.name}?`}>Delete</SubmitButton>
                      </ActionForm>
                    </div>
                  ))}
                </div>
              </section>

              <ActionForm action={addStream} resetOnSuccess className="clay-tile grid gap-3 p-4 sm:grid-cols-2">
                <input type="hidden" name="classId" value={c.id} />
                <h3 className="font-display text-lg font-bold sm:col-span-2">Add a stream</h3>
                <div><label className="label">Colour</label>
                  <select name="pick" className="field" defaultValue=""><option value="">Choose a colour…</option>{STREAM_NAMES.map((n) => <option key={n}>{n}</option>)}</select></div>
                <div><label className="label">…or custom name</label><input name="custom" className="field" placeholder="e.g. Eagles" /></div>
                <div className="sm:col-span-2"><label className="label">Stream teacher (optional)</label><TeacherSelect teachers={teachers} name="classTeacherId" value={null} /></div>
                <SubmitButton className="w-full sm:w-auto">Add stream</SubmitButton>
              </ActionForm>
            </div>
          </Modal>
        </div>
      )}
    </article>
  );
}
