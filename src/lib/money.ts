/** All money math in integer cents to avoid float drift. DB stores numeric(12,2) as strings. */
export const toCents = (v: string | number | null | undefined): number => Math.round(Number(v ?? 0) * 100);
export const fromCents = (c: number): string => (c / 100).toFixed(2);
export const kes = (v: string | number | null | undefined): string =>
  "KES " + Number(v ?? 0).toLocaleString("en-KE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function normalizePhone(input: string): string {
  const p = input.replace(/\D/g, "");
  if (p.startsWith("254")) return p;
  if (p.startsWith("0")) return "254" + p.slice(1);
  return "254" + p;
}
export const isKenyanMobile = (input: string) => /^(?:\+?254|0)?[17]\d{8}$/.test(input.replace(/\s/g, ""));

export function invoiceStatusFor(totalCents: number, paidCents: number, dueDate: string) {
  const overdue = dueDate < new Date().toISOString().slice(0, 10);
  if (paidCents >= totalCents) return "paid" as const;
  if (overdue) return "overdue" as const;
  return paidCents > 0 ? ("partial" as const) : ("unpaid" as const);
}
