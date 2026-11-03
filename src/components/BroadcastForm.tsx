"use client";
import { useState } from "react";
import { broadcastInvoices } from "@/app/admin/_actions/finance";
import { ActionForm, SubmitButton } from "./ui";

export type Aud = { open: { invoices: number; emails: number; phones: number }; all: { invoices: number; emails: number; phones: number } };

export function BroadcastForm({ termId, classes, stats }: { termId: number; classes: { id: number; name: string }[]; stats: Record<string, Aud> }) {
  const [grade, setGrade] = useState("all");
  const [include, setInclude] = useState<"open" | "all">("open");
  const [channel, setChannel] = useState<"email" | "sms" | "both">("both");
  const a = (stats[grade] ?? { open: { invoices: 0, emails: 0, phones: 0 }, all: { invoices: 0, emails: 0, phones: 0 } })[include];
  const reach = channel === "email" ? a.emails : channel === "sms" ? a.phones : Math.max(a.emails, a.phones);
  const label = grade === "all" ? "all grades" : classes.find((c) => String(c.id) === grade)?.name;

  return (
    <ActionForm action={broadcastInvoices} className="card grid gap-4 p-5 sm:grid-cols-2">
      <input type="hidden" name="termId" value={termId} />
      <div><label className="label" htmlFor="bg">Send to parents of</label>
        <select id="bg" name="classId" value={grade} onChange={(e) => setGrade(e.target.value)} className="field"><option value="all">All parents (every grade)</option>{classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
      <div><label className="label" htmlFor="bc">Send by</label>
        <select id="bc" name="channel" value={channel} onChange={(e) => setChannel(e.target.value as "email")} className="field"><option value="both">Email and SMS</option><option value="email">Email only</option><option value="sms">SMS only</option></select></div>
      <div className="sm:col-span-2"><label className="label" htmlFor="bi">Which invoices</label>
        <select id="bi" name="include" value={include} onChange={(e) => setInclude(e.target.value as "open")} className="field"><option value="open">Unpaid, partial and overdue only</option><option value="all">All invoices, including fully paid</option></select></div>
      <div className="sm:col-span-2"><label className="label" htmlFor="bn">Optional note to add</label><textarea id="bn" name="note" rows={2} className="field" placeholder="e.g. Fees are due before opening day." /></div>

      <div className="clay-tile flex flex-wrap items-center justify-between gap-3 p-4 sm:col-span-2">
        <p className="text-sm"><strong className="font-display text-lg">{a.invoices}</strong> invoice(s) for {label} · about <strong>{reach}</strong> parent contact(s)<span className="block text-xs text-ink-mute">{a.emails} with email · {a.phones} with phone. Only parents already linked to a student are included.</span></p>
        <SubmitButton disabled={a.invoices === 0} pendingText="Sending…" confirm={`Send ${a.invoices} invoice(s) to ${label} parents now? This cannot be undone.`}>Send invoices</SubmitButton>
      </div>
    </ActionForm>
  );
}
