import { getAcademyContext, apiError, apiJson } from "@/lib/api-context";
import { assessmentInput, isDate, parseJson } from "@/lib/request-validation";

type AssessmentRow = {
  id: string;
  student_id: string;
  student_name: string;
  assessment_type: "mock_exam" | "vocabulary";
  assessment_date: string;
  title: string;
  subject: string;
  grade: number | null;
  score: number | null;
  max_score: number | null;
  note: string | null;
};

export async function GET(request: Request) {
  const result = await getAcademyContext(request);
  if ("response" in result) return result.response;

  const studentId = new URL(request.url).searchParams.get("studentId");
  const rows = await result.context.env.DB.prepare(
    `SELECT sa.id, sa.student_id, s.name AS student_name,
            sa.assessment_type, sa.assessment_date, sa.title, sa.subject,
            sa.grade, sa.score, sa.max_score, sa.note
     FROM student_assessments sa
     INNER JOIN students s
       ON s.id = sa.student_id AND s.organization_id = sa.organization_id
     WHERE sa.organization_id = ?
       AND (? IS NULL OR sa.student_id = ?)
     ORDER BY sa.assessment_date DESC, sa.created_at DESC
     LIMIT 1000`,
  )
    .bind(result.context.organizationId, studentId, studentId)
    .all<AssessmentRow>();

  return apiJson(rows.results);
}

export async function POST(request: Request) {
  const result = await getAcademyContext(request, true);
  if ("response" in result) return result.response;

  const parsed = await parseJson(request, assessmentInput);
  if ("response" in parsed) return parsed.response;
  const assessment = parsed.data;
  if (!isDate(assessment.assessmentDate)) {
    return apiError(400, "INVALID_DATE", "시험 날짜를 확인해 주세요.");
  }

  const student = await result.context.env.DB.prepare(
    `SELECT id FROM students
     WHERE id = ? AND organization_id = ? AND status = 'active'
     LIMIT 1`,
  )
    .bind(assessment.studentId, result.context.organizationId)
    .first<{ id: string }>();
  if (!student) {
    return apiError(404, "STUDENT_NOT_FOUND", "재원 중인 학생을 찾을 수 없습니다.");
  }

  const values = assessment.assessmentType === "mock_exam"
    ? {
      title: assessment.title,
      subject: assessment.subject,
      grade: assessment.grade,
      score: assessment.score,
      maxScore: null,
    }
    : {
      title: assessment.title || "영단어 시험",
      subject: "",
      grade: null,
      score: assessment.score,
      maxScore: assessment.maxScore,
    };

  const id = crypto.randomUUID();
  await result.context.env.DB.prepare(
    `INSERT INTO student_assessments
      (id, organization_id, student_id, assessment_type, assessment_date,
       title, subject, grade, score, max_score, note, recorded_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT (organization_id, student_id, assessment_type,
                  assessment_date, title, subject)
     DO UPDATE SET
       grade = excluded.grade,
       score = excluded.score,
       max_score = excluded.max_score,
       note = excluded.note,
       recorded_by = excluded.recorded_by`,
  )
    .bind(
      id,
      result.context.organizationId,
      assessment.studentId,
      assessment.assessmentType,
      assessment.assessmentDate,
      values.title,
      values.subject,
      values.grade,
      values.score,
      values.maxScore,
      assessment.note,
      result.context.userId,
    )
    .run();

  const saved = await result.context.env.DB.prepare(
    `SELECT id FROM student_assessments
     WHERE organization_id = ? AND student_id = ? AND assessment_type = ?
       AND assessment_date = ? AND title = ? AND subject = ?
     LIMIT 1`,
  )
    .bind(
      result.context.organizationId,
      assessment.studentId,
      assessment.assessmentType,
      assessment.assessmentDate,
      values.title,
      values.subject,
    )
    .first<{ id: string }>();
  if (!saved) {
    throw new Error("시험 결과 저장을 확인하지 못했습니다.");
  }

  return apiJson({ id: saved.id });
}

export async function DELETE(request: Request) {
  const result = await getAcademyContext(request, true);
  if ("response" in result) return result.response;

  const id = new URL(request.url).searchParams.get("id");
  if (!id || id.length > 80) {
    return apiError(400, "INVALID_ASSESSMENT_ID", "삭제할 시험 결과를 확인해 주세요.");
  }

  const deleted = await result.context.env.DB.prepare(
    "DELETE FROM student_assessments WHERE id = ? AND organization_id = ?",
  )
    .bind(id, result.context.organizationId)
    .run();
  if (!deleted.meta.changes) {
    return apiError(404, "ASSESSMENT_NOT_FOUND", "시험 결과를 찾을 수 없습니다.");
  }

  return apiJson({ deleted: true });
}
