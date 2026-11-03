"use client";
import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { useFormStatus } from "react-dom";
import type { ActionState } from "@/lib/action";

export function Spinner({ className = "" }: { className?: string }) {
  return (
    <span aria-hidden className={`inline-block h-4 w-4 animate-spin border-2 border-current border-r-transparent ${className}`} />
  );
}

export function SubmitButton({ children, pendingText, variant = "primary", className = "", confirm, disabled, size }: {
  children: React.ReactNode; pendingText?: string; variant?: "primary" | "ghost" | "accent" | "danger"; className?: string;
  confirm?: string; disabled?: boolean; size?: "sm";
}) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending || disabled} aria-busy={pending}
      onClick={(e) => { if (confirm && !window.confirm(confirm)) e.preventDefault(); }}
      className={`btn-${variant} ${size === "sm" ? "btn-sm" : ""} ${className}`}>
      {pending && <Spinner />}{pending ? (pendingText ?? "Working…") : children}
    </button>
  );
}

export function FormMessage({ state }: { state: ActionState }) {
  if (!state) return null;
  if (state.error) {
    return (
      <div role="alert" className="col-span-full flex items-start gap-2 rounded-2xl bg-alert/10 px-4 py-3 text-sm text-alert">
        <svg className="mt-0.5 shrink-0" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden><circle cx="12" cy="12" r="9" /><path d="M12 7v6M12 16.5v.5" /></svg>
        <span>{state.error}</span>
      </div>
    );
  }
  if (state.ok) {
    return (
      <div role="status" className="col-span-full rounded-2xl bg-ok/10 px-4 py-3 text-sm text-ok">
        <p className="font-semibold">{state.ok}</p>
        {state.details && state.details.length > 0 && (
          <ul className="mt-2 list-disc space-y-0.5 pl-5 font-normal text-ink-soft">{state.details.map((d, i) => <li key={i}>{d}</li>)}</ul>
        )}
      </div>
    );
  }
  return null;
}

export function ActionForm({ action, children, className = "", resetOnSuccess = false }: {
  action: (prev: ActionState, fd: FormData) => Promise<ActionState>; children: React.ReactNode; className?: string; resetOnSuccess?: boolean;
}) {
  const [state, formAction] = useActionState(action, null);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => { if (state?.ok && resetOnSuccess) ref.current?.reset(); }, [state, resetOnSuccess]);
  return (
    <form ref={ref} action={formAction} className={className}>
      {children}
      <FormMessage state={state} />
    </form>
  );
}

export function PrintButton({ label = "Print" }: { label?: string }) {
  return <button type="button" className="btn-primary" onClick={() => window.print()}>{label}</button>;
}

export function Modal({ label, title, children, variant = "ghost" }: { label: string; title: string; children: React.ReactNode; variant?: "ghost" | "primary" | "accent" }) {
  const ref = useRef<HTMLDialogElement>(null);
  return (
    <>
      <button type="button" className={`btn-${variant} btn-sm`} onClick={() => ref.current?.showModal()}>{label}</button>
      <dialog ref={ref} className="clay-dialog" aria-label={title} onClick={(e) => { if (e.target === ref.current) ref.current?.close(); }}>
        <div className="p-5 sm:p-6">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="font-display text-xl font-bold">{title}</h2>
            <button type="button" className="btn-ghost !min-h-[36px] !w-9 !rounded-full !p-0" aria-label="Close" onClick={() => ref.current?.close()}>✕</button>
          </div>
          {children}
        </div>
      </dialog>
    </>
  );
}

// ───────── Refresh, auto-refresh, clock ─────────
import { useRouter } from "next/navigation";
import { LuLogIn, LuLogOut, LuRefreshCw } from "react-icons/lu";
import { selfClock } from "@/app/admin/_actions/staff";

export function RefreshButton() {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <button type="button" onClick={() => start(() => router.refresh())} className="btn-ghost !min-h-[40px] !w-10 !p-0 print:hidden" aria-label="Refresh this page" title="Refresh" disabled={pending}>
      <LuRefreshCw className={`h-[18px] w-[18px] ${pending ? "animate-spin" : ""}`} aria-hidden />
    </button>
  );
}

/** Quietly re-fetches the page data while the tab is visible, so lists stay in sync with changes made elsewhere. */
export function AutoRefresh({ seconds = 30 }: { seconds?: number }) {
  const router = useRouter();
  useEffect(() => {
    const t = setInterval(() => { if (document.visibilityState === "visible") router.refresh(); }, seconds * 1000);
    return () => clearInterval(t);
  }, [router, seconds]);
  return null;
}

export function ClockWidget({ state, time }: { state: "none" | "in" | "out"; time?: string }) {
  const [res, formAction, pending] = useActionState(selfClock, null);
  const [open, setOpen] = useState(false);
  void open; void setOpen;
  const label = state === "none" ? "Clock in" : state === "in" ? "Clock out" : "Done for today";
  const Icon = state === "none" ? LuLogIn : LuLogOut;
  return (
    <form action={formAction} className="px-2">
      <button type="submit" disabled={pending || state === "out"} title={label}
        className="flex h-11 w-full items-center gap-4 px-[14px] text-sm font-medium text-white/85 transition-colors hover:bg-white/10 disabled:opacity-60">
        {pending ? <Spinner className="h-[20px] w-[20px] shrink-0" /> : <Icon className="h-[20px] w-[20px] shrink-0" aria-hidden />}
        <span className="whitespace-nowrap text-left leading-tight opacity-0 transition-opacity group-hover/sb:opacity-100 group-focus-within/sb:opacity-100">
          {label}{time && <span className="block text-[11px] text-white/60">{state === "in" ? "In since" : "Left at"} {time}</span>}
          {res?.error && <span className="block text-[11px] text-[#ffb4a8]">{res.error}</span>}
        </span>
      </button>
    </form>
  );
}
