import * as XLSX from "xlsx";

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

export function readSheet(buf: ArrayBuffer): Record<string, unknown>[] {
  const wb = XLSX.read(buf, { type: "array", cellDates: true });
  const ws = wb.Sheets[wb.SheetNames[0]];
  if (!ws) return [];
  return XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: "", raw: true });
}

const cell = (v: unknown): string => {
  if (v instanceof Date) return toIso(v);
  return v === null || v === undefined ? "" : String(v).trim();
};
function toIso(d: Date) { return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10); }
export function toIsoDate(v: unknown): string {
  if (v instanceof Date) return toIso(v);
  const s = String(v ?? "").trim();
  if (!s) return "";
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const m = /^(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{2,4})$/.exec(s); // Kenya: day first
  if (m) { const y = m[3].length === 2 ? `20${m[3]}` : m[3]; return `${y}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`; }
  const t = Date.parse(s);
  return Number.isNaN(t) ? "" : new Date(t).toISOString().slice(0, 10);
}

const ALIASES: Record<string, string[]> = {
  admissionNumber: ["adm", "admno", "admissionno", "admissionnumber", "admission", "regno", "registrationno", "admnumber"],
  firstName: ["firstname", "fname", "givenname", "first"],
  lastName: ["lastname", "surname", "lname", "familyname", "last"],
  fullName: ["name", "fullname", "studentname", "learnername"],
  gender: ["gender", "sex"],
  dob: ["dob", "dateofbirth", "birthdate", "birthday"],
  grade: ["grade", "class", "level", "form"],
  stream: ["stream"],
  admittedOn: ["dateadmitted", "admissiondate", "admitted", "admittedon", "dateofadmission"],
  email: ["email", "studentemail"],
  guardianName: ["guardian", "guardianname", "parent", "parentname", "parentguardian"],
  guardianPhone: ["guardianphone", "parentphone", "phone", "phonenumber", "contact", "parentcontact", "mobile", "guardiancontact"],
  guardianEmail: ["guardianemail", "parentemail"],
  relationship: ["relationship", "relation"],
};

export type StudentRowData = {
  admissionNumber: string; firstName: string; lastName: string; gender: string; dob: string; grade: string; stream: string;
  admittedOn: string; email: string; guardianName: string; guardianPhone: string; guardianEmail: string; relationship: string;
};

export function parseStudentSheet(buf: ArrayBuffer): StudentRowData[] {
  const rows = readSheet(buf);
  const out: StudentRowData[] = [];
  for (const r of rows) {
    const g: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(r)) {
      const nk = norm(k);
      for (const [field, names] of Object.entries(ALIASES)) if (names.includes(nk) && g[field] === undefined) g[field] = v;
    }
    let first = cell(g.firstName), last = cell(g.lastName);
    if (!first && !last && g.fullName) { const parts = cell(g.fullName).split(/\s+/); first = parts[0] ?? ""; last = parts.slice(1).join(" "); }
    const gender = cell(g.gender).toLowerCase();
    const row: StudentRowData = {
      admissionNumber: cell(g.admissionNumber).replace(/\s+/g, "").toUpperCase(), firstName: first, lastName: last,
      gender: /^(m|male|boy)/.test(gender) ? "male" : /^(f|female|girl)/.test(gender) ? "female" : "",
      dob: toIsoDate(g.dob), grade: cell(g.grade), stream: cell(g.stream), admittedOn: toIsoDate(g.admittedOn),
      email: cell(g.email).toLowerCase(), guardianName: cell(g.guardianName), guardianPhone: cell(g.guardianPhone), guardianEmail: cell(g.guardianEmail).toLowerCase(), relationship: cell(g.relationship),
    };
    if (Object.values(row).some(Boolean)) out.push(row);
  }
  return out;
}

type ClassOpt = { id: number; name: string; streams: { id: number; name: string }[] };

/** Turns an imported row into the student form's starting values. */
export function rowToInit(d: Partial<StudentRowData>, classes: ClassOpt[]) {
  const lvl = /\d{1,2}/.exec(d.grade ?? "")?.[0];
  const cls = lvl ? classes.find((c) => new RegExp(`(^|\\D)${Number(lvl)}$`).test(c.name)) : undefined;
  const stream = cls?.streams.find((s) => s.name.toLowerCase() === (d.stream ?? "").toLowerCase());
  return {
    admissionNumber: d.admissionNumber ?? "", firstName: d.firstName ?? "", lastName: d.lastName ?? "", gender: d.gender ?? "", dob: d.dob ?? "",
    classId: (cls?.id ?? "") as number | "", streamId: (stream?.id ?? "") as number | "", admittedOn: d.admittedOn || new Date().toISOString().slice(0, 10), email: d.email ?? "", photo: null as string | null,
  };
}

// ───────── Marklists ─────────
export type MarklistRow = { adm: string; name: string; marks: Record<number, number>; issues: string[] };
const NON_SUBJECT = new Set(["total", "totals", "mean", "average", "avg", "rank", "position", "pos", "grade", "class", "stream", "remarks", "comment", "points", "sno", "no", "sn", "gender", "sex"]);

export function parseMarklist(buf: ArrayBuffer, subjects: { id: number; name: string; code: string }[]) {
  const rows = readSheet(buf);
  const keys = rows.length ? Object.keys(rows[0]) : [];
  const admKey = keys.find((k) => ALIASES.admissionNumber.includes(norm(k)));
  const nameKey = keys.find((k) => k !== admKey && ALIASES.fullName.includes(norm(k)));
  const subjectCols: { key: string; subjectId: number }[] = [];
  const unknown: string[] = [];
  const bySub = subjects.map((s) => ({ id: s.id, n: norm(s.name), c: norm(s.code) }));
  for (const k of keys) {
    const n = norm(k);
    if (!n || k === admKey || k === nameKey || NON_SUBJECT.has(n)) continue;
    const hit = bySub.find((s) => s.n === n || s.c === n) ?? bySub.find((s) => n.length >= 4 && (s.n.startsWith(n) || n.startsWith(s.n)));
    if (hit) subjectCols.push({ key: k, subjectId: hit.id }); else unknown.push(k);
  }
  const out: MarklistRow[] = [];
  if (!admKey) return { rows: out, unknown, subjectCols, error: "No admission number column found. Add a column headed “Admission No”." };
  for (const r of rows) {
    const adm = cell(r[admKey]).replace(/\s+/g, "").toUpperCase();
    if (!adm) continue;
    const marks: Record<number, number> = {}, issues: string[] = [];
    for (const c of subjectCols) {
      const raw = r[c.key];
      if (raw === "" || raw === null || raw === undefined) continue;
      const n = Number(raw);
      if (!Number.isFinite(n) || n < 0 || n > 100) issues.push(`${c.key}: "${String(raw)}" is not a mark between 0 and 100`);
      else marks[c.subjectId] = n;
    }
    out.push({ adm, name: nameKey ? cell(r[nameKey]) : "", marks, issues });
  }
  return { rows: out, unknown, subjectCols, error: null as string | null };
}
