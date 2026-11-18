import { sql } from "drizzle-orm";
import {
  foreignKey,
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";
import { organization, user } from "./auth-schema";

export * from "./auth-schema";

export const students = sqliteTable(
  "students",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    birthDate: text("birth_date"),
    phone: text("phone"),
    guardianPhone: text("guardian_phone"),
    school: text("school"),
    grade: text("grade"),
    address: text("address"),
    enrolledOn: text("enrolled_on").notNull(),
    status: text("status", { enum: ["active", "withdrawn"] })
      .notNull()
      .default("active"),
    memo: text("memo"),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`),
  },
  (table) => [
    uniqueIndex("students_id_organization_id_uq").on(
      table.id,
      table.organizationId,
    ),
    index("students_organization_id_name_idx").on(
      table.organizationId,
      table.name,
    ),
  ],
);

export const classes = sqliteTable(
  "classes",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    subject: text("subject"),
    teacher: text("teacher"),
    grade: text("grade"),
    capacity: integer("capacity"),
    room: text("room"),
    startsOn: text("starts_on"),
    endsOn: text("ends_on"),
    memo: text("memo"),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`),
  },
  (table) => [
    uniqueIndex("classes_id_organization_id_uq").on(
      table.id,
      table.organizationId,
    ),
    index("classes_organization_id_name_idx").on(
      table.organizationId,
      table.name,
    ),
  ],
);

export const classStudents = sqliteTable(
  "class_students",
  {
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    classId: text("class_id").notNull(),
    studentId: text("student_id").notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`),
  },
  (table) => [
    uniqueIndex("class_students_org_class_student_uq").on(
      table.organizationId,
      table.classId,
      table.studentId,
    ),
    foreignKey({
      columns: [table.classId, table.organizationId],
      foreignColumns: [classes.id, classes.organizationId],
    }).onDelete("cascade"),
    foreignKey({
      columns: [table.studentId, table.organizationId],
      foreignColumns: [students.id, students.organizationId],
    }).onDelete("cascade"),
  ],
);

export const attendance = sqliteTable(
  "attendance",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    classId: text("class_id").notNull(),
    studentId: text("student_id").notNull(),
    date: text("date").notNull(),
    status: text("status", {
      enum: ["present", "absent", "late", "left_early", "makeup"],
    }).notNull(),
    memo: text("memo"),
    recordedBy: text("recorded_by").references(() => user.id, {
      onDelete: "set null",
    }),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`),
  },
  (table) => [
    uniqueIndex("attendance_org_class_student_date_uq").on(
      table.organizationId,
      table.classId,
      table.studentId,
      table.date,
    ),
    foreignKey({
      columns: [table.classId, table.organizationId],
      foreignColumns: [classes.id, classes.organizationId],
    }).onDelete("cascade"),
    foreignKey({
      columns: [table.studentId, table.organizationId],
      foreignColumns: [students.id, students.organizationId],
    }).onDelete("cascade"),
    index("attendance_organization_id_date_idx").on(
      table.organizationId,
      table.date,
    ),
  ],
);

export const tuitionCharges = sqliteTable(
  "tuition_charges",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    studentId: text("student_id").notNull(),
    billingPeriod: text("billing_period").notNull(),
    amount: integer("amount").notNull(),
    dueDate: text("due_date").notNull(),
    status: text("status", { enum: ["unpaid", "paid"] })
      .notNull()
      .default("unpaid"),
    paidAt: integer("paid_at", { mode: "timestamp_ms" }),
    memo: text("memo"),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`),
  },
  (table) => [
    uniqueIndex("tuition_charges_org_student_period_uq").on(
      table.organizationId,
      table.studentId,
      table.billingPeriod,
    ),
    foreignKey({
      columns: [table.studentId, table.organizationId],
      foreignColumns: [students.id, students.organizationId],
    }).onDelete("cascade"),
    index("tuition_charges_org_period_status_idx").on(
      table.organizationId,
      table.billingPeriod,
      table.status,
    ),
  ],
);

export const seatOccupancy = sqliteTable(
  "seat_occupancy",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    roomNumber: integer("room_number").notNull(),
    seatNumber: integer("seat_number").notNull(),
    studentId: text("student_id"),
    studentName: text("student_name").notNull(),
    school: text("school"),
    grade: text("grade"),
    enteredAt: integer("entered_at", { mode: "timestamp_ms" }).notNull(),
    isDemo: integer("is_demo", { mode: "boolean" }).notNull().default(false),
  },
  (table) => [
    uniqueIndex("seat_occupancy_org_room_seat_uq").on(
      table.organizationId,
      table.roomNumber,
      table.seatNumber,
    ),
    uniqueIndex("seat_occupancy_org_student_uq")
      .on(table.organizationId, table.studentId)
      .where(sql`${table.studentId} IS NOT NULL`),
    foreignKey({
      columns: [table.studentId, table.organizationId],
      foreignColumns: [students.id, students.organizationId],
    }).onDelete("cascade"),
    index("seat_occupancy_org_demo_idx").on(
      table.organizationId,
      table.isDemo,
    ),
  ],
);
