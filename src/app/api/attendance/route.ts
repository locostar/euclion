import { getAcademyContext, apiError, apiJson } from "@/lib/api-context";
import {
  attendanceInput,
  isDate,
  parseJson,
} from "@/lib/request-validation";

type AttendanceRow = {
  student_id: string;
  name: string;
  school: string | null;
  status: "present" | "absent" | "late" | "left_early" | "makeup" | null;
  memo: string | null;
};

export async function GET(request: Request) {
  const result = await getAcademyContext(request);
  if ("response" in result) return result.response;

  const query = new URL(request.url).searchParams;
  const date = query.get("date") ?? "";
  const classId = query.get("classId") ?? "";
  if (!isDate(date) || !classId) {
    return apiError(400, "INVALID_ATTENDANCE_QUERY", "날짜와 반을 선택해 주세요.");
  }

  const classroom = await result.context.env.DB.prepare(
    "SELECT id FROM classes WHERE id = ? AND organization_id = ? LIMIT 1",
  )
    .bind(classId, result.context.organizationId)
    .first<{ id: string }>();
  if (!classroom) {
    return apiError(404, "CLASS_NOT_FOUND", "반을 찾을 수 없습니다.");
  }

  const entries = await result.context.env.DB.prepare(
    `SELECT s.id AS student_id, s.name, s.school, a.status, a.memo
     FROM class_students cs
     INNER JOIN students s
       ON s.id = cs.student_id AND s.organization_id = cs.organization_id
     LEFT JOIN attendance a
       ON a.organization_id = cs.organization_id
      AND a.class_id = cs.class_id
      AND a.student_id = cs.student_id
      AND a.date = ?
     WHERE cs.organization_id = ?
       AND cs.class_id = ?
       AND s.status = 'active'
     ORDER BY s.name`,
  )
    .bind(date, result.context.organizationId, classId)
    .all<AttendanceRow>();

  return apiJson(
    entries.results.map((entry) => ({
      studentId: entry.student_id,
      name: entry.name,
      school: entry.school,
      status: entry.status,
      memo: entry.memo,
    })),
  );
}

export async function PUT(request: Request) {
  const result = await getAcademyContext(request, true);
  if ("response" in result) return result.response;

  const parsed = await parseJson(request, attendanceInput);
  if ("response" in parsed) return parsed.response;
  const { classId, date, entries } = parsed.data;
  if (!isDate(date)) {
    return apiError(400, "INVALID_DATE", "날짜 형식이 올바르지 않습니다.");
  }

  const classroom = await result.context.env.DB.prepare(
    "SELECT id FROM classes WHERE id = ? AND organization_id = ? LIMIT 1",
  )
    .bind(classId, result.context.organizationId)
    .first<{ id: string }>();
  if (!classroom) {
    return apiError(404, "CLASS_NOT_FOUND", "반을 찾을 수 없습니다.");
  }

  if (entries.length > 0) {
    const placeholders = entries.map(() => "?").join(", ");
    const students = await result.context.env.DB.prepare(
      `SELECT student_id FROM class_students
       WHERE organization_id = ? AND class_id = ?
         AND student_id IN (${placeholders})`,
    )
      .bind(
        result.context.organizationId,
        classId,
        ...entries.map((entry) => entry.studentId),
      )
      .all<{ student_id: string }>();

    if (students.results.length !== entries.length) {
      return apiError(400, "INVALID_STUDENT", "선택한 반의 학생을 확인해 주세요.");
    }
  }

  if (entries.length > 0) {
    await result.context.env.DB.batch(
      entries.map((entry) =>
        result.context.env.DB.prepare(
          `INSERT INTO attendance
            (id, organization_id, class_id, student_id, date, status, memo, recorded_by)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT (organization_id, class_id, student_id, date)
           DO UPDATE SET
             status = excluded.status,
             memo = excluded.memo,
             recorded_by = excluded.recorded_by,
             updated_at = cast(unixepoch('subsecond') * 1000 as integer)`,
        ).bind(
          crypto.randomUUID(),
          result.context.organizationId,
          classId,
          entry.studentId,
          date,
          entry.status,
          entry.memo,
          result.context.userId,
        ),
      ),
    );
  }

  return apiJson({ saved: entries.length });
}
