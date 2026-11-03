import { sql } from "drizzle-orm";
import {
  boolean, date, index, integer, jsonb, numeric, pgEnum, pgTable, serial, text, timestamp, unique, uuid, varchar,
} from "drizzle-orm/pg-core";

const createdAt = () => timestamp("created_at", { withTimezone: true }).defaultNow().notNull();
const money = (name: string) => numeric(name, { precision: 12, scale: 2 });

export const genderEnum = pgEnum("gender", ["male", "female"]);
export const studentStatus = pgEnum("student_status", ["active", "graduated", "suspended", "transferred"]);
export const relationshipEnum = pgEnum("relationship", ["Father", "Mother", "Sponsor", "Guardian"]);
export const examTypeEnum = pgEnum("exam_type", ["Opener", "Mid-Term", "End-Term"]);
export const invoiceStatus = pgEnum("invoice_status", ["unpaid", "partial", "paid", "overdue"]);
export const payMethod = pgEnum("pay_method", ["M-Pesa", "Bank", "Cash", "Cheque"]);
export const attendanceStatus = pgEnum("attendance_status", ["present", "absent", "late", "excused"]);
export const stkStatus = pgEnum("stk_status", ["pending", "success", "failed", "cancelled"]);
export const staffRole = pgEnum("staff_role", ["admin", "principal", "bursar", "teacher", "support"]);
export const staffKind = pgEnum("staff_kind", ["teaching", "non_teaching"]);
export const employmentType = pgEnum("employment_type", ["TSC", "BOM", "Permanent", "Contract"]);
export const staffStatus = pgEnum("staff_status", ["pending", "active", "revoked"]);

export const academicYears = pgTable("academic_years", {
  id: serial("id").primaryKey(),
  year: integer("year").notNull().unique(),
  isCurrent: boolean("is_current").notNull().default(false),
});

export const terms = pgTable("terms", {
  id: serial("id").primaryKey(),
  academicYearId: integer("academic_year_id").notNull().references(() => academicYears.id, { onDelete: "cascade" }),
  termName: varchar("term_name", { length: 40 }).notNull(),
  startDate: date("start_date").notNull(),
  endDate: date("end_date").notNull(),
  isCurrent: boolean("is_current").notNull().default(false),
}, (t) => [unique().on(t.academicYearId, t.termName)]);

export const staff = pgTable("staff", {
  id: serial("id").primaryKey(),
  clerkUserId: text("clerk_user_id").unique(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  employeeId: varchar("employee_id", { length: 40 }).notNull().unique(),
  phone: varchar("phone", { length: 20 }),
  nationalId: varchar("national_id", { length: 30 }),
  tscNumber: varchar("tsc_number", { length: 30 }), // teachers
  qualification: text("qualification"),
  department: text("department"),
  kind: staffKind("kind").notNull().default("teaching"),
  employmentType: employmentType("employment_type"), // TSC or BOM for teachers; TSC number is only mandatory for TSC
  jobTitle: text("job_title"), // non-teaching staff
  role: staffRole("role").notNull().default("teacher"),
  requestedRole: staffRole("requested_role"),
  status: staffStatus("status").notNull().default("active"),
  joinedOn: date("joined_on").notNull().default(sql`current_date`),
});

export const classes = pgTable("classes", {
  id: serial("id").primaryKey(),
  className: varchar("class_name", { length: 60 }).notNull().unique(),
  level: integer("level").notNull().default(0),
  classTeacherId: integer("class_teacher_id").references(() => staff.id, { onDelete: "set null" }),
});

export const streams = pgTable("streams", {
  id: serial("id").primaryKey(),
  classId: integer("class_id").notNull().references(() => classes.id, { onDelete: "cascade" }),
  stream: varchar("stream", { length: 60 }).notNull(),
  classTeacherId: integer("class_teacher_id").references(() => staff.id, { onDelete: "set null" }),
}, (t) => [unique().on(t.classId, t.stream)]);

export const subjects = pgTable("subjects", {
  id: serial("id").primaryKey(),
  subjectCode: varchar("subject_code", { length: 20 }).notNull().unique(),
  name: text("name").notNull(),
  category: varchar("category", { length: 60 }),
  minGrade: integer("min_grade").notNull().default(1),
  maxGrade: integer("max_grade").notNull().default(12),
  periodsPerWeek: integer("periods_per_week").notNull().default(3),
});

export const subjectTeacher = pgTable("subject_teacher", {
  id: serial("id").primaryKey(),
  subjectId: integer("subject_id").notNull().references(() => subjects.id, { onDelete: "cascade" }),
  classId: integer("class_id").notNull().references(() => classes.id, { onDelete: "cascade" }),
  streamId: integer("stream_id").references(() => streams.id, { onDelete: "cascade" }),
  teacherId: integer("assigned_teacher_id").notNull().references(() => staff.id, { onDelete: "cascade" }),
}, (t) => [unique().on(t.subjectId, t.classId, t.streamId, t.teacherId)]);

export const students = pgTable("students", {
  id: serial("id").primaryKey(),
  uuid: uuid("uuid").defaultRandom().notNull().unique(), // goes in QR codes, never the numeric id
  clerkUserId: text("clerk_user_id").unique(),
  email: text("email"),
  admissionNumber: varchar("admission_number", { length: 40 }).notNull().unique(), // also M-Pesa account ref
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  gender: genderEnum("gender").notNull(),
  dob: date("dob").notNull(),
  classId: integer("class_id").notNull().references(() => classes.id),
  streamId: integer("stream_id").references(() => streams.id, { onDelete: "set null" }),
  status: studentStatus("status").notNull().default("active"),
  photoUrl: text("photo_url"), // passport photo, resized client-side to a small JPEG data URL
  admittedOn: date("admitted_on").notNull().default(sql`current_date`),
  idNumber: varchar("id_number", { length: 30 }).unique(),
  idIssuedAt: date("id_issued_at"),
  idExpiresAt: date("id_expires_at"),
  createdAt: createdAt(),
}, (t) => [index("students_class_idx").on(t.classId, t.streamId, t.status)]);

export const guardians = pgTable("guardians", {
  id: serial("id").primaryKey(),
  clerkUserId: text("clerk_user_id").unique(),
  fullName: text("full_name").notNull(),
  phone: varchar("phone", { length: 20 }).notNull(), // 2547XXXXXXXX
  email: text("email"),
  nationalId: varchar("national_id", { length: 30 }).unique(),
  occupation: text("occupation"),
}, (t) => [index("guardians_phone_idx").on(t.phone)]);

export const studentGuardian = pgTable("student_guardian", {
  id: serial("id").primaryKey(),
  studentId: integer("student_id").notNull().references(() => students.id, { onDelete: "cascade" }),
  guardianId: integer("guardian_id").notNull().references(() => guardians.id, { onDelete: "cascade" }),
  relationship: relationshipEnum("relationship").notNull(),
  isPrimary: boolean("is_primary").notNull().default(false),
}, (t) => [unique().on(t.studentId, t.guardianId)]);

export const examResults = pgTable("exam_results", {
  id: serial("id").primaryKey(),
  studentId: integer("student_id").notNull().references(() => students.id, { onDelete: "cascade" }),
  subjectId: integer("subject_id").notNull().references(() => subjects.id),
  termId: integer("term_id").notNull().references(() => terms.id),
  examType: examTypeEnum("exam_type").notNull(),
  marks: numeric("marks_obtained", { precision: 5, scale: 2 }).notNull(),
  grade: varchar("grade", { length: 3 }).notNull(),
  remarks: text("remarks"),
  enteredBy: text("entered_by"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => [unique().on(t.studentId, t.subjectId, t.termId, t.examType), index("results_term_idx").on(t.termId, t.examType)]);

export const feeStructures = pgTable("fee_structures", {
  id: serial("id").primaryKey(),
  classId: integer("class_id").notNull().references(() => classes.id, { onDelete: "cascade" }),
  termId: integer("term_id").notNull().references(() => terms.id, { onDelete: "cascade" }),
  feeHead: varchar("fee_head", { length: 80 }).notNull(),
  amount: money("amount").notNull(),
  dueDate: date("due_date").notNull(),
}, (t) => [unique().on(t.classId, t.termId, t.feeHead)]);

export const invoices = pgTable("invoices", {
  id: serial("id").primaryKey(),
  invoiceNumber: varchar("invoice_number", { length: 60 }).notNull().unique(),
  studentId: integer("student_id").notNull().references(() => students.id, { onDelete: "cascade" }),
  termId: integer("term_id").notNull().references(() => terms.id),
  totalAmount: money("total_amount").notNull(),
  amountPaid: money("amount_paid").notNull().default("0"),
  dueDate: date("due_date").notNull(),
  status: invoiceStatus("status").notNull().default("unpaid"),
  createdAt: createdAt(),
}, (t) => [unique().on(t.studentId, t.termId), index("invoices_status_idx").on(t.status)]);

export const invoiceItems = pgTable("invoice_items", {
  id: serial("id").primaryKey(),
  invoiceId: integer("invoice_id").notNull().references(() => invoices.id, { onDelete: "cascade" }),
  feeHead: varchar("fee_head", { length: 80 }).notNull(),
  amount: money("amount").notNull(),
});

export const feePayments = pgTable("fee_payments", {
  id: serial("id").primaryKey(),
  invoiceId: integer("invoice_id").notNull().references(() => invoices.id),
  studentId: integer("student_id").notNull().references(() => students.id),
  amountPaid: money("amount_paid").notNull(),
  method: payMethod("payment_method").notNull(),
  receiptNumber: varchar("receipt_number", { length: 40 }).notNull().unique(),
  transactionReference: varchar("transaction_reference", { length: 80 }).notNull().unique(), // idempotency key
  payerPhone: varchar("payer_phone", { length: 20 }),
  paidAt: timestamp("paid_at", { withTimezone: true }).notNull(),
  recordedBy: text("recorded_by"),
}, (t) => [index("payments_paid_at_idx").on(t.paidAt)]);

export const unmatchedPayments = pgTable("unmatched_payments", {
  id: serial("id").primaryKey(),
  transactionReference: varchar("transaction_reference", { length: 80 }).notNull().unique(),
  billRef: text("bill_ref"),
  amount: money("amount").notNull(),
  payerPhone: varchar("payer_phone", { length: 20 }),
  method: payMethod("payment_method").notNull(),
  paidAt: timestamp("paid_at", { withTimezone: true }).notNull(),
  resolvedAt: timestamp("resolved_at", { withTimezone: true }),
});

export const paymentCallbacks = pgTable("payment_callbacks", {
  id: serial("id").primaryKey(),
  source: varchar("source", { length: 20 }).notNull(),
  payload: jsonb("payload").notNull(),
  createdAt: createdAt(),
});

export const stkRequests = pgTable("stk_requests", {
  id: serial("id").primaryKey(),
  invoiceId: integer("invoice_id").notNull().references(() => invoices.id, { onDelete: "cascade" }),
  studentId: integer("student_id").notNull().references(() => students.id, { onDelete: "cascade" }),
  phone: varchar("phone", { length: 20 }).notNull(),
  amount: money("amount").notNull(),
  merchantRequestId: text("merchant_request_id"),
  checkoutRequestId: text("checkout_request_id").unique(),
  status: stkStatus("status").notNull().default("pending"),
  resultDesc: text("result_desc"),
  createdAt: createdAt(),
});

export const attendance = pgTable("attendance", {
  id: serial("id").primaryKey(),
  studentId: integer("student_id").notNull().references(() => students.id, { onDelete: "cascade" }),
  classId: integer("class_id").notNull().references(() => classes.id, { onDelete: "cascade" }),
  date: date("date").notNull(),
  status: attendanceStatus("status").notNull(),
  markedBy: text("marked_by"),
  guardianNotifiedAt: timestamp("guardian_notified_at", { withTimezone: true }),
}, (t) => [unique().on(t.studentId, t.date), index("attendance_class_date_idx").on(t.classId, t.date)]);

export const expenses = pgTable("expenses", {
  id: serial("id").primaryKey(),
  expenseDate: date("expense_date").notNull(),
  category: varchar("category", { length: 60 }).notNull(),
  description: text("description").notNull(),
  amount: money("amount").notNull(),
  paidTo: text("paid_to"),
  reference: text("reference"),
  recordedBy: text("recorded_by"),
  createdAt: createdAt(),
}, (t) => [index("expenses_date_idx").on(t.expenseDate), index("expenses_cat_idx").on(t.category)]);

export const timetableSlots = pgTable("timetable_slots", {
  id: serial("id").primaryKey(),
  termId: integer("term_id").notNull().references(() => terms.id, { onDelete: "cascade" }),
  classId: integer("class_id").notNull().references(() => classes.id, { onDelete: "cascade" }),
  streamId: integer("stream_id").references(() => streams.id, { onDelete: "cascade" }),
  streamKey: integer("stream_key").notNull().default(0), // 0 = class has no streams
  day: integer("day").notNull(),       // 0 = Monday
  period: integer("period").notNull(), // 0-based lesson index
  subjectId: integer("subject_id").notNull().references(() => subjects.id, { onDelete: "cascade" }),
  teacherId: integer("teacher_id").notNull().references(() => staff.id, { onDelete: "cascade" }),
}, (t) => [
  // The database itself refuses a double-booked teacher or a double-booked class
  unique("tt_teacher_slot").on(t.termId, t.teacherId, t.day, t.period),
  unique("tt_class_slot").on(t.termId, t.classId, t.streamKey, t.day, t.period),
]);

export const broadcasts = pgTable("broadcasts", {
  id: serial("id").primaryKey(),
  termId: integer("term_id").references(() => terms.id, { onDelete: "set null" }),
  classId: integer("class_id").references(() => classes.id, { onDelete: "set null" }),
  channel: varchar("channel", { length: 10 }).notNull(),
  invoicesCount: integer("invoices_count").notNull().default(0),
  messagesCount: integer("messages_count").notNull().default(0),
  sentBy: text("sent_by"),
  createdAt: createdAt(),
});

export const staffSubjects = pgTable("staff_subjects", {
  id: serial("id").primaryKey(),
  staffId: integer("staff_id").notNull().references(() => staff.id, { onDelete: "cascade" }),
  subjectId: integer("subject_id").notNull().references(() => subjects.id, { onDelete: "cascade" }),
}, (t) => [unique().on(t.staffId, t.subjectId)]);

export const staffGrades = pgTable("staff_grades", {
  id: serial("id").primaryKey(),
  staffId: integer("staff_id").notNull().references(() => staff.id, { onDelete: "cascade" }),
  classId: integer("class_id").notNull().references(() => classes.id, { onDelete: "cascade" }),
}, (t) => [unique().on(t.staffId, t.classId)]);

export const staffAttendance = pgTable("staff_attendance", {
  id: serial("id").primaryKey(),
  staffId: integer("staff_id").notNull().references(() => staff.id, { onDelete: "cascade" }),
  date: date("date").notNull(),
  clockIn: timestamp("clock_in", { withTimezone: true }).defaultNow().notNull(),
  clockOut: timestamp("clock_out", { withTimezone: true }),
  markedBy: text("marked_by"),
}, (t) => [unique().on(t.staffId, t.date), index("staff_att_date_idx").on(t.date)]);

/** Rows from an uploaded student spreadsheet, waiting to be completed (photo, email…) one by one. */
export const studentImportRows = pgTable("student_import_rows", {
  id: serial("id").primaryKey(),
  batchId: text("batch_id").notNull(),
  position: integer("position").notNull(),
  data: jsonb("data").notNull(),
  status: varchar("status", { length: 10 }).notNull().default("pending"), // pending | done | skipped
  studentId: integer("student_id"),
  createdAt: createdAt(),
}, (t) => [index("import_rows_status_idx").on(t.status, t.batchId, t.position)]);

/** Marklist rows whose student isn't in the system yet. Re-checked after the student is added. */
export const marklistRows = pgTable("marklist_rows", {
  id: serial("id").primaryKey(),
  termId: integer("term_id").notNull().references(() => terms.id, { onDelete: "cascade" }),
  examType: examTypeEnum("exam_type").notNull(),
  admissionNumber: varchar("admission_number", { length: 40 }).notNull(),
  studentName: text("student_name"),
  marks: jsonb("marks").notNull(), // { [subjectId]: mark }
  createdAt: createdAt(),
});
