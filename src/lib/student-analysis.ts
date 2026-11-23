import { z } from "zod";

export const analysisGrades = ["고1", "고2", "고3", "재수", "삼수", "N수", "미지정"] as const;
export const analysisGroupSchema = z.object({
  school: z.string().trim().min(1).max(120),
  grade: z.enum(analysisGrades),
  count: z.number().int().min(0).max(100000),
});
export const snapshotSchema = z.object({
  period: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
  groups: z.array(analysisGroupSchema).max(500).refine(
    (groups) => new Set(groups.map((group) => JSON.stringify([group.school, group.grade]))).size === groups.length,
    "학교와 학년이 중복되었습니다.",
  ),
});
export const admissionSchema = z.object({
  id: z.string().min(1).max(80).optional(),
  studentId: z.string().min(1).max(80),
  year: z.number().int().min(1900).max(2100),
  university: z.string().trim().min(1).max(120),
  department: z.string().trim().max(120),
  outcome: z.enum(["합격", "불합격", "대기", "진학"]),
  cohort: z.enum(analysisGrades),
  graduatedSchool: z.string().trim().max(120),
  detail: z.string().trim().max(1000),
  source: z.string().trim().max(500),
});
export type AnalysisGroup = z.infer<typeof analysisGroupSchema>;
export type AdmissionInput = z.infer<typeof admissionSchema>;
