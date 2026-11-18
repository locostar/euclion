import { getAcademyContext, apiError, apiJson } from "@/lib/api-context";
import { consultationInput, isDate, parseJson } from "@/lib/request-validation";

type ConsultationRow = {
  id: string;
  student_id: string;
  student_name: string;
  consultation_date: string;
  category: string;
  summary: string;
  next_action: string | null;
  created_at: number;
};

export async function GET(request: Request) {
  const result = await getAcademyContext(request);
  if ("response" in result) return result.response;

  const studentId = new URL(request.url).searchParams.get("studentId");
  const rows = await result.context.env.DB.prepare(
    `SELECT cr.id, cr.student_id, s.name AS student_name,
            cr.consultation_date, cr.category, cr.summary, cr.next_action,
            cr.created_at
     FROM consultation_records cr
     INNER JOIN students s
       ON s.id = cr.student_id AND s.organization_id = cr.organization_id
     WHERE cr.organization_id = ?
       AND (? IS NULL OR cr.student_id = ?)
     ORDER BY cr.consultation_date DESC, cr.created_at DESC
     LIMIT 500`,
  )
    .bind(result.context.organizationId, studentId, studentId)
    .all<ConsultationRow>();

  return apiJson(rows.results);
}

export async function POST(request: Request) {
  const result = await getAcademyContext(request, true);
  if ("response" in result) return result.response;

  const parsed = await parseJson(request, consultationInput);
  if ("response" in parsed) return parsed.response;
  const consultation = parsed.data;
  if (!isDate(consultation.consultationDate)) {
    return apiError(400, "INVALID_DATE", "상담 날짜를 확인해 주세요.");
  }

  const student = await result.context.env.DB.prepare(
    `SELECT id FROM students
     WHERE id = ? AND organization_id = ? AND status = 'active'
     LIMIT 1`,
  )
    .bind(consultation.studentId, result.context.organizationId)
    .first<{ id: string }>();
  if (!student) {
    return apiError(404, "STUDENT_NOT_FOUND", "재원 중인 학생을 찾을 수 없습니다.");
  }

  const id = crypto.randomUUID();
  await result.context.env.DB.prepare(
    `INSERT INTO consultation_records
      (id, organization_id, student_id, consultation_date, category,
       summary, next_action, recorded_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      id,
      result.context.organizationId,
      consultation.studentId,
      consultation.consultationDate,
      consultation.category,
      consultation.summary,
      consultation.nextAction,
      result.context.userId,
    )
    .run();

  return apiJson({ id }, { status: 201 });
}

export async function DELETE(request: Request) {
  const result = await getAcademyContext(request, true);
  if ("response" in result) return result.response;

  const id = new URL(request.url).searchParams.get("id");
  if (!id || id.length > 80) {
    return apiError(400, "INVALID_CONSULTATION_ID", "삭제할 상담 기록을 확인해 주세요.");
  }

  const deleted = await result.context.env.DB.prepare(
    "DELETE FROM consultation_records WHERE id = ? AND organization_id = ?",
  )
    .bind(id, result.context.organizationId)
    .run();
  if (!deleted.meta.changes) {
    return apiError(404, "CONSULTATION_NOT_FOUND", "상담 기록을 찾을 수 없습니다.");
  }

  return apiJson({ deleted: true });
}
