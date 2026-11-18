import { getAcademyContext, apiError, apiJson } from "@/lib/api-context";
import {
  isDate,
  parseJson,
  studentInput,
} from "@/lib/request-validation";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: RouteContext) {
  const result = await getAcademyContext(request, true);
  if ("response" in result) return result.response;

  const { id } = await params;
  const parsed = await parseJson(request, studentInput);
  if ("response" in parsed) return parsed.response;
  const student = parsed.data;

  if (!isDate(student.enrolledOn) || (student.birthDate && !isDate(student.birthDate))) {
    return apiError(400, "INVALID_DATE", "날짜 형식이 올바르지 않습니다.");
  }

  const existing = await result.context.env.DB.prepare(
    "SELECT id FROM students WHERE id = ? AND organization_id = ? LIMIT 1",
  )
    .bind(id, result.context.organizationId)
    .first<{ id: string }>();
  if (!existing) {
    return apiError(404, "STUDENT_NOT_FOUND", "학생을 찾을 수 없습니다.");
  }

  if (new Set(student.classIds).size !== student.classIds.length) {
    return apiError(400, "INVALID_CLASS", "중복된 반을 선택할 수 없습니다.");
  }
  if (student.classIds.length > 0) {
    const placeholders = student.classIds.map(() => "?").join(", ");
    const classes = await result.context.env.DB.prepare(
      `SELECT id FROM classes
       WHERE organization_id = ? AND id IN (${placeholders})`,
    )
      .bind(result.context.organizationId, ...student.classIds)
      .all<{ id: string }>();
    if (classes.results.length !== student.classIds.length) {
      return apiError(400, "INVALID_CLASS", "선택한 반을 확인해 주세요.");
    }
  }

  const statements = [
    result.context.env.DB.prepare(
      `UPDATE students
       SET name = ?, birth_date = ?, phone = ?, guardian_phone = ?,
           school = ?, grade = ?, graduated_school = ?, address = ?,
           enrolled_on = ?, status = ?, memo = ?,
           updated_at = cast(unixepoch('subsecond') * 1000 as integer)
       WHERE id = ? AND organization_id = ?`,
    ).bind(
      student.name,
      student.birthDate,
      student.phone,
      student.guardianPhone,
      student.school,
      student.grade,
      student.graduatedSchool,
      student.address,
      student.enrolledOn,
      student.status ?? "active",
      student.memo,
      id,
      result.context.organizationId,
    ),
    result.context.env.DB.prepare(
      "DELETE FROM class_students WHERE student_id = ? AND organization_id = ?",
    ).bind(id, result.context.organizationId),
    result.context.env.DB.prepare(
      `DELETE FROM seat_occupancy
       WHERE student_id = ? AND organization_id = ? AND ? = 'withdrawn'`,
    ).bind(id, result.context.organizationId, student.status ?? "active"),
    ...student.classIds.map((classId) =>
      result.context.env.DB.prepare(
        `INSERT INTO class_students (organization_id, class_id, student_id)
         VALUES (?, ?, ?)`,
      ).bind(result.context.organizationId, classId, id),
    ),
  ];

  await result.context.env.DB.batch(statements);
  return apiJson({ id });
}
