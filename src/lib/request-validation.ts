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
  gender: z.enum(["male", "female"]),
  school: optionalText(120),
  grade: optionalText(40),
  graduatedSchool: optionalText(120),
  address: optionalText(240),
  enrolledOn: date,
  status: z.enum(["active", "withdrawn"]).optional(),
  monthlyTuitionAdjustment: z.number().int().min(-1_000_000_000).max(1_000_000_000).default(0),
  tuitionAdjustmentReason: optionalText(300),
  memo: optionalText(1000),
  classIds: z.array(z.string().min(1).max(80)).max(50).default([]),
}).superRefine((student, context) => {
  if (
    ["재수", "삼수", "N수"].includes(student.grade ?? "") &&
    !student.graduatedSchool
  ) {
    context.addIssue({
      code: "custom",
      path: ["graduatedSchool"],
      message: "졸업한 고등학교를 입력해 주세요.",
    });
  }
});

export const classInput = z.object({
  name: z.string().trim().min(1).max(100),
  subject: optionalText(80),
  teacher: optionalText(100),
  grade: z.array(z.enum(["고1", "고2", "고3", "재수", "삼수", "N수"])).max(6).default([])
    .transform((grades) => grades.join(", ")),
  capacity: z.number().int().positive().max(1000).nullable().optional(),
  monthlyFee: z.number().int().min(0).max(1_000_000_000).default(0),
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

export const consultationInput = z.object({
  studentId: z.string().min(1).max(80),
  consultationDate: date,
  category: z.enum(["학습", "생활", "진로", "학부모", "기타"]),
  summary: z.string().trim().min(1).max(3000),
  nextAction: optionalText(1000),
});

const assessmentCommon = {
  studentId: z.string().min(1).max(80),
  assessmentDate: date,
  note: optionalText(1000),
};

export const assessmentInput = z.discriminatedUnion("assessmentType", [
  z.object({
    ...assessmentCommon,
    assessmentType: z.literal("mock_exam"),
    title: z.string().trim().min(1).max(120),
    subject: z.string().trim().min(1).max(40),
    grade: z.number().int().min(1).max(9),
    score: z.number().int().min(0).max(100).nullable().default(null),
  }),
  z.object({
    ...assessmentCommon,
    assessmentType: z.literal("vocabulary"),
    title: z.string().trim().max(120).default("영단어 시험"),
    score: z.number().int().min(0).max(1000),
    maxScore: z.number().int().min(1).max(1000),
  }).refine((assessment) => assessment.score <= assessment.maxScore, {
    path: ["score"],
    message: "맞힌 개수는 전체 문항 수를 넘을 수 없습니다.",
  }),
]);

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

export const seatMoveInput = seatAssignmentInput;

export const seatPricingInput = z.object({
  roomNumber: z.number().int().min(1).max(8),
  seatNumber: z.number().int().min(1).max(10),
  monthlyFee: z.number().int().min(0).max(1_000_000_000),
});

export const seatScanInput = z.object({
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
