export const GRADES = Array.from({ length: 12 }, (_, i) => ({ level: i + 1, name: `Grade ${i + 1}` }));

export const STREAM_COLOURS: Record<string, string> = {
  Blue: "#2F6FDE", Green: "#2E9B57", Purple: "#7B4FD6", Red: "#D8362B", Yellow: "#E9B500", Orange: "#F07A1A",
  Pink: "#E667A8", White: "#CFCAC9", Black: "#2B2B2B", Brown: "#8A5A3C", Gold: "#C9A227", Silver: "#A5A9AD",
  Maroon: "#800020", Teal: "#1A9AA0", Navy: "#1F2F6B",
};
export const STREAM_NAMES = Object.keys(STREAM_COLOURS);

export const EXPENSE_CATEGORIES = [
  "Uniforms", "Meals & feeding", "Transport", "Stationery & learning materials", "Textbooks & library",
  "Utilities", "Maintenance & repairs", "Salaries & wages", "Sports & co-curricular", "Medical & first aid",
  "ICT & equipment", "Security", "Trips & events", "Other",
] as const;

export const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri"] as const;
export const PERIODS = 8;
export type Slot = { type: "lesson"; period: number; start: string; end: string } | { type: "break"; label: string; start: string; end: string };
export const SLOTS: Slot[] = [
  { type: "lesson", period: 0, start: "08:00", end: "08:40" },
  { type: "lesson", period: 1, start: "08:40", end: "09:20" },
  { type: "lesson", period: 2, start: "09:20", end: "10:00" },
  { type: "break", label: "Tea break", start: "10:00", end: "10:30" },
  { type: "lesson", period: 3, start: "10:30", end: "11:10" },
  { type: "lesson", period: 4, start: "11:10", end: "11:50" },
  { type: "lesson", period: 5, start: "11:50", end: "12:30" },
  { type: "break", label: "Lunch", start: "12:30", end: "13:30" },
  { type: "lesson", period: 6, start: "13:30", end: "14:10" },
  { type: "lesson", period: 7, start: "14:10", end: "14:50" },
];

export const STAFF_ROLES = [
  { role: "admin" }, { role: "principal" }, { role: "bursar" }, { role: "teacher" }, { role: "support" },
] as const;

export const fmtDate = (d?: string | Date | null) =>
  d ? new Date(d).toLocaleDateString("en-KE", { day: "numeric", month: "short", year: "numeric" }) : "-";

/** "Today" in Nairobi (UTC+3), as YYYY-MM-DD */
export const todayEAT = () => new Date(Date.now() + 3 * 3600 * 1000).toISOString().slice(0, 10);
export const timeEAT = (d: Date | string | null | undefined) => (d ? new Date(d).toLocaleTimeString("en-KE", { hour: "2-digit", minute: "2-digit", timeZone: "Africa/Nairobi" }) : "");

export const TEACHING_EMPLOYMENT = ["TSC", "BOM"] as const;
export const SUPPORT_EMPLOYMENT = ["Permanent", "Contract", "BOM"] as const;
export const TEACHING_DEPARTMENTS = ["Languages", "Mathematics", "Sciences", "Humanities & Social Studies", "Technical & Applied", "Creative Arts & Sports", "Religious Education", "Early Years (Gr 1-3)", "Guidance & Counselling"];
export const SUPPORT_TITLES = ["Secretary", "Accountant", "Librarian", "Lab technician", "ICT officer", "Nurse", "Cook", "Driver", "Security guard", "Groundsman", "Cleaner", "Storekeeper"];
export const SUPPORT_DEPARTMENTS = ["Administration", "Finance", "Library", "ICT", "Catering", "Transport", "Security", "Maintenance", "Health"];

export const STAFF_GROUPS = {
  teaching: [
    { role: "principal", title: "Principal & deputies", blurb: "School leadership with oversight of academics." },
    { role: "teacher", title: "Teachers", blurb: "Classroom teachers. Subjects and grades here drive the timetable." },
  ],
  non_teaching: [
    { role: "admin", title: "Administrators", blurb: "Full control of school setup, staff, finance and academics." },
    { role: "bursar", title: "Finance / Bursar", blurb: "Fee structures, invoices, payments, expenses and broadcasts." },
    { role: "support", title: "Support staff", blurb: "Secretaries, cooks, drivers, security and other non-teaching staff (no system login)." },
  ],
} as const;
