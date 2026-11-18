import { z } from "zod";
import { apiError, apiJson } from "@/lib/api-context";

export async function parseJson<T extends z.ZodType>(
  request: Request,
  schema: T,
): Promise<{ data: z.output<T> } | { response: Response }> {
  let body: unknown;
  try {
    body = await request.json();
  } catch (error) {
    if (error instanceof SyntaxError) {
      return {
        response: apiError(400, "INVALID_JSON", "요청 형식이 올바르지 않습니다."),
      };
    }
    throw error;
  }

  const result = schema.safeParse(body);
  if (!result.success) {
    return {
      response: apiJson(
        {
          error: {
            code: "VALIDATION_FAILED",
            message: "입력 내용을 확인해 주세요.",
            fields: result.error.flatten().fieldErrors,
          },
        },
        { status: 400 },
      ),
    };
  }

  return { data: result.data };
}

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullish()
    .transform((value) => value || null);

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const studentInput = z.object({
  name: z.string().trim().min(1).max(100),
  birthDate: optionalText(10),
  phone: optionalText(30),
  guardianPhone: optionalText(30),
  school: optionalText(120),
  grade: optionalText(40),
  address: optionalText(240),
  enrolledOn: date,
  status: z.enum(["active", "withdrawn"]).optional(),
  memo: optionalText(1000),
  classIds: z.array(z.string().min(1).max(80)).max(50).default([]),
});

export const classInput = z.object({
  name: z.string().trim().min(1).max(100),
  subject: optionalText(80),
  teacher: optionalText(100),
  grade: optionalText(80),
  capacity: z.number().int().positive().max(1000).nullable().optional(),
  room: optionalText(80),
  startsOn: optionalText(10),
  endsOn: optionalText(10),
  memo: optionalText(1000),
});

export const attendanceInput = z.object({
  classId: z.string().min(1).max(80),
  date,
  entries: z
    .array(
      z.object({
        studentId: z.string().min(1).max(80),
        status: z.enum(["present", "absent", "late", "left_early", "makeup"]),
        memo: optionalText(1000),
      }),
    )
    .max(200)
    .refine(
      (entries) =>
        new Set(entries.map((entry) => entry.studentId)).size === entries.length,
      "학생 출결은 한 번만 지정할 수 있습니다.",
    ),
});

export const tuitionChargeInput = z.object({
  studentId: z.string().min(1).max(80),
  billingPeriod: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
  amount: z.number().int().positive().max(1_000_000_000),
  dueDate: date,
  memo: optionalText(1000),
});

export const tuitionChargeStatusInput = z.object({
  chargeId: z.string().min(1).max(80),
  status: z.enum(["unpaid", "paid"]),
});

export const seatAssignmentInput = z.object({
  roomNumber: z.number().int().min(1).max(8),
  seatNumber: z.number().int().min(1).max(10),
  studentId: z.string().min(1).max(80),
});

export function isJsonParseResult<T extends z.ZodType>(
  result: Awaited<ReturnType<typeof parseJson<T>>>,
): result is { response: Response } {
  return "response" in result;
}

export function isDate(value: string) {
  if (!date.safeParse(value).success) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value;
}

export function isBillingPeriod(value: string) {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(value);
}
