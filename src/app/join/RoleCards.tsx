import { chooseRole } from "./actions";

const ROLES = [
  { role: "parent", title: "Parent / guardian", blurb: "See your child's fees, attendance and report cards, and pay by M-Pesa." },
  { role: "teacher", title: "Teacher", blurb: "Enter marks and take attendance. An administrator approves your access." },
  { role: "bursar", title: "Bursar / finance", blurb: "Manage fees, payments and expenses. An administrator approves your access." },
];

export function RoleCards({ next = "/sign-up" }: { next?: string }) {
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      {ROLES.map((r) => (
        <form key={r.role} action={chooseRole}>
          <input type="hidden" name="role" value={r.role} /><input type="hidden" name="next" value={next} />
          <button className="card h-full w-full p-5 text-left transition-transform hover:-translate-y-0.5 active:translate-y-px">
            <h2 className="font-display text-lg font-bold">{r.title}</h2><p className="mt-2 text-sm text-ink-mute">{r.blurb}</p>
            <span className="btn-primary mt-4 !min-h-[38px] !px-4 !text-xs">Continue as {r.role === "parent" ? "parent" : r.role}</span>
          </button>
        </form>
      ))}
    </div>
  );
}
