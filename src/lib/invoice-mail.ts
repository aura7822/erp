import { kes } from "./money";
import { fmtDate } from "./constants";

export function invoiceMessages(p: {
  school: string; term: string; student: string; adm: string; grade: string;
  items: { feeHead: string; amount: string }[]; total: string; paid: string; balance: string; due: string; note?: string;
}) {
  const shortcode = process.env.MPESA_SHORTCODE;
  const payLine = `Pay via M-Pesa Paybill ${shortcode}, account number ${p.adm}${process.env.APP_URL ? `, or online at ${process.env.APP_URL}/portal` : ""}.`;
  const subject = `Fee invoice: ${p.student} (${p.term})`;
  const text = [
    `${p.school} - Fee invoice (${p.term})`, ``, `Student: ${p.student} (${p.adm}), ${p.grade}`,
    ...p.items.map((i) => `  ${i.feeHead}: ${kes(i.amount)}`), ``,
    `Total: ${kes(p.total)}`, `Paid: ${kes(p.paid)}`, `Balance: ${kes(p.balance)}`, `Due: ${fmtDate(p.due)}`, ``, payLine,
    ...(p.note ? [``, p.note] : []),
  ].join("\n");
  const rows = p.items.map((i) => `<tr><td style="padding:6px 0;border-bottom:1px solid #eee">${esc(i.feeHead)}</td><td style="padding:6px 0;border-bottom:1px solid #eee;text-align:right">${kes(i.amount)}</td></tr>`).join("");
  const html = `<div style="font-family:system-ui,sans-serif;max-width:520px;margin:auto;color:#2e0907">
<div style="background:#550605;color:#f3e7c2;padding:16px 20px"><strong>${esc(p.school)}</strong><br>Fee invoice · ${esc(p.term)}</div>
<div style="background:#efead7;padding:20px;">
<p style="margin:0 0 12px"><strong>${esc(p.student)}</strong> (${esc(p.adm)}) · ${esc(p.grade)}</p>
<table style="width:100%;border-collapse:collapse;font-size:14px">${rows}
<tr><td style="padding:8px 0"><strong>Total</strong></td><td style="text-align:right"><strong>${kes(p.total)}</strong></td></tr>
<tr><td style="padding:2px 0">Paid</td><td style="text-align:right">${kes(p.paid)}</td></tr>
<tr><td style="padding:2px 0;color:#550605"><strong>Balance</strong></td><td style="text-align:right;color:#550605"><strong>${kes(p.balance)}</strong></td></tr></table>
<p style="font-size:13px;color:#6e5f5b">Due ${fmtDate(p.due)}</p><p style="font-size:14px">${esc(payLine)}</p>${p.note ? `<p style="font-size:14px">${esc(p.note)}</p>` : ""}</div></div>`;
  const sms = `${p.school}: ${p.term} fees for ${p.student} (${p.adm}). Total ${kes(p.total)}, balance ${kes(p.balance)}, due ${fmtDate(p.due)}. Paybill ${shortcode}, acc ${p.adm}.`;
  return { subject, text, html, sms };
}
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
